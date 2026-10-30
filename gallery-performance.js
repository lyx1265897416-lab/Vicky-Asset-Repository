// Keep the full catalogue available to search/navigation, but bound live DOM work.
const galleryPageSize = 48;
let galleryPage = 0, galleryPageScope = '', galleryPageTotal = 0;
const gallerySearchCache = new WeakMap();
let galleryRoleIndex;
function galleryRoleAssets(id) {
  if(!galleryRoleIndex){
    galleryRoleIndex=new Map();
    for(const asset of assets)for(const role of asset.character_ids){
      if(!galleryRoleIndex.has(role))galleryRoleIndex.set(role,[]);
      galleryRoleIndex.get(role).push(asset);
    }
  }
  return galleryRoleIndex.get(id)||[];
}
function gallerySearchHay(asset) {
  if (!gallerySearchCache.has(asset)) gallerySearchCache.set(asset,
    (asset.title+' '+asset.source+' '+asset.category+' '+(asset.scene_names||[]).join(' ')+' '+asset.character_names.join(' ')+' '+asset.view_label).toLowerCase());
  return gallerySearchCache.get(asset);
}
function galleryThumbURL(asset) {
  return asset.thumbnail_path || assetURL(asset);
}
function galleryPageItems(items) {
  const scope=JSON.stringify([activeKind,activeCollection,query,activeStyle,activeSpecies,activeCategory,
    activeCharacter,activeProject,activeReadiness,activeGender,activeScene,groupByCharacter,
    [...controls.querySelectorAll('select')].map(input=>[input.id,input.value])]);
  if(scope!==galleryPageScope){galleryPage=0;galleryPageScope=scope}
  galleryPageTotal=items.length;
  galleryPage=Math.max(0,Math.min(galleryPage,Math.ceil(items.length/galleryPageSize)-1));
  return items.slice(galleryPage*galleryPageSize,(galleryPage+1)*galleryPageSize);
}
function galleryPaintPager() {
  let pager=document.getElementById('gallery-pager');
  if(!pager){pager=document.createElement('nav');pager.id='gallery-pager';pager.setAttribute('aria-label','素材分页');grid.after(pager)}
  const pages=Math.ceil(galleryPageTotal/galleryPageSize);
  pager.hidden=pages<=1;
  if(pager.hidden){pager.replaceChildren();return}
  const start=galleryPage*galleryPageSize+1,end=Math.min((galleryPage+1)*galleryPageSize,galleryPageTotal);
  pager.innerHTML=`<span role="status">${start}–${end} / ${galleryPageTotal} 项 · 第 ${galleryPage+1} / ${pages} 页</span>`;
  for(const [label,target] of [['首页',0],['上一页',galleryPage-1],['下一页',galleryPage+1],['末页',pages-1]]){
    const button=document.createElement('button');button.type='button';button.textContent=label;
    button.disabled=target<0||target>=pages||target===galleryPage;
    button.onclick=()=>{galleryPage=target;renderGrid();window.scrollTo({top:0,behavior:'instant'});title.tabIndex=-1;title.focus({preventScroll:true})};
    pager.append(button);
  }
}
function installGalleryPerformance() {
  const baseGrid=renderGrid;
  renderGrid=function(){const started=performance.now();baseGrid();galleryPaintPager();document.documentElement.dataset.galleryRenderMs=(performance.now()-started).toFixed(1)};
  let searchTimer=0;
  controls.addEventListener('input',event=>{
    if(event.target.id!=='search')return;
    event.stopImmediatePropagation();query=event.target.value;selectedAssets.clear();
    clearTimeout(searchTimer);searchTimer=setTimeout(()=>renderGrid(),120);
  },true);
  controls.addEventListener('click',()=>clearTimeout(searchTimer),true);
  // Previous wrappers render once during startup; the final pass adds pagination.
  renderGrid();
}
