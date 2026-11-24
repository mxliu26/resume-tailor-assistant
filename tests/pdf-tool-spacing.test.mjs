import test from 'node:test';
import assert from 'node:assert/strict';
import {generateLive} from '../server.mjs';

const task = text => ({revision:1,experiences:[{id:'e1',title:'技能',text}],selected:['e1'],requirements:[],facts:[],questions:[],associations:[]});
const run = (t,text,sourceIds=['e1']) => generateLive(t,async()=>({data:{suggestions:[{experienceId:'e1',text,reason:'离线边界验证',sourceIds}]},meta:{offline:true}}));
const rejected = (t,text,ids) => assert.rejects(run(t,text,ids),/工具或英文术语|属于其他经历的事实/);

test('PDF horizontal spacing in MA TLAB does not reject the existing tool or mutate sources',async()=>{
  for(const source of ['具备 Python、C、MA TLAB 编程基础。','具备 ma\ttlab 编程基础。','具备 MATLAB 编程基础。']){
    const t=task(source),before=structuredClone(t);
    const result=await run(t,'具备 MATLAB 编程基础。');
    assert.equal(result.suggestions[0].text,'具备 MATLAB 编程基础。');
    assert.deepEqual(t,before);
  }
});

test('spacing normalization cannot turn negative MATLAB evidence into positive experience',async()=>{
  for(const source of ['没有使用 MA TLAB。','未使用 MA TLAB。','不熟悉 MA TLAB。']){
    await rejected(task(source),'使用 MATLAB。');
  }
  await run(task('未使用 MA TLAB。'),'未使用 MATLAB。');
});

test('new tools, different words, letter edits and arbitrary whitespace remain unsupported',async()=>{
  for(const [source,output] of [
    ['使用 MA TLAB。','使用 TensorFlow。'],
    ['使用 Bad Case 分析。','使用 BadCase 分析。'],
    ['使用 Py thon。','使用 Python。'],
    ['使用 MA TLAX。','使用 MATLAB。'],
    ['使用 XMA TLAB。','使用 MATLAB。'],
    ['使用 MA TLABX。','使用 MATLAB。'],
    ['使用 MA\nTLAB。','使用 MATLAB。'],
    ['使用 MA\n\nTLAB。','使用 MATLAB。'],
  ])await rejected(task(source),output);
});

test('MATLAB in another experience or only in JD is not evidence for the selected unit',async()=>{
  const t=task('整理资料。');
  t.experiences.push({id:'e2',title:'另一个项目',text:'使用 MA TLAB。'});
  t.requirements=[{id:'r1',text:'使用 MATLAB。',category:'工具或方法'}];
  await rejected(t,'使用 MATLAB。');
  await rejected(t,'使用 MATLAB。',['e1','e2']);
});

test('only confirmed and explicitly cited supplements support a spaced tool',async()=>{
  for(const status of ['pending','unknown','none','conflict']){
    const t=task('整理资料。');t.facts=[{id:'f1',experienceId:'e1',text:'使用 MA TLAB。',status}];
    await rejected(t,'使用 MATLAB。');
    await rejected(t,'使用 MATLAB。',['e1','f1']);
  }
  const t=task('整理资料。');t.facts=[{id:'f1',experienceId:'e1',text:'使用 MA TLAB。',status:'confirmed'}];
  await rejected(t,'使用 MATLAB。');
  await run(t,'使用 MATLAB。',['e1','f1']);
});

test('normalization does not stitch separate sources into MATLAB evidence',async()=>{
  const t=task('使用 MA');t.facts=[{id:'f1',experienceId:'e1',text:'TLAB',status:'confirmed'}];
  await rejected(t,'使用 MATLAB。',['e1','f1']);
});
