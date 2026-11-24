import {ApiError,sha256} from './model-client.mjs';
import {isContentUnit} from '../public/material-units.js';
import {factualSourceText} from './factual-sources.mjs';
import {sourceQuote} from './evidence-quote.mjs';

const fail=(message,code)=>{const error=new ApiError(422,'AI 输出校验失败：'+message+'，未采用结果。');if(code)error.code=code;throw error;};
const text=value=>typeof value==='string'&&value.trim().length>0;
export function redact(value){
  return String(value||'').replace(/[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g,'[邮箱已移除]')
    .replace(/\b\d{17}[\dXx]\b/g,'[证件号已移除]')
    .replace(/(?:\+?86[- ]?)?1[3-9]\d{9}\b/g,'[电话已移除]')
    .replace(/(?:姓名|联系人|手机|电话|邮箱|身份证)\s*[：:]\s*[^\n，,；;]+/g,'[个人信息已移除]');
}
function linesOf(value){
  let offset=0;return value.split('\n').map((line,index)=>{const r={line:index+1,text:line.replace(/\r$/,''),start:offset,end:offset+line.replace(/\r$/,'').length};offset+=line.length+1;return r;});
}
function safeResumeLines(resume){
  return linesOf(resume).map((row,index)=>({...row,text:index===0&&row.text.trim().length<=12?'[身份行已移除]':redact(row.text)}));
}
// Only unambiguous identity-only lines may be restored locally. Never infer facts.
function identityOnlyLine(value){
  const line=value.trim();
  return /^(?:姓名|联系人)\s*[：:]\s*[\p{Script=Han}·]{2,6}$/u.test(line)
    || /^(?:手机|电话)\s*[：:]\s*(?:\+?86[- ]?)?1[3-9]\d{9}$/.test(line)
    || /^(?:邮箱\s*[：:]\s*)?[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}$/.test(line)
    || /^\[(?:身份行|个人信息|邮箱|电话|证件号)已移除\]$/.test(line);
}
const categories=['明确条件','工作任务与能力','工具或方法','加分项'];
// Reject only unambiguous education-only clauses; mixed skills/project wording
// still needs model classification and human review. Never rewrite the category.
function educationOnlyCondition(value){
  const clause=String(value||'').replace(/^\s*\d+[.、)．]\s*/,'').replace(/\s+/g,'');
  return /本科|专科|大专|硕士|博士|研究生/.test(clause)
    && /^(?:(?:学历|学位|任职要求|要求|至少|必须|须|具备|具有|全日制|非全日制|统招|在校|应届|学生|毕业生|毕业|在读|本科|专科|大专|硕士|博士|研究生|及以上|以上|或|和|与|及|者|优先考虑|优先|加分|[：:、/，,。；;()（）]))+$/.test(clause);
}
function checkConditionCategory(source,category){
  if(educationOnlyCondition(source)&&category!=='明确条件')fail('学历条件不能以优先强度替代分类，请校对为明确条件并保留原文强度');
}
// Recognize only a labelled, standalone role name. A title prefix never grants
// permission to drop an attached condition or duty (including parentheses).
function standaloneJobTitle(line){
  const match=/^(?:岗位|职位|招聘岗位|岗位名称|职位名称)\s*[：:]\s*(.+)$/.exec(line);
  if(!match)return false;
  const name=match[1];
  if(/必须|负责|协助|具备|熟悉|掌握|优先|加分|至少|本科|硕士|博士|学历|毕业|在读|每周|到岗|实习期|要求|需|须|能够|可以|\d|[，,；;。！？!?]/.test(name))return false;
  if(/^[（(]?(?:支持|参与|完成|承担|维护|提供|进行)/.test(name)||/[（(]\s*(?:支持|参与|完成|承担|维护|提供|进行)/.test(name))return false;
  return /^[\p{Script=Han}A-Za-z /·-]{1,35}(?:实习生|实习|助理|专员|经理|工程师)(?:[（(][\p{Script=Han}A-Za-z /·-]{1,20}[）)])?$/u.test(name);
}

// Refine only explicit, independent source headers inside an AI experience span.
// Dates in prose or stages of one named project are not new experiences.
const experienceSection=/^(?:课程项目|课程实践|课程作业|项目经历|项目经验|实践项目|科研与项目|科研经历|研究经历|工作经历|实习经历|校园实践|校园经历|校园与协作|社团经历|志愿经历|实践经历|竞赛经历)[：:]?$/;
const datedExperience=/^\s*(?:19|20)\d{2}[.\/年]\d{1,2}月?\s*[-—–~～至]+\s*(?:(?:19|20)\d{2}[.\/年]\d{1,2}月?|至今|现在)[ \t]+(.+?)\s*$/;
const stageTitle=/阶段|里程碑|第[一二三四五六七八九十\d]+(?:期|轮)|^(?:需求调研|需求分析|原型设计|方案设计|开发实施|测试验收|上线交付|数据清洗|模型训练|效果验证)(?:与.*)?$/;
function independentHeader(row){
  const dated=datedExperience.exec(row.text);
  if(!dated)return null;
  const columns=/^(.+?)(?: {2,}|\t+)(\S.*?)$/.exec(dated[1]);
  if(!columns)return null;
  const title=columns[1].trim(),role=columns[2].trim();
  if(stageTitle.test(title)||title.length>80||role.length>30
    ||/[。；;：:，,]/.test(title+role)
    ||!/(?:成员|负责人|志愿者|实习生|助理|工程师|专员|组长|队长|经理|干事|独立完成|独立开发|独立课程作业)$/.test(role))return null;
  return {line:row.line,title,key:title.replace(/\s+/g,'').replace(/[（(]?v\d[\w.-]*[）)]?$/i,'')};
}
function refineExperienceBoundaries(units,rows){
  const splits=[];
  const refined=units.flatMap((unit,index)=>{
    const unchanged={...unit,idSuffix:String(index)};
    if(unit.kind!=='experience')return [unchanged];
    const sourceRows=rows.slice(unit.startLine-1,unit.endLine);
    const datedRows=sourceRows.filter(row=>datedExperience.test(row.text));
    const headers=datedRows.map(independentHeader);
    if(headers.length<2||headers.some(h=>!h)||new Set(headers.map(h=>h.key)).size!==headers.length)return [unchanged];
    // A specific enclosing project title is stronger evidence than child dates.
    const prefix=sourceRows.filter(row=>row.line<headers[0].line&&row.text.trim());
    if(prefix.some(row=>!experienceSection.test(row.text.trim())))return [unchanged];
    if(headers.some((header,i)=>!sourceRows.some(row=>row.line>header.line&&row.line<(headers[i+1]?.line??unit.endLine+1)
      &&/^(?:[•●▪◦‣⁃·*-]\s*\S|职责|工作内容|项目背景|项目成果|负责|参与|完成|协助|产出|交付|结果|研究)/.test(row.text.trim()))))return [unchanged];
    const parts=headers.map((header,i)=>({...unit,startLine:i?header.line:unit.startLine,endLine:headers[i+1]?headers[i+1].line-1:unit.endLine,
      titleLine:header.line,idSuffix:index+'_part'+(i+1)}));
    splits.push({startLine:unit.startLine,endLine:unit.endLine,parts:parts.map(({startLine,endLine,titleLine})=>({startLine,endLine,titleLine}))});
    return parts;
  });
  return {units:refined,splits};
}
export async function parseWithAI({resume,jd},call){
  const resumeLines=linesOf(resume),jdLines=linesOf(jd);
  const {data,meta}=await call('parse',{resumeLines:safeResumeLines(resume).map(({line,text})=>({line,text})),jdLines:jdLines.map(({line,text})=>({line,text:redact(text)}))});
  if(!Array.isArray(data.units)||!data.units.length||data.units.length>100||!Array.isArray(data.requirements)||!data.requirements.length||data.requirements.length>100)fail('缺少简历分段或岗位要求');
  const covered=new Set();let previousEnd=0;
  for(const unit of data.units){
    const {startLine,endLine,kind}=unit||{};
    if(!Number.isInteger(startLine)||!Number.isInteger(endLine)||startLine<=previousEnd||endLine<startLine||endLine>resumeLines.length||!['context','experience'].includes(kind))fail('简历分段有遗漏、重叠或非法范围');
    previousEnd=endLine;for(let n=startLine;n<=endLine;n++)covered.add(n);
  }
  const restoredContextLines=[];
  const units=data.units.map(unit=>({...unit}));
  for(const row of resumeLines){
    if(!row.text.trim()||covered.has(row.line))continue;
    if(!identityOnlyLine(row.text))fail('部分原文未被保留');
    // Slice the real local source later; do not use model text or create new content.
    units.push({startLine:row.line,endLine:row.line,kind:'context'});
    covered.add(row.line);restoredContextLines.push(row.line);
  }
  const boundaries=refineExperienceBoundaries(units.sort((a,b)=>a.startLine-b.startLine),resumeLines);
  if(boundaries.units.length>100)fail('独立经历分段超过上限');
  const experiences=boundaries.units.map(({startLine,endLine,kind,idSuffix,titleLine})=>{
    const start=resumeLines[startLine-1].start,end=resumeLines[endLine-1].end,source=resume.slice(start,end);
    if(!source.trim())fail('简历分段为空');
    const title=titleLine?resumeLines[titleLine-1].text:source.split(/\r?\n/).find(l=>l.trim());
    return {id:'exp_'+sha256(source).slice(0,12)+'_'+idSuffix,title:title.trim().slice(0,80),kind,text:source,sourceText:source,original:source,start,end};
  });
  if(resumeLines.some(row=>row.text.trim()&&!covered.has(row.line)))fail('部分原文未被保留');
  const reqCovered=new Set();
  const requirements=data.requirements.map((r,index)=>{
    if(!r||!Number.isInteger(r.line)||r.line<1||r.line>jdLines.length||reqCovered.has(r.line)||!categories.includes(r.category))fail('岗位来源或分类无效');
    reqCovered.add(r.line);const source=jdLines[r.line-1].text.trim();if(!source)fail('岗位要求为空');
    checkConditionCategory(source,r.category);
    // Strength/logic stay bound to source wording; model classification cannot erase it.
    return {id:'req_'+sha256(source).slice(0,12)+'_'+index,text:source,original:source,category:r.category,
      strength:/优先|加分|更佳/.test(source)?'优先／加分':/必须|要求|至少|须|不得/.test(source)?'明确要求':'原文未强调强制',
      logic:/或/.test(source)&&/且|同时/.test(source)?'同时含“或”与“且”，按原文核对':/或/.test(source)?'或（满足其中一项）':/且|同时/.test(source)?'且（同时满足）':'保留原文关系'};
  });
  // The model may omit only headings/title lines, explicitly identified in its output.
  if(!Array.isArray(data.ignoredJdLines)||data.ignoredJdLines.some(n=>!Number.isInteger(n)||!jdLines[n-1]||reqCovered.has(n)))fail('JD 未处理行标识无效');
  for(const n of data.ignoredJdLines){
    const line=jdLines[n-1].text.trim();
    const labelledCondition=/^(?:岗位|职位|招聘岗位|岗位名称|职位名称)\s*[：:]/.test(line)&&/学历|毕业|在读|每周|到岗|实习期|\d+\s*(?:天|个月|月|小时)/.test(line);
    if(!standaloneJobTitle(line)&&!/^(?:岗位职责|任职要求|职位要求|工作职责|任职资格|加分项)[：:]?$/.test(line)&&(labelledCondition||/必须|负责|支持|协助|具备|熟悉|掌握|优先|加分|至少|本科|硕士|\d+\s*[、.)．]/.test(line)))fail('包含要求的 JD 行不能作为标题忽略');
  }
  for(const row of jdLines)if(row.text.trim()&&!reqCovered.has(row.line)&&!data.ignoredJdLines.includes(row.line))fail('岗位要求有遗漏');
  const ignored=data.ignoredJdLines.map(n=>jdLines[n-1].text).filter(x=>x.trim());
  return {experiences,requirements,warnings:['AI 解析仍需人工校对；原文未改写。',...(restoredContextLines.length?['模型未分段的基本信息行已按本地原文保留，请核对。']:[]),...(boundaries.splits.length?['已按原文中的独立经历标题细分合并段落，请核对各段来源。']:[]),...(ignored.length?['以下 JD 行被识别为标题，请核对是否漏掉要求：'+ignored.join('；')]:[])],meta:{...meta,restoredContextLines,...(boundaries.splits.length?{experienceBoundaryCorrection:{version:'source-boundaries-v1',splits:boundaries.splits}}:{})}};
}

const capability=['已有明确证据','表达不足','相关但不等价','尚未确认','确认没有相关经历'];
const conditions=['按已提供信息符合','存在明确差异','待确认'];
const answeredStates=new Set(['provided','confirmed','none','unknown','skipped']);
import {questionRequirementIds,answerState} from '../public/question-scope.js';
// Evidence eligibility is wider than rewrite eligibility: availability and other
// context facts can verify conditions without becoming an experience to rewrite.
function conditionSourceText(value,identityHeader=false){
  return redact(factualSourceText(value)).split('\n').filter((line,index)=>{
    if(identityOnlyLine(line))return false;
    // Same unlabelled identity-header precaution as parsing, but never remove
    // a short factual condition (e.g. "每周到岗3天").
    return !(identityHeader&&index===0&&line.trim().length<=20
      &&!/[\d：:]|每周|到岗|实习|毕业|学历|资格|居住|在读|工作许可/.test(line));
  }).join('\n').trim();
}
function analysisSources(task,units){
  return task.experiences.filter(e=>!e.excluded).flatMap(e=>{
    const eligible=units.some(unit=>unit.id===e.id),scope=eligible?'experience':'condition_only';
    const clean=(value,header=false)=>eligible?redact(factualSourceText(value)):conditionSourceText(value,header);
    return [{id:e.id,experienceId:e.id,scope,text:clean(e.text,e===task.experiences[0])},
      ...task.facts.filter(f=>f.experienceId===e.id&&f.status==='confirmed')
        .map(f=>({id:f.id,experienceId:e.id,scope,text:clean(f.text)}))].filter(s=>s.text.trim());
  });
}
export async function analyzeWithAI(task,call){
  for(const r of task.requirements)checkConditionCategory(r.text,r.category);
  const units=task.experiences.filter(isContentUnit);
  const sources=analysisSources(task,units);
  const resolvedQuestions=(task.questions||[]).filter(q=>answeredStates.has(answerState(q))).flatMap(q=>questionRequirementIds(q).map(requirementId=>({
    requirementId,primaryRequirementId:q.requirementId,experienceId:q.experienceId,status:answerState(q),canAsk:false,
    questionText:redact(q.text||''),
    // These answers constrain scope, not positive facts. Pending positive text
    // remains absent; only independently confirmed sources can be quoted.
    ...(['none','unknown','skipped'].includes(answerState(q))?{answerBoundary:redact(q.answer||''),usage:'仅界定回答范围与状态，不是已确认肯定事实'}:{}),
    confirmedSourceIds:task.facts.filter(f=>f.questionId===q.id&&f.experienceId===q.experienceId&&f.status==='confirmed').map(f=>f.id)
  })));
  const confirmedNonePairs=resolvedQuestions.filter(q=>q.status==='none'&&q.requirementId===q.primaryRequirementId).map(({requirementId,experienceId})=>({requirementId,experienceId}));
  const currentCapability=capability.filter(s=>s!=='确认没有相关经历'||confirmedNonePairs.length>0);
  const payload={judgmentRules:{condition:{statuses:conditions,experienceId:''},capability:{statuses:currentCapability,confirmedNonePairs}},requirements:task.requirements.map(r=>({id:r.id,text:redact(r.text),category:r.category,judgmentType:r.category==='明确条件'?'condition':'capability',strength:r.strength,logic:r.logic})),experiences:units.map(e=>({id:e.id,title:redact(e.title)})),sources,
    resolvedQuestions,
    inProgressQuestions:(task.questions||[]).filter(q=>answerState(q)==='pending'&&(q.answer?.trim()||q.draftAnswer?.trim()||q.editing)).map(q=>({requirementId:q.requirementId,relatedRequirementIds:q.relatedRequirementIds||[],experienceId:q.experienceId,questionText:redact(q.text||''),usage:'用户已有草稿，保持原题及覆盖范围，不读取或使用未提交内容'})),
    questionRules:{allowedRequirementIds:task.requirements.filter(r=>r.category!=='明确条件').map(r=>r.id),allowedExperienceIds:units.map(e=>e.id),allowedStatuses:['表达不足','尚未确认'],requiresNonemptyExperienceId:true,maxQuestions:3,mergeRule:'相近缺口可用relatedRequirementIds列出其他要求；必须同经历、同为有效未回答缺口。覆盖关系不代表事实确认或能力满足。'},
    unresolvedConflicts:task.facts.filter(f=>f.status==='conflict'&&task.experiences.some(e=>e.id===f.experienceId&&!e.excluded)).map(f=>({id:f.id,experienceId:f.experienceId,text:redact(factualSourceText(f.text)),usage:'仅提示冲突，不能作为已确认事实引用'})),
    manualAssociations:(task.associations||[]).filter(a=>a.manual||a.origin==='user').map(a=>({requirementId:a.requirementId,experienceIds:a.experienceIds||[a.experienceId],status:a.status,manualStatus:a.manualStatus,
      links:(a.links||[]).map(link=>({experienceId:link.experienceId,status:link.status,manual:link.manual===true||link.origin==='user',manualStatus:link.manualStatus===true}))}))};
  // Make the existing ownership contract explicit before generation. Keep all
  // sources available for condition/conflict review; never repair output IDs.
  for(const experience of payload.experiences){
    experience.allowedEvidenceSourceIds=sources.filter(s=>s.experienceId===experience.id).map(s=>s.id);
  }
  // Expose existing validator gates before generation, without repairing the
  // response or broadening any evidence/status rule.
  payload.questionRules.conditionRequirementIds=task.requirements.filter(r=>r.category==='明确条件').map(r=>r.id);
  payload.questionRules.blockedExperienceIds=[...new Set(task.facts.filter(f=>f.status==='conflict').map(f=>f.experienceId))];
  payload.questionRules.blockedExperiencePolicy='当前产品先在事实核对区处理冲突；这些经历不能生成常规补问，包括其他尚未回答要求。原文关联可保留，不把补问阻塞当成能力否定。';
  const validate=data=>{
  if(!Array.isArray(data.associations)||data.associations.length!==task.requirements.length||!Array.isArray(data.questions)||data.questions.length>3)fail('关联数量或补问数量不正确');
  const seen=new Set();
  const associations=data.associations.map(a=>{
    const req=task.requirements.find(r=>r.id===a?.requirementId),exp=units.find(e=>e.id===a?.experienceId);
    if(!req||seen.has(req.id)||typeof a.experienceId!=='string'||a.experienceId&&!exp||!text(a.reason)||a.reason.length>1500||!Array.isArray(a.evidence))fail('关联字段或来源标识无效');
    if(!(req.category==='明确条件'?conditions:capability).includes(a.status))fail(req.category==='明确条件'?'明确条件必须使用条件核对状态':'能力要求必须使用能力证据状态');
    seen.add(req.id);
    if(req.category==='明确条件'&&a.experienceId)fail('明确条件不能强制关联改写经历');
    if(req.category!=='明确条件'&&!a.experienceId&&a.status!=='尚未确认')fail('没有可靠来源时必须保留未知');
    if(a.status==='确认没有相关经历'&&!confirmedNonePairs.some(q=>q.requirementId===req.id&&q.experienceId===a.experienceId))fail('不能将未提供的信息判断为没有经历');
    const evidence=a.evidence.map(item=>{
      const source=sources.find(s=>s.id===item?.sourceId);
      if(!source||!text(item.quote))fail('证据不在对应经历或已确认事实中');
      if(a.experienceId&&source.experienceId!==a.experienceId)fail('证据不在对应经历或已确认事实中','EVIDENCE_OWNER_MISMATCH');
      const quote=sourceQuote(source.text,item.quote);
      if(quote===null)fail('证据不在对应经历或已确认事实中');
      // Keep the original source span, including PDF line endings.
      return quote;
    }).join('\n');
    if(['已有明确证据','按已提供信息符合','存在明确差异'].includes(a.status)&&!evidence)fail('确定判断缺少原文证据');
    const conflict=task.facts.some(f=>f.experienceId===a.experienceId&&f.status==='conflict');
    return {requirementId:req.id,experienceId:a.experienceId,status:conflict?'尚未确认':a.status,reason:conflict?'请先处理这段经历的事实冲突。':a.reason,evidence,origin:'ai',conflict,needsClarification:!conflict&&!!a.experienceId&&['表达不足','尚未确认'].includes(a.status),missing:[]};
  });
  const questionKeys=new Set();
  const questions=data.questions.map(q=>{
    const related=q?.relatedRequirementIds??[];
    if(!Array.isArray(related)||related.some(id=>typeof id!=='string'||id===q.requirementId)||new Set(related).size!==related.length)fail('合并补问要求标识无效');
    if(!text(q?.text)||q.text.length>600||!text(q?.purpose)||q.purpose.length>600)fail('补问没有绑定有效缺口或重复提问');
    for(const requirementId of [q.requirementId,...related]){
      const a=associations.find(a=>a.requirementId===requirementId&&a.experienceId===q.experienceId);
      const key=requirementId+':'+q.experienceId;
      if(resolvedQuestions.some(r=>r.requirementId===requirementId&&r.experienceId===q.experienceId))fail('模型重复提出已回答或已跳过的同一补问');
      if(!a||!a.needsClarification||questionKeys.has(key))fail('补问没有绑定有效缺口或重复提问');
      questionKeys.add(key);
    }
    for(const draft of payload.inProgressQuestions.filter(d=>d.experienceId===q.experienceId&&questionRequirementIds(d).some(id=>[q.requirementId,...related].includes(id)))){
      if(draft.requirementId!==q.requirementId||JSON.stringify([...draft.relatedRequirementIds].sort())!==JSON.stringify([...related].sort()))fail('不能合并或改挂正在回答的问题');
    }
    return {requirementId:q.requirementId,experienceId:q.experienceId,text:q.text,purpose:q.purpose,...(related.length?{relatedRequirementIds:related}:{})};
  });
  return {associations,questions};
  };
  const first=await call('analyze',payload);
  try{return {...validate(first.data),meta:first.meta};}
  catch(error){
    if(error.code!=='EVIDENCE_OWNER_MISMATCH')throw error;
    // Only report legal scopes; never copy a rejected quote, prescribe a
    // verdict, rewrite a source ID, or turn a failed association into a pass.
    const scopes=first.data.associations.flatMap(a=>{
      const experience=units.find(e=>e.id===a?.experienceId);
      if(!experience||!Array.isArray(a.evidence)||!a.evidence.some(ev=>{const source=sources.find(s=>s.id===ev?.sourceId);return source&&source.experienceId!==experience.id;}))return [];
      return [{requirementId:a.requirementId,experienceId:experience.id,allowedEvidenceSourceIds:sources.filter(s=>s.experienceId===experience.id).map(s=>s.id)}];
    });
    const retry=await call('analyze',{...payload,evidenceScopeCorrection:{version:'evidence-scope-v1',scopes,
      rule:'以下仅列出所选经历的合法证据范围。能力关联只能引用所选经历的 allowedEvidenceSourceIds，原文见 sources；请依据原始材料重新返回完整 associations 和 questions，其他事实、状态及补问约束不变。'}});
    const checked=validate(retry.data); // Any second failure stops; no retry loop.
    const attempts=[{...first.meta,outcome:'rejected',reasonCode:error.code},{...retry.meta,outcome:'validated'}];
    const usage=Object.fromEntries(['prompt_tokens','completion_tokens','total_tokens','prompt_cache_hit_tokens','prompt_cache_miss_tokens'].map(k=>[k,attempts.every(a=>Number.isInteger(a.usage?.[k]))?attempts.reduce((n,a)=>n+a.usage[k],0):null]));
    return {...checked,meta:{...retry.meta,usage,durationMs:attempts.every(a=>Number.isFinite(a.durationMs))?attempts.reduce((n,a)=>n+a.durationMs,0):null,
      evidenceCorrection:{version:'evidence-scope-v1',retries:1},attempts}};
  }
}
