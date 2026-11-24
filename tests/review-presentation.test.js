import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMaterials,composeText,analyze} from '../public/domain.js';
import {applyReview,reviewDraft,requiresReviewConfirmation} from '../public/review-state.js';
import {reviewSections,profileParts,replaceProfilePart,textDiff,renderTextDiff,unitReviewBefore,categoryStyle} from '../public/review-presentation.js';
import {renderReview} from '../public/review-view.js';
import {renderComparison} from '../public/comparison-view.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const helpers={esc,btn:(text,action,cls='',extra='')=>`<button data-action="${action}" ${extra}>${text}</button>`,badge:(text,type='')=>`<span class="badge ${type}">${esc(text)}</span>`,config:{mode:'mock',maxTextLength:30000}};
const resume='林知遥\n求职意向：产品实习生\n电话：13800000000 邮箱：example@example.com 可实习：4—6个月，每周5天\n\n教育背景\n海川大学 信息管理 本科在读\n\n校园数据项目｜成员\n2025.09—2025.12\n参与数据分析，使用 Python 整理数据并输出报告。\n\n技能\nPython、Figma。';
const jd='岗位职责：\n参与数据分析\n使用 Python\n任职要求：\n本科及以上\n用户研究经验优先';
function taskFixture(){const parsed=parseMaterials(resume,jd);const task={resumeOriginal:resume,resumeCorrected:resume,jdOriginal:jd,jdCorrected:jd,...parsed,parseWarnings:parsed.warnings,selected:parsed.experiences.filter(e=>e.kind!=='context').map(e=>e.id),suggestions:[],facts:[],questions:[],associations:[],revision:2,step:1,maxStep:2,reviewNeedsConfirmation:false};Object.assign(task,analyze(task));return task;}

test('contact and availability are displayed with name, independently of the intent source unit',()=>{
  const t=taskFixture(),before=structuredClone(t),groups=reviewSections(t.experiences);
  const basic=groups.find(g=>g.profileType==='basic'),intent=groups.find(g=>g.profileType==='intent');
  assert.ok(basic.parts.some(p=>p.text.includes('林知遥')));
  for(const value of ['13800000000','example@example.com','每周5天'])assert.ok(basic.parts.some(p=>p.text.includes(value)));
  assert.ok(intent.parts.every(p=>!p.text.includes('电话')&&!p.text.includes('邮箱')&&!p.text.includes('可实习')));
  assert.deepEqual(t,before);assert.equal(composeText(t),resume);
});

test('compact PDF profile stays lossless and does not merge real experience or skill content',()=>{
  const text='林知遥 求职意向：产品实习生 电话：13800000000 邮箱：example@example.com 可实习：每周5天';
  const unit={id:'profile',kind:'context',title:'林知遥',text};
  assert.equal(profileParts(unit).map(p=>p.text).join(''),text);
  assert.deepEqual(profileParts({...unit,kind:'experience'}),[]);
  assert.deepEqual(profileParts({...unit,text:'专业技能\n参与用户研究，使用电话访谈。'}),[]);
  assert.deepEqual(profileParts({...unit,text:'教育背景\n海川大学 本科'}),[]);
});

test('editing a regrouped contact field updates only its source span and preserves source order',()=>{
  const t=taskFixture(),groups=reviewSections(t.experiences),p=groups.find(g=>g.profileType==='basic').parts.find(p=>p.text.includes('13800000000'));
  const unit=t.experiences.find(e=>e.id===p.unitId),value=p.text.replace('每周5天','每周4天');
  unit.text=replaceProfilePart(unit.text,p.start,p.end,value);t.reviewDirty=true;
  assert.equal(reviewDraft(t).resume,resume.replace('每周5天','每周4天'));
  const next=applyReview(t).task;
  assert.equal(next.resumeOriginal,resume);assert.equal(composeText(next),resume.replace('每周5天','每周4天'));
  assert.deepEqual(next.experiences.filter(e=>e.kind!=='context').map(e=>e.id),t.experiences.filter(e=>e.kind!=='context').map(e=>e.id));
  assert.equal(requiresReviewConfirmation(next),true);
});

