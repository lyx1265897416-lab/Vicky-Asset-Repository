// Explicit character identities; shared boards do not merge their members.
let activeCharacter='all',activeProject='all',activeReadiness='all',groupByCharacter=false,detailCharacter=null;
const projectLabels={'the_ninth_inning':'第九局以后','mii-takes-care-of-you':'今天不要上班，咪养你','off-script / KISS ME FOR REAL':'OFF SCRIPT · KISS ME FOR REAL','the-sea-princes-almost-bride':'海王子的准新娘','3d-white-34-20260923':'白底 3D 角色 · 34 组','3d-front-17-20260923':'白底 3D 角色 · 17 组','front-id-32-20260923':'白底女角色 · 32 组','white-portraits-24-20260922':'白底女角色 · 24 组','male-white-portraits-31-v2-20260923':'男角色 · 31 组','male-white-portraits-23-v2-20260923':'男角色第二版 · 23 组','western-male-white-28-v3-20260923':'欧美男角色 · 28 组','research-white-27-20260923':'调研角色 · 27 组','research-character-batch-20260922':'原创调研角色'};
function roleComplete(c){return manifest.asset_standard.slots.every(s=>assets.some(a=>!isTrashed(a)&&a.character_ids.length===1&&a.character_ids[0]===c.id&&(s.views.includes(a.view_type)||(a.verified_slots||[]).includes(s.key))))}
function roleInScope(c){return genderMatches(c)&&(activeProject==='all'||c.project===activeProject)&&(activeReadiness==='all'||(activeReadiness==='complete'?roleComplete(c):!roleComplete(c)))}
const characterById=()=>new Map(manifest.characters.map(c=>[c.id,c]));
function characterMatches(a,id){const map=characterById();return (id==='all'||(id==='unassigned'?!a.character_ids.length:a.character_ids.includes(id)))&&((activeProject==='all'&&activeReadiness==='all'&&activeGender==='all')||a.character_ids.some(cid=>map.has(cid)&&roleInScope(map.get(cid))))}
function characterFilterHTML(){
 const available=manifest.characters.filter(c=>roleInScope(c)&&assets.some(a=>a.character_ids.includes(c.id)&&(activeCollection==='trash'?isTrashed(a):!isTrashed(a))));
 const projects=[...new Set(manifest.characters.map(c=>c.project))];
 return `<div class="filter-row character-filter"><span class="filter-label">项目</span><select id="project-select" aria-label="按项目或批次筛选"><option value="all">全部项目 / 批次</option>${projects.map(p=>`<option value="${escapeHTML(p)}" ${activeProject===p?'selected':''}>${escapeHTML(projectLabels[p]||p)}</option>`).join('')}</select><select id="readiness-select" aria-label="按素材齐全度筛选"><option value="all">全部素材状态</option><option value="complete" ${activeReadiness==='complete'?'selected':''}>基础素材齐全</option><option value="missing" ${activeReadiness==='missing'?'selected':''}>仍有待补素材</option></select></div><div class="filter-row character-filter"><span class="filter-label">角色</span><select id="character-select" aria-label="按角色筛选"><option value="all">全部角色（${available.length}）</option><option value="unassigned" ${activeCharacter==='unassigned'?'selected':''}>未归类 / 风格参考</option>${available.map(c=>`<option value="${escapeHTML(c.id)}" ${activeCharacter===c.id?'selected':''}>${escapeHTML(c.name)}</option>`).join('')}</select><button id="group-characters" type="button" aria-pressed="${groupByCharacter}" class="${groupByCharacter?'active':''}">按角色归类</button></div><details class="type-level"><summary>展开角色肖像导航</summary><div class="character-rail" aria-label="角色肖像导航">${available.map(c=>{const candidates=assets.filter(a=>a.character_ids.includes(c.id)&&(activeCollection==='trash'?isTrashed(a):!isTrashed(a)));const cover=candidates.find(a=>a.character_ids.length===1&&a.view_type==='front')||candidates.find(a=>a.character_ids.length===1&&a.view_type==='face_turnaround')||candidates.find(a=>a.character_ids.length===1)||candidates[0];return cover?`<button type="button" class="character-avatar ${activeCharacter===c.id?'active':''}" data-character-id="${escapeHTML(c.id)}" aria-label="查看角色：${escapeHTML(c.name)}"><img src="${escapeHTML(assetURL(cover))}" loading="lazy" alt=""><span>${escapeHTML(c.name)}</span></button>`:''}).join('')}</div></details>`;
}
function bindCharacterControls(){
 document.getElementById('project-select').onchange=e=>{activeProject=e.target.value;activeCharacter='all';selectedAssets.clear();render()};
 document.getElementById('readiness-select').onchange=e=>{activeReadiness=e.target.value;activeCharacter='all';selectedAssets.clear();render()};
 document.querySelectorAll('[data-character-id]').forEach(b=>b.onclick=()=>{activeCharacter=b.dataset.characterId;selectedAssets.clear();render()});
 document.getElementById('character-select').onchange=e=>{activeCharacter=e.target.value;selectedAssets.clear();render()};
 document.getElementById('group-characters').onclick=()=>{groupByCharacter=!groupByCharacter;selectedAssets.clear();render()};
}
function characterGridHTML(list,card){
 grid.classList.toggle('character-grouped',groupByCharacter&&activeKind==='character');
 if(activeKind==='scene')return sceneGridHTML(list,card);
 if(!groupByCharacter||activeKind!=='character')return list.map(card).join('');
 const groups=manifest.characters.filter(roleInScope).map(c=>({id:c.id,name:c.name,items:list.filter(a=>a.character_ids.includes(c.id))})).filter(g=>g.items.length&&(activeCharacter==='all'||activeCharacter===g.id));
 const unassigned=list.filter(a=>!a.character_ids.length);
 if(unassigned.length)groups.push({id:'unassigned',name:'未归类 / 风格参考',items:unassigned});
 return groups.map(g=>`<section class="character-group" aria-label="${escapeHTML(g.name)}"><header><h3>${escapeHTML(g.name)}</h3><span>${g.items.length} 张 · ${[...new Set(g.items.map(a=>a.view_label))].map(escapeHTML).join(' / ')}</span></header><div class="character-group-grid">${g.items.map(card).join('')}</div></section>`).join('');
}
function sameCharacterAssets(id){return assets.filter(a=>a.character_ids.includes(id)&&!isTrashed(a))}
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
 host.innerHTML=`<div class="character-panel-heading"><strong>同一角色 · ${escapeHTML(c.name)}</strong><button id="show-character-assets">查看全部资产</button></div>${a.character_ids.length>1?`<label class="shared-character">多人组图 · 选择角色<select id="detail-character-select" aria-label="选择组图中的角色">${a.character_ids.map(id=>`<option value="${escapeHTML(id)}" ${id===detailCharacter?'selected':''}>${escapeHTML(map.get(id).name)}</option>`).join('')}</select></label>`:''}<p class="character-panel-note">${related.length} 张已入库图片 · 点击切换视角${related.length===1?'；其他视角暂未入库':''}</p>${coverageHTML}<div class="character-views">${related.map(other=>`<button type="button" class="character-view ${other===a?'current':''}" data-role-asset="${assets.indexOf(other)}" aria-pressed="${other===a}" aria-label="切换到${escapeHTML(other.view_label)}：${escapeHTML(other.title)}"><img src="${escapeHTML(assetURL(other))}" alt="" loading="lazy"><span>${numberBadge(other)} ${escapeHTML(other.view_label)}${other.character_ids.length>1?' · 多人':''}</span></button>`).join('')}</div>`;
 host.querySelectorAll('[data-slot-asset]').forEach(b=>b.onclick=()=>{modalIndex=Number(b.dataset.slotAsset);updateModal()});
 host.querySelectorAll('[data-role-asset]').forEach(b=>b.onclick=()=>{const next=Number(b.dataset.roleAsset);modalIndex=next;updateModal();host.querySelector(`[data-role-asset="${next}"]`)?.focus({preventScroll:true})});
 const selector=document.getElementById('detail-character-select');if(selector)selector.onchange=e=>{detailCharacter=e.target.value;updateModal()};
 document.getElementById('show-character-assets').onclick=()=>{const id=detailCharacter;closeModal();activeKind='character';activeGender='all';openFilterPanel=null;activeCharacter=id;activeProject='all';activeReadiness='all';activeCollection='all';activeCategory='all';activeStyle='all';activeSpecies='all';query='';selectedAssets.clear();render()};
}
