// Approved original video cases; prompts retain their source labels and provenance.
const videoCatalog=manifest.videos||[];
let videoCategory='all',videoDetailItem=null;
const videoKey=v=>'video:'+v.id;
function videoAsset(v){return {id:videoKey(v),path:v.path,title:v.name,media_type:'video',generation:{asset_sha256:v.sha256},record:v}}
function videoPlaybackURL(v){const p=v.playback||v;return p.path+'?v='+p.sha256.slice(0,12)}
function videoList(){return videoCatalog.filter(v=>(videoCategory==='all'||v.category===videoCategory)&&(activeCollection==='trash'?isTrashed(videoAsset(v)):!isTrashed(videoAsset(v)))&&(activeCollection!=='favorites'||favorites.has(videoKey(v)))&&matchesAssetSearch(v,[v.name,v.project,v.category,...v.tags].join(' '))).sort((a,b)=>a.library_number-b.library_number)}
const videoControlsBase=renderControls,videoGridBase=renderGrid;
renderControls=function(){
 if(activeKind!=='video'){videoControlsBase();if(videoCatalog.length)controls.querySelector('[data-kind="video"] .planned')?.remove();return}
 controls.innerHTML=`<div class="navigation-main"><div class="library-kinds" aria-label="素材大类">${Object.entries(kindLabels).map(([k,label])=>`<button data-kind="${k}" class="kind-tab ${k==='video'?'active':''}" aria-pressed="${k==='video'}">${label}</button>`).join('')}</div><input id="search" class="search" aria-label="搜索视频序号或关键词" placeholder="搜索序号或视频关键词…" value="${escapeHTML(query)}"></div><div class="navigation-tools video-tools"><div class="collection-switch">${btns([['all','全部'],['favorites','★ 收藏']],'video-collection',activeCollection)}<span id="favorites-count" class="sr-only">${videoCatalog.filter(v=>favorites.has(videoKey(v))).length}</span></div><select id="video-category" class="voice-filter" aria-label="视频类别"><option value="all">全部视频类别</option>${[...new Set(videoCatalog.map(v=>v.category))].map(c=>`<option ${c===videoCategory?'selected':''} value="${escapeHTML(c)}">${escapeHTML(c)}</option>`).join('')}</select><button id="video-reset">重置</button><button class="recycle-shortcut ${activeCollection==='trash'?'active':''}" data-video-trash aria-pressed="${activeCollection==='trash'}">回收站</button></div>`;
 controls.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{activeKind=b.dataset.kind;activeCollection='all';resetNavigationFilters();openFilterPanel=null;render();controls.querySelector('.kind-tab.active')?.scrollIntoView({block:'nearest',inline:'nearest'})});
 controls.querySelectorAll('[data-group="video-collection"]').forEach(b=>b.onclick=()=>{activeCollection=b.dataset.value;selectedAssets.clear();render()});
 controls.querySelector('[data-video-trash]').onclick=()=>{activeCollection='trash';selectedAssets.clear();render()};
 controls.querySelector('#search').oninput=e=>{query=e.target.value;renderGrid()};
 controls.querySelector('#video-category').onchange=e=>{videoCategory=e.target.value;selectedAssets.clear();renderGrid()};
 controls.querySelector('#video-reset').onclick=()=>{query='';videoCategory='all';render()};
};
function bindVideoPlayer(player){
 player.addEventListener('play',()=>document.querySelectorAll('video,audio').forEach(other=>{if(other!==player)other.pause()}));
 player.addEventListener('error',()=>{const error=player.parentElement.querySelector('.video-error');if(error)error.hidden=false});
}
renderGrid=function(){
 grid.querySelectorAll('video').forEach(v=>v.pause());
 grid.classList.toggle('video-grid',activeKind==='video');
 if(activeKind!=='video'){videoGridBase();return}
 grid.querySelectorAll('audio').forEach(a=>a.pause());grid.classList.remove('bgm-grid','voice-grid','wardrobe-grid','character-grouped');
 const list=videoList(),items=list.map(videoAsset);
 title.textContent=(activeCollection==='favorites'?'收藏 · ':activeCollection==='trash'?'回收站 · ':'')+'视频样例';
 note.textContent=`显示 ${list.length} / ${videoCatalog.length} 个已确认 case · Magnus Thorne · 原视频与复用资料`;
 empty.hidden=!!list.length;empty.textContent=activeCollection==='trash'?'视频回收站为空。':'没有符合条件的视频，可重置搜索或筛选。';
 grid.innerHTML=list.map((v,i)=>`<article class="card video-card ${selectedAssets.has(videoKey(v))?'selected':''}"><div class="video-stage">${numberBadge(v)}<button class="favorite-button" data-video-favorite="${i}" aria-label="${favorites.has(videoKey(v))?'取消收藏':'收藏'}：${escapeHTML(v.name)}" aria-pressed="${favorites.has(videoKey(v))}">${favorites.has(videoKey(v))?'★':'☆'}</button><video controls playsinline preload="none" tabindex="0" aria-label="播放${escapeHTML(v.name)}" poster="${escapeHTML(v.poster)}" src="${escapeHTML(videoPlaybackURL(v))}"></video><p class="video-error" hidden>播放失败，可下载原视频查看。</p></div><div class="meta">${selectionMode?`<label class="video-selection"><input type="checkbox" data-video-select="${i}" aria-label="选择：${escapeHTML(v.name)}" ${selectedAssets.has(videoKey(v))?'checked':''}>选择</label>`:''}<h3>${escapeHTML(v.name)}</h3><div class="chips"><span class="chip">${escapeHTML(v.category)}</span><span class="chip">${v.duration_seconds.toFixed(1)} 秒</span><span class="chip">${v.width} × ${v.height}</span></div><div class="source">${escapeHTML(v.imported_on)} · 已确认 · 原文件</div>${cardActions(items[i],i)}</div></article>`).join('');
 bindCardActions(items);
 grid.querySelectorAll('[data-detail-index]').forEach(b=>b.onclick=()=>openVideoDetail(list[Number(b.dataset.detailIndex)]));
 grid.querySelectorAll('[data-video-favorite]').forEach(b=>b.onclick=()=>{const v=list[Number(b.dataset.videoFavorite)],next=new Set(favorites),key=videoKey(v);next.has(key)?next.delete(key):next.add(key);try{localStorage.setItem(FAVORITES_KEY,JSON.stringify([...next]));favorites=next;renderGrid()}catch(e){storageNotice('视频收藏未能保存，请检查浏览器存储权限。')}});
 grid.querySelectorAll('[data-video-select]').forEach(input=>input.onchange=()=>{const key=videoKey(list[Number(input.dataset.videoSelect)]);input.checked?selectedAssets.add(key):selectedAssets.delete(key);input.closest('.card').classList.toggle('selected',input.checked);renderBulkBar()});
 grid.querySelectorAll('video').forEach(bindVideoPlayer);
};
const videoDialog=document.createElement('dialog');videoDialog.id='video-detail';videoDialog.className='video-detail';videoDialog.setAttribute('aria-labelledby','video-detail-title');document.body.append(videoDialog);
videoDialog.addEventListener('close',()=>{videoDialog.querySelector('video')?.pause();videoDetailItem=null});
function openVideoDetail(v){
 videoDetailItem=v;const a=videoAsset(v);
 videoDialog.innerHTML=`<div class="video-detail-header"><h2 id="video-detail-title">${escapeHTML(v.name)}</h2><button id="video-detail-close" aria-label="关闭视频详情">×</button></div><div class="video-detail-body"><div class="video-detail-player"><video controls playsinline preload="metadata" tabindex="0" aria-label="播放${escapeHTML(v.name)}" poster="${escapeHTML(v.poster)}" src="${escapeHTML(videoPlaybackURL(v))}"></video><p class="video-error" hidden>播放失败，可下载原视频查看。</p></div><div class="video-detail-info"><div class="video-detail-actions"><button id="video-detail-share">分享</button><button id="video-detail-download">下载原视频</button><button id="video-detail-delete" class="danger">${isTrashed(a)?'恢复':'删除'}</button></div><dl><dt>类别</dt><dd>${escapeHTML(v.category)}</dd><dt>模型</dt><dd>${escapeHTML(v.model)}</dd><dt>生成日期</dt><dd>${escapeHTML(v.generation_date||'未核实')}<small>${escapeHTML(v.generation_date_note)}</small></dd><dt>入库日期</dt><dd>${escapeHTML(v.imported_on)}</dd><dt>视频规格</dt><dd>${v.width} × ${v.height} · ${v.duration_seconds.toFixed(2)} 秒 · ${v.fps} fps</dd></dl><p><a href="${escapeHTML(v.source_url)}" target="_blank" rel="noopener noreferrer">查看飞书原文 ↗</a> · 修订 ${v.source_revision}</p><p class="video-detail-links"><a href="${escapeHTML(v.reuse_pack.path)}" download>下载复用素材包 ZIP</a><a href="${escapeHTML(v.record_download)}" download>下载提示词与来源记录</a></p>${v.playback?'<p class="source">网页播放使用兼容副本；下载保留原视频。</p>':''}<h3>视频提示词</h3><p class="source">按文档标签保留原始输入与成片反推，复现时可配合素材包中的参考图。</p>${v.prompts.map((p,i)=>`<details class="video-prompt" ${i===0?'open':''}><summary>${escapeHTML(p.label||'制作提示词')}</summary><textarea readonly aria-label="${escapeHTML(p.label||'制作提示词')}">${escapeHTML(p.text)}</textarea><button data-copy-video-prompt="${i}">复制此提示词</button></details>`).join('')}<p id="video-copy-status" role="status"></p></div></div>`;
 videoDialog.querySelector('#video-detail-close').onclick=()=>videoDialog.close();
 videoDialog.querySelector('#video-detail-share').onclick=()=>openShare([a]);
 videoDialog.querySelector('#video-detail-download').onclick=()=>downloadAssets([a]);
 videoDialog.querySelector('#video-detail-delete').onclick=()=>{videoDialog.close();setTrashed([a],!isTrashed(a))};
 videoDialog.querySelectorAll('[data-copy-video-prompt]').forEach(b=>b.onclick=async()=>{const p=v.prompts[Number(b.dataset.copyVideoPrompt)];try{await navigator.clipboard.writeText(p.text);videoDialog.querySelector('#video-copy-status').textContent='提示词已复制'}catch(e){const field=b.previousElementSibling;field.focus();field.select();videoDialog.querySelector('#video-copy-status').textContent='已选中提示词，请按 ⌘C / Ctrl+C 复制。'}});
 bindVideoPlayer(videoDialog.querySelector('video'));
 document.querySelectorAll('video,audio').forEach(p=>p.pause());if(!videoDialog.open)videoDialog.showModal();
}
function navigateVideos(){if(location.hash==='#video'){activeKind='video';activeCollection='all';resetNavigationFilters();render();controls.querySelector('.kind-tab.active')?.scrollIntoView({block:'nearest',inline:'nearest'})}}
window.addEventListener('hashchange',navigateVideos);
// Defer until bulk controls have attached their sticky container and final handlers.
if(location.hash==='#video')queueMicrotask(navigateVideos);
