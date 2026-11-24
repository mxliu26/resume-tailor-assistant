import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {jobFocusFor} from '../public/job-focus.js';
import {getRewritePlan} from '../public/analysis-model.js';
import {analysisKey} from '../public/ai-state.js';
import {generateLive} from '../server.mjs';

const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const fixtures=read('./fixtures/job-targeting-v9.json').fixtures;
const f=n=>structuredClone(fixtures[n]);
const reply=data=>async()=>({data,meta:{offline:true}});

test('historical evidence reproduces equal bodies across 0003/0004 (not a v9 result)',()=>{
  assert.deepEqual(fixtures[0].response.suggestions.map(s=>s.text),fixtures[1].response.suggestions.map(s=>s.text));
  assert.notDeepEqual(fixtures[0].task.requirements.map(r=>r.text),fixtures[1].task.requirements.map(r=>r.text));
  for(const x of fixtures)assert.ok(x.evidence.task.sha256&&x.evidence.response.sha256);
});
test('rewrite sends checked JD-specific links, unchanged own sources, and accepts original when suitable',async()=>{
  const sent=[];
  for(const x of fixtures){
    const before=structuredClone(x.task);
    const out=await generateLive(x.task,async(stage,payload)=>{assert.equal(stage,'rewrite');sent.push(payload);return reply(x.response)();});
    assert.deepEqual(out.suggestions.map(s=>s.text),x.response.suggestions.map(s=>s.text));
    assert.deepEqual(x.task,before);
    for(const e of sent.at(-1).experiences){
      assert.deepEqual(e.sources.map(s=>s.id),[e.id]);
      assert.equal(e.sources[0].text,x.task.experiences.find(v=>v.id===e.id).text);
      for(const link of e.focus)assert.ok(e.sources.some(s=>s.text.includes(link.evidence)));
    }
  }
  assert.notDeepEqual(sent[0].experiences[0].focus.map(f=>f.text),sent[1].experiences[0].focus.map(f=>f.text));
  assert.match(sent[0].experiences[0].focus[0].evidence,/社群重复咨询/);
  assert.match(sent[1].experiences[0].focus[0].evidence,/表单流程草图/);
});
test('focus excludes unknown, none, conditions, conflicts, foreign and unconfirmed quotes',()=>{
  const original=f(1),id=original.task.selected[0];
  assert.ok(jobFocusFor(original.task,id).length);
  for(const status of ['尚未确认','确认没有相关经历']){
    const x=f(1);for(const a of x.task.associations)for(const l of a.links)l.status=status;
    assert.equal(jobFocusFor(x.task,id).length,0);
  }
  for(const change of [
    t=>t.requirements.forEach(r=>r.category='明确条件'),
    t=>t.facts.push({id:'conflict',experienceId:id,status:'conflict',text:'尚未核实'}),
    t=>t.associations.forEach(a=>a.links.forEach(l=>l.conflict=true)),
    t=>t.associations.forEach(a=>a.links.forEach(l=>l.evidence=t.experiences.find(e=>e.id===t.selected[1]).text)),
    t=>{t.facts.push({id:'draft',experienceId:id,status:'pending',text:'未经确认的职责'});t.associations.forEach(a=>a.links.forEach(l=>l.evidence='未经确认的职责'));},
    t=>t.experiences.find(e=>e.id===id).excluded=true,
  ]){const x=f(1);change(x.task);x.task.aiAnalysis.key=analysisKey(x.task);assert.equal(jobFocusFor(x.task,id).length,0);}
});
test('stale AI links cannot steer rewrite; confirmed own evidence can',()=>{
  const x=f(1),id=x.task.selected[0];x.task.requirements[0].text+='（已修改）';
  assert.equal(jobFocusFor(x.task,id).length,0);
  x.task.facts.push({id:'f-confirmed',experienceId:id,status:'confirmed',text:'本人逐项核对表单字段。'});
  x.task.associations[0].links[0].evidence='本人逐项核对表单字段。';x.task.aiAnalysis.key=analysisKey(x.task);
  assert.equal(jobFocusFor(x.task,id)[0].evidence,'本人逐项核对表单字段。');
});
test('same-priority guidance changes with supported JD links, retains all units and user selection',()=>{
  const task={experiences:[{id:'a',kind:'experience',title:'调研',text:'整理公开评论。'},{id:'b',kind:'experience',title:'原型',text:'绘制交互草图。'}],facts:[],questions:[],selected:['a','b'],requirements:[{id:'r',text:'绘制原型',category:'工作任务与能力'}],associations:[{requirementId:'r',experienceId:'b',status:'已有明确证据',evidence:'绘制交互草图。',origin:'user'}]};
  const before=structuredClone(task);
  assert.deepEqual(getRewritePlan(task).map(p=>p.experienceId),['b','a']);assert.deepEqual(task,before);
  task.requirements[0].text='整理评论';Object.assign(task.associations[0],{experienceId:'a',evidence:'整理公开评论。'});
  assert.deepEqual(getRewritePlan(task).map(p=>p.experienceId),['a','b']);
  task.associations[0].evidence='并未出现的事实';assert.deepEqual(getRewritePlan(task).map(p=>p.experienceId),['a','b']);
});
test('JD focus cannot authorize foreign sources, invented tools, numbers or role inflation',async()=>{
  const x=f(1),first=x.response.suggestions[0];
  for(const added of [' 使用Axure完成原型。',' 报名率提升99%。',' 主导开发并上线发布提醒功能。']){
    const data=structuredClone(x.response);data.suggestions[0].text+=added;
    await assert.rejects(generateLive(x.task,reply(data)),/无来源|职责或成果|数字|工具/);
  }
  const data=structuredClone(x.response);data.suggestions[0].sourceIds.push(x.task.selected[1]);
  await assert.rejects(generateLive(x.task,reply(data)),/属于其他经历/);
  assert.equal(first.text,x.response.suggestions[0].text);
});
