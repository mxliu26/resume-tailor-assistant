import {icon} from './visual-assets.js';
import {reviewDraft, reviewChanges, requiresReviewConfirmation} from './review-state.js';
import {unitPresentation} from './unit-presentation.js';
import {categoryStyle,requirementCategories,reviewSections,profileParts,renderTextDiff,unitReviewBefore,materialReviewBefore} from './review-presentation.js';

export function renderReviewChangeSummary(t,esc){
  const draft=reviewDraft(t),resumeBefore=materialReviewBefore(t,'resume',draft.resume),jdBefore=materialReviewBefore(t,'jd',draft.jd);
  if(resumeBefore===draft.resume&&jdBefore===draft.jd)return '';
  return `<div class="review-change-summary"><div class="row-between"><strong>校对修改记录</strong><span class="smalltext">绿色为新增 · 红色删除线为删除</span></div>${resumeBefore!==draft.resume?`<details data-open-key="resume-diff-summary"><summary>查看整份简历的修改</summary>${renderTextDiff(resumeBefore,draft.resume,esc)}</details>`:''}${jdBefore!==draft.jd?`<details data-open-key="jd-diff-summary"><summary>查看 JD 的修改</summary>${renderTextDiff(jdBefore,draft.jd,esc)}</details>`:''}<small>展示当前未应用的改动，或最近一次已应用的改动；最初输入仍单独保留。</small></div>`;
}

