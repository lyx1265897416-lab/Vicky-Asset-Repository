// One selection scope per library and filter; audio uses namespaced persistent IDs.
const isAudioLibrary=()=>activeKind==='voice'||activeKind==='bgm';
function audioAsset(item,kind=activeKind){
 const v=kind==='bgm'?(item.variants.find(v=>v.id===(bgmChoices.get(item.id)||item.default_variant))||item.variants[0]):item;
 return {id:kind+':'+item.id,path:v.path,title:item.name,media_type:'audio',generation:{asset_sha256:v.sha256},record:item};
}
const baseVoiceList=voiceList,baseBgmList=bgmList;
voiceList=function(){return baseVoiceList().filter(v=>activeCollection==='trash'?isTrashed(audioAsset(v,'voice')):!isTrashed(audioAsset(v,'voice')))};
bgmList=function(){return baseBgmList().filter(v=>activeCollection==='trash'?isTrashed(audioAsset(v,'bgm')):!isTrashed(audioAsset(v,'bgm')))};
function batchList(){return activeKind==='voice'?voiceList().map(v=>audioAsset(v)):activeKind==='bgm'?bgmList().map(v=>audioAsset(v)):filtered()}
selectedList=function(){return batchList().filter(a=>selectedAssets.has(favoriteKey(a)))};
renderBulkBar=function(){
 const list=batchList(),allowed=new Set(list.map(favoriteKey));
 selectedAssets=new Set([...selectedAssets].filter(k=>allowed.has(k)));
 const count=selectedList().length,audio=isAudioLibrary(),b=document.getElementById('batch-mode');
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
 const scope=JSON.stringify([activeKind,activeCollection,query,activeStyle,activeSpecies,activeCategory,activeCharacter,activeProject,activeReadiness,activeGender,voiceProject,voiceGender,voiceAge,voiceRole,voiceLanguage,voiceLicense,bgmProject,bgmCategory,bgmOrder]);
 if(scope!==lastBatchScope){selectedAssets.clear();lastBatchScope=scope}
 bulkGridBase();
 if(isAudioLibrary()){
  if(activeCollection==='trash')title.textContent='回收站 · '+kindLabels[activeKind];
  const items=batchList();
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
