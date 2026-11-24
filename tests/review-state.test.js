import test from 'node:test';
import assert from 'node:assert/strict';
import { sample, parseMaterials, analyze, generateCandidates, composeText } from '../public/domain.js';
import { reviewDraft, reviewChanges, applyReview, requiresReviewConfirmation } from '../public/review-state.js';

// The shipped sample is entirely fictional. Each test owns an independent task.
function makeTask(resume=sample.resume,jd=sample.jd) {
  const parsed = parseMaterials(resume,jd);
  const experiences = parsed.experiences.filter(e => e.kind !== 'context');
  const task = {
    id:'review-fixture', baseId:'base-fixture',
    resumeOriginal:resume, resumeCorrected:resume,
    jdOriginal:jd, jdCorrected:jd,
    experiences:parsed.experiences, requirements:parsed.requirements,
    parseWarnings:parsed.warnings, selected:experiences.slice(0,2).map(e=>e.id),
    revision:4, step:3, maxStep:4, confirmed:true, stale:false,
    reviewDirty:false, reviewNeedsConfirmation:false,
    facts:experiences.slice(0,2).map((e,index)=>({
      id:`fact-${index}`,experienceId:e.id,text:index?'本人整理了错误分类说明。':'本人绘制了预约流程图。',
      status:'confirmed',source:'用户补充',confirmedAt:'2026-11-20T01:00:00.000Z',
      baseId:'base-fixture',experienceTitle:e.title,experienceSource:e.text,
    })),
    questions:[],associations:[],suggestions:[],
    candidateHistory:[{id:'past-candidate',experienceId:experiences[0].id,text:experiences[0].text,revision:3}],
    corrections:[],createdAt:'2026-11-20T00:00:00.000Z',updatedAt:'2026-11-20T01:00:00.000Z',
  };
  const analysis=analyze(task);
  task.associations=analysis.associations;
  task.questions=[{id:'answered-question',experienceId:experiences[0].id,text:'你具体完成了什么？',status:'confirmed',answer:'本人绘制了预约流程图。'}];
  task.suggestions=generateCandidates(task).map((s,index)=>index
    ? {...s,status:'edited',editedText:s.text.replace('参与','协助')}
    : {...s,status:'accepted'});
  return task;
}

test('opening review uses full corrected materials and never adopted rewrite text',()=>{
  const task=makeTask();
  assert.notEqual(composeText(task),task.resumeCorrected,'fixture must contain an adopted rewrite');
  const draft=reviewDraft(task);
  assert.equal(draft.resume,task.resumeCorrected);
  assert.equal(draft.jd,task.jdCorrected);
  assert.equal(reviewChanges(task).substantive,false);
  assert.equal(requiresReviewConfirmation(task),false);
});

test('newline-only resume edit preserves selected identities, fact confirmation and accepted edits',()=>{
  const task=makeTask();
  task.materialResume=sample.resume.replace(/\r?\n/g,'\r\n');
  task.reviewDirty=true;
  const before=structuredClone(task);
  const historySnapshot=structuredClone(task);
  const {task:next,change}=applyReview(task);
  assert.equal(change.formattingOnly,true);
  assert.equal(change.substantive,false);
  assert.equal(change.structural,false);
  assert.equal(next.revision,task.revision);
  assert.equal(next.stale,false);
  assert.equal(next.confirmed,true);
  assert.deepEqual(next.selected,task.selected);
  assert.deepEqual(next.experiences.map(e=>e.id),task.experiences.map(e=>e.id));
  assert.deepEqual(next.suggestions,task.suggestions);
  assert.deepEqual(next.questions,task.questions);
  assert.deepEqual(next.associations,task.associations);
  assert.deepEqual(next.candidateHistory,task.candidateHistory);
  assert.equal(next.orphanedFacts.length,0);
  for(const old of task.facts){
    const fact=next.facts.find(f=>f.id===old.id);
    assert.equal(fact.status,'confirmed');
    assert.equal(fact.confirmedAt,old.confirmedAt);
    assert.equal(fact.experienceId,old.experienceId);
    assert.equal(fact.text,old.text);
    assert.equal(fact.experienceSource,next.experiences.find(e=>e.id===fact.experienceId).text,
      'reusable source must follow formatting without revoking the confirmed fact');
  }
  assert.equal(next.resumeOriginal,sample.resume);
  assert.equal(next.reviewDirty,false);
  assert.equal('materialResume' in next,false);
  assert.equal(requiresReviewConfirmation(next),false);
  assert.deepEqual(task,before,'applying must not mutate the input task');
  assert.deepEqual(historySnapshot,before,'historical snapshots remain independent');
});

