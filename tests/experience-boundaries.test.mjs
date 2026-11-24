import test from 'node:test';
import assert from 'node:assert/strict';
import {parseWithAI,analyzeWithAI} from '../lib/material-pipeline.mjs';
import {sha256} from '../lib/model-client.mjs';

const jd='工作职责\n参与原型设计与资料整理';
const modelData=units=>({units,requirements:[{line:2,category:'工作任务与能力'}],ignoredJdLines:[1]});
const parse=(resume,units)=>parseWithAI({resume,jd},async()=>({data:modelData(units),meta:{replay:true}}));
const span=(startLine,endLine,kind='experience')=>({startLine,endLine,kind});
const fixture=[
  '基本信息',
  '课程项目',
  '2026.03—2026.06  座位预约原型  3人课程小组成员',
  '• 完成5页原型，没有连接真实教室数据或上线。',
  '2025.10—2026.01  课程信息架构整理  课程作业负责人',
  '• 制作两套页面草图，交付设计说明文档，不包含系统开发。',
  '2025.03—2025.06  公共设施导视练习  课程小组成员',
  '• 绘制一张问题分布图，没有实际施工或安装。',
  '校园实践',
  '2025.09—2026.03  讲座签到服务  执行志愿者',
  '• 参加两次讲座签到，没有负责活动整体策划或资源预算。',
  '2024.10—2025.06  社团信息整理  普通成员',
  '• 维护公共素材文件夹，保存修改记录。',
  '技能与优势',
  '• 能用Excel排序，暂未独立用SQL开展业务分析。'
];
const units=[span(1,1,'context'),span(2,8),span(9,13),span(14,15,'context')];

function assertSourcePreserved(resume,experiences){
  let reconstructed='',position=0;
  for(const e of experiences){
    assert.ok(e.start>=position);
    assert.equal(e.text,resume.slice(e.start,e.end));
    assert.equal(e.original,e.text);assert.equal(e.sourceText,e.text);
    const gap=resume.slice(position,e.start);assert.match(gap,/^\s*$/u);
    reconstructed+=gap+e.text;position=e.end;
  }
  assert.match(resume.slice(position),/^\s*$/u);
  assert.equal(reconstructed+resume.slice(position),resume);
}

test('three projects and two activities receive separate source IDs with all original facts',async()=>{
  const resume=fixture.join('\n'),raw=modelData(structuredClone(units)),before=structuredClone(raw);
  const result=await parseWithAI({resume,jd},async()=>({data:raw,meta:{replay:true}}));
  const experiences=result.experiences.filter(e=>e.kind==='experience');
  assert.equal(experiences.length,5);assert.equal(new Set(experiences.map(e=>e.id)).size,5);
  assert.deepEqual(experiences.map(e=>e.title),[fixture[2],fixture[4],fixture[6],fixture[9],fixture[11]]);
  assert.ok(experiences[0].text.includes('3人课程小组成员'));
  assert.ok(!experiences[0].text.includes('负责人'));
  assert.ok(experiences[1].text.includes('课程作业负责人'));
  assert.ok(!experiences[1].text.includes('5页'));
  assertSourcePreserved(resume,result.experiences);
  assert.deepEqual(raw,before,'model output stays immutable');
  assert.equal(result.meta.experienceBoundaryCorrection.splits.length,2);
  assert.deepEqual((await parse(resume,units)).experiences,result.experiences,'IDs are repeatable');
  const skillSource=fixture.slice(13).join('\n');
  assert.equal(result.experiences.at(-1).id,'exp_'+sha256(skillSource).slice(0,12)+'_3','unaffected context ID does not shift');
});

test('CRLF, blank lines and section headings are preserved exactly',async()=>{
  const lines=[...fixture];lines.splice(8,0,'','');
  const resume=lines.join('\r\n')+'\r\n';
  const r=await parse(resume,[span(1,1,'context'),span(2,10),span(11,15),span(16,17,'context')]);
  assert.equal(r.experiences.filter(e=>e.kind==='experience').length,5);
  assertSourcePreserved(resume,r.experiences);
  assert.ok(r.experiences.some(e=>e.text.startsWith('课程项目\r\n')));
});

test('already separated experience spans stay intact without correction metadata',async()=>{
  const resume=fixture.join('\n');
  const separate=[span(1,1,'context'),span(2,4),span(5,6),span(7,8),span(9,11),span(12,13),span(14,15,'context')];
  const r=await parse(resume,separate);
  assert.equal(r.experiences.filter(e=>e.kind==='experience').length,5);
  assert.equal(r.meta.experienceBoundaryCorrection,undefined);
  assertSourcePreserved(resume,r.experiences);
});

