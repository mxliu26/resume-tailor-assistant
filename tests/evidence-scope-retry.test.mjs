import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeWithAI,parseWithAI} from '../lib/material-pipeline.mjs';
import {ApiError} from '../lib/model-client.mjs';

const task=()=>({revision:1,experiences:[
  {id:'orders',title:'订单分析',kind:'experience',text:'整理订单表与分类图表。'},
  {id:'skills',title:'技能与优势',kind:'context',text:'熟悉Excel函数与数据透视表。'}
],requirements:[{id:'analysis',text:'使用Excel或SQL整理分析结果。',category:'工作任务与能力'}],
  selected:['orders'],facts:[{id:'unconfirmed',experienceId:'orders',status:'pending',text:'未确认的新工具。'}],questions:[],associations:[]});
const valid=()=>({associations:[{requirementId:'analysis',experienceId:'orders',status:'相关但不等价',reason:'有整理行为，具体工具尚未说明。',evidence:[{sourceId:'orders',quote:'整理订单表与分类图表。'}]}],questions:[]});
const crossed=()=>{const d=valid();d.associations[0].evidence=[{sourceId:'skills',quote:'熟悉Excel函数与数据透视表。'}];return d;};
const meta=n=>({stage:'analyze',durationMs:n,promptVersion:'test',inputSHA256:'input-'+n,outputSHA256:'output-'+n,usage:{prompt_tokens:10*n,completion_tokens:n,total_tokens:11*n,prompt_cache_hit_tokens:0,prompt_cache_miss_tokens:10*n}});

test('cross-owner retry supplies legal scope only, preserves task and both attempt metadata',async()=>{
  const t=task(),before=structuredClone(t),bad=crossed(),badBefore=structuredClone(bad),payloads=[];
  const result=await analyzeWithAI(t,async(stage,p)=>{payloads.push(p);return {data:payloads.length===1?bad:valid(),meta:meta(payloads.length)};});
  assert.equal(payloads.length,2);assert.deepEqual(t,before);assert.deepEqual(bad,badBefore);
  const {evidenceScopeCorrection,...same}=payloads[1];assert.deepEqual(same,payloads[0]);
  assert.deepEqual(evidenceScopeCorrection.scopes,[{requirementId:'analysis',experienceId:'orders',allowedEvidenceSourceIds:['orders']}]);
  assert.ok(!JSON.stringify(evidenceScopeCorrection).includes('skills'));
  assert.ok(!JSON.stringify(payloads).includes('未确认的新工具'));
  assert.equal(result.associations[0].evidence,'整理订单表与分类图表。');
  assert.equal(result.meta.attempts[0].outcome,'rejected');assert.equal(result.meta.attempts[1].outcome,'validated');
  assert.equal(result.meta.usage.total_tokens,33);assert.equal(result.meta.durationMs,3);
});
test('all wrong ownership scopes are reported, without rewriting either model source ID',async()=>{
  const t=task();t.requirements.push({id:'other',text:'整理分类图表',category:'工作任务与能力'});
  const bad=crossed();bad.associations.push({...structuredClone(bad.associations[0]),requirementId:'other'});
  let calls=0;await assert.rejects(analyzeWithAI(t,async(s,p)=>{
    calls++;if(calls===2)assert.equal(p.evidenceScopeCorrection.scopes.length,2);
    return {data:structuredClone(bad),meta:meta(calls)};
  }),/证据不在/);assert.equal(calls,2);
});
test('valid association makes exactly one call',async()=>{
  let n=0;await analyzeWithAI(task(),async()=>{n++;return {data:valid(),meta:meta(n)};});assert.equal(n,1);
});
for(const [name,change] of [
  ['invented quote',d=>d.associations[0].evidence[0].quote='本人主导SQL分析。'],
  ['unconfirmed source',d=>d.associations[0].evidence=[{sourceId:'unconfirmed',quote:'未确认的新工具。'}]],
  ['unknown ID',d=>d.associations[0].evidence[0].sourceId='invented'],
  ['invalid status',d=>d.associations[0].status='按已提供信息符合'],
  ['unbound question',d=>d.questions=[{requirementId:'analysis',experienceId:'skills',text:'请补充工作？',purpose:'职责'}]]
])test(name+' is still rejected without automatic retry',async()=>{
  let n=0;const d=valid();change(d);await assert.rejects(analyzeWithAI(task(),async()=>{n++;return {data:d,meta:meta(n)};}),/校验失败/);assert.equal(n,1);
});
for(const [name,mutate] of [
  ['cross owner again',()=>crossed()],
  ['invented quote after correction',()=>{const d=valid();d.associations[0].evidence[0].quote='没有来源的行为。';return d;}],
  ['invalid condition status after correction',()=>{const d=valid();d.associations[0].status='按已提供信息符合';return d;}],
  ['invalid question after correction',()=>{const d=valid();d.questions=[{requirementId:'analysis',experienceId:'orders',text:'用过什么工具？',purpose:'工具'}];return d;}]
])test(name+' runs full validation and stops at two calls',async()=>{
  let n=0;await assert.rejects(analyzeWithAI(task(),async()=>({data:++n===1?crossed():mutate(),meta:meta(n)})),/校验失败/);assert.equal(n,2);
});
test('resolved skipped question remains blocked after correction',async()=>{
  const t=task();t.questions=[{id:'q',requirementId:'analysis',experienceId:'orders',text:'用什么方法？',status:'skipped',answer:''}];
  let n=0;await assert.rejects(analyzeWithAI(t,async(s,p)=>{
    n++;assert.equal(p.resolvedQuestions[0].status,'skipped');assert.equal(p.resolvedQuestions[0].canAsk,false);
    const d=n===1?crossed():valid();if(n===2){d.associations[0].status='表达不足';d.questions=[{requirementId:'analysis',experienceId:'orders',text:'用什么方法？',purpose:'方法'}];}
    return {data:d,meta:meta(n)};
  }),/重复提出/);assert.equal(n,2);assert.equal(t.questions[0].status,'skipped');
});
test('confirmed facts are in the legal scope; pending and other-unit facts never join it',async()=>{
  const t=task();t.facts.push({id:'confirmed',experienceId:'orders',text:'按日期整理。',status:'confirmed'});
  let n=0;await analyzeWithAI(t,async(s,p)=>{n++;if(n===2)assert.deepEqual(p.evidenceScopeCorrection.scopes[0].allowedEvidenceSourceIds,['orders','confirmed']);return {data:n===1?crossed():valid(),meta:meta(n)};});
});
test('provider and budget failures never start a retry loop',async()=>{
  for(const beforeCorrection of [true,false]){
    let n=0;await assert.rejects(analyzeWithAI(task(),async()=>{n++;if(beforeCorrection||n===2)throw new ApiError(429,'预算停止');return {data:crossed(),meta:meta(n)};}),/预算停止/);
    assert.equal(n,beforeCorrection?1:2);
  }
});