test('JD whitespace-only change preserves requirement identity, classifications and evidence links',()=>{
  const task=makeTask();
  task.requirements[0].category='用户校正类别';
  task.materialJD=sample.jd.split(/\r?\n/).map(line=>`  ${line}  `).join('\r\n');
  const {task:next,change}=applyReview(task);
  assert.equal(change.formattingOnly,true);
  assert.equal(change.jdContent,false);
  assert.deepEqual(next.requirements.map(r=>r.id),task.requirements.map(r=>r.id));
  assert.equal(next.requirements[0].category,'用户校正类别');
  assert.deepEqual(next.associations,task.associations);
  assert.deepEqual(next.questions,task.questions);
  assert.deepEqual(next.facts,task.facts);
  assert.deepEqual(next.suggestions,task.suggestions);
  assert.equal(next.revision,task.revision);
});

test('wrapping a JD requirement across extra lines preserves its semantic unit and links',()=>{
  const task=makeTask();
  const requirement=task.requirements.find(r=>r.text.includes('Figma'));
  task.materialJD=sample.jd.replace('熟悉 Figma 或其他原型工具，具备清晰的沟通与文档表达能力。',
    '熟悉 Figma 或其他原型工具，\n\n具备清晰的沟通与文档表达能力。');
  const {task:next,change}=applyReview(task);
  assert.equal(change.formattingOnly,true);
  assert.equal(next.requirements.length,task.requirements.length);
  assert.deepEqual(next.requirements.map(r=>r.id),task.requirements.map(r=>r.id));
  assert.equal(next.requirements.find(r=>r.id===requirement.id).text.replace(/\s/g,''),requirement.text.replace(/\s/g,''));
  assert.deepEqual(next.associations,task.associations);
  assert.deepEqual(next.questions,task.questions);
  assert.deepEqual(next.suggestions,task.suggestions);
  assert.equal(next.revision,task.revision);
});

test('adding a blank line inside one experience preserves the existing unit and fact ownership',()=>{
  const task=makeTask();
  task.materialResume=sample.resume.replace('使用 Figma 制作预约页面原型','\n使用 Figma 制作预约页面原型');
  const {task:next,change}=applyReview(task);
  assert.equal(change.formattingOnly,true);
  assert.equal(change.structural,false);
  assert.deepEqual(next.experiences.map(e=>e.id),task.experiences.map(e=>e.id));
  assert.deepEqual(next.selected,task.selected);
  assert.equal(next.facts.length,task.facts.length);
  assert.equal(next.facts.every(f=>f.status==='confirmed'),true);
  assert.deepEqual(next.suggestions,task.suggestions);
  assert.deepEqual(next.questions,task.questions);
  assert.deepEqual(next.associations,task.associations);
  assert.equal(next.revision,task.revision);
});

test('editing an actual resume number invalidates generated text and only that experience facts',()=>{
  const task=makeTask();
  const affected=task.experiences.find(e=>e.text.includes('1,200'));
  const before=structuredClone(task);
  task.materialResume=sample.resume.replace('1,200','1,800');
  const {task:next,change}=applyReview(task);
  assert.equal(change.resumeContent,true);
  assert.equal(next.revision,task.revision+1);
  assert.equal(next.stale,true);
  assert.equal(next.confirmed,false);
  assert.equal(requiresReviewConfirmation(next),true);
  assert.deepEqual(next.suggestions,task.suggestions,'prior edits remain visible for review, not overwritten');
  assert.ok(next.suggestions.every(s=>s.revision<next.revision));
  assert.equal(next.facts.find(f=>f.experienceId===affected.id).status,'pending');
  assert.equal(next.facts.find(f=>f.experienceId!==affected.id).status,'confirmed');
  assert.ok(next.corrections.some(c=>c.experienceId===affected.id&&c.text.includes('1,800')));
  assert.deepEqual(next.selected,task.selected);
  assert.equal(next.resumeOriginal,before.resumeOriginal);
  assert.equal(before.resumeCorrected,sample.resume);
});

