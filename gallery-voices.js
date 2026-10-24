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
 const list=voiceList();grid.classList.remove('character-grouped');
 document.getElementById('bulk-bar').hidden=true;
 document.getElementById('empty-trash').hidden=true;
 title.textContent=activeCollection==='favorites'?'收藏的角色音色':'音色库';
 note.textContent=`显示 ${list.length} / ${voiceCatalog.length} 个音色 · 可试听与下载`;
 empty.hidden=!!list.length;empty.textContent='没有符合条件的音色，可清空搜索或切换项目。';
 grid.innerHTML=list.map(v=>`<article class="card voice-card" data-voice-id="${escapeHTML(v.id)}"><button class="favorite-button" data-voice-favorite="${escapeHTML(v.id)}" aria-label="${favorites.has(voiceKey(v))?'取消收藏':'收藏'}：${escapeHTML(v.name)}" aria-pressed="${favorites.has(voiceKey(v))}">${favorites.has(voiceKey(v))?'★':'☆'}</button><div>${numberBadge(v)}<h3>${escapeHTML(v.name)}</h3><div class="voice-project">${escapeHTML(v.project)} · ${v.duration_seconds.toFixed(1)} 秒 · ${escapeHTML(voiceLanguageLabel(v))}</div>${v.age_group?`<div class="voice-tags"><span>${escapeHTML(v.age_group)} · ${escapeHTML(v.age_range)}</span><span>${escapeHTML(v.role_group)}</span><span>${escapeHTML(v.timbre)}</span></div>`:''}${v.commercial_license?`<div class="voice-new">现成音色 · 可商用 · ${escapeHTML(v.commercial_license.name)}</div>`:''}${v.status==='generated'?'<div class="voice-new">新设计音色 · 可选用</div>':''}</div><div class="voice-player"><button class="voice-play" aria-label="播放 ${escapeHTML(v.name)}">▶ 试听</button><input class="voice-seek" type="range" min="0" max="${v.duration_seconds}" step="0.01" value="0" aria-label="${escapeHTML(v.name)} 播放进度"><span class="voice-time">0:00</span><audio preload="metadata" src="${escapeHTML(voiceURL(v))}"></audio></div><p class="voice-line">${escapeHTML(v.text)}</p>${v.verification?.transcript_exact_words===false?'<p class="voice-variant">自动转写检测到口语变体，详见声音设定。</p>':''}<details><summary>声音设定与来源</summary><p>${escapeHTML(v.confirmation.note)}</p><p>模型：${escapeHTML(v.model)}</p>${stockVoiceDetails(v)}${v.approved_playback?`<p>已确认表演版本：保留你选中试听的完整停顿、呼吸与原始节奏；不重新裁剪或处理。实测 ${v.normalization.measured_lufs.toFixed(2)} LUFS。</p>`:v.normalization?`<p>统一响度：目标 −18 LUFS，实测 ${v.normalization.measured_lufs.toFixed(2)} LUFS；真实峰值 ${v.normalization.true_peak_dbtp.toFixed(2)} dBTP（上限 −1.5 dBTP）。原始音频已保留，试听和下载使用统一响度版本。${v.onset_cleanup?`已清理首尾空白和过长静音，保留首字余量与自然短停顿。`:""}</p>`:''}<p>${escapeHTML(v.direction)}</p>${v.transcript_note?`<p>${escapeHTML(v.transcript_note)}</p>`:''}${v.verification?.transcript_exact_words===false?`<p>自动转写：${escapeHTML(v.observed_transcript)}</p>`:''}<p>${escapeHTML(v.accent_direction||voiceLanguageLabel(v))}。${v.status==='generated'?'年龄、身份与音色标签为选角设计；生成参数及自动检查记录已保留。':(v.commercial_license?'年龄未公开的预设不推断年龄；用途标签仅作选角参考。':'本次导入未重新评估口音或音色相似度。')}</p><pre>${escapeHTML(JSON.stringify(v.parameters,null,2))}</pre><a href="${escapeHTML(v.confirmation_evidence)}" target="_blank" rel="noopener">查看入库依据</a></details><div class="voice-downloads"><a href="${escapeHTML(v.path)}" download>下载音频</a><a href="${escapeHTML(v.record_download)}" download>下载音色记录</a>${v.commercial_license?`<a href="${escapeHTML(v.commercial_license.record)}" download>下载许可说明</a>`:""}</div></article>`).join('');
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
   const audio=entry.target.querySelector('audio');audio.preload='auto';
   if(audio.paused&&audio.readyState<2)audio.load();
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
