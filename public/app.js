import {icon,deskIllustration,goalIllustration} from './visual-assets.js';
import {requestAI,taskSnapshot,assertCurrentTask,analysisKey,hasCurrentAnalysis} from './ai-state.js';
import {isContentUnit} from './material-units.js';
import {restoreSectionTitles} from './domain.js';
import {beginAnswerEdit,cancelAnswerEdit,replaceAnswer} from './followup-state.js';
import {parseMaterials,analyze,generateCandidates,composeText,validateFinal,sample,reconcileExperiences,detectFactConflicts} from './domain.js';
import {isFormattingOnly} from './domain.js';
import {reviewDraft,reviewChanges,applyReview,requiresReviewConfirmation} from './review-state.js';
import {renderReview,renderReviewChangeSummary} from './review-view.js';
import {replaceProfilePart,renderTextDiff,categoryStyle} from './review-presentation.js';
import {renderComparison} from './comparison-view.js';
import {bindComparisonNavigation} from './comparison-navigation.js';
import {getRewritePlan} from './analysis-model.js';
import {unitPresentation} from './unit-presentation.js';
import {savePdfSource,clearPdfSources,exportPdfSources} from './pdf-source.js';
import {bindReviewReference} from './review-reference.js';
import {renderRewriteEditor,renderRewriteLegend,renderRewriteDeletions,bindRewriteEditors} from './rewrite-editor.js';

