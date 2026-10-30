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

;
let purgeSelection=[],purgeBusy=false;
function requestPermanentDelete(items){
 const targets=[...new Map(items.filter(isTrashed).map(a=>[favoriteKey(a),a])).values()];if(!targets.length)return;
 closeCardMenu();purgeSelection=targets;
 document.getElementById('purge-title').textContent=`彻底删除 ${targets.length} 张图片？`;
 document.getElementById('purge-list').innerHTML=targets.map(a=>`<li>${escapeHTML(a.title)}</li>`).join('');
 document.getElementById('purge-error').textContent='';document.getElementById('purge-confirm').disabled=false;
 document.getElementById('purge-dialog').showModal();document.getElementById('purge-cancel').focus();
}
function removePurgedAssets(ids){
 const keys=new Set(ids),removed=assets.filter(a=>keys.has(favoriteKey(a))||keys.has(a.path));
 if(!removed.length)return;
 if(modalIndex>=0)closeModal();
 const paths=new Set(removed.map(a=>a.path));
 for(let i=assets.length-1;i>=0;i--)if(paths.has(assets[i].path))assets.splice(i,1);
 for(const a of removed){const key=favoriteKey(a);trash.delete(key);favorites.delete(key);selectedAssets.delete(key)}
 undoTrash=undoTrash.filter(a=>!paths.has(a.path));
 manifest.characters.forEach(c=>c.asset_paths=c.asset_paths.filter(p=>!paths.has(p)));manifest.characters=manifest.characters.filter(c=>c.asset_paths.length);
 if(activeCharacter!=='all'&&activeCharacter!=='unassigned'&&!manifest.characters.some(c=>c.id===activeCharacter))activeCharacter='all';
 try{localStorage.setItem(TRASH_KEY,JSON.stringify([...trash]));localStorage.setItem(FAVORITES_KEY,JSON.stringify([...favorites]));localStorage.setItem('vicky-character-library:purge-event',String(Date.now()))}catch(e){/* Server deletion is authoritative even if local storage is unavailable. */}
 renderStats();render();
}
async function confirmPermanentDelete(){
 if(purgeBusy)return;purgeBusy=true;const button=document.getElementById('purge-confirm'),cancel=document.getElementById('purge-cancel');button.disabled=true;cancel.disabled=true;button.textContent='正在彻底删除…';
 try{
  const response=await fetch('/api/permanently-delete',{method:'POST',headers:{'Content-Type':'application/json','X-Vicky-Action':'permanently-delete'},body:JSON.stringify({ids:purgeSelection.map(favoriteKey),confirmed:true})});
  const data=await response.json().catch(()=>({error:'删除服务不可用，请使用角色库专用服务打开页面。'}));
  if(!response.ok)throw Error(data.error||'彻底删除失败');
  removePurgedAssets(data.deleted_ids);document.getElementById('purge-dialog').close();
  showActionNotice(`已彻底删除 ${data.deleted_ids.length} 张图片${data.rebuild_ok?'':'；图库页面更新未完成，请稍后刷新'}`);
 }catch(e){document.getElementById('purge-error').textContent=e.message||'无法连接删除服务，未确认删除成功，请重试。'}
 finally{purgeBusy=false;button.disabled=false;cancel.disabled=false;button.textContent='彻底删除'}
}
async function refreshPermanentDeletion(){try{const r=await fetch('/api/library-state',{cache:'no-store'});if(r.ok){const state=await r.json();removePurgedAssets(state.deleted_ids||[])}}catch(e){/* Offline browsing remains available. Deletion reports a visible error. */}}
function initPermanentDelete(){
 document.getElementById('purge-cancel').onclick=()=>document.getElementById('purge-dialog').close();
 document.getElementById('purge-confirm').onclick=confirmPermanentDelete;
 document.getElementById('purge-dialog').addEventListener('cancel',e=>{if(purgeBusy)e.preventDefault()});
 document.getElementById('bulk-purge').onclick=()=>requestPermanentDelete(selectedList());
 document.getElementById('empty-trash').onclick=()=>requestPermanentDelete(assets.filter(isTrashed));
 document.getElementById('detail-purge').onclick=()=>requestPermanentDelete([assets[modalIndex]]);
 window.addEventListener('focus',refreshPermanentDeletion);
 window.addEventListener('storage',e=>{if(e.key==='vicky-character-library:purge-event')refreshPermanentDeletion()});
 refreshPermanentDeletion();
}

