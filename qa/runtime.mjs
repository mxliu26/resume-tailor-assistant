import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
export const root=fileURLToPath(new URL('../',import.meta.url));
export const outputRoot=path.join(root,'qa','output');
export const newRunId=()=>new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8);
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function runtimeHashes(){
  const result=[];
  async function visit(relative){
    for(const entry of await readdir(path.join(root,relative),{withFileTypes:true})){
      const name=path.posix.join(relative,entry.name);
      if(entry.isDirectory())await visit(name);else result.push({path:name,sha256:sha(await readFile(path.join(root,name)))});
    }
  }
  for(const dir of ['public','lib','prompts','scripts'])await visit(dir);
  result.push({path:'server.mjs',sha256:sha(await readFile(path.join(root,'server.mjs')))});
  return result.sort((a,b)=>a.path.localeCompare(b.path,'en'));
}
export async function startQa(name,{mode='mock',upstream='',viewport={width:1920,height:1080}}={}){
  assert(/^[a-z0-9-]+$/.test(name));
  assert(['mock','live-local'].includes(mode));
  if(mode==='live-local'){
    const parsed=new URL(upstream);
    assert.equal(parsed.protocol,'http:');assert.equal(parsed.hostname,'127.0.0.1');
    assert(!parsed.username&&!parsed.password&&!parsed.search&&!parsed.hash&&parsed.port);
  }else assert.equal(upstream,'');
  // Never connect to a previously running service or reuse a personal profile.
  const runId=process.env.QA_RUN_ID||newRunId();
  assert(/^[A-Za-z0-9_.-]+$/.test(runId));
  const output=path.join(outputRoot,runId,name);await mkdir(output,{recursive:true});
  const began=Date.now(),errors=[],remote=[],requests=[],dialogs=[];
  const report={scenario:name,status:'failed',mode,externalModelCalls:0,apiCostCny:0,errors,blockedExternalRequests:remote,dialogs};
  const env={};
  for(const key of ['PATH','Path','SystemRoot','SYSTEMROOT','WINDIR','SystemDrive','COMSPEC','PATHEXT','TEMP','TMP','ProgramFiles','ProgramFiles(x86)','PYTHON'])if(process.env[key])env[key]=process.env[key];
  Object.assign(env,{PORT:'0',AI_MODE:mode==='live-local'?'live':'mock',AI_BASE_URL:upstream,AI_MODEL:'local-fixture-only',AI_API_KEY:'local-fixture-key',AI_THINKING:'disabled',AI_TIMEOUT_MS:'15000',AI_MAX_OUTPUT_TOKENS:'4096',AI_TOKEN_LIMIT_FIELD:'max_tokens',MAX_TEXT_LENGTH:'30000',MAX_FILE_BYTES:'5242880',NODE_OPTIONS:''});
  let child,browser,context,page,stdout='',stderr='',closed=false;
  const close=async()=>{
    if(closed)return;closed=true;
    if(page&&!page.isClosed()){
      try{const state=await page.evaluate(()=>localStorage.getItem('youju.resume.v1'));if(state)await writeFile(path.join(output,'state.json'),state);}catch{}
    }
    try{await context?.tracing.stop({path:path.join(output,'trace.zip')});}catch(e){report.traceError=e.message;}
    await browser?.close();
    if(child&&child.exitCode===null){const ended=once(child,'exit');child.kill();await ended;}
    report.durationMs=Date.now()-began;report.browserVersion=report.browserVersion||null;
    await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
    await writeFile(path.join(output,'requests.json'),JSON.stringify(requests,null,2)+'\n');
    await writeFile(path.join(output,'service.log'),stdout+stderr);
  };
  try{
    child=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,env,stdio:['ignore','pipe','pipe'],windowsHide:true});
    child.stdout.on('data',b=>{stdout+=b;});child.stderr.on('data',b=>{stderr+=b;});
    const url=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('本机QA服务启动超时')),12000);
      const fail=e=>{clearTimeout(timer);reject(e);};child.once('error',fail);
      child.once('exit',code=>fail(Error('本机QA服务意外退出: '+code)));
      child.stdout.on('data',()=>{const match=stdout.match(/http:\/\/127\.0\.0\.1:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});
    });
    const config=await (await fetch(url+'/api/config')).json();
    assert.equal(config.mode,mode==='live-local'?'live':'mock');
    assert.equal(config.endpointHost,upstream?new URL(upstream).host:'');
    assert.equal(config.promptVersion,'precise-followup-v21');
    if(mode==='live-local')assert.equal(config.model,'local-fixture-only');
    report.config=config;report.sourceCommit='58a25be1097a7902058a3c0a78415a2c90408cc5';
    report.runtimeHashes=await runtimeHashes();report.runtimeFingerprint=sha(JSON.stringify(report.runtimeHashes));
    const module=process.env.QA_PLAYWRIGHT?pathToFileURL(path.resolve(process.env.QA_PLAYWRIGHT)).href:'playwright';
    const {chromium}=await import(module);
    const launch={headless:process.env.QA_HEADED!=='1',args:['--disable-background-networking','--disable-component-update','--disable-sync']};
    if(process.env.QA_BROWSER_PATH)launch.executablePath=process.env.QA_BROWSER_PATH;
    else if(process.env.QA_BROWSER_CHANNEL)launch.channel=process.env.QA_BROWSER_CHANNEL;
    browser=await chromium.launch(launch);report.browserVersion=browser.version();
    context=await browser.newContext({viewport,acceptDownloads:true,serviceWorkers:'block'});
    await context.route('**/*',async route=>{
      const target=new URL(route.request().url());
      if(['http:','https:'].includes(target.protocol)&&target.origin!==url){remote.push(target.origin+target.pathname);return route.abort('blockedbyclient');}
      return route.continue();
    });
    await context.tracing.start({screenshots:true,snapshots:true,sources:true});
    page=await context.newPage();page.setDefaultTimeout(15000);
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',request=>{const u=new URL(request.url());if(u.pathname.startsWith('/api/'))requests.push({method:request.method(),path:u.pathname});});
    page.on('response',response=>{const u=new URL(response.url());if(u.pathname.startsWith('/api/'))requests.push({path:u.pathname,status:response.status()});});
    return {url,output,browser,context,page,errors,report,close,
      error(error){report.error={message:error.message,stack:error.stack};},
      async pass(checks){assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);report.checks=checks;report.status='passed';},
      acceptLocalDialogs(){page.on('dialog',async dialog=>{
        const text=dialog.message();dialogs.push({type:dialog.type(),text});
        if(text.includes('发送')&&!text.includes(config.endpointHost))return dialog.dismiss();
        await dialog.accept();
      });}
    };
  }catch(error){report.error={message:error.message,stack:error.stack};await close();throw error;}
}