const $=s=>document.querySelector(s), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>crypto.randomUUID(), date=v=>new Date(v).toLocaleString('zh-CN',{hour12:false}), KEY='youju.resume.v1';
const emptyDB=()=>({tasks:[],bases:[],versions:[],facts:[],logs:[],testConsent:false,createInput:{}});
let db=emptyDB(), storageError='';
try{const stored=localStorage.getItem(KEY);if(stored){const d=JSON.parse(stored);if(!Array.isArray(d.tasks)||!Array.isArray(d.versions)||!Array.isArray(d.bases))throw Error('存储格式无效');db={...db,...d};}}catch{storageError='未能读取本机数据。现有存储未被覆盖，请先导出或检查浏览器存储设置。';}
let config={mode:'mock',model:'本地规则模拟',maxTextLength:30000,maxFileBytes:5242880}, view='new', currentId=null, busy='', error='', errorAnchor=null, dirty=false, saved=true, modal=null, activeVersion=null;
const task=()=>db.tasks.find(t=>t.id===currentId);
const badge=(text,type='')=>`<span class="badge ${type}">${esc(text)}</span>`;
const actionIcons={save:'save',original:'folder',upload:'upload',create:'arrow','update-materials':'arrow',preview:'arrow','confirm-version':'check','copy-full':'copy','download-text':'download','copy-exp':'copy'};
const btn=(text,action,cls='',extra='')=>`<button type="button" class="${cls}" data-action="${action}" ${extra}>${actionIcons[action]?icon(actionIcons[action]):''}${text}</button>`;
const field=(label,name,value='',placeholder='',area=false,extra='')=>`<label class="field"><span>${['当前校对简历','当前岗位 JD'].includes(label)?icon(label==='当前岗位 JD'?'briefcase':'document'):''}${label}</span>${area?`<textarea name="${name}" placeholder="${placeholder}" ${extra}>${esc(value)}</textarea>`:`<input name="${name}" value="${esc(value)}" placeholder="${placeholder}" ${extra}>`}</label>`;
const names=['材料输入','解析校对','对照与补问','改写工作台','岗位版本'];
function log(type,details={}){if(db.testConsent)db.logs.push({at:new Date().toISOString(),type,taskId:currentId,product:'0.2.0',prompt:config.promptVersion||'local-rule',model:config.model,details:structuredClone(details)});}
function persist(message){try{if(storageError)throw Error(storageError);localStorage.setItem(KEY,JSON.stringify(db));saved=true;dirty=false;error='';syncFeedback();if(message)toast(message);return true;}catch(e){saved=false;dirty=true;error='保存失败：本机存储不可用或空间不足。当前内容仍在页面中，请复制文本保底后重试。';syncFeedback();return false;}}
function changed(){dirty=true;saved=false;const el=$('#save-state');if(el)el.textContent='有未保存修改';}
function syncFeedback(){
  document.querySelector('[data-error-notice]')?.remove();
  document.querySelectorAll('.field-error').forEach(n=>n.remove());
  if(!error){errorAnchor=null;return;}
  const container=errorAnchor?.isConnected&&(errorAnchor.closest('.question,.review-confirm-card,.modal,.extra-facts,.fact')||errorAnchor.closest('.footer-actions'));
  if(container){
    const inline=document.createElement('p');inline.className='field-error';inline.textContent=error;inline.setAttribute('role','alert');container.append(inline);
    inline.scrollIntoView({behavior:'smooth',block:'nearest'});return;
  }
  const notice=document.createElement('div');notice.className='floating-error';notice.dataset.errorNotice='';notice.setAttribute('role','alert');
  notice.innerHTML=`<span><strong>请检查当前操作</strong><span>${esc(error)}</span></span>${btn('关闭','dismiss','ghost small','aria-label="关闭错误提示"')}`;
  document.body.append(notice);
}
function reportError(message,anchor){error=String(message||'操作未完成，请重试。');errorAnchor=anchor;syncFeedback();}
function refreshAnalysis(t){Object.assign(t,analyze(t));}
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('show'),4200);}
function navigate(next){if(dirty&&!persist())return;view=next;modal=null;error='';render();window.scrollTo(0,0);}
function intro(title,desc,actions=''){return `<div class="page-intro"><div><h1>${title}</h1><p>${desc}</p></div>${actions?`<div class="button-row">${actions}</div>`:''}</div>`;}
function flow(){const t=task();if(!t)return '';return `<nav class="flow-strip" aria-label="简历定制步骤">${names.map((n,i)=>`<button class="step ${t.step===i?'active':t.step>i?'done':''}" data-action="step" data-step="${i}" ${t.step===i?'aria-current="step"':''} ${i>t.maxStep?'disabled':''}><span class="step-num">${t.step>i?icon('check'):i+1}</span><span>${n}</span></button>`).join('')}</nav>`;}
let workNavObserver,stopComparisonNavigation,stopRewriteEditors,stopReviewReference;
const reviewReferenceStates=new Map();
const sourcePdf=t=>t?.resumePdf||db.bases.find(b=>b.id===t?.baseId)?.resumePdf;
function render(){const t=task(), isWork=view==='work'&&t;if(isWork)restoreSectionTitles(t);
  stopComparisonNavigation?.();
  stopRewriteEditors?.();
  stopReviewReference?.();
  const route=view+':'+currentId+':'+t?.step, same=$('#app').dataset.route===route, y=window.scrollY;
  const openDetails=same?[...document.querySelectorAll('#app details[open]')].map(n=>n.dataset.openKey||n.querySelector('summary')?.textContent):[];
$('#app').innerHTML=`<div class="shell"><aside class="sidebar"><div class="brand"><div class="brand-mark" aria-hidden="true">R.</div><span class="brand-copy"><strong>简历定制助手</strong><small>ResumeTailor</small></span></div><div class="brand-description"><p>基于真实经历，为目标岗位定制简历。</p></div><div class="nav-title">个人工作空间</div><nav aria-label="工作空间导航">${[['new','plus','新建岗位任务'],['tasks','tasks','我的任务'],['versions','folder','岗位版本'],['facts','bookmark','事实素材库']].map(([id,glyph,title])=>`<button class="nav-button ${(view===id||(id==='tasks'&&isWork))?'active':''}" data-action="nav" data-view="${id}"><span class="nav-icon">${icon(glyph)}</span>${title}${id==='tasks'?`<span class="nav-count">${db.tasks.length}</span>`:''}</button>`).join('')}</nav><div class="sidebar-bottom"><div class="goal-note">${goalIllustration()}<p><span>每一次修改，</span><span>都更接近理想岗位。</span></p></div><button class="nav-button" data-action="settings"><span class="nav-icon">${icon('settings')}</span>数据与隐私</button><div class="user"><span class="avatar">我</span><div>我的工作空间</div></div></div></aside><main class="main"><header class="topbar cream-masthead"><div class="masthead-copy"><div class="encouragement">把真实经历，慢慢整理清楚。<svg class="hand-underline" viewBox="0 0 150 16" aria-hidden="true"><path d="M3 12Q50 -1 92 5Q72 16 88 11Q117 5 147 7"/></svg></div><div class="breadcrumb"><b>${isWork?esc(t.name):({new:'新建岗位任务',tasks:'我的任务',versions:'岗位版本',facts:'事实素材库'}[view]||'工作台')}</b></div></div><div class="desk-art">${deskIllustration()}</div><div class="top-actions"><span class="tiny-status" id="save-state" role="status" aria-live="polite">${dirty?'有未保存修改':saved?'已保存至本机':'保存失败'}</span><span class="mode-badge">${config.mode==='live'?'AI 接口模式':'模拟演示模式'}</span>${btn('使用说明','help','ghost small')}</div></header><div class="page">${storageError?`<div class="info error">${esc(storageError)}</div>`:''}${isWork?workView():view==='new'?newView():view==='tasks'?tasksView():view==='versions'?versionsView():factsView()}</div></main></div>${modal?modalView():''}${busy?`<div class="loading-mask" role="status" aria-live="polite"><div class="loading-card"><div class="spinner"></div><h3>${esc(busy)}</h3><p>保留当前材料，请稍候</p></div></div>`:''}`;
  workNavObserver?.disconnect();
  const workNav=document.querySelector('.work-navigation');
  const measureNav=()=>document.documentElement.style.setProperty('--work-nav-height',workNav?Math.ceil(workNav.getBoundingClientRect().height)+'px':'0px');
  measureNav();if(workNav){workNavObserver=new ResizeObserver(measureNav);workNavObserver.observe(workNav);}
  $('#app').dataset.route=route;
  if(same){document.querySelectorAll('#app details').forEach(n=>{if(openDetails.includes(n.dataset.openKey||n.querySelector('summary')?.textContent))n.open=true;});window.scrollTo(0,y);}
  syncFeedback();
  stopComparisonNavigation=bindComparisonNavigation(document.querySelector('.comparison-layout'));
  stopRewriteEditors=bindRewriteEditors($('#app'),t);
  if(isWork&&!reviewReferenceStates.has(t.id))reviewReferenceStates.set(t.id,{});
  stopReviewReference=bindReviewReference(document.querySelector('.review-layout'),{attachment:sourcePdf(t),state:reviewReferenceStates.get(t?.id),jdOpen:t?.jdEditorOpen||t?.materialJD!==undefined});
}
function newView(){const f=db.createInput||{};return intro('材料输入','先放入简历与 JD，再核对事实与表达。',btn('填入演示材料','sample',''))+`<nav class="flow-strip input-steps" aria-label="简历定制步骤">${names.map((n,i)=>`<span class="step ${i===0?'active':''}"><span class="step-num">${i+1}</span><span>${n}</span></span>`).join('')}</nav><div class="grid work material-input"><div class="stack"><div class="grid two"><section class="card"><div class="card-head"><div class="head-title"><span class="card-icon">${icon('document')}</span><h3>基础简历</h3></div>${badge('必填','gray')}</div>${db.bases.length?`<label class="field"><span>复用基础材料</span><select name="baseId"><option value="">粘贴新材料</option>${db.bases.map(b=>`<option value="${b.id}" ${f.baseId===b.id?'selected':''}>${esc(b.name)}</option>`).join('')}</select></label>`:''}<div class="upload"><label><strong>上传可提取文字的 PDF</strong><small>最大 ${Math.round(config.maxFileBytes/1048576)} MB · 扫描件请粘贴文字</small><input id="pdf-input" type="file" accept="application/pdf,.pdf" aria-label="上传简历PDF"></label>${btn('选择文件','upload','small')}</div>${f.resumePdf?`<div class="pdf-upload-note"><span>已保留原件：${esc(f.resumePdf.name)}</span>${btn('取消原件关联','detach-input-pdf','small ghost')}</div>`:''}<label class="field" style="margin-bottom:0"><span>或粘贴简历文本<em>*</em></span><textarea class="material" name="resume" placeholder="粘贴你的教育背景、项目、实习或工作经历。\n\n保留原始内容即可，不必提前整理。">${esc(f.resume)}</textarea></label><div class="input-footer"><span id="resume-count">${(f.resume||'').length} / ${config.maxTextLength} 字</span><span>原始材料独立保留</span></div></section><section class="card"><div class="card-head"><div class="head-title"><span class="card-icon">${icon('briefcase')}</span><h3>目标岗位</h3></div>${badge('必填','gray')}</div><div class="form-row">${field('岗位名称','role',f.role,'选填，如产品实习生')}${field('公司','company',f.company,'选填')}</div><label class="field" style="margin-bottom:0"><span>岗位描述 JD<em>*</em></span><textarea class="material" name="jd" placeholder="粘贴完整岗位描述，包括工作职责、任职要求和加分项。\n\n岗位要求只用于确定表达重点，不会成为你的经历。">${esc(f.jd)}</textarea></label><div class="input-footer"><span id="jd-count">${(f.jd||'').length} / ${config.maxTextLength} 字</span><span>支持中英文岗位信息</span></div></section></div><div class="info inline-info"><span>${icon('info')}</span><div>${config.mode==='mock'?'当前为模拟演示：解析、关联和改写采用本地规则，不调用外部模型。':'当前已配置外部 AI：解析、关联和改写前会说明发送范围，并征求本次同意。'} 所有建议均需你核对，未选择的内容默认保留。</div></div><div class="footer-actions"><span></span>${btn('创建任务，开始校对','create','primary')}</div></div></div>`;}
function tasksView(){return intro('我的岗位任务','每个岗位独立整理，基础材料和历史版本分别保留。',btn('新建任务','new','primary'))+`<div class="stack">${db.tasks.length?db.tasks.slice().reverse().map(t=>`<article class="card task-card"><div class="head-title"><span class="card-icon">${icon('document')}</span><div><h3>${esc(t.name)}</h3><p>${esc(t.company||'未填写公司')} · ${date(t.updatedAt)} · ${names[t.step]}</p></div></div><div class="button-row">${badge(t.stale?'材料变化 · 待更新':t.confirmed?'已有确认版本':'草稿',t.stale?'amber':t.confirmed?'green':'gray')}${btn('继续处理','open','',`data-id="${t.id}"`)}${btn('删除','delete-task','ghost danger small',`data-id="${t.id}"`)}</div></article>`).join(''):`<div class="card empty"><div class="empty-icon">${icon('document')}</div><h3>还没有岗位任务</h3><p>添加简历和岗位描述，开始第一次定向修改。</p>${btn('创建第一个任务','new','primary')}</div>`}</div>`;}
function workView(){const t=task();return '<div class="work-navigation">'+intro(names[t.step],t.step===0?'修改材料后，关联与建议将重新核对。':t.step===1?'先确认我们读对了，再讨论如何表达。':t.step===2?'看清岗位要求与真实经历的关联，选择本次修改范围。':t.step===3?'逐条查看原文、建议和事实依据，决定你想采用的表达。':'核对实际采用的文本，保存一份独立的岗位版本。',btn('保存草稿','save')+btn('查看原始材料','original','ghost'))+flow()+'</div>'+(t.stale?`<div class="info warning" style="margin-bottom:20px">上游材料已变化，当前建议待更新。编辑稿仍保留，请重新生成并核对后再保存岗位版本。</div>`:'')+(t.step===0?materialsView(t):t.step===1?parseView(t):t.step===2?analysisView(t):t.step===3?rewriteView(t):finalView(t));}
function materialsView(t){return `<section class="card materials-card"><div class="form-row">${field('任务名称','taskName',t.name)}${field('岗位名称','taskRole',t.role)}</div><div class="grid two">${field('当前校对简历','materialResume',t.materialResume??t.resumeCorrected,'',true,'rows="16"')}${field('当前岗位 JD','materialJD',t.materialJD??t.jdCorrected,'',true,'rows="16"')}</div><div class="info" id="review-change-note">换行、空白和列表样式调整不需要重新确认事实。内容变更将在校对页统一确认。</div><div class="footer-actions"><span></span><div class="button-row">${btn('复用素材，新建岗位','reuse','')}${btn('应用材料，进入校对','update-materials','primary')}</div></div></section>`;}
function parseView(t){return renderReview(t,{esc,btn,badge,config,resumePdf:sourcePdf(t)});}
function analysisView(t){return renderComparison(t,{esc,btn,badge,config});}
function rewriteView(t){const priorities=getRewritePlan(t);return `<div class="stack rewrite-workspace"><div class="rewrite-guide"><div><strong>逐段核对，再决定采用</strong><p>先看高亮差异，再核对事实依据。原文已适配时，可以直接保留。</p></div>${badge(`${t.suggestions.filter(s=>t.selected.includes(s.experienceId)).length} 段建议`,'gray')}</div>${t.suggestions.length?t.suggestions.filter(s=>t.selected.includes(s.experienceId)).sort((a,b)=>priorities.findIndex(p=>p.experienceId===a.experienceId)-priorities.findIndex(p=>p.experienceId===b.experienceId)).map(s=>{const e=t.experiences.find(e=>e.id===s.experienceId), pending=s.pendingCandidate, priority=priorities.find(p=>p.experienceId===s.experienceId), presentation=unitPresentation(e||{}),accepted=['accepted','edited'].includes(s.status)&&s.revision===t.revision&&!s.needsConfirmation;return `<article class="suggestion priority-${priority?.priority||'keep'}"><div class="suggestion-head"><div><div class="source-label">${config.mode==='live'?'AI 生成建议':'模拟建议 · 本地规则'}</div><h3>${esc(presentation.title)}</h3>${presentation.meta?`<small class="unit-meta">${esc(presentation.meta)}</small>`:''}</div><div class="taglist">${priority?.priority==='clarify'?btn(esc(priority.label)+' <span aria-hidden="true">↗</span>','supplement-experience','priority-label supplement-button',`data-id="${s.experienceId}" aria-label="${esc(priority.label)}：${esc(presentation.title)}"`):`<span class="priority-label">${esc(priority?.label||'保留原文')}</span>`}<span data-suggestion-status>${badge(({pending:s.needsConfirmation?'待确认':'待处理',accepted:'已接受',edited:'已编辑',rejected:'已拒绝',original:'保留原文'})[s.status]||s.status,accepted?'green':'gray')}</span>${s.revision!==t.revision?badge('待更新','amber'):''}</div></div><div class="suggestion-content"><p class="plan-reason">${esc(priority?.reason||'按已有事实核对表达。')}</p>${renderRewriteLegend(s.id)}<div class="compare rewrite-compare"><div><div class="compare-label">修改前 · 校对后的原文</div><div class="original">${esc(e?.text||s.original)}</div></div><div><div class="compare-label purple">建议稿 · 可直接编辑</div>${renderRewriteEditor(s,presentation.title)}</div></div>${renderRewriteDeletions(s.id)}<dl class="rewrite-rationale"><dt>修改理由</dt><dd>${esc(s.reason)}</dd><dt>事实依据</dt><dd> ${(s.sourceIds||[]).map(id=>{const f=t.facts.find(f=>f.id===id);return f?`用户确认：${esc(f.text)}`:`校对原文：${esc(unitPresentation(t.experiences.find(e=>e.id===id)||{}).title)}`;}).join('；')}</dd>${s.userConfirmedAt?`<dt>编辑依据</dt><dd> 用户于 ${date(s.userConfirmedAt)} 确认${s.editKind==='fact'?'包含本人提供事实的编辑稿':'仅调整措辞'}。</dd>`:''}<dt>重点核对</dt><dd>职责、工作类型、数字口径、工具与成果归属，应与已提供材料一致。</dd></dl>${s.needsConfirmation?`<div class="info warning" style="margin-top:15px">你已手动编辑建议。若新增了事实，需要明确确认后才能采用。${btn('确认手动编辑','confirm-edit','small',`data-id="${s.id}"`)}</div>`:''}${pending?`<div class="candidate"><h3>新候选 · 尚未替换当前稿</h3><p class="pretext">${esc(pending.text)}</p>${btn('采用新候选','use-candidate','small',`data-id="${s.id}"`)} ${btn('保留当前稿','drop-candidate','small ghost',`data-id="${s.id}"`)}</div>`:''}</div><div class="suggestion-actions"><div class="button-row">${btn(accepted?'<span aria-hidden="true">✓</span> '+(s.status==='edited'?'已采用编辑稿':'已接受建议'):'接受建议','accept',accepted?'accepted-button small':'primary small',`data-id="${s.id}" ${accepted?'disabled':''}`)}${btn('拒绝','reject','small',`data-id="${s.id}"`)}${btn('保留原文','keep','small ghost',`data-id="${s.id}"`)}</div><div class="button-row">${btn('复制当前经历','copy-exp','small ghost',`data-id="${s.id}"`)}${btn('重新生成','regenerate','small',`data-id="${s.id}"`)}</div></div></article>`;}).join(''):`<div class="card empty"><h3>还没有修改建议</h3><p>返回对照页选择经历，再生成建议。</p>${btn('查看对照','back-analysis','primary')}</div>`}<div class="footer-actions rewrite-footer">${btn('返回对照与补问','back-analysis')}<div class="button-row">${btn('保存草稿','save')}${btn('查看完整岗位稿','preview','primary')}</div></div><div class="scope-note">未处理、拒绝或保留原文的建议，最终稿默认使用校对后的原文。</div></div>`;}
function finalView(t){const text=composeText(t), errors=finalErrors(t), versions=db.versions.filter(v=>v.taskId===t.id);return `<div class="grid work"><div class="stack">${errors.length?`<div class="info warning">${errors.map(esc).join('<br>')}</div>`:''}<article class="paper"><div class="paper-head"><h3>${esc(t.role||'岗位定向简历')}</h3>${badge('完整纯文本','gray')}</div><div class="pretext" id="final-text">${esc(text)}</div></article><div class="button-row">${btn('复制完整岗位文本','copy-full','')}${btn('下载纯文本','download-text','ghost')}</div></div><aside class="stack"><section class="card"><h3>确认岗位版本</h3><p class="smalltext">${esc(t.company||'目标公司未填写')} · ${esc(t.role||t.name)}</p><div class="feature-note"><span class="symbol">${icon('check')}</span><div><b>未选内容已保留</b><p>实际采用 ${t.suggestions.filter(s=>['accepted','edited'].includes(s.status)&&t.selected.includes(s.experienceId)).length} 条建议，其余使用原文。</p></div></div><label class="checkline" style="margin:20px 0"><input type="checkbox" id="final-confirm"><span>我已核对完整文本、事实和归属，确认保存此岗位版本。</span></label>${btn('确认并保存岗位版本','confirm-version','primary',`style="width:100%" ${errors.length?'disabled':''}`)}<p class="smalltext" style="margin:14px 0 0">保存为独立快照，不会覆盖基础简历或已有版本。</p></section><section class="card"><h3>该任务的历史版本</h3>${versions.length?versions.slice().reverse().map(v=>`<div class="history-item"><strong>版本 ${v.number}</strong><p>${date(v.createdAt)}</p>${btn('查看已保存文本','view-version','small ghost',`data-id="${v.id}"`)}</div>`).join(''):`<p class="smalltext">确认保存后，版本会出现在这里。</p>`}</section><div class="button-row">${btn('返回继续编辑','back-rewrite')}${btn('复用事实，新建岗位','reuse','ghost')}</div></aside></div>`;}
function versionsView(){return intro('已确认的岗位版本','每次确认都是独立快照，再次编辑会建立新草稿。')+`<div class="stack">${db.versions.length?db.versions.slice().reverse().map(v=>`<div class="card task-card"><div><h3>${esc(v.name)} · V${v.number}</h3><p>${date(v.createdAt)} · 用户已确认 · ${v.text.length} 字</p></div><div class="button-row">${btn('查看与复制','view-version','',`data-id="${v.id}"`)}${btn('再次编辑','edit-version','ghost',`data-id="${v.id}"`)}</div></div>`).join(''):`<div class="card empty"><div class="empty-icon">${icon('folder')}</div><h3>还没有确认版本</h3><p>完成逐条核对后，在岗位版本页确认保存。</p>${btn('查看我的任务','to-tasks','primary')}</div>`}</div>`;}
function factsView(){return intro('事实素材库','复用你确认过的真实信息。每条事实始终属于同一基础材料与经历。')+`<div class="stack">${db.facts.length?db.facts.map(f=>`<div class="card task-card"><div><div class="source-label">${esc(f.experienceTitle)} · ${esc(db.bases.find(b=>b.id===f.baseId)?.name||'基础材料')}</div><h3 style="font-size:16px">${esc(f.text)}</h3><p>用户确认于 ${date(f.confirmedAt)}</p></div>${btn('停止复用并删除','delete-fact','danger small',`data-id="${f.id}"`)}</div>`).join(''):`<div class="card empty"><div class="empty-icon">${icon('bookmark')}</div><h3>还没有已确认的补充事实</h3><p>在补问页确认的信息会保存在这里，供下一个岗位任务复用。</p>${btn('开始一个岗位任务','new','primary')}</div>`}</div>`;}
function finalErrors(t){const errors=validateFinal(t)||[];if(t.reviewNeedsConfirmation)errors.push('材料内容已更新，请先完成校对确认。');if(t.reviewDirty||t.materialResume!==undefined||t.materialJD!==undefined)errors.push('材料有未确认的修改，请先返回材料或校对页确认。');if(t.stale)errors.push('材料已变化，请重新生成并核对建议。');if(t.suggestions.some(s=>t.selected.includes(s.experienceId)&&s.needsConfirmation))errors.push('手动编辑尚未确认，请返回改写工作台确认或保留原文。');return [...new Set(errors)];}
function modalView(){let title='',body='',footer=btn('关闭','close-modal');if(modal==='original'){const t=task();title='原始输入 · 只读保留';body=`<h3>基础简历</h3><div class="original">${esc(t.resumeOriginal)}</div><h3>岗位 JD</h3><div class="original">${esc(t.jdOriginal)}</div>`;}else if(modal==='help'){title='从真实材料，到岗位修改稿';body=`<div class="stack">${names.map((n,i)=>`<div><h3>${i+1}. ${n}</h3><p class="smalltext">${['输入简历和 JD，或点击“填入演示材料”体验完整流程。','核对经历划分和岗位要求，纠正读取错误，新增事实由你明确确认。','选择经历；最多补问三个问题，可回答、跳过或说明未做过。','核对来源与措辞，接受、编辑、拒绝或保留原文。重新生成会提供新候选。','查看完整文本并确认保存，可复制使用或复用事实创建新岗位任务。'][i]}</p></div>`).join('')}</div><div class="info">默认模拟模式使用本地规则，适合流程演示，不能替代专业语义理解。所有数据存储在此浏览器的本机空间。</div>`;}else if(modal==='settings'){title='数据与隐私';body=`<div class="info">本应用绑定本机 127.0.0.1，文字、任务与 PDF 原件保存在当前浏览器的本机空间。同一浏览器与地址共享此工作空间；请勿作为公共多人服务。</div><h3 style="margin-top:22px">模型与数据流向</h3><p class="smalltext">${config.mode==='live'?`接口模式：${esc(config.model)}，服务地址 ${esc(config.endpointHost||'已配置服务')}。解析、关联和改写均会在同意后发送本步骤所需材料；尽量移除联系方式，但仍请自行检查。`:'模拟模式：所有分析与建议由本机规则处理，不发送至外部模型。PDF 在本机服务提取文字。'}</p><label class="checkline"><input id="test-consent" type="checkbox" ${db.testConsent?'checked':''}><span>授权记录内部测试数据（仅本机）<small style="display:block">包括解析、补问、候选、编辑及失败输出，可能包含材料内容。默认关闭，可导出并随时清空。</small></span></label><div class="button-row" style="margin:18px 0">${btn('导出本机备份','export-data')}${btn('导出测试记录','export-logs','ghost')}${btn('清空测试记录','clear-logs','danger ghost')}</div><hr class="divider"><h3>删除范围</h3><p class="smalltext">删除任务会删除该任务的 JD、草稿、岗位版本及关联测试记录，基础简历与事实素材保留。删除全部材料将清除本应用的基础材料、事实、任务、版本及内容记录。已复制或下载的文件不在删除范围内。</p>${btn('删除全部材料','delete-all','danger')}`;}else if(modal==='version'){const v=db.versions.find(v=>v.id===activeVersion);title=v?`${v.name} · V${v.number}`:'版本不存在';body=v?`<p class="smalltext">用户确认于 ${date(v.createdAt)} · 此历史快照不会随草稿变化</p><div class="original pretext">${esc(v.text)}</div>`:'';footer=btn('复制已确认文本','copy-version')+btn('关闭','close-modal');}else if(modal==='consent'){title='本次生成会发送哪些材料';body=`<p>将向 <strong>${esc(config.endpointHost||'配置的模型服务')}</strong> 发送校对后的内容（不含个人联系区）、岗位要求和已确认补充事实，用于按需更新关联，并改写所选经历。</p><p class="smalltext">不发送完整基础简历的个人信息区；服务端会尝试移除邮箱、手机号和证件号。请仍核对经历中是否有其他敏感内容。外部服务的数据保留规则由该服务决定。</p>`;footer=btn('取消','close-modal')+btn('同意并生成','consent-generate','primary');}else if(modal?.type==='fact'){title='编辑事实摘要';body=`<textarea id="fact-edit-text" rows="6">${esc(modal.text)}</textarea><p class="smalltext">保存后将重新等待确认，已使用此事实的草稿会标记为待更新。</p>`;footer=btn('取消','close-modal')+btn('保存摘要，重新确认','apply-fact-edit','primary');}else if(modal?.type==='edit'){title='确认手动编辑';body=`<div class="original">${esc(modal.text)}</div><label class="field"><span>本次修改类型</span><select id="edit-kind"><option value="wording">仅调整表达，没有新增或改变事实</option><option value="fact">包含我提供的新事实或事实修正</option></select></label><label class="checkline"><input id="edit-confirm" type="checkbox">我确认内容真实，职责、数字、工具和成果归属准确，且与当前材料不冲突。</label><p class="smalltext">若与现有材料冲突，请返回材料页先纠正原文。</p>`;footer=btn('取消','close-modal')+btn('确认并采用编辑稿','apply-edit','primary');}return `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="card-head"><h2>${esc(title)}</h2>${btn('×','close-modal','ghost','aria-label="关闭对话框"')}</div>${error?`<div class="info error" role="alert">${esc(error)}</div>`:""}${body}<div class="modal-footer">${footer}</div></section></div>`;}