export function renderReview(t,{esc,btn,badge,config,resumePdf=t.resumePdf}) {
  const draft=reviewDraft(t), change=reviewChanges(t);
  const resumeOpen=t.resumeEditorOpen||t.materialResume!==undefined;
  const jdOpen=t.jdEditorOpen||t.materialJD!==undefined;
  const units=t.experiences.filter(e=>e.kind!=='context');
  const sections=reviewSections(t.experiences);
  const diffSlot=(id,before,current)=>`<div class="review-diff-slot" data-diff-for="${id}" data-diff-before="${esc(JSON.stringify(before))}">${renderTextDiff(before,current,esc)}</div>`;
  const needsConfirm=requiresReviewConfirmation(t);
  const note=change.substantive?'内容或识别分类有改动。应用后请核对更新结果，已有建议会标记待更新。':change.formattingOnly?'仅调整了换行、空白或列表样式，不需要重新确认事实。':'可以在本页编辑完整简历、单段经历和 JD；原始输入始终保留。';
  const unitEditor=e=>{const display=unitPresentation(e);return `<div class="review-unit">
    <div class="review-unit-head ${e.kind==='context'?'context-edit-head':''}">${e.kind==='context'?'':`<div class="unit-heading"><h3>${esc(display.title)}</h3>${display.meta?`<p class="unit-meta">${esc(display.meta)}</p>`:''}</div>`}<label class="kind-field"><span class="sr-only">${esc(display.title)}的内容类型</span><select data-kind="${e.id}" aria-label="${esc(display.title)}的内容类型" ${t.materialResume!==undefined?'disabled':''}><option value="experience" ${e.kind==='experience'?'selected':''}>经历单元</option><option value="context" ${e.kind==='context'?'selected':''}>基础信息</option></select></label></div>
    <textarea id="review-edit-${e.id}" data-exp="${e.id}" rows="${e.kind==='context'?3:5}" aria-label="校对${esc(display.title)}" ${t.materialResume!==undefined?'disabled':''}>${esc(e.text)}</textarea>
    ${diffSlot(`review-edit-${e.id}`,unitReviewBefore(t,e),e.text)}
    <details><summary>查看本段读取来源</summary><div class="original">${esc(e.sourceText||e.original)}</div></details>
  </div>`;};
  const profileEditor=section=>`<details class="context-unit profile-section" data-open-key="${section.id}"><summary><span class="context-summary-label">${esc(section.title)}</span>${badge('基础信息 · 默认保留','gray')}</summary><div class="profile-fields">${section.parts.map(part=>{
    const e=part.unit,id=`profile-edit-${e.id}-${part.index}`,before=unitReviewBefore(t,e);
    const oldPart=profileParts({...e,text:before},t.experiences.indexOf(e))[part.index];
    const oldText=oldPart?.type===part.type?oldPart.text:'';
    return `<div class="profile-field"><label class="field"><span>${esc(part.label)}</span><textarea id="${id}" rows="${part.text.trim().length<36?1:2}" data-profile-unit="${e.id}" data-profile-start="${part.start}" data-profile-end="${part.end}" aria-label="校对${esc(part.label)}" ${t.materialResume!==undefined?'disabled':''}>${esc(part.text)}</textarea></label>${diffSlot(id,oldText,part.text)}<details><summary>查看对应读取来源</summary><div class="original">${esc(e.sourceText||e.original)}</div></details></div>`;
  }).join('')}</div></details>`;
  return `<div class="review-layout">
    <div class="stack review-main">
      <section class="card" id="review-resume-card">
        <div class="card-head"><div><h2>简历材料</h2><p class="smalltext review-subtitle">已识别 ${units.length} 段经历 · ${sections.length-units.length} 组基础信息</p></div><div class="button-row">${btn(resumeOpen?'收起全文':'编辑完整简历','toggle-resume','small')}${btn('重新识别','reparse-review','small ghost')}</div></div>
        <div class="info review-change-note" id="review-change-note" role="status">${note}</div>
        ${resumeOpen?`<div class="full-material-editor"><label class="field"><span>完整简历文本</span><textarea id="full-resume-edit" name="materialResume" rows="13" aria-label="完整简历文本">${esc(draft.resume)}</textarea><small>支持直接编辑或粘贴全文，无需额外插入空行。</small></label>${diffSlot('full-resume-edit',materialReviewBefore(t,'resume',draft.resume),draft.resume)}<div class="row-between"><small>上限 ${config.maxTextLength} 字</small><div class="button-row">${btn('撤销全文修改','discard-resume','small ghost')}${btn('应用简历修改','apply-review','small primary')}</div></div></div>`:''}
        ${!units.length?`<div class="info warning review-warning">还不能确定独立经历。可点“重新识别”，或直接把下方包含项目、实习等工作的内容类型设为“经历单元”。这不代表你没有相关经历。</div>`:''}
        ${t.parseWarnings?.filter(w=>!w.includes('未识别')).map(w=>`<p class="smalltext">${esc(w)}</p>`).join('')||''}
        ${sections.map(section=>section.type==='profile'?profileEditor(section):section.unit.kind==='context'?`<details class="context-unit" data-open-key="context-${section.unit.id}"><summary><span class="context-summary-label">${esc(unitPresentation(section.unit).title)}</span>${badge('基础信息 · 默认保留','gray')}</summary>${unitEditor(section.unit)}</details>`:unitEditor(section.unit)).join('')}
        <div id="review-change-summary">${renderReviewChangeSummary(t,esc)}</div>
        <div class="review-inline-footer"><small>类型判断不准时可直接调整；数字、职责和工具以真实材料为准。</small>${btn('应用校对修改','apply-review','small')}</div>
      </section>
      <section class="card" id="review-requirements-card"><div class="card-head"><div><h2>岗位要求</h2><p class="smalltext review-subtitle">共 ${t.requirements.length} 项 · 对照 JD 原文核对</p></div><span class="review-reference-hint"><span class="desktop-hint">在右侧查看与编辑 JD</span><span class="compact-hint">在上方查看与编辑 JD</span><span aria-hidden="true" class="reference-arrow">→</span></span></div>
        <div class="category-legend" aria-label="岗位要求分类颜色">${requirementCategories.map(c=>`<span class="category-chip category-${categoryStyle(c)}">${esc(c)}</span>`).join('')}</div>
        <div class="review-requirement-grid">${t.requirements.map((r,i)=>`<article class="review-requirement-card category-${categoryStyle(r.category)}" data-category-card="${r.id}"><div class="requirement-tile-head"><span class="requirement-number">${String(i+1).padStart(2,'0')}</span><span class="category-chip" data-category-label="${r.id}">${esc(r.category)}</span></div><p class="requirement-copy">${esc(r.text)}</p><label class="field"><span>要求分类</span><select data-req="${r.id}" aria-label="岗位要求 ${i+1} 的分类">${requirementCategories.map(c=>`<option ${r.category===c?'selected':''}>${c}</option>`).join('')}</select></label></article>`).join('')}</div>
      </section>
      <section class="card review-confirm-card">
        <div id="review-confirm-wrap" ${needsConfirm?'':'hidden'}><label class="checkline"><input type="checkbox" id="parse-confirm"><span>我已核对经历和岗位要求；如新增或修改了事实，我确认内容属实。</span></label></div>
        <div id="review-confirmed-note" class="smalltext" ${needsConfirm?'hidden':''}>已完成事实校对。格式调整不会撤销已有确认。</div>
        <div class="footer-actions"><small>所有材料修改均可在本页完成。</small>${btn('确认校对，查看对照','confirm-parse','primary')}</div>
      </section>
    </div>
    <aside class="review-reference">
      <div class="review-reference-tabs" role="tablist" aria-label="校对参照材料"><button type="button" role="tab" id="review-pdf-tab" aria-controls="review-pdf-card" aria-selected="true" data-review-reference="resume">简历原件</button><button type="button" role="tab" id="review-jd-tab" aria-controls="review-jd-card" aria-selected="false" tabindex="-1" data-review-reference="jd">JD 原文</button><small>随左侧内容切换</small></div>
      <section class="card pdf-reference review-source-card" id="review-pdf-card" role="tabpanel" aria-labelledby="review-pdf-tab">
        <div class="card-head"><div class="head-title"><span class="card-icon">${icon('document')}</span><h2>简历原件</h2></div>${btn(resumePdf?'重新关联':'关联原 PDF','attach-review-pdf','small')}</div>
        <input type="file" id="review-pdf-input" accept="application/pdf,.pdf" hidden aria-label="关联基础简历原 PDF">
        <p class="smalltext pdf-source-name" title="${esc(resumePdf?.name||'')}">${resumePdf?esc(resumePdf.name)+' · PDF 原页':'原件用于对照，不会替换已校对的文字'}</p>
        <div class="pdf-preview-toolbar" hidden><div class="button-row"><button type="button" class="small" data-pdf-prev aria-label="上一页 PDF">‹</button><span data-pdf-page aria-live="polite"></span><button type="button" class="small" data-pdf-next aria-label="下一页 PDF">›</button></div><label><span class="sr-only">PDF 显示比例</span><select data-pdf-zoom aria-label="PDF 显示比例"><option value="fit">适合宽度</option><option value="0.75">75%</option><option value="1">100%</option><option value="1.5">150%</option><option value="2">200%</option></select></label></div>
        <div class="pdf-preview-status" role="status">${resumePdf?'正在显示 PDF 原页…':'尚未关联 PDF 原件。可选回原 PDF 对照，现有校对内容会保留。'}</div>
        <div class="pdf-page-viewport" hidden tabindex="0" aria-label="简历 PDF 原页预览，可滚动"><canvas role="img" aria-label="基础简历 PDF 原页" hidden></canvas></div>
        <details class="pdf-source-text"><summary>查看最初提取或粘贴的文字</summary><div class="original">${esc(t.resumeOriginal)}</div></details>
      </section>
      <section class="card jd-reference review-source-card" id="review-jd-card" role="tabpanel" aria-labelledby="review-jd-tab" hidden>
        <div class="card-head"><div class="head-title"><span class="card-icon">${icon('briefcase')}</span><h2>JD 原文</h2></div>${btn(jdOpen?'收起编辑':'编辑 JD','toggle-jd','small')}</div>
        <p class="smalltext">当前校对材料 · 与左侧要求逐项对照</p>
        ${jdOpen?`<label class="field"><span>编辑 JD 全文</span><textarea id="full-jd-edit" name="materialJD" rows="15" aria-label="编辑 JD 全文">${esc(draft.jd)}</textarea></label>${diffSlot('full-jd-edit',materialReviewBefore(t,'jd',draft.jd),draft.jd)}<div class="button-row jd-actions">${btn('撤销 JD 修改','discard-jd','small ghost')}${btn('应用 JD 修改','apply-review','primary small')}</div>`:`<div class="jd-fulltext pretext" tabindex="0" aria-label="当前 JD 全文">${esc(draft.jd)}</div>${renderTextDiff(materialReviewBefore(t,'jd',draft.jd),draft.jd,esc)}`}
        <details class="original-jd"><summary>查看最初输入的 JD</summary><div class="original">${esc(t.jdOriginal)}</div></details>
        <div class="reference-note">岗位要求只决定表达重点，不能作为个人经历的事实来源。</div>
      </section>
    </aside>
  </div>`;
}
