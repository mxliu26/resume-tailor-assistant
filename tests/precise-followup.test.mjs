import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {analyzeWithAI} from '../lib/material-pipeline.mjs';
import {prompts} from '../lib/model-client.mjs';
import {analyze} from '../public/domain.js';
import {analysisKey,hasCurrentAnalysis} from '../public/ai-state.js';
import {replaceAnswer,beginAnswerEdit,cancelAnswerEdit} from '../public/followup-state.js';
import {renderComparison} from '../public/comparison-view.js';
const fixtures=JSON.parse(fs.readFileSync(new URL('./fixtures/precise-followup-v18.json',import.meta.url))).fixtures;
test('actual v18 duplicate coverage remains rejected, without filtering or rewriting model output',async()=>{
  const f=JSON.parse(fs.readFileSync(new URL('./fixtures/precise-followup-v18-duplicate.json',import.meta.url)));const before=structuredClone(f);
  await assert.rejects(analyzeWithAI(f.task,async()=>({data:f.data,meta:{}})),/补问没有绑定有效缺口或重复提问/);
  assert.deepEqual(f,before);
});
for(const fixture of JSON.parse(fs.readFileSync(new URL('./fixtures/precise-followup-v20-rejections.json',import.meta.url))))test('v20 '+fixture.caseId+' rejection remains strict; generation receives existing gates',async()=>{
  const f=structuredClone(fixture);let sent;
  await assert.rejects(analyzeWithAI(f.task,async(_,p)=>{sent=p;return {data:f.data,meta:{}};}),/明确条件不能强制关联|补问没有绑定/);
  assert.deepEqual(sent.questionRules.conditionRequirementIds,f.task.requirements.filter(r=>r.category==='明确条件').map(r=>r.id));
  assert.deepEqual(sent.questionRules.blockedExperienceIds,[...new Set(f.task.facts.filter(f=>f.status==='conflict').map(f=>f.experienceId))]);
  assert.deepEqual(f,fixture);
});
const reply=data=>async()=>({data,meta:{offline:true}});
function fixture(){
  const f=structuredClone(fixtures[0]),q=f.data.questions[0],second=f.data.questions[1];
  f.data.questions=[{...q,text:'请说明本人定位异常的方法、交付清单及条目/件数口径。',relatedRequirementIds:[second.requirementId]}];
  return f;
}
async function state(){const f=fixture(),result=await analyzeWithAI(f.task,reply(f.data));f.task.aiAnalysis={...result,key:analysisKey(f.task)};Object.assign(f.task,analyze(f.task));return {t:f.task,data:f.data};}
test('active v21 prompt retains the current source, state and question-scope contract',()=>{
  assert.equal(prompts.version,'precise-followup-v21');for(const boundary of ['allowedEvidenceSourceIds','confirmedNonePairs','condition_only','relatedRequirementIds','unresolvedConflicts','confirmedSourceIds','inProgressQuestions'])assert.ok(prompts.analyze.includes(boundary));
  assert.doesNotMatch(prompts.analyze,/AE-CASE|SYN-QC|物料编码|月度汇总表/);
});
test('recorded v14 questions still validate; merged same-experience gaps create one question and one answer',async()=>{
  const raw=structuredClone(fixtures[0]);assert.equal((await analyzeWithAI(raw.task,reply(raw.data))).questions.length,2);
  const {t}=await state();assert.equal(t.questions.filter(q=>q.status==='pending').length,1);
  const q=t.questions[0];assert.equal(q.relatedRequirementIds.length,1);
  replaceAnswer(t,q.id,{text:'本人交付按条目列出的清单。'});
  assert.equal(q.status,'provided');assert.equal(t.facts.length,0,'answer never auto-confirms');
  t.aiAnalysis.key=analysisKey(t);Object.assign(t,analyze(t));assert.equal(t.questions.filter(q=>q.status==='pending').length,0);
});
for(const status of ['provided','confirmed','none','unknown','skipped'])test('merged '+status+' blocks either covered pair; only confirmed facts enter sources',async()=>{
  const {t,data}=await state(),q=t.questions[0];q.status=status;q.answer='未确认的肯定答案不能当来源';
  t.facts=[{id:'f',questionId:q.id,experienceId:q.experienceId,text:'本人核对重复编码后交付清单。',status:status==='confirmed'?'confirmed':'pending'}];
  let sent;const d=structuredClone(data);d.questions=[{...d.questions[0],requirementId:q.relatedRequirementIds[0],relatedRequirementIds:[]}];
  await assert.rejects(analyzeWithAI(t,async(_,p)=>{sent=p;return reply(d)();}),/重复提出已回答或已跳过/);
  assert.equal(sent.resolvedQuestions.length,2);assert.ok(sent.resolvedQuestions.every(r=>r.questionText===q.text));
  assert.equal(sent.sources.some(s=>s.id==='f'),status==='confirmed');
  if(status==='provided')assert.ok(!JSON.stringify(sent).includes(q.answer));
  if(status==='none')assert.equal(sent.judgmentRules.capability.confirmedNonePairs.length,1,'no expanded negative authorization');
});
test('secondary covered requirement cannot be labeled none just because merged answer is none',async()=>{
  const {t,data}=await state(),q=t.questions[0];q.status='none';q.answer='没有做过交接。';data.questions=[];
  data.associations.find(a=>a.requirementId===q.relatedRequirementIds[0]).status='确认没有相关经历';
  await assert.rejects(analyzeWithAI(t,reply(data)),/不能将未提供的信息判断为没有经历/);
});
for(const mutation of ['condition','other-experience','resolved','duplicate','conflict','invalid-id'])test('reject invalid merge: '+mutation,async()=>{
  const f=fixture(),q=f.data.questions[0],other=q.relatedRequirementIds[0];
  if(mutation==='condition')q.relatedRequirementIds=[f.task.requirements.find(r=>r.category==='明确条件').id];
  if(mutation==='other-experience'){const a=f.data.associations.find(a=>a.requirementId===other);a.experienceId=f.task.experiences.find(e=>e.id!==q.experienceId&&e.kind==='context').id;a.evidence=[];}
  if(mutation==='resolved')f.task.questions=[{requirementId:other,experienceId:q.experienceId,status:'unknown'}];
  if(mutation==='duplicate')f.data.questions.push({...q,requirementId:other,relatedRequirementIds:[]});
  if(mutation==='conflict')f.task.facts.push({id:'c',experienceId:q.experienceId,text:'两种口径互相冲突。',status:'conflict'});
  if(mutation==='invalid-id')q.relatedRequirementIds=['missing'];
  const before=structuredClone(f.task);await assert.rejects(analyzeWithAI(f.task,reply(f.data)));assert.deepEqual(f.task,before);
});
test('different necessary gaps remain separate; no unconditional one-question-per-experience cap',async()=>{
  const f=structuredClone(fixtures[1]);assert.equal((await analyzeWithAI(f.task,reply(f.data))).questions.length,2);
});
test('a new merge must not hide or move another pending answer draft',async()=>{
  const f=fixture(),q=f.data.questions[0];
  f.task.questions=[{id:'draft',requirementId:q.relatedRequirementIds[0],experienceId:q.experienceId,status:'pending',draftAnswer:'私人未提交内容',editing:true,text:'旧的清单问题'}];
  let sent;await assert.rejects(analyzeWithAI(f.task,async(_,p)=>{sent=p;return reply(f.data)();}),/正在回答/);
  assert.ok(!JSON.stringify(sent).includes('私人未提交内容'));
});
test('archived answers protect both covered gaps; question scope and boundary changes invalidate cached analysis',async()=>{
  const {t,data}=await state(),q=t.questions[0];q.status='archived';q.previousStatus='skipped';t.aiAnalysis.key=analysisKey(t);
  assert.ok(hasCurrentAnalysis(t));q.answer='本次不补充方法';assert.ok(!hasCurrentAnalysis(t));
  await assert.rejects(analyzeWithAI(t,reply(data)),/重复提出/);
  t.aiAnalysis.key=analysisKey(t);q.relatedRequirementIds=[];assert.ok(!hasCurrentAnalysis(t));
});
test('answer edits keep grouped scope and previous facts on cancel; replacing retires old facts only',async()=>{
  const {t}=await state(),q=t.questions[0],scope=structuredClone(q.relatedRequirementIds);q.status='confirmed';q.answer='旧答案';
  t.facts=[{id:'f',questionId:q.id,experienceId:q.experienceId,text:'旧事实',status:'confirmed'}];
  beginAnswerEdit(t,q.id);cancelAnswerEdit(t,q.id);assert.equal(t.facts[0].status,'confirmed');
  replaceAnswer(t,q.id,{text:'新的待确认信息'});assert.equal(q.status,'provided');assert.equal(t.facts.length,0);assert.deepEqual(q.relatedRequirementIds,scope);
});
test('draft text and merge scope are not rewritten under an in-progress answer',async()=>{
  const {t}=await state(),q=t.questions[0],before=structuredClone(q);q.draftAnswer='尚未提交';q.editing=true;
  t.aiAnalysis.questions[0].text='新的问题';t.aiAnalysis.questions[0].relatedRequirementIds=[];
  Object.assign(t,analyze(t));assert.equal(t.questions[0].text,before.text);assert.deepEqual(t.questions[0].relatedRequirementIds,before.relatedRequirementIds);
});
test('one rendered answer form and a shared link replace duplicate question cards',async()=>{
  const {t}=await state();const esc=x=>String(x??'').replaceAll('<','&lt;');const html=renderComparison(t,{esc,btn:(text,action,cls,extra)=>`<button data-action="${action}" ${extra||''}>${text}</button>`,badge:t=>t},{mode:'live'});
  assert.equal((html.match(/data-answer=/g)||[]).length,1);assert.match(html,/查看合并补问/);assert.match(html,/提问用途/);assert.match(html,/仅确认你明确提供的事实/);
});
