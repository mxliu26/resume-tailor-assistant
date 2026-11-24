/** Keep the requirement reference in view without scrolling the document itself. */
export function bindComparisonNavigation(root) {
  if(!root)return ()=>{};
  const sidebar=root.querySelector('.comparison-sidebar');
  const nav=root.querySelector('.requirement-nav');
  const header=document.querySelector('.work-navigation');
  const sections=[...root.querySelectorAll('.requirement-card[id]')];
  const buttons=[...nav.querySelectorAll('.requirement-reference-card')];
  const byId=new Map(buttons.map(button=>[button.dataset.target,button]));
  let activeId='',frame=0,pinTimer=0,pinnedId='',pinnedUntil=0,disposed=false;
  const compact=()=>matchMedia('(max-width:900px)').matches;

  function reveal(button) {
    const scroller=compact()?nav:sidebar;
    const bounds=scroller.getBoundingClientRect(),item=button.getBoundingClientRect();
    if(compact()) {
      const start=bounds.left+8,end=bounds.right-8;
      if(item.left<start||item.right>end)scroller.scrollTo({left:scroller.scrollLeft+item.left-start,behavior:'instant'});
    } else {
      const start=Math.max(bounds.top,header?.getBoundingClientRect().bottom||0)+12;
      const end=Math.min(bounds.bottom,innerHeight)-12;
      if(end<=start)return;
      if(item.top<start||item.bottom>end)scroller.scrollTo({top:scroller.scrollTop+item.top-start,behavior:'instant'});
    }
  }

  function activate(id) {
    if(id===activeId)return;
    activeId=id;
    for(const button of buttons) {
      const current=button.dataset.target===id;
      button.classList.toggle('is-current',current);
      if(current)button.setAttribute('aria-current','location');
      else button.removeAttribute('aria-current');
    }
    if(byId.has(id))reveal(byId.get(id));
  }

  function update() {
    frame=0;
    if(disposed||!root.isConnected)return;
    // A sidebar click should not flash through intermediate requirements while
    // the existing smooth document jump is in progress.
    if(performance.now()<pinnedUntil){activate(pinnedId);return;}
    const top=Math.max(0,header?.getBoundingClientRect().bottom||0)+16;
    const bottom=innerHeight-16,center=(top+bottom)/2;
    let next='',nearest=Infinity;
    for(const section of sections) {
      const rect=section.getBoundingClientRect();
      if(rect.bottom<=top||rect.top>=bottom)continue;
      const distance=rect.top>center?rect.top-center:rect.bottom<center?center-rect.bottom:0;
      if(distance<nearest){next=section.id;nearest=distance;}
    }
    activate(next);
  }

  function schedule(){if(!disposed&&!frame)frame=requestAnimationFrame(update);}
  function resize(){schedule();if(activeId)reveal(byId.get(activeId));}
  function release(event) {
    if(sidebar.contains(event.target))return;
    if(event.type==='keydown'&&!['ArrowDown','ArrowUp','PageDown','PageUp','Home','End',' '].includes(event.key))return;
    pinnedUntil=0;
    clearTimeout(pinTimer);
    schedule();
  }
  function jump(event) {
    const button=event.target.closest('[data-action="jump"]');
    if(!button||!root.contains(button))return;
    pinnedId=byId.has(button.dataset.target)?button.dataset.target:'';
    pinnedUntil=performance.now()+1400;
    clearTimeout(pinTimer);
    pinTimer=setTimeout(()=>{pinnedUntil=0;schedule();},1400);
    activate(pinnedId);
    schedule();
  }

  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',resize);
  window.addEventListener('wheel',release,{passive:true});
  window.addEventListener('touchstart',release,{passive:true});
  window.addEventListener('pointerdown',release);
  window.addEventListener('keydown',release);
  root.addEventListener('click',jump);
  const observer=new ResizeObserver(schedule);
  sections.forEach(section=>observer.observe(section));
  if(header)observer.observe(header);
  schedule();
  return ()=>{
    disposed=true;
    cancelAnimationFrame(frame);
    clearTimeout(pinTimer);
    observer.disconnect();
    window.removeEventListener('scroll',schedule);
    window.removeEventListener('resize',resize);
    window.removeEventListener('wheel',release);
    window.removeEventListener('touchstart',release);
    window.removeEventListener('pointerdown',release);
    window.removeEventListener('keydown',release);
    root.removeEventListener('click',jump);
  };
}
