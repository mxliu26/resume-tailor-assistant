import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {parseWithAI,analyzeWithAI} from '../lib/material-pipeline.mjs';
import {createModelClient} from '../lib/model-client.mjs';
import {analysisKey,hasCurrentAnalysis,taskSnapshot,assertCurrentTask,requestAI} from '../public/ai-state.js';
import {analyze} from '../public/domain.js';

const material={resume:'姓名：虚构甲\n课程项目\n参与整理12条记录。\n技能\n熟悉 Excel。',jd:'数据实习生\n负责数据整理，Excel 或 SQL 优先。'};
const parseResult=()=>({units:[{startLine:1,endLine:1,kind:'context'},{startLine:2,endLine:3,kind:'experience'},{startLine:4,endLine:5,kind:'context'}],requirements:[{line:2,category:'工具或方法'}],ignoredJdLines:[1]});
const task=()=>({id:'t1',revision:1,experiences:[{id:'e1',title:'课程项目',kind:'experience',text:'参与整理12条记录。'},{id:'e2',title:'另一项目',kind:'experience',text:'使用 SQL 查询。'}],requirements:[{id:'r1',text:'数据整理',category:'工作任务与能力'}],selected:['e1'],facts:[{id:'f1',experienceId:'e1',text:'使用 Excel。',status:'pending'}],questions:[],associations:[],suggestions:[]});
const result=()=>({associations:[{requirementId:'r1',experienceId:'e1',status:'表达不足',reason:'缺少实际方法',evidence:[{sourceId:'e1',quote:'参与整理12条记录。'}]}],questions:[{requirementId:'r1',experienceId:'e1',text:'实际采用了什么方法？',purpose:'确认方法'}]});
const call=data=>async()=>({data,meta:{promptVersion:'test'}});

test('live parse preserves exact originals, offsets and JD logic; personal name is not sent',async()=>{
  let sent;const parsed=await parseWithAI(material,async(stage,payload)=>{sent=payload;return call(parseResult())();});
  for(const e of parsed.experiences)assert.equal(material.resume.slice(e.start,e.end),e.text);
  assert.equal(parsed.requirements[0].text,material.jd.split('\n')[1]);
  assert.match(parsed.requirements[0].logic,/或/);assert.match(parsed.requirements[0].strength,/优先/);
  assert.ok(!JSON.stringify(sent).includes('虚构甲'));
});
for(const [name,change] of [
  ['overlap',d=>d.units[1].startLine=1],['missing resume line',d=>d.units[1].startLine=3],
  ['missing requirement',d=>d.requirements=[]],['unknown category',d=>d.requirements[0].category='非常匹配'],
  ['requirement disguised as heading',d=>{d.requirements=[{line:1,category:'工作任务与能力'}];d.ignoredJdLines=[2];}]
])test('parse refuses '+name,async()=>{const d=parseResult();change(d);await assert.rejects(parseWithAI(material,call(d)),/校验失败/);});
test('analysis keeps pending facts out of model input',async()=>{
  let payload;const a=await analyzeWithAI(task(),async(stage,p)=>{payload=p;return call(result())();});
  assert.ok(!JSON.stringify(payload).includes('使用 Excel'));assert.equal(a.questions.length,1);
});
for(const [name,change] of [
  ['invented quote',d=>d.associations[0].evidence[0].quote='主导100人团队'],
  ['cross-project fact',d=>d.associations[0].evidence=[{sourceId:'e2',quote:'使用 SQL 查询。'}]],
  ['unconfirmed fact',d=>d.associations[0].evidence=[{sourceId:'f1',quote:'使用 Excel。'}]],
  ['unsupported none',d=>d.associations[0].status='确认没有相关经历'],
  ['unbound question',d=>d.questions[0].experienceId='e2'],
  ['too many questions',d=>d.questions=Array(4).fill(d.questions[0])]
])test('analysis rejects '+name,async()=>{const d=result();change(d);await assert.rejects(analyzeWithAI(task(),call(d)),/校验失败/);});
test('model associations and questions survive local refresh, then become stale on material change',async()=>{
  const t=task(),data=await analyzeWithAI(t,call(result()));t.aiAnalysis={key:analysisKey(t),...data};Object.assign(t,analyze(t));
  assert.equal(t.associations[0].origin,'ai');assert.equal(t.questions[0].text,'实际采用了什么方法？');assert.ok(hasCurrentAnalysis(t));
  t.experiences[0].text='新的实际材料';Object.assign(t,analyze(t));assert.equal(t.associations[0].origin,'ai-stale');assert.equal(t.associations[0].status,'尚未确认');
});
test('live analysis does not add local questions when model returns no necessary questions',async()=>{
  const t=task(),data=result();data.questions=[];
  t.aiAnalysis={key:analysisKey(t),...await analyzeWithAI(t,call(data))};
  Object.assign(t,analyze(t));assert.equal(t.questions.filter(q=>q.status==='pending').length,0);
});
test('late response cannot overwrite an edited draft even when revision is unchanged',()=>{
  const t=task(),snapshot=taskSnapshot(t);t.suggestions.push({editedText:'用户正在编辑'});
  assert.throws(()=>assertCurrentTask(t,snapshot,'t1'),/旧结果已忽略/);
  assert.throws(()=>assertCurrentTask(task(),taskSnapshot(task()),'another'),/旧结果已忽略/);
});
test('request helper never grants external consent implicitly',async()=>{
  const prior=globalThis.fetch;let input;
  globalThis.fetch=async(url,options)=>{input=JSON.parse(options.body);return {ok:true,json:async()=>({})};};
  try{await requestAI('generate',{task:task(),consent:false});assert.equal(input.consent,false);}finally{globalThis.fetch=prior;}
});
test('client handles truncated/blank/error/timeout responses, redirects and usage without automatic retries',async()=>{
  let mode='valid',calls=0;
  const server=http.createServer(async(req,res)=>{
    calls++;req.resume();
    if(mode==='timeout'){setTimeout(()=>res.end('{}'),150).unref();return;}
    if(mode==='redirect'){res.writeHead(302,{Location:'http://127.0.0.1:1/leak'});res.end();return;}
    if(mode==='error'){res.writeHead(429);res.end('provider-secret-body');return;}
    res.end(JSON.stringify({model:'snapshot-test',usage:{prompt_tokens:10,completion_tokens:20},choices:[{finish_reason:mode==='truncated'?'length':'stop',message:{content:mode==='blank'?'   ':JSON.stringify({ok:true})}}]}));
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const client=createModelClient({base:`http://127.0.0.1:${server.address().port}`,model:'test',key:'not-a-real-key',timeout:80});
  try{
    const good=await client('analyze',{});assert.equal(good.meta.usage.prompt_tokens,10);assert.equal(good.meta.returnedModel,'snapshot-test');
    for(mode of ['truncated','blank','error','redirect','timeout']){
      const n=calls;await assert.rejects(client('analyze',{}),e=>{assert.ok(!e.message.includes('provider-secret'));return [422,429,502,504].includes(e.status);});assert.equal(calls,n+1);
    }
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