const keepTogether=[
  ['one project with explicitly named stages',[
    '课程项目','2025.01—2025.03  预约系统第一阶段  项目成员','• 完成需求梳理。',
    '2025.04—2025.06  预约系统第二阶段  项目成员','• 完成原型。']],
  ['a named enclosing project with workstream dates',[
    '校园预约系统','2025.01—2025.03  用户需求整理  项目成员','• 整理访谈记录。',
    '2025.04—2025.06  预约页面实现  项目成员','• 实现页面。']],
  ['same title with changed dates and roles',[
    '课程项目','2025.01—2025.03  预约系统  项目成员','• 完成需求梳理。',
    '2025.04—2025.06  预约系统  项目负责人','• 完成原型。']],
  ['versions of the same project',[
    '课程项目','2025.01—2025.03  预约系统 V1  项目成员','• 完成需求梳理。',
    '2025.04—2025.06  预约系统 V2  项目成员','• 完成原型。']],
  ['generic workflow headings',[
    '项目经历','2025.01—2025.03  需求调研  项目成员','• 整理反馈。',
    '2025.04—2025.06  测试验收  项目成员','• 记录问题。']],
  ['dates in body bullets',[
    '课程项目','2025.01—2025.06  预约系统  项目成员',
    '• 2025.01—2025.03  用户需求整理  项目成员','• 2025.04—2025.06  预约页面实现  项目成员']],
  ['dated prose without a role column',[
    '项目经历','2025.01—2025.03 完成需求梳理。','2025.04—2025.06 完成原型。']],
  ['uncertain headings do not cause a partial split',[
    '项目经历','2025.01—2025.03  预约系统  项目成员','• 完成原型。',
    '2025.04—2025.06 未说明具体职责','• 暂未确认。',
    '2025.07—2025.09  资料管理系统  项目成员','• 整理资料。']],
  ['adjacent metadata headings without work descriptions',[
    '项目经历','2025.01—2025.03  预约系统  项目成员',
    '2025.04—2025.06  资料管理系统  项目成员','• 整理资料。']]
];
for(const [name,lines] of keepTogether)test(name+' is not mechanically split',async()=>{
  const resume=lines.join('\n'),r=await parse(resume,[span(1,lines.length)]);
  assert.equal(r.experiences.length,1);assert.equal(r.meta.experienceBoundaryCorrection,undefined);
  assertSourcePreserved(resume,r.experiences);
});

for(const title of ['教育背景','技能与优势'])test(title+' remains context even with dated entries',async()=>{
  const lines=[title,...fixture.slice(2,8)],resume=lines.join('\n');
  const r=await parse(resume,[span(1,lines.length,'context')]);
  assert.equal(r.experiences.length,1);assert.equal(r.experiences[0].kind,'context');
  assertSourcePreserved(resume,r.experiences);
});

test('existing non-overlap and full-coverage validation is not relaxed',async()=>{
  const resume=fixture.join('\n');
  await assert.rejects(parse(resume,[span(1,8),span(8,15)]),/重叠/);
  await assert.rejects(parse(resume,[span(1,4),span(7,15)]),/部分原文未被保留/);
});

test('split source IDs still reject evidence belonging to another project',async()=>{
  const parsed=await parse(fixture.join('\n'),units),[first,second]=parsed.experiences.filter(e=>e.kind==='experience');
  const task={...parsed,facts:[],questions:[],associations:[],selected:[first.id,second.id]};
  let calls=0;
  await assert.rejects(analyzeWithAI(task,async()=>{
    calls++;return {data:{associations:[{requirementId:parsed.requirements[0].id,experienceId:first.id,status:'已有明确证据',reason:'原型设计',evidence:[{sourceId:second.id,quote:'制作两套页面草图'}]}],questions:[]},meta:{}};
  }),/证据不在对应经历/);
  assert.equal(calls,2,'existing one-correction limit stays in force');
});

test('using the right ID cannot borrow the other project text',async()=>{
  const parsed=await parse(fixture.join('\n'),units),first=parsed.experiences.find(e=>e.kind==='experience');
  let calls=0;
  await assert.rejects(analyzeWithAI({...parsed,facts:[],questions:[],associations:[]},async()=>{
    calls++;return {data:{associations:[{requirementId:parsed.requirements[0].id,experienceId:first.id,status:'已有明确证据',reason:'原型设计',evidence:[{sourceId:first.id,quote:'制作两套页面草图'}]}],questions:[]},meta:{}};
  }),/证据不在对应经历/);
  assert.equal(calls,1);
});
