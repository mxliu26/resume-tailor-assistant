import assert from 'node:assert/strict';
import path from 'node:path';
import {startQa} from './runtime.mjs';
const qa=await startQa('comparison-navigation',{viewport:{width:1920,height:900}});
const {page,context,errors,output,url}=qa;
const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('youju.resume.v1')));
const current=async()=>(await state()).tasks[0];
const resume=`林同学
求职意向：产品实习生
邮箱：demo@example.test
教育背景
海川大学 本科 2022.09—2026.06
项目经历
园林分析项目｜队长
2025.03—2025.06
参与数据分析，与团队完成可视化分析和报告交付。
校园预约工具｜产品设计
2025.07—2025.09
整理需求记录，使用 Figma 设计预约流程。
阅读管理工具｜开发成员
2025.10—2025.12
开发阅读记录功能，整理用户反馈。
技能与优势
使用 Python 和 SQL 整理数据，英语六级。`;
const jd=`岗位职责：
支持日常数据分析，核对统计口径，协助编写需求文档，跟进相关问题处理。
具备较强的沟通与文档表达能力，能够整理讨论记录并协助完成团队交付。
使用 SQL 或 Python 完成数据整理，检查字段含义与数据来源。
任职要求：
本科及以上，在校期间能够持续参加实习。
有地图、导航、LBS 或人工智能行业实习经验优先。`;
const active=()=>page.locator('.requirement-reference-card[aria-current="location"]');
async function settleScroll() {
  await page.evaluate(()=>new Promise(resolve=>{
    let previous=scrollY,stable=0;
    const frame=()=>{stable=Math.abs(scrollY-previous)<1?stable+1:0;previous=scrollY;if(stable>=3)resolve();else requestAnimationFrame(frame);};
    requestAnimationFrame(frame);
  }));
}
async function readSection(id) {
  await page.mouse.move(700,400);await page.mouse.wheel(0,1);
  await settleScroll();
  const y=await page.locator('#'+id).evaluate(el=>{
    const header=document.querySelector('.work-navigation');
    scrollTo({top:scrollY+el.getBoundingClientRect().top-header.getBoundingClientRect().height-20,behavior:'instant'});
    return scrollY;
  });
  await page.waitForFunction(id=>document.querySelector('.requirement-reference-card[aria-current="location"]')?.dataset.target===id,id);
  assert.equal(await active().count(),1);
  const after=await page.evaluate(()=>scrollY);
  assert.ok(Math.abs(after-y)<2,'revealing the reference must not move the main document: '+y+' → '+after);
  const position=await active().evaluate(el=>{
    const item=el.getBoundingClientRect(),side=el.closest('.comparison-sidebar').getBoundingClientRect();
    const other=document.querySelector('.requirement-reference-card:not(.is-current) .nav-requirement-text');
    const current=getComputedStyle(el.querySelector('.nav-requirement-text')),inactive=getComputedStyle(other);
    return {top:item.top,bottom:item.bottom,sideTop:side.top,sideBottom:side.bottom,bold:current.fontWeight,otherBold:inactive.fontWeight,color:current.color,otherColor:inactive.color,highlighted:el.classList.contains('is-current')};
  });
  assert.ok(position.top>=position.sideTop&&position.bottom<=position.sideBottom,'active requirement should be fully visible in the sidebar');
  assert.equal(position.highlighted,true);
  assert.ok(Number(position.bold)>Number(position.otherBold),'current typography emphasizes the active requirement');
  assert.notEqual(position.color,position.otherColor,'current text color differentiates the active requirement');
}
try {
  await page.goto(url);
  await page.locator('[name=resume]').fill(resume);await page.locator('[name=jd]').fill(jd);
  await page.locator('[data-action=create]').click();
  await page.locator('#parse-confirm').check();await page.locator('[data-action=confirm-parse]').click();
  await page.locator('.comparison-layout').waitFor();
  const task=await current(),ids=task.requirements.map(r=>'requirement-'+r.id);
  assert.equal(ids.length,5);
  for(const id of ids)await readSection(id);
  assert.ok(await page.locator('.comparison-sidebar').evaluate(el=>el.scrollTop)>0,'later requirements must auto-scroll the sidebar');
  await page.screenshot({path:path.join(output,'scroll-linked-reference.png')});
  // Reverse scrolling, editing rerenders and a sidebar jump must all keep the
  // highlighted reference tied to the correct main section.
  await readSection(ids[2]);
  await page.locator('[data-action=save]').click();
  await page.waitForFunction(id=>document.querySelector('[aria-current="location"]')?.dataset.target===id,ids[2]);
  await readSection(ids[0]);
  await page.locator('.requirement-reference-card[data-target="'+ids[4]+'"]').click();
  await page.waitForFunction(id=>{const el=document.getElementById(id);return Math.abs(el.getBoundingClientRect().top-parseFloat(getComputedStyle(el).scrollMarginTop))<2;},ids[4]);
  assert.equal(await active().getAttribute('data-target'),ids[4]);
  await readSection(ids[1]);

  await page.locator('.sidebar-shortcuts [data-target="rewrite-plan"]').click();
  await page.waitForFunction(()=>document.getElementById('rewrite-plan').getBoundingClientRect().top<innerHeight/2);
  await settleScroll();
  assert.equal(await active().count(),0,'summary sections must not leave a misleading active requirement');
  const planHeight=(await page.locator('#rewrite-plan').boundingBox()).height;
  assert.ok(planHeight<650,'five collapsed checklist items should fit a compact desktop panel');
  assert.equal(await page.locator('.plan-details[open]').count(),0);
  await page.screenshot({path:path.join(output,'compact-rewrite-checklist.png')});
  await page.locator('.plan-details>summary').first().click();
  assert.equal(await page.locator('.plan-details[open] .original').isVisible(),true);
  const checkbox=page.locator('.plan-card input').first(),before=await current();
  const expId=await checkbox.getAttribute('data-select'),wasSelected=await checkbox.isChecked();
  await checkbox.setChecked(!wasSelected);
  assert.equal((await current()).selected.includes(expId),!wasSelected);
  assert.equal((await current()).selected.length,before.selected.length+(wasSelected?-1:1));
  assert.equal(await page.locator('.plan-details[open]').count(),1,'choice changes preserve expanded details');
  await page.locator('.plan-details>summary').first().click();

  await page.setViewportSize({width:390,height:844});
  await page.locator('#'+ids.at(-1)).evaluate(el=>el.scrollIntoView({block:'start'}));
  await page.mouse.move(180,350);await page.mouse.wheel(0,1);
  await page.waitForFunction(id=>document.querySelector('[aria-current="location"]')?.dataset.target===id,ids.at(-1));
  assert.ok(await page.locator('.requirement-nav').evaluate(el=>el.scrollLeft)>0,'compact reference strip follows the current requirement horizontally');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.locator('#rewrite-plan').evaluate(el=>el.scrollIntoView({block:'start'}));
  await page.screenshot({path:path.join(output,'compact-checklist-mobile.png')});
  await page.locator('[data-action=back-parse]').click();
  await page.locator('#review-resume-card').waitFor();
  await page.evaluate(()=>scrollBy(0,400));
  assert.deepEqual(errors,[]);
  await qa.pass(["主栏滚动与侧栏定位","反向导航与保存重绘","改写清单选择与展开","移动端横向导航"]);
  console.log('comparison-navigation: passed');
} catch(error){qa.error(error);
  await page.screenshot({path:path.join(output,'navigation-failure.png'),fullPage:true});throw error;
} finally{await qa.close();}