async function copy(text){try{await navigator.clipboard.writeText(text);toast('已复制，可直接粘贴使用');}catch{error='浏览器未允许复制，请手动选中页面文本复制。';render();}}
function download(name,text,type='text/plain;charset=utf-8'){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function ensureInput(resume,jd){if(!resume.trim()||!jd.trim())throw Error('请同时填写基础简历和目标岗位 JD。');if(resume.length>config.maxTextLength||jd.length>config.maxTextLength)throw Error(`单份材料最多支持 ${config.maxTextLength} 字，请缩减后重试。系统不会截断内容。`);}
function bump(t){t.revision++;t.stale=!!t.suggestions.length;t.confirmed=false;t.updatedAt=new Date().toISOString();}
function syncReviewHint(){
  const t=task();if(!t)return;
  const change=reviewChanges(t),note=$('#review-change-note');
  if(note)note.textContent=change.substantive?'内容或识别分类有改动。应用后请核对更新结果，已有建议会标记待更新。':change.formattingOnly?'仅调整了换行、空白或列表样式，不需要重新确认事实。':'可以在本页编辑完整简历、单段经历和 JD；原始输入始终保留。';
  const wrap=$('#review-confirm-wrap'),confirmed=$('#review-confirmed-note');
  if(wrap)wrap.hidden=!requiresReviewConfirmation(t);if(confirmed)confirmed.hidden=requiresReviewConfirmation(t);
  if(change.substantive&&$('#parse-confirm'))$('#parse-confirm').checked=false;
}
function syncReviewDiffs(){
  const t=task();if(!t)return;
  document.querySelectorAll('.review-diff-slot').forEach(slot=>{
    const input=document.getElementById(slot.dataset.diffFor);if(!input)return;
    slot.innerHTML=renderTextDiff(JSON.parse(slot.dataset.diffBefore),input.value,esc);
  });
  const summary=$('#review-change-summary');if(summary){
    const open=[...summary.querySelectorAll('details[open]')].map(n=>n.dataset.openKey);
    summary.innerHTML=renderReviewChangeSummary(t,esc);
    summary.querySelectorAll('details').forEach(n=>{if(open.includes(n.dataset.openKey))n.open=true;});
  }
}
function editProfileField(el,t){
  const unit=t.experiences.find(e=>e.id===el.dataset.profileUnit), start=Number(el.dataset.profileStart),end=Number(el.dataset.profileEnd);
  unit.text=replaceProfilePart(unit.text,start,end,el.value);
  const delta=el.value.length-(end-start);
  document.querySelectorAll('[data-profile-unit]').forEach(other=>{if(other===el||other.dataset.profileUnit!==unit.id)return;
    if(Number(other.dataset.profileStart)>=end){other.dataset.profileStart=String(Number(other.dataset.profileStart)+delta);other.dataset.profileEnd=String(Number(other.dataset.profileEnd)+delta);}
  });
  el.dataset.profileEnd=String(start+el.value.length);t.reviewDirty=true;changed();
  if(t.materialResume===undefined&&$('[name=materialResume]'))$('[name=materialResume]').value=reviewDraft(t).resume;
  syncReviewHint();syncReviewDiffs();
}
function commitReview({forceReparse=false,announce=true,parsed}={}){
  const t=task(),{task:next,change}=applyReview(t,{maxTextLength:config.maxTextLength,forceReparse,parsed});
  Object.assign(t,next);delete t.materialResume;delete t.materialJD;
  const base=db.bases.find(b=>b.id===t.baseId);
  if(base){base.corrected=t.resumeCorrected;base.experiences=structuredClone(t.experiences);base.sourceRevision=t.revision;}
  if(!change.resumeContent)for(const fact of db.facts.filter(f=>f.baseId===t.baseId)){
    const exp=t.experiences.find(e=>e.id===fact.experienceId);
    if(exp&&fact.experienceSource&&isFormattingOnly(fact.experienceSource,exp.text))fact.experienceSource=exp.text;
  }
  log('review_material_applied',{change});
  const message=change.substantive?'内容已更新，请在本页核对后继续':change.structural?'识别范围已更新，请核对经历归属':change.formattingOnly?'格式已更新，事实确认与已采用建议保持有效':'已重新识别材料';
  persist(announce?message:undefined);return change;
}

function consentFor(stage){
  return window.confirm(`将向 ${config.endpointHost} 的 ${config.model} 发送${stage==='parse'?'简历文字（移除识别出的身份行与联系方式）及 JD，用于解析校对':'校对后的内容（不含个人联系区）、JD 和已确认事实，用于经历关联与必要补问'}。请先检查是否还有其他敏感信息。是否同意本次调用？`);
}
async function parseReviewLive({forceReparse=false}={}){
  const t=task();
  if(config.mode!=='live'||!forceReparse&&!reviewChanges(t).substantive){commitReview({forceReparse});return true;}
  if(!consentFor('parse'))return false;
  const snapshot=taskSnapshot(t),draft=reviewDraft(t);busy='正在解析校对材料';error='';render();
  try{const parsed=await requestAI('parse',{...draft,consent:true});assertCurrentTask(task(),snapshot,t.id);commitReview({parsed,forceReparse:true});t.parseMeta=parsed.meta;persist();return true;}
  finally{busy='';render();}
}
async function fetchModelAnalysis(t){
  const snapshot=taskSnapshot(t),data=await requestAI('analyze',{task:structuredClone(t),consent:true});
  assertCurrentTask(task(),snapshot,t.id);
  if(!Array.isArray(data.associations)||!Array.isArray(data.questions))throw Error('AI 对照不完整，已保留当前内容。');
  t.aiAnalysis={key:analysisKey(t),associations:data.associations,questions:data.questions,meta:data.meta};
  refreshAnalysis(t);t.aiAnalysis.key=analysisKey(t);
}
async function updateModelAnalysis(){
  const t=task();if(!consentFor('analyze'))return false;
  busy='正在关联经历并生成必要补问';error='';render();
  try{await fetchModelAnalysis(t);persist('AI 对照与补问已更新，请核对依据');return true;}
  finally{busy='';render();}
}

function goStep(step){
  const t=task(),pending=t.reviewDirty||t.materialResume!==undefined||t.materialJD!==undefined;
  if(step>1&&pending){if(reviewChanges(t).substantive)throw Error('请先在校对页应用内容修改并确认。');commitReview({announce:false});}
  if(step>1&&t.reviewNeedsConfirmation)throw Error('内容已变化，请先在校对页完成核对确认。');
  if(step===2)refreshAnalysis(t);if(!persist())return;t.step=step;t.maxStep=Math.max(t.maxStep,step);persist();render();window.scrollTo(0,0);
}
// Keep an unfinished fact with its own resume section when changing the target.
function selectFactDraft(t,experienceId){
  const previous=t.extraFactExp||t.experiences.find(isContentUnit)?.id;
  t.extraFactDrafts??={};
  if(previous)t.extraFactDrafts[previous]=t.extraFactDraft||'';
  t.extraFactExp=experienceId;t.extraFactDraft=t.extraFactDrafts[experienceId]||'';
}
function openSupplement(experienceId){
  const t=task();
  if(!t.experiences.some(e=>e.id===experienceId&&isContentUnit(e)))throw Error('该简历部分已变化，请先返回校对页核对。');
  goStep(2);if(t.step!==2)return;
  const fact=t.facts.find(f=>f.experienceId===experienceId&&f.status==='conflict')||t.facts.find(f=>f.experienceId===experienceId&&f.status==='pending');
  const question=t.questions.find(q=>q.experienceId===experienceId&&(q.status==='pending'||q.editing));
  let target=fact?document.getElementById('fact-'+fact.id):question?document.getElementById('question-'+question.id):null;
  if(!target){
    selectFactDraft(t,experienceId);persist();render();
    target=$('.add-fact-panel');target.open=true;
  }
  target.scrollIntoView({block:'start'});
  target.querySelector('textarea,input,button')?.focus({preventScroll:true});
}
function retireFacts(ids){
  db.facts=db.facts.filter(f=>!ids.includes(f.id));
  for(const other of db.tasks){if(other.id===currentId)continue;let affected=false;for(const f of other.facts||[])if(ids.includes(f.id)){f.status='pending';delete f.confirmedAt;affected=true;}if(affected)bump(other);}
}
function addFact(experienceId,text,questionId){
  const t=task();if(!text?.trim())throw Error('请先填写具体信息，或选择跳过。');if(text.length>3000)throw Error('单条补充事实最多 3000 字。');
  const original=t.experiences.find(e=>e.id===experienceId)?.text||'',conflict=detectFactConflicts(text,original).length>0;
  if(questionId)retireFacts(replaceAnswer(t,questionId,{text:text.trim(),status:'provided'}));
  const fact={id:uid(),experienceId,text:text.trim(),status:conflict?'conflict':'pending',source:'用户补充',questionId,requirementId:t.questions.find(q=>q.id===questionId)?.requirementId};
  t.facts.push(fact);refreshAnalysis(t);bump(t);log('fact_provided',{experienceId,text,conflict});persist(conflict?'补充可能与原文冲突，请在汇总区核对':'回答已提交，请在新增事实中核对确认');render();
  return fact;
}
function changeAssociationSources(t,requirementId,ids){
  const a=t.associations.find(a=>a.requirementId===requirementId);
  ids=[...new Set(ids)].filter(id=>t.experiences.some(e=>e.id===id&&isContentUnit(e)));
  const previous=a.links?.find(link=>link.experienceId===ids[0]);
  Object.assign(a,{experienceId:ids[0]||'',experienceIds:ids,evidence:t.experiences.find(e=>e.id===ids[0])?.text||'',status:previous?.status||'尚未确认',manual:true,manualStatus:previous?.manualStatus||false,reason:'用户已调整关联内容，请依据原文核对。',needsClarification:previous?.needsClarification??true});
  t.requestedQuestionKey=requirementId+':'+(ids.at(-1)||'');refreshAnalysis(t);bump(t);persist();render();
}

function saveConfirmedFact(f){const t=task();const source=[t.experiences.find(e=>e.id===f.experienceId)?.text,...t.facts.filter(x=>x.id!==f.id&&x.experienceId===f.experienceId&&x.status==='confirmed').map(x=>x.text)].join('\n');const conflicts=detectFactConflicts(f.text,source);if(conflicts.length){f.status='conflict';bump(t);persist();render();throw Error(conflicts.join(' ')+' 请先解决冲突。');}f.status='confirmed';f.confirmedAt=new Date().toISOString();if(t.experiences.some(e=>e.id===f.experienceId&&isContentUnit(e)))t.selected=[...new Set([...t.selected,f.experienceId])];if(f.questionId){const q=t.questions.find(q=>q.id===f.questionId);if(q)q.status='confirmed';}const stored={...f,baseId:t.baseId,experienceTitle:t.experiences.find(e=>e.id===f.experienceId)?.title,experienceSource:t.experiences.find(e=>e.id===f.experienceId)?.text};db.facts=db.facts.filter(x=>x.id!==f.id);db.facts.push(stored);refreshAnalysis(t);bump(t);log('fact_confirmed',{fact:f});persist('已确认事实，可用于本次改写');}
let regenId=null;
async function generate(id=null,consent=false){const t=task();if(t.reviewDirty||t.materialResume!==undefined||t.materialJD!==undefined){if(reviewChanges(t).substantive)throw Error('请先在校对页应用并确认材料修改。');commitReview({announce:false});}if(t.reviewNeedsConfirmation)throw Error('请先完成材料校对确认。');if(!t.selected.length)throw Error('请在修改清单中选择经历；如果无需修改，可点击“无需改写，直接预览”。');if(config.mode==='live'&&!consent){regenId=id;modal='consent';render();return;}if(busy)return;const revision=t.revision,taskId=t.id;busy=id?'正在生成新的候选稿':'正在整理依据并生成建议';modal=null;error='';render();try{if(config.mode==='live'&&!hasCurrentAnalysis(t))await fetchModelAnalysis(t);const snapshot=taskSnapshot(t),input=structuredClone(t);if(id)input.selected=[t.suggestions.find(s=>s.id===id).experienceId];const data=await requestAI('generate',{task:input,consent});assertCurrentTask(task(),snapshot,taskId);if(data.meta)t.generationMeta=data.meta;if(task()?.id!==taskId||t.revision!==revision)throw Error('材料已变化，旧结果已忽略。请使用最新材料重新生成。');if(!Array.isArray(data.suggestions)||!data.suggestions.length)throw Error('模型未返回完整建议，请重试。');if(id){const s=t.suggestions.find(s=>s.id===id);const next=data.suggestions.find(n=>n.experienceId===s.experienceId);if(!next)throw Error('本次未获得该经历的候选，请重试。');s.pendingCandidate={...next,revision};}else if(t.suggestions.length){for(const next of data.suggestions){const previous=t.suggestions.find(s=>s.experienceId===next.experienceId);if(previous)previous.pendingCandidate={...next,revision};else t.suggestions.push({...next,status:'pending',revision});}t.stale=false;t.step=3;t.maxStep=Math.max(3,t.maxStep);}else{t.suggestions=data.suggestions.map(s=>({...s,status:'pending',revision}));t.stale=false;t.step=3;t.maxStep=3;}log('generation_success',{suggestions:data.suggestions});persist('建议已生成，请逐条核对');}catch(e){error=e.message;log('generation_failure',{error:e.message});try{localStorage.setItem(KEY,JSON.stringify(db));}catch{} }finally{busy='';render();if(!error)window.scrollTo(0,0);}}
document.addEventListener('input',ev=>{const el=ev.target,t=task();if(view==='new'&&['resume','jd','role','company'].includes(el.name)){db.createInput[el.name]=el.value;const counter=$(`#${el.name}-count`);if(counter)counter.textContent=`${el.value.length} / ${config.maxTextLength} 字`;changed();return;}if(!t)return;if(el.id==='extra-fact'){t.extraFactDraft=el.value;changed();}if(el.id==='fact-edit-text'&&modal?.type==='fact')modal.text=el.value;if(el.dataset.profileUnit)editProfileField(el,t);if(el.dataset.exp){t.experiences.find(e=>e.id===el.dataset.exp).text=el.value;t.reviewDirty=true;changed();if(t.materialResume===undefined&&$('[name=materialResume]'))$('[name=materialResume]').value=reviewDraft(t).resume;syncReviewHint();syncReviewDiffs();}if(el.dataset.answer){const q=t.questions.find(q=>q.id===el.dataset.answer);if(q.editing)q.draftAnswer=el.value;else q.answer=el.value;changed();}if(el.dataset.suggestion){const s=t.suggestions.find(s=>s.id===el.dataset.suggestion);s.editedText=el.value;s.needsConfirmation=true;s.status='pending';const card=el.closest('.suggestion'),accept=card?.querySelector('[data-action=accept]');if(accept){accept.disabled=false;accept.className='primary small';accept.textContent='接受建议';}const status=card?.querySelector('[data-suggestion-status]');if(status)status.innerHTML=badge('待确认','amber');changed();}if(['materialResume','materialJD'].includes(el.name)){t[el.name]=el.value;changed();if(el.name==='materialResume')document.querySelectorAll('[data-exp],[data-kind],[data-profile-unit]').forEach(node=>node.disabled=true);syncReviewHint();syncReviewDiffs();}if(el.name==='taskName'){t.name=el.value;changed();}if(el.name==='taskRole'){t.role=el.value;changed();}});
document.addEventListener('change',async ev=>{try{const el=ev.target,t=task();if(el.id==='pdf-input'){const file=el.files[0];if(!file)return;if(!file.name.toLowerCase().endsWith('.pdf'))throw Error('首版仅支持可提取文字的 PDF；请改用文本粘贴。');if(file.size>config.maxFileBytes)throw Error(`PDF 不能超过 ${Math.round(config.maxFileBytes/1048576)} MB，请缩减或粘贴文本。`);busy='正在本机提取 PDF 文字';render();try{const r=await fetch('/api/pdf',{method:'POST',headers:{'Content-Type':'application/pdf'},body:file});const data=await r.json();if(!r.ok)throw Error(data.error||'PDF 提取失败');db.createInput.resume=data.text;db.createInput.baseId='';delete db.createInput.resumePdf;
try{db.createInput.resumePdf=await savePdfSource(file,config.maxFileBytes);}catch(e){persist();throw Error('文字已提取；'+e.message);}
persist();}finally{busy='';render();}return;}if(el.id==='review-pdf-input'){const file=el.files[0];if(!file||!t)return;busy='正在关联简历 PDF 原件';render();try{const reference=await savePdfSource(file,config.maxFileBytes);t.resumePdf=reference;const base=db.bases.find(b=>b.id===t.baseId);if(base)base.resumePdf=reference;reviewReferenceStates.set(t.id,{mode:'resume',manual:true});persist('PDF 原件已关联，校对内容保持不变');}finally{busy='';render();}return;}if(el.name==='baseId'){const base=db.bases.find(b=>b.id===el.value);db.createInput.baseId=el.value;db.createInput.resume=base?.corrected||'';db.createInput.resumePdf=base?.resumePdf;persist();render();}if(el.id==='test-consent'){db.testConsent=el.checked;persist();}if(!t)return;if(el.id==='parse-confirm'&&el.checked){error='';syncFeedback();}if(el.id==='extra-exp'){selectFactDraft(t,el.value);$('#extra-fact').value=t.extraFactDraft;changed();}if(el.name==='correctionType'){t.correctionType=el.value;changed();}if(el.dataset.kind){const exp=t.experiences.find(e=>e.id===el.dataset.kind);exp.kind=el.value;exp.kindOverride=el.value;t.reviewDirty=true;t.reviewMetadataDirty=true;if(el.value==='experience')t.selected=[...new Set([...t.selected,exp.id])];else if(!isContentUnit(exp))t.selected=t.selected.filter(id=>id!==exp.id);changed();render();}if(el.dataset.req){t.requirements.find(r=>r.id===el.dataset.req).category=el.value;t.reviewDirty=true;t.reviewMetadataDirty=true;changed();syncReviewHint();
  const tile=document.querySelector('[data-category-card="'+el.dataset.req+'"]');
  if(tile){tile.className='review-requirement-card category-'+categoryStyle(el.value);tile.querySelector('[data-category-label]').textContent=el.value;}
}if(el.dataset.select){t.selected=el.checked?[...new Set([...t.selected,el.dataset.select])]:t.selected.filter(id=>id!==el.dataset.select);refreshAnalysis(t);bump(t);persist();render();}if(el.dataset.assoc){const a=t.associations.find(a=>a.requirementId===el.dataset.assoc);changeAssociationSources(t,el.dataset.assoc,el.value?[el.value,...(a.experienceIds||[]).filter(id=>id!==a.experienceId&&id!==el.value)]:[]);}
if(el.dataset.assocAdd){const a=t.associations.find(a=>a.requirementId===el.dataset.assocAdd),ids=a.experienceIds||[a.experienceId].filter(Boolean);changeAssociationSources(t,el.dataset.assocAdd,el.checked?[...ids,el.dataset.unit]:ids.filter(id=>id!==el.dataset.unit));}
if(el.dataset.assocStatus){const a=t.associations.find(a=>a.requirementId===el.dataset.assocStatus),link=a.links?.find(x=>x.experienceId===el.dataset.unit);const patch={status:el.value,needsClarification:['表达不足','尚未确认'].includes(el.value),manual:true,manualStatus:true,reason:'用户已依据基础简历核对本项判断。'};if(link)Object.assign(link,patch);if(!el.dataset.unit||a.experienceId===el.dataset.unit)Object.assign(a,patch);t.requestedQuestionKey=el.dataset.assocStatus+':'+el.dataset.unit;refreshAnalysis(t);bump(t);persist();render();}}catch(e){busy='';reportError(e.message,ev.target);}});
document.addEventListener('click',async ev=>{const b=ev.target.closest('[data-action]');if(!b||busy)return;const action=b.dataset.action,t=task(),id=b.dataset.id;try{switch(action){
case 'nav':navigate(b.dataset.view);break;
case 'new':navigate('new');break;
case 'to-tasks':navigate('tasks');break;
case 'dismiss':error='';syncFeedback();document.querySelectorAll('.field-error').forEach(n=>n.remove());break;
case 'jump':document.getElementById(b.dataset.target)?.scrollIntoView({behavior:'smooth',block:'start'});break;
case 'help':modal='help';render();break;
case 'settings':modal='settings';render();break;
case 'close-modal':modal=null;render();break;
case 'sample':db.createInput={resume:sample.resume,jd:sample.jd,role:sample.role||'产品实习生',company:sample.company||'示例科技（虚构）'};persist();render();toast('已填入虚构演示材料，可自由修改');break;
case 'upload':$('#pdf-input').click();break;
case 'attach-review-pdf':$('#review-pdf-input').click();break;
case 'detach-input-pdf':delete db.createInput.resumePdf;persist();render();break;
case 'create':{const f=db.createInput;ensureInput(f.resume||'',f.jd||'');let parsed;if(config.mode==='live'){if(!consentFor('parse'))break;const draft=JSON.stringify(f);busy='正在解析简历和岗位要求';render();try{parsed=await requestAI('parse',{resume:f.resume,jd:f.jd,consent:true});if(view!=='new'||JSON.stringify(db.createInput)!==draft)throw Error('输入已变化，旧解析已忽略。');}finally{busy='';render();}}else parsed=parseMaterials(f.resume,f.jd);let base=db.bases.find(x=>x.id===f.baseId&&x.corrected===f.resume);if(!base){base={id:uid(),name:`基础简历 ${db.bases.length+1}`,original:f.resume,corrected:f.resume,resumePdf:f.resumePdf,createdAt:new Date().toISOString()};db.bases.push(base);}if(base.experiences)parsed.experiences=reconcileExperiences(parsed.experiences,base.experiences).experiences;const now=new Date().toISOString();const nt={id:uid(),baseId:base.id,resumePdf:base.resumePdf,name:[f.company,f.role||'岗位任务'].filter(Boolean).join(' · '),role:f.role||'',company:f.company||'',resumeOriginal:f.resume,jdOriginal:f.jd,resumeCorrected:f.resume,jdCorrected:f.jd,experiences:parsed.experiences,requirements:parsed.requirements,parseWarnings:parsed.warnings,parseMeta:parsed.meta,selected:parsed.experiences.filter(e=>e.kind!=='context').map(e=>e.id),facts:db.facts.filter(x=>x.status==='confirmed'&&x.baseId===base.id&&parsed.experiences.some(e=>e.id===x.experienceId&&isFormattingOnly(e.text,x.experienceSource||''))).map(x=>({...x})),associations:[],questions:[],suggestions:[],parserVersion:2,revision:1,step:1,maxStep:1,createdAt:now,updatedAt:now};db.tasks.push(nt);currentId=nt.id;log('task_created',{parsed});db.createInput={};persist('任务已创建，原始材料已保留');view='work';render();window.scrollTo(0,0);break;}
case 'open':currentId=id;if(task().step===1&&task().parserVersion!==2){commitReview({forceReparse:true,announce:false});}if(task().step>=2){refreshAnalysis(task());}navigate('work');break;
case 'step':if(Number(b.dataset.step)===3&&!t.suggestions.length)throw Error('请先生成建议。');goStep(Number(b.dataset.step));break;
case 'save':if(t)t.updatedAt=new Date().toISOString();log('draft_save_requested');const didSave=persist('草稿已保存至本机');log('draft_save_result',{success:didSave});if(didSave)persist();render();break;
case 'original':modal='original';render();break;
case 'back-material':goStep(0);break;
case 'back-parse':goStep(1);break;
case 'back-analysis':goStep(2);break;
case 'supplement-experience':openSupplement(id);break;
case 'back-rewrite':goStep(3);break;
case 'toggle-resume':t.resumeEditorOpen=!t.resumeEditorOpen;render();break;
case 'toggle-jd':t.jdEditorOpen=!t.jdEditorOpen;render();if(t.jdEditorOpen)$('[name=materialJD]')?.focus({preventScroll:true});break;
case 'edit-jd':t.jdEditorOpen=true;render();$('#review-jd-card').scrollIntoView({block:'nearest',behavior:'smooth'});$('[name=materialJD]')?.focus({preventScroll:true});break;
case 'discard-resume':delete t.materialResume;t.resumeEditorOpen=false;changed();render();break;
case 'discard-jd':delete t.materialJD;t.jdEditorOpen=false;changed();render();break;
case 'apply-review':if(!await parseReviewLive())break;t.resumeEditorOpen=false;t.jdEditorOpen=false;render();break;
case 'reparse-review':if(!await parseReviewLive({forceReparse:true}))break;render();break;
case 'update-materials':if(!await parseReviewLive())break;t.step=1;t.resumeEditorOpen=false;t.jdEditorOpen=false;persist();render();break;
case 'confirm-parse':{
  if(requiresReviewConfirmation(t)&&!$('#parse-confirm')?.checked)throw Error('请先勾选确认，完成本次材料核对。');
  if(config.mode==='live'&&reviewChanges(t).substantive){await parseReviewLive();toast('材料已重新解析，请核对后确认');break;}
  const affirmed=$('#parse-confirm')?.checked;
  commitReview({announce:false});
  if(t.reviewNeedsConfirmation&&!affirmed)throw Error('识别范围有变化，请核对后再确认。');
  if(config.mode==='live'&&!hasCurrentAnalysis(t)&&!await updateModelAnalysis())break;
  t.reviewNeedsConfirmation=false;refreshAnalysis(t);if(t.maxStep<2){t.selected=getRewritePlan(t).filter(p=>p.priority!=='keep').map(p=>p.experienceId);refreshAnalysis(t);}t.step=2;t.maxStep=Math.max(t.maxStep,2);t.reviewConfirmedAt=new Date().toISOString();
  log('parsed_confirmed',{experiences:t.experiences,requirements:t.requirements,associations:t.associations});persist('校对已确认');render();window.scrollTo(0,0);break;
}
case 'answer':{const q=t.questions.find(q=>q.id===id);addFact(q.experienceId,q.editing?q.draftAnswer:q.answer,id);break;}
case 'edit-answer':beginAnswerEdit(t,id);changed();persist();render();if(b.dataset.jump)document.getElementById('question-'+id)?.scrollIntoView({block:'start'});break;
case 'cancel-answer':cancelAnswerEdit(t,id);persist();render();break;
case 'request-question':t.requestedQuestionKey=b.dataset.key;refreshAnalysis(t);persist();render();break;
case 'regenerate-questions':{if(config.mode==='live'){await updateModelAnalysis();break;}const association=t.associations.find(a=>a.requirementId===b.dataset.requirement);const gap=association?.links?.find(a=>a.needsClarification&&!a.conflict);if(gap)t.requestedQuestionKey=gap.requirementId+':'+gap.experienceId;else delete t.requestedQuestionKey;refreshAnalysis(t);persist('已按当前关联更新补问，已有回答与补充事实已保留');render();break;}
case 'extra-fact':{const experienceId=$('#extra-exp').value;if(!experienceId)throw Error('请先选择一段经历。');t.extraFactExp=experienceId;addFact(experienceId,$('#extra-fact').value);t.extraFactDraft='';if(t.extraFactDrafts)delete t.extraFactDrafts[experienceId];persist();render();break;}
case 'q-none':case 'q-unknown':case 'q-skip':case 'q-source':{
  const q=t.questions.find(q=>q.id===id),status=action==='q-none'?'none':action==='q-unknown'?'unknown':'skipped';
  const answer=action==='q-source'?'原文已提供，可以在上方核对依据。':action==='q-none'?'明确未做过这项工作。':action==='q-unknown'?'暂不确定，稍后可以继续补充。':'暂时跳过，使用现有事实。';
  retireFacts(replaceAnswer(t,id,{text:answer,status}));
  if(status==='none')t.facts.push({id:uid(),experienceId:q.experienceId,text:answer,status:'none',source:'用户回答',questionId:q.id,requirementId:q.requirementId});
  refreshAnalysis(t);bump(t);log('question_resolved',{question:q});persist();render();break;
}
case 'edit-fact':{const f=t.facts.find(f=>f.id===id);modal={type:'fact',id,text:f.text};render();break;}
case 'apply-fact-edit':{const value=$('#fact-edit-text').value.trim();if(!value||value.length>3000)throw Error('事实摘要应为 1 至 3000 字。');const f=t.facts.find(f=>f.id===modal.id);f.text=value;f.status='pending';delete f.confirmedAt;if(f.questionId){const q=t.questions.find(q=>q.id===f.questionId);if(q){q.history=[...(q.history||[]),{status:q.status,answer:q.answer,at:new Date().toISOString()}];q.answer=value;q.status='provided';delete q.editing;delete q.draftAnswer;}}db.facts=db.facts.filter(x=>x.id!==f.id);for(const other of db.tasks){if(other.id===t.id)continue;const linked=other.facts.find(x=>x.id===f.id);if(linked){linked.text=value;linked.status='pending';bump(other);}}refreshAnalysis(t);bump(t);persist('摘要已保存，请重新核对确认');modal=null;render();break;}
case 'confirm-fact':if(!$(`[data-fact-check="${id}"]`).checked)throw Error('请先勾选确认该事实真实且与原文不冲突。');saveConfirmedFact(t.facts.find(f=>f.id===id));render();break;
case 'conflict-fact':t.facts.find(f=>f.id===id).status='conflict';refreshAnalysis(t);bump(t);persist();render();break;
case 'discard-fact':{const f=t.facts.find(f=>f.id===id);f.status='unknown';if(f.questionId)t.questions.find(q=>q.id===f.questionId).status='unknown';refreshAnalysis(t);bump(t);persist();render();break;}
case 'generate':await generate();break;
case 'original-preview':t.selected=[];bump(t);t.stale=false;goStep(4);break;
case 'regenerate':await generate(id);break;
case 'consent-generate':await generate(regenId,true);regenId=null;break;
case 'accept':{const s=t.suggestions.find(s=>s.id===id);if(s.revision!==t.revision)throw Error('这条建议基于旧材料，请重新生成或保留当前原文。');if(s.needsConfirmation){modal={type:'edit',id,text:s.editedText};render();break;}s.status=s.editedText!==undefined?'edited':'accepted';log('suggestion_accepted',{suggestion:s});persist('已接受建议');render();break;}
case 'confirm-edit':{const s=t.suggestions.find(s=>s.id===id);modal={type:'edit',id,text:s.editedText};render();break;}
case 'apply-edit':{if(!$('#edit-confirm').checked)throw Error('请先确认手动修改的事实与归属。');const s=t.suggestions.find(s=>s.id===modal.id);if(s.revision!==t.revision)throw Error('建议已过期，请先重新生成后再编辑。');if(!s.editedText?.trim())throw Error('采用的内容不能为空。');const source=[t.experiences.find(e=>e.id===s.experienceId)?.text,...t.facts.filter(f=>f.experienceId===s.experienceId&&f.status==='confirmed').map(f=>f.text)].join('\n');const conflicts=detectFactConflicts(s.editedText,source);if(conflicts.length)throw Error(conflicts.join(' ')+' 请返回材料页先解决事实冲突。');s.status='edited';s.needsConfirmation=false;s.userConfirmedAt=new Date().toISOString();s.editKind=$('#edit-kind').value;log('user_edit_confirmed',{suggestion:s});persist('编辑稿已确认采用');modal=null;render();break;}
case 'reject':case 'keep':{const s=t.suggestions.find(s=>s.id===id);s.status=action==='reject'?'rejected':'original';s.needsConfirmation=false;s.revision=t.revision;t.stale=t.suggestions.some(s=>t.selected.includes(s.experienceId)&&s.revision!==t.revision);log('suggestion_resolved',{id,status:s.status});persist(action==='reject'?'已拒绝，将保留原文':'将保留校对后的原文');render();break;}
case 'use-candidate':{const s=t.suggestions.find(s=>s.id===id);if(s.pendingCandidate.revision!==t.revision)throw Error('新候选也已过期，请重新生成。');if(!confirm('采用新候选将替换此卡片的当前编辑稿。继续吗？'))break;const next=s.pendingCandidate;Object.assign(s,next,{id:s.id,status:'pending',editedText:undefined,needsConfirmation:false,pendingCandidate:undefined});t.stale=t.suggestions.some(s=>t.selected.includes(s.experienceId)&&s.revision!==t.revision);persist('新候选已替换，请核对后接受');render();break;}
case 'drop-candidate':delete t.suggestions.find(s=>s.id===id).pendingCandidate;persist();render();break;
case 'preview':goStep(4);break;
case 'copy-exp':{const s=t.suggestions.find(s=>s.id===id);await copy(['accepted','edited'].includes(s.status)?s.editedText??s.text:t.experiences.find(e=>e.id===s.experienceId)?.text||s.original);break;}
case 'copy-full':await copy(composeText(t));break;
case 'download-text':download(`${t.name}.txt`,composeText(t));break;
case 'confirm-version':{if(!$('#final-confirm').checked)throw Error('请先勾选确认完整岗位文本。');const errors=finalErrors(t);if(errors.length)throw Error(errors.join(' '));const text=composeText(t),previous=db.versions.filter(v=>v.taskId===t.id);if(previous.at(-1)?.text===text){toast('相同内容已经保存，无需重复创建版本');break;}const v={id:uid(),taskId:t.id,baseId:t.baseId,name:t.name,number:previous.length+1,text,createdAt:new Date().toISOString(),snapshot:JSON.parse(JSON.stringify(t))};db.versions.push(v);t.confirmed=true;t.updatedAt=v.createdAt;log('version_confirmed',{versionId:v.id,text});if(!persist('岗位版本已确认并保存')){db.versions.pop();t.confirmed=false;}render();break;}
case 'view-version':activeVersion=id;modal='version';render();break;
case 'copy-version':await copy(db.versions.find(v=>v.id===activeVersion).text);break;
case 'edit-version':{const v=db.versions.find(v=>v.id===id);const draft=JSON.parse(JSON.stringify(v.snapshot));draft.id=uid();draft.name=`${v.name} · 再编辑`;draft.confirmed=false;draft.createdAt=new Date().toISOString();draft.updatedAt=draft.createdAt;draft.step=3;db.tasks.push(draft);currentId=draft.id;persist('已创建新草稿，历史版本保持不变');navigate('work');break;}
case 'reuse':{const base=db.bases.find(b=>b.id===t.baseId);db.createInput={baseId:base?.id,resume:base?.corrected||t.resumeCorrected,resumePdf:sourcePdf(t),role:'',company:'',jd:''};persist();navigate('new');toast('基础材料已复用，请填写新的岗位 JD');break;}
case 'delete-task':if(confirm('删除此任务的 JD、草稿、岗位版本与关联测试记录？基础材料和已确认事实仍会保留。')){db.tasks=db.tasks.filter(t=>t.id!==id);db.versions=db.versions.filter(v=>v.taskId!==id);db.logs=db.logs.filter(l=>l.taskId!==id);persist('任务及其岗位版本已删除');render();}break;
case 'delete-fact':if(confirm('删除后将停止复用该事实，并把使用它的当前草稿标记为待更新；历史确认版本保持不变。')){db.facts=db.facts.filter(f=>f.id!==id);for(const t of db.tasks)if(t.facts.some(f=>f.id===id)){t.facts=t.facts.filter(f=>f.id!==id);bump(t);}persist('事实已删除，受影响草稿需要更新');render();}break;
case 'export-data':download('有据-本机备份.json',JSON.stringify({...db,pdfAttachments:await exportPdfSources(db)},null,2),'application/json');break;
case 'export-logs':download('有据-授权测试记录.json',JSON.stringify(db.logs,null,2),'application/json');break;
case 'clear-logs':db.logs=[];persist('测试记录已清空');render();break;
case 'delete-all':if(confirm('确定删除本应用的全部基础简历、事实、任务、版本和记录？此操作无法撤销。')){await clearPdfSources();localStorage.removeItem(KEY);db=emptyDB();reviewReferenceStates.clear();storageError='';currentId=null;modal=null;view='new';dirty=false;persist('全部应用内材料已删除');render();}break;
}}catch(e){reportError(e.message,b);}});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal){modal=null;render();}if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();persist('草稿已保存');render();}});
try{const r=await fetch('/api/config');if(!r.ok)throw Error();config={...config,...await r.json()};}catch{error='未能连接本地服务。请先运行 node server.mjs，再通过 http://127.0.0.1:4381 打开。';}
render();
