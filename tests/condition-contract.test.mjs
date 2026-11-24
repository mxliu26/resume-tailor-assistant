import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseWithAI,analyzeWithAI} from '../lib/material-pipeline.mjs';

// Exact fictional model data from AI-SESSION-20261121121207313-aa2267, no live calls.
const fixture=JSON.parse(readFileSync(new URL('./fixtures/ai-bc-0006.json',import.meta.url)));
const call=data=>async()=>({data,meta:{}});
const parsed=await parseWithAI(fixture.input,call(fixture.parse));
const task=()=>({...structuredClone(parsed),facts:[],questions:[],associations:[]});
const corrected=()=>{const d=structuredClone(fixture.analyze);d.associations[0].status='按已提供信息符合';d.associations[0].experienceId='';return d;};

test('AI-BC-0006 unchanged recorded response still rejected, never silently normalized',async()=>{
  const d=structuredClone(fixture.analyze);
  await assert.rejects(analyzeWithAI(task(),call(d)),/明确条件必须使用条件核对状态/);
  assert.deepEqual(d,fixture.analyze);
});
test('AI-BC-0006 condition cannot bind a rewrite experience even with correct status',async()=>{
  const d=corrected();d.associations[0].experienceId=fixture.analyze.associations[0].experienceId;
  await assert.rejects(analyzeWithAI(task(),call(d)),/明确条件不能强制关联/);
});
test('condition may cite education without binding rewrite; capability stays independently linked',async()=>{
  let sent;const result=await analyzeWithAI(task(),async(stage,p)=>{sent=p;return call(corrected())();});
  assert.equal(sent.requirements[0].judgmentType,'condition');
  assert.equal(sent.requirements[1].judgmentType,'capability');
  assert.deepEqual(sent.judgmentRules.condition.statuses,['按已提供信息符合','存在明确差异','待确认']);
  assert.equal(result.associations[0].experienceId,'');
  assert.match(result.associations[0].evidence,/本科在读/);
  assert.equal(result.associations[0].needsClarification,false);
  assert.equal(result.associations[1].status,'已有明确证据');
  assert.ok(result.associations[1].experienceId);
});
for(const status of ['表达不足','相关但不等价','尚未确认','确认没有相关经历'])test('condition rejects capability enum '+status,async()=>{
  const d=corrected();d.associations[0].status=status;
  await assert.rejects(analyzeWithAI(task(),call(d)),/条件核对状态/);
});
for(const status of ['按已提供信息符合','存在明确差异','待确认'])test('capability rejects condition enum '+status,async()=>{
  const d=corrected();d.associations[1].status=status;
  await assert.rejects(analyzeWithAI(task(),call(d)),/能力证据状态/);
});
test('unknown condition retains pending status without fabricated evidence or followup',async()=>{
  const d=corrected();d.associations[0].status='待确认';d.associations[0].evidence=[];
  const result=await analyzeWithAI(task(),call(d));
  assert.equal(result.associations[0].status,'待确认');assert.equal(result.associations[0].needsClarification,false);
  d.questions=[{requirementId:d.associations[0].requirementId,experienceId:'',text:'补充经历？',purpose:'改写'}];
  await assert.rejects(analyzeWithAI(task(),call(d)),/补问没有绑定有效缺口/);
});
test('both definite condition verdicts require actual exact source evidence',async()=>{
  for(const status of ['按已提供信息符合','存在明确差异']){
    const d=corrected();d.associations[0].status=status;d.associations[0].evidence=[];
    await assert.rejects(analyzeWithAI(task(),call(d)),/缺少原文证据/);
    d.associations[0].evidence=[{sourceId:parsed.experiences[1].id,quote:'硕士毕业'}];
    await assert.rejects(analyzeWithAI(task(),call(d)),/证据不在/);
  }
});
