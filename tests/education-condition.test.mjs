import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseWithAI,analyzeWithAI} from '../lib/material-pipeline.mjs';
const f=JSON.parse(readFileSync(new URL('./fixtures/ai-bc-0007-0008.json',import.meta.url)));
const call=data=>async()=>({data,meta:{}});
const corrected=()=>{const d=structuredClone(f.parse);d.requirements.find(r=>r.line===4).category='明确条件';return d;};
test('AI-BC-0007 original misclassification is rejected without changing model data',async()=>{
  const d=structuredClone(f.parse);await assert.rejects(parseWithAI(f.input,call(d)),/学历条件不能/);assert.deepEqual(d,f.parse);
});
for(const line of ['本科在读优先。','学历要求：本科及以上学历。','1. 全日制本科或硕士研究生在读优先。'])test('education attribute stays distinct from strength: '+line,async()=>{
  const input={...f.input,jd:f.input.jd.replace('本科在读优先。',line)};
  await assert.rejects(parseWithAI(input,call(f.parse)),/学历条件不能/);
  const p=await parseWithAI(input,call(corrected()));
  assert.equal(p.requirements[2].text,line);assert.equal(p.requirements[2].category,'明确条件');
  if(line.includes('优先'))assert.equal(p.requirements[2].strength,'优先／加分');
  if(line.includes('或'))assert.match(p.requirements[2].logic,/或/);
  for(const e of p.experiences)assert.equal(input.resume.slice(e.start,e.end),e.text);
});
for(const line of ['有本科课程项目经验优先。','参与本科招生数据分析。','本科在读，熟悉 SQL 数据分析。','有页面协作经验优先。'])test('education guard does not guess mixed/project content: '+line,async()=>{
  const p=await parseWithAI({...f.input,jd:f.input.jd.replace('本科在读优先。',line)},call(f.parse));
  assert.equal(p.requirements[2].text,line);assert.equal(p.requirements[2].category,'加分项');
});
test('stale wrong education classification is refused before any model call',async()=>{
  let calls=0;
  await assert.rejects(analyzeWithAI({requirements:[{text:'本科在读优先。',category:'加分项'}]},async()=>{calls++;}),/学历条件不能/);
  assert.equal(calls,0);
});