test('actual JD edit invalidates evidence conclusions without revoking confirmed experience facts',()=>{
  const task=makeTask();
  task.materialJD=sample.jd.replace('每周可到岗 3 天','每周可到岗 4 天');
  const {task:next,change}=applyReview(task);
  assert.equal(change.jdContent,true);
  assert.equal(change.resumeContent,false);
  assert.equal(next.stale,true);
  assert.equal(next.revision,task.revision+1);
  assert.equal(next.confirmed,false);
  assert.deepEqual(next.facts,task.facts);
  assert.deepEqual(next.suggestions,task.suggestions);
  assert.equal(next.requirements.some(r=>r.text.includes('每周可到岗 4 天')),true);
  assert.equal(requiresReviewConfirmation(next),true);
});

test('staged unsaved full resume and JD are applied together rather than replacing either with stale cards',()=>{
  const task=makeTask();
  task.materialResume=sample.resume.replace('1,200','1,800');
  task.materialJD=sample.jd.replace('每周可到岗 3 天','每周可到岗 4 天');
  const draft=reviewDraft(task);
  assert.equal(draft.resume,task.materialResume);
  assert.equal(draft.jd,task.materialJD);
  const {task:next,change}=applyReview(task);
  assert.equal(change.resumeContent,true);
  assert.equal(change.jdContent,true);
  assert.equal(next.resumeCorrected,task.materialResume);
  assert.equal(next.jdCorrected,task.materialJD);
  assert.equal(next.experiences.some(e=>e.text.includes('1,800')),true);
  assert.equal(next.requirements.some(r=>r.text.includes('到岗 4 天')),true);
  assert.equal('materialResume' in next,false);
  assert.equal('materialJD' in next,false);
  assert.equal(next.revision,task.revision+1,'one combined commit advances the material version once');
});

for(const field of ['materialResume','materialJD']){
  test(`empty ${field} fails atomically and keeps both editor inputs`,()=>{
    const task=makeTask();
    task.materialResume=sample.resume.replace('1,200','1,800');
    task.materialJD=sample.jd.replace('每周可到岗 3 天','每周可到岗 4 天');
    task[field]=' \n\t ';
    const before=structuredClone(task);
    assert.throws(()=>applyReview(task),/不能为空/);
    assert.deepEqual(task,before);
  });
  test(`overlimit ${field} fails atomically without silently truncating input`,()=>{
    const task=makeTask();
    task.materialResume=sample.resume;
    task.materialJD=sample.jd;
    task[field]='字'.repeat(30001);
    const before=structuredClone(task);
    assert.throws(()=>applyReview(task,{maxTextLength:30000}),/30000/);
    assert.deepEqual(task,before);
    assert.equal(task[field].length,30001);
  });
}

test('explicit kind override survives reparsing and remains selectable',()=>{
  const task=makeTask();
  const context=task.experiences.find(e=>e.title==='技能');
  assert.ok(context,'fixture has a skills context block');
  context.kind='experience';
  context.kindOverride='experience';
  task.selected.push(context.id);
  task.reviewMetadataDirty=true;
  const {task:next}=applyReview(task);
  const restored=next.experiences.find(e=>e.id===context.id);
  assert.equal(restored.kind,'experience');
  assert.equal(restored.kindOverride,'experience');
  assert.ok(next.selected.includes(context.id));
  assert.equal(requiresReviewConfirmation(next),true);
});

test('an older task with zero parsed experiences can rebuild the same supplied resume',()=>{
  const task=makeTask();
  task.experiences=[];task.selected=[];task.facts=[];task.suggestions=[];
  task.associations=[];task.questions=[];task.maxStep=1;task.confirmed=false;
  task.materialResume=sample.resume;task.materialJD=sample.jd;
  task.parserVersion=1;
  const before=structuredClone(task);
  const {task:next,change}=applyReview(task);
  assert.equal(change.resumeContent,false);
  assert.equal(change.jdContent,false);
  assert.equal(next.experiences.filter(e=>e.kind!=='context').length,3);
  assert.equal(next.selected.length,3);
  assert.equal(next.parseWarnings.some(w=>/未识别出独立经历/.test(w)),false);
  assert.equal(next.resumeCorrected,sample.resume);
  assert.equal(next.parserVersion,2);
  assert.equal(requiresReviewConfirmation(next),true);
  assert.deepEqual(task,before);
});

