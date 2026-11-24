import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {root,outputRoot,newRunId,runtimeHashes} from './runtime.mjs';
const names=['comparison-feedback','comparison-navigation','rewrite-feedback','review-reference','phase2-flow'];
const selected=process.argv.slice(2);for(const name of selected)assert(names.includes(name),'未知场景: '+name);
const runId=newRunId(),output=path.join(outputRoot,runId),before=await runtimeHashes();
await mkdir(output,{recursive:true});
const report={runId,type:'隔离浏览器自动化回归',realUserTest:false,externalModelCalls:0,apiCostCny:0,scenarios:[]};
for(const name of selected.length?selected:names){
  const started=Date.now();
  const child=spawn(process.execPath,[path.join(root,'qa',name+'.mjs')],{cwd:root,env:{...process.env,QA_RUN_ID:runId},stdio:['ignore','pipe','pipe'],windowsHide:true});
  let log='';child.stdout.on('data',b=>{log+=b;process.stdout.write(b);});child.stderr.on('data',b=>{log+=b;process.stderr.write(b);});
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);});
  await writeFile(path.join(output,name+'.log'),log);
  let detail;try{detail=JSON.parse(await readFile(path.join(output,name,'report.json'),'utf8'));}catch{}
  const status=code===0&&detail?.status==='passed'?'passed':'failed';
  report.scenarios.push({name,status,exitCode:code,durationMs:Date.now()-started,report:name+'/report.json'});
  console.log(name+': '+status);
  if(status==='failed'){process.exitCode=1;break;}
}
report.productFilesUnchanged=JSON.stringify(await runtimeHashes())===JSON.stringify(before);
report.passed=report.scenarios.filter(s=>s.status==='passed').length;
report.failed=report.scenarios.filter(s=>s.status==='failed').length;
report.requested=selected.length||names.length;
report.notExecuted=report.requested-report.scenarios.length;
if(!report.productFilesUnchanged)process.exitCode=1;
await writeFile(path.join(output,'summary.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({runId,passed:report.passed,failed:report.failed,notExecuted:report.notExecuted,productFilesUnchanged:report.productFilesUnchanged,externalModelCalls:0}));
