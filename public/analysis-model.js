import {isContentUnit} from './material-units.js';
import { analyze } from './domain.js';
import { jobFocusFor, compareJobFocus } from './job-focus.js';

const capabilityStates=new Set(['已有明确证据','表达不足','相关但不等价','尚未确认','确认没有相关经历']);
const conditionStates=new Set(['按已提供信息符合','存在明确差异','待确认']);
const copy=a=>({...a});
const experienceText=exp=>String(exp?.text??exp?.original??'');

/** Derive the wording and next action without mutating a saved task or its choices. */
export function getRequirementAssessment(task, req) {
  const requirement=typeof req==='string'?(task.requirements||[]).find(r=>r.id===req):req;
  if(!requirement)return {association:null,status:'尚未确认',tone:'gray',label:'要求待确认',action:'请先校对岗位要求。',evidence:'',experienceId:''};
  const existing=(task.associations||[]).find(a=>a.requirementId===requirement.id);
  let association=existing?copy(existing):analyze({...task,associations:[]}).associations.find(a=>a.requirementId===requirement.id);
  association=association||{requirementId:requirement.id,experienceId:'',status:'尚未确认',evidence:''};
  if(requirement.category==='明确条件') {
    const status=conditionStates.has(association.status)?association.status:'待确认';
    const tone=status==='按已提供信息符合'?'green':status==='存在明确差异'?'amber':'gray';
    return {association:{...association,experienceId:'',status},status,tone,label:status,action:status==='按已提供信息符合'?'保留已提供的条件信息，无需改写经历。':status==='存在明确差异'?'核实条件差异；可以继续修改真实经历，不为符合条件更改事实。':'核实学历、毕业或到岗等明确条件；这项条件不进入经历改写优先级。',evidence:String(association.evidence||''),experienceId:''};
  }
  let experienceId=association.experienceId||'';
  const exp=(task.experiences||[]).find(e=>e.id===experienceId&&isContentUnit(e));
  let status=capabilityStates.has(association.status)?association.status:'尚未确认';
  let evidence=String(association.evidence||'');
  if(experienceId&&!exp){experienceId='';status='尚未确认';evidence='';association={...association,reason:'原关联经历已变化或不在本版，请重新核对关联。'};}
  if(!exp) {
    const sources=[...(task.experiences||[]).map(experienceText),String(task.resumeCorrected||task.resumeOriginal||'')];
    const lines=evidence.split(/\r?\n/).filter(line=>line.trim());
    const usableSource=lines.length>0&&lines.every(line=>sources.some(source=>source.includes(line)));
    if(!usableSource)evidence='';
    if(status==='已有明确证据'&&!usableSource)status='尚未确认';
    if(status==='确认没有相关经历') {
      const explicitNone=(association.manual===true||association.origin==='user')&&association.manualStatus===true
        || (task.facts||[]).some(f=>f.status==='none'&&!f.experienceId&&f.requirementId===requirement.id)
        || (task.questions||[]).some(q=>q.status==='none'&&!q.experienceId&&q.requirementId===requirement.id);
      if(!explicitNone)status='尚未确认';
    }
  }
  const confirmed=(task.facts||[]).filter(f=>f.experienceId===experienceId&&f.status==='confirmed').map(f=>String(f.text));
  const source=experienceText(exp);
  if(exp&&evidence&&!source.includes(evidence)&&!confirmed.some(f=>f.includes(evidence))) {
    const lines=evidence.split(/\r?\n/).filter(Boolean);
    evidence=lines.every(line=>source.includes(line)||confirmed.some(f=>f.includes(line)))?evidence:source;
  }
  if(exp&&!evidence)evidence=source;
  const conflict=Boolean(exp&&(association.conflict||(task.facts||[]).some(f=>f.experienceId===experienceId&&f.status==='conflict')));
  if(conflict){status='尚未确认';association={...association,conflict:true,needsClarification:true};}
  association={...association,status,experienceId,evidence};
  if(conflict)return {association,status,tone:'red',label:'先处理事实冲突',action:'先解决本经历的冲突信息；冲突未解决前不能写入确认稿。',evidence,experienceId};
  if(status==='已有明确证据')return {association,status,tone:'green',label:'明确支持 · 无需改写',action:'保留现有表达即可，无需继续补问；也可按个人意愿润色。',evidence,experienceId};
  if(status==='表达不足')return {association,status,tone:association.needsClarification===false?'purple':'amber',label:association.needsClarification===false?'可调整表达':'表达不足 · 先补充事实',action:association.needsClarification===false?'事实已经明确，可调整结构与重点，避免新增未经确认的内容。':'针对这一项要求补充本人职责、方法或实际产出，确认后再改写；也可以跳过。',evidence,experienceId};
  if(status==='相关但不等价')return {association,status,tone:'purple',label:'相关，但不能等同',action:'只突出已有相关工作并说明边界；不把离线实验、原型或文献调研改成另一种经历。',evidence,experienceId};
  if(status==='确认没有相关经历')return {association,status,tone:'gray',label:'已确认未做过这一项',action:'如实保留这项缺口，不生成对应经历，也不影响其他要求的判断。',evidence,experienceId};
  return {association,status:'尚未确认',tone:'gray',label:'信息未知 · 不等于没有',action:experienceId?'核实这段经历是否包含该项工作；未确认前使用已有事实，不猜测。':'当前没有可靠关联。可以指出已有经历，或如实保留未知。',evidence,experienceId};
}

