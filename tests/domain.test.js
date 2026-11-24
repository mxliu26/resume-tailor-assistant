import test from 'node:test';
import assert from 'node:assert/strict';
import { sample, parseMaterials, reconcileExperiences, normalizeFormatting, normalizeFormattingWithMap, isFormattingOnly, detectFactConflicts, analyze, generateCandidates, composeText, validateFinal } from '../public/domain.js';

function makeTask() {
  const parsed = parseMaterials(sample.resume, sample.jd);
  return { ...parsed, resumeOriginal: sample.resume, resumeCorrected: sample.resume, jdOriginal: sample.jd, jdCorrected: sample.jd, selected: parsed.experiences.filter(e => e.kind === 'experience').map(e => e.id), facts: [], questions: [], revision: 1, suggestions: [] };
}
test('parser retains complete source spans and separates context', () => {
  const t = makeTask();
  assert.equal(t.experiences.filter(e => e.kind === 'experience').length, 3);
  for (const e of t.experiences) assert.equal(t.resumeOriginal.slice(e.start,e.end),e.sourceText);
  assert.equal(composeText(t), sample.resume);
});
test('JD priority and logical alternatives remain verbatim', () => {
  const { requirements } = parseMaterials('参与项目。', '必须掌握 SQL 或 Python，且能独立沟通。\n有线上 A/B 测试经验者优先。');
  assert.match(requirements[0].logic,/同时/);
  assert.match(requirements[0].text,/必须.*或.*且/);
  assert.equal(requirements[1].strength,'优先／加分');
});
test('generation uses confirmed facts only, bound to one experience', () => {
  const t = makeTask(), [a,b] = t.experiences.filter(e => e.kind === 'experience');
  t.selected = [a.id];
  t.facts = [
    { id:'f1',experienceId:a.id,text:'本人整理了问题清单。',status:'confirmed' },
    { id:'f2',experienceId:a.id,text:'营收增长 900%。',status:'unknown' },
    { id:'f3',experienceId:a.id,text:'主导整个公司。',status:'conflict' },
    { id:'f4',experienceId:b.id,text:'主导线上实验。',status:'confirmed' }
  ];
  const [s] = generateCandidates(t);
  assert.match(s.text,/本人整理了问题清单/);
  assert.doesNotMatch(s.text,/900|主导/);
  assert.deepEqual(s.sourceIds,[a.id,'f1']);
  assert.match(s.text,/参与/); assert.match(s.text,/尚未上线/);
});
test('no guessed tools, roles or numerical outcomes', () => {
  const p = parseMaterials('课程研究\n参与文献调研，整理研究结论。','负责线上 A/B 测试，必须使用 SQL，提高业务转化率 20%。');
  const t = {...p,resumeCorrected:'课程研究\n参与文献调研，整理研究结论。',selected:p.experiences.map(e=>e.id),facts:[],revision:1};
  const [s] = generateCandidates(t);
  assert.doesNotMatch(s.text,/线上|SQL|20|主导|用户访谈/);
  assert.match(s.text,/文献调研/);
});
test('selected candidate replaces only its source; all other text preserved', () => {
  const t = makeTask(), [a,b] = t.experiences.filter(e=>e.kind==='experience');
  t.selected=[a.id]; t.suggestions=generateCandidates(t); t.suggestions[0].status='accepted';
  const result=composeText(t);
  assert.ok(result.includes(b.original));
  assert.ok(result.startsWith(t.experiences[0].original));
  assert.equal(result,sample.resume.replace(a.original,t.suggestions[0].text));
  assert.equal(t.resumeOriginal,sample.resume);
});
test('duplicate paragraphs are replaced by exact span, never replaceAll', () => {
  const resume='项目 A\n参与分析。\n\n项目 A\n参与分析。';
  const parsed=parseMaterials(resume,'分析数据');
  const t={...parsed,resumeCorrected:resume,selected:[parsed.experiences[1].id],facts:[],revision:1};
  t.suggestions=generateCandidates(t); t.suggestions[0].status='edited'; t.suggestions[0].editedText='第二个项目修改稿';
  assert.equal(composeText(t),'项目 A\n参与分析。\n\n第二个项目修改稿');
});
test('pending and rejected suggestions fall back to corrected original', () => {
  const t=makeTask(); t.suggestions=generateCandidates(t);
  t.suggestions[0].text='不应进入成稿';
  assert.equal(composeText(t),sample.resume);
  t.suggestions[0].status='rejected'; assert.equal(composeText(t),sample.resume);
});
test('stale or invalid-source adopted suggestions cannot be confirmed', () => {
  const t=makeTask(); t.suggestions=generateCandidates(t); t.suggestions[0].status='accepted';
  assert.deepEqual(validateFinal(t),[]);
  t.revision=2; assert.ok(validateFinal(t).some(e=>e.includes('旧材料')));
  t.suggestions[0].revision=2; t.suggestions[0].sourceIds.push('missing');
  assert.ok(validateFinal(t).some(e=>e.includes('未确认')));
});
test('known conflict blocks original fallback, including unselected experience', () => {
  const t=makeTask(),exp=t.experiences.find(e=>e.kind==='experience');
  t.selected=[]; t.facts=[{id:'f',experienceId:exp.id,text:'存在职责冲突',status:'conflict'}];
  assert.ok(validateFinal(t).some(e=>e.includes('保留原文')));
  exp.excluded=true; assert.deepEqual(validateFinal(t),[]);
  assert.ok(!composeText(t).includes(exp.original));
});
test('skipped questions are not reissued and batch never exceeds three', () => {
  const t=makeTask(); t.questions=[{id:'q1',experienceId:t.selected[2],status:'skipped'}];
  const output=analyze(t);
  assert.equal(output.questions.filter(q=>q.experienceId===t.selected[2]).length,1);
  assert.ok(output.questions.filter(q=>q.status==='pending').length<=3);
});
test('offline testing never counts as online A/B evidence', () => {
  const t=makeTask(); const output=analyze(t);
  const req=t.requirements.find(r=>/A\/B/.test(r.text));
  const rel=output.associations.find(a=>a.requirementId===req.id);
  assert.equal(rel.status,'相关但不等价');
});
test('body correction composes without changing immutable original', () => {
  const t=makeTask(),e=t.experiences.find(e=>e.kind==='experience');
  e.text=e.text.replace('12 位','10 位');
  assert.ok(composeText(t).includes('10 位'));
  assert.ok(t.resumeOriginal.includes('12 位'));
});
test('regeneration creates distinct candidates without mutating prior edits', () => {
  const t=makeTask();
  const first=generateCandidates(t);
  t.suggestions=first; first[0].status='edited'; first[0].editedText='我的编辑稿';
  const second=generateCandidates(t);
  assert.notEqual(first[0].id,second[0].id);
  assert.equal(first[0].text,second[0].text);
  assert.equal(first[0].editedText,'我的编辑稿');
});
test('reconciliation retains identity after corrections and supplies current source spans', () => {
  const old=parseMaterials(sample.resume,sample.jd).experiences;
  const changed=sample.resume.replace('12 位','10 位');
  const next=parseMaterials(changed,sample.jd).experiences;
  const result=reconcileExperiences(next,old);
  const oldExp=old.find(e=>e.text.includes('12 位'));
  const corrected=result.experiences.find(e=>e.id===oldExp.id);
  assert.match(corrected.text,/10 位/);
  assert.equal(corrected.original,corrected.text);
  assert.equal(changed.slice(corrected.start,corrected.end),corrected.sourceText);
  assert.deepEqual(result.changedIds,[oldExp.id]);
  assert.deepEqual(result.orphanedIds,[]);
  assert.equal(composeText({resumeCorrected:changed,experiences:result.experiences}),changed);
});
test('reconciliation preserves identities across reordering, without index mapping', () => {
  const before='项目甲\n参与数据整理。\n\n项目乙\n制作流程图。';
  const after='项目乙\n制作流程图。\n\n项目甲\n参与数据整理。';
  const previous=parseMaterials(before,'数据整理').experiences;
  const result=reconcileExperiences(parseMaterials(after,'数据整理').experiences,previous);
  assert.equal(result.experiences[0].id,previous[1].id);
  assert.equal(result.experiences[1].id,previous[0].id);
  assert.deepEqual(result.changedIds,[]);assert.deepEqual(result.orphanedIds,[]);
});
test('reconciliation does not transfer facts between ambiguous duplicate titles', () => {
  const previous=parseMaterials('课程项目\n参与数据整理。\n\n课程项目\n参与流程分析。','产品').experiences;
  const next=parseMaterials('课程项目\n参与数据分析与汇报。\n\n课程项目\n参与用户研究。','产品').experiences;
  const result=reconcileExperiences(next,previous);
  assert.deepEqual(result.orphanedIds,previous.map(e=>e.id));
  assert.ok(result.experiences.every(e=>!previous.some(p=>p.id===e.id)));
});
test('reconciliation recognizes edited unit text but still reports material changes', () => {
  const previous=parseMaterials('课程项目\n参与数据整理。','产品').experiences;
  previous[0].text='课程项目\n负责数据整理。';
  const result=reconcileExperiences(parseMaterials(previous[0].text,'产品').experiences,previous);
  assert.equal(result.experiences[0].id,previous[0].id);
  assert.deepEqual(result.changedIds,[previous[0].id]);
});
test('ambiguous identical units never silently resurrect orphan IDs', () => {
  const text='课程项目\n参与数据整理。\n\n课程项目\n参与数据整理。';
  const previous=parseMaterials(text,'产品').experiences;
  const result=reconcileExperiences(parseMaterials(text,'产品').experiences,previous);
  assert.equal(result.orphanedIds.length,2);
  assert.ok(result.experiences.every(e=>!previous.some(p=>p.id===e.id)));
});
test('known fact conflicts detect changed quantities but normalize thousands separators', () => {
  assert.deepEqual(detectFactConflicts('整理 1200 条记录。','整理 1,200 条记录。'),[]);
  assert.ok(detectFactConflicts('整理 12,000 条记录。','整理 1,200 条记录。').some(x=>x.includes('数字')));
  assert.deepEqual(detectFactConflicts('另制作了 6 页说明。','整理 1,200 条记录。'),[]);
  assert.deepEqual(detectFactConflicts('组织 3 人小组，联系 12 人。','联系 12 人，组织 3 人小组。'),[]);
  assert.ok(detectFactConflicts('提升 10 个百分点。','提升 10%。').some(x=>x.includes('百分点')));
});
test('known fact conflicts detect positive claims replacing explicit negatives', () => {
  assert.ok(detectFactConflicts('产品已上线。','项目尚未上线。').some(x=>x.includes('工作状态')));
  assert.deepEqual(detectFactConflicts('完成原型，项目尚未上线。','项目尚未上线。'),[]);
  assert.ok(detectFactConflicts('开展线上 A/B 测试。','未开展线上 A/B 测试。').some(x=>x.includes('工作类型')));
  assert.deepEqual(detectFactConflicts('没有开展线上 A/B 测试。','未开展线上 A/B 测试。'),[]);
});
test('known fact conflicts detect inflated roles and permit already supported leadership', () => {
  assert.ok(detectFactConflicts('主导需求调研。','参与需求调研。').some(x=>x.includes('职责')));
  assert.ok(detectFactConflicts('牵头课程设计。','协助课程设计。').length);
  assert.deepEqual(detectFactConflicts('主导需求调研。','主导需求调研，协助整理数据。'),[]);
  assert.deepEqual(detectFactConflicts('参与调研，未主导项目。','参与调研。'),[]);
});

