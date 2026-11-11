// Sort presentation copies; stable asset IDs, catalog order and numbers never change.
(() => {
 const key='vicky-gallery-order-v1';
 let direction='asc';
 try { if(localStorage.getItem(key)==='desc')direction='desc'; } catch {}
 const compare=(a,b)=>{
  const x=Number.isFinite(a.library_number)?a.library_number:null;
  const y=Number.isFinite(b.library_number)?b.library_number:null;
  if(x===null||y===null)return x===y?0:x===null?1:-1;
  return (direction==='desc'?-1:1)*(x-y);
 };
 const sorted=items=>[...items].sort(compare);
 const imageList=filtered,voices=voiceList,music=bgmList,videos=videoList;
 filtered=(...args)=>sorted(imageList(...args));
 voiceList=(...args)=>sorted(voices(...args));
 videoList=(...args)=>sorted(videos(...args));
 bgmList=(...args)=>bgmOrder==='popular'?music(...args):sorted(music(...args));
 // Flat image browsing follows the same order as the visible cards.
 const detailEntries=detailAssetEntries;
 detailAssetEntries=function(){
  const entries=detailEntries();
  if(activeKind==='character'&&!groupByCharacter){
   const seen=new Set();
   return entries.filter(e=>{if(seen.has(e.asset))return false;seen.add(e.asset);return true}).sort((a,b)=>compare(a.asset,b.asset));
  }
  if(activeKind==='character'&&groupByCharacter){
   const first=new Map();
   for(const e of entries)if(!first.has(e.role)||compare(e.asset,first.get(e.role))<0)first.set(e.role,e.asset);
   return entries.sort((a,b)=>compare(first.get(a.role),first.get(b.role))||compare(a.asset,b.asset));
  }
  return entries;
 };
 const baseControls=renderControls;
 renderControls=function(){
  baseControls();
  const rail=controls.querySelector('.navigation-tools');if(!rail)return;
  const label=document.createElement('label');label.className='gender-control order-control';
  const caption=document.createElement('span');caption.textContent='排列';label.append(caption);
  const select=document.createElement('select');select.id='gallery-order';select.setAttribute('aria-label','排列顺序');
  const options=[['asc','编号顺序 ↑'],['desc','编号倒序 ↓']];
  if(activeKind==='bgm')options.push(['popular','热门 / 熟悉优先']);
  for(const [value,text] of options){const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option)}
  select.value=activeKind==='bgm'&&bgmOrder==='popular'?'popular':direction;
  select.onchange=()=>{
   if(select.value==='popular')bgmOrder='popular';
   else {direction=select.value;if(activeKind==='bgm')bgmOrder='number';try{localStorage.setItem(key,direction)}catch{}}
   selectedAssets.clear();render();controls.querySelector('#gallery-order')?.focus({preventScroll:true});
  };
  label.append(select);
  const old=controls.querySelector('#bgm-order');
  if(old)old.replaceWith(label);else {
   const anchor=rail.querySelector('[data-label-backup],.recycle-shortcut,#batch-mode');
   // Bulk controls may wrap the anchor in a nested action group.
   const sibling=anchor&&[...rail.children].find(child=>child.contains(anchor));
   rail.insertBefore(label,sibling||null);
  }
 };
 render();
})();
