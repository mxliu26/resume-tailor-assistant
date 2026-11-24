import {icon} from './visual-assets.js';
import {hasCurrentAnalysis} from './ai-state.js';
import {questionCovers,questionRequirementIds} from './question-scope.js';
import {getRequirementAssessments, getRewritePlan} from './analysis-model.js';
import {unitPresentation} from './unit-presentation.js';
import {isContentUnit} from './material-units.js';
import {categoryStyle,requirementCategories} from './review-presentation.js';

const answerLabels={confirmed:'已确认',provided:'待确认',skipped:'已跳过',unknown:'暂不确定',none:'明确未做过',archived:'历史记录'};
const summaryAssessment=results=>results.find(a=>a.association?.conflict)||results.find(a=>a.association?.needsClarification)||results.find(a=>a.status!=='已有明确证据')||results[0];
const nextAction=result=>result.association?.conflict?'先核对下方冲突事实，再决定是否用于改写。':({
  '已有明确证据':'现有依据已明确，可保留原文。',
  '表达不足':result.association?.needsClarification===false?'补充已确认，可在底部选择调整表达。':'补充实际职责、方法或产出；也可以暂时保留原文。',
  '相关但不等价':'突出相关工作，保留工作类型与职责边界。',
  '尚未确认':result.experienceId?'核实这部分材料能否支持要求，不确定可以稍后补充。':'先关联简历中的相关内容；没有材料时保留未知。',
  '确认没有相关经历':'保留真实缺口；答案有变化时可重新编辑。',
  '按已提供信息符合':'保留已有条件信息，无需改写。',
  '存在明确差异':'核实条件差异，不更改真实信息以迎合岗位。',
  '待确认':'核对学历或到岗条件，也可在底部主动补充。'
}[result.status]||result.action);

