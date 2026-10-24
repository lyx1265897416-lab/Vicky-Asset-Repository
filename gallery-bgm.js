// BGM uses independent original-audio records and per-track licensing.
const bgmCatalog=manifest.bgm||[];
let bgmProject='all',bgmCategory='all',bgmOrder='number';
const bgmControlBase=renderControls,bgmGridBase=renderGrid;
const bgmKey=t=>'bgm:'+t.id;
const bgmChoices=new Map();
function bgmList(){
 const list=bgmCatalog.filter(t=>(bgmProject==='all'||(bgmProject==='__web'?t.origin==='web':t.project===bgmProject))&&(bgmCategory==='all'||t.category===bgmCategory)&&(activeCollection!=='favorites'||favorites.has(bgmKey(t)))&&matchesAssetSearch(t,[t.name,t.artist||'',t.project,t.category||'',...t.tags,...t.episodes,...t.variants.flatMap(v=>[v.label,...v.sources])].join(' ')));
 return list.sort((a,b)=>bgmOrder==='popular'?((b.popularity?.priority??-1)-(a.popularity?.priority??-1)||a.library_number-b.library_number):a.library_number-b.library_number);
}
renderControls=function(){
 if(activeKind!=='bgm'){bgmControlBase();if(bgmCatalog.length)controls.querySelector('[data-kind="bgm"] .planned')?.remove();return;}
 controls.innerHTML=`<div class="navigation-main"><div class="library-kinds" aria-label="素材大类">${Object.entries(kindLabels).map(([k,label])=>`<button data-kind="${k}" class="kind-tab ${k==='bgm'?'active':''}" aria-pressed="${k==='bgm'}">${label}</button>`).join('')}</div><input id="search" class="search" aria-label="搜索音乐序号或关键词" placeholder="搜索序号、曲名或作者…" value="${escapeHTML(query)}"></div><div class="navigation-tools bgm-tools">${btns([['all','全部'],['favorites','★ 收藏']],'bgm-collection',activeCollection)}<select class="voice-filter" id="bgm-project" aria-label="背景音乐来源"><option value="all">全部来源</option><option value="__web" ${bgmProject==='__web'?'selected':''}>网络精选 · 全部</option>${[...new Set(bgmCatalog.map(t=>t.project))].map(p=>`<option value="${escapeHTML(p)}" ${p===bgmProject?'selected':''}>${escapeHTML(p)}</option>`).join('')}</select><select class="voice-filter" id="bgm-category" aria-label="背景音乐场景曲风"><option value="all">全部场景 / 曲风</option>${[...new Set(bgmCatalog.map(t=>t.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'zh')).map(c=>`<option value="${escapeHTML(c)}" ${c===bgmCategory?'selected':''}>${escapeHTML(c)}</option>`).join('')}</select><select class="voice-filter" id="bgm-order" aria-label="背景音乐排序"><option value="number" ${bgmOrder==='number'?'selected':''}>按入库编号</option><option value="popular" ${bgmOrder==='popular'?'selected':''}>热门 / 熟悉优先</option></select><button id="bgm-reset">重置</button><span id="favorites-count" class="sr-only">${bgmCatalog.filter(t=>favorites.has(bgmKey(t))).length}</span></div>`;
 controls.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{activeKind=b.dataset.kind;activeCollection='all';resetNavigationFilters();openFilterPanel=null;render();controls.querySelector('.kind-tab.active')?.scrollIntoView({block:'nearest',inline:'nearest'})});
 controls.querySelectorAll('[data-group="bgm-collection"]').forEach(b=>b.onclick=()=>{activeCollection=b.dataset.value;render()});
 controls.querySelector('#search').oninput=e=>{query=e.target.value;renderGrid()};
 controls.querySelector('#bgm-project').onchange=e=>{bgmProject=e.target.value;renderGrid()};
 controls.querySelector('#bgm-category').onchange=e=>{bgmCategory=e.target.value;renderGrid()};
 controls.querySelector('#bgm-order').onchange=e=>{bgmOrder=e.target.value;renderGrid()};
 controls.querySelector('#bgm-reset').onclick=()=>{bgmProject='all';bgmCategory='all';bgmOrder='number';query='';render()};
};
function bgmLicenseHTML(t){
 const l=t.license;if(!l)return '';
 return `<details class="bgm-license-detail"><summary>商用授权与署名</summary><p>${l.usage_notes.map(escapeHTML).join('<br>')}</p><textarea readonly class="bgm-credit" aria-label="${escapeHTML(t.name)}署名文本">${escapeHTML(l.attribution)}</textarea><p><a href="${escapeHTML(l.track_url)}" target="_blank" rel="noopener noreferrer">官方曲目</a> · <a href="${escapeHTML(l.source_url)}" target="_blank" rel="noopener noreferrer">作者授权说明</a> · <a href="${escapeHTML(l.url)}" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></p><p>${escapeHTML(l.content_id_note)}</p><p>授权核对：${escapeHTML(l.checked_on)} · ${escapeHTML(l.basis)}</p>${t.popularity?`<p>选曲依据：${escapeHTML(t.popularity.basis)} <a href="${escapeHTML(t.popularity.source_url)}" target="_blank" rel="noopener noreferrer">查看来源</a></p>`:''}</details>`;
}
renderGrid=function(){
 grid.querySelectorAll('audio').forEach(a=>a.pause());
 grid.classList.toggle('bgm-grid',activeKind==='bgm');
 if(activeKind!=='bgm'){bgmGridBase();return;}
 grid.classList.remove('voice-grid','character-grouped');
 for(const id of ['batch-mode','bulk-bar','empty-trash'])document.getElementById(id).hidden=true;
 const list=bgmList();title.textContent=activeCollection==='favorites'?'收藏的背景音乐':'背景音乐库';
 note.textContent=`显示 ${list.length} / ${bgmCatalog.length} 首 · 共 ${manifest.bgm_version_count||0} 个音频版本 · 网络精选可商用，需按每首说明署名`;
 empty.hidden=!!list.length;empty.textContent='没有符合条件的背景音乐，可重置搜索或筛选。';
 grid.innerHTML=list.map(t=>{
  const v=t.variants.find(v=>v.id===(bgmChoices.get(t.id)||t.default_variant))||t.variants[0];
  return `<article class="card bgm-card" data-bgm-id="${escapeHTML(t.id)}"><button class="favorite-button" data-bgm-favorite="${escapeHTML(t.id)}" aria-label="${favorites.has(bgmKey(t))?'取消收藏':'收藏'}：${escapeHTML(t.name)}" aria-pressed="${favorites.has(bgmKey(t))}">${favorites.has(bgmKey(t))?'★':'☆'}</button>${numberBadge(t)}<h3>${escapeHTML(t.name)}</h3><div class="bgm-meta">${escapeHTML(t.project)}${t.episodes.length?' · '+escapeHTML(t.episodes.join(' / ')):''}</div><div class="bgm-tags">${t.license?'<span class="bgm-license-badge">可商用 · 需署名</span>':''}${t.popularity&&t.popularity.tier!=='风格补齐'?`<span class="bgm-popular-badge">${escapeHTML(t.popularity.tier)}</span>`:''}${t.tags.filter(s=>s!==t.popularity?.tier).map(s=>`<span>${escapeHTML(s)}</span>`).join('')}</div><label class="bgm-versions-label">音频版本<select aria-label="${escapeHTML(t.name)}音频版本">${t.variants.map(x=>`<option value="${x.id}" ${x.id===v.id?'selected':''}>${escapeHTML(x.label)} · ${x.duration_seconds.toFixed(1)} 秒 · ${x.path.split('.').pop().toUpperCase()}</option>`).join('')}</select></label><audio controls preload="none" aria-label="试听${escapeHTML(t.name)}" src="${escapeHTML(v.path)}?v=${v.sha256.slice(0,12)}"></audio><p class="bgm-error" hidden>播放失败，请尝试下载原音频。</p>${bgmLicenseHTML(t)}<details><summary>音乐信息与来源</summary><p>${escapeHTML(t.provenance_note)}</p>${t.artist?`<p>作曲 / 录音：${escapeHTML(t.artist)}</p>`:`<p>模型：${escapeHTML(t.model)}</p>${t.prompt?`<pre>${escapeHTML(t.prompt)}</pre>`:'<p>未取得原始音乐提示词。</p>'}`}<div class="bgm-source"></div></details><div class="bgm-links"><a class="bgm-download" href="${escapeHTML(v.path)}" download>下载网页试听版</a>${t.license?`<button class="bgm-copy-credit" aria-label="复制${escapeHTML(t.name)}署名">复制署名</button><a href="${escapeHTML(t.credit_download)}" download>下载署名</a>`:''}<a href="${escapeHTML(t.record_download)}" download>下载来源记录</a></div><span class="bgm-copy-status" role="status"></span></article>`;
 }).join('');
 grid.querySelectorAll('.bgm-card').forEach(card=>{
  const t=bgmCatalog.find(t=>t.id===card.dataset.bgmId),a=card.querySelector('audio'),select=card.querySelector('select'),error=card.querySelector('.bgm-error');
  function source(){const v=t.variants.find(v=>v.id===select.value);card.querySelector('.bgm-source').textContent=(t.origin==='web'?'官方原音频：':'来源副本 '+v.sources.length+' 处：')+'\n'+v.sources.join('\n');}
  source();
  select.onchange=()=>{a.pause();const v=t.variants.find(v=>v.id===select.value);bgmChoices.set(t.id,v.id);a.src=v.path+'?v='+v.sha256.slice(0,12);a.load();card.querySelector('.bgm-download').href=v.path;error.hidden=true;source()};
  a.onplay=()=>grid.querySelectorAll('audio').forEach(other=>{if(other!==a)other.pause()});a.onerror=()=>error.hidden=false;
  const copy=card.querySelector('.bgm-copy-credit');if(copy)copy.onclick=async()=>{try{await navigator.clipboard.writeText(t.license.attribution);card.querySelector('.bgm-copy-status').textContent='署名已复制；剪辑或改编后请补充改动说明。'}catch(e){card.querySelector('.bgm-license-detail').open=true;const box=card.querySelector('.bgm-credit');box.focus();box.select();card.querySelector('.bgm-copy-status').textContent='自动复制不可用，已选中署名，请手动复制。'}};
  card.querySelector('[data-bgm-favorite]').onclick=()=>{const updated=new Set(favorites);const key=bgmKey(t);if(updated.has(key))updated.delete(key);else updated.add(key);try{localStorage.setItem(FAVORITES_KEY,JSON.stringify([...updated]));favorites=updated;renderGrid()}catch(e){storageNotice('音乐收藏未能保存，请检查浏览器存储权限。')}};
 });
};
function navigateBGM(){if(location.hash==='#bgm'){activeKind='bgm';activeCollection='all';resetNavigationFilters();render();controls.querySelector('.kind-tab.active')?.scrollIntoView({block:'nearest',inline:'nearest'})}}
window.addEventListener('hashchange',navigateBGM);
if(location.hash==='#bgm')navigateBGM();else renderControls();
