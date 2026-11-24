import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze,parseMaterials,composeText,generateCandidates,restoreSectionTitles} from '../public/domain.js';
import {beginAnswerEdit,cancelAnswerEdit,replaceAnswer} from '../public/followup-state.js';
import {getRequirementAssessments,getRewritePlan} from '../public/analysis-model.js';
import {unitPresentation} from '../public/unit-presentation.js';
import {isContentUnit} from '../public/material-units.js';
import {applyReview} from '../public/review-state.js';
import {renderComparison} from '../public/comparison-view.js';

const resume='林同学\n电话：13800000000 邮箱：demo@example.com\n求职意向：产品实习生\n教育背景\n海川大学 本科在读\n项目经历\n园林分析项目｜队长\n2025.03—2025.06\n参与数据分析与报告整理。\n技能与优势\n• AI技能：使用 AI 工具整理需求。\n• 数据分析：熟悉 SQL、Python。\n• 团队协作：参与小组沟通。';
function fixture(){
  const jd='具备较强的沟通与文档表达能力\n熟悉 SQL';
  const parsed=parseMaterials(resume,jd);
  const t={...parsed,resumeOriginal:resume,resumeCorrected:resume,jdOriginal:jd,jdCorrected:jd,selected:[],facts:[],questions:[],associations:[],suggestions:[],revision:1,maxStep:2};
  return t;
}
const skill=t=>t.experiences.find(e=>e.sectionTitle==='技能与优势');
const project=t=>t.experiences.find(e=>e.kind==='experience');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const helpers={esc,btn:(text,action,cls='',extra='')=>`<button data-action="${action}" ${extra}>${text}</button>`,badge:(text)=>`<span>${esc(text)}</span>`};

test('original skills heading survives both type switches and exact composition',()=>{
  const t=fixture(),s=skill(t);assert.ok(s);assert.equal(s.kind,'context');assert.match(s.text,/技能与优势\n• AI技能/);
  assert.doesNotMatch(project(t).text,/技能与优势|AI技能/);
  for(const kind of ['experience','context']){s.kind=kind;s.kindOverride=kind;assert.equal(unitPresentation(s).title,'技能与优势');}
  assert.equal(composeText(t),resume);
});

test('a direct project heading after education ends the education title context',()=>{
  const text='教育背景\n海川大学 本科\n\n问答模型评测｜科研助理\n2025.03—2025.06\n使用 Python 整理数据，开展离线评测；未开展线上 A/B 测试。';
  const parsed=parseMaterials(text,'有线上 A/B 测试经验者优先');
  const exp=parsed.experiences.find(e=>e.kind==='experience');
  assert.equal(exp.sectionTitle,undefined);assert.equal(unitPresentation(exp).title,'问答模型评测');
  const t={...parsed,facts:[],questions:[],associations:[],selected:[]};assert.equal(analyze(t).associations[0].status,'相关但不等价');
});

test('legacy split skill headings recover original label without changing content, IDs or facts',()=>{
  const t=fixture(),s=skill(t);const split=s.text.indexOf('• AI技能');
  s.text=s.text.slice(split);s.sourceText=s.text;s.original=s.text;s.start+=split;s.title='数据分析';s.kind='experience';delete s.sectionTitle;
  const before=structuredClone(s);restoreSectionTitles(t);
  assert.equal(unitPresentation(s).title,'技能与优势');assert.equal(s.text,before.text);assert.equal(s.id,before.id);assert.equal(s.start,before.start);
});

test('skills and education can be linked or supplemented without exposing contact information as rewrite scope',()=>{
  const t=fixture();assert.equal(isContentUnit(skill(t)),true);assert.equal(isContentUnit(t.experiences.find(e=>e.title==='教育背景')),true);
  assert.equal(isContentUnit(t.experiences[0]),false);
  assert.ok(!getRewritePlan(t).some(p=>p.experienceId===t.experiences[0].id));
});

