// Compact navigation. Expanded controls float over the grid, not inside its sticky height.
let activeKind='character',activeGender='all',openFilterPanel=null;
const kindLabels={character:'角色库',costume:'服装造型库',scene:'场景库',prop:'道具库',voice:'音色库',bgm:'背景音乐库',video:'视频样例'};
const roleNavigation=()=>['character','costume'].includes(activeKind);
// Numeric queries target the visible category number, never dates or reference batch IDs.
function matchesAssetSearch(asset,text,search=query){
 const q=String(search).normalize('NFKC').trim().toLowerCase();
 if(!q)return true;
 const number=q.match(/^(?:(?:编号|序号)\s*[:：]?\s*|#\s*)?(\d+)\s*号?$/);
 if(number)return Number.isSafeInteger(Number(number[1]))&&Number(number[1])===asset.library_number;
 const hay=String(text).normalize('NFKC').toLowerCase();
 return hay.includes(q);
}
// Wardrobe entries are explicitly registered product images, never inferred from a character's outfit view.
function kindMatches(a,kind=activeKind){return a.asset_kind===kind}
const genderLabels={all:'全部性别',male:'男',female:'女',other:'其他',unknown:'未标注'};
function genderMatches(c){return activeGender==='all'||c.gender===activeGender}
function resetNavigationFilters(){activeScene='all';activeStyle='all';activeSpecies='all';activeCategory='all';activeCharacter='all';activeProject='all';activeReadiness='all';activeGender='all';query='';selectedAssets.clear()}
function filterCount(){return [activeStyle,activeSpecies,activeKind==='costume'&&activeCategory==='outfit'?'all':activeCategory,activeCharacter,activeProject,activeReadiness,activeGender].filter(v=>v!=='all').length}
function typePanelHTML(){
 const groups=activeKind==='costume'?[['服装与配饰',['outfit','costume','accessory']]]:[['角色基础',['identity','full_body','face_turnaround','head_angles','body_turnaround','expression_grid']],['创作延展',['costume','expression','pose','detail']],['组合与参考',['character_board','storyboard','relationship','pov','style_reference']]];
 return `<div class="panel-title"><strong>图片类型</strong><button data-close-panel aria-label="关闭图片类型">×</button></div><div class="filter-row">${btns([['all','全部类型']],'category',activeCategory)}</div>${groups.map(([label,keys])=>`<details class="type-level" ${keys.includes(activeCategory)||label==='角色基础'||activeKind==='costume'?'open':''}><summary>${label}</summary><div class="filter-row">${btns(keys.map(k=>[k,categoryLabels[k]]),'category',activeCategory)}</div></details>`).join('')}`;
}
function renderControls(){
 const count=filterCount()+(activeScene==='all'?0:1),railLeft=controls.querySelector('.library-kinds')?.scrollLeft||0;
 controls.innerHTML=`<div class="navigation-main"><div class="library-kinds" aria-label="素材大类">${Object.entries(kindLabels).map(([k,label])=>`<button data-kind="${k}" class="kind-tab ${activeKind===k?'active':''}" aria-pressed="${activeKind===k}">${label}${k!=='character'&&!assets.some(a=>kindMatches(a,k))?'<span class="planned">待添加</span>':''}</button>`).join('')}</div><input class="search" id="search" aria-label="搜索资产序号、名称或来源" placeholder="搜索序号或关键词…" value="${escapeHTML(query)}"></div><div class="navigation-tools"><div class="collection-switch">${btns([['all','全部'],['favorites','★ 收藏']],'collection',activeCollection)}<span id="favorites-count" class="sr-only">${favoriteCount()}</span></div><span class="nav-divider"></span>${activeKind==='costume'?`<div class="wardrobe-tabs" aria-label="套装素材层级">${btns([['outfit','完整造型'],['costume','服装'],['accessory','配饰'],['all','全部素材']],'category',activeCategory)}</div>`:''}${activeKind==='character'?`<label class="gender-control"><span>性别</span><select id="gender-select" aria-label="性别">${Object.entries(genderLabels).map(([k,label])=>`<option value="${k}" ${activeGender===k?'selected':''}>${label}</option>`).join('')}</select></label><button data-panel="types" aria-controls="navigation-panel" aria-expanded="${openFilterPanel==='types'}">${activeCategory==='all'?'图片类型':escapeHTML(categoryLabels[activeCategory])} <span aria-hidden="true">⌄</span></button>`:''}<button data-panel="filters" aria-controls="navigation-panel" aria-expanded="${openFilterPanel==='filters'}">筛选${count?' · '+count:''} <span aria-hidden="true">⌄</span></button>${count?'<button class="reset-filters" id="reset-filters">重置</button>':''}<button class="recycle-shortcut ${activeCollection==='trash'?'active':''}" data-group="collection" data-value="trash" aria-pressed="${activeCollection==='trash'}">回收站</button></div>${openFilterPanel?`<div class="navigation-panel" id="navigation-panel" role="region" aria-label="${openFilterPanel==='types'?'图片类型':'更多筛选'}">${openFilterPanel==='types'?typePanelHTML():`<div class="panel-title"><strong>更多筛选</strong><button data-close-panel aria-label="关闭筛选">×</button></div><div class="filter-row"><span class="filter-label">风格</span>${btns(Object.entries(styleLabels),'style',activeStyle)}</div>${activeKind==='character'?`<div class="filter-row"><span class="filter-label">物种</span>${btns(Object.entries(speciesLabels),'species',activeSpecies)}</div><details class="type-level" open><summary>项目与角色</summary>${characterFilterHTML()}</details>`:''}<div class="mobile-library-tools"><button data-group="collection" data-value="trash">回收站</button></div><div class="panel-footer"><button id="clear-panel-filters">清空筛选</button><button class="active" data-close-panel>完成</button></div>`}</div>`:''}`;
 controls.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{activeKind=b.dataset.kind;activeCollection='all';resetNavigationFilters();if(activeKind==='costume')activeCategory='outfit';openFilterPanel=null;render();controls.querySelector('.kind-tab.active')?.scrollIntoView({block:'nearest',inline:'nearest'})});
 controls.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{
  const g=b.dataset.group,v=b.dataset.value;
  if(g==='collection'){activeCollection=v;resetNavigationFilters();openFilterPanel=null}
  if(g==='style')activeStyle=v;
  if(g==='species')activeSpecies=v;
  if(g==='category'){activeCategory=v;openFilterPanel=null}
  selectedAssets.clear();render();
  if(g==='category')controls.querySelector('[data-panel="types"]')?.focus({preventScroll:true});
 });
 controls.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>{openFilterPanel=openFilterPanel===b.dataset.panel?null:b.dataset.panel;renderControls();controls.querySelector(`[data-panel="${b.dataset.panel}"]`)?.focus({preventScroll:true})});
 controls.querySelectorAll('[data-close-panel]').forEach(b=>b.onclick=closeNavigationPanel);
 controls.querySelector('#gender-select')?.addEventListener('change',e=>{activeGender=e.target.value;activeCharacter='all';selectedAssets.clear();render();controls.querySelector('#gender-select')?.focus({preventScroll:true})});
 for(const id of ['reset-filters','clear-panel-filters'])controls.querySelector('#'+id)?.addEventListener('click',()=>{resetNavigationFilters();render()});
 if(openFilterPanel==='filters'&&activeKind==='character')bindCharacterControls();
 controls.querySelector('#search').oninput=e=>{query=e.target.value;selectedAssets.clear();renderGrid()};
 controls.querySelector('.library-kinds').scrollLeft=railLeft;
 fitNavigationPanel();
}
function closeNavigationPanel(){const previous=openFilterPanel;openFilterPanel=null;renderControls();controls.querySelector(`[data-panel="${previous}"]`)?.focus({preventScroll:true})}
document.addEventListener('click',e=>{if(openFilterPanel&&!e.composedPath().includes(controls)){openFilterPanel=null;renderControls()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&openFilterPanel){e.preventDefault();closeNavigationPanel()}});
function renderNavigationResults(list){
 grid.classList.toggle('wardrobe-grid',activeKind==='costume');
 if(activeKind!=='character'){
  title.textContent=(activeCollection==='favorites'?'收藏 · ':activeCollection==='trash'?'回收站 · ':'')+kindLabels[activeKind];note.textContent=`显示 ${list.length} 项${activeGender!=='all'?' · '+genderLabels[activeGender]:''}${query?' · 搜索“'+query+'”':''}`;
  if(!list.length)empty.textContent=assets.some(a=>kindMatches(a))?'没有符合筛选条件的素材。':'这里将收录'+kindLabels[activeKind]+'，添加素材后即可浏览与筛选。';
  if(activeKind==='scene'){const groups=sceneGroups(list);note.textContent=`${groups.length} 个场景 · ${list.length} 张图片 · 按序号排列，点击图片查看空间资料${query?' · 搜索“'+query+'”':''}`}
  if(activeKind==='costume'){
   note.textContent+=activeCategory==='outfit'?' · 点击套装展开服装与配饰':' · 服装无人展示 · 配饰单独成图';
   if(!list.length&&!assets.some(a=>kindMatches(a)))empty.textContent='待添加无人服装展示图与独立配饰图。角色穿搭图仍保留在「角色库」中。';
  }
 }else{
  if(activeGender!=='all'){title.textContent='筛选结果';note.textContent+=' · '+genderLabels[activeGender]}
  if(activeCollection==='all'&&!list.length)empty.textContent='没有符合筛选条件的角色素材，可重置筛选后再试。';
 }
}

function fitNavigationPanel(){const panel=document.getElementById('navigation-panel');if(panel)panel.style.maxHeight=Math.max(60,Math.min(580,innerHeight-panel.getBoundingClientRect().top-12))+'px'}
window.addEventListener('resize',fitNavigationPanel);
window.addEventListener('scroll',fitNavigationPanel,{passive:true});
