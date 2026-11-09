// Character-level review edits. Static hosting persists them in this browser;
// explicit JSON export/import transfers reviews without changing image files.
const LABEL_EDITS_KEY='vicky-character-library:character-labels:v1';
let labelEdits={},labelRevision=0,labelBaselines=new Map(),labelEditorId=null,labelEditorVersion='',labelReturnFocus=null,labelImportPreview=null,labelImportToken=0;
const LABEL_FIELDS=['ethnicity','ethnicities','ethnicity_detail','ethnicity_status','ethnicity_source','ethnicity_evidence','skin_tone','skin_tone_note'];
function normalizeLabelEdit(value){
 if(!value||typeof value!=='object'||!Array.isArray(value.ethnicities)||!value.ethnicities.length||value.ethnicities.length>20)throw Error('请至少选择一个人种／族裔标签。');
 const ethnicities=[...new Set(value.ethnicities)];
 if(ethnicities.some(v=>typeof v!=='string'||!Object.hasOwn(manifest.ethnicity_labels,v)))throw Error('包含无法识别的人种标签。');
 if(['unknown','not_applicable'].some(v=>ethnicities.includes(v)&&ethnicities.length>1))throw Error('“待设定”或“不适用”需单独选择。');
 const ancestry=['east_asian','southeast_asian','south_asian','central_asian','european','african','middle_eastern','indigenous_american','pacific_islander'];
 if(ethnicities.filter(v=>ancestry.includes(v)).length>1&&!ethnicities.includes('mixed'))ethnicities.push('mixed');
 if(typeof value.skin_tone!=='string'||!Object.hasOwn(manifest.skin_tone_labels,value.skin_tone))throw Error('请选择有效的肤色。');
 if(value.detail!==undefined&&(typeof value.detail!=='string'||value.detail.length>160))throw Error('细分说明最多 160 字。');
 return {ethnicities,skin_tone:value.skin_tone,detail:(value.detail||'').trim(),updated_at:typeof value.updated_at==='string'?value.updated_at:''};
}
function parseLabelEdits(raw){
 if(!raw)return {};
 const data=JSON.parse(raw);
 if(!data||data.schema_version!==1||data.kind!=='vicky-character-labels'||!data.characters||typeof data.characters!=='object'||Array.isArray(data.characters))throw Error('文件格式不正确，请使用「导出标签」生成的 JSON 文件。');
 const edits={};
 for(const [id,value] of Object.entries(data.characters)){
  if(!labelBaselines.has(id))throw Error('文件包含当前资产库没有的角色：'+id);
  edits[id]=normalizeLabelEdit(value);
 }
 return edits;
}
function labelEditDocument(edits){return {schema_version:1,kind:'vicky-character-labels',characters:edits}}
function applyLabelEdits(edits){
 for(const c of manifest.characters){
  Object.assign(c,structuredClone(labelBaselines.get(c.id)));
  const edit=edits[c.id];if(!edit)continue;
  c.ethnicities=[...edit.ethnicities];c.ethnicity=c.ethnicities.includes('mixed')?'mixed':c.ethnicities[0];
  c.ethnicity_detail=edit.detail||c.ethnicities.map(v=>manifest.ethnicity_labels[v]).join(' · ');
  c.ethnicity_status='manual_setting';c.ethnicity_source='本浏览器手动调整';
  c.ethnicity_evidence=edit.detail||'用户在标签编辑器中手动调整；不改动角色图像。';
  c.skin_tone=edit.skin_tone;c.skin_tone_note='用户手动核对的肤色标签。';
 }
 labelEdits=edits;labelRevision++;
}
function labelEditVersion(edit){return JSON.stringify(edit||null)}
function persistLabelChange(id,edit,expectedVersion){
 // Read again immediately before writing so edits to other characters in other tabs survive.
 const next=parseLabelEdits(localStorage.getItem(LABEL_EDITS_KEY));
 if(expectedVersion!==undefined&&labelEditVersion(next[id])!==expectedVersion)throw Error('该角色已在其他标签页修改。请关闭后重新打开，核对最新标签再保存。');
 if(edit===null)delete next[id];else next[id]=normalizeLabelEdit(edit);
 localStorage.setItem(LABEL_EDITS_KEY,JSON.stringify(labelEditDocument(next)));
 applyLabelEdits(next);
}
function characterCardLabels(a){
 if(a.asset_kind!=='character'||!a.character_ids.length)return '';
 const map=characterById(),roles=a.character_ids.map(id=>map.get(id)).filter(Boolean);
 roles.sort((a,b)=>Number(roleInScope(b))-Number(roleInScope(a)));
 const row=c=>`<div class="card-label-row" data-label-role="${escapeHTML(c.id)}">${roles.length>1?`<strong class="card-label-name">${escapeHTML(c.name)}</strong>`:''}<div class="card-label-chips"><span class="role-ethnicity">人种 · ${c.ethnicities.map(v=>escapeHTML(manifest.ethnicity_labels[v])).join(' / ')}</span><span class="role-skin">肤色 · ${escapeHTML(manifest.skin_tone_labels[c.skin_tone])}</span></div><button class="edit-character-labels" data-edit-character="${escapeHTML(c.id)}" aria-label="编辑 ${escapeHTML(c.name)} 的人种与肤色">编辑标签</button>${labelEdits[c.id]?'<span class="label-reviewed">已手动调整</span>':''}</div>`;
 return `<div class="card-labels" aria-label="角色标签">${roles.slice(0,2).map(row).join('')}${roles.length>2?`<details><summary>查看其他 ${roles.length-2} 位角色标签</summary>${roles.slice(2).map(row).join('')}</details>`:''}</div>`;
}
function refreshLabelViews(){selectedAssets.clear();render();if(modalIndex>=0)updateModal()}
function closeLabelEditor(){
 document.getElementById('label-editor').close();
 const id=labelEditorId;labelEditorId=null;
 if(labelReturnFocus?.isConnected)labelReturnFocus.focus({preventScroll:true});
 else [...document.querySelectorAll('[data-edit-character]')].find(b=>b.dataset.editCharacter===id)?.focus({preventScroll:true});
}
function openLabelEditor(id){
 const c=characterById().get(id);if(!c)return;
 labelEditorId=id;labelEditorVersion=labelEditVersion(labelEdits[id]);labelReturnFocus=document.activeElement;
 const dialog=document.getElementById('label-editor');
 dialog.innerHTML=`<form id="label-editor-form"><header><h2 id="label-editor-title">编辑角色标签</h2><button type="button" data-close-labels aria-label="关闭标签编辑">×</button></header><p class="label-edit-name">${escapeHTML(c.name)}</p><p>应用到此角色的全部图片。保存在当前浏览器；不会自动同步到其他设备。</p><fieldset><legend>人种／族裔 · 可多选</legend><div class="label-options">${Object.entries(manifest.ethnicity_labels).map(([v,name])=>`<label><input type="checkbox" name="ethnicities" value="${escapeHTML(v)}" ${c.ethnicities.includes(v)?'checked':''}><span>${escapeHTML(name)}</span></label>`).join('')}</div></fieldset><p class="label-hint">复合背景可多选祖源，系统会补上“混合”标签；拉丁裔为独立文化背景。</p><label class="label-field">肤色<select name="skin_tone" aria-label="编辑肤色">${Object.entries(manifest.skin_tone_labels).map(([v,name])=>`<option value="${v}" ${c.skin_tone===v?'selected':''}>${escapeHTML(name)}</option>`).join('')}</select></label><label class="label-field">细分说明（可选）<input name="detail" aria-label="族裔细分说明" maxlength="160" placeholder="例如：韩裔美国人；欧洲裔与南亚裔混合" value="${escapeHTML(labelEdits[id]?.detail??c.ethnicity_detail??'')}"></label><p class="label-current-note">库内说明：${escapeHTML(labelBaselines.get(id).ethnicity_detail||'')}</p><p id="label-editor-error" role="alert"></p><div class="label-edit-actions"><button type="submit" class="share-primary">保存标签</button><button type="button" data-close-labels>取消</button><button type="button" id="restore-character-labels" ${labelEdits[id]?'':'disabled'}>恢复库内标签</button></div><button type="button" class="label-backup-link" data-label-backup>导出／导入标签备份</button></form>`;
 dialog.querySelectorAll('[data-close-labels]').forEach(b=>b.onclick=closeLabelEditor);
 dialog.querySelector('form').onsubmit=e=>{
  e.preventDefault();const form=e.currentTarget;
  try{
   const edit={ethnicities:[...form.querySelectorAll('[name="ethnicities"]:checked')].map(i=>i.value),skin_tone:form.elements.skin_tone.value,detail:form.elements.detail.value,updated_at:new Date().toISOString()};
   persistLabelChange(id,edit,labelEditorVersion);refreshLabelViews();closeLabelEditor();showActionNotice('已保存到本浏览器，并更新此角色的全部图片标签。');
  }catch(error){dialog.querySelector('#label-editor-error').textContent='未保存：'+error.message}
 };
 dialog.querySelector('#restore-character-labels').onclick=()=>{
  try{persistLabelChange(id,null,labelEditorVersion);refreshLabelViews();closeLabelEditor();showActionNotice('已恢复此角色的库内标签。')}
  catch(error){dialog.querySelector('#label-editor-error').textContent='未恢复：'+error.message}
 };
 const initialDetail=dialog.querySelector('[name="detail"]').value;
 dialog.querySelectorAll('[name="ethnicities"]').forEach(input=>input.addEventListener('change',()=>{const detail=dialog.querySelector('[name="detail"]');if(detail.value===initialDetail)detail.value=''}));
 dialog.showModal();
}
function openLabelBackup(){
 const dialog=document.getElementById('label-backup');labelImportPreview=null;labelImportToken++;
 dialog.innerHTML=`<header><h2 id="label-backup-title">标签备份</h2><button type="button" id="close-label-backup" aria-label="关闭标签备份">×</button></header><p>当前浏览器已调整 ${Object.keys(labelEdits).length} 位角色。导出后可在其他设备或浏览器导入；图片不会包含在备份中。</p><button id="export-label-edits">导出标签 JSON</button><label class="label-field">导入标签文件<input id="import-label-file" type="file" accept="application/json,.json"></label><p id="label-import-status" role="status"></p><p id="label-backup-error" role="alert"></p><div id="label-import-preview"></div><button id="apply-label-import" hidden>应用导入标签</button>`;
 dialog.querySelector('#close-label-backup').onclick=()=>dialog.close();
 dialog.querySelector('#export-label-edits').onclick=()=>{
  try{
   const latest=parseLabelEdits(localStorage.getItem(LABEL_EDITS_KEY));
   const payload={...labelEditDocument(latest),exported_at:new Date().toISOString()};
   const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
   const a=document.createElement('a');a.href=url;a.download='vicky-character-labels-'+new Date().toLocaleDateString('sv-SE')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
   dialog.querySelector('#label-import-status').textContent='已导出 '+Object.keys(latest).length+' 位角色的手动调整。';
  }catch(error){dialog.querySelector('#label-backup-error').textContent='导出失败：'+error.message}
 };
 dialog.querySelector('#import-label-file').onchange=async e=>{
  const file=e.target.files[0],token=++labelImportToken;labelImportPreview=null;
  dialog.querySelector('#apply-label-import').hidden=true;dialog.querySelector('#label-import-preview').replaceChildren();dialog.querySelector('#label-backup-error').textContent='';
  if(!file)return;
  try{
   if(file.size>1024*1024)throw Error('文件超过 1 MB，请检查是否选择了标签备份。');
   const raw=await file.text();if(token!==labelImportToken||!dialog.open)return;
   const edits=parseLabelEdits(raw),ids=Object.keys(edits);
   const latest=parseLabelEdits(localStorage.getItem(LABEL_EDITS_KEY));
   labelImportPreview={edits,version:JSON.stringify(latest)};
   const overlapping=ids.filter(id=>Object.hasOwn(latest,id)).length;
   dialog.querySelector('#label-import-status').textContent=`共 ${ids.length} 位角色，应用后将覆盖其中 ${overlapping} 位的本地调整。其他角色保持不变。`;
   const map=characterById();dialog.querySelector('#label-import-preview').innerHTML=ids.map(id=>`<p><strong>${escapeHTML(map.get(id).name)}</strong><br>${edits[id].ethnicities.map(v=>escapeHTML(manifest.ethnicity_labels[v])).join(' / ')} · ${escapeHTML(manifest.skin_tone_labels[edits[id].skin_tone])}</p>`).join('');
   dialog.querySelector('#apply-label-import').hidden=!ids.length;
  }catch(error){dialog.querySelector('#label-backup-error').textContent='未导入：'+error.message}
 };
 dialog.querySelector('#apply-label-import').onclick=()=>{
  try{
   if(!labelImportPreview)throw Error('请先选择标签文件。');
   const latest=parseLabelEdits(localStorage.getItem(LABEL_EDITS_KEY));
   if(JSON.stringify(latest)!==labelImportPreview.version)throw Error('本地标签已有变化，请重新选择文件核对后导入。');
   const next={...latest,...labelImportPreview.edits};
   localStorage.setItem(LABEL_EDITS_KEY,JSON.stringify(labelEditDocument(next)));applyLabelEdits(next);refreshLabelViews();
   dialog.close();showActionNotice('标签已导入并保存在本浏览器。');
  }catch(error){dialog.querySelector('#label-backup-error').textContent='未导入：'+error.message}
 };
 dialog.showModal();
}
function initLabelEditor(){
 labelBaselines=new Map(manifest.characters.map(c=>[c.id,Object.fromEntries(LABEL_FIELDS.map(k=>[k,structuredClone(c[k])]))]));
 manifest.ethnicity_status_labels.manual_setting='手动调整';
 try{applyLabelEdits(parseLabelEdits(localStorage.getItem(LABEL_EDITS_KEY)))}catch(error){storageNotice('标签调整未能读取：'+error.message+' 原有库内标签仍可浏览。')}
 for(const [id,title] of [['label-editor','label-editor-title'],['label-backup','label-backup-title']]){
  const dialog=document.createElement('dialog');dialog.id=id;dialog.className='share-dialog label-dialog';dialog.setAttribute('aria-labelledby',title);document.body.append(dialog);
 }
 document.addEventListener('click',e=>{
  const edit=e.target.closest('[data-edit-character]');if(edit){openLabelEditor(edit.dataset.editCharacter);return}
  if(e.target.closest('[data-label-backup]')){if(document.getElementById('label-editor').open)closeLabelEditor();openLabelBackup()}
 });
 window.addEventListener('storage',e=>{
  if(e.key!==LABEL_EDITS_KEY&&e.key!==null)return;
  try{applyLabelEdits(parseLabelEdits(localStorage.getItem(LABEL_EDITS_KEY)));refreshLabelViews()}
  catch(error){storageNotice('其他标签页的标签调整未能读取：'+error.message)}
 });
}
