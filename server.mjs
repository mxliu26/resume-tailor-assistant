import http from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { generateCandidates,parseMaterials,analyze } from './public/domain.js';
import {createModelClient,ApiError,prompts} from './lib/model-client.mjs';
import {parseWithAI,analyzeWithAI,redact} from './lib/material-pipeline.mjs';
import {factualSourceText,preservesTeamPercentOwnership} from './lib/factual-sources.mjs';
import {jobFocusFor} from './public/job-focus.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
try { process.loadEnvFile(path.join(ROOT, '.env')); } catch (e) { if (e.code !== 'ENOENT') console.warn('无法读取 .env，请检查文件格式。'); }
const numeric = (value, fallback, min, max) => {
  const number = Number(value);
  return Number.isInteger(number) && number >= min && number <= max ? number : fallback;
};
const MAX_TEXT = numeric(process.env.MAX_TEXT_LENGTH, 30000, 100, 100000);
const MAX_FILE = numeric(process.env.MAX_FILE_BYTES, 5242880, 1024, 20971520);
const TIMEOUT = numeric(process.env.AI_TIMEOUT_MS, 45000, 100, 120000);
const MODE = process.env.AI_MODE === 'live' ? 'live' : 'mock';
const BASE = process.env.AI_BASE_URL || '';
const MODEL = process.env.AI_MODEL || '';
const KEY = process.env.AI_API_KEY || '';
const callModel=createModelClient({base:BASE,model:MODEL,key:KEY,timeout:TIMEOUT,maxBytes:MAX_TEXT*40,maxTokens:numeric(process.env.AI_MAX_OUTPUT_TOKENS,4096,256,8192),tokenField:process.env.AI_TOKEN_LIMIT_FIELD==='max_completion_tokens'?'max_completion_tokens':'max_tokens',thinking:process.env.AI_THINKING||'disabled'});
const PUBLIC = path.join(ROOT, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.bcmap': 'application/octet-stream', '.pfb': 'application/octet-stream', '.ttf': 'font/ttf', '.wasm': 'application/wasm' };
let generating = false;


const safeHost = () => { try { return new URL(BASE).host; } catch { return ''; } };
const send = (res, status, payload) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
};

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new ApiError(413, '输入超过支持上限，请缩减后重试；已填写的内容不会被截断。');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function validateTask(task,requireSelection=true) {
  if (!task || !Array.isArray(task.experiences) || !Array.isArray(task.selected) || !Array.isArray(task.facts) || !Array.isArray(task.requirements)) {
    throw new ApiError(400, '任务结构不完整，请返回校对步骤。');
  }
  if ((requireSelection&&!task.selected.length) || new Set(task.selected).size !== task.selected.length) throw new ApiError(400, '请至少选择一段经历，且不要重复选择。');
  if (!Number.isInteger(task.revision) || task.revision < 1) throw new ApiError(400, '材料版本无效，请重新校对。');
  const ids = new Set();
  let total = 0;
  for (const experience of task.experiences) {
    if (!experience || typeof experience.id !== 'string' || ids.has(experience.id) || typeof experience.text !== 'string' || typeof experience.title !== 'string') throw new ApiError(400, '经历数据无效，请重新校对。');
    ids.add(experience.id);
    total += experience.text.length;
  }
  if (task.selected.some(id => !ids.has(id))) throw new ApiError(400, '所选经历已变化，请重新选择。');
  const allIds = new Set(ids);
  for (const fact of task.facts) {
    if (!fact || typeof fact.id !== 'string' || allIds.has(fact.id) || !ids.has(fact.experienceId) || typeof fact.text !== 'string' || !['pending','confirmed','unknown','none','conflict'].includes(fact.status)) throw new ApiError(400, '事实来源无效，请重新确认。');
    allIds.add(fact.id);
    total += fact.text.length;
  }
  for (const requirement of task.requirements) {
    if (!requirement || typeof requirement.text !== 'string') throw new ApiError(400, '岗位要求不完整，请重新校对。');
    total += requirement.text.length;
  }
  if (total > MAX_TEXT * 3 || task.experiences.some(x => x.text.length > MAX_TEXT) || task.requirements.some(x => x.text.length > MAX_TEXT)) throw new ApiError(413, '材料超过文本上限，请缩减后重试。');
  return task;
}


