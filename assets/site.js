/* Sell NFT — shared site behavior: ambient bg, scroll reveals, app transition */
(function(){
  document.documentElement.classList.add('js'); // gate reveal-hiding on JS being alive

  // ---- inject ambient background + transition overlay (keeps HTML clean) ----
  const bg=document.createElement('div');bg.className='bg';
  bg.innerHTML='<div class="blob a"></div><div class="blob b"></div><div class="blob c"></div><div class="grid-tex"></div><div class="noise"></div>';
  document.body.prepend(bg);

  const overlay=document.createElement('div');overlay.className='app-transition';
  overlay.innerHTML='<div class="warp"><div class="g"><svg width="34" height="34" viewBox="0 0 32 32" fill="none"><path d="M16 2 30 12 16 30 2 12z" fill="#9C7BFF"/><path d="M16 2 30 12 16 18 2 12z" fill="#fff" opacity=".3"/></svg></div></div>';
  document.body.appendChild(overlay);

  // ---- scroll reveal (with graceful fallback if IO is unavailable) ----
  const reveals=document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window){
    const io=new IntersectionObserver((es)=>{
      es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});
    },{threshold:.14,rootMargin:'0px 0px -8% 0px'});
    reveals.forEach(el=>io.observe(el));
    // safety net: if anything above the fold hasn't fired shortly after load, reveal it
    addEventListener('load',()=>setTimeout(()=>{
      reveals.forEach(el=>{const r=el.getBoundingClientRect();if(r.top<innerHeight&&r.bottom>0)el.classList.add('in');});
    },400));
  }else{
    reveals.forEach(el=>el.classList.add('in'));
  }

  // ---- cinematic "Open App" transition ----
  function goApp(href){
    overlay.classList.add('on');
    setTimeout(()=>{location.href=href;},560);
  }
  document.querySelectorAll('[data-app-link]').forEach(a=>{
    a.addEventListener('click',e=>{
      const href=a.getAttribute('href');
      if(!href||e.metaKey||e.ctrlKey)return; // allow open-in-new-tab
      e.preventDefault();goApp(href);
    });
  });

  // ---- active nav link by filename ----
  const here=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  document.querySelectorAll('.nav-links a').forEach(a=>{
    const t=(a.getAttribute('href')||'').toLowerCase();
    if(t===here||(here==='index.html'&&(t==='index.html'||t==='./'||t==='/')))a.classList.add('active');
  });

  // ---- mobile nav (hamburger) ----
  const navEl=document.querySelector('.nav');
  const navToggle=document.querySelector('.nav-toggle');
  if(navEl&&navToggle){
    const setOpen=o=>{navEl.classList.toggle('open',o);navToggle.setAttribute('aria-expanded',o);};
    navToggle.addEventListener('click',e=>{e.stopPropagation();setOpen(!navEl.classList.contains('open'));});
    navEl.querySelectorAll('.nav-links a').forEach(a=>a.addEventListener('click',()=>setOpen(false)));
    document.addEventListener('click',e=>{if(navEl.classList.contains('open')&&!navEl.contains(e.target))setOpen(false);});
    addEventListener('resize',()=>{if(innerWidth>920)setOpen(false);});
  }

  // ---- hero live-preview terminal: loop drop → appraise → offer over the user's NFT image ----
  const term=document.querySelector('.termcard');
  if(term){
    const cap=document.getElementById('tcCap');
    const flow=[].slice.call(document.querySelectorAll('.tc-flow span'));
    const seq=[
      {cls:'state-ready', cap:'Drop an NFT — get its price instantly', step:0, d:1900},
      {cls:'state-scan',  cap:'Reading traits, floor & live bids…',    step:1, d:1250},
      {cls:'state-priced',cap:'Firm instant offer · settles in ~9s',    step:2, d:2600}
    ];
    let i=0;
    function paint(){
      const s=seq[i];
      term.className='termcard '+s.cls;
      if(cap)cap.textContent=s.cap;
      flow.forEach((f,x)=>f.classList.toggle('on',x===s.step));
    }
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){ i=2; paint(); } // static "priced" frame, no loop
    else{ (function loop(){ paint(); setTimeout(()=>{ i=(i+1)%seq.length; loop(); }, seq[i].d); })(); }
  }

  // ---- tiny mono count-up for [data-count] (honest, conceptual figures only) ----
  const cio=new IntersectionObserver((es)=>{
    es.forEach(e=>{
      if(!e.isIntersecting)return;cio.unobserve(e.target);
      const el=e.target,to=parseFloat(el.dataset.count),suf=el.dataset.suffix||'',dec=+(el.dataset.dec||0),t0=performance.now();
      (function step(t){let p=Math.min(1,(t-t0)/1100);p=1-Math.pow(1-p,3);
        el.textContent=(to*p).toFixed(dec)+suf;if(p<1)requestAnimationFrame(step);})(t0);
    });
  },{threshold:.5});
  document.querySelectorAll('[data-count]').forEach(el=>cio.observe(el));
})();
