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
