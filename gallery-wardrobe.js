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
 const thumb=other=>`<button type="button" class="character-view ${other===a?'current':''}" data-wardrobe-asset="${assets.indexOf(other)}" aria-pressed="${other===a}" aria-label="查看搭配素材：${escapeHTML(other.title)}"><img src="${escapeHTML(assetURL(other))}" alt="" loading="lazy"><span>${numberBadge(other)} ${escapeHTML(other.component_name||other.outfit_name||other.title.split(' · ').slice(-2,-1)[0]||other.view_label)}</span></button>`;
 host.setAttribute('aria-label','套装服装与配饰');
 host.innerHTML=`<div class="character-panel-heading"><strong>套装 ${String(detailOutfitRef||'').padStart(2,'0')} · ${escapeHTML(cover?.outfit_name||'搭配素材')}</strong>${cover&&cover!==a?`<button type="button" data-wardrobe-asset="${assets.indexOf(cover)}">返回完整造型</button>`:''}</div>${refs.length>1?`<label class="shared-character">这件配饰用于 ${refs.length} 套造型<select id="detail-outfit-select" aria-label="选择配饰所属套装">${refs.map(n=>`<option value="${n}" ${n===detailOutfitRef?'selected':''}>套装 ${String(n).padStart(2,'0')} · ${escapeHTML(outfitCover(a,n)?.outfit_name||'搭配')}</option>`).join('')}</select></label>`:''}<p class="character-panel-note">点击下方素材查看大图、提示词或下载原图。</p>${Object.entries(names).map(([kind,label])=>{const items=related.filter(x=>x.category===kind);return `<details class="wardrobe-detail-group" open><summary>${label}<span>${items.length} 张</span></summary>${items.length?`<div class="character-views">${items.map(thumb).join('')}</div>`:`<p class="character-panel-note">${kind==='accessory'?'此套参考未搭配独立配饰。':'暂无可用素材。'}</p>`}</details>`}).join('')}`;
 host.querySelectorAll('[data-wardrobe-asset]').forEach(b=>b.onclick=()=>{modalIndex=Number(b.dataset.wardrobeAsset);updateModal()});
 host.querySelector('#detail-outfit-select')?.addEventListener('change',e=>{detailOutfitRef=Number(e.target.value);updateModal()});
}
