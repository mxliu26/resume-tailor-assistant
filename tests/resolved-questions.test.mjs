import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseWithAI,analyzeWithAI} from '../lib/material-pipeline.mjs';
import {analyze} from '../public/domain.js';
import {analysisKey} from '../public/ai-state.js';
const f=JSON.parse(readFileSync(new URL('./fixtures/ai-bc-0007-0008.json',import.meta.url)));
const call=data=>async()=>({data,meta:{}});
const p=structuredClone(f.parse);p.requirements=p.requirements.filter(r=>r.line!==4);p.ignoredJdLines=[];
// Isolate the two capability requirements; the original repeated question is untouched.
const input={...f.input,jd:f.input.jd.split('\n').slice(1,3).join('\n')};
p.requirements=p.requirements.map(r=>({...r,line:r.line-1}));
const parsed=await parseWithAI(input,call(p));
const result=()=>({...structuredClone(f.analyzeAfterConfirmation),associations:structuredClone(f.analyzeAfterConfirmation.associations).slice(0,2)});
const task=()=>({id:'offline',revision:2,...structuredClone(parsed),facts:structuredClone(f.facts),questions:structuredClone(f.questions),associations:[],selected:[]});
test('AI-BC-0008 recorded repeated question is rejected, user answer and response remain untouched',async()=>{
  const t=task(),before=structuredClone(t),d=result(),original=structuredClone(d);
  await assert.rejects(analyzeWithAI(t,call(d)),/重复提出已回答或已跳过/);
  assert.deepEqual(t,before);assert.deepEqual(d,original);
});
for(const status of ['provided','confirmed','none','unknown','skipped'])test('answered status blocks same question: '+status,async()=>{
  const t=task();t.questions[0].status=status;let sent;
  await assert.rejects(analyzeWithAI(t,async(stage,payload)=>{sent=payload;return call(result())();}),/重复提出已回答或已跳过/);
  assert.equal(sent.resolvedQuestions[0].status,status);assert.equal(sent.resolvedQuestions[0].canAsk,false);
});
test('archived answered question stays excluded but archived pending does not',async()=>{
  const t=task();t.questions[0].status='archived';t.questions[0].previousStatus='confirmed';
  await assert.rejects(analyzeWithAI(t,call(result())),/重复提出已回答或已跳过/);
  t.questions[0].previousStatus='pending';assert.equal((await analyzeWithAI(t,call(result()))).questions.length,1);
});
test('same wording for a different requirement is not blocked by an unrelated answered pair',async()=>{
  const t=task();t.questions[0].requirementId='another-requirement';
  assert.equal((await analyzeWithAI(t,call(result()))).questions.length,1);
});
test('valid no-question result can retain insufficient evidence and preserve confirmed answer',async()=>{
  const t=task(),d=result();d.questions=[];const data=await analyzeWithAI(t,call(d));
  t.aiAnalysis={...data,key:analysisKey(t)};const state=analyze(t);
  assert.equal(data.associations[0].status,'表达不足');
  assert.equal(state.questions.find(q=>q.id===f.questions[0].id).status,'confirmed');
  assert.equal(state.questions.find(q=>q.id===f.questions[0].id).answer,f.questions[0].answer);
});
test('answered but unconfirmed text stays out of sources and cannot be quoted',async()=>{
  const t=task();t.facts[0].status='pending';t.questions[0].status='provided';const d=result();d.questions=[];let sent;
  await assert.rejects(analyzeWithAI(t,async(stage,payload)=>{sent=payload;return call(d)();}),/证据不在/);
  assert.ok(!sent.sources.some(s=>s.id===t.facts[0].id));
});