const anonymizedResume = `匿名示例
邮箱：demo@example.test
教育背景
云岭大学 信息管理 本科 2022.09—2026.06
项目经历
校园预约系统
2025.03—2025.06 项目成员
负责整理 120 条预约反馈，使用 Figma 制作页面原型。
问答质量评测项目
2025.07—2025.09 研究助理
参与离线评测，使用 Python 整理 1,200 条记录，未开展线上 A/B 测试。
实习经历
2026.01—2026.03 岚桥科技有限公司 产品实习生
协助整理需求说明，完成 8 页产品文档。
专业技能
Figma、Python、SQL。`;

function assertExactComposition(text, parsed) {
  for (const unit of parsed.experiences) assert.equal(text.slice(unit.start, unit.end),unit.sourceText);
  assert.equal(composeText({resumeCorrected:text,experiences:parsed.experiences}),text);
  const ordered=parsed.experiences.slice().sort((a,b)=>a.start-b.start);
  let end=0;
  for(const unit of ordered){assert.ok(unit.start>=end);assert.match(text.slice(end,unit.start),/^\s*$/);end=unit.end;}
  assert.match(text.slice(end),/^\s*$/);
}
test('single-newline PDF text finds projects and internship below education',()=>{
  const p=parseMaterials(anonymizedResume,sample.jd);
  const exps=p.experiences.filter(e=>e.kind==='experience');
  assert.equal(exps.length,3);
  assert.ok(exps.some(e=>e.text.includes('校园预约系统')&&e.text.includes('120 条')));
  assert.ok(exps.some(e=>e.text.includes('问答质量评测项目')&&e.text.includes('1,200 条')));
  assert.ok(exps.some(e=>e.text.includes('岚桥科技有限公司')&&e.text.includes('8 页')));
  assertExactComposition(anonymizedResume,p);
});
test('mixed blank and single newlines run the same structural parsing in every block',()=>{
  const text=anonymizedResume.replace('教育背景','\n教育背景').replace('项目经历','\n项目经历').replace('专业技能','\n专业技能');
  const p=parseMaterials(text,sample.jd);
  assert.equal(p.experiences.filter(e=>e.kind==='experience').length,3);
  assertExactComposition(text,p);
});
test('compact PDF paragraph recognizes inline section labels and dated units',()=>{
  const text='匿名示例 demo@example.test 教育背景 云岭大学 信息管理 本科 2022.09—2026.06 项目经历 2025.03—2025.06 校园预约系统 项目成员 负责整理 120 条反馈。 2025.07—2025.09 问答评测项目 研究助理 使用 Python 整理 1,200 条记录。 实习经历 2026.01—2026.03 岚桥科技有限公司 产品实习生 协助整理需求。 专业技能 Figma、Python、SQL。';
  const p=parseMaterials(text,sample.jd);
  assert.equal(p.experiences.filter(e=>e.kind==='experience').length,3);
  assertExactComposition(text,p);
});
test('section titles with spaced characters and CRLF preserve source bytes',()=>{
  const text=anonymizedResume.replace('教育背景','教 育 背 景').replace('项目经历','项 目 经 历').replaceAll('\n','\r\n');
  const p=parseMaterials(text,sample.jd);
  assert.equal(p.experiences.filter(e=>e.kind==='experience').length,3);
  assertExactComposition(text,p);
});
test('ordinary short descriptions do not split into invented experiences',()=>{
  const text='项目经历\n校园服务系统\n2025.01—2025.04 项目成员\n负责项目调研\n使用 Figma 制作原型\n完成项目汇报\n技能\nFigma';
  const p=parseMaterials(text,'原型工具');
  assert.equal(p.experiences.filter(e=>e.kind==='experience').length,1);
  assertExactComposition(text,p);
});
test('explicit project heading can end education when a section label is absent',()=>{
  const text='教育背景\n云岭大学 本科\n2022.09—2026.06\n校园预约系统｜项目成员\n2025.03—2025.06\n负责整理真实反馈。\n专业技能\nPython';
  const p=parseMaterials(text,'需求整理');
  assert.equal(p.experiences.filter(e=>e.kind==='experience').length,1);
  assert.match(p.experiences.find(e=>e.kind==='experience').text,/校园预约系统/);
  assertExactComposition(text,p);
});
test('section words used as title suffixes stay attached to the experience',()=>{
  const text='校园读书会｜社团经历\n2024.09—2025.06 活动成员\n参与策划 4 场活动。';
  const p=parseMaterials(text,'活动策划');
  assert.equal(p.experiences.length,1);assert.match(p.experiences[0].title,/校园读书会/);
  assertExactComposition(text,p);
});
test('section bullets and blank lines within work descriptions do not create phantom units',()=>{
  const text='• 项目实践\n校园系统\n2025.01—2025.03 项目成员\n\n参与数据整理，完成课程报告。\n\n• 使用 Python 整理记录。';
  const p=parseMaterials(text,'数据整理');
  assert.equal(p.experiences.length,1);assert.equal(p.experiences[0].kind,'experience');
  assert.match(p.experiences[0].title,/校园系统/);
  assertExactComposition(text,p);
});
test('format comparison ignores line breaks, whitespace and unambiguous leading bullets',()=>{
  assert.ok(isFormattingOnly('使用 Python 整理 1,200 条记录。\n项目尚未上线。','　• 使用Python整理1,200条记录。\n\n• 项目尚未上线。　'));
  assert.ok(isFormattingOnly('负责数据整理。','- 负责数据整理。'));
  assert.ok(isFormattingOnly('不具备线上经验。','不\n具备线上经验。'));
  assert.equal(normalizeFormatting(' SQL　　Python '),'SQL Python');
});
test('format comparison retains facts, signs, ASCII token boundaries and operators',()=>{
  for (const [before,after] of [['SQL','S Q L'],['A B','AB'],['1 200','1200'],['1 2','12'],['1.2','12'],['12条','21条'],['使用 SQL','使用 Python'],['未上线','已上线'],['不具备','具备'],['A/B','AB'],['10%','10'],['- 20%','20%'],['+ 20%','20%']]) {
    assert.equal(isFormattingOnly(before,after),false,`${before} vs ${after}`);
  }
});
test('format map points every canonical character to its original source range',()=>{
  const raw='\n　• 使用 Python\r\n整理 1,200 条记录。\n- 项目尚未上线。';
  const mapped=normalizeFormattingWithMap(raw);
  assert.equal(mapped.text,normalizeFormatting(raw));
  assert.equal(mapped.starts.length,mapped.text.length);assert.equal(mapped.ends.length,mapped.text.length);
  for(let i=0;i<mapped.text.length;i++) {
    const source=raw.slice(mapped.starts[i],mapped.ends[i]);
    assert.equal(mapped.text[i]===' '?source.trim():source,mapped.text[i]===' '?'':mapped.text[i]);
    if(i)assert.ok(mapped.starts[i]>=mapped.ends[i-1]);
  }
});
test('format-only reconciliation preserves identity and manual kind without changedIds',()=>{
  const old=parseMaterials('个人技能\n使用 Python 整理 120 条数据。','数据').experiences;
  old[0].kind='experience';old[0].kindOverride='experience';
  const next=parseMaterials('个人技能\n\n使用Python整理120条数据。','数据').experiences;
  // The state layer maps old semantic boundaries for whole-document reflow;
  // here use one matching unit to exercise canonical matching independently.
  const unit={...next[0],text:'个人技能\n• 使用Python整理120条数据。',sourceText:'个人技能\n• 使用Python整理120条数据。',original:'个人技能\n• 使用Python整理120条数据。'};
  const result=reconcileExperiences([unit],old);
  assert.equal(result.experiences[0].id,old[0].id);
  assert.equal(result.experiences[0].kind,'experience');assert.equal(result.experiences[0].kindOverride,'experience');
  assert.deepEqual(result.changedIds,[]);assert.deepEqual(result.orphanedIds,[]);
});
test('generous PDF blank lines retain the same section, title, date and body units',()=>{
  const text='陈同学\n求职意向：产品实习生\n教育背景\n示例大学 信息管理 本科 2023.09—2027.06\n项目经历\n校园预约平台｜课程项目\n2025.03—2025.06 产品成员\n参与需求整理，使用 Figma 绘制预约流程与原型，输出课程报告；项目尚未上线。\n模型评测工具｜科研项目\n2025.09—2025.12 研究助理\n使用 Python 整理 1,200 条数据，记录离线评测结果。\n专业技能\nFigma、Python、Excel。';
  const spaced=text.replaceAll('\n','\n\n');
  const compact=parseMaterials(text,sample.jd), generous=parseMaterials(spaced,sample.jd);
  assert.equal(generous.experiences.filter(e=>e.kind==='experience').length,2);
  assert.deepEqual(generous.experiences.map(e=>[e.title,e.kind,normalizeFormatting(e.text)]),compact.experiences.map(e=>[e.title,e.kind,normalizeFormatting(e.text)]));
  assert.ok(!generous.warnings.some(w=>w.includes('只有一行')));
  assertExactComposition(spaced,generous);
  const linked=reconcileExperiences(generous.experiences,compact.experiences);
  assert.deepEqual(linked.changedIds,[]);assert.deepEqual(linked.orphanedIds,[]);
});

