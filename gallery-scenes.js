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
 host.innerHTML=`<div class="character-panel-heading"><strong>同一场景 · ${escapeHTML(s.name)}</strong><button id="show-scene-assets">查看全部资产</button></div>${ids.length>1?`<label class="shared-character">共享参考图板 · 选择地点<select id="detail-scene-select" aria-label="选择图板中的场景">${ids.map(id=>`<option value="${escapeHTML(id)}" ${id===detailScene?'selected':''}>${escapeHTML(manifest.scenes.find(s=>s.id===id)?.name||id)}</option>`).join('')}</select></label>`:''}<p class="character-panel-note">← / → 同一场景视图 · ↑ / ↓ 切换场景</p><div class="role-slots">${sceneOrder.map(v=>{const target=related.find(x=>x.scene_view===v&&x.import_batch===a.import_batch)||related.find(x=>x.scene_view===v);return `<button class="role-slot ${target?'available':'missing'}" ${target?`data-scene-asset="${assets.indexOf(target)}"`:'disabled'}><span>${labels[v]}</span><small>${target?'已入库':'待补齐'}</small></button>`}).join('')}</div><p class="character-panel-note">${escapeHTML(manifest.scene_standard.geometry_note)}</p>${a.spatial_attachments?`<p class="character-panel-note">本剧空间预演 · 尺寸与隐藏区域为待确认提案 · <a href="${escapeHTML(a.spatial_attachments.model)}" download>三维模型 OBJ</a> · <a href="${escapeHTML(a.spatial_attachments.material)}" download>材质 MTL</a> · <a href="${escapeHTML(a.spatial_attachments.all_drawings)}" download>完整场景图集</a></p>`:''}<div class="character-views">${related.map(other=>`<button type="button" class="character-view ${other===a?'current':''}" data-scene-asset="${assets.indexOf(other)}" aria-label="切换到${escapeHTML(other.view_label)}：${escapeHTML(s.name)}"><img src="${escapeHTML(assetURL(other))}" loading="lazy" alt=""><span>${escapeHTML(other.view_label)}${other.scene_ids.length>1?' · 共享参考':''}${other.spatial_attachments?' · 本剧预演':''}</span></button>`).join('')}</div>`;
 host.querySelectorAll('[data-scene-asset]').forEach(b=>b.onclick=()=>{modalIndex=Number(b.dataset.sceneAsset);updateModal()});
 host.querySelector('#detail-scene-select')?.addEventListener('change',e=>{detailScene=e.target.value;updateModal()});
 host.querySelector('#show-scene-assets').onclick=()=>{const id=detailScene;closeModal();resetNavigationFilters();activeKind='scene';activeCollection='all';activeScene=id;render()};
}
function bindSceneGrid(){grid.querySelectorAll('[data-scene-group] .thumb').forEach(el=>{const choose=()=>{detailScene=el.closest('[data-scene-group]').dataset.sceneGroup};el.addEventListener('click',choose,true);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')choose()},true)})}
