import {openPdf,readPdfSource} from './pdf-source.js';

function bindPdfPreview(card,attachment,state){
  const status=card.querySelector('.pdf-preview-status'),viewport=card.querySelector('.pdf-page-viewport');
  const canvas=card.querySelector('canvas'),toolbar=card.querySelector('.pdf-preview-toolbar');
  const pageNumber=card.querySelector('[data-pdf-page]'),zoom=card.querySelector('[data-pdf-zoom]');
  let document,loading,rendering,disposed=false,started=false,sequence=0,timer=0,lastWidth=0;
  state.page??=1;state.zoom??='fit';zoom.value=state.zoom;
  const showError=message=>{status.hidden=false;status.textContent=message;viewport.hidden=true;toolbar.hidden=true;};
  const updateControls=()=>{
    pageNumber.textContent=`第 ${state.page} / ${document.numPages} 页`;
    card.querySelector('[data-pdf-prev]').disabled=state.page<=1;
    card.querySelector('[data-pdf-next]').disabled=state.page>=document.numPages;
    canvas.setAttribute('aria-label',`基础简历 PDF 原页，第 ${state.page} 页，共 ${document.numPages} 页`);
  };
  async function draw(){
    if(!document||disposed||card.hidden)return;
    const ticket=++sequence;
    card.dataset.pdfReady='false';
    rendering?.cancel();
    updateControls();
    try{
      const page=await document.getPage(state.page);
      if(disposed||ticket!==sequence)return;
      const original=page.getViewport({scale:1}),width=Math.max(100,viewport.clientWidth-24);
      const scale=state.zoom==='fit'?width/original.width:Number(state.zoom);
      const view=page.getViewport({scale}),ratio=Math.min(devicePixelRatio||1,2);
      // Render off-screen so a cancelled render cannot paint a newer page.
      const next=globalThis.document.createElement('canvas');
      next.width=Math.ceil(view.width*ratio);next.height=Math.ceil(view.height*ratio);
      rendering=page.render({canvas:next,viewport:view,transform:ratio===1?null:[ratio,0,0,ratio,0,0]});
      await rendering.promise;
      if(disposed||ticket!==sequence)return;
      canvas.width=next.width;canvas.height=next.height;
      canvas.style.width=view.width+'px';canvas.style.height=view.height+'px';
      canvas.getContext('2d').drawImage(next,0,0);
      viewport.scrollTop=0;viewport.scrollLeft=0;
      status.hidden=true;canvas.hidden=false;
      card.dataset.pdfReady='true';
    }catch(error){if(!disposed&&ticket===sequence&&error.name!=='RenderingCancelledException')showError('这一页暂时无法显示，请重新关联 PDF 原件后重试。');}
  }
  async function show(){
    if(started||disposed)return;
    if(!attachment){showError('尚未关联 PDF 原件。可选回原 PDF 对照，现有校对内容会保留。');return;}
    started=true;
    status.textContent='正在显示 PDF 原页…';
    try{
      const record=await readPdfSource(attachment.id);
      if(disposed)return;
      if(!record?.blob){showError('这份 PDF 原件不在当前浏览器中，请重新关联原文件。');return;}
      loading=await openPdf(record.blob);
      if(disposed){await loading.destroy();return;}
      loading.onPassword=()=>loading.destroy();
      document=await loading.promise;
      if(disposed)return;
      state.page=Math.min(Math.max(1,state.page),document.numPages);
      viewport.hidden=false;toolbar.hidden=false;
      await draw();
    }catch{if(!disposed)showError('PDF 原件暂时无法显示，请重新关联可直接打开的原文件。');}
  }
  const changePage=delta=>{if(!document)return;state.page=Math.min(document.numPages,Math.max(1,state.page+delta));draw();};
  const click=event=>{if(event.target.closest('[data-pdf-prev]'))changePage(-1);if(event.target.closest('[data-pdf-next]'))changePage(1);};
  const zoomChange=()=>{state.zoom=zoom.value;draw();};
  card.addEventListener('click',click);zoom.addEventListener('change',zoomChange);
  const observer=new ResizeObserver(()=>{
    if(card.hidden)return;
    const width=viewport.clientWidth;if(width===lastWidth)return;lastWidth=width;
    clearTimeout(timer);timer=setTimeout(()=>{if(state.zoom==='fit')draw();},100);
  });observer.observe(viewport);
  return {show:()=>{show();if(document)draw();},dispose:()=>{disposed=true;sequence++;clearTimeout(timer);observer.disconnect();rendering?.cancel();loading?.destroy().catch(()=>{});card.removeEventListener('click',click);zoom.removeEventListener('change',zoomChange);}};
}

/** Follow the main document only. Scrolling or editing the reference itself
 * never changes the active material or moves the main document.
 */
export function bindReviewReference(root,{attachment,state={},jdOpen=false}={}){
  if(!root)return ()=>{};
  const aside=root.querySelector('.review-reference'),pdf=aside.querySelector('#review-pdf-card'),jd=aside.querySelector('#review-jd-card');
  const requirement=root.querySelector('#review-requirements-card'),header=globalThis.document.querySelector('.work-navigation');
  const tabs=[...aside.querySelectorAll('[data-review-reference]')];
  const preview=bindPdfPreview(pdf,attachment,state.pdf??={});
  let frame=0,disposed=false,manualY=state.manual?scrollY:null,active='';
  const activate=mode=>{
    if(active===mode)return;
    active=mode;state.mode=mode;
    pdf.hidden=mode!=='resume';jd.hidden=mode!=='jd';
    for(const tab of tabs){const current=tab.dataset.reviewReference===mode;tab.setAttribute('aria-selected',String(current));tab.tabIndex=current?0:-1;}
    if(mode==='resume')preview.show();
  };
  function update(){
    frame=0;if(disposed)return;
    if(manualY!==null&&Math.abs(scrollY-manualY)<=24)return;
    if(jd.contains(globalThis.document.activeElement)&&globalThis.document.activeElement.matches('textarea'))return;
    manualY=null;state.manual=false;
    // On narrow screens both references sit above the editor; keep the tabs usable.
    if(matchMedia('(max-width:900px)').matches)return;
    const top=Math.max(0,header?.getBoundingClientRect().bottom||0);
    const anchor=top+Math.min(200,(innerHeight-top)*.3);
    activate(requirement.getBoundingClientRect().top<=anchor?'jd':'resume');
  }
  const schedule=()=>{if(!disposed&&!frame)frame=requestAnimationFrame(update);};
  const click=event=>{
    const tab=event.target.closest('[data-review-reference]');if(!tab)return;
    manualY=scrollY;state.manual=true;activate(tab.dataset.reviewReference);
  };
  const keydown=event=>{
    if(!event.target.matches('[data-review-reference]')||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();const next=event.key==='Home'?tabs[0]:event.key==='End'?tabs[1]:tabs.find(tab=>tab!==event.target);next.click();next.focus();
  };
  aside.addEventListener('click',click);aside.addEventListener('keydown',keydown);
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);
  const observer=new ResizeObserver(schedule);observer.observe(root.querySelector('.review-main'));if(header)observer.observe(header);
  activate(state.mode||(jdOpen?'jd':'resume'));if(!jdOpen)update();
  return ()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();preview.dispose();aside.removeEventListener('click',click);aside.removeEventListener('keydown',keydown);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);};
}
