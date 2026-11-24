import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeWithAI} from '../lib/material-pipeline.mjs';
import {requestAI,taskSnapshot,assertCurrentTask,analysisKey} from '../public/ai-state.js';
import {analyze} from '../public/domain.js';

const task=()=>({id:'local-test',revision:4,selected:['e1'],suggestions:[],
  experiences:[{id:'e1',title:'项目甲',kind:'experience',text:'参与整理材料。'},{id:'e2',title:'项目乙',kind:'experience',text:'参与制作图表。'}],
  requirements:[{id:'r1',text:'整理资料',category:'工作任务与能力'}],
  associations:[{requirementId:'r1',experienceId:'e1',experienceIds:['e1','e2'],status:'表达不足',manual:true,manualStatus:true,links:[
    {requirementId:'r1',experienceId:'e1',status:'表达不足',manual:true,manualStatus:true},
    {requirementId:'r1',experienceId:'e2',status:'相关但不等价',manual:true,manualStatus:true}
  ]}],facts:[],questions:[]});
const response={associations:[{requirementId:'r1',experienceId:'e1',status:'表达不足',reason:'需核对材料。',evidence:[{sourceId:'e1',quote:'参与整理材料。'}]}],questions:[]};
test('the frontend sends the full modified task and retains it when a local guard rejects',async()=>{
  const t=task(),before=taskSnapshot(t),prior=globalThis.fetch;let sent;
  globalThis.fetch=async(url,o)=>{assert.equal(url,'/api/analyze');sent=JSON.parse(o.body);return {ok:false,json:async()=>({error:'本机费用账本暂停，未发送 AI 请求。'})};};
  try{await assert.rejects(requestAI('analyze',{task:structuredClone(t),consent:true}),/本机费用账本暂停/);assert.deepEqual(sent.task,t);assert.equal(taskSnapshot(t),before);}finally{globalThis.fetch=prior;}
});
test('each manually linked experience keeps its own status; judgments do not become facts',async()=>{
  const t=task(),before=taskSnapshot(t);let payload;
  const out=await analyzeWithAI(t,async(s,p)=>{payload=p;return {data:structuredClone(response),meta:{stage:s}}});
  assert.deepEqual(payload.manualAssociations[0].links,t.associations[0].links.map(({requirementId,...l})=>l));
  assert.deepEqual(payload.sources.map(s=>s.id),['e1','e2']);assert.equal(taskSnapshot(t),before);
  t.aiAnalysis={key:analysisKey(t),...out};Object.assign(t,analyze(t));
  assert.deepEqual(t.associations[0].experienceIds,['e1','e2']);assert.equal(t.associations[0].links[1].status,'相关但不等价');
});
test('confirmed/provided/unknown/none/skipped and archived answers retain separate boundaries',async()=>{
  for(const status of ['confirmed','provided','unknown','none','skipped']){
    const t=task();t.questions=[{id:'q1',requirementId:'r1',experienceId:'e1',status:'archived',previousStatus:status,text:'采用的方法是什么？',answer:'用户已回答'}];
    t.facts=[{id:'f1',experienceId:'e1',questionId:'q1',text:'使用图表整理。',status:status==='confirmed'?'confirmed':status==='provided'?'pending':status}];
    let p;await analyzeWithAI(t,async(s,input)=>{p=input;return {data:structuredClone(response),meta:{}}});
    assert.equal(p.resolvedQuestions[0].status,status);assert.equal(p.resolvedQuestions[0].canAsk,false);
    assert.equal(p.sources.some(s=>s.id==='f1'),status==='confirmed');
    assert.deepEqual(p.resolvedQuestions[0].confirmedSourceIds,status==='confirmed'?['f1']:[]);
  }
});
test('an edited manual judgment invalidates an older in-flight response',()=>{
  const t=task(),snapshot=taskSnapshot(t);t.associations[0].links[1].status='尚未确认';
  assert.throws(()=>assertCurrentTask(t,snapshot,t.id),/旧结果已忽略/);
});
