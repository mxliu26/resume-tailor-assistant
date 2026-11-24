import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let mock, live, upstream, upstreamPort;
let responseMode = 'valid';
let lastPayload;
const task = () => ({
  id:'task-1', revision:1,
  resumeOriginal:'张三\n邮箱：private@example.test\n课程项目\n参与清洗1200条记录。',
  selected:['exp-1'],
  experiences:[{id:'context',title:'个人资料',text:'姓名：张三\n邮箱：private@example.test',kind:'context'},{id:'exp-1',title:'课程项目',text:'课程项目\n参与清洗1200条记录。',original:'课程项目\n参与清洗1200条记录。'}],
  facts:[{id:'fact-1',experienceId:'exp-1',text:'使用 Excel 整理清洗结果。',status:'confirmed',confirmedAt:'2026-01-01'},{id:'fact-2',experienceId:'exp-1',text:'未经确认的成果',status:'unknown'}],
  requirements:[{id:'req-1',text:'需要数据整理能力，Excel 或 Python 优先。',category:'能力',strength:'优先',logic:'或'}],
});

async function launch(env) {
  const child = spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,AI_MODE:'mock',AI_API_KEY:'',AI_BASE_URL:'',AI_MODEL:'',PORT:'0',...env},stdio:['ignore','pipe','pipe'],windowsHide:true});
  const url = await new Promise((resolve,reject) => {
    let output = '';
    const timer = setTimeout(() => { child.kill(); reject(new Error('Server did not start')); },10000);
    child.stdout.on('data',chunk => {
      output += chunk.toString();
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
    child.on('exit',code => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
  });
  return {child,url};
}

before(async () => {
  upstream = http.createServer(async (req,res) => {
    const chunks=[];
    for await (const chunk of req) chunks.push(chunk);
    lastPayload = JSON.parse(Buffer.concat(chunks).toString());
    if (responseMode === 'error') {res.writeHead(503);res.end('unavailable');return;}
    const result = {suggestions:[{experienceId:'exp-1',text:'课程项目\n参与清洗1200条记录，使用 Excel 整理清洗结果。',reason:'合并已确认的工作方法。',sourceIds:['exp-1','fact-1']}]};
    if (responseMode === 'number') result.suggestions[0].text='课程项目\n参与清洗200条记录。';
    if (responseMode === 'role') result.suggestions[0].text='课程项目\n主导清洗1200条记录。';
    if (responseMode === 'tool') result.suggestions[0].text='课程项目\n参与清洗1200条记录，使用 Python 分析。';
    if (responseMode === 'source') result.suggestions[0].sourceIds=['exp-1','fact-2'];
    if (responseMode === 'negation') result.suggestions[0].text='课程项目\n参与清洗1200条记录，项目已上线。';
    if (responseMode === 'missing') result.suggestions=[];
    res.setHeader('Content-Type','application/json');
    res.end(JSON.stringify({choices:[{message:{content:responseMode === 'invalid' ? 'not json' : JSON.stringify(result)}}]}));
  });
  upstream.listen(0,'127.0.0.1');
  await once(upstream,'listening');
  upstreamPort=upstream.address().port;
  mock=await launch({});
  live=await launch({AI_MODE:'live',AI_API_KEY:'test-secret-must-not-leak',AI_BASE_URL:`http://127.0.0.1:${upstreamPort}/v1`,AI_MODEL:'test-model'});
});
after(async () => {
  for (const run of [mock,live]) if (run?.child) { run.child.kill(); await once(run.child,'exit'); }
  if (upstream) await new Promise(resolve=>upstream.close(resolve));
});
const generate = (server,input,extra={}) => fetch(`${server.url}/api/generate`,{method:'POST',headers:{'Content-Type':'application/json',...extra},body:JSON.stringify(input)});

test('config reveals mode and limits but never API key',async () => {
  const config=await (await fetch(`${live.url}/api/config`)).json();
  assert.equal(config.mode,'live');
  assert.equal(config.maxTextLength,30000);
  assert.equal(config.maxFileBytes,5242880);
  assert.equal(JSON.stringify(config).includes('test-secret'),false);
});
test('mock generation uses confirmed source facts and keeps sources',async () => {
  const response=await generate(mock,{task:task()});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.mode,'mock');
  assert.equal(body.suggestions.length,1);
  assert.ok(body.suggestions[0].text.includes('1200'));
  assert.ok(!body.suggestions[0].text.includes('未经确认'));
  assert.ok(!body.suggestions[0].sourceIds.includes('fact-2'));
});
test('malformed and oversized tasks fail explicitly',async () => {
  const bad=await generate(mock,{task:{}});
  assert.equal(bad.status,400);
  const tooLong=task();tooLong.experiences[1].text='字'.repeat(30001);
  assert.equal((await generate(mock,{task:tooLong})).status,413);
});
test('pending facts remain valid task data but are not used in generation',async () => {
  const input=task();input.facts[1].status='pending';
  const response=await generate(mock,{task:input});
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.suggestions[0].text.includes('未经确认'),false);
  assert.equal(result.suggestions[0].sourceIds.includes('fact-2'),false);
});
test('cross-origin submissions and unknown source facts are rejected',async () => {
  assert.equal((await generate(mock,{task:task()},{Origin:'https://other.example'})).status,403);
  const input=task();input.facts[0].experienceId='nonexistent';
  assert.equal((await generate(mock,{task:input})).status,400);
});
test('concurrent generation is not allowed to race',async () => {
  const results=await Promise.all([generate(mock,{task:task()}),generate(mock,{task:task()})]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
});
test('live requests require explicit external-transfer consent',async () => {
  const response=await generate(live,{task:task()});
  assert.equal(response.status,400);
});
test('live forwards minimal materials, preserves fields and excludes personal context',async () => {
  responseMode='valid';
  const response=await generate(live,{task:task(),consent:true});
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.mode,'live');
  assert.equal(body.suggestions[0].revision,1);
  const payload=JSON.stringify(lastPayload);
  assert.equal(payload.includes('private@example.test'),false);
  assert.equal(payload.includes('未经确认'),false);
  assert.equal(payload.includes('张三'),false);
  assert.ok(payload.includes('Excel'));
});
for (const mode of ['number','role','tool','source','missing','invalid','error']) {
  test(`live fails safely without mock fallback: ${mode}`,async () => {
    responseMode=mode;
    const response=await generate(live,{task:task(),consent:true});
    assert.equal(response.status,mode==='error'?502:422);
    const body=await response.json();
    assert.ok(body.error);
    assert.equal(body.suggestions,undefined);
  });
}
test('negative source statements cannot support affirmative outcome claims',async () => {
  responseMode='negation';
  const input=task();input.experiences[1].text+='项目尚未正式上线。';
  const response=await generate(live,{task:input,consent:true});
  assert.equal(response.status,422);
  assert.match((await response.json()).error,/职责或成果范围/);
});
test('PDF import rejects unsupported and malformed files with text fallback',async () => {
  const unsupported=await fetch(`${mock.url}/api/pdf`,{method:'POST',headers:{'Content-Type':'application/msword'},body:'bad'});
  assert.equal(unsupported.status,415);
  const malformed=await fetch(`${mock.url}/api/pdf`,{method:'POST',headers:{'Content-Type':'application/pdf'},body:'bad'});
  assert.equal(malformed.status,400);
  assert.match((await malformed.json()).error,/粘贴/);
});