/** Include every experience once; a ranking is guidance, never automatic selection. */
export function getRewritePlan(task) {
  const assessments=(task.requirements||[]).filter(r=>r.category!=='明确条件').flatMap(req=>getRequirementAssessments(task,req).map(a=>({requirementId:req.id,...a})));
  const order={clarify:0,polish:1,keep:2};
  return (task.experiences||[]).filter(isContentUnit).map((exp,index)=>{
    const related=assessments.filter(a=>a.experienceId===exp.id);
    const requirementIds=[...new Set(related.map(a=>a.requirementId))];
    const conflict=!exp.excluded&&(task.facts||[]).some(f=>f.experienceId===exp.id&&f.status==='conflict');
    let priority='keep',label='保留原文',reason='尚无可靠关联，默认保留，不为岗位要求创造经历。';
    if(exp.excluded)reason='本段已明确不纳入本版，保留材料记录，不生成建议。';
    else if(conflict||related.some(a=>a.association?.conflict)){priority='clarify';label='先处理冲突';reason='本段存在未解决的事实冲突，处理后再决定是否改写。';}
    else if(related.some(a=>a.status==='尚未确认'||a.status==='表达不足'&&a.association?.needsClarification!==false)){priority='clarify';label='先补充事实';reason='至少一项相关要求仍缺少明确依据。先按问题确认事实，再决定改写；可以跳过并保留原文。';}
    else if(related.some(a=>a.status==='表达不足'||a.status==='相关但不等价')||(task.facts||[]).some(f=>f.experienceId===exp.id&&f.status==='confirmed'&&!f.requirementId&&!f.questionId&&!experienceText(exp).includes(f.text))){priority='polish';label='按现有事实调整表达';reason='可突出已有事实与表达重点，同时保留不同工作类型之间的边界。';}
    else if(related.some(a=>a.status==='已有明确证据'))reason='相关要求已有明确证据，保留现有表达即可，无需强制改写。';
    else if(related.length)reason='已确认未做过相关要求中的工作，保留真实原文，不补造对应经历。';
    const focus=jobFocusFor(task,exp.id);
    return {experienceId:exp.id,priority,label,reason,requirementIds,focus,_order:index};
  }).sort((a,b)=>order[a.priority]-order[b.priority]||compareJobFocus(a.focus,b.focus)||a._order-b._order).map(({_order,...item})=>item);
}

export function getRequirementAssessments(task,req) {
  const association=(task.associations||[]).find(a=>a.requirementId===req.id);
  if(!association?.links?.length)return [getRequirementAssessment(task,req)];
  return association.links.map(link=>getRequirementAssessment({...task,associations:[link]},req));
}
