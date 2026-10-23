/* Shared device behavior; data and identity navigation stay in existing modules. */
(()=>{
 const controls=document.getElementById('controls');if(!controls)return;
 let frame=0;
 function fit(){
  const active=controls.querySelector('.kind-tab.active'),rail=controls.querySelector('.library-kinds');
  if(active&&rail){
   const a=active.getBoundingClientRect(),r=rail.getBoundingClientRect();
   if(a.left<r.left)rail.scrollLeft+=a.left-r.left-4;
   else if(a.right>r.right)rail.scrollLeft+=a.right-r.right+4;
  }
  const input=controls.querySelector('.search');
  if(input){input.type='search';input.enterKeyHint='search';input.autocapitalize='off';input.spellcheck=false;}
 }
 const schedule=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(fit)};
 new MutationObserver(schedule).observe(controls,{childList:true,subtree:true});
 controls.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches('.search')&&matchMedia('(max-width:900px)').matches)e.target.blur()});
 window.addEventListener('resize',schedule,{passive:true});fit();
})();