test('the local PDF preview serves its module, worker, CJK maps, fonts and decoder with usable MIME types',async()=>{
  const assets=[['pdf.min.mjs','text/javascript'],['pdf.worker.min.mjs','text/javascript'],['cmaps/78-EUC-H.bcmap','application/octet-stream'],['standard_fonts/FoxitDingbats.pfb','application/octet-stream'],['standard_fonts/LiberationSans-Regular.ttf','font/ttf'],['wasm/openjpeg.wasm','application/wasm']];
  for(const [file,mime] of assets){
    const response=await fetch(`${mock.url}/vendor/pdfjs/${file}`);
    assert.equal(response.status,200,file);
    assert.ok(response.headers.get('content-type').startsWith(mime),file);
    assert.ok((await response.arrayBuffer()).byteLength>100,file);
  }
});
test('a real text PDF extracts correctly in the available local runtime',async () => {
  const content='BT /F1 12 Tf 20 100 Td (Resume project worked with 1200 records.) Tj ET';
  const objects=[
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  let pdf='%PDF-1.4\n';const offsets=[0];
  objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
  const xref=Buffer.byteLength(pdf);
  pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const response=await fetch(`${mock.url}/api/pdf`,{method:'POST',headers:{'Content-Type':'application/pdf'},body:pdf});
  const result=await response.json();
  assert.equal(response.status,200,JSON.stringify(result));
  assert.match(result.text,/1200 records/);
});
