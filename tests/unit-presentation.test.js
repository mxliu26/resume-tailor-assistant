import test from 'node:test';
import assert from 'node:assert/strict';
import {unitPresentation} from '../public/unit-presentation.js';
import {renderReview} from '../public/review-view.js';
import {parseMaterials} from '../public/domain.js';

test('long skill prose becomes a short semantic label without mutating materials',()=>{
  const unit={id:'skill',kind:'context',title:'数据分析：熟悉 SQL、Python，能够完成数据清洗与可视化，使用 Excel 整理业务问题。',text:'数据分析：熟悉 SQL、Python，能够完成数据清洗与可视化，使用 Excel 整理业务问题。'};
  const before=structuredClone(unit),display=unitPresentation(unit);
  assert.equal(display.title,'数据分析');assert.doesNotMatch(display.preview,/^数据分析/);
  assert.deepEqual(unit,before);
  assert.equal(unitPresentation({kind:'context',title:'熟练使用 Figma、Excel 和 Python 处理项目资料。',text:'熟练使用 Figma、Excel 和 Python 处理项目资料。'}).title,'专业技能');
});

test('project dates, role and URL stay out of the semantic title',()=>{
  const display=unitPresentation({kind:'experience',title:'2025.09—2025.12 校园预约优化｜产品方向成员 https://example.test/project',text:'2025.09—2025.12 校园预约优化｜产品方向成员 https://example.test/project\n参与需求整理，绘制流程图。'});
  assert.equal(display.title,'校园预约优化');assert.match(display.meta,/2025.09—2025.12/);assert.match(display.meta,/产品方向成员/);
  assert.doesNotMatch(display.title,/https|2025|参与/);assert.equal(display.preview,'参与需求整理，绘制流程图。');
});

test('generic section heading uses the real project heading and keeps body in preview',()=>{
  const display=unitPresentation({kind:'experience',title:'项目经历',text:'项目经历\n校园阅读平台｜课程项目\n2024.03—2024.06\n负责整理报名资料。'});
  assert.equal(display.title,'校园阅读平台');assert.match(display.meta,/课程项目/);assert.match(display.preview,/负责整理报名资料/);assert.doesNotMatch(display.preview,/校园阅读平台/);
});

test('missing or narrative headings have concise fallbacks; long names are bounded',()=>{
  assert.equal(unitPresentation({kind:'experience',title:'负责整理项目材料，完成研究汇报。',text:'负责整理项目材料，完成研究汇报。'}).title,'科研经历');
  const display=unitPresentation({kind:'experience',title:'校园服务流程与多校区预约资源配置协同优化课程研究项目名称较长但完整材料保留',text:'完整材料'});
  assert.ok([...display.title].length<=28);assert.ok(display.title.endsWith('…'));
  assert.equal(unitPresentation().title,'项目经历');
  assert.equal(unitPresentation({kind:'experience',title:'课程研究',text:'课程研究\n参与整理 2024 条测试数据。'}).meta,'');
});

test('context review renders one short heading and preserves complete editable text',()=>{
  const resume='专业技能：熟悉 SQL 和 Python，能够处理课程数据并整理可视化报告。',jd='需要具备数据整理能力。';
  const parsed=parseMaterials(resume,jd),task={...parsed,resumeOriginal:resume,resumeCorrected:resume,jdOriginal:jd,jdCorrected:jd,selected:[],suggestions:[],facts:[],associations:[],questions:[],maxStep:2,revision:1};
  task.experiences[0].kind='context';
  const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;');
  const html=renderReview(task,{esc,btn:(text,action)=>`<button data-action="${action}">${text}</button>`,badge:text=>`<span>${text}</span>`,config:{maxTextLength:30000}});
  assert.match(html,/<span class="context-summary-label">专业技能<\/span>/);
  assert.doesNotMatch(html,/<h3>专业技能/);
  assert.match(html,/<textarea[^>]+data-exp=[^>]+>专业技能：熟悉 SQL 和 Python，能够处理课程数据并整理可视化报告。<\/textarea>/);
});

test('wrapped skills render as a single editable section with the original heading',()=>{
  const resume='技能与优势\n• AI\n技能：熟悉 Python，能够处理课程数据。\n• 数据分析：使用 SQL 完成数据清洗。',jd='熟悉 Python';
  const parsed=parseMaterials(resume,jd),task={...parsed,resumeOriginal:resume,resumeCorrected:resume,jdOriginal:jd,jdCorrected:jd,selected:[],suggestions:[],facts:[],associations:[],questions:[],maxStep:1,revision:1};
  const html=renderReview(task,{esc:value=>String(value??''),btn:()=>'',badge:()=>'',config:{maxTextLength:30000}});
  assert.equal((html.match(/class="context-summary-label"/g)||[]).length,1);
  assert.equal((html.match(/aria-label="校对技能与优势"/g)||[]).length,1);
  assert.match(html,/<span class="context-summary-label">技能与优势<\/span>/);
  assert.ok(html.includes(resume+'</textarea>'));
});