const parsing=line=>({resume:'姓名：虚构甲\n课程项目\n参与整理表格。',jd:line+'\n工作内容\n支持数据核对工作。'});
const parsed=()=>({units:[{startLine:1,endLine:1,kind:'context'},{startLine:2,endLine:3,kind:'experience'}],requirements:[{line:3,category:'工作任务与能力'}],ignoredJdLines:[1,2]});
for(const title of ['岗位：产品助理实习生（基础产品支持）','职位名称：技术支持工程师','岗位：客户支持专员'])test('standalone title accepted: '+title,async()=>{
  const input=parsing(title),r=await parseWithAI(input,async()=>({data:parsed(),meta:{}}));
  assert.equal(r.requirements.length,1);assert.equal(r.requirements[0].text,'支持数据核对工作。');
  assert.ok(r.warnings.some(w=>w.includes(title)));assert.equal(r.experiences[1].text,'课程项目\n参与整理表格。');
});
for(const title of ['岗位：产品助理实习生（本科及以上）','岗位：产品助理（支持日常运营工作）','岗位：产品助理，负责数据支持。','岗位：产品助理，每周到岗3天。','岗位：产品助理（实习期3个月）','支持产品日常运营工作。'])test('duty/condition cannot be discarded: '+title,async()=>{
  await assert.rejects(parseWithAI(parsing(title),async()=>({data:parsed(),meta:{}})),/包含要求/);
});
test('JD duty remains required even alongside the newly recognized title',async()=>{
  const input=parsing('岗位：产品助理实习生（基础产品支持）'),d=parsed();d.requirements=[{line:2,category:'工作任务与能力'}];d.ignoredJdLines=[1,3];
  await assert.rejects(parseWithAI(input,async()=>({data:d,meta:{}})),/包含要求/);
});
