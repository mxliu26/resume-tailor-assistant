import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyzeWithAI} from '../lib/material-pipeline.mjs';
const f=JSON.parse(readFileSync(new URL('./fixtures/ai-bc-0011.json',import.meta.url)));
const call=data=>async()=>({data,meta:{}});
test('actual AI-BC-0011 output stays rejected and cannot mutate source or confirm none',async()=>{
  const t=structuredClone(f.task),before=structuredClone(t);
  await assert.rejects(analyzeWithAI(t,call(f.response)),/不能将未提供/);assert.deepEqual(t,before);
});
test('no user none confirmation means none is absent from the actual per-call status list',async()=>{
  let payload;await assert.rejects(analyzeWithAI(f.task,async(stage,p)=>{payload=p;return call(f.response)();}),/不能将未提供/);
  assert.ok(!payload.judgmentRules.capability.statuses.includes('确认没有相关经历'));
  assert.deepEqual(payload.judgmentRules.capability.confirmedNonePairs,[]);
  assert.ok(payload.sources.some(s=>s.text.includes('没有开展用户访谈，也没有线上 A/B 测试')));
});
test('related-but-not-equivalent control preserves negative evidence; it is not a real model retest',async()=>{
  const control=structuredClone(f.response);control.associations[0].status='相关但不等价';
  const result=await analyzeWithAI(f.task,call(control));assert.equal(result.associations[0].status,'相关但不等价');
  assert.equal(result.associations[0].evidence,'没有开展用户访谈，也没有线上 A/B 测试。');
});
for(const status of ['unknown','skipped','provided','confirmed'])test(status+' never authorizes none',async()=>{
  const t=structuredClone(f.task),a=f.response.associations[0];t.questions=[{...a,id:'offline',status,answer:'未知'}];
  await assert.rejects(analyzeWithAI(t,call(f.response)),/不能将未提供/);
});
test('only exact explicitly confirmed none pair may use none, including archived state',async()=>{
  const t=structuredClone(f.task),a=f.response.associations[0];t.questions=[{id:'q',requirementId:a.requirementId,experienceId:a.experienceId,status:'none',answer:'明确未做过'}];
  for(const archived of [false,true]){
    if(archived){t.questions[0].status='archived';t.questions[0].previousStatus='none';}
    let sent;const result=await analyzeWithAI(t,async(stage,p)=>{sent=p;return call(f.response)();});
    assert.equal(result.associations[0].status,'确认没有相关经历');assert.equal(sent.judgmentRules.capability.confirmedNonePairs.length,1);
  }
  t.questions[0].requirementId='other';await assert.rejects(analyzeWithAI(t,call(f.response)),/不能将未提供/);
});