test('reparsing old split skills merges the section without losing edited material or orphan facts',()=>{
  const skills='技能与优势\n• AI\n技能：熟悉 Python，完成数据清洗。\n• 英语水平：英语六级。';
  const resume=sample.resume.replace(/技能\nFigma、Python、Excel；英语 CET-6。$/,skills);
  const task=makeTask(resume);
  const merged=task.experiences.find(e=>e.sectionTitle==='技能与优势');
  const bodyStart=resume.indexOf('技能：');
  const oldUnit=(id,start,end,title)=>({id,start,end,title,kind:'context',text:resume.slice(start,end),original:resume.slice(start,end),sourceText:resume.slice(start,end)});
  task.experiences.splice(task.experiences.indexOf(merged),1,
    {...oldUnit('skills-heading',merged.start,bodyStart-1,'技能与优势'),sectionTitle:'技能与优势'},
    {...oldUnit('skills-body',bodyStart,merged.end,'技能：熟悉 Python，完成数据清洗。'),sectionTitle:'技能'});
  // Keep a genuine user correction and an already answered fact from the old split.
  task.experiences.at(-1).text=task.experiences.at(-1).text.replace('英语六级','英语四级');
  const fact={id:'skills-fact',experienceId:'skills-body',text:'本人使用 Python 整理了课程数据记录。',status:'confirmed'};
  task.facts.push(fact);
  const before=structuredClone(task);
  const {task:next}=applyReview(task,{forceReparse:true});
  const sections=next.experiences.filter(e=>e.sectionTitle==='技能与优势');
  assert.equal(sections.length,1);
  assert.equal(sections[0].id,'skills-heading');
  assert.match(sections[0].text,/Python/);
  assert.match(sections[0].text,/英语四级/);
  assert.equal(next.resumeOriginal,resume);
  assert.equal(next.resumeCorrected,resume.replace('英语六级','英语四级'));
  assert.equal(composeText({...next,suggestions:[]}),next.resumeCorrected);
  assert.ok(next.orphanedFacts.some(f=>f.id===fact.id&&f.text===fact.text));
  assert.ok(!next.facts.some(f=>f.id===fact.id),'a merged source must not silently transfer fact ownership');
  assert.deepEqual(task,before);
});

for(const prefix of ['• ','\t• ','- ','* ','+ ','‣ ','⁃ ']){
  test(`no-op review preserves source spans and adopted text for heading prefix ${JSON.stringify(prefix)}`,()=>{
    const resume=sample.resume.replace('校园自习室预约优化｜课程项目',`${prefix}校园自习室预约优化｜课程项目`);
    const task=makeTask(resume);
    const beforeText=composeText(task);
    const beforeUnits=structuredClone(task.experiences);
    const target=task.experiences.find(e=>e.text.includes(`${prefix}校园自习室预约优化｜课程项目`));
    assert.ok(task.suggestions.some(s=>s.experienceId===target.id&&s.status==='accepted'));
    const {task:next,change}=applyReview(task);
    assert.equal(change.resumeChanged,false);
    assert.equal(change.substantive,false);
    assert.deepEqual(next.experiences,beforeUnits);
    assert.equal(composeText(next),beforeText);
    for(const unit of next.experiences){
      assert.equal(next.resumeCorrected.slice(unit.start,unit.end),unit.sourceText);
    }
  });

  test(`formatting elsewhere keeps heading prefix ${JSON.stringify(prefix)} within its replacement span`,()=>{
    const resume=sample.resume.replace('校园自习室预约优化｜课程项目',`${prefix}校园自习室预约优化｜课程项目`);
    const task=makeTask(resume);
    const beforeText=composeText(task);
    const target=task.experiences.find(e=>e.text.includes(`${prefix}校园自习室预约优化｜课程项目`));
    task.materialResume=resume.replace('求职方向：','求职方向： ');
    const {task:next,change}=applyReview(task);
    const remapped=next.experiences.find(e=>e.id===target.id);
    assert.equal(change.formattingOnly,true);
    assert.equal(change.structural,false);
    assert.equal(remapped.sourceText,target.sourceText);
    assert.equal(next.resumeCorrected.slice(remapped.start,remapped.end),target.sourceText);
    assert.equal(composeText(next),beforeText.replace('求职方向：','求职方向： '));
    assert.equal(composeText(next).includes('• •'),false);
    assert.deepEqual(next.suggestions,task.suggestions);
    assert.deepEqual(next.selected,task.selected);
    assert.equal(next.revision,task.revision);
  });
}