test('one requirement can use several sections with independent judgments and source-bound questions',()=>{
  const t=fixture(),r=t.requirements[0],p=project(t),s=skill(t);
  t.associations=[{requirementId:r.id,experienceId:p.id,experienceIds:[p.id,s.id],manual:true,manualStatus:false}];
  Object.assign(t,analyze(t));
  assert.deepEqual(t.associations[0].experienceIds,[p.id,s.id]);
  assert.equal(getRequirementAssessments(t,r).length,2);
  assert.ok(t.questions.some(q=>q.requirementId===r.id&&q.experienceId===s.id));
  assert.ok(t.questions.some(q=>q.requirementId===r.id&&q.experienceId===p.id));
  const q=t.questions.find(q=>q.experienceId===s.id);q.status='none';q.answer='明确未做过';Object.assign(t,analyze(t));
  assert.equal(t.associations[0].links.find(a=>a.experienceId===s.id).status,'确认没有相关经历');
  assert.notEqual(t.associations[0].links.find(a=>a.experienceId===p.id).status,'确认没有相关经历');
  assert.deepEqual(analyze(JSON.parse(JSON.stringify(t))).associations,t.associations);
});

test('requesting a later question rotates the three-question batch without losing earlier drafts',()=>{
  const t=fixture(),p=project(t);t.requirements=Array.from({length:6},(_,i)=>({id:'r'+i,text:'沟通与文档表达 '+i,category:'工作任务与能力'}));
  t.associations=t.requirements.map(r=>({requirementId:r.id,experienceId:p.id,manual:true,manualStatus:false}));
  Object.assign(t,analyze(t));assert.equal(t.questions.filter(q=>q.status==='pending').length,3);
  const first=t.questions.find(q=>q.requirementId==='r2');first.answer='尚未提交的真实信息';
  t.requestedQuestionKey='r5:'+p.id;Object.assign(t,analyze(t));
  assert.equal(t.questions.filter(q=>q.status==='pending').length,3);assert.ok(t.questions.some(q=>q.requirementId==='r5'&&q.status==='pending'));
  assert.equal(t.questions.find(q=>q.id===first.id).answer,first.answer);
  t.requestedQuestionKey='r2:'+p.id;Object.assign(t,analyze(t));assert.equal(t.questions.find(q=>q.id===first.id).status,'pending');
});

test('course additions do not steal an existing work association or silently add extra sources',()=>{
  const t=fixture(),p=project(t),education=t.experiences.find(e=>e.title==='教育背景');
  t.requirements=[{id:'data',text:'数据分析与问题跟进',category:'工作任务与能力'}];Object.assign(t,analyze(t));
  assert.equal(t.associations[0].experienceId,p.id);
  t.facts=[{id:'course',experienceId:education.id,text:'课程包括数据分析、Python、SQL 和问题归纳。',status:'confirmed'}];
  Object.assign(t,analyze(t));assert.equal(t.associations[0].experienceId,p.id);assert.deepEqual(t.associations[0].experienceIds,[p.id]);
  t.associations=[{requirementId:'data',experienceId:education.id,manual:true,manualStatus:false}];Object.assign(t,analyze(t));
  assert.equal(t.associations[0].experienceId,education.id,'explicit manual association stays available');
});

test('all answered shortcuts can reopen; cancel preserves previous answer and confirmed fact',()=>{
  for(const status of ['none','unknown','skipped','provided','confirmed']){
    const t=fixture();t.questions=[{id:'q',experienceId:skill(t).id,requirementId:t.requirements[0].id,status,answer:'旧回答'}];
    t.facts=[{id:'f',questionId:'q',experienceId:skill(t).id,text:'已确认事实',status:'confirmed'}];
    beginAnswerEdit(t,'q');assert.equal(t.questions[0].editing,true);t.questions[0].draftAnswer='新的草稿';
    assert.equal(t.facts[0].status,'confirmed');cancelAnswerEdit(t,'q');assert.equal(t.questions[0].answer,'旧回答');assert.equal(t.facts[0].status,'confirmed');
    beginAnswerEdit(t,'q');t.questions[0].draftAnswer='新回答';const ids=replaceAnswer(t,'q',{text:'新回答'});
    assert.deepEqual(ids,['f']);assert.equal(t.facts.length,0);assert.equal(t.questions[0].history[0].answer,'旧回答');assert.equal(t.questions[0].status,'provided');
    assert.ok(!t.questions[0].editing);
  }
});