function sourcesFor(task, experience) {
  return [
    { id: experience.id, text: redact(factualSourceText(experience.text)), kind:'original' },
    ...task.facts.filter(f => f.experienceId === experience.id && f.status === 'confirmed').map(f => ({ id: f.id, text: redact(factualSourceText(f.text)), kind:'confirmed_supplement', requirementId:f.requirementId||null })),
  ];
}

function assertFactualSupport(text, sourceText) {
  if (!preservesTeamPercentOwnership(text,sourceText)) throw new ApiError(422, '模型建议未保留团队百分比的成果归属，已拦截。请核对后重试或保留原文。');
  const numericTokens = value => value.match(/\d+(?:[,，.]\d+)*(?:\s*(?:%|％|个百分点|万元|万|元|人|条|次|倍|天|月|年))?/g) || [];
  const numbers = numericTokens(text);
  const normalize = value => value.replace(/[\s,，]/g, '').replace(/％/g, '%');
  const sourceNumbers = new Set(numericTokens(sourceText).map(normalize));
  if (numbers.some(n => !sourceNumbers.has(normalize(n)))) throw new ApiError(422, '模型建议含无来源的数字或单位，已拦截。请重新生成或保留原文。');
  const guardedTerms = ['主导','负责','独立','牵头','带领','管理团队','用户访谈','A/B测试','A/B 测试','线上实验','上线','营收','收入增长','转化率','商业化'];
  // A term in a negative statement is not affirmative evidence for that term.
  const hasPositiveOccurrence = (value, term) => {
    const lower = value.toLowerCase(), needle = term.toLowerCase();
    let offset = 0, found;
    while ((found = lower.indexOf(needle,offset)) !== -1) {
      const prefix = lower.slice(Math.max(0,found-12),found);
      if (!/(?:未|没有|尚未|不曾|未曾|并未|不|无)(?:[^，。；;！？\n]{0,5})$/.test(prefix)) return true;
      offset = found + needle.length;
    }
    return false;
  };
  for (const term of guardedTerms) {
    if (hasPositiveOccurrence(text,term) && !hasPositiveOccurrence(sourceText,term)) throw new ApiError(422, '模型建议可能改变职责或成果范围，已拦截。请重新生成或保留原文。');
  }
  const tools = text.match(/\b[A-Za-z][A-Za-z0-9+#.-]{1,}\b/g) || [];
  // Observed PDF extraction: MA TLAB. Normalize only this known spelling,
  // inside the cited source and without changing negation or stored text.
  // Do not join arbitrary English words, lines, paragraphs or source entries.
  const toolSource = term => term.toLowerCase() === 'matlab'
    ? sourceText.replace(/(?<![A-Za-z0-9_+#.-])MA[ \t]+TLAB(?![A-Za-z0-9_+#.-])/gi, 'MATLAB')
    : sourceText;
  if (tools.some(term => hasPositiveOccurrence(text,term) && !hasPositiveOccurrence(toolSource(term),term))) throw new ApiError(422, '模型建议含无来源的工具或英文术语，已拦截。请重新生成或保留原文。');
}

export async function generateLive(task,call=callModel) {
  const selected = task.experiences.filter(e => task.selected.includes(e.id));
  const payload = {
    requirements: task.requirements.map(r => ({ id:r.id, text:redact(r.text), category:r.category, strength:r.strength, logic:r.logic })),
    experiences: selected.map(e => ({ id:e.id, title:redact(e.title), sources:sourcesFor(task,e),
      confirmedAnswers:task.facts.filter(f=>f.experienceId===e.id&&f.status==='confirmed').flatMap(f=>{
        const q=(task.questions||[]).find(q=>q.id===f.questionId&&q.experienceId===e.id&&q.requirementId===f.requirementId&&(q.status==='confirmed'||q.status==='archived'&&q.previousStatus==='confirmed'));
        // Questions locate the answered gap; only the separately checked source
        // is factual evidence. Pending/unknown answers and other units stay out.
        return q?[{sourceId:f.id,questionText:redact(q.text),usage:'问题仅定位已回答缺口，不是事实；答案只取对应confirmed_supplement来源'}]:[];
      }),
      focus:jobFocusFor(task,e.id).map(f=>({...f,text:redact(f.text),evidence:redact(factualSourceText(f.evidence))})) })),
  };
  const {data,meta}=await call('rewrite',payload);
  if (!Array.isArray(data?.suggestions) || data.suggestions.length !== selected.length) throw new ApiError(422, 'AI 输出缺少所选经历，未采用。请重试。');
  const seen = new Set();
  const suggestions=data.suggestions.map(s => {
    const exp = selected.find(e => e.id === s?.experienceId);
    if (!exp || seen.has(exp.id) || typeof s.text !== 'string' || !s.text.trim() || s.text.length > MAX_TEXT || typeof s.reason !== 'string' || !s.reason.trim() || !Array.isArray(s.sourceIds) || !s.sourceIds.length) throw new ApiError(422, 'AI 输出字段不完整或经历标识错误，未采用。');
    seen.add(exp.id);
    const sources = sourcesFor(task,exp);
    if (s.sourceIds.some(id => !sources.some(source => source.id === id)) || !s.sourceIds.includes(exp.id)) throw new ApiError(422, 'AI 引用了不存在、未确认或属于其他经历的事实，未采用。');
    assertFactualSupport(s.text, sources.filter(source => s.sourceIds.includes(source.id)).map(source => source.text).join('\n'));
    return { id:randomUUID(),experienceId:exp.id,original:exp.text,text:s.text,reason:s.reason,sourceIds:s.sourceIds,status:'pending',revision:task.revision };
  });
  return {suggestions,meta};
}

async function pythonExecutable() {
  if (process.env.PYTHON) return process.env.PYTHON;
  const dependencyRoot = path.dirname(path.dirname(path.dirname(process.execPath)));
  const sibling = path.join(dependencyRoot, 'python', process.platform === 'win32' ? 'python.exe' : 'bin/python3');
  if (existsSync(sibling)) return sibling;
  if (process.platform === 'win32') {
    const windowsApps = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'WindowsApps');
    try {
      const names = (await readdir(windowsApps)).filter(n => n.startsWith('OpenAI.CodexPrimaryRuntime.')).sort().reverse();
      for (const name of names) {
        const candidate = path.join(windowsApps,name,'dependencies','python','python.exe');
        if (existsSync(candidate)) return candidate;
      }
    } catch { /* A normal Python installation remains supported. */ }
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

async function extractPdf(body) {
  if (body.subarray(0,5).toString() !== '%PDF-') throw new ApiError(400,'文件不是有效 PDF。请上传 PDF 或粘贴简历文本。');
  const python = await pythonExecutable();
  return new Promise((resolve,reject) => {
    const processHandle = spawn(python,[path.join(ROOT,'scripts','pdf_extract.py'),String(MAX_TEXT)],{stdio:['pipe','pipe','pipe'],windowsHide:true});
    let output = ''; let settled = false;
    const done = (err,value) => { if (settled) return; settled = true; clearTimeout(timer); err ? reject(err) : resolve(value); };
    const timer = setTimeout(() => { processHandle.kill(); done(new ApiError(408,'PDF 解析超时，请缩减文件或粘贴文本。')); },20000);
    processHandle.stdout.on('data',chunk => { output += chunk.toString(); if (output.length > MAX_TEXT * 8 + 2048) { processHandle.kill(); done(new ApiError(413,'PDF 文本超过上限，请缩减文件。')); } });
    processHandle.stderr.on('data',() => {});
    processHandle.stdin.on('error',() => {});
    processHandle.on('error',() => done(new ApiError(503,'没有找到可用的 Python。请安装 Python 和 pypdf，或粘贴简历文本。')));
    processHandle.on('close',() => {
      try {
        const result = JSON.parse(output);
        if (result.error) done(new ApiError(422,result.error));
        else if (typeof result.text !== 'string' || !result.text.trim()) done(new ApiError(422,'PDF 没有可提取文字，请粘贴文本。'));
        else if (result.text.length > MAX_TEXT) done(new ApiError(413,'PDF 文本超过上限，请缩减文件。'));
        else done(null,result);
      } catch { done(new ApiError(422,'PDF 读取失败，请粘贴简历文本。')); }
    });
    processHandle.stdin.end(body);
  });
}

export const server = http.createServer(async (req,res) => {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  try {
    const host = req.headers.host || '';
    if (!/^(127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host)) throw new ApiError(403,'仅允许本机访问。');
    if (req.headers.origin && req.headers.origin !== `http://${host}`) throw new ApiError(403,'不允许跨站提交材料。');
    const pathname = new URL(req.url,`http://${host}`).pathname;
    if (req.method === 'GET' && pathname === '/api/config') return send(res,200,{mode:MODE,model:MODE === 'live' ? MODEL : '本地规则模拟',maxTextLength:MAX_TEXT,maxFileBytes:MAX_FILE,endpointHost:safeHost(),promptVersion:prompts.version,timeoutMs:TIMEOUT});
    if (req.method === 'POST' && pathname === '/api/pdf') {
      if (!req.headers['content-type']?.startsWith('application/pdf')) throw new ApiError(415,'仅支持可提取文字的 PDF；其他格式请粘贴文本。');
      return send(res,200,await extractPdf(await readBody(req,MAX_FILE)));
    }
    if (req.method === 'POST' && ['/api/generate','/api/parse','/api/analyze'].includes(pathname)) {
      if (!req.headers['content-type']?.startsWith('application/json')) throw new ApiError(415,'请求格式必须是 JSON。');
      let input;
      try { input = JSON.parse((await readBody(req,MAX_TEXT * 24)).toString('utf8')); }
      catch(e) { if (e instanceof ApiError) throw e; throw new ApiError(400,'请求内容无效，请重新尝试。'); }
      const parsing=pathname==='/api/parse';
      if(parsing&&(typeof input.resume!=='string'||!input.resume.trim()||typeof input.jd!=='string'||!input.jd.trim()))throw new ApiError(400,'请填写简历和 JD。');
      if(parsing&&(input.resume.length>MAX_TEXT||input.jd.length>MAX_TEXT))throw new ApiError(413,'材料超过文本上限，请缩减后重试。');
      const task=parsing?null:validateTask(input.task,pathname==='/api/generate');
      if (MODE === 'live' && input.consent !== true) throw new ApiError(400,'调用外部 AI 前，请确认本步骤发送的校对材料、已确认事实和岗位要求。');
      if (generating) throw new ApiError(409,'已有生成请求处理中，请等待当前请求结束。');
      generating = true;
      try {
        if (MODE === 'mock') await new Promise(resolve => setTimeout(resolve,400));
        let result;
        if(parsing)result=MODE==='live'?await parseWithAI(input,callModel):parseMaterials(input.resume,input.jd);
        else if(pathname==='/api/analyze')result=MODE==='live'?await analyzeWithAI(task,callModel):analyze(task);
        else result=MODE==='live'?await generateLive(task):{suggestions:generateCandidates(task)};
        return send(res,200,{...result,mode:MODE});
      } finally { generating = false; }
    }
    if (pathname.startsWith('/api/')) throw new ApiError(404,'没有找到该接口。');
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new ApiError(405,'不支持的请求方法。');
    let decoded;
    try { decoded = decodeURIComponent(pathname); } catch { throw new ApiError(400,'路径无效。'); }
    const target = path.resolve(PUBLIC,`.${decoded === '/' ? '/index.html' : decoded}`);
    if (!target.startsWith(`${PUBLIC}${path.sep}`) || decoded.includes('\\') || decoded.includes('\0')) throw new ApiError(403,'路径不可访问。');
    const ext = path.extname(target);
    if (!MIME[ext]) throw new ApiError(404,'页面不存在。');
    let body;
    try { if (!(await stat(target)).isFile()) throw new Error(); body = await readFile(target); }
    catch { throw new ApiError(404,'页面不存在。'); }
    res.writeHead(200,{'Content-Type':MIME[ext],'Cache-Control':'no-store'});
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch(e) { if (!res.headersSent) send(res,e.status || 500,{error:e instanceof ApiError ? e.message : '本地服务处理失败，请保留内容后重试。'}); else res.end(); }
});
server.requestTimeout = 130000;
server.headersTimeout = 10000;

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = numeric(process.env.PORT,4381,0,65535);
  server.on('error',error => { console.error(error.code === 'EADDRINUSE' ? '端口已被占用，请更改 PORT 后重试。' : '本地服务无法启动。'); process.exitCode = 1; });
  server.listen(port,'127.0.0.1',() => { console.log(`简历定向助手已启动：http://127.0.0.1:${server.address().port}`); console.log(`模式：${MODE === 'mock' ? '本地模拟（不发送外部模型）' : '真实 AI（需在界面确认材料发送）'}`); });
}