export function renderComparison(t,{esc,btn,badge,config={mode:"mock"}}) {
  const exps=t.experiences.filter(isContentUnit),selected=new Set(t.selected),plan=getRewritePlan(t);
  const title=id=>unitPresentation(t.experiences.find(e=>e.id===id)||{}).title;
  const evidenceOrigin=a=>t.facts.some(f=>f.experienceId===a.experienceId&&f.status==='confirmed'&&a.evidence?.includes(f.text))?'原文与已确认补充':'校对原文';
  const key=(reqId,expId)=>`${reqId}:${expId}`;
  const statusOptions=['已有明确证据','表达不足','相关但不等价','尚未确认','确认没有相关经历'];
  const evidenceView=(a,r,index,condition)=>{
    const content=`${a.evidence?`<blockquote>${esc(a.evidence)}</blockquote>`:`<p class="muted">${condition?'现有材料尚不能核实这项条件。':'尚未找到可确认的对应依据，可以关联简历内容或保留未知。'}</p>`}${a.experienceId?`<details data-open-key="evidence-${r.id}-${a.experienceId}"><summary>查看关联内容全文</summary><div class="original">${esc(exps.find(e=>e.id===a.experienceId)?.text)}</div></details>`:''}`;
    if(index>0)return `<details class="evidence-source evidence-extra" data-open-key="extra-evidence-${r.id}-${a.experienceId}"><summary><span>${esc(title(a.experienceId))}</span><small>补充依据 · ${esc(a.status)}</small></summary><div class="evidence-detail">${content}</div></details>`;
    return `<div class="evidence-source evidence-primary"><div class="evidence-caption"><span class="evidence-origin">${esc(evidenceOrigin(a))}</span>${a.experienceId?`来自 ${esc(title(a.experienceId))}`:'对应原文'}</div>${content}</div>`;
  };
  const questionView=(q,index)=>{
    const editing=q.editing||q.status==='pending'||!q.status;
    const facts=t.facts.filter(f=>f.questionId===q.id);
    return `<section class="question" id="question-${q.id}">
      <div class="question-head"><span class="question-kicker">补问 ${(t.questions||[]).filter(item=>item.status!=='archived').indexOf(q)+1||index+1}</span>${badge(q.editing?'正在修改':answerLabels[q.status]||'待回答',!q.editing&&q.status==='confirmed'?'green':'gray')}</div>
      <h4>${esc(q.text)}</h4>
      ${q.purpose?`<p class="smalltext">提问用途：${esc(q.purpose)}</p>`:''}
      ${q.relatedRequirementIds?.length?`<p class="smalltext">合并核实要求 ${questionRequirementIds(q).map(id=>String(t.requirements.findIndex(r=>r.id===id)+1).padStart(2,'0')).join('、')}，回答一次即可；仅确认你明确提供的事实。</p>`:''}
      ${editing?`<label class="answer-field"><span>你的回答</span><textarea data-answer="${q.id}" aria-label="补充${esc(title(q.experienceId))}的事实" placeholder="写清你实际做了什么、如何完成，以及已有的结果。">${esc(q.editing?q.draftAnswer:q.answer)}</textarea></label><div class="answer-submit">${btn(q.editing?'保存新回答':'提交回答，核对事实','answer','primary small',`data-id="${q.id}"`)}${q.editing?btn('取消修改','cancel-answer','small ghost',`data-id="${q.id}"`):''}<span class="smalltext">提交后还需确认事实</span></div><div class="answer-alternatives"><span>暂不补充：</span>${btn('未做过','q-none','small ghost',`data-id="${q.id}"`)}${btn('不记得','q-unknown','small ghost',`data-id="${q.id}"`)}${btn('跳过','q-skip','small ghost',`data-id="${q.id}"`)}${btn('原文已提供','q-source','small ghost',`data-id="${q.id}"`)}</div>`:
      `<div class="question-answer"><div class="row-between"><strong>你的回答</strong><div class="button-row">${btn('修改回答','edit-answer','small',`data-id="${q.id}"`)}</div></div><p>${esc(q.answer||'暂不补充，保留已有事实。')}</p>${facts.length?btn(facts.some(f=>f.status==='pending'||f.status==='conflict')?'核对这条补充事实':'查看已确认事实','jump','small ghost',`data-target="fact-${facts[0].id}"`):''}</div>`}
      ${q.history?.length?`<details class="answer-history"><summary>查看之前的回答（${q.history.length}）</summary>${q.history.map(h=>`<div class="original"><small>${esc(answerLabels[h.status]||h.status)}</small>\n${esc(h.answer)}</div>`).join('')}</details>`:''}
    </section>`;
  };
  const linkedQuestions=new Set();
  const requirements=t.requirements.map((r,i)=>{
    const results=getRequirementAssessments(t,r),result=results[0],condition=r.category==='明确条件';
    const linkedIds=results.map(a=>a.experienceId).filter(Boolean);
    const questions=(t.questions||[]).filter(q=>q.requirementId===r.id&&linkedIds.includes(q.experienceId)&&q.status!=='archived');
    questions.forEach(q=>linkedQuestions.add(q.id));
    const sharedQuestions=(t.questions||[]).filter(q=>q.requirementId!==r.id&&q.relatedRequirementIds?.includes(r.id)&&linkedIds.includes(q.experienceId)&&q.status!=='archived');
    const waiting=results.filter(a=>a.experienceId&&a.association?.needsClarification&&!a.association?.conflict&&(!hasCurrentAnalysis(t)||a.association?.origin!=='ai')&&![...questions,...sharedQuestions].some(q=>questionCovers(q,r.id,a.experienceId)));
    return `<article class="requirement-card category-${categoryStyle(r.category)}" id="requirement-${r.id}">
      <div class="requirement-context"><span>岗位要求 ${String(i+1).padStart(2,'0')}</span><p>${esc(r.text)}</p></div>
      <div class="requirement-evidence">
        <section class="evidence-panel" aria-label="岗位要求 ${i+1} 的简历依据"><div class="requirement-tile-head"><span class="pair-label">基础简历依据</span><span class="category-chip">${esc(r.category)}</span>${linkedIds.length>1?`<span class="source-count">${linkedIds.length} 处依据</span>`:''}</div>${results.map((a,index)=>evidenceView(a,r,index,condition)).join('')}</section>
      </div>
      <div class="requirement-resolution">
        <section class="judgment-card" aria-label="岗位要求 ${i+1} 的判断建议"><div class="judgment-head"><span class="judgment-icon" aria-hidden="true">${icon('bookmark')}</span><strong>判断建议</strong><span class="judgment-status">${esc(summaryAssessment(results).status)}</span></div>${results.map(a=>`<div class="judgment-line">${linkedIds.length>1?`<span>${esc(title(a.experienceId))} · ${esc(a.status)}</span>`:''}<p>${esc(nextAction(a))}</p></div>`).join('')}<details class="judgment-reason"><summary>查看判断依据</summary>${results.map(a=>`<p>${esc(a.association?.reason||'根据原文核对，未提供的信息保持未知。')}</p>`).join('')}</details></section>
        <details class="association-editor" data-open-key="association-${r.id}"><summary>调整关联内容或判断</summary>
          ${!condition?`<label class="field"><span>主要对应内容</span><select data-assoc="${r.id}" aria-label="岗位要求 ${i+1} 的关联内容"><option value="">尚未找到对应内容</option>${exps.map(e=>`<option value="${e.id}" ${result.experienceId===e.id?'selected':''}>${esc(title(e.id))}${e.kind==='context'?' · 基础信息':''}</option>`).join('')}</select></label><fieldset class="additional-sources"><legend>还可以添加其他依据</legend><div>${exps.filter(e=>e.id!==result.experienceId).map(e=>`<label class="checkline"><input type="checkbox" data-assoc-add="${r.id}" data-unit="${e.id}" ${linkedIds.includes(e.id)?'checked':''}><span>${esc(title(e.id))}</span></label>`).join('')}</div></fieldset>`:''}
          ${results.map(a=>`<label class="field"><span>${condition?'核对明确条件':`核对依据 · ${esc(title(a.experienceId))}`}</span><select data-assoc-status="${r.id}" data-unit="${a.experienceId}" aria-label="岗位要求 ${i+1} 的依据判断${a.experienceId?' · '+esc(title(a.experienceId)):''}">${(condition?['待确认','按已提供信息符合','存在明确差异']:statusOptions).map(s=>`<option ${a.status===s?'selected':''}>${s}</option>`).join('')}</select></label>`).join('')}<small>依据可以来自经历、技能、教育等简历内容。选择依据不会自动改变改写范围。</small>
        </details>
        ${!condition&&linkedIds.length?`<div class="followup-refresh">${btn('按当前关联更新补问','regenerate-questions','small',`data-requirement="${r.id}"`)}</div>`:''}
        ${questions.map(questionView).join('')}
        ${sharedQuestions.map(q=>`<div class="question-queue"><span>此缺口已合并到同一条补问，无需重复回答。</span>${btn('查看合并补问','jump','small',`data-target="question-${q.id}"`)}</div>`).join('')}
        ${waiting.map(a=>`<div class="question-queue"><span>可以继续核实「${esc(title(a.experienceId))}」中的相关事实。</span>${btn('补充这项事实','request-question','small',`data-key="${esc(key(r.id,a.experienceId))}"`)}</div>`).join('')}
      </div>
    </article>`;
  }).join('');
  const factView=f=>`<div class="fact" id="fact-${f.id}"><div class="fact-top"><span>${esc(f.questionId?'来自补问回答':'主动补充')}${f.requirementId?` · 要求 ${String(t.requirements.findIndex(r=>r.id===f.requirementId)+1).padStart(2,'0')}`:''}</span>${badge(({confirmed:'已确认 · 可用于改写',pending:'待确认',conflict:'存在冲突',unknown:'保留未知',none:'明确未做过'})[f.status]||f.status,f.status==='confirmed'?'green':f.status==='conflict'?'red':'gray')}</div><p>${esc(f.text)}</p>${f.status==='pending'?`<label class="checkline"><input type="checkbox" data-fact-check="${f.id}"><span>我确认这是本人真实信息，且与当前原文不冲突。</span></label><div class="button-row">${btn('确认并用于改写','confirm-fact','small primary',`data-id="${f.id}"`)}${btn('与原文有冲突','conflict-fact','small ghost danger',`data-id="${f.id}"`)}</div>`:''}<div class="button-row">${['pending','confirmed'].includes(f.status)?btn('编辑事实摘要','edit-fact','small ghost',`data-id="${f.id}"`):''}${f.questionId&&t.questions.some(q=>q.id===f.questionId&&q.status!=='archived')?btn('修改回答','edit-answer','small ghost',`data-id="${f.questionId}" data-jump="true"`):''}${f.status==='conflict'?btn('放弃冲突补充','discard-fact','small',`data-id="${f.id}"`)+btn('回到材料纠正','back-material','small ghost'):''}</div></div>`;
  const factGroups=t.experiences.filter(e=>t.facts.some(f=>f.experienceId===e.id)).map(e=>`<article class="fact-group"><div class="fact-group-head"><h3>${esc(title(e.id))}</h3><span>${t.facts.filter(f=>f.experienceId===e.id).length} 条补充</span></div>${t.facts.filter(f=>f.experienceId===e.id).map(factView).join('')}</article>`).join('');
  const legacy=(t.questions||[]).filter(q=>!linkedQuestions.has(q.id)&&!q.requirementId&&q.status!=='archived');
  const archived=(t.questions||[]).filter(q=>q.status==='archived'&&q.answer);
  return `<div class="comparison-layout"><div class="stack comparison-main">
    <section class="card comparison-intro"><div class="card-head"><h2>岗位要求与基础简历对照</h2><div class="button-row">${badge(config.mode==='live'?(hasCurrentAnalysis(t)?'AI 对照 · 待人工核对':'AI 对照待更新'):'规则模拟 · 本地关联与补问')}${btn(config.mode==='live'?'更新 AI 对照与补问':'重新生成补问','regenerate-questions','small')}</div></div><p>逐项核对经历依据，补充必要事实，再选择改写范围。</p><div class="category-legend" aria-label="岗位要求分类颜色">${requirementCategories.map(c=>`<span class="category-chip category-${categoryStyle(c)}">${esc(c)}</span>`).join('')}</div><div class="comparison-overview" aria-label="当前对照概况"><span><strong>${t.requirements.length}</strong>项岗位要求</span><span><strong>${(t.questions||[]).filter(q=>!q.status||q.status==='pending'||q.editing).length}</strong>项待回答</span><span><strong>${t.facts.filter(f=>f.status==='confirmed').length}</strong>条已确认事实</span></div><details class="analysis-explainer"><summary>关联和补问如何产生？</summary><p>${config.mode==='live'?'当前通过已配置模型生成候选关联与必要补问，引用原文由程序校验，判断仍需人工核对。编辑或确认事实后显示待更新，点击更新或进入改写时按需重算。':'当前使用本地关键词、工具与工作线索生成候选关联，再按依据是否充分安排补问，并未调用大模型。'}候选可能不准，可以手动替换或添加简历依据；系统随关联更新待答问题，也可点击“重新生成补问”。同一经历中相近的必要缺口可以合并回答，每批最多 3 个；信息足够时不必补问。已有回答与确认事实会保留，不会转移到新关联内容。</p></details></section>
    <section class="requirement-list" aria-label="逐项岗位要求对照">${requirements}</section>
    <section class="card extra-facts" id="facts-summary"><div class="card-head"><div><h2>补充事实汇总</h2></div>${badge(`${t.facts.filter(f=>f.status==='confirmed').length} 条已确认`,'gray')}</div><p class="smalltext">按基础简历分块整理补问回答与主动补充。仅已确认事实可以写入建议稿。</p><div class="fact-group-grid">${factGroups||'<div class="facts-empty">还没有新增事实。可以回答上方补问，或主动添加已有的真实信息。</div>'}</div>
      <details class="add-fact-panel" data-open-key="add-fact"><summary>＋ 主动补充真实事实</summary><label class="field"><span>补充到哪部分简历</span><select id="extra-exp">${exps.map(e=>`<option value="${e.id}" ${t.extraFactExp===e.id?'selected':''}>${esc(title(e.id))}</option>`).join('')}</select></label><textarea id="extra-fact" aria-label="主动补充事实" placeholder="补充学历信息、技能与优势、本人职责、实际方法或真实产出。">${esc(t.extraFactDraft||'')}</textarea>${btn('提交事实摘要','extra-fact','small primary')}</details>
      ${legacy.length?`<details><summary>之前的补问</summary>${legacy.map(questionView).join('')}</details>`:''}
      ${archived.length?`<details class="historical-questions"><summary>查看历史补问记录</summary>${archived.map(q=>`<div class="original">${esc(q.text)}\n${esc(q.answer)}</div>`).join('')}</details>`:''}
      ${t.orphanedFacts?.length?`<details><summary>${t.orphanedFacts.length} 条补充需要重新关联</summary><p class="smalltext">简历划分有变化，这些内容尚未用于改写。</p>${t.orphanedFacts.map(f=>`<div class="original">${esc(f.text)}</div>`).join('')}</details>`:''}
    </section>
    <section class="card rewrite-plan" id="rewrite-plan">
      <div class="card-head"><h2>本次修改清单</h2>${badge(`${t.selected.length} 段已选`,'gray')}</div>
      <p class="smalltext">勾选要改写的内容，其余保留原文。同一处理优先级内，优先展示有核心岗位依据的内容。</p>
      <div class="plan-grid">${plan.map(item=>{
        const e=exps.find(e=>e.id===item.experienceId),p=unitPresentation(e);
        const requirements=item.requirementIds.map(id=>t.requirements.findIndex(r=>r.id===id)+1).filter(n=>n>0).map(n=>String(n).padStart(2,'0')).join('、');
        return `<article class="plan-card priority-${item.priority}">
          <label class="checkline exp-select"><input type="checkbox" data-select="${e.id}" ${selected.has(e.id)?'checked':''}><span><span class="plan-unit-heading"><strong>${esc(p.title)}</strong><span class="priority-label">${esc(item.label)}</span></span>${p.meta?`<small class="unit-meta">${esc(p.meta)}</small>`:''}</span></label>
          <details class="plan-details" data-open-key="plan-${e.id}"><summary><span>查看详情</span>${requirements?`<small>对应要求 ${requirements}</small>`:''}</summary><p>${esc(item.reason)}</p>${item.focus.length?`<p class="smalltext">可优先回应的岗位要求（依据见上方对照）：${item.focus.map(f=>esc(f.text)).join('；')}</p>`:''}<div class="original">${esc(e.text)}</div></details>
        </article>`;
      }).join('')}</div>
      <div class="footer-actions">${btn('返回校对','back-parse')}<div class="button-row"><small>可跳过补问，按已有事实继续</small>${btn('无需改写，直接预览','original-preview','small ghost')}${btn('进入改写工作台','generate','primary')}</div></div>
    </section>
    </div><aside class="comparison-sidebar"><section class="card"><div class="eyebrow">岗位要求与进度</div><h3>${t.requirements.length} 项岗位要求</h3><nav class="requirement-nav" aria-label="岗位要求导航">${t.requirements.map((r,i)=>{const a=summaryAssessment(getRequirementAssessments(t,r));return `<button type="button" class="requirement-reference-card category-${categoryStyle(r.category)}" data-action="jump" data-target="requirement-${r.id}" aria-controls="requirement-${r.id}" title="${esc(r.text)}" aria-label="查看岗位要求 ${i+1} 对应的简历依据"><span class="requirement-tile-head"><span class="requirement-number">${String(i+1).padStart(2,'0')}</span><span class="category-chip">${esc(r.category)}</span></span><span class="nav-requirement-text">${esc(r.text)}</span>${badge(a.status,a.tone)}</button>`;}).join('')}</nav><div class="stack sidebar-shortcuts">${btn('查看新增事实','jump','small','data-target="facts-summary"')}${btn('查看修改清单','jump','primary small','data-target="rewrite-plan"')}</div><div class="reference-note">未知不等于没有；补充须确认后再用于改写。</div></section><details class="card comparison-jd"><summary>回看 JD 全文</summary><div class="original">${esc(t.jdCorrected||t.jdOriginal)}</div></details></aside></div>`;
}
