import {textDiff} from './review-presentation.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** Keep the generated candidate as the baseline, even after saving user edits.
 * Native textarea input remains plain text; only its backdrop carries marks.
 */
export function createRewriteHighlighter(original,generated) {
  // Textareas normalize CRLF on input; line-ending conversion is not a user edit.
  const normalize=value=>String(value??'').replace(/\r\n?/g,'\n');
  generated=normalize(generated);
  const baseline=textDiff(normalize(original),generated),origins=[];
  for(const op of baseline)if(op.type!=='delete')for(const char of op.text)origins.push(op.type==='insert'?'suggested':'unchanged');
  const suggestedDeletions=baseline.filter(op=>op.type==='delete').map(op=>op.text);
  return current=>{
    const spans=[],manualDeletions=[];let offset=0;
    const append=(kind,text)=>{
      if(!text)return;
      if(spans.at(-1)?.kind===kind)spans.at(-1).text+=text;
      else spans.push({kind,text});
    };
    for(const op of textDiff(generated,normalize(current))){
      if(op.type==='insert')append('manual',op.text);
      else if(op.type==='delete'){offset+=Array.from(op.text).length;manualDeletions.push(op.text);}
      else for(const char of op.text)append(origins[offset++]||'unchanged',char);
    }
    return {spans,suggestedDeletions,manualDeletions};
  };
}

export function renderRewriteMarks(spans) {
  return spans.map(span=>span.kind==='unchanged'?esc(span.text):`<mark class="rewrite-${span.kind}">${esc(span.text)}</mark>`).join('');
}

export function renderRewriteEditor(suggestion,title) {
  return `<div class="rewrite-editor" data-rewrite-editor="${esc(suggestion.id)}"><div class="rewrite-highlight-viewport" aria-hidden="true"><div class="rewrite-highlights"></div></div><textarea data-suggestion="${esc(suggestion.id)}" rows="7" spellcheck="false" aria-label="建议稿${esc(title)}" aria-describedby="rewrite-key-${esc(suggestion.id)}">${esc(suggestion.editedText??suggestion.text)}</textarea></div>`;
}

export function renderRewriteLegend(id) {
  return `<div class="rewrite-diff-legend" id="rewrite-key-${esc(id)}"><span><i class="rewrite-suggested" aria-hidden="true"></i>杏色 · 建议改动</span><span><i class="rewrite-manual" aria-hidden="true"></i>绿色 · 你的修改</span></div>`;
}

export function renderRewriteDeletions(id) {
  return `<details class="rewrite-deletions" data-open-key="rewrite-deletions-${esc(id)}" hidden><summary>查看删除对比</summary><div class="rewrite-deletion-content"></div></details>`;
}

/** Refresh the backdrop only: never replace the textarea, its selection, undo
 * stack or composition. Size it to the content viewport (excluding scrollbar).
 */
export function bindRewriteEditors(root,task) {
  const disposers=[];
  for(const wrapper of root.querySelectorAll('[data-rewrite-editor]')){
    const suggestion=task?.suggestions.find(s=>s.id===wrapper.dataset.rewriteEditor);
    if(!suggestion)continue;
    const original=task.experiences.find(e=>e.id===suggestion.experienceId)?.text??suggestion.original;
    const highlight=createRewriteHighlighter(original,suggestion.text);
    const input=wrapper.querySelector('textarea'),viewport=wrapper.querySelector('.rewrite-highlight-viewport'),mirror=wrapper.querySelector('.rewrite-highlights');
    const deletions=wrapper.closest('.suggestion').querySelector('.rewrite-deletions');
    let composing=false;
    const syncScroll=()=>{viewport.scrollTop=input.scrollTop;viewport.scrollLeft=input.scrollLeft;};
    const measure=()=>{
      const style=getComputedStyle(input);
      for(const prop of ['fontFamily','fontSize','fontWeight','fontStyle','fontVariant','lineHeight','letterSpacing','wordSpacing','textAlign','textIndent','textTransform','tabSize','paddingTop','paddingRight','paddingBottom','paddingLeft','whiteSpace','wordBreak','overflowWrap'])mirror.style[prop]=style[prop];
      Object.assign(viewport.style,{top:input.offsetTop+input.clientTop+'px',left:input.offsetLeft+input.clientLeft+'px',width:input.clientWidth+'px',height:input.clientHeight+'px'});
      syncScroll();
    };
    const refresh=()=>{
      if(composing)return;
      const diff=highlight(input.value);
      // A sentinel gives a trailing newline the same final line as a textarea.
      mirror.innerHTML=renderRewriteMarks(diff.spans)+'\u200b';
      deletions.hidden=!diff.suggestedDeletions.length&&!diff.manualDeletions.length;
      deletions.querySelector('.rewrite-deletion-content').innerHTML=[['suggested','建议稿删去',diff.suggestedDeletions],['manual','你的编辑删去',diff.manualDeletions]].filter(([, ,parts])=>parts.length).map(([kind,label,parts])=>`<div><strong>${label}</strong>${parts.map(text=>`<del class="rewrite-${kind}">${esc(text)}</del>`).join('')}</div>`).join('');
      measure();
    };
    const start=()=>{composing=true;},end=()=>{composing=false;refresh();};
    input.addEventListener('input',refresh);
    input.addEventListener('scroll',syncScroll,{passive:true});
    input.addEventListener('compositionstart',start);
    input.addEventListener('compositionend',end);
    const observer=new ResizeObserver(measure);observer.observe(input);
    refresh();
    disposers.push(()=>{observer.disconnect();input.removeEventListener('input',refresh);input.removeEventListener('scroll',syncScroll);input.removeEventListener('compositionstart',start);input.removeEventListener('compositionend',end);});
  }
  return ()=>disposers.forEach(dispose=>dispose());
}
