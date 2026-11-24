import assert from 'node:assert/strict';
import path from 'node:path';
import {startQa} from './runtime.mjs';
import {parseMaterials,analyze,generateCandidates} from '../public/domain.js';
const qa=await startQa('rewrite-feedback',{});
const {page,context,errors,output,url}=qa;
const resume=`测试同学
项目经历
园林调研项目｜队长
2025.03—2025.06
${Array.from({length:7},()=> '• 项目工作：参与团队调研，整理访谈记录并核对反馈，协助完善项目报告；保留本人实际职责、采用的方法及原始资料。').join('\n')}
校园调研项目｜成员
2025.07—2025.09
参与访谈记录整理，使用工具完成反馈汇总。`;
const jd='岗位职责：\n参与用户调研、整理需求文档并与团队沟通。';
const parsed=parseMaterials(resume,jd),units=parsed.experiences.filter(e=>e.kind==='experience');
assert.equal(units.length,2);
const [first,second]=units;
const fixture={id:'rewrite-qa',name:'改写反馈检查',role:'产品实习生',resumeOriginal:resume,resumeCorrected:resume,jdOriginal:jd,jdCorrected:jd,...parsed,parseWarnings:[],selected:units.map(e=>e.id),suggestions:[],facts:[],questions:[],associations:[],revision:1,step:3,maxStep:3,reviewNeedsConfirmation:false,createdAt:new Date().toISOString()};
Object.assign(fixture,analyze(fixture));
const requirement=fixture.requirements[0];
fixture.associations=[{requirementId:requirement.id,experienceId:first.id,experienceIds:units.map(e=>e.id),status:'表达不足',manual:true,manualStatus:true,needsClarification:true,links:units.map(e=>({requirementId:requirement.id,experienceId:e.id,evidence:e.text,status:'表达不足',manual:true,manualStatus:true,needsClarification:true}))}];
Object.assign(fixture,analyze(fixture));
fixture.suggestions=generateCandidates(fixture);
const suggestion=fixture.suggestions.find(s=>s.experienceId===first.id);
suggestion.text=first.text.replace('参与团队调研','参与团队调研与记录复核');
const generated=suggestion.text;
const initial={tasks:[fixture],bases:[],versions:[],facts:[],logs:[],testConsent:false,createInput:{}};
const current=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('youju.resume.v1')).tasks[0]);
const open=async()=>{await page.locator('[data-view=tasks]').click();await page.locator('[data-action=open]').first().click();};
const backRewrite=async()=>{await page.locator('[data-action=step][data-step="3"]').click();await page.locator('[data-action=preview]').waitFor();};
try{
  await page.goto(url);
  await page.evaluate(value=>localStorage.setItem('youju.resume.v1',JSON.stringify(value)),initial);
  await page.reload();await open();
  const editor=page.locator(`[data-suggestion="${suggestion.id}"]`);
  const card=page.locator('.suggestion').filter({has:editor});
  const marks=card.locator('.rewrite-highlights');
  const firstButton=page.locator(`[data-action=supplement-experience][data-id="${first.id}"]`);
  const secondButton=page.locator(`[data-action=supplement-experience][data-id="${second.id}"]`);
  assert.equal(await marks.locator('.rewrite-suggested').innerText(),'与记录复核');
  assert.equal(await marks.locator('.rewrite-manual').count(),0);
  const before=await card.locator('.original').boundingBox(),after=await editor.boundingBox();
  assert.ok(Math.abs(before.y-after.y)<2&&Math.abs(before.height-after.height)<2,'original and editable draft remain aligned');

  const manual='我负责：'+generated;
  await editor.fill(manual);
  assert.equal(await marks.locator('.rewrite-manual').innerText(),'我负责：');
  assert.equal(await marks.locator('.rewrite-suggested').innerText(),'与记录复核');
  await editor.press('Control+End');await page.keyboard.insertText('人工新增✅');
  assert.ok((await editor.inputValue()).endsWith('人工新增✅'));
  await editor.press('Control+z');
  assert.equal(await editor.inputValue(),manual,'highlight refresh must preserve native undo');
  const selection=await editor.evaluate(el=>({start:el.selectionStart,end:el.selectionEnd}));
  assert.equal(selection.start,manual.length);assert.equal(selection.end,manual.length);
  await editor.evaluate(el=>{
    el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));
    el.value+='中文输入';el.setSelectionRange(el.value.length,el.value.length);
    el.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));
  });
  assert.ok(!(await marks.textContent()).includes('中文输入'),'do not disturb an ongoing composition');
  await editor.evaluate(el=>el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true})));
  assert.ok((await marks.textContent()).includes('中文输入'));
  assert.equal(await editor.evaluate(el=>el.selectionStart),manual.length+4);

  // A long manual addition must scroll the colors with the editable text.
  await editor.fill(manual+'\n'+('人工新增记录，用于核对滚动位置。\n'.repeat(50)));
  await editor.evaluate(el=>{el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event('scroll'));});
  const metrics=await editor.evaluate(el=>{const viewport=el.parentElement.querySelector('.rewrite-highlight-viewport'),mirror=el.parentElement.querySelector('.rewrite-highlights'),style=getComputedStyle(el),other=getComputedStyle(mirror);return {scroll:el.scrollTop,mirrorScroll:viewport.scrollTop,width:el.clientWidth,mirrorWidth:viewport.clientWidth,height:el.clientHeight,mirrorHeight:viewport.clientHeight,font:style.font,mirrorFont:other.font,padding:style.padding,mirrorPadding:other.padding};});
  assert.ok(metrics.scroll>100);assert.ok(Math.abs(metrics.scroll-metrics.mirrorScroll)<2);
  assert.equal(metrics.width,metrics.mirrorWidth);assert.equal(metrics.height,metrics.mirrorHeight);
  assert.equal(metrics.font,metrics.mirrorFont);assert.equal(metrics.padding,metrics.mirrorPadding);
  await editor.fill(generated.replace('记录复核',''));
  assert.equal(await card.locator('.rewrite-deletions').isVisible(),true);
  await card.locator('.rewrite-deletions>summary').click();
  assert.ok((await card.locator('.rewrite-deletion-content').innerText()).includes('记录复核'));
  await editor.fill(manual);
  await page.locator('.work-navigation [data-action=save]').click();
  await page.reload();await open();
  assert.equal(await editor.inputValue(),manual);
  assert.equal((await current()).suggestions.find(s=>s.id===suggestion.id).text,generated,'the generated baseline must stay immutable');
  assert.equal(await marks.locator('.rewrite-manual').innerText(),'我负责：');
  assert.equal(await marks.locator('.rewrite-suggested').innerText(),'与记录复核');
  await card.evaluate(el=>el.scrollIntoView({block:'start'}));
  await page.screenshot({path:path.join(output,'rewrite-two-color-editor.png')});
  await page.setViewportSize({width:390,height:844});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.equal(await editor.isVisible(),true);
  await editor.evaluate(el=>el.scrollIntoView({block:'center'}));
  await page.screenshot({path:path.join(output,'rewrite-two-color-mobile.png')});
  await page.setViewportSize({width:1920,height:1080});

  // Navigation saves the current edit and focuses the matching question.
  await editor.fill(manual+'\n补充措辞');
  await firstButton.click();
  let task=await current();assert.equal(task.step,2);
  let q=task.questions.find(q=>q.experienceId===first.id&&q.status==='pending');assert.ok(q);
  const answer=page.locator(`[data-answer="${q.id}"]`);
  assert.equal(await answer.evaluate(el=>el===document.activeElement),true);
  assert.ok((await answer.boundingBox()).y>0);
  assert.equal(task.suggestions.find(s=>s.id===suggestion.id).editedText,manual+'\n补充措辞');
  // Exercise the no-open-question fallback without deleting previous answers.
  for(const question of task.questions.filter(q=>q.experienceId===second.id&&q.status==='pending'))await page.locator(`[data-action=q-skip][data-id="${question.id}"]`).click();
  await page.locator('.add-fact-panel>summary').click();
  await page.locator('#extra-exp').selectOption(first.id);
  await page.locator('#extra-fact').fill('第一段暂存事实，尚未提交。');
  await backRewrite();await secondButton.click();
  assert.equal(await page.locator('.add-fact-panel').getAttribute('open'),'');
  assert.equal(await page.locator('#extra-exp').inputValue(),second.id);
  assert.equal(await page.locator('#extra-fact').inputValue(),'','another section draft must not be reassigned');
  assert.equal(await page.locator('#extra-fact').evaluate(el=>el===document.activeElement),true);
  await page.locator('#extra-fact').fill('第二段暂存事实。');
  await page.locator('#extra-exp').selectOption(first.id);
  assert.equal(await page.locator('#extra-fact').inputValue(),'第一段暂存事实，尚未提交。');
  await page.locator('#extra-exp').selectOption(second.id);
  assert.equal(await page.locator('#extra-fact').inputValue(),'第二段暂存事实。');
  await page.locator('[data-action=extra-fact]').click();
  const fact=(await current()).facts.find(f=>f.experienceId===second.id&&f.text==='第二段暂存事实。');assert.ok(fact);
  await page.locator('#extra-exp').selectOption(first.id);
  await page.locator('#extra-exp').selectOption(second.id);
  assert.equal(await page.locator('#extra-fact').inputValue(),'','a submitted fact should not reappear as an unfinished draft');
  await backRewrite();await secondButton.click();
  assert.equal(await page.locator(`[data-fact-check="${fact.id}"]`).evaluate(el=>el===document.activeElement),true,'pending facts should be brought into view for confirmation');
  await page.screenshot({path:path.join(output,'rewrite-supplement-target.png')});
  await backRewrite();
  const retained=await editor.inputValue();
  await card.locator('[data-action=regenerate]').click();
  await card.locator('[data-action=use-candidate]').waitFor();
  assert.equal(await editor.inputValue(),retained,'generation must not overwrite manual edits');
  assert.ok(await marks.locator('.rewrite-manual').count());
  const candidate=(await current()).suggestions.find(s=>s.id===suggestion.id).pendingCandidate;
  page.once('dialog',dialog=>dialog.accept());
  await card.locator('[data-action=use-candidate]').click();
  assert.equal(await editor.inputValue(),candidate.text);
  assert.equal(await marks.locator('.rewrite-manual').count(),0,'adopting a new candidate establishes a fresh generated baseline');
  assert.deepEqual(errors,[]);
  await qa.pass(["差异高亮与文本编辑","撤销与中文组合输入","编辑稿持久化","补问/事实定位与分经历草稿","新候选不覆盖当前稿"]);
  console.log('rewrite-feedback: passed');
}catch(error){qa.error(error);await page.screenshot({path:path.join(output,'rewrite-feedback-failure.png'),fullPage:true});throw error;}
finally{await qa.close();}