for (const newline of ['\n','\r\n','\n\n']) {
  test(`PDF-wrapped AI skill label stays inside its parent section (${JSON.stringify(newline)})`,()=>{
    const skills=['技能与优势','• AI','技能：熟练使用 Claude Code、Codex 完成需求分析与原型搭建。','• 技术基础：使用 Python 整理数据。','• 数据分析：熟悉 SQL，完成数据清洗与可视化。','• 英语水平：英语六级，能够阅读英文资料。'].join(newline);
    const text=['项目经历','校园预约平台｜课程项目','2025.03—2025.06 产品成员','参与需求整理，输出课程报告。',skills,'教育背景','示例大学 本科'].join(newline);
    const parsed=parseMaterials(text,'需要具备数据分析能力。');
    const skillUnits=parsed.experiences.filter(e=>/技能/.test(e.sectionTitle||''));
    assert.equal(skillUnits.length,1,'a wrapped inline label must not create another section');
    assert.equal(skillUnits[0].sectionTitle,'技能与优势');
    assert.equal(skillUnits[0].kind,'context');
    assert.equal(skillUnits[0].text,skills);
    assert.equal(parsed.experiences.filter(e=>e.kind==='experience').length,1);
    assert.ok(parsed.experiences.some(e=>e.sectionTitle==='教育背景'));
    assertExactComposition(text,parsed);
  });
}

test('inline skill subheadings stay grouped, but standalone following sections stay separate',()=>{
  const skills='技能与优势\n专业技能：熟悉 Python 和 SQL。\n• 技能：能够整理数据。\n语言：英语六级。\n证书：数据分析结业证书。';
  const text=skills+'\n证书\n资格考试证书。\n实习经历\n2025.06—2025.09 示例科技有限公司 产品实习生\n协助整理反馈。';
  const parsed=parseMaterials(text,'数据分析');
  assert.equal(parsed.experiences.length,3);
  assert.equal(parsed.experiences[0].text,skills);
  assert.equal(parsed.experiences[1].sectionTitle,'证书');
  assert.equal(parsed.experiences[2].kind,'experience');
  assertExactComposition(text,parsed);
});

test('a skills heading with an inline description still starts a section after project work',()=>{
  const text='项目经历\n2025.03—2025.06 校园预约平台 项目成员\n负责整理需求。\n技能：熟悉 Python、SQL。';
  const parsed=parseMaterials(text,'数据分析');
  assert.equal(parsed.experiences.length,2);
  assert.equal(parsed.experiences[0].kind,'experience');
  assert.equal(parsed.experiences[1].sectionTitle,'技能');
  assertExactComposition(text,parsed);
});