;
// Browser-local reversible library state. Original image files remain intact.
const TRASH_KEY='vicky-character-library:trash:v1';
let trash=new Set(),selectedAssets=new Set(),selectionMode=false,openMenuIndex=-1;
let toastTimer,undoTrash=[],shareAssets=[],shareFiles=[],shareClipboardBlob=null,shareBusy=false,shareToken=0;
function readTrash(){try{const value=JSON.parse(localStorage.getItem(TRASH_KEY)||'[]');if(!Array.isArray(value)||value.some(x=>typeof x!=='string'))throw Error('invalid trash');return new Set(value)}catch(e){storageNotice('无法读取回收站记录，请检查浏览器存储设置。');return new Set()}}
const isTrashed=a=>trash.has(favoriteKey(a));
const liveAssets=()=>assets.filter(a=>!isTrashed(a));
function showActionNotice(message,undo=false){const el=document.getElementById('action-toast');clearTimeout(toastTimer);el.replaceChildren(document.createTextNode(message));if(undo){const b=document.createElement('button');b.textContent='撤销';b.onclick=()=>setTrashed(undoTrash,false);el.append(b)}el.hidden=false;toastTimer=setTimeout(()=>el.hidden=true,undo?12000:6500)}
function saveTrash(next){try{localStorage.setItem(TRASH_KEY,JSON.stringify([...next]));trash=next;storageNotice('');return true}catch(e){showActionNotice('未能保存删除操作，请检查浏览器存储权限。');return false}}
function setTrashed(items,deleted){const keys=items.map(favoriteKey),next=new Set(trash);keys.forEach(k=>deleted?next.add(k):next.delete(k));if(!saveTrash(next))return;if(deleted)undoTrash=[...items];keys.forEach(k=>selectedAssets.delete(k));if(modalIndex>=0)closeModal();closeCardMenu();renderStats();render();showActionNotice(deleted?`已将 ${items.length} 项素材移入回收站`:`已恢复 ${items.length} 项素材`,deleted)}
function selectedList(){return filtered().filter(a=>selectedAssets.has(favoriteKey(a)))}
function toggleImageSelection(index){const k=favoriteKey(assets[index]);selectedAssets.has(k)?selectedAssets.delete(k):selectedAssets.add(k);renderGrid()}
function toggleSelectionMode(){selectionMode=!selectionMode;selectedAssets.clear();closeCardMenu();renderGrid()}
function renderBulkBar(){const list=filtered();const allowed=new Set(list.map(favoriteKey));selectedAssets=new Set([...selectedAssets].filter(k=>allowed.has(k)));const count=selectedList().length;document.getElementById('bulk-purge').hidden=activeCollection!=='trash';document.getElementById('bulk-purge').disabled=!count;document.getElementById('empty-trash').hidden=activeCollection!=='trash';document.getElementById('empty-trash').disabled=!assets.some(isTrashed);const b=document.getElementById('batch-mode');b.textContent=selectionMode?'完成选择':'批量选择';b.setAttribute('aria-pressed',String(selectionMode));document.getElementById('bulk-bar').hidden=!selectionMode;document.getElementById('bulk-count').textContent=`已选 ${count} 张 · 当前结果 ${list.length} 张`;document.getElementById('bulk-all').textContent=count===list.length&&list.length?'取消全选':'全选当前结果';document.getElementById('bulk-all').disabled=!list.length;['bulk-share','bulk-download','bulk-delete'].forEach(id=>document.getElementById(id).disabled=!count);document.getElementById('bulk-delete').textContent=activeCollection==='trash'?'批量恢复':'批量删除';document.getElementById('bulk-delete').classList.toggle('danger',activeCollection!=='trash');grid.classList.toggle('selecting',selectionMode);document.body.classList.toggle('selection-active',selectionMode)}
function cardActions(a,index){return `<div class="card-bottom">${a.media_type==='audio'?'':`<button class="detail-link" data-detail-index="${index}">${a.category==='outfit'?'展开服装与配饰 ↗':'详情与提示词 ↗'}</button>`}<button class="more-button" data-more-index="${index}" aria-label="更多操作：${escapeHTML(a.title)}" aria-expanded="false" aria-controls="card-menu-${index}" aria-haspopup="menu"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/></svg></button></div><div class="card-menu" id="card-menu-${index}" role="menu" hidden><button role="menuitem" data-action="share" data-asset-index="${index}">分享</button><button role="menuitem" data-action="download" data-asset-index="${index}">下载文件</button><button role="menuitem" class="${isTrashed(a)?'':'danger'}" data-action="${isTrashed(a)?'restore':'delete'}" data-asset-index="${index}">${isTrashed(a)?'恢复':'删除'}</button>${isTrashed(a)&&!['audio','video'].includes(a.media_type)?`<button role="menuitem" class="danger" data-action="purge" data-asset-index="${index}">彻底删除</button>`:''}</div>`}
function closeCardMenu(restoreFocus=false){if(openMenuIndex<0)return;const i=openMenuIndex;document.getElementById('card-menu-'+i)?.setAttribute('hidden','');grid.querySelector(`[data-more-index="${i}"]`)?.setAttribute('aria-expanded','false');openMenuIndex=-1;if(restoreFocus)grid.querySelector(`[data-more-index="${i}"]`)?.focus()}
function bindCardActions(items=assets){openMenuIndex=-1;grid.querySelectorAll('[data-more-index]').forEach(b=>b.onclick=e=>{e.stopPropagation();const i=Number(b.dataset.moreIndex),wasOpen=openMenuIndex===i;closeCardMenu();if(!wasOpen){openMenuIndex=i;document.getElementById('card-menu-'+i).hidden=false;b.setAttribute('aria-expanded','true');document.querySelector(`#card-menu-${i} button`).focus()}});grid.querySelectorAll('[data-action]').forEach(b=>b.onclick=e=>{e.stopPropagation();const a=items[Number(b.dataset.assetIndex)];closeCardMenu();if(b.dataset.action==='share')openShare([a]);if(b.dataset.action==='download')downloadAssets([a]);if(b.dataset.action==='delete')setTrashed([a],true);if(b.dataset.action==='restore')setTrashed([a],false);if(b.dataset.action==='purge')requestPermanentDelete([a])});grid.querySelectorAll('[data-select-index]').forEach(b=>{b.onclick=e=>e.stopPropagation();b.onchange=()=>{const index=Number(b.dataset.selectIndex);toggleImageSelection(index);grid.querySelector(`[data-select-index="${index}"]`)?.focus()}});renderBulkBar()}
function downloadURL(url,name){const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove()}
function safeFileName(a,index=0){const name=a.path.split('/').pop().replace(/[^\p{L}\p{N}._-]/gu,'_');return `${String(index+1).padStart(3,'0')}-${name}`}
async function imageFile(a,index){const response=await fetch(assetURL(a));if(!response.ok)throw Error('文件读取失败：'+a.title);const blob=await response.blob();return new File([blob],safeFileName(a,index),{type:blob.type||'image/png'})}
async function downloadAssets(items){if(!items.length)return;if(items.length===1){downloadURL(assetURL(items[0]),safeFileName(items[0]));showActionNotice('已请求下载文件');return}showActionNotice(`正在打包 ${items.length} 个文件…`);try{const files=[];for(let i=0;i<items.length;i++)files.push(await imageFile(items[i],i));const zip=await makeZip(files);const url=URL.createObjectURL(zip);downloadURL(url,`Vicky素材库-${items.length}项.zip`);setTimeout(()=>URL.revokeObjectURL(url),60000);showActionNotice(`已生成 ${items.length} 个文件的 ZIP 下载包`)}catch(e){showActionNotice('打包失败，请检查本地服务后重试。')}}
// ZIP store format (no compression): lossless original images, UTF-8 filenames.
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0});
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0}
async function makeZip(files){const encoder=new TextEncoder(),chunks=[],directory=[];let offset=0,centralSize=0;for(const file of files){const data=new Uint8Array(await file.arrayBuffer()),name=encoder.encode(file.name),crc=crc32(data);const local=new Uint8Array(30+name.length),v=new DataView(local.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);local.set(name,30);chunks.push(local,data);const c=new Uint8Array(46+name.length),d=new DataView(c.buffer);d.setUint32(0,0x02014b50,true);d.setUint16(4,20,true);d.setUint16(6,20,true);d.setUint16(8,0x800,true);d.setUint32(16,crc,true);d.setUint32(20,data.length,true);d.setUint32(24,data.length,true);d.setUint16(28,name.length,true);d.setUint32(42,offset,true);c.set(name,46);directory.push(c);centralSize+=c.length;offset+=local.length+data.length}const end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);v.setUint32(12,centralSize,true);v.setUint32(16,offset,true);return new Blob([...chunks,...directory,end],{type:'application/zip'})}
// Share only the selected image URLs or original files; no generated HTML attachment.
function imageShareURL(a){return new URL(assetURL(a),document.baseURI).href}
function shareLinkPayload(items){const urls=items.map(imageShareURL);return urls.length===1?{title:items[0].title,url:urls[0]}:{title:`Vicky 资产库 · ${items.length} 项素材`,text:urls.join('\n')}}
function supportsShare(data){try{return typeof navigator.share==='function'&&(!navigator.canShare||navigator.canShare(data))}catch(e){return false}}
function linkScopeNote(){const h=location.hostname.toLowerCase();if(location.protocol==='file:'||h==='localhost'||h.endsWith('.localhost')||/^127\./.test(h)||h==='[::1]')return '这是本机素材链接，仅这台电脑可打开。发给他人请选择分享文件。';if(/^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(h)||h.endsWith('.local'))return '这是局域网素材链接，需要对方连接同一网络且可访问图库。';return '复制的是所选素材的直接链接；对方需要有访问该地址的权限。'}
function openShare(items){
 if(!items.length)return;
 document.querySelectorAll('video').forEach(v=>v.pause());
 shareToken++;shareAssets=[...items];shareFiles=[];shareClipboardBlob=null;shareBusy=false;
 document.getElementById('share-title').textContent=items.length===1?'分享素材':`分享 ${items.length} 项素材`;
 document.getElementById('share-preview').innerHTML=items.slice(0,8).map(a=>['audio','video'].includes(a.media_type)?`<span class="audio-share-name">${a.media_type==='video'?'▶':'♫'} ${escapeHTML(a.title)}</span>`:`<img src="${escapeHTML(galleryThumbURL(a))}" alt="${escapeHTML(a.title)}">`).join('');
 document.getElementById('share-links').value=items.map(imageShareURL).join('\n');
 document.getElementById('share-copy-link').textContent=items.length===1?'复制素材链接':`复制 ${items.length} 个素材链接`;
 const linksSupported=supportsShare(shareLinkPayload(items));
 document.getElementById('share-link-native').disabled=!linksSupported;
 document.getElementById('share-link-note').textContent=linkScopeNote()+(!linksSupported?' 当前浏览器不支持系统分享，可复制链接。':'');
 const audio=items[0].media_type==='audio',video=items[0].media_type==='video';
 document.getElementById('share-file-title').textContent=audio?'分享音频':video?'分享视频':'分享图片';
 document.getElementById('share-native').textContent=audio?'分享音频到…':video?'分享视频到…':'分享图片到…';
 document.getElementById('share-download').textContent=audio?'下载音频':video?'下载原视频':'下载展示图';
 document.getElementById('share-retry').textContent='重新加载文件';
 document.getElementById('share-native').disabled=true;
 const copyButton=document.getElementById('share-copy-image');
 copyButton.hidden=items.length!==1||['audio','video'].includes(items[0].media_type);copyButton.disabled=true;
 document.getElementById('share-image-note').textContent='通过系统分享面板选择微信等应用；可用应用由设备决定。';
 document.getElementById('share-retry').hidden=true;
 document.getElementById('share-progress').textContent='正在加载文件…';
 const dialog=document.getElementById('share-dialog');if(!dialog.open)dialog.showModal();
 prepareShare();
}
async function clipboardPNG(file){
 if(file.type==='image/png')return file;
 // Clipboard interoperability needs PNG; downloads/native sharing retain original bytes.
 const bitmap=await createImageBitmap(file);
 try{const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;canvas.getContext('2d').drawImage(bitmap,0,0);return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('图片转换失败')),'image/png'))}finally{bitmap.close()}
}
async function prepareShare(){
 if(shareBusy)return;shareBusy=true;const token=shareToken,items=[...shareAssets];
 document.getElementById('share-retry').hidden=true;
 try{
  const files=[];for(let i=0;i<items.length;i++){files.push(await imageFile(items[i],i));if(token!==shareToken)return}
  shareFiles=files;
  const nativeSupported=typeof navigator.canShare==='function'&&supportsShare({files});
  document.getElementById('share-native').disabled=!nativeSupported;
  document.getElementById('share-image-note').textContent=nativeSupported?'打开系统分享面板后选择微信等应用；若列表中没有微信，可复制图片后到微信粘贴。':'当前浏览器不支持直接调起文件分享。可复制图片后到微信等应用粘贴，或下载文件发送。';
  if(files.length===1&&!['audio','video'].includes(items[0].media_type)&&navigator.clipboard?.write&&typeof ClipboardItem!=='undefined'){
   try{const blob=await clipboardPNG(files[0]);if(token!==shareToken)return;shareClipboardBlob=blob;document.getElementById('share-copy-image').disabled=false}catch(e){/* Original file sharing and download still work. */}
  }
  if(token!==shareToken)return;
  document.getElementById('share-progress').textContent='';
  if(items[0]?.media_type==='video')document.getElementById('share-image-note').textContent=nativeSupported?'通过系统分享面板发送所选原视频。':'当前浏览器不支持系统文件分享，可复制链接或下载视频后发送。';
  if(items[0]?.media_type==='audio')document.getElementById('share-image-note').textContent=nativeSupported?'通过系统分享面板发送所选音频文件。':'当前浏览器不支持系统文件分享，可下载音频后发送。';
  if(!['audio','video'].includes(items[0]?.media_type)&&!nativeSupported&&!shareClipboardBlob)document.getElementById('share-image-note').textContent='当前浏览器不支持系统分享或复制图片。请下载文件后在微信等应用中选择发送。';
 }catch(e){if(token===shareToken){document.getElementById('share-progress').textContent='文件加载失败，仍可复制链接，或重新加载文件。';document.getElementById('share-retry').hidden=false}}
 finally{if(token===shareToken)shareBusy=false}
}
async function copyShareLinks(){const token=shareToken,field=document.getElementById('share-links');try{if(!navigator.clipboard?.writeText)throw Error('unavailable');await navigator.clipboard.writeText(field.value);if(token===shareToken)document.getElementById('share-progress').textContent=shareAssets.length===1?'已复制素材链接':'已复制全部素材链接'}catch(e){if(token!==shareToken)return;field.focus();field.select();document.getElementById('share-progress').textContent='请按 ⌘C / Ctrl+C 复制已选中的素材链接。'}}
async function nativeShare(mode){const token=shareToken;try{const payload=mode==='images'?{files:shareFiles,title:shareAssets.length===1?shareAssets[0].title:'Vicky 素材分享'}:shareLinkPayload(shareAssets);if(mode==='images'&&!shareFiles.length)return;await navigator.share(payload);if(token===shareToken)document.getElementById('share-progress').textContent='已交给系统分享面板。'}catch(e){if(token!==shareToken)return;document.getElementById('share-progress').textContent=e.name==='AbortError'?'已取消分享，可重新选择。':mode==='images'?'系统分享未完成，可下载文件后发送。':'系统分享未完成，请复制素材链接后发送。'}}
async function copyShareImage(){const token=shareToken;if(!shareClipboardBlob)return;try{await navigator.clipboard.write([new ClipboardItem({'image/png':shareClipboardBlob})]);if(token===shareToken)document.getElementById('share-progress').textContent='已复制图片，可切换到微信等应用粘贴发送。'}catch(e){if(token===shareToken)document.getElementById('share-progress').textContent='未能复制图片，请使用系统分享或下载文件。'}}
function initGalleryActions(){trash=readTrash();document.getElementById('share-dialog').addEventListener('close',()=>{shareToken++;shareBusy=false;});document.getElementById('batch-mode').onclick=toggleSelectionMode;document.getElementById('bulk-all').onclick=()=>{const list=filtered(),all=list.every(a=>selectedAssets.has(favoriteKey(a)));list.forEach(a=>all?selectedAssets.delete(favoriteKey(a)):selectedAssets.add(favoriteKey(a)));renderGrid()};document.getElementById('bulk-share').onclick=()=>openShare(selectedList());document.getElementById('bulk-download').onclick=()=>downloadAssets(selectedList());document.getElementById('bulk-delete').onclick=()=>setTrashed(selectedList(),activeCollection!=='trash');document.getElementById('detail-share').onclick=()=>openShare([assets[modalIndex]]);document.getElementById('detail-download').onclick=()=>downloadAssets([assets[modalIndex]]);document.getElementById('detail-delete').onclick=()=>setTrashed([assets[modalIndex]],!isTrashed(assets[modalIndex]));document.getElementById('share-close').onclick=()=>document.getElementById('share-dialog').close();document.getElementById('share-copy-link').onclick=copyShareLinks;document.getElementById('share-link-native').onclick=()=>nativeShare('links');document.getElementById('share-native').onclick=()=>nativeShare('images');document.getElementById('share-copy-image').onclick=copyShareImage;document.getElementById('share-download').onclick=()=>downloadAssets(shareAssets);document.getElementById('share-retry').onclick=prepareShare;
 document.addEventListener('click',e=>{if(!e.target.closest('.card-menu,.more-button'))closeCardMenu()});document.addEventListener('keydown',e=>{if(openMenuIndex<0)return;if(e.key==='Escape'){e.preventDefault();closeCardMenu(true)}else if(e.key==='ArrowDown'||e.key==='ArrowUp'){const buttons=[...document.querySelectorAll(`#card-menu-${openMenuIndex} button`)];const i=buttons.indexOf(document.activeElement);e.preventDefault();buttons[(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus()}else if(e.key==='Tab')closeCardMenu()});window.addEventListener('storage',e=>{if(e.key!==TRASH_KEY&&e.key!==null)return;trash=readTrash();if(modalIndex>=0)closeModal();renderStats();render()});}

;
// A location owns its spatial views. Shared old boards can belong to several locations.
let activeScene='all',detailScene=null;
const sceneOrder=['scene_original','scene_3d','scene_architecture','scene_plan','scene_angles'];
function sceneMatches(a){return activeKind!=='scene'||activeScene==='all'||a.scene_ids?.includes(activeScene)}
function sceneGroups(list){const q=query.trim().toLowerCase(),all=manifest.scenes||[],named=q?all.filter(s=>s.name.toLowerCase().includes(q)):[];return (named.length?named:all).map(s=>({...s,items:list.filter(a=>a.scene_ids?.includes(s.id)).sort((a,b)=>sceneOrder.indexOf(a.scene_view)-sceneOrder.indexOf(b.scene_view))})).filter(s=>s.items.length&&(activeScene==='all'||activeScene===s.id))}
// Keep the main gallery in global number order; scene relations remain in details.
function sceneGridHTML(list,card){return list.map(card).join('')}
function sceneRelated(id){return assets.filter(a=>a.asset_kind==='scene'&&a.scene_ids?.includes(id)&&!isTrashed(a)).sort((a,b)=>sceneOrder.indexOf(a.scene_view)-sceneOrder.indexOf(b.scene_view))}
function sceneDetailEntries(){return sceneGroups(filtered()).flatMap(s=>s.items.map(asset=>({asset,role:null,scene:s.id})))}
function moveScene(delta){
 const groups=sceneGroups(filtered());if(!groups.length)return;
 const current=assets[modalIndex],i=groups.findIndex(s=>s.id===detailScene),next=groups[(Math.max(i,0)+delta+groups.length)%groups.length];
 detailScene=next.id;modalIndex=assets.indexOf(next.items.find(a=>a.scene_view===current.scene_view)||next.items[0]);updateModal();
}
function moveSceneImage(delta){
 const entries=sceneDetailEntries(),group=entries.filter(e=>e.scene===detailScene);if(!group.length)return;
 const i=group.findIndex(e=>e.asset===assets[modalIndex]),next=group[(Math.max(i,0)+delta+group.length)%group.length];modalIndex=assets.indexOf(next.asset);updateModal();
}
function renderScenePanel(a,host){
 const ids=a.scene_ids||[];if(!ids.includes(detailScene))detailScene=ids[0]||null;
 const s=manifest.scenes.find(s=>s.id===detailScene);if(!s){host.innerHTML='<p>场景归类中</p>';return}
 const related=sceneRelated(s.id),labels=manifest.scene_standard.views;
 host.setAttribute('aria-label','同一场景的空间资料');
 host.innerHTML=`<div class="character-panel-heading"><strong>同一场景 · ${escapeHTML(s.name)}</strong><button id="show-scene-assets">查看全部资产</button></div>${ids.length>1?`<label class="shared-character">共享参考图板 · 选择地点<select id="detail-scene-select" aria-label="选择图板中的场景">${ids.map(id=>`<option value="${escapeHTML(id)}" ${id===detailScene?'selected':''}>${escapeHTML(manifest.scenes.find(s=>s.id===id)?.name||id)}</option>`).join('')}</select></label>`:''}<p class="character-panel-note">← / → 同一场景视图 · ↑ / ↓ 切换场景</p><div class="role-slots">${sceneOrder.map(v=>{const target=related.find(x=>x.scene_view===v&&x.import_batch===a.import_batch)||related.find(x=>x.scene_view===v);return `<button class="role-slot ${target?'available':'missing'}" ${target?`data-scene-asset="${assets.indexOf(target)}"`:'disabled'}><span>${labels[v]}</span><small>${target?'已入库':'待补齐'}</small></button>`}).join('')}</div><p class="character-panel-note">${escapeHTML(manifest.scene_standard.geometry_note)}</p>${a.spatial_attachments?`<p class="character-panel-note">本剧空间预演 · 尺寸与隐藏区域为待确认提案 · <a href="${escapeHTML(a.spatial_attachments.model)}" download>三维模型 OBJ</a> · <a href="${escapeHTML(a.spatial_attachments.material)}" download>材质 MTL</a> · <a href="${escapeHTML(a.spatial_attachments.all_drawings)}" download>完整场景图集</a></p>`:''}<div class="character-views">${related.map(other=>`<button type="button" class="character-view ${other===a?'current':''}" data-scene-asset="${assets.indexOf(other)}" aria-label="切换到${escapeHTML(other.view_label)}：${escapeHTML(s.name)}"><img src="${escapeHTML(galleryThumbURL(other))}" loading="lazy" alt=""><span>${escapeHTML(other.view_label)}${other.scene_ids.length>1?' · 共享参考':''}${other.spatial_attachments?' · 本剧预演':''}</span></button>`).join('')}</div>`;
 host.querySelectorAll('[data-scene-asset]').forEach(b=>b.onclick=()=>{modalIndex=Number(b.dataset.sceneAsset);updateModal()});
 host.querySelector('#detail-scene-select')?.addEventListener('change',e=>{detailScene=e.target.value;updateModal()});
 host.querySelector('#show-scene-assets').onclick=()=>{const id=detailScene;closeModal();resetNavigationFilters();activeKind='scene';activeCollection='all';activeScene=id;render()};
}
function bindSceneGrid(){grid.querySelectorAll('[data-scene-group] .thumb').forEach(el=>{const choose=()=>{detailScene=el.closest('[data-scene-group]').dataset.sceneGroup};el.addEventListener('click',choose,true);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')choose()},true)})}

;
// Explicit character identities; shared boards do not merge their members.
let activeCharacter='all',activeProject='all',activeReadiness='all',groupByCharacter=false,detailCharacter=null;
const projectLabels={'the_ninth_inning':'第九局以后','mii-takes-care-of-you':'今天不要上班，咪养你','off-script / KISS ME FOR REAL':'OFF SCRIPT · KISS ME FOR REAL','the-sea-princes-almost-bride':'海王子的准新娘','3d-white-34-20260923':'白底 3D 角色 · 34 组','3d-front-17-20260923':'白底 3D 角色 · 17 组','front-id-32-20260923':'白底女角色 · 32 组','white-portraits-24-20260922':'白底女角色 · 24 组','male-white-portraits-31-v2-20260923':'男角色 · 31 组','male-white-portraits-23-v2-20260923':'男角色第二版 · 23 组','western-male-white-28-v3-20260923':'欧美男角色 · 28 组','research-white-27-20260923':'调研角色 · 27 组','research-character-batch-20260922':'原创调研角色'};
function roleComplete(c){return manifest.asset_standard.slots.every(s=>galleryRoleAssets(c.id).some(a=>!isTrashed(a)&&a.character_ids.length===1&&a.character_ids[0]===c.id&&(s.views.includes(a.view_type)||(a.verified_slots||[]).includes(s.key))))}
function roleInScope(c){return genderMatches(c)&&(activeProject==='all'||c.project===activeProject)&&(activeReadiness==='all'||(activeReadiness==='complete'?roleComplete(c):!roleComplete(c)))}
const characterById=(()=>{let map;return()=>map||(map=new Map(manifest.characters.map(c=>[c.id,c])));})();
function characterMatches(a,id){const map=characterById();return (id==='all'||(id==='unassigned'?!a.character_ids.length:a.character_ids.includes(id)))&&((activeProject==='all'&&activeReadiness==='all'&&activeGender==='all')||a.character_ids.some(cid=>map.has(cid)&&roleInScope(map.get(cid))))}
function characterFilterHTML(){
 const available=manifest.characters.filter(c=>roleInScope(c)&&galleryRoleAssets(c.id).some(a=>activeCollection==='trash'?isTrashed(a):!isTrashed(a)));
 const projects=[...new Set(manifest.characters.map(c=>c.project))];
 return `<div class="filter-row character-filter"><span class="filter-label">项目</span><select id="project-select" aria-label="按项目或批次筛选"><option value="all">全部项目 / 批次</option>${projects.map(p=>`<option value="${escapeHTML(p)}" ${activeProject===p?'selected':''}>${escapeHTML(projectLabels[p]||p)}</option>`).join('')}</select><select id="readiness-select" aria-label="按素材齐全度筛选"><option value="all">全部素材状态</option><option value="complete" ${activeReadiness==='complete'?'selected':''}>基础素材齐全</option><option value="missing" ${activeReadiness==='missing'?'selected':''}>仍有待补素材</option></select></div><div class="filter-row character-filter"><span class="filter-label">角色</span><select id="character-select" aria-label="按角色筛选"><option value="all">全部角色（${available.length}）</option><option value="unassigned" ${activeCharacter==='unassigned'?'selected':''}>未归类 / 风格参考</option>${available.map(c=>`<option value="${escapeHTML(c.id)}" ${activeCharacter===c.id?'selected':''}>${escapeHTML(c.name)}</option>`).join('')}</select><button id="group-characters" type="button" aria-pressed="${groupByCharacter}" class="${groupByCharacter?'active':''}">按角色归类</button></div><details class="type-level"><summary>展开角色肖像导航</summary><div class="character-rail" aria-label="角色肖像导航">${available.map(c=>{const candidates=galleryRoleAssets(c.id).filter(a=>activeCollection==='trash'?isTrashed(a):!isTrashed(a));const cover=candidates.find(a=>a.character_ids.length===1&&a.view_type==='front')||candidates.find(a=>a.character_ids.length===1&&a.view_type==='face_turnaround')||candidates.find(a=>a.character_ids.length===1)||candidates[0];return cover?`<button type="button" class="character-avatar ${activeCharacter===c.id?'active':''}" data-character-id="${escapeHTML(c.id)}" aria-label="查看角色：${escapeHTML(c.name)}"><img src="${escapeHTML(galleryThumbURL(cover))}" loading="lazy" alt=""><span>${escapeHTML(c.name)}</span></button>`:''}).join('')}</div></details>`;
}
function bindCharacterControls(){
 document.getElementById('project-select').onchange=e=>{activeProject=e.target.value;activeCharacter='all';selectedAssets.clear();render()};
 document.getElementById('readiness-select').onchange=e=>{activeReadiness=e.target.value;activeCharacter='all';selectedAssets.clear();render()};
 document.querySelectorAll('[data-character-id]').forEach(b=>b.onclick=()=>{activeCharacter=b.dataset.characterId;selectedAssets.clear();render()});
 document.getElementById('character-select').onchange=e=>{activeCharacter=e.target.value;selectedAssets.clear();render()};
 document.getElementById('group-characters').onclick=()=>{groupByCharacter=!groupByCharacter;selectedAssets.clear();render()};
}
function characterGridHTML(list,card){list=galleryPageItems(list);
 grid.classList.toggle('character-grouped',groupByCharacter&&activeKind==='character');
 if(activeKind==='scene')return sceneGridHTML(list,card);
 if(!groupByCharacter||activeKind!=='character')return list.map(card).join('');
 const groups=manifest.characters.filter(roleInScope).map(c=>({id:c.id,name:c.name,items:list.filter(a=>a.character_ids.includes(c.id))})).filter(g=>g.items.length&&(activeCharacter==='all'||activeCharacter===g.id));
 const unassigned=list.filter(a=>!a.character_ids.length);
 if(unassigned.length)groups.push({id:'unassigned',name:'未归类 / 风格参考',items:unassigned});
 return groups.map(g=>`<section class="character-group" aria-label="${escapeHTML(g.name)}"><header><h3>${escapeHTML(g.name)}</h3><span>${g.items.length} 张 · ${[...new Set(g.items.map(a=>a.view_label))].map(escapeHTML).join(' / ')}</span></header><div class="character-group-grid">${g.items.map(card).join('')}</div></section>`).join('');
}
function sameCharacterAssets(id){return galleryRoleAssets(id).filter(a=>!isTrashed(a))}
function detailAssetList(){
 return detailAssetEntries().map(entry=>entry.asset);
}
function detailAssetEntries(){
 const current=assets[modalIndex];
 if(activeKind==='scene')return sceneDetailEntries();
 if(current?.asset_kind==='costume'&&current.wardrobe_batch&&current.outfit_refs?.length)return wardrobeDetailList(current).map(asset=>({asset,role:null}));
 // The related-character panel must not lock the preview navigation scope.
 const list=filtered(activeKind==='character'?'all':activeCharacter);
 if(activeKind!=='character')return list.map(asset=>({asset,role:null}));
 const entries=manifest.characters.filter(roleInScope).flatMap(c=>list.filter(a=>a.character_ids.includes(c.id)).map(asset=>({asset,role:c.id})));
 const included=new Set(entries.map(entry=>entry.asset));
 return entries.concat(list.filter(a=>!included.has(a)).map(asset=>({asset,role:null})));
}
function renderPreviewNavigation(a){
 const groupedRole=activeKind==='character'&&a.character_ids.length;
 const groupedOutfit=a.asset_kind==='costume'&&a.wardrobe_batch&&a.outfit_refs?.length;
 const item=a.asset_kind==='scene'?'场景':groupedRole?'角色':groupedOutfit?'套造型':'张图片';
 for(const [id,label,symbol] of [['prev-image','上一张图片','←'],['next-image','下一张图片','→'],['prev','上一'+item,'↑'],['next','下一'+item,'↓']]){
  const button=document.getElementById(id);
  const rotation={'←':180,'→':0,'↑':-90,'↓':90}[symbol];
  button.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 12H20M14 6L20 12L14 18" transform="rotate(${rotation} 12 12)"/></svg>`;
  button.setAttribute('aria-label',label);button.title=`${label}（${symbol}）`;
 }
}
function detailEntryIndex(entries){
 const exact=entries.findIndex(e=>e.asset===assets[modalIndex]&&e.role===detailCharacter&&(!e.scene||e.scene===detailScene));
 return exact>=0?exact:entries.findIndex(e=>e.asset===assets[modalIndex]);
}
function moveImage(delta){
 if(modalIndex<0)return;
 if(activeKind==='scene'){moveSceneImage(delta);return}
 const entries=detailAssetEntries();
 if(!entries.length){closeModal();return}
 const index=detailEntryIndex(entries);
 const next=entries[index<0?(delta>0?0:entries.length-1):(index+delta+entries.length)%entries.length];
 detailCharacter=next.role;modalIndex=assets.indexOf(next.asset);updateModal();
}
function initImageSwipe(){
 const visual=document.querySelector('.modal-visual');let start=null;
 visual.addEventListener('touchstart',e=>{start=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY}:null},{passive:true});
 visual.addEventListener('touchmove',e=>{if(e.touches.length!==1)start=null},{passive:true});
 visual.addEventListener('touchcancel',()=>{start=null},{passive:true});
 visual.addEventListener('touchend',e=>{
  const origin=start;start=null;if(!origin||!e.changedTouches.length)return;
  const dx=e.changedTouches[0].clientX-origin.x,dy=e.changedTouches[0].clientY-origin.y;
  if(Math.abs(dx)>=50&&Math.abs(dx)>Math.abs(dy)*1.5)moveImage(dx<0?1:-1);
 },{passive:true});
}
function moveCharacter(delta){
 if(modalIndex<0)return;
 if(activeKind==='scene'){moveScene(delta);return}
 const current=assets[modalIndex],list=detailAssetList();
 if(current.asset_kind==='costume'&&current.wardrobe_batch&&current.outfit_refs?.length){moveOutfit(delta);return}
 if(activeKind!=='character'||!current.character_ids.length){move(delta);return}
 const groups=manifest.characters.filter(roleInScope).map(c=>({id:c.id,items:list.filter(a=>a.character_ids.includes(c.id))})).filter(g=>g.items.length);
 if(!groups.length)return;
 let index=groups.findIndex(g=>g.id===detailCharacter);
 if(index<0)index=groups.findIndex(g=>current.character_ids.includes(g.id));
 const next=groups[index<0?(delta>0?0:groups.length-1):(index+delta+groups.length)%groups.length];
 const solo=next.items.filter(a=>a.character_ids.length===1);
 const target=solo.find(a=>a.view_type===current.view_type)||solo.find(a=>a.view_type==='front')||solo[0]||next.items[0];
 detailCharacter=next.id;modalIndex=assets.indexOf(target);updateModal();
}
function renderCharacterPanel(a){
 const host=document.getElementById('character-panel'),map=characterById();
 if(a.asset_kind==='costume'&&a.wardrobe_batch&&a.outfit_refs?.length){renderWardrobePanel(a,host);return}
 if(a.asset_kind==='scene'){renderScenePanel(a,host);return}
 if(a.asset_kind!=='character'){
  detailCharacter=null;host.setAttribute('aria-label','素材浏览');
  host.innerHTML='<p class="character-panel-note">使用 ← / → 或 ↑ / ↓ 浏览当前筛选范围内的图片，也可使用键盘方向键。</p>';return;
 }
 host.setAttribute('aria-label','同一角色的其他图片');
 if(!a.character_ids.length){detailCharacter=null;host.innerHTML='<p class="character-empty">此图尚未关联具体角色。</p>';return}
 if(!a.character_ids.includes(detailCharacter))detailCharacter=a.character_ids[0];
 const c=map.get(detailCharacter),related=sameCharacterAssets(detailCharacter);
 const slots=manifest.asset_standard.slots.map(s=>({...s,items:related.filter(x=>x.character_ids.length===1&&(s.views.includes(x.view_type)||(x.verified_slots||[]).includes(s.key)))}));
 const coverageHTML=`<div class="role-slots" aria-label="角色素材配置">${slots.map(s=>`<button type="button" class="role-slot ${s.items.length?'available':'missing'}" ${s.items.length?`data-slot-asset="${assets.indexOf(s.items[0])}"`:'disabled'}><span>${s.label}</span><small>${s.items.length?s.items.length+' 张':'待补齐'}</small></button>`).join('')}</div><p class="character-panel-note">${c.completion_round?'本轮范围 · '+c.completion_round.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3'):'未纳入本轮补图'} · 多人组图不计作单人素材</p>`;
 host.innerHTML=`<div class="character-panel-heading"><strong>同一角色 · ${escapeHTML(c.name)}</strong><button id="show-character-assets">查看全部资产</button></div>${a.character_ids.length>1?`<label class="shared-character">多人组图 · 选择角色<select id="detail-character-select" aria-label="选择组图中的角色">${a.character_ids.map(id=>`<option value="${escapeHTML(id)}" ${id===detailCharacter?'selected':''}>${escapeHTML(map.get(id).name)}</option>`).join('')}</select></label>`:''}<p class="character-panel-note">${related.length} 张已入库图片 · 点击切换视角${related.length===1?'；其他视角暂未入库':''}</p>${coverageHTML}<div class="character-views">${related.map(other=>`<button type="button" class="character-view ${other===a?'current':''}" data-role-asset="${assets.indexOf(other)}" aria-pressed="${other===a}" aria-label="切换到${escapeHTML(other.view_label)}：${escapeHTML(other.title)}"><img src="${escapeHTML(galleryThumbURL(other))}" alt="" loading="lazy"><span>${numberBadge(other)} ${escapeHTML(other.view_label)}${other.character_ids.length>1?' · 多人':''}</span></button>`).join('')}</div>`;
 host.querySelectorAll('[data-slot-asset]').forEach(b=>b.onclick=()=>{modalIndex=Number(b.dataset.slotAsset);updateModal()});
 host.querySelectorAll('[data-role-asset]').forEach(b=>b.onclick=()=>{const next=Number(b.dataset.roleAsset);modalIndex=next;updateModal();host.querySelector(`[data-role-asset="${next}"]`)?.focus({preventScroll:true})});
 const selector=document.getElementById('detail-character-select');if(selector)selector.onchange=e=>{detailCharacter=e.target.value;updateModal()};
 document.getElementById('show-character-assets').onclick=()=>{const id=detailCharacter;closeModal();activeKind='character';activeGender='all';openFilterPanel=null;activeCharacter=id;activeProject='all';activeReadiness='all';activeCollection='all';activeCategory='all';activeStyle='all';activeSpecies='all';query='';selectedAssets.clear();render()};
}

;
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

;
// A styling is a parent asset. Components may belong to more than one styling.
let detailOutfitRef=null;
function outfitAssets(a,ref){return assets.filter(x=>x.asset_kind==='costume'&&x.wardrobe_batch===a.wardrobe_batch&&(x.outfit_refs||[]).includes(ref)&&!isTrashed(x))}
function outfitCover(a,ref){return outfitAssets(a,ref).find(x=>x.category==='outfit')}
function wardrobeDetailList(a){
 const refs=a.outfit_refs||[];
 const ref=refs.includes(detailOutfitRef)?detailOutfitRef:refs[0];
 return outfitAssets(a,ref).sort((x,y)=>({outfit:0,costume:1,accessory:2}[x.category]??3)-({outfit:0,costume:1,accessory:2}[y.category]??3)||x.library_number-y.library_number);
}
function moveOutfit(delta){
 const a=assets[modalIndex],covers=assets.filter(x=>x.asset_kind==='costume'&&x.category==='outfit'&&x.wardrobe_batch===a.wardrobe_batch&&!isTrashed(x)).sort((x,y)=>x.library_number-y.library_number);
 if(!covers.length){move(delta);return}
 const i=covers.findIndex(x=>(x.outfit_refs||[]).includes(detailOutfitRef));
 const next=covers[(i+delta+covers.length)%covers.length];
 detailOutfitRef=next.outfit_refs[0];modalIndex=assets.indexOf(next);updateModal();
}
function renderWardrobePanel(a,host){
 detailCharacter=null;
 const refs=a.outfit_refs||[];
 if(!refs.includes(detailOutfitRef))detailOutfitRef=refs[0];
 const related=wardrobeDetailList(a),cover=outfitCover(a,detailOutfitRef);
 const names={outfit:'完整造型',costume:'服装',accessory:'独立配饰'};
 const thumb=other=>`<button type="button" class="character-view ${other===a?'current':''}" data-wardrobe-asset="${assets.indexOf(other)}" aria-pressed="${other===a}" aria-label="查看搭配素材：${escapeHTML(other.title)}"><img src="${escapeHTML(galleryThumbURL(other))}" alt="" loading="lazy"><span>${numberBadge(other)} ${escapeHTML(other.component_name||other.outfit_name||other.title.split(' · ').slice(-2,-1)[0]||other.view_label)}</span></button>`;
 host.setAttribute('aria-label','套装服装与配饰');
 host.innerHTML=`<div class="character-panel-heading"><strong>套装 ${String(detailOutfitRef||'').padStart(2,'0')} · ${escapeHTML(cover?.outfit_name||'搭配素材')}</strong>${cover&&cover!==a?`<button type="button" data-wardrobe-asset="${assets.indexOf(cover)}">返回完整造型</button>`:''}</div>${refs.length>1?`<label class="shared-character">这件配饰用于 ${refs.length} 套造型<select id="detail-outfit-select" aria-label="选择配饰所属套装">${refs.map(n=>`<option value="${n}" ${n===detailOutfitRef?'selected':''}>套装 ${String(n).padStart(2,'0')} · ${escapeHTML(outfitCover(a,n)?.outfit_name||'搭配')}</option>`).join('')}</select></label>`:''}<p class="character-panel-note">点击下方素材查看大图、提示词或下载原图。</p>${Object.entries(names).map(([kind,label])=>{const items=related.filter(x=>x.category===kind);return `<details class="wardrobe-detail-group" open><summary>${label}<span>${items.length} 张</span></summary>${items.length?`<div class="character-views">${items.map(thumb).join('')}</div>`:`<p class="character-panel-note">${kind==='accessory'?'此套参考未搭配独立配饰。':'暂无可用素材。'}</p>`}</details>`}).join('')}`;
 host.querySelectorAll('[data-wardrobe-asset]').forEach(b=>b.onclick=()=>{modalIndex=Number(b.dataset.wardrobeAsset);updateModal()});
 host.querySelector('#detail-outfit-select')?.addEventListener('change',e=>{detailOutfitRef=Number(e.target.value);updateModal()});
}

;

const manifest=window.__galleryManifest;
const assets=manifest.assets;
function numberBadge(a){return `<span class="library-number" aria-label="编号 ${a.library_number}">${a.library_number}</span>`}
const completion=manifest.asset_standard.completion;
document.getElementById('completion-summary').innerHTML=`<strong>角色素材配置 · 本轮 ${manifest.asset_standard.scope?.character_count||0} 位角色</strong><span>本轮新增 ${completion.generated_additions} 张 · 缺口已补 ${completion.available} / ${completion.initial_gaps} 项 · 尚余 ${completion.pending} 项</span><a href="${manifest.asset_standard.progress_path||'imports/role-completion-20260924/progress.json'}" download>下载补齐进度</a>`;
const styleLabels={"all": "全部风格", "realistic_live_action": "真人写实", "cozy_photoreal_domestic": "居家写实", "otome_2d5d_3d": "乙游 2.5D / 3D", "cinematic_night": "电影夜景", "watercolor": "透明水彩", "oil_painting": "厚涂油画", "cel_animation": "赛璐璐动画", "clay_miniature": "黏土微缩", "paper_art": "层叠纸雕", "ink_wash": "水墨淡彩", "retro_poster": "复古旅行海报", "vintage_film": "复古胶片", "dreamy_3d": "梦幻3D"};
const speciesLabels={all:'全部物种',prop:'道具物件',environment:'环境 / 空间',object:'服装 / 配饰',human:'人类',cat:'猫',dog:'狗',merfolk:'人鱼',mixed:'混合 / 双人'};
const categoryLabels={storyboard:'分镜图',all:'全部用途',prop:'道具图',full_body:'单人全身',expression_grid:'九宫格表情',head_angles:'头部多角度',identity:'身份',character_board:'角色板',face_turnaround:'脸部三视图',body_turnaround:'全身三视图',pov:'POV',outfit:'完整造型',costume:'服装',accessory:'配饰单品',style_reference:'风格参考',relationship:'关系',expression:'表情',pose:'动作姿态',detail:'身份细节'};
const FAVORITES_KEY='vicky-character-library:favorites:v1';
const favoriteKey=a=>a.id||a.path;
const assetURL=a=>a.path+'?v='+a.generation.asset_sha256.slice(0,12);
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let activeStyle='all',activeSpecies='all',activeCategory='all',activeCollection='all',query='',modalIndex=-1;
const controls=document.getElementById('controls'),stats=document.getElementById('stats'),grid=document.getElementById('grid'),empty=document.getElementById('empty'),title=document.getElementById('result-title'),note=document.getElementById('result-note');
function storageNotice(message){const el=document.getElementById('storage-notice');el.textContent=message;el.hidden=!message}
function readFavorites(){
  try{const saved=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]');if(!Array.isArray(saved)||saved.some(v=>typeof v!=='string'))throw new Error('invalid favorites');return new Set(saved)}
  catch(error){storageNotice('暂时无法读取已保存的收藏。请检查浏览器存储设置，当前仍可浏览图片。');return new Set()}
}
let favorites=readFavorites();
const favoriteCount=()=>liveAssets().filter(a=>favorites.has(favoriteKey(a))).length;
function btns(items,group,current){return items.map(([key,label])=>`<button data-group="${group}" data-value="${key}" aria-pressed="${current===key}" class="${current===key?'active':''}">${label}</button>`).join('')}
function filtered(character=activeCharacter){const list=assets.filter(a=>{const hay=gallerySearchHay(a);return kindMatches(a)&&sceneMatches(a)&&(activeCollection==='trash'?isTrashed(a):!isTrashed(a))&&(activeCollection!=='favorites'||favorites.has(favoriteKey(a)))&&(activeStyle==='all'||a.style_family===activeStyle)&&(activeSpecies==='all'||a.species===activeSpecies)&&(activeCategory==='all'||a.category===activeCategory)&&characterMatches(a,character)&&matchesAssetSearch(a,hay)});return list.sort((a,b)=>a.library_number-b.library_number)}
function renderStats(){const current=liveAssets();const styles=new Set(current.map(a=>a.style_family)),species=new Set(current.map(a=>a.species));document.getElementById('policy-count').textContent=current.length;stats.innerHTML=`<div class="stat"><b>${current.length}</b><span>确认资产</span></div><div class="stat"><b>${styles.size}</b><span>风格分类</span></div><div class="stat"><b>${species.size}</b><span>物种分类</span></div><div class="stat"><b>${current.filter(a=>a.category==='identity').length}</b><span>身份资产</span></div>`}
function starButton(a,index){const saved=favorites.has(favoriteKey(a));return `<button type="button" class="favorite-button" data-favorite-index="${index}" aria-pressed="${saved}" aria-label="${saved?'取消收藏':'收藏'}：${escapeHTML(a.title)}" title="${saved?'取消收藏':'收藏'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.78 5.64L21 9.55l-4.5 4.39 1.06 6.2L12 17.21l-5.56 2.93 1.06-6.2L3 9.55l6.22-.91Z"/></svg></button>`}
function renderGrid(){
 const list=filtered();
 grid.innerHTML=characterGridHTML(list,a=>{const index=assets.indexOf(a);return `<article class="card ${selectedAssets.has(favoriteKey(a))?'selected':''}"><div class="thumb ${a.generation.dimensions.height>a.generation.dimensions.width?'portrait-thumb':'sheet-thumb'}" data-index="${index}" tabindex="0" aria-label="预览：${escapeHTML(a.title)}"><img decoding="async" loading="lazy" src="${escapeHTML(galleryThumbURL(a))}" alt="${escapeHTML(a.title)}">${starButton(a,index)}${selectionMode?`<input type="checkbox" class="select-image" data-select-index="${index}" aria-label="选择：${escapeHTML(a.title)}" ${selectedAssets.has(favoriteKey(a))?'checked':''}>`:''}</div><div class="meta">${numberBadge(a)}<h3>${escapeHTML(a.title)}</h3><div class="chips"><span class="chip">${styleLabels[a.style_family]}</span><span class="chip">${speciesLabels[a.species]}</span><span class="chip">${escapeHTML(a.view_label)}</span></div><div class="source">${escapeHTML(a.generation.generation_date||'生成日期未记录')} · ${a.completion_round?'补充素材':'已入库'}</div>${cardActions(a,index)}</div></article>`});
 empty.hidden=list.length!==0;
 empty.textContent=activeCollection==='trash'?'回收站为空。删除的图片会保存在这里，可以随时恢复。':activeCollection==='favorites'?(favoriteCount()===0?'还没有收藏。到「全部」点击图片右上角的 ☆，喜欢的角色就会出现在这里。':'收藏中没有符合筛选条件的图片。试试其他筛选条件或关键词。'):'没有符合筛选条件的资产。';
 title.textContent=activeCollection==='trash'?'回收站':activeCollection==='favorites'?'我的收藏':(activeStyle==='all'&&activeSpecies==='all'&&activeCategory==='all'&&activeCharacter==='all'&&activeProject==='all'&&activeReadiness==='all'&&!query?'全部确认资产':'筛选结果');
 note.textContent=`显示 ${list.length} / ${activeCollection==='favorites'?favoriteCount():(activeCollection==='trash'?assets.filter(isTrashed).length:liveAssets().length)} 项${query?` · 搜索“${query}”`:''}${activeCharacter!=='all'?` · ${characterById().get(activeCharacter)?.name||'未归类 / 风格参考'}`:''}${groupByCharacter?' · 多人组图会显示在对应角色下':''}`;
 grid.querySelectorAll('.thumb').forEach(el=>{el.onclick=()=>selectionMode?toggleImageSelection(Number(el.dataset.index)):openModal(Number(el.dataset.index));el.onkeydown=e=>{if(e.target===el&&(e.key==='Enter'||e.key===' ')){e.preventDefault();selectionMode?toggleImageSelection(Number(el.dataset.index)):openModal(Number(el.dataset.index))}}});
 grid.querySelectorAll('[data-detail-index]').forEach(el=>el.onclick=()=>openModal(Number(el.dataset.detailIndex)));
 grid.querySelectorAll('[data-favorite-index]').forEach(el=>el.onclick=e=>{e.stopPropagation();toggleFavorite(Number(el.dataset.favoriteIndex),true)});
 renderNavigationResults(list);
 bindSceneGrid();
 bindCardActions();
}
function toggleFavorite(index,restoreFocus=false){
 const key=favoriteKey(assets[index]);const updated=new Set(favorites);const wasSaved=updated.has(key);
 if(wasSaved)updated.delete(key);else updated.add(key);
 try{localStorage.setItem(FAVORITES_KEY,JSON.stringify([...updated]));storageNotice('')}
 catch(error){storageNotice('收藏未能保存，请检查浏览器存储权限或可用空间后重试。');return}
 const previousList=filtered();favorites=updated;
 document.getElementById('favorites-count').textContent=favoriteCount();renderGrid();
 document.getElementById('favorite-status').textContent=wasSaved?'已取消收藏':'已加入我的收藏';
 if(modalIndex>=0){const nextList=filtered();if(detailCharacter||assets[modalIndex]?.asset_kind==='costume'||nextList.includes(assets[modalIndex]))updateModal();else if(nextList.length){const oldIndex=previousList.indexOf(assets[modalIndex]);openModal(assets.indexOf(nextList[Math.min(Math.max(0,oldIndex),nextList.length-1)]))}else closeModal()}
 if(restoreFocus){const button=grid.querySelector(`[data-favorite-index="${index}"]`)||grid.querySelector('[data-favorite-index]')||controls.querySelector('[data-value="favorites"]');button?.focus({preventScroll:true})}
}
function render(){renderControls();renderGrid()}
function updateModal(){
 const a=assets[modalIndex];renderCharacterPanel(a);const list=detailAssetList();const saved=favorites.has(favoriteKey(a));
 document.getElementById('modal-img').src=assetURL(a);document.getElementById('modal-img').alt=a.title;
 document.getElementById('modal-position').textContent=`${detailEntryIndex(detailAssetEntries())>=0?detailEntryIndex(detailAssetEntries())+1:'—'} / ${list.length} · ${a.asset_kind==='costume'?'本套造型与单品':'筛选范围内图片'}`;
 if(a.asset_kind==='scene'){const group=sceneDetailEntries().filter(e=>e.scene===detailScene);document.getElementById('modal-position').textContent=`${group.findIndex(e=>e.asset===a)+1} / ${group.length} · 同一场景视图`;}
 renderPreviewNavigation(a);
 renderGenerationDetails(a);
 document.getElementById('detail-purge').hidden=!isTrashed(a);
 const deleteButton=document.getElementById('detail-delete');deleteButton.textContent=isTrashed(a)?'恢复':'删除';deleteButton.classList.toggle('danger',!isTrashed(a));
 const button=document.getElementById('modal-favorite');button.textContent=saved?'★ 已收藏':'☆ 收藏';button.setAttribute('aria-pressed',String(saved));button.setAttribute('aria-label',(saved?'取消收藏：':'收藏：')+a.title);
}
const promptKindLabel=g=>g.prompt_kind==='original_text_to_image'?'原始文生图提示词':'按成图重建 · 独立文生图提示词';
function dateLabel(g){return g.generation_date?g.generation_date+(g.source_type==='derived_crop'?'（母图生成日期）':''):'未知 · 未取得生成记录'}
function renderGenerationDetails(a){
 const g=a.generation;
 document.getElementById('detail-title').textContent=a.library_number+' · '+a.title;
 document.getElementById('generation-facts').innerHTML=`<dt>生图模型</dt><dd>${escapeHTML(g.model.display_name)}</dd><dt>生成日期</dt><dd>${escapeHTML(dateLabel(g))}<div class="detail-small">${escapeHTML(g.generation_date?'时区：'+g.generation_timezone:g.generation_date_note)}</div></dd><dt>原图尺寸</dt><dd>${g.dimensions.width} × ${g.dimensions.height} px</dd>`;
 document.getElementById('prompt-kind').textContent=promptKindLabel(g);
 document.getElementById('generation-prompt').value=g.text_to_image_prompt;
 document.getElementById('download-record').href=g.record_download;
 document.getElementById('copy-status').textContent='';
 document.getElementById('reproduction-note').textContent=g.reproduction_note;
 const details=document.getElementById('original-record');details.open=false;
 document.getElementById('original-content').innerHTML=`<p>来源：${escapeHTML(a.source)}</p>${g.derivation_note?`<p>${escapeHTML(g.derivation_note)}</p>`:''}<p>提示词整理日期：${escapeHTML(g.prompt_prepared_on)}（不代表图片生成日期）</p>${g.generated_at?`<p>生成时间（UTC）：${escapeHTML(g.generated_at)}</p>`:''}${g.original_prompt?`<p>${escapeHTML(g.original_prompt_label)}</p><pre>${escapeHTML(g.original_prompt)}</pre>`:'<p>原始生成提示词未取得；上方提供按成图重建的独立文生图提示词。</p>'}${(g.evidence||[]).map((path,i)=>`<a href="${escapeHTML(path)}" target="_blank" rel="noopener">生成依据 ${i+1}</a>`).join(' · ')}`;
 document.getElementById('image-details').scrollTop=0;
 document.querySelector('.modal-layout').scrollTop=0;
}
document.getElementById('copy-prompt').onclick=async()=>{
 const index=modalIndex;const prompt=assets[index].generation.text_to_image_prompt;
 try{await navigator.clipboard.writeText(prompt);if(modalIndex===index)document.getElementById('copy-status').textContent='已复制完整文生图提示词';}
 catch(error){if(modalIndex!==index)return;const input=document.getElementById('generation-prompt');input.focus();input.select();document.getElementById('copy-status').textContent='自动复制不可用，提示词已全选，请按 ⌘C / Ctrl+C 复制。';}
};
function openModal(index){closeCardMenu();if(!assets[index].scene_ids?.includes(detailScene))detailScene=activeScene==='all'?null:activeScene;detailOutfitRef=null;detailCharacter=assets[index].character_ids.includes(activeCharacter)?activeCharacter:null;modalIndex=index;updateModal();document.getElementById('modal').classList.add('open');document.body.style.overflow='hidden';document.getElementById('close').focus({preventScroll:true})}
function move(delta){moveImage(delta)}
function closeModal(){const index=modalIndex;document.getElementById('modal').classList.remove('open');document.body.style.overflow='';modalIndex=-1;detailCharacter=null;(grid.querySelector(`.thumb[data-index="${index}"]`)||controls.querySelector('[data-value="favorites"]'))?.focus({preventScroll:true})}
document.getElementById('modal-favorite').onclick=()=>toggleFavorite(modalIndex);
document.getElementById('prev-image').onclick=()=>move(-1);document.getElementById('next-image').onclick=()=>move(1);initImageSwipe();
document.getElementById('prev').onclick=()=>moveCharacter(-1);document.getElementById('next').onclick=()=>moveCharacter(1);document.getElementById('close').onclick=closeModal;document.getElementById('modal').onclick=e=>{if(e.target.id==='modal')closeModal()};
document.addEventListener('keydown',e=>{
 if(document.getElementById('share-dialog').open||document.getElementById('purge-dialog').open)return;
 if(!document.getElementById('modal').classList.contains('open'))return;
 const editing=e.target.matches('textarea,input,select,[contenteditable="true"]');
 if(!editing&&(e.key==='ArrowUp'||e.key==='ArrowDown')){e.preventDefault();moveCharacter(e.key==='ArrowUp'?-1:1)}
 if(!editing&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();move(e.key==='ArrowLeft'?-1:1)}
 if(e.key==='Escape')closeModal();
 if(e.key==='Tab'){const buttons=[...document.querySelectorAll('#modal button,#modal textarea,#modal summary,#modal a')].filter(el=>el.getClientRects().length);const current=buttons.indexOf(document.activeElement);if(e.shiftKey&&current<=0){e.preventDefault();buttons.at(-1).focus()}else if(!e.shiftKey&&current===buttons.length-1){e.preventDefault();buttons[0].focus()}}
});
window.addEventListener('storage',e=>{if(e.key!==FAVORITES_KEY&&e.key!==null)return;favorites=readFavorites();document.getElementById('favorites-count').textContent=favoriteCount();renderGrid();if(modalIndex>=0){if(detailCharacter||filtered().includes(assets[modalIndex]))updateModal();else closeModal()}});
initGalleryActions();renderStats();render();


;
// Audio uses its own catalog; image provenance and slot completeness are untouched.
const voiceCatalog=manifest.voices||[];
let voicePreviewObserver;
let voiceProject='all',voiceGender='all',voiceAge='all',voiceRole='all',voiceLanguage='all',voiceLicense='all';
const voiceLanguages={zh:'中文',en:'英语',ja:'日语',ko:'韩语',fr:'法语',es:'西班牙语',hi:'印地语',it:'意大利语',pt:'葡萄牙语'};
const voiceLanguageLabel=v=>voiceLanguages[v.language]||v.language||'未标注';
const stockVoiceDetails=v=>!v.commercial_license?'':`<p>现成预设：${escapeHTML(v.preset_id)} · ${escapeHTML(v.provider)}</p><p>许可：${escapeHTML(v.commercial_license.name)}，${escapeHTML(v.commercial_license.summary)}</p><p>${escapeHTML(v.reuse_note)}</p>${v.quality_note?`<p>${escapeHTML(v.quality_note)}</p>`:''}<p><a href="${escapeHTML(v.official_url)}" target="_blank" rel="noopener">官方音色来源</a> · <a href="${escapeHTML(v.commercial_license.record)}" target="_blank" rel="noopener">许可与署名记录</a></p>`;
const voiceOptions=(values,current,all)=>`<option value="all">${all}</option>`+values.map(v=>`<option value="${escapeHTML(v)}" ${v===current?'selected':''}>${escapeHTML(v)}</option>`).join('');
const imageRenderGrid=renderGrid,imageRenderControls=renderControls;
const voiceKey=v=>'voice:'+v.id;
const voiceURL=v=>v.path+'?v='+v.sha256.slice(0,12);
function voiceList(){return voiceCatalog.filter(v=>(voiceLanguage==='all'||v.language===voiceLanguage)&&(voiceLicense==='all'||Boolean(v.commercial_license))&&(voiceProject==='all'||v.project===voiceProject)&&(voiceGender==='all'||v.gender===voiceGender)&&(voiceAge==='all'||(v.age_group||'未标注')===voiceAge)&&(voiceRole==='all'||(v.role_group||'剧集角色')===voiceRole)&&(activeCollection!=='favorites'||favorites.has(voiceKey(v)))&&matchesAssetSearch(v,[v.name,v.project,v.character,v.direction,v.text,v.age_group,v.age_range,v.role_group,v.timbre,v.preset_id,v.provider,voiceLanguageLabel(v),v.library_number,...(v.tags||[])].join(' '))).sort((a,b)=>a.library_number-b.library_number)}
renderControls=function(){
 if(activeKind!=='voice'){
  imageRenderControls();
  if(voiceCatalog.length)controls.querySelector('[data-kind="voice"] .planned')?.remove();
  return;
 }
 controls.innerHTML=`<div class="navigation-main"><div class="library-kinds" aria-label="素材大类">${Object.entries(kindLabels).map(([k,label])=>`<button data-kind="${k}" class="kind-tab ${k==='voice'?'active':''}" aria-pressed="${k==='voice'}">${label}</button>`).join('')}</div><input class="search" id="search" aria-label="搜索音色序号或关键词" placeholder="搜索序号、角色或音色…" value="${escapeHTML(query)}"></div><div class="navigation-tools voice-tools">${btns([['all','全部'],['favorites','★ 收藏']],'voice-collection',activeCollection)}<span class="nav-divider"></span><select class="voice-filter" id="voice-project" aria-label="音色项目"><option value="all">全部项目</option>${[...new Set(voiceCatalog.map(v=>v.project))].map(p=>`<option ${p===voiceProject?'selected':''}>${escapeHTML(p)}</option>`).join('')}</select><select class="voice-filter" id="voice-gender" aria-label="声音类型">${[['all','全部声音'],['female','女声'],['male','男声'],['neutral','中性声'],['unknown','角色声']].map(([k,label])=>`<option value="${k}" ${k===voiceGender?'selected':''}>${label}</option>`).join('')}</select><select class="voice-filter" id="voice-age" aria-label="音色年龄">${voiceOptions(['儿童','少年','青年','中年','老年','未标注'],voiceAge,'全部年龄')}</select><select class="voice-filter" id="voice-role" aria-label="音色身份">${voiceOptions([...new Set(voiceCatalog.map(v=>v.role_group||'剧集角色'))],voiceRole,'全部身份')}</select><select class="voice-filter" id="voice-language" aria-label="音色语言"><option value="all">全部语言</option>${[...new Set(voiceCatalog.map(v=>v.language))].map(l=>`<option value="${escapeHTML(l)}" ${l===voiceLanguage?'selected':''}>${escapeHTML(voiceLanguages[l]||l)}</option>`).join('')}</select><select class="voice-filter" id="voice-license" aria-label="商用许可"><option value="all">全部来源</option><option value="verified" ${voiceLicense==='verified'?'selected':''}>本批商用现成音色</option></select><button id="voice-reset" class="voice-reset">重置</button><span id="favorites-count" class="sr-only">${favoriteCount()}</span></div>`;
 controls.querySelectorAll('[data-kind]').forEach(b=>b.onclick=()=>{activeKind=b.dataset.kind;activeCollection='all';resetNavigationFilters();openFilterPanel=null;render()});
 controls.querySelectorAll('[data-group="voice-collection"]').forEach(b=>b.onclick=()=>{activeCollection=b.dataset.value;render()});
 controls.querySelector('#search').oninput=e=>{query=e.target.value;renderGrid()};
 controls.querySelector('#voice-project').onchange=e=>{voiceProject=e.target.value;renderGrid()};
 controls.querySelector('#voice-gender').onchange=e=>{voiceGender=e.target.value;renderGrid()};
 controls.querySelector('#voice-age').onchange=e=>{voiceAge=e.target.value;renderGrid()};
 controls.querySelector('#voice-role').onchange=e=>{voiceRole=e.target.value;renderGrid()};
 controls.querySelector('#voice-language').onchange=e=>{voiceLanguage=e.target.value;renderGrid()};
 controls.querySelector('#voice-license').onchange=e=>{voiceLicense=e.target.value;renderGrid()};
 controls.querySelector('#voice-reset').onclick=()=>{voiceProject=voiceGender=voiceAge=voiceRole=voiceLanguage=voiceLicense='all';query='';render()};
};
renderGrid=function(){
 voicePreviewObserver?.disconnect();
 document.querySelectorAll('.voice-card audio').forEach(a=>a.pause());
 grid.classList.toggle('voice-grid',activeKind==='voice');
 document.getElementById('batch-mode').hidden=activeKind==='voice';
 if(activeKind!=='voice'){imageRenderGrid();return}
 const allItems=voiceList();const list=galleryPageItems(allItems);grid.classList.remove('character-grouped');
 document.getElementById('bulk-bar').hidden=true;
 document.getElementById('empty-trash').hidden=true;
 title.textContent=activeCollection==='favorites'?'收藏的角色音色':'音色库';
 note.textContent=`显示 ${allItems.length} / ${voiceCatalog.length} 个音色 · 可试听与下载`;
 empty.hidden=!!list.length;empty.textContent='没有符合条件的音色，可清空搜索或切换项目。';
 grid.innerHTML=list.map(v=>`<article class="card voice-card" data-voice-id="${escapeHTML(v.id)}"><button class="favorite-button" data-voice-favorite="${escapeHTML(v.id)}" aria-label="${favorites.has(voiceKey(v))?'取消收藏':'收藏'}：${escapeHTML(v.name)}" aria-pressed="${favorites.has(voiceKey(v))}">${favorites.has(voiceKey(v))?'★':'☆'}</button><div>${numberBadge(v)}<h3>${escapeHTML(v.name)}</h3><div class="voice-project">${escapeHTML(v.project)} · ${v.duration_seconds.toFixed(1)} 秒 · ${escapeHTML(voiceLanguageLabel(v))}</div>${v.age_group?`<div class="voice-tags"><span>${escapeHTML(v.age_group)} · ${escapeHTML(v.age_range)}</span><span>${escapeHTML(v.role_group)}</span><span>${escapeHTML(v.timbre)}</span></div>`:''}${v.commercial_license?`<div class="voice-new">现成音色 · 可商用 · ${escapeHTML(v.commercial_license.name)}</div>`:''}${v.status==='generated'?'<div class="voice-new">新设计音色 · 可选用</div>':''}</div><div class="voice-player"><button class="voice-play" aria-label="播放 ${escapeHTML(v.name)}">▶ 试听</button><input class="voice-seek" type="range" min="0" max="${v.duration_seconds}" step="0.01" value="0" aria-label="${escapeHTML(v.name)} 播放进度"><span class="voice-time">0:00</span><audio preload="none" src="${escapeHTML(voiceURL(v))}"></audio></div><p class="voice-line">${escapeHTML(v.text)}</p>${v.verification?.transcript_exact_words===false?'<p class="voice-variant">自动转写检测到口语变体，详见声音设定。</p>':''}<details><summary>声音设定与来源</summary><p>${escapeHTML(v.confirmation.note)}</p><p>模型：${escapeHTML(v.model)}</p>${stockVoiceDetails(v)}${v.approved_playback?`<p>已确认表演版本：保留你选中试听的完整停顿、呼吸与原始节奏；不重新裁剪或处理。实测 ${v.normalization.measured_lufs.toFixed(2)} LUFS。</p>`:v.normalization?`<p>统一响度：目标 −18 LUFS，实测 ${v.normalization.measured_lufs.toFixed(2)} LUFS；真实峰值 ${v.normalization.true_peak_dbtp.toFixed(2)} dBTP（上限 −1.5 dBTP）。原始音频已保留，试听和下载使用统一响度版本。${v.onset_cleanup?`已清理首尾空白和过长静音，保留首字余量与自然短停顿。`:""}</p>`:''}<p>${escapeHTML(v.direction)}</p>${v.transcript_note?`<p>${escapeHTML(v.transcript_note)}</p>`:''}${v.verification?.transcript_exact_words===false?`<p>自动转写：${escapeHTML(v.observed_transcript)}</p>`:''}<p>${escapeHTML(v.accent_direction||voiceLanguageLabel(v))}。${v.status==='generated'?'年龄、身份与音色标签为选角设计；生成参数及自动检查记录已保留。':(v.commercial_license?'年龄未公开的预设不推断年龄；用途标签仅作选角参考。':'本次导入未重新评估口音或音色相似度。')}</p><pre>${escapeHTML(JSON.stringify(v.parameters,null,2))}</pre><a href="${escapeHTML(v.confirmation_evidence)}" target="_blank" rel="noopener">查看入库依据</a></details><div class="voice-downloads"><a href="${escapeHTML(v.path)}" download>下载音频</a><a href="${escapeHTML(v.record_download)}" download>下载音色记录</a>${v.commercial_license?`<a href="${escapeHTML(v.commercial_license.record)}" download>下载许可说明</a>`:""}</div></article>`).join('');
 grid.querySelectorAll('.voice-card').forEach(card=>{
  const a=card.querySelector('audio'),button=card.querySelector('.voice-play'),seek=card.querySelector('.voice-seek'),time=card.querySelector('.voice-time');
  let loadingTimer;
  const resetButton=()=>{clearTimeout(loadingTimer);button.textContent='▶ 试听';button.setAttribute('aria-label','播放 '+card.querySelector('h3').textContent);button.removeAttribute('aria-busy')};
  const failed=()=>{a.pause();resetButton();time.textContent='加载失败，请重试';};
  const loading=()=>{clearTimeout(loadingTimer);button.textContent='加载中…';button.setAttribute('aria-busy','true');loadingTimer=setTimeout(failed,8000)};
  button.onclick=async()=>{
   if(!a.paused){a.pause();return}
   if(a.ended||(Number.isFinite(a.duration)&&a.duration-a.currentTime<0.3))a.currentTime=0;
   if(a.error)a.load();
   loading();
   try{await a.play()}catch(e){if(e.name!=='AbortError')failed()}
  };
  a.addEventListener('play',()=>grid.querySelectorAll('audio').forEach(other=>{if(other!==a)other.pause()}));
  a.addEventListener('playing',()=>{clearTimeout(loadingTimer);button.removeAttribute('aria-busy');button.textContent='❚❚ 暂停';button.setAttribute('aria-label','暂停 '+card.querySelector('h3').textContent)});
  a.addEventListener('waiting',()=>{if(!a.paused)loading()});
  a.addEventListener('error',failed);
  a.addEventListener('pause',resetButton);
  a.addEventListener('ended',()=>{resetButton();a.currentTime=0;seek.value=0;time.textContent='0:00'});
  a.addEventListener('timeupdate',()=>{seek.value=a.currentTime;time.textContent=Math.floor(a.currentTime/60)+':'+String(Math.floor(a.currentTime%60)).padStart(2,'0')});
  a.addEventListener('loadedmetadata',()=>{seek.max=a.duration});
  seek.oninput=()=>{a.currentTime=Number(seek.value)};
 });
 // Warm only nearby previews, so clicking does not wait on metadata-only loading.
 if('IntersectionObserver' in window){
  voicePreviewObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{
   if(!entry.isIntersecting)return;
   const audio=entry.target.querySelector('audio');audio.preload='none';
   
   voicePreviewObserver.unobserve(entry.target);
  }),{rootMargin:'200px'});
  grid.querySelectorAll('.voice-card').forEach(card=>voicePreviewObserver.observe(card));
 }
 grid.querySelectorAll('[data-voice-favorite]').forEach(b=>b.onclick=()=>{
  const v=voiceCatalog.find(v=>v.id===b.dataset.voiceFavorite),key=voiceKey(v),updated=new Set(favorites);
  if(updated.has(key))updated.delete(key);else updated.add(key);
  try{localStorage.setItem(FAVORITES_KEY,JSON.stringify([...updated]));favorites=updated;renderGrid()}catch(e){storageNotice('音色收藏未能保存，请检查浏览器存储权限。')}
 });
};
function navigateVoices(){if(location.hash==='#voices'){activeKind='voice';activeCollection='all';resetNavigationFilters();render()}}
window.addEventListener('hashchange',navigateVoices);
if(location.hash==='#voices')navigateVoices();else renderControls();

;
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
 const allItems=bgmList();const list=galleryPageItems(allItems);title.textContent=activeCollection==='favorites'?'收藏的背景音乐':'背景音乐库';
 note.textContent=`显示 ${allItems.length} / ${bgmCatalog.length} 首 · 共 ${manifest.bgm_version_count||0} 个音频版本 · 网络精选可商用，需按每首说明署名`;
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

;
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
 const allItems=videoList();const list=galleryPageItems(allItems),items=list.map(videoAsset);
 title.textContent=(activeCollection==='favorites'?'收藏 · ':activeCollection==='trash'?'回收站 · ':'')+'视频样例';
 note.textContent=`显示 ${allItems.length} / ${videoCatalog.length} 个已确认 case · Magnus Thorne · 原视频与复用资料`;
 empty.hidden=!!list.length;empty.textContent=activeCollection==='trash'?'视频回收站为空。':'没有符合条件的视频，可重置搜索或筛选。';
 grid.innerHTML=list.map((v,i)=>`<article class="card video-card ${selectedAssets.has(videoKey(v))?'selected':''}"><div class="video-stage">${numberBadge(v)}<button class="favorite-button" data-video-favorite="${i}" aria-label="${favorites.has(videoKey(v))?'取消收藏':'收藏'}：${escapeHTML(v.name)}" aria-pressed="${favorites.has(videoKey(v))}">${favorites.has(videoKey(v))?'★':'☆'}</button><video controls playsinline preload="none" tabindex="0" aria-label="播放${escapeHTML(v.name)}" poster="${escapeHTML(v.poster)}" src="${escapeHTML(videoPlaybackURL(v))}"></video><p class="video-error" hidden>播放失败，可下载原视频查看。</p></div><div class="meta">${selectionMode?`<label class="video-selection"><input type="checkbox" data-video-select="${i}" aria-label="选择：${escapeHTML(v.name)}" ${selectedAssets.has(videoKey(v))?'checked':''}>选择</label>`:''}<h3>${escapeHTML(v.name)}</h3><div class="chips"><span class="chip">${escapeHTML(v.category)}</span><span class="chip">${v.duration_seconds.toFixed(1)} 秒</span><span class="chip">${v.width} × ${v.height}</span></div><div class="source">${escapeHTML(v.imported_on)} · 已确认 · ${v.pages_web_copy?'网页播放版':'原文件'}</div>${cardActions(items[i],i)}</div></article>`).join('');
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
 videoDialog.innerHTML=`<div class="video-detail-header"><h2 id="video-detail-title">${escapeHTML(v.name)}</h2><button id="video-detail-close" aria-label="关闭视频详情">×</button></div><div class="video-detail-body"><div class="video-detail-player"><video controls playsinline preload="metadata" tabindex="0" aria-label="播放${escapeHTML(v.name)}" poster="${escapeHTML(v.poster)}" src="${escapeHTML(videoPlaybackURL(v))}"></video><p class="video-error" hidden>播放失败，可下载原视频查看。</p></div><div class="video-detail-info"><div class="video-detail-actions"><button id="video-detail-share">分享</button><button id="video-detail-download">${v.pages_web_copy?'下载网页视频':'下载原视频'}</button><button id="video-detail-delete" class="danger">${isTrashed(a)?'恢复':'删除'}</button></div><dl><dt>类别</dt><dd>${escapeHTML(v.category)}</dd><dt>模型</dt><dd>${escapeHTML(v.model)}</dd><dt>生成日期</dt><dd>${escapeHTML(v.generation_date||'未核实')}<small>${escapeHTML(v.generation_date_note)}</small></dd><dt>入库日期</dt><dd>${escapeHTML(v.imported_on)}</dd><dt>视频规格</dt><dd>${v.width} × ${v.height} · ${v.duration_seconds.toFixed(2)} 秒 · ${v.fps} fps</dd></dl><p><a href="${escapeHTML(v.source_url)}" target="_blank" rel="noopener noreferrer">查看飞书原文 ↗</a> · 修订 ${v.source_revision}</p><p class="video-detail-links"><a href="${escapeHTML(v.reuse_pack.path)}" download>下载复用素材包 ZIP</a><a href="${escapeHTML(v.record_download)}" download>下载提示词与来源记录</a></p>${v.pages_web_copy?'<p class="source">超大视频使用网页播放版；原文件请从完整备份获取。</p>':v.playback?'<p class="source">网页播放使用兼容副本；下载保留原视频。</p>':''}<h3>视频提示词</h3><p class="source">按文档标签保留原始输入与成片反推，复现时可配合素材包中的参考图。</p>${v.prompts.map((p,i)=>`<details class="video-prompt" ${i===0?'open':''}><summary>${escapeHTML(p.label||'制作提示词')}</summary><textarea readonly aria-label="${escapeHTML(p.label||'制作提示词')}">${escapeHTML(p.text)}</textarea><button data-copy-video-prompt="${i}">复制此提示词</button></details>`).join('')}<p id="video-copy-status" role="status"></p></div></div>`;
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

;
// One selection scope per library and filter; audio uses namespaced persistent IDs.
const isAudioLibrary=()=>activeKind==='voice'||activeKind==='bgm';
function audioAsset(item,kind=activeKind){
 const v=kind==='bgm'?(item.variants.find(v=>v.id===(bgmChoices.get(item.id)||item.default_variant))||item.variants[0]):item;
 return {id:kind+':'+item.id,path:v.path,title:item.name,media_type:'audio',generation:{asset_sha256:v.sha256},record:item};
}
const baseVoiceList=voiceList,baseBgmList=bgmList;
voiceList=function(){return baseVoiceList().filter(v=>activeCollection==='trash'?isTrashed(audioAsset(v,'voice')):!isTrashed(audioAsset(v,'voice')))};
bgmList=function(){return baseBgmList().filter(v=>activeCollection==='trash'?isTrashed(audioAsset(v,'bgm')):!isTrashed(audioAsset(v,'bgm')))};
function batchList(){return activeKind==='voice'?voiceList().map(v=>audioAsset(v)):activeKind==='bgm'?bgmList().map(v=>audioAsset(v)):activeKind==='video'?videoList().map(videoAsset):filtered()}
selectedList=function(){return batchList().filter(a=>selectedAssets.has(favoriteKey(a)))};
renderBulkBar=function(){
 const list=batchList(),allowed=new Set(list.map(favoriteKey));
 selectedAssets=new Set([...selectedAssets].filter(k=>allowed.has(k)));
 const count=selectedList().length,audio=isAudioLibrary()||activeKind==='video',b=document.getElementById('batch-mode');
 b.hidden=false;b.textContent=selectionMode?'完成选择':'批量选择';b.setAttribute('aria-pressed',String(selectionMode));
 document.getElementById('bulk-bar').hidden=!selectionMode;
 document.querySelector('.batch-dock').hidden=!selectionMode;
 document.getElementById('bulk-count').textContent=`已选 ${count} 项 · 当前结果 ${list.length} 项`;
 document.getElementById('bulk-all').textContent=count===list.length&&list.length?'取消全选':'全选当前结果';
 document.getElementById('bulk-all').disabled=!list.length;
 for(const id of ['bulk-share','bulk-download','bulk-delete'])document.getElementById(id).disabled=!count;
 const del=document.getElementById('bulk-delete');del.textContent=activeCollection==='trash'?'批量恢复':'批量删除';del.classList.toggle('danger',activeCollection!=='trash');
 document.getElementById('bulk-purge').hidden=audio||activeCollection!=='trash';document.getElementById('bulk-purge').disabled=!count;
 document.getElementById('empty-trash').hidden=audio||activeCollection!=='trash';
 document.getElementById('empty-trash').disabled=!assets.some(isTrashed);
 grid.classList.toggle('selecting',selectionMode);document.body.classList.toggle('selection-active',selectionMode);
};
const batchModeButton=document.getElementById('batch-mode');
const bulkControlsBase=renderControls;
renderControls=function(){
 batchModeButton.remove();
 bulkControlsBase();
 if(isAudioLibrary()){
  const b=document.createElement('button');b.type='button';b.className='recycle-shortcut';b.textContent='回收站';b.setAttribute('aria-pressed',String(activeCollection==='trash'));
  b.onclick=()=>{activeCollection='trash';selectedAssets.clear();render()};controls.querySelector('.navigation-tools').append(b);
 }
 const tools=controls.querySelector('.navigation-tools'),recycle=tools.querySelector('.recycle-shortcut');
 const actions=document.createElement('div');actions.className='library-selection-tools';
 for(const [edge,label] of [['top','↑ 置顶'],['bottom','↓ 置底']]){
  const jump=document.createElement('button');jump.type='button';jump.id='library-scroll-'+edge;jump.className='library-scroll-button';jump.textContent=label;
  jump.title=edge==='top'?'跳到页面顶部':'跳到当前素材列表底部';
  jump.onclick=()=>window.scrollTo({top:edge==='top'?0:document.documentElement.scrollHeight,behavior:'instant'});
  actions.append(jump);
 }
 actions.append(batchModeButton);if(recycle)actions.append(recycle);
 if(isAudioLibrary()){
  const filters=document.createElement('div');filters.className='audio-filter-strip';
  while(tools.firstChild)filters.append(tools.firstChild);
  tools.append(filters);
 }
 tools.append(actions);
};
const bulkGridBase=renderGrid;let lastBatchScope='';
renderGrid=function(){
 closeCardMenu();
 const scope=JSON.stringify([activeKind,activeCollection,query,activeStyle,activeSpecies,activeCategory,activeCharacter,activeProject,activeReadiness,activeGender,voiceProject,voiceGender,voiceAge,voiceRole,voiceLanguage,voiceLicense,bgmProject,bgmCategory,bgmOrder,videoCategory]);
 if(scope!==lastBatchScope){selectedAssets.clear();lastBatchScope=scope}
 bulkGridBase();
 if(isAudioLibrary()){
  if(activeCollection==='trash')title.textContent='回收站 · '+kindLabels[activeKind];
  const items=galleryPageItems(batchList());
  if(activeKind==='voice'){
   grid.querySelectorAll('.voice-card').forEach((card,index)=>{
    card.insertAdjacentHTML('beforeend',cardActions(items[index],index));
    const footer=card.querySelector('.card-bottom');
    footer.classList.add('voice-actions');
    footer.prepend(card.querySelector('.voice-downloads'));
   });
   bindCardActions(items);
  }
  grid.querySelectorAll('.voice-card,.bgm-card').forEach(card=>{
   const key=activeKind+':'+(card.dataset.voiceId||card.dataset.bgmId),item=items.find(a=>a.id===key);
   if(!item)return;card.classList.toggle('selected',selectedAssets.has(key));
   if(!selectionMode)return;
   const label=document.createElement('label');label.className='audio-selection';
   const input=document.createElement('input');input.type='checkbox';input.checked=selectedAssets.has(key);input.setAttribute('aria-label','选择：'+item.title);
   input.onchange=()=>{input.checked?selectedAssets.add(key):selectedAssets.delete(key);card.classList.toggle('selected',input.checked);renderBulkBar()};
   label.append(input,document.createTextNode('选择'));card.prepend(label);
  });
 }
 renderBulkBar();
};
document.getElementById('bulk-all').onclick=()=>{const list=batchList(),all=list.length&&list.every(a=>selectedAssets.has(favoriteKey(a)));list.forEach(a=>all?selectedAssets.delete(favoriteKey(a)):selectedAssets.add(favoriteKey(a)));renderGrid()};
// Keep the existing live button nodes and handlers inside one sticky header.
const sticky=document.createElement('div');sticky.className='library-sticky';controls.before(sticky);sticky.append(controls);
const dock=document.createElement('div');dock.className='batch-dock';sticky.append(dock);dock.append(document.getElementById('bulk-bar'));
render();

;
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

;
/* Hosted exports keep full generation records out of the initial catalog. */
(() => {
  const baseRender = renderGenerationDetails;
  const pending = new Map();
  const copy = document.getElementById('copy-prompt');
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = '重新加载详情';
  retry.hidden = true;
  retry.style.minHeight = '44px';
  copy.after(retry);
  const current = asset => modalIndex >= 0 && assets[modalIndex] === asset;
  renderGenerationDetails = function (asset) {
    baseRender(asset);
    const url = asset.generation.detail_url;
    copy.disabled = Boolean(url);
    retry.hidden = true;
    if (!url) return;
    document.getElementById('original-content').textContent = '正在加载生成记录…';
    retry.onclick = () => renderGenerationDetails(asset);
    if (!pending.has(url)) {
      pending.set(url, fetch(url).then(response => {
        if (!response.ok) throw Error('Generation record unavailable');
        return response.json();
      }).then(record => {
        if (record.asset_sha256 !== asset.generation.asset_sha256 ||
            typeof record.text_to_image_prompt !== 'string' || !record.model || !record.dimensions) {
          throw Error('Generation record mismatch');
        }
        return record;
      }).catch(error => { pending.delete(url); throw error; }));
    }
    pending.get(url).then(record => {
      asset.generation = record;
      if (!current(asset)) return;
      baseRender(asset);
      copy.disabled = false;
      retry.hidden = true;
    }).catch(() => {
      if (!current(asset)) return;
      document.getElementById('generation-prompt').value = '完整提示词暂未加载成功，请重试；也可下载生成记录查看。';
      document.getElementById('original-content').textContent = '生成记录暂未加载成功。';
      document.getElementById('copy-status').textContent = '详情加载失败，可重试或下载记录。';
      retry.hidden = false;
    });
  };
})();

;
installGalleryPerformance();
