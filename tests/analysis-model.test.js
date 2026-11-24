import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze,parseMaterials } from '../public/domain.js';
import { getRequirementAssessment,getRewritePlan } from '../public/analysis-model.js';

function fixture(){
  const experiences=[
    {id:'product',title:'校园预约项目',kind:'experience',text:'校园预约项目\n参与需求整理，使用 Figma 制作预约原型，绘制预约流程图。输出课程报告，项目尚未上线。'},
    {id:'research',title:'问答评测',kind:'experience',text:'问答评测\n参与离线模型评测，使用 Python 整理 1,200 条数据，归纳问题类型。未开展线上 A/B 测试。'},
    {id:'club',title:'志愿服务',kind:'experience',text:'志愿服务\n负责活动签到，整理报名信息。'},
    {id:'skills',title:'专业技能',kind:'context',text:'专业技能\nFigma、Python、SQL。'}
  ];
  const requirements=[
    {id:'tool',text:'熟悉 Figma',category:'工具或方法'},
    {id:'compound',text:'熟悉 Figma，具备清晰的沟通与文档表达能力',category:'工作任务与能力'},
    {id:'online',text:'有线上 A/B 测试经验者优先',category:'加分项'},
    {id:'unknown',text:'熟悉 Kubernetes 集群管理',category:'工作任务与能力'},
    {id:'condition',text:'每周可到岗 3 天',category:'明确条件'}
  ];
  return {experiences,requirements,selected:['product','research','club'],facts:[],questions:[],associations:[],revision:1,resumeCorrected:experiences.map(e=>e.text).join('\n\n')};
}
function analyzed(){const t=fixture();Object.assign(t,analyze(t));return t;}

