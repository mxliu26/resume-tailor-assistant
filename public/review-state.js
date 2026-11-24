import {isContentUnit} from './material-units.js';
import {parseMaterials, reconcileExperiences, isFormattingOnly, normalizeFormattingWithMap, composeText, analyze} from './domain.js';

export function reviewDraft(task) {
  return {
    resume: task.materialResume ?? composeText({...task, suggestions:[], selected:[]}),
    jd: task.materialJD ?? task.jdCorrected,
  };
}

export function reviewChanges(task, draft = reviewDraft(task)) {
  const resumeChanged = draft.resume !== task.resumeCorrected;
  const jdChanged = draft.jd !== task.jdCorrected;
  const resumeContent = resumeChanged && !isFormattingOnly(task.resumeCorrected, draft.resume);
  const jdContent = jdChanged && !isFormattingOnly(task.jdCorrected, draft.jd);
  return {resumeChanged,jdChanged,resumeContent,jdContent,
    formattingOnly:(resumeChanged||jdChanged)&&!resumeContent&&!jdContent&&!task.reviewMetadataDirty,
    substantive:resumeContent||jdContent||!!task.reviewMetadataDirty};
}

function reconcileRequirements(incoming, previous) {
  return incoming.map(r=>{
    const matches=previous.filter(p=>isFormattingOnly(p.text,r.text));
    return matches.length===1&&incoming.filter(n=>isFormattingOnly(n.text,matches[0].text)).length===1
      ? {...r,id:matches[0].id,category:matches[0].category} : r;
  });
}

function remapFormattingUnits(before,after,units,experience=false){
  if(before===after)return structuredClone(units);
  const a=normalizeFormattingWithMap(before),b=normalizeFormattingWithMap(after);
  if(a.text!==b.text)return null;
  let cursor=0;
  const result=[];
  for(const unit of units){
    const source=experience?(unit.sourceText??unit.original??unit.text):unit.text;
    let start=experience&&before.slice(unit.start,unit.end)===source?unit.start:before.indexOf(source,cursor);
    if(start<0)return null;
    const end=start+source.length;
    let first=a.starts.findIndex(offset=>offset>=start),last=first;
    if(first<0||a.ends[first]>end)return null;
    while(last+1<a.ends.length&&a.ends[last+1]<=end)last++;
    let nextStart=b.starts[first];
    const lineStart=after.lastIndexOf('\n',nextStart-1)+1;
    if(normalizeFormattingWithMap(after.slice(lineStart,nextStart+1)).text===after[nextStart])nextStart=lineStart;
    const nextEnd=b.ends[last],text=after.slice(nextStart,nextEnd);
    if(!isFormattingOnly(source,text))return null;
    result.push(experience?{...unit,start:nextStart,end:nextEnd,sourceText:text,original:text,text}:{...unit,text,original:text});
    cursor=end;
  }
  return result;
}

/** Pure commit: material changes are applied together, after successful validation.
 * Formatting does not advance the semantic revision or revoke factual confirmation.
 */
export function applyReview(task, options={}) {
  const next=structuredClone(task), draft=reviewDraft(task), change=reviewChanges(task,draft);
  const limit=options.maxTextLength||30000;
  if(!draft.resume.trim()||!draft.jd.trim())throw Error('简历与 JD 不能为空，已保留你正在编辑的内容。');
  if(draft.resume.length>limit||draft.jd.length>limit)throw Error(`单份材料最多支持 ${limit} 字，请缩减后再应用。`);
  const parsed=options.parsed||parseMaterials(draft.resume,draft.jd);
  const retained=!change.resumeContent&&!options.forceReparse&&task.experiences.some(e=>e.kind!=='context')
    ?remapFormattingUnits(task.resumeCorrected,draft.resume,task.experiences,true):null;
  const reconciled=retained?{experiences:retained,changedIds:[],orphanedIds:[]}:reconcileExperiences(parsed.experiences,task.experiences);
  const oldExperienceIds=new Set(task.experiences.filter(e=>e.kind!=='context').map(e=>e.id));
  const newIds=new Set(reconciled.experiences.map(e=>e.id));
  const structural=task.suggestions.some(s=>!newIds.has(s.experienceId))||task.facts.some(f=>!newIds.has(f.experienceId));
  next.resumeCorrected=draft.resume;
  next.jdCorrected=draft.jd;
  next.experiences=reconciled.experiences;
  next.requirements=(!change.jdContent&&remapFormattingUnits(task.jdCorrected,draft.jd,task.requirements))||reconcileRequirements(parsed.requirements,task.requirements);
  next.parseWarnings=retained?[...(task.parseWarnings||[])]:parsed.warnings;
  next.selected=task.selected.filter(id=>next.experiences.some(e=>e.id===id&&isContentUnit(e)));
  if(!oldExperienceIds.size)next.selected=next.experiences.filter(e=>e.kind!=='context').map(e=>e.id);
  next.orphanedFacts=[...(task.orphanedFacts||[]),...task.facts.filter(f=>!newIds.has(f.experienceId))];
  next.facts=next.facts.filter(f=>newIds.has(f.experienceId));
  const changedIds=new Set(reconciled.changedIds);
  for(const f of next.facts){
    if(change.resumeContent&&changedIds.has(f.experienceId)&&f.status==='confirmed')f.status='pending';
    if(!change.resumeContent&&f.experienceSource)f.experienceSource=next.experiences.find(e=>e.id===f.experienceId).text;
  }
  next.questions=next.questions.filter(q=>newIds.has(q.experienceId));
  if(change.substantive||structural){
    next.revision=(task.revision||1)+1;
    next.stale=next.suggestions.length>0;
    next.confirmed=false;
    next.reviewNeedsConfirmation=true;
  }
  if(change.resumeContent){
    next.corrections=[...(next.corrections||[]),...next.experiences.filter(e=>changedIds.has(e.id)).map(e=>({experienceId:e.id,text:e.text,type:task.correctionType||'correction',at:new Date().toISOString()}))];
  }
  const idsStable=next.requirements.every(r=>task.requirements.some(p=>p.id===r.id))&&next.requirements.length===task.requirements.length;
  if(change.substantive||structural||!idsStable||!task.associations.length){
    const result=analyze(next);next.associations=result.associations;next.questions=result.questions;
  }
  // Keep the last applied comparison separately from the immutable initial input.
  // A no-op confirmation or reparsing must not erase visible edit highlights.
  if(change.resumeChanged||change.jdChanged){
    const units={};
    for(const unit of next.experiences){
      const old=task.experiences.find(e=>e.id===unit.id);
      const before=old?.sourceText??old?.original;
      if(before!==undefined&&before!==unit.text)units[unit.id]={before,after:unit.text};
    }
    next.lastReviewChanges={
      resume:change.resumeChanged?{before:task.resumeCorrected,after:draft.resume}:task.lastReviewChanges?.resume||null,
      jd:change.jdChanged?{before:task.jdCorrected,after:draft.jd}:task.lastReviewChanges?.jd||null,
      units:change.resumeChanged?units:task.lastReviewChanges?.units||{},appliedAt:new Date().toISOString()
    };
  }
  delete next.materialResume;delete next.materialJD;
  next.reviewDirty=false;next.reviewMetadataDirty=false;
  next.updatedAt=new Date().toISOString();next.parserVersion=2;
  return {task:next,change:{...change,structural}};
}

export function requiresReviewConfirmation(task) {
  return !!task.reviewNeedsConfirmation||reviewChanges(task).substantive||task.maxStep<2;
}
