import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseWithAI} from '../lib/material-pipeline.mjs';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/parse-identity.json',import.meta.url)));
// Exact units/requirements from AI-RUN-20261121115402645-6c865d-01; no provider request.
const recorded=()=>({units:[{startLine:2,endLine:3,kind:'context'},{startLine:4,endLine:7,kind:'experience'},{startLine:8,endLine:9,kind:'context'}],requirements:[{line:2,category:'明确条件'},{line:3,category:'工作任务与能力'},{line:4,category:'工作任务与能力'}],ignoredJdLines:[1]});
const call=data=>async()=>({data,meta:{offline:true}});
const exact=(resume,parsed)=>{
  for(const e of parsed.experiences)assert.equal(resume.slice(e.start,e.end),e.text);
  assert.equal(parsed.experiences.map(e=>e.text).join('\n'),resume);
};

test('AI-BC-0005 saved response restores only the identity row from exact local source',async()=>{
  const data=recorded(),before=JSON.stringify(data);let sent;
  const parsed=await parseWithAI(fixture.输入,async(stage,payload)=>{sent=payload;return call(data)();});
  exact(fixture.输入.resume,parsed);assert.deepEqual(parsed.meta.restoredContextLines,[1]);
  assert.equal(parsed.experiences[0].kind,'context');assert.equal(parsed.experiences[0].text,'姓名：虚构甲');
  assert.equal(sent.resumeLines[0].text,'[身份行已移除]');assert.ok(!JSON.stringify(sent).includes('虚构甲'));
  assert.equal(JSON.stringify(data),before);assert.match(parsed.requirements[1].logic,/或/);
  assert.match(parsed.experiences[2].text,/1200条/);assert.match(parsed.experiences[2].text,/3条/);assert.match(parsed.experiences[2].text,/尚未上线/);
});
test('AI-BC-0005 model-covered identity is not duplicated or rewritten',async()=>{
  const data=recorded();data.units.unshift({startLine:1,endLine:1,kind:'context'});
  const parsed=await parseWithAI(fixture.输入,call(data));exact(fixture.输入.resume,parsed);
  assert.equal(parsed.experiences.length,4);assert.deepEqual(parsed.meta.restoredContextLines,[]);
});
test('AI-BC-0005 literal identity placeholder in original is retained unchanged',async()=>{
  const input={...fixture.输入,resume:fixture.输入.resume.replace('姓名：虚构甲','[身份行已移除]')};
  const parsed=await parseWithAI(input,call(recorded()));exact(input.resume,parsed);
  assert.equal(parsed.experiences[0].text,'[身份行已移除]');
});
test('AI-BC-0005 identity and contact rows retain local CRLF offsets without exposing values',async()=>{
  const input={resume:'姓名：虚构丁\r\n电话：13800000000\r\n邮箱：fictional@example.invalid\r\n课程项目\r\n协助整理12条记录，尚未上线。',jd:fixture.输入.jd};
  const data=recorded();data.units=[{startLine:4,endLine:5,kind:'experience'}];let sent;
  const parsed=await parseWithAI(input,async(stage,payload)=>{sent=JSON.stringify(payload);return call(data)();});
  assert.deepEqual(parsed.meta.restoredContextLines,[1,2,3]);
  for(const e of parsed.experiences)assert.equal(input.resume.slice(e.start,e.end),e.text);
  for(const value of ['虚构丁','13800000000','fictional@example.invalid'])assert.ok(!sent.includes(value));
});
for(const [name,mutate] of [
  ['education',d=>d.units[0].endLine=2],
  ['project facts',d=>d.units[1].endLine=6],
  ['skills',d=>d.units[2].endLine=8]
])test('AI-BC-0005 still rejects missing '+name,async()=>{
  const data=recorded();mutate(data);
  await assert.rejects(parseWithAI(fixture.输入,call(data)),/部分原文未被保留/);
});
test('AI-BC-0005 mixed identity and factual text cannot be restored as identity-only',async()=>{
  const input={...fixture.输入,resume:fixture.输入.resume.replace('姓名：虚构甲','姓名：虚构甲，课程原型尚未上线。')};
  await assert.rejects(parseWithAI(input,call(recorded())),/部分原文未被保留/);
});
test('AI-BC-0005 short factual first row is still required, not treated as identity',async()=>{
  const input={...fixture.输入,resume:fixture.输入.resume.replace('姓名：虚构甲','本科在读')};
  await assert.rejects(parseWithAI(input,call(recorded())),/部分原文未被保留/);
});