test('replacing an explicit no removes only its obsolete evidence and restores the exact pair',()=>{
  const t=fixture(),s=skill(t),r=t.requirements[0];t.associations=[{requirementId:r.id,experienceId:s.id,manual:true,manualStatus:false}];Object.assign(t,analyze(t));
  const q=t.questions.find(q=>q.requirementId===r.id);replaceAnswer(t,q.id,{status:'none',text:'未做过'});
  t.facts.push({id:'none',questionId:q.id,requirementId:r.id,experienceId:s.id,text:'未做过',status:'none'});Object.assign(t,analyze(t));assert.equal(t.associations[0].status,'确认没有相关经历');
  beginAnswerEdit(t,q.id);replaceAnswer(t,q.id,{text:'我负责整理团队沟通记录，编写需求文档。'});Object.assign(t,analyze(t));
  assert.notEqual(t.associations[0].status,'确认没有相关经历');assert.equal(t.facts.length,0);
});

test('confirmed skill additions flow into selected suggestions and final resume without inventing a project',()=>{
  const t=fixture(),s=skill(t);t.requirements=t.requirements.filter(r=>r.text==='熟悉 SQL');t.selected=[s.id];t.facts=[{id:'f',experienceId:s.id,text:'使用 SQL 整理课程数据，并输出查询说明。',status:'confirmed'}];
  t.suggestions=generateCandidates(t).map(s=>({...s,status:'accepted'}));assert.equal(t.suggestions.length,1);assert.equal(t.suggestions[0].experienceId,s.id);
  const output=composeText(t);assert.ok(output.includes(t.facts[0].text));assert.ok(output.includes(project(t).text));assert.equal(output.split('技能与优势').length,2);
  assert.equal(getRewritePlan(t).find(p=>p.experienceId===s.id).priority,'polish');
  const applied=applyReview({...t,materialJD:t.jdCorrected+'\n熟悉 Figma'}).task;assert.ok(applied.selected.includes(s.id));
});

test('comparison offers skill sources, answer editing, neutral judgments and grouped additions before scope',()=>{
  const t=fixture(),s=skill(t),r=t.requirements[0];t.associations=[{requirementId:r.id,experienceId:s.id,manual:true,manualStatus:false}];Object.assign(t,analyze(t));
  const q=t.questions.find(q=>q.requirementId===r.id);q.status='unknown';q.answer='稍后补充';
  t.facts=[{id:'f',experienceId:s.id,requirementId:r.id,questionId:q.id,text:'待确认的技能补充',status:'pending'}];
  const html=renderComparison(t,helpers);
  assert.ok(html.includes(`value="${s.id}" selected>技能与优势 · 基础信息`));assert.match(html,/data-action="edit-answer"/);
  assert.equal((html.match(/class="judgment-card"/g)||[]).length,t.requirements.length);
  assert.ok(html.indexOf('id="facts-summary"')<html.indexOf('id="rewrite-plan"'));assert.equal((html.match(/id="fact-f"/g)||[]).length,1);
  assert.ok(html.includes('还可以添加其他依据'));assert.ok(html.includes('并未调用大模型'));
});

test('collaboration candidate favours concrete team and document work without claiming proven ability',()=>{
  const t=fixture(),p=project(t),s=skill(t);
  p.text='园林分析项目｜队长\n与团队完成模型构建、可视化分析及论文交付。';
  s.text='技能与优势\n英语六级，具有较强的英语沟通与文档表达能力。';
  t.experiences.unshift({id:'solo',kind:'experience',title:'独立工具项目',text:'独立工具项目\n整理需求文档，独立完成应用开发。'});
  t.requirements=t.requirements.slice(0,1);
  Object.assign(t,analyze(t));
  assert.equal(t.associations[0].experienceId,p.id);
  assert.equal(t.associations[0].status,'表达不足','ranking must not assert unsupported capability');
  assert.match(t.questions[0].text,/园林分析项目/);
  assert.match(t.questions[0].text,/沟通或文档协作/);
});

