import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceQuote} from '../lib/evidence-quote.mjs';
import {analyzeWithAI} from '../lib/material-pipeline.mjs';

test('literal quotes stay unchanged; wrapped Han quotes map back to a continuous original span',()=>{
  assert.equal(sourceQuote('前文：完成测试。后文','完成测试。'),'完成测试。');
  assert.equal(sourceQuote('原文：通\n过测试并完成路\n线规划。','通过测试并完成路线规划'),'通\n过测试并完成路\n线规划');
  assert.equal(sourceQuote('完成路\r\n  线规划','完成路线规划'),'完成路\r\n  线规划');
});

test('no fuzzy matching, punctuation rewriting, numeric merging or paragraph stitching',()=>{
  const pairs=[
    ['协\n助整理材料','主导整理材料'],
    ['参与整理，未\n开展访谈','参与整理，开展访谈'],
    ['整理 10 份材料','整理 100 份材料'],
    ['整理 1\n0 份材料','整理 10 份材料'],
    ['完成路\n\n线规划','完成路线规划'],
    ['处理前期资料。\n输出报告','处理前期资料输出报告'],
    ['使用 Bad\nCase 分析','使用 BadCase 分析'],
    ['使用 Bad Case 分析','使用 BadCase 分析'],
    ['完成分析，输出报告','完成分析;输出报告'],
    ['完成路\n线规划','完成路线设计'],
    ['参与整理并保留未知','参与整理，指标提升'],
  ];
  for(const [source,quote] of pairs)assert.equal(sourceQuote(source,quote),null);
  for(const quote of ['',null,undefined,123])assert.equal(sourceQuote('原文',quote),null);
});

const task=()=>({
  experiences:[{id:'e1',kind:'experience',title:'项目甲',text:'本人协\n助整理资料，未开展访谈。'},{id:'e2',kind:'experience',title:'项目乙',text:'通\n过测试。'}],
  requirements:[{id:'r1',category:'工作任务与能力',text:'协助整理资料'}],
  facts:[],questions:[],associations:[],
});
const run=(t,sourceId,quote,experienceId='e1')=>analyzeWithAI(t,async()=>({
  data:{associations:[{requirementId:'r1',experienceId,status:'已有明确证据',reason:'依据所引原文。',evidence:[{sourceId,quote}]}],questions:[]},meta:{stage:'analyze'},
}));
test('analysis uses exact original evidence after a line-wrap-only match',async()=>{
  const r=await run(task(),'e1','本人协助整理资料，未开展访谈。');
  assert.equal(r.associations[0].evidence,'本人协\n助整理资料，未开展访谈。');
});
test('matching text cannot bypass experience ownership or missing source gates',async()=>{
  await assert.rejects(run(task(),'e2','通过测试。'),/证据不在对应经历/);
  await assert.rejects(run(task(),'missing','本人协助整理资料'),/证据不在对应经历/);
});
test('unconfirmed, unknown and conflicting facts remain ineligible',async()=>{
  for(const status of ['pending','unknown','none','conflict']){
    const t=task();t.facts=[{id:'f1',experienceId:'e1',text:'通\n过测试。',status}];
    await assert.rejects(run(t,'f1','通过测试。'),/证据不在对应经历/);
  }
});
test('confirmed facts still require the same experience and original wording',async()=>{
  const t=task();t.facts=[{id:'f1',experienceId:'e1',text:'通\n过测试。',status:'confirmed'}];
  assert.equal((await run(t,'f1','通过测试。')).associations[0].evidence,'通\n过测试。');
  await assert.rejects(run(t,'f1','通过全部测试。'),/证据不在对应经历/);
  await assert.rejects(run(t,'f1','通过测试。','e2'),/证据不在对应经历/);
});
