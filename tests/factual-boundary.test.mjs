import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseWithAI,analyzeWithAI} from '../lib/material-pipeline.mjs';
import {generateLive} from '../server.mjs';
import {factualSourceText} from '../lib/factual-sources.mjs';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/factual-boundary.json',import.meta.url)));
const segmentation={units:[{startLine:1,endLine:1,kind:'context'},{startLine:2,endLine:3,kind:'context'},{startLine:4,endLine:7,kind:'experience'},{startLine:8,endLine:11,kind:'experience'}],requirements:[{line:2,category:'工作任务与能力'},{line:3,category:'工作任务与能力'},{line:4,category:'加分项'}],ignoredJdLines:[1]};
const parsed=await parseWithAI(fixture.输入,async()=>({data:segmentation,meta:{}}));
const task=()=>({id:'boundary-offline',revision:1,...structuredClone(parsed),selected:parsed.experiences.filter(e=>e.kind==='experience').map(e=>e.id),facts:[],questions:[],associations:[]});
const answer=(t,id,text)=>({suggestions:t.experiences.filter(e=>t.selected.includes(e.id)).map(e=>({experienceId:e.id,text:e.id===id?text:e.text,reason:'离线构造的边界检查，非真实模型输出',sourceIds:[e.id]}))});

test('explicitly marked non-factual instruction cannot authorize invented revenue or ownership',async()=>{
  const t=task(),e=t.experiences[3];t.selected=[e.id];
  await assert.rejects(generateLive(t,async()=>({data:answer(t,e.id,'本人主导项目并将营收提升30%。'),meta:{}})),/无来源|职责或成果/);
});
test('team metrics cannot silently become individual achievements',async()=>{
  const t=task(),e=t.experiences[2];t.selected=[e.id];
  await assert.rejects(generateLive(t,async()=>({data:answer(t,e.id,'我使用 Python 处理100条公开样本，将实验准确率由70%提高到75%。'),meta:{}})),/团队|归属/);
});
test('valid team attribution and original negative facts remain accepted without mutating originals',async()=>{
  const t=task(),before=structuredClone(t);
  const data={suggestions:t.experiences.filter(e=>t.selected.includes(e.id)).map(e=>({experienceId:e.id,text:factualSourceText(e.text),reason:'保留事实和归属',sourceIds:[e.id]}))};
  const result=await generateLive(t,async()=>({data,meta:{}}));
  assert.equal(result.suggestions.length,2);assert.deepEqual(t,before);
  assert.match(result.suggestions[0].text,/团队实验准确率由70%提高到75%/);
  assert.match(result.suggestions[1].text,/原型尚未上线/);
  assert.match(t.experiences[3].text,/非事实/);
});
test('non-factual instruction is absent from both model source sets and cannot be quoted as evidence',async()=>{
  const t=task(),e=t.experiences[3];let payload;
  const d={associations:t.requirements.map(r=>({requirementId:r.id,experienceId:e.id,status:'已有明确证据',reason:'构造错误证据',evidence:[{sourceId:e.id,quote:'本人主导项目并将营收提升30%'}]})),questions:[]};
  await assert.rejects(analyzeWithAI(t,async(stage,p)=>{payload=p;return {data:d,meta:{}};}),/证据不在/);
  assert.ok(!JSON.stringify(payload.sources).includes('营收提升30%'));
  await generateLive(t,async(stage,p)=>{assert.ok(!JSON.stringify(p).includes('营收提升30%'));return {data:{suggestions:p.experiences.map(x=>({experienceId:x.id,text:x.sources[0].text,reason:'原文保留',sourceIds:[x.id]}))},meta:{}};});
});
test('unmarked legitimate facts and percentages without team attribution are retained',()=>{
  assert.equal(factualSourceText('项目说明：没有额外指令。\n本人独立完成30%的检查。'),'项目说明：没有额外指令。\n本人独立完成30%的检查。');
});
for(const [name,text,index] of [
  ['literature is not interviews','我开展用户访谈，使用 Python 处理100条公开样本。',2],
  ['offline is not online A/B','使用 Python 开展线上 A/B 测试。',2],
  ['prototype remains unlaunched','活动登记页面已上线。',3],
  ['project facts remain separate','使用 Python 处理100条公开样本。',3]
])test(name,async()=>{
  const t=task(),e=t.experiences[index];t.selected=[e.id];
  await assert.rejects(generateLive(t,async()=>({data:answer(t,e.id,text),meta:{}})),/无来源|职责或成果/);
});
