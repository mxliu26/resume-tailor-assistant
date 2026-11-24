import assert from 'node:assert/strict';
import path from 'node:path';
import {startQa} from './runtime.mjs';
import http from 'node:http';
import {once} from 'node:events';
import {readFile,writeFile} from 'node:fs/promises';
import {parseMaterials} from '../public/domain.js';
const fixture=JSON.parse(await readFile(new URL('./fixtures/materials.json',import.meta.url),'utf8'));
let invalid=true,calls=0;const stages=[];
const upstream=http.createServer(async(req,res)=>{
  const chunks=[];for await(const c of req)chunks.push(c);
  const request=JSON.parse(Buffer.concat(chunks)),input=JSON.parse(request.messages[1].content);calls++;
  let output;
  if(input.resumeLines){
    stages.push('parse');const resume=input.resumeLines.map(l=>l.text).join('\n'),jd=input.jdLines.map(l=>l.text).join('\n'),parsed=parseMaterials(resume,jd);
    output={units:parsed.experiences.map(e=>({startLine:resume.slice(0,e.start).split('\n').length,endLine:resume.slice(0,e.end).split('\n').length,kind:e.kind})),requirements:parsed.requirements.map(r=>({line:input.jdLines.find(l=>l.text===r.text).line,category:r.category})),ignoredJdLines:input.jdLines.filter(l=>!parsed.requirements.some(r=>r.text===l.text)).map(l=>l.line)};
  }else if(input.sources){
    stages.push('analyze');const exp=input.experiences.find(e=>e.title.includes('项目')),source=input.sources.find(s=>s.id===exp.id);
    const associations=input.requirements.map(r=>({requirementId:r.id,experienceId:r.category==='明确条件'?'':exp.id,status:r.category==='明确条件'?'待确认':'表达不足',reason:'需确认本人职责与方法',evidence:r.category==='明确条件'?[]:[{sourceId:source.id,quote:source.text}]}));
    output={associations,questions:associations.filter(a=>a.experienceId&&!input.resolvedQuestions.some(q=>q.requirementId===a.requirementId&&q.experienceId===a.experienceId)).slice(0,3).map(a=>({requirementId:a.requirementId,experienceId:a.experienceId,text:'你实际负责的工作和采用的方法是什么？',purpose:'明确本人职责'}))};
  }else{
    stages.push('rewrite');output={suggestions:input.experiences.map(e=>({experienceId:e.id,text:e.sources.map(s=>s.text).join('\n'),reason:'整理原文和已确认补充',sourceIds:e.sources.map(s=>s.id)}))};
  }
  res.end(JSON.stringify({model:'local-fixture-only',usage:{prompt_tokens:10,completion_tokens:20},choices:[{finish_reason:'stop',message:{content:invalid?'invalid JSON':JSON.stringify(output)}}]}));
});
let qa;
try{
  upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
  qa=await startQa('phase2-flow',{mode:'live-local',upstream:'http://127.0.0.1:'+upstream.address().port,viewport:{width:1440,height:1000}});
  const {page,output,url,errors}=qa;qa.acceptLocalDialogs();
  const current=async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('youju.resume.v1'))?.tasks.at(-1));
  await page.goto(url);await page.locator('.mode-badge').filter({hasText:'AI 接口模式'}).waitFor();
  await page.locator('[name=resume]').fill(fixture.输入.resume);await page.locator('[name=jd]').fill(fixture.输入.jd);
  await page.locator('[data-action=create]').click();await page.getByRole('alert').waitFor();
  assert.equal(await page.locator('[name=resume]').inputValue(),fixture.输入.resume);assert.equal(await current(),undefined);
  invalid=false;await page.locator('[data-action=create]').click();await page.locator('#parse-confirm').waitFor();
  assert.equal((await current()).resumeOriginal,fixture.输入.resume);
  await page.locator('#parse-confirm').check();await page.locator('[data-action=confirm-parse]').click();await page.locator('#rewrite-plan').waitFor();
  assert.equal((await current()).associations.find(a=>a.experienceId).origin,'ai');
  const question=page.locator('[data-answer]').first();await question.fill(fixture.预设补问答案[0].answer);await page.locator('[data-action=answer]').first().click();
  assert.equal((await current()).facts.at(-1).status,'pending');
  await page.locator('[data-fact-check]').first().check();await page.locator('[data-action=confirm-fact]').first().click();
  assert.equal((await current()).facts.at(-1).status,'confirmed');
  await page.locator('[data-action=generate]').click();await page.locator('[data-action=consent-generate]').click();await page.locator('[data-action=accept]').first().waitFor();
  const before=(await current()).suggestions;assert.ok(before.some(s=>s.text.includes('12份登记表')));
  await page.locator('[data-action=accept]').first().click();assert.equal((await current()).suggestions[0].status,'accepted');
  // A new failed candidate must preserve the already accepted suggestion.
  invalid=true;await page.locator('[data-action=regenerate]').first().click();await page.locator('[data-action=consent-generate]').click();await page.getByRole('alert').waitFor();
  assert.equal((await current()).suggestions[0].status,'accepted');assert.equal((await current()).suggestions[0].text,before[0].text);
  await page.reload();await page.locator('[data-action=nav][data-view=tasks]').click();await page.locator('[data-action=open]').last().click();
  assert.equal((await current()).suggestions[0].status,'accepted');assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(output,'flow.png')});

  // Resolve the generated cards through visible actions and save a version.
  let task=await current();
  for(const suggestion of task.suggestions){
    if(suggestion.status!=='accepted')await page.locator('[data-action=accept][data-id="'+suggestion.id+'"]').click();
  }
  await page.locator('[data-action=preview]').click();await page.locator('#final-text').waitFor();
  const finalText=await page.locator('#final-text').innerText();
  await page.locator('#final-confirm').check();await page.locator('[data-action=confirm-version]').click();
  const readState=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('youju.resume.v1')));
  const saved=await readState();assert.equal(saved.versions.length,1);assert.equal(saved.versions[0].text,finalText);
  await page.reload();await page.locator('[data-view=tasks]').click();await page.locator('[data-action=open]').last().click();
  const reopened=await readState();assert.deepEqual(reopened.versions,saved.versions);
  assert.deepEqual(reopened.tasks.at(-1).facts,saved.tasks.at(-1).facts);
  await page.locator('[data-action=view-version]').first().click();
  assert.ok((await page.locator('.modal').innerText()).includes('12份登记表'));
  await page.screenshot({path:path.join(output,'saved-version.png')});
  Object.assign(qa.report,{localUpstreamCalls:calls,stages});
  await writeFile(path.join(output,'local-upstream.json'),JSON.stringify({calls,stages,externalModelCalls:0},null,2));
  await qa.pass(['解析失败保留输入','网页确认后本机Live协议调用','关联与必要补问','回答待确认/确认','确认事实用于建议','失败不覆盖已采用稿','最终保存、刷新与重开']);
  console.log('phase2-flow: passed');
}catch(error){qa?.error(error);if(qa?.page)await qa.page.screenshot({path:path.join(qa.output,'failure.png'),fullPage:true}).catch(()=>{});throw error;}
finally{await qa?.close();upstream.closeAllConnections();await new Promise(resolve=>upstream.close(resolve));}