test('clear support says no rewrite and does not ask a question for that requirement',()=>{
  const t=analyzed(),a=getRequirementAssessment(t,t.requirements[0]);
  assert.equal(a.status,'已有明确证据');assert.match(a.label,/无需改写/);
  assert.ok(!t.questions.some(q=>q.requirementId==='tool'&&q.status==='pending'));
  assert.match(a.evidence,/Figma/);
});
test('long detailed experience still gets targeted clarification for unsupported composite meaning',()=>{
  const t=fixture();t.experiences[0].text+='\n'+ '参与整理需求并完成项目报告。'.repeat(12);
  t.facts.push({id:'f',experienceId:'product',text:'整理了课程汇报材料。',status:'confirmed'});
  Object.assign(t,analyze(t));
  const q=t.questions.find(q=>q.requirementId==='compound');
  assert.equal(q.experienceId,'product');assert.match(q.text,/沟通或文档协作/);
  assert.equal(getRewritePlan(t).find(p=>p.experienceId==='product').priority,'clarify');
});
test('unknown is not absence and an unassociated requirement never invents an experience',()=>{
  const t=analyzed(),a=getRequirementAssessment(t,'unknown');
  assert.equal(a.status,'尚未确认');assert.equal(a.experienceId,'');assert.match(a.label,/不等于没有/);
  assert.ok(!t.questions.some(q=>q.requirementId==='unknown'));
});
test('related offline work is not online evidence and plan keeps its boundary',()=>{
  const t=analyzed(),a=getRequirementAssessment(t,'online');
  assert.equal(a.status,'相关但不等价');assert.match(a.action,/离线/);
  assert.equal(getRewritePlan(t).find(p=>p.experienceId==='research').priority,'polish');
});
test('hard conditions never attach to experience or influence its rewrite priority',()=>{
  const t=fixture();t.requirements=[t.requirements.find(r=>r.id==='condition')];
  t.associations=[{requirementId:'condition',experienceId:'product',status:'按已提供信息符合',evidence:'每周可到岗3天'}];
  const a=getRequirementAssessment(t,'condition');assert.equal(a.experienceId,'');assert.equal(a.association.experienceId,'');
  assert.ok(getRewritePlan(t).every(p=>p.priority==='keep'&&p.requirementIds.length===0));
  assert.equal(analyze(t).associations[0].experienceId,'');
});
test('none applies only to its exact requirement and experience, including questionId migration',()=>{
  const t=fixture();
  t.requirements=t.requirements.filter(r=>['tool','compound'].includes(r.id));
  t.questions=[{id:'q',requirementId:'compound',experienceId:'product',status:'none',answer:'未做过沟通工作'}];
  t.facts=[{id:'none',experienceId:'product',questionId:'q',status:'none',text:'Figma 沟通相关工作未做过'}];
  const result=analyze(t);
  assert.equal(result.associations.find(a=>a.requirementId==='compound').status,'确认没有相关经历');
  assert.equal(result.associations.find(a=>a.requirementId==='tool').status,'已有明确证据');
  t.facts[0].experienceId='research';t.questions[0].experienceId='research';
  assert.notEqual(analyze(t).associations.find(a=>a.requirementId==='compound').status,'确认没有相关经历');
});
test('legacy none without requirement binding stays historical rather than contaminating keywords',()=>{
  const t=fixture();t.facts=[{id:'old',experienceId:'product',status:'none',text:'未做过 Figma 用户需求项目'}];
  assert.equal(analyze(t).associations.find(a=>a.requirementId==='tool').status,'已有明确证据');
});
test('manual association is retained while its status is recalculated unless manually fixed',()=>{
  const t=fixture();t.associations=[{requirementId:'unknown',experienceId:'club',status:'已有明确证据',manual:true,manualStatus:false}];
  let result=analyze(t),a=result.associations.find(a=>a.requirementId==='unknown');
  assert.equal(a.experienceId,'club');assert.equal(a.status,'尚未确认');assert.ok(result.questions.some(q=>q.requirementId==='unknown'&&q.experienceId==='club'));
  t.associations[0].manualStatus=true;
  assert.equal(analyze(t).associations.find(a=>a.requirementId==='unknown').status,'已有明确证据');
});
test('legacy human correction and chosen status survive refresh',()=>{
  const t=fixture();t.associations=[{requirementId:'compound',experienceId:'club',status:'相关但不等价',reason:'用户纠正关联并人工核对。'}];
  const a=analyze(t).associations.find(a=>a.requirementId==='compound');
  assert.equal(a.experienceId,'club');assert.equal(a.status,'相关但不等价');
});
test('known conflict overrides manual clear evidence and requires resolution before rewriting',()=>{
  const t=analyzed();t.facts=[{id:'conflict',experienceId:'product',status:'conflict',text:'职责存在冲突'}];
  t.associations.find(a=>a.requirementId==='tool').manual=true;t.associations.find(a=>a.requirementId==='tool').manualStatus=true;
  Object.assign(t,analyze(t));
  const a=getRequirementAssessment(t,'tool');assert.equal(a.status,'尚未确认');assert.equal(a.tone,'red');
  assert.equal(getRewritePlan(t)[0].priority,'clarify');assert.match(getRewritePlan(t)[0].label,/冲突/);
  assert.ok(!t.questions.some(q=>q.status==='pending'&&q.experienceId==='product'));
});
test('rewrite plan includes experiences and skill content once and orders clarify, polish, keep',()=>{
  const t=analyzed(),before=JSON.stringify(t),plan=getRewritePlan(t);
  assert.deepEqual(plan.map(x=>x.priority),['clarify','polish','keep','keep']);
  assert.deepEqual(new Set(plan.map(x=>x.experienceId)),new Set(['product','research','club','skills']));
  assert.ok(plan.every(x=>Array.isArray(x.requirementIds)));assert.equal(JSON.stringify(t),before);
});
test('at most three active pending questions, no repeated skipped question, stale pending retain input as history',()=>{
  const t=fixture();t.requirements=Array.from({length:6},(_,i)=>({id:`r${i}`,text:`需求沟通与指标口径 ${i}`,category:'工作任务与能力'}));
  t.associations=t.requirements.map(r=>({requirementId:r.id,experienceId:'product',manual:true,manualStatus:false,status:'尚未确认'}));
  t.questions=[{id:'obsolete',requirementId:'removed',experienceId:'product',status:'pending',answer:'已输入但尚未提交的内容'}, {id:'skipped',requirementId:'r0',experienceId:'product',status:'skipped'}];
  const first=analyze(t);
  assert.equal(first.questions.filter(q=>q.status==='pending').length,3);
  assert.equal(first.questions.find(q=>q.id==='obsolete').status,'archived');assert.match(first.questions.find(q=>q.id==='obsolete').answer,/已输入/);
  assert.ok(!first.questions.some(q=>q.requirementId==='r0'&&q.status==='pending'));
  Object.assign(t,first);const second=analyze(t);assert.deepEqual(second.questions,first.questions);
});
test('deselecting rewrite content never hides its question or discards its answer draft',()=>{
  const t=fixture();t.associations=[{requirementId:'unknown',experienceId:'club',manual:true,manualStatus:false,status:'尚未确认'}];
  Object.assign(t,analyze(t));const prior=t.questions.find(q=>q.requirementId==='unknown');prior.answer='未提交答案';
  t.selected=['product'];Object.assign(t,analyze(t));assert.equal(t.questions.find(q=>q.id===prior.id).status,'pending');
  t.selected.push('club');Object.assign(t,analyze(t));
  assert.equal(t.questions.filter(q=>q.id===prior.id).length,1);assert.equal(t.questions.find(q=>q.id===prior.id).status,'pending');
  assert.equal(t.questions.find(q=>q.id===prior.id).answer,'未提交答案');
});
test('simple skill evidence in context does not fabricate project usage or force experience rewriting',()=>{
  const t=fixture();t.experiences=t.experiences.filter(e=>e.id==='skills');t.requirements=[{id:'sql',text:'熟悉 SQL',category:'工具或方法'}];
  Object.assign(t,analyze(t));const a=getRequirementAssessment(t,'sql');
  assert.equal(a.status,'已有明确证据');assert.equal(a.experienceId,'skills');assert.equal(t.questions.length,0);assert.equal(getRewritePlan(t)[0].priority,'keep');assert.equal(t.experiences[0].kind,'context');
});
test('negative tool statements and unsupported additional duties do not count as sufficient evidence',()=>{
  const t=fixture();t.experiences[0].text='项目\n未使用 Figma。参与需求整理，输出调研记录。';
  t.requirements=[{id:'figma',text:'熟悉 Figma',category:'工具或方法'},{id:'budget',text:'参与需求整理并负责预算管理',category:'工作任务与能力'}];
  const result=analyze(t);
  assert.notEqual(result.associations.find(a=>a.requirementId==='figma').status,'已有明确证据');
  assert.notEqual(result.associations.find(a=>a.requirementId==='budget').status,'已有明确证据');
});
test('skill paragraphs mentioning systems and development stay context, not selectable experiences',()=>{
  const text='专业技能\n熟悉推荐系统与机器学习算法\nLLM Agent 系统开发\nPython、SQL\n项目经历\n校园预约项目\n参与调研并整理需求。';
  const p=parseMaterials(text,'需求整理');
  assert.equal(p.experiences.filter(e=>e.kind==='experience').length,1);
  assert.ok(p.experiences.find(e=>e.kind==='context').text.includes('LLM Agent'));
});
test('empty or fabricated standalone evidence cannot be presented as clear support',()=>{
  const t=fixture();
  for(const evidence of ['', '拥有十年 Kubernetes 经验']) {
    t.associations=[{requirementId:'unknown',experienceId:'',status:'已有明确证据',evidence,manual:true,manualStatus:true}];
    const a=getRequirementAssessment(t,'unknown');assert.equal(a.status,'尚未确认');assert.equal(a.evidence,'');
  }
  t.associations=[{requirementId:'unknown',experienceId:'',status:'确认没有相关经历'}];
  assert.equal(getRequirementAssessment(t,'unknown').status,'尚未确认');
  t.associations[0].manual=true;t.associations[0].manualStatus=true;
  assert.equal(getRequirementAssessment(t,'unknown').status,'确认没有相关经历');
});
test('polishing and related-but-not-equivalent states use the same purple presentation tone',()=>{
  const t=analyzed();assert.equal(getRequirementAssessment(t,'online').tone,'purple');
  const a=t.associations.find(a=>a.requirementId==='compound');a.needsClarification=false;
  assert.equal(getRequirementAssessment(t,'compound').tone,'purple');
});
test('refresh preserves explicitly reviewed hard-condition states and never attaches them to experiences',()=>{
  const t=fixture();
  for(const status of ['按已提供信息符合','存在明确差异','待确认']) {
    t.associations=[{requirementId:'condition',experienceId:'product',status,manual:true,manualStatus:true,reason:'人工核实到岗安排。'}];
    const a=analyze(t).associations.find(a=>a.requirementId==='condition');
    assert.equal(a.status,status);assert.equal(a.experienceId,'');assert.equal(a.manual,true);assert.equal(a.manualStatus,true);
    assert.equal(getRequirementAssessment({...t,associations:[a]},'condition').status,status);
  }
  t.associations[0].status='已有明确证据';
  assert.equal(analyze(t).associations.find(a=>a.requirementId==='condition').status,'待确认');
  t.associations[0].status='按已提供信息符合';t.associations[0].manualStatus=false;
  assert.equal(analyze(t).associations.find(a=>a.requirementId==='condition').status,'待确认');
});
test('refresh retains explicit requirement-level no-experience confirmation without a linked experience',()=>{
  const t=fixture();
  t.associations=[{requirementId:'unknown',experienceId:'',status:'确认没有相关经历',manual:true,manualStatus:true,reason:'用户确认没有这一项经历。'}];
  Object.assign(t,analyze(t));
  const a=t.associations.find(a=>a.requirementId==='unknown');
  assert.equal(a.status,'确认没有相关经历');assert.equal(a.experienceId,'');
  assert.equal(getRequirementAssessment(t,'unknown').status,'确认没有相关经历');
  assert.ok(!t.questions.some(q=>q.status==='pending'&&q.requirementId==='unknown'));
  a.manualStatus=false;
  assert.equal(analyze(t).associations.find(a=>a.requirementId==='unknown').status,'尚未确认');
});
test('a requirement supported only by confirmed supplemental facts is polishing work, not already-complete text',()=>{
  const t=fixture();t.requirements=[{id:'doc',text:'参与需求整理并输出需求文档',category:'工作任务与能力'}];
  t.facts=[{id:'doc-fact',experienceId:'product',requirementId:'doc',status:'confirmed',text:'本人编写需求文档，并整理了预约状态说明。'}];
  Object.assign(t,analyze(t));const a=t.associations[0];
  assert.equal(a.status,'表达不足');assert.equal(a.needsClarification,false);assert.equal(a.usesConfirmedFacts,true);
  assert.deepEqual(a.confirmedFactIds,['doc-fact']);assert.match(a.reason,/尚未写入/);
  assert.equal(getRewritePlan(t).find(p=>p.experienceId==='product').priority,'polish');
  assert.equal(t.questions.filter(q=>q.status==='pending').length,0);
});
test('specific confirmed answer to a composite requirement can be written while full semantic support remains qualified',()=>{
  const t=fixture();Object.assign(t,analyze(t));const q=t.questions.find(q=>q.requirementId==='compound');
  t.facts=[{id:'communication',experienceId:'product',questionId:q.id,status:'confirmed',text:'我负责与设计团队沟通原型方案，整理需求清单供组员确认。'}];q.status='confirmed';
  Object.assign(t,analyze(t));const a=t.associations.find(a=>a.requirementId==='compound');
  assert.equal(a.status,'表达不足');assert.equal(a.needsClarification,false);assert.match(a.reason,/完整支持仍需人工核对/);
  assert.equal(getRewritePlan(t).find(p=>p.experienceId==='product').priority,'polish');
});
test('base evidence remains sufficient when extra confirmed facts exist and does not force polishing',()=>{
  const t=fixture();t.requirements=t.requirements.filter(r=>r.id==='tool');
  t.facts=[{id:'extra',experienceId:'product',requirementId:'tool',status:'confirmed',text:'我整理了原型方案并输出课程报告。'}];
  Object.assign(t,analyze(t));assert.equal(t.associations[0].status,'已有明确证据');assert.equal(t.associations[0].usesConfirmedFacts,false);
  assert.equal(getRewritePlan(t).find(p=>p.experienceId==='product').priority,'keep');
});
test('unrelated, unconfirmed, vague or conflicting answers cannot skip necessary fact clarification',()=>{
  const variants=[
    {status:'confirmed',text:'我负责校园活动签到，整理了报名记录。'},
    {status:'pending',text:'我负责与设计团队沟通原型方案，整理了需求文档。'},
    {status:'unknown',text:'我负责与设计团队沟通原型方案，整理了需求文档。'},
    {status:'confirmed',text:'我沟通能力很好。'},
    {status:'conflict',text:'我负责与设计团队沟通原型方案，整理了需求文档。'}
  ];
  for(const fact of variants){const t=fixture();t.facts=[{id:'f',experienceId:'product',requirementId:'compound',...fact}];const a=analyze(t).associations.find(a=>a.requirementId==='compound');assert.equal(a.needsClarification,true,JSON.stringify(fact));}
});
test('confirmed details do not bridge an unknown association or a different requirement binding',()=>{
  const t=fixture();t.facts=[{id:'f',experienceId:'club',requirementId:'unknown',status:'confirmed',text:'我负责整理报名数据，并完成活动报告。'}];
  assert.equal(analyze(t).associations.find(a=>a.requirementId==='unknown').experienceId,'');
  t.facts=[{id:'f2',experienceId:'product',requirementId:'tool',status:'confirmed',text:'我负责与团队沟通原型方案，并整理需求清单。'}];
  const a=analyze(t).associations.find(a=>a.requirementId==='compound');assert.equal(a.needsClarification,true);
});
test('participation wording is not split as a conjunction when base work already supports the requirement',()=>{
  const t=fixture();t.requirements=[{id:'specific',text:'参与需求整理并制作原型',category:'工作任务与能力'}];
  const a=analyze(t).associations[0];assert.equal(a.status,'已有明确证据');assert.equal(a.needsClarification,false);
});