test('refresh follows corrected associations and archives old answers without moving their facts',()=>{
  const t=fixture(),p=project(t),s=skill(t),r=t.requirements[0];
  t.associations=[{requirementId:r.id,experienceId:s.id,manual:true,manualStatus:false}];
  Object.assign(t,analyze(t));
  const old=t.questions.find(q=>q.requirementId===r.id);
  old.status='provided';old.answer='旧的技能回答';
  t.facts=[{id:'old-fact',experienceId:s.id,requirementId:r.id,questionId:old.id,status:'pending',text:'技能补充仍属于技能。'}];
  const facts=structuredClone(t.facts);
  t.associations=[{requirementId:r.id,experienceId:p.id,manual:true,manualStatus:false}];
  Object.assign(t,analyze(t));
  assert.equal(t.questions.find(q=>q.id===old.id).status,'archived');
  assert.equal(t.questions.find(q=>q.id===old.id).answer,'旧的技能回答');
  const current=t.questions.find(q=>q.requirementId===r.id&&q.status==='pending');
  assert.equal(current.experienceId,p.id);assert.match(current.text,/园林分析项目/);
  assert.deepEqual(t.facts,facts);
  Object.assign(t,analyze(t));
  assert.equal(t.questions.filter(q=>q.requirementId===r.id&&q.status==='pending').length,1);
});

test('regeneration refreshes untouched pending prompts but preserves drafts, answered questions and confirmed facts',()=>{
  const t=fixture(),p=project(t),r=t.requirements[0];t.associations=[{requirementId:r.id,experienceId:p.id,manual:true,manualStatus:false}];
  Object.assign(t,analyze(t));let q=t.questions.find(q=>q.requirementId===r.id);q.text='旧版笼统提问';
  Object.assign(t,analyze(t));q=t.questions.find(x=>x.id===q.id);assert.match(q.text,/园林分析项目/);
  q.answer='正在输入的回答';q.text='用户正在回答的问题';
  Object.assign(t,analyze(t));q=t.questions.find(x=>x.id===q.id);
  assert.equal(q.text,'用户正在回答的问题');assert.equal(q.answer,'正在输入的回答');
  q.status='confirmed';q.editing=true;q.draftAnswer='新的未提交草稿';
  t.facts=[{id:'fact',questionId:q.id,experienceId:p.id,requirementId:r.id,text:'本人整理了团队讨论记录。',status:'confirmed'}];
  const before=structuredClone({q,facts:t.facts});Object.assign(t,analyze(t));
  assert.deepEqual(t.questions.find(x=>x.id===q.id),before.q);assert.deepEqual(t.facts,before.facts);
});

test('question batches cover different requirements before repeating sources for the first one',()=>{
  const t=fixture(),p=project(t),s=skill(t);
  t.requirements=Array.from({length:3},(_,i)=>({id:'fair'+i,text:'具备较强的沟通与文档表达能力',category:'工作任务与能力'}));
  t.associations=t.requirements.map(r=>({requirementId:r.id,experienceId:p.id,experienceIds:[p.id,s.id],manual:true,manualStatus:false}));
  Object.assign(t,analyze(t));const pending=t.questions.filter(q=>q.status==='pending');
  assert.equal(pending.length,3);assert.equal(new Set(pending.map(q=>q.requirementId)).size,3);
  t.requestedQuestionKey='fair0:'+s.id;Object.assign(t,analyze(t));
  assert.ok(t.questions.some(q=>q.requirementId==='fair0'&&q.experienceId===s.id&&q.status==='pending'));
  assert.equal(t.questions.filter(q=>q.status==='pending').length,3);
});