test('each profile partition preserves its exact replacement range with same-line fields',()=>{
  let text='林知遥 求职意向：产品实习生 电话：13800000000';
  let unit={id:'p',kind:'context',title:'林知遥',text};
  const intent=profileParts(unit).find(p=>p.type==='intent');
  text=replaceProfilePart(text,intent.start,intent.end,'求职意向：AI 产品实习生 ');
  const contact=profileParts({...unit,text}).find(p=>p.text.includes('电话'));
  text=replaceProfilePart(text,contact.start,contact.end,'电话：13900000000');
  assert.equal(text,'林知遥 求职意向：AI 产品实习生 电话：13900000000');
  assert.throws(()=>replaceProfilePart(text,-1,4,'x'));
});

test('diff highlights a small edit and can reconstruct both complete versions including Unicode and newlines',()=>{
  for(const [before,after] of [['英语六级。','英语六级。1'],['每周5天','每周4天'],['A\r\nB','A\nB'],['🙂 数据分析','🙂 负责数据分析'],['','新增'],['删除',''],['相同','相同']]){
    const ops=textDiff(before,after);
    assert.equal(ops.filter(o=>o.type!=='insert').map(o=>o.text).join(''),before);
    assert.equal(ops.filter(o=>o.type!=='delete').map(o=>o.text).join(''),after);
  }
  assert.deepEqual(textDiff('英语六级。','英语六级。1'),[{type:'equal',text:'英语六级。'},{type:'insert',text:'1'}]);
  assert.match(renderTextDiff('原文','<img src=x onerror=alert(1)>',esc),/&lt;img/);
  assert.doesNotMatch(renderTextDiff('原文','<img src=x onerror=alert(1)>',esc),/<img/);
});

test('large edits use a bounded diff without losing unchanged lines or material text',()=>{
  const before=('共同内容一行。\n'.repeat(1400))+'旧段落'+('尾部内容。\n'.repeat(1000));
  const after='新增起始\n'+before.replace('旧段落','新段落')+'新增结尾';
  const ops=textDiff(before,after);
  assert.equal(ops.filter(o=>o.type!=='insert').map(o=>o.text).join(''),before);
  assert.equal(ops.filter(o=>o.type!=='delete').map(o=>o.text).join(''),after);
});

test('applied edit highlights survive no-op confirmation, serialization and JD-only updates',()=>{
  const t=taskFixture(),exp=t.experiences.find(e=>e.kind==='experience');
  const original=exp.text;exp.text+='\n本人制作了数据图表。';t.reviewDirty=true;
  const next=applyReview(t).task,updated=next.experiences.find(e=>e.id===exp.id);
  assert.equal(unitReviewBefore(next,updated),original);
  const record=structuredClone(next.lastReviewChanges);
  const restored=JSON.parse(JSON.stringify(next));
  assert.deepEqual(applyReview(restored).task.lastReviewChanges,record);
  restored.materialJD+='\n具备沟通能力';
  const jdUpdated=applyReview(restored).task;
  assert.deepEqual(jdUpdated.lastReviewChanges.units,record.units);
  assert.deepEqual(jdUpdated.lastReviewChanges.resume,record.resume);
  assert.equal(jdUpdated.resumeOriginal,resume);
});

test('format-only highlights do not revoke confirmation or change revision',()=>{
  const t=taskFixture();t.materialResume=resume.replace('每周5天','每周 5 天');
  const next=applyReview(t).task;
  assert.equal(next.revision,t.revision);assert.equal(requiresReviewConfirmation(next),false);
  assert.equal(next.lastReviewChanges.resume.before,resume);
});

test('review and comparison preserve every requirement, its category and escaping in the shared palette',()=>{
  const t=taskFixture(),review=renderReview(t,helpers),comparison=renderComparison(t,helpers);
  for(const r of t.requirements){
    assert.ok(review.includes(`review-requirement-card category-${categoryStyle(r.category)}`));
    assert.ok(comparison.includes(`requirement-card category-${categoryStyle(r.category)}`));
    assert.ok(review.includes(esc(r.text)));assert.ok(comparison.includes(esc(r.text)));
  }
  assert.equal((review.match(/data-category-card=/g)||[]).length,t.requirements.length);
  assert.equal((comparison.match(/class="requirement-evidence"/g)||[]).length,t.requirements.length);
});
