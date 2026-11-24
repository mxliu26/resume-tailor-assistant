import assert from 'node:assert/strict';
import path from 'node:path';
import {startQa} from './runtime.mjs';
const qa=await startQa('comparison-feedback',{viewport:{width:1920,height:1000}});
const {page,context,errors,output,url}=qa;
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('youju.resume.v1')));
const current=async()=>(await state()).tasks[0];
const resume=`林同学
求职意向：产品实习生
邮箱：demo@example.test
教育背景
海川大学 本科
项目经历
园林分析项目｜队长
2025.03—2025.06
与团队完成模型构建、可视化分析及论文交付。
${Array.from({length:12},()=> '• 团队协作：参与整理讨论记录，核对成员反馈，协助完善项目报告；围绕资料口径、分析流程和交付安排进行协作，保留本人实际职责与原始依据。').join('\n')}
校园工具项目｜开发成员
2025.07—2025.09
独立完成工具开发，整理需求文档。
技能与优势
• AI
技能：熟悉 Python，使用工具整理需求。
• 数据分析：熟悉 SQL。`;
const jd=`岗位职责：
支持数据分析，参与需求整理，协助编写需求文档。
具备较强的沟通与文档表达能力。
任职要求：
本科及以上。
有地图行业实习经验优先。`;
try{
  await page.goto(url);
  await page.locator('[name=resume]').fill(resume);
  await page.locator('[name=jd]').fill(jd);
  await page.locator('[data-action=create]').click();
  await page.locator('#review-resume-card').waitFor();
  assert.equal(await page.locator('.context-summary-label').filter({hasText:'技能与优势'}).count(),1);
  assert.equal(await page.locator('.review-requirement-card .taglist').count(),0);
  await page.locator('[data-action=confirm-parse]').click();
  assert.equal(await page.locator('.field-error').count(),1);
  assert.equal(await page.locator('.floating-error').count(),0);
  assert.equal(await page.getByRole('alert').count(),1);
  await page.screenshot({path:path.join(output,'review-single-error.png')});
  await page.locator('#parse-confirm').check();
  assert.equal(await page.getByRole('alert').count(),0);
  await page.locator('[data-action=confirm-parse]').click();
  await page.locator('.comparison-layout').waitFor();

  let task=await current();
  const requirement=task.requirements.find(r=>r.text.includes('较强的沟通'));
  const garden=task.experiences.find(e=>e.text.includes('园林分析项目'));
  const solo=task.experiences.find(e=>e.text.includes('校园工具项目'));
  const skills=task.experiences.find(e=>e.sectionTitle==='技能与优势');
  assert.equal(task.associations.find(a=>a.requirementId===requirement.id).experienceId,garden.id);
  const card=page.locator('#requirement-'+requirement.id);
  await page.locator(`.requirement-reference-card[data-target="requirement-${requirement.id}"]`).click();
  await page.waitForFunction(id=>{const top=document.getElementById(id).getBoundingClientRect().top;return top>0&&top<innerHeight/2;},'requirement-'+requirement.id);
  const navText=await page.locator('.requirement-nav').innerText();
  for(const r of task.requirements)assert.ok(navText.includes(r.text));
  assert.equal(await card.locator('.judgment-head strong').innerText(),'判断建议');
  assert.equal(await card.locator('.judgment-status').innerText(),'表达不足');
  assert.equal(await page.locator('.question-head .smalltext').count(),0);
  await card.locator('.association-editor>summary').click();
  await card.locator(`[data-assoc-add][data-unit="${skills.id}"]`).check();
  await card.locator(`[data-assoc-add][data-unit="${solo.id}"]`).check();
  assert.equal(await card.locator('.evidence-extra').count(),2);
  assert.equal(await card.locator('.evidence-extra[open]').count(),0);
  assert.equal(await card.locator('.evidence-primary blockquote').isVisible(),true);
  assert.equal(await card.locator('.requirement-pane').count(),0);
  assert.equal(await page.locator('.requirement-reference-card').count(),task.requirements.length);
  const mainWidth=await card.boundingBox(),evidenceWidth=await card.locator('.evidence-panel').boundingBox();
  assert.ok(evidenceWidth.width>mainWidth.width*0.9,'the evidence pane should fill the main column');
  await card.locator('.evidence-extra>summary').first().click();
  assert.equal(await card.locator('.evidence-extra[open] blockquote').isVisible(),true);
  await card.locator('.evidence-extra>summary').first().click();
  await card.evaluate(el=>el.scrollIntoView({block:'start'}));
  await page.screenshot({path:path.join(output,'comparison-compact-evidence.png')});

  task=await current();
  let q=task.questions.find(q=>q.requirementId===requirement.id&&q.experienceId===garden.id&&q.status==='pending');
  if(!q){await card.locator('[data-action=regenerate-questions]').click();task=await current();q=task.questions.find(q=>q.requirementId===requirement.id&&q.experienceId===garden.id&&q.status==='pending');}
  assert.ok(q);
  const question=page.locator('#question-'+q.id),answer='我组织团队讨论，整理分工记录并撰写项目报告。';
  await question.locator('[data-answer]').fill(answer);
  await question.locator('[data-action=answer]').click();
  const fact=(await current()).facts.find(f=>f.questionId===q.id);
  assert.equal(fact.text,answer);
  await card.locator('[data-assoc]').selectOption(solo.id);
  await card.locator('[data-action=regenerate-questions]').click();
  task=await current();
  assert.equal(task.associations.find(a=>a.requirementId===requirement.id).experienceId,solo.id);
  assert.equal(task.questions.find(x=>x.id===q.id).status,'archived');
  assert.equal(task.questions.find(x=>x.id===q.id).answer,answer);
  assert.deepEqual(task.facts.find(f=>f.id===fact.id),fact);
  assert.ok(task.questions.some(x=>x.requirementId===requirement.id&&x.experienceId===solo.id&&x.status==='pending'));
  await page.locator('.comparison-intro [data-action=regenerate-questions]').click();
  assert.deepEqual((await current()).facts.find(f=>f.id===fact.id),fact);
  await page.reload();
  await page.locator('[data-view=tasks]').click();
  await page.locator('[data-action=open]').first().click();
  assert.equal((await current()).questions.find(x=>x.id===q.id).answer,answer);
  await page.locator(`[data-fact-check="${fact.id}"]`).check();
  await page.locator(`[data-action=confirm-fact][data-id="${fact.id}"]`).click();
  assert.equal((await current()).facts.find(f=>f.id===fact.id).experienceId,garden.id);
  await page.locator('[data-action=generate]').click();
  await page.locator('[data-action=preview]').waitFor();
  const suggestion=(await current()).suggestions.find(s=>s.experienceId===garden.id);
  const editor=page.locator(`[data-suggestion="${suggestion.id}"]`);
  const rewrite=page.locator('.suggestion').filter({has:editor});
  const accept=rewrite.locator('[data-action=accept]');
  await rewrite.evaluate(el=>el.scrollIntoView({block:'start'}));
  let originalRect=await rewrite.locator('.original').first().boundingBox(),editRect=await editor.boundingBox();
  assert.ok(originalRect.height>400,'the fixture must exercise a long original');
  assert.ok(Math.abs(editRect.y-originalRect.y)<2);
  assert.ok(Math.abs(editRect.height-originalRect.height)<2,'the editable suggestion should match the original height');
  await accept.click();
  assert.equal(await accept.isDisabled(),true);assert.match(await accept.innerText(),/✓/);
  assert.match(await accept.getAttribute('class'),/accepted-button/);
  await page.reload();await page.locator('[data-view=tasks]').click();await page.locator('[data-action=open]').first().click();
  assert.equal(await accept.isDisabled(),true,'acceptance check must survive reload');
  const editText=await editor.inputValue();await editor.fill(editText+'\n');
  assert.equal(await accept.isDisabled(),false);
  assert.doesNotMatch(await accept.getAttribute('class'),/accepted-button/);
  assert.equal(await rewrite.locator('[data-suggestion-status]').innerText(),'待确认');
  await accept.click();await page.locator('#edit-confirm').check();await page.locator('[data-action=apply-edit]').click();
  assert.equal(await accept.isDisabled(),true);assert.match(await accept.innerText(),/已采用编辑稿/);
  await rewrite.locator('[data-action=reject]').click();assert.equal(await accept.isDisabled(),false);
  await accept.click();await rewrite.locator('[data-action=keep]').click();assert.equal(await accept.isDisabled(),false);
  await accept.click();
  await rewrite.evaluate(el=>el.scrollIntoView({block:'start'}));
  await rewrite.screenshot({path:path.join(output,'rewrite-aligned-accepted.png')});
  await page.locator('[data-action=preview]').click();
  await page.locator('#final-text').waitFor();
  assert.ok((await page.locator('#final-text').innerText()).includes('技能与优势'));
  await page.locator('[data-action=step][data-step="2"]').click();
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.locator('.comparison-sidebar>.card').first().isVisible(),true,'requirements must remain accessible on mobile');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:path.join(output,'comparison-mobile.png')});
  assert.deepEqual(errors,[]);
  await qa.pass(["校对确认门槛","关联调整与答案/事实保留","长文编辑对齐","采用/编辑/拒绝/保留状态","移动端布局"]);
  console.log('comparison-feedback: passed');
}catch(error){qa.error(error);await page.screenshot({path:path.join(output,'failure.png'),fullPage:true});throw error;}
finally{await qa.close();}
