# -*- coding: utf-8 -*-
from pathlib import Path
import json
import hashlib
from asset_metadata import attach_generation_metadata
from character_assets import attach_character_assets
from library_deletion import filter_deleted
from asset_additions import merge_additions
from character_standard import attach_standard
from gallery_taxonomy import attach_taxonomy
from voice_assets import attach_voices
from bgm_assets import attach_bgm
from library_numbers import attach_numbers
from scene_assets import attach_scenes

LIB = Path('/Users/vicky/Documents/waku内容/vicky-character-library')
from gallery_lock import acquire_for_process
publication_lock = acquire_for_process(LIB)
manifest = json.loads((LIB / 'gallery-manifest.json').read_text())
merge_additions(manifest, LIB)
filter_deleted(manifest, LIB)
attach_generation_metadata(manifest['assets'], LIB)
attach_character_assets(manifest, LIB)
attach_standard(manifest, LIB)
attach_taxonomy(manifest, LIB)
attach_voices(manifest, LIB)
attach_bgm(manifest, LIB)
attach_numbers(manifest, LIB)
attach_scenes(manifest, LIB)
(LIB / 'gallery-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
for asset in manifest['assets']:
    g = asset['generation']
    export_path = Path('metadata/records') / Path(asset['path']).with_suffix('.txt')
    target = LIB / export_path
    target.parent.mkdir(parents=True, exist_ok=True)
    kind = '原始文生图提示词' if g['prompt_kind'] == 'original_text_to_image' else '按成图重建的独立文生图提示词'
    date_text = g['generation_date'] or '未知（未取得生成记录）'
    if g['source_type'] == 'derived_crop':
        date_text += '（母图生成日期）'
    target.write_text('\n'.join([asset['title'], '生图模型：' + g['model']['display_name'],
        '生成日期：' + date_text, '时区：' + g.get('generation_timezone', '未知'),
        '图像尺寸：' + str(g['dimensions']['width']) + ' × ' + str(g['dimensions']['height']),
        '提示词类型：' + kind, '提示词整理日期：' + g['prompt_prepared_on'], '',
        '文生图提示词：', g['text_to_image_prompt'], '', g['reproduction_note'], '',
        g.get('derivation_note', ''), '来源：' + asset['source'], '',
        g.get('original_prompt_label') or '原始生成提示词：', g.get('original_prompt') or '未取得',
        '', '生成依据：', *g.get('evidence', [])]), encoding='utf-8-sig')
    g['record_download'] = export_path.as_posix()
embedded = json.dumps(manifest, ensure_ascii=False).replace('<', '\\u003c')

html = r'''<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vicky 资产库 · 已确认资产图库</title>
<style>
:root{--bg:#f5f3ef;--panel:#fffdfa;--ink:#1f2422;--muted:#747a75;--line:#dfddd7;--accent:#8c5c48}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","PingFang SC","Noto Sans CJK SC",sans-serif}.shell{max-width:1400px;margin:auto;padding:34px clamp(18px,4vw,58px) 70px}.top{display:flex;gap:30px;align-items:flex-end;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:24px;margin-bottom:22px}.eyebrow{font-size:12px;letter-spacing:.15em;color:var(--accent);text-transform:uppercase}.top h1{font-size:clamp(30px,4vw,52px);line-height:1.04;margin:8px 0 10px;letter-spacing:-.04em}.top p{max-width:760px;margin:0;color:var(--muted);line-height:1.65;font-size:14px}.stats{display:flex;gap:14px;flex-wrap:wrap;margin:20px 0}.stat{background:var(--panel);border:1px solid var(--line);padding:13px 16px;border-radius:16px;min-width:118px}.stat b{display:block;font-size:22px}.stat span{font-size:12px;color:var(--muted)}.policy{background:#eee7df;border:1px solid #e2d8cc;color:#6b5546;border-radius:14px;padding:11px 14px;font-size:12px;line-height:1.55;margin:14px 0 4px}.controls{position:sticky;top:0;z-index:3;background:color-mix(in srgb,var(--bg) 90%,transparent);backdrop-filter:blur(12px);padding:12px 0;border-bottom:1px solid var(--line)}.filter-row{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:8px;align-items:center}.filter-label{font-size:11px;color:var(--muted);min-width:44px}.controls button{border:1px solid var(--line);background:var(--panel);color:var(--ink);padding:8px 12px;border-radius:999px;cursor:pointer;font:inherit;font-size:12px}.controls button.active{background:var(--ink);color:#fff;border-color:var(--ink)}.search{margin-left:auto;min-width:220px;flex:1;max-width:340px;border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:8px 13px;font:inherit;outline:none}.section{margin-top:30px}.section h2{font-size:20px;margin:0 0 6px;letter-spacing:-.02em}.section .note{color:var(--muted);font-size:13px;margin:0 0 14px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}.card{background:var(--panel);border:1px solid var(--line);border-radius:18px;overflow:hidden;display:flex;flex-direction:column;min-width:0}.thumb{aspect-ratio:4/3;background:#ebe8e2;overflow:hidden;cursor:zoom-in}.thumb img{width:100%;height:100%;display:block;object-fit:cover;transition:transform .35s ease}.card:hover .thumb img{transform:scale(1.025)}.meta{padding:13px 14px 15px}.meta h3{font-size:14px;margin:0 0 8px;line-height:1.35}.chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}.chip{font-size:10px;line-height:1;padding:5px 7px;border-radius:999px;background:#eeeae4;color:#686d68}.source{font-size:11px;color:var(--muted);line-height:1.45;word-break:break-word}.empty{padding:50px 0;color:var(--muted);text-align:center}.footer{margin-top:50px;padding-top:18px;border-top:1px solid var(--line);color:var(--muted);font-size:12px;line-height:1.65}.modal{position:fixed;inset:0;background:rgba(21,24,22,.86);z-index:9;display:none;align-items:center;justify-content:center;padding:24px}.modal.open{display:flex}.modal-inner{width:min(1100px,96vw);max-height:94vh;position:relative;display:flex;flex-direction:column;align-items:center}.modal img{max-width:100%;max-height:80vh;display:block;object-fit:contain;border-radius:12px;background:#fff}.modal-caption{color:white;font-size:13px;line-height:1.5;margin-top:10px;text-align:center}.modal-hint{color:#ddd;font-size:11px;margin-top:5px}.close{position:absolute;right:-3px;top:-42px;border:0;background:transparent;color:#fff;font-size:30px;cursor:pointer}.nav{position:absolute;top:45%;border:1px solid rgba(255,255,255,.45);background:rgba(20,20,20,.45);color:white;width:42px;height:42px;border-radius:50%;font-size:23px;cursor:pointer}.prev{left:-54px}.next{right:-54px}@media(max-width:700px){.top{display:block}.search{margin-left:0;max-width:none}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.meta{padding:10px}.meta h3{font-size:12px}.source{font-size:10px}.prev{left:5px}.next{right:5px}.modal img{max-height:74vh}.close{right:3px}}

.thumb{position:relative}
.favorite-button{position:absolute;right:8px;top:8px;z-index:1;width:30px;height:30px;display:grid;place-items:center;border:1px solid rgba(90,80,65,.18);border-radius:50%;background:rgba(255,253,250,.95);color:#635c51;box-shadow:0 2px 10px #00000012;cursor:pointer;transition:background .15s,color .15s,transform .15s}
.favorite-button svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linejoin:round}
.favorite-button[aria-pressed="true"]{background:#fff0c9;color:#a56c13;border-color:#e7c888}
.favorite-button[aria-pressed="true"] svg{fill:#eebd52}
.favorite-button:hover{transform:scale(1.06)}
button:focus-visible,.thumb:focus-visible,.search:focus-visible{outline:3px solid #ad7933;outline-offset:3px}
.controls .collection-tab{font-size:14px;padding:10px 17px;min-height:44px;font-weight:600}
.collection-count{margin-left:7px;font-size:12px;opacity:.75}
.collection-help{font-size:12px;color:var(--muted);margin:0 0 8px 0}
.storage-notice{color:#8c3f2b;background:#f9e7de;padding:10px 14px;border-radius:10px;margin-top:10px;font-size:13px}
.modal-toolbar{display:flex;align-items:center;justify-content:flex-end;width:100%;gap:12px;margin-bottom:10px}
.modal-toolbar .close{position:static;font-size:26px;width:44px;height:44px}
.modal-favorite{border:1px solid #ffffff70;border-radius:22px;background:#fffdfa;color:#635c51;min-height:42px;padding:8px 16px;cursor:pointer;font:inherit;font-size:14px}
.modal-favorite[aria-pressed="true"]{background:#fff0c9;color:#88580c}
.modal img{max-height:72vh}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}

.detail-link{border:0;background:none;color:var(--accent);padding:10px 0 0;font:inherit;font-size:12px;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
.modal{padding:20px}.modal-inner{width:min(1380px,96vw);height:92vh;max-height:92vh;display:block;background:var(--panel);border-radius:18px;overflow:hidden;box-shadow:0 20px 80px #0005}
.modal-toolbar{height:60px;padding:8px 16px;margin:0;border-bottom:1px solid var(--line);gap:8px}.modal-toolbar .close{color:var(--ink)}
.modal-favorite{border-color:var(--line);font-size:13px;min-height:36px}
.modal-toolbar .nav{position:static;width:34px;height:34px;flex-shrink:0;background:white;color:var(--ink);border-color:var(--line);font-size:20px}
.modal-heading{margin-right:auto;font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.modal-layout{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(360px,1fr);height:calc(100% - 60px)}
.modal-visual{touch-action:pan-y pinch-zoom;display:flex;align-items:center;justify-content:center;background:#e9e6e1;padding:18px;min-height:0;overflow:hidden}
.modal .modal-visual img{width:100%;height:100%;max-height:100%;object-fit:contain;border-radius:5px;background:transparent}
.image-details{overflow-y:auto;padding:24px;min-width:0;color:var(--ink)}.image-details h2{font-size:21px;line-height:1.45;margin:0 0 18px}.image-details h3{font-size:15px;margin:22px 0 8px}
.generation-facts{margin:0;display:grid;grid-template-columns:72px 1fr;gap:10px;font-size:13px;line-height:1.6}.generation-facts dt{color:var(--muted)}.generation-facts dd{margin:0;overflow-wrap:anywhere}.detail-small{color:var(--muted);font-size:11px;line-height:1.6}
.prompt-badge{display:inline-block;background:#eee7df;color:#74533f;padding:5px 9px;border-radius:6px;font-size:11px;margin-bottom:8px}
.prompt-text{width:100%;height:270px;resize:vertical;background:white;border:1px solid var(--line);border-radius:10px;padding:12px;color:#3a403c;font:12px/1.7 ui-monospace,SFMono-Regular,Consolas,monospace}
.prompt-actions{display:flex;gap:8px;margin-top:10px;align-items:center;flex-wrap:wrap}.prompt-actions button,.prompt-actions a{border:1px solid var(--line);border-radius:8px;background:white;color:var(--ink);padding:9px 12px;font:inherit;font-size:12px;cursor:pointer}.prompt-actions a{text-decoration:none}.prompt-actions button:first-child{background:var(--ink);color:white;border-color:var(--ink)}
.copy-status{font-size:12px;color:var(--accent);min-height:18px;margin-top:8px}.reproduction-note{font-size:12px;line-height:1.7;color:#766458;background:#f2ece5;border-radius:9px;padding:10px 12px}.original-record{margin-top:18px;border-top:1px solid var(--line);padding-top:14px;font-size:12px;line-height:1.7}.original-record summary{cursor:pointer}.original-record pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.7 ui-monospace,monospace}.image-details a{color:var(--accent)}
textarea:focus-visible,summary:focus-visible,a:focus-visible{outline:3px solid #ad7933;outline-offset:2px}
@media(max-width:800px){.modal{padding:8px}.modal-inner{width:100%;height:96dvh;max-height:96dvh}.modal-layout{display:block;overflow-y:auto}.modal-visual{height:42dvh;padding:10px}.image-details{overflow:visible;padding:18px}.modal-heading{max-width:90px;font-size:11px}.modal-toolbar{padding:8px}.modal-favorite{font-size:12px;padding:6px 10px}.prompt-text{height:230px}}

</style>
<link rel="stylesheet" href="gallery-actions.css?v=__ACTIONS_HASH__">
<link rel="stylesheet" href="gallery-navigation.css?v=__ACTIONS_HASH__">
<link rel="stylesheet" href="gallery-voices.css?v=20260928-expanded32">
<link rel="stylesheet" href="gallery-bgm.css?v=20260929-web80">
</head>
<body>
<main class="shell">
  <div class="top"><div><div class="eyebrow">Vicky Creative Library</div><h1>Vicky 资产库</h1></div><div class="eyebrow">创作素材 · 有序收藏</div></div>
  <details class="library-overview"><summary>图库概览与素材进度</summary><div class="policy">当前收录 <b id="policy-count"></b> 张已确认或当前制作素材。</div><div class="stats" id="stats"></div><div id="completion-summary" class="completion-summary"></div></details>
  <div class="controls" id="controls"></div><div id="storage-notice" class="storage-notice" role="alert" hidden></div><div id="favorite-status" class="sr-only" role="status" aria-live="polite"></div>
  <section class="section"><div class="section-heading"><h2 id="result-title">全部确认资产</h2><button type="button" class="action-button danger" id="empty-trash" hidden>清空回收站</button><button type="button" class="action-button" id="batch-mode" aria-pressed="false">批量选择</button></div><p class="note" id="result-note"></p><div id="grid" class="grid"></div><div id="empty" class="empty" hidden>没有符合筛选条件的资产。</div><div class="bulk-bar" id="bulk-bar" hidden><span class="bulk-count" id="bulk-count"></span><button id="bulk-all">全选当前结果</button><button id="bulk-share">批量分享</button><button id="bulk-download">批量下载</button><button class="danger" id="bulk-delete">批量删除</button><button class="danger" id="bulk-purge" hidden>彻底删除所选</button></div></section>
  <div class="footer">来源与确认理由保留在每张卡片和 <a href="./gallery-manifest.json">gallery-manifest.json</a> 中；资产同步与确认名单在 <a href="./sync_role_assets.py">sync_role_assets.py</a>，页面构建在 <a href="./build_gallery.py">build_gallery.py</a>。</div>
</main>
<div class="modal" id="modal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><div class="modal-inner">
<div class="modal-toolbar"><span class="modal-heading" id="modal-position"></span><button class="nav" id="prev-image" aria-label="上一张图片" title="上一张图片（←）">←</button><button class="nav" id="next-image" aria-label="下一张图片" title="下一张图片（→）">→</button><button class="nav" id="prev" aria-label="上一张">‹</button><button class="nav" id="next" aria-label="下一张">›</button><button class="modal-favorite" id="modal-favorite" type="button" aria-pressed="false">☆ 收藏</button><button class="close" id="close" aria-label="关闭">×</button></div>
<div class="modal-layout"><div class="modal-visual"><img id="modal-img" alt=""></div><section class="image-details" id="image-details">
<section id="character-panel" class="character-panel" aria-label="同一角色的其他图片"></section><h2 id="detail-title"></h2><div class="detail-actions"><button id="detail-share">分享</button><button id="detail-download">下载原图</button><button class="danger" id="detail-delete">删除</button><button class="danger" id="detail-purge" hidden>彻底删除</button></div><dl class="generation-facts" id="generation-facts"></dl>
<h3>文生图提示词</h3><div class="prompt-badge" id="prompt-kind"></div><div class="detail-small">完整英文提示词 · 可直接复制到生图工具</div>
<textarea class="prompt-text" id="generation-prompt" aria-label="完整文生图提示词" readonly spellcheck="false"></textarea>
<div class="prompt-actions"><button type="button" id="copy-prompt">复制文生图提示词</button><a id="download-record" download>下载生成记录 .txt</a></div><div class="copy-status" id="copy-status" role="status" aria-live="polite"></div>
<p class="reproduction-note" id="reproduction-note"></p><details class="original-record" id="original-record"><summary>查看原始生成记录与来源</summary><div id="original-content"></div></details>
</section></div></div></div>
<div class="action-toast" id="action-toast" role="status" aria-live="polite" hidden></div>
<dialog class="share-dialog" id="share-dialog" aria-labelledby="share-title"><header><h2 id="share-title">分享图片</h2><button id="share-close" aria-label="关闭分享">×</button></header><div class="share-preview" id="share-preview"></div><section class="share-section"><h3>分享链接</h3><p id="share-link-note"></p><textarea id="share-links" aria-label="素材链接" readonly spellcheck="false"></textarea><div class="share-options"><button id="share-copy-link" class="share-primary">复制图片链接</button><button id="share-link-native">分享链接到…</button></div></section><section class="share-section"><h3 id="share-file-title">分享图片</h3><p id="share-image-note">通过系统分享面板选择微信等应用；可用应用由设备决定。</p><div class="share-options"><button id="share-native" disabled>分享图片到…</button><button id="share-copy-image" disabled>复制图片</button><button id="share-download">下载原图</button><button id="share-retry" hidden>重新加载图片</button></div></section><div class="share-progress" id="share-progress" role="status" aria-live="polite"></div></dialog>
<dialog id="purge-dialog" class="share-dialog" aria-labelledby="purge-title" aria-describedby="purge-description"><h2 id="purge-title">彻底删除图片？</h2><p id="purge-description">将删除所选图片的图库文件和条目，并从收藏及角色关联中移除，无法在回收站恢复。原项目素材和历史备份保留；后续同步不会重新加入这些图片。</p><ul id="purge-list"></ul><p id="purge-error" role="alert"></p><div class="share-options"><button id="purge-cancel">取消</button><button class="danger" id="purge-confirm">彻底删除</button></div></dialog>
<script src="gallery-delete.js?v=__ACTIONS_HASH__"></script>
<script src="gallery-actions.js?v=__ACTIONS_HASH__"></script>
<script src="gallery-scenes.js?v=__ACTIONS_HASH__"></script>
<script src="gallery-characters.js?v=__ACTIONS_HASH__"></script>
<script src="gallery-navigation.js?v=__ACTIONS_HASH__"></script>
<script src="gallery-wardrobe.js?v=__ACTIONS_HASH__"></script>
<script>
const manifest=__MANIFEST__;
const assets=manifest.assets;
function numberBadge(a){return `<span class="library-number" aria-label="编号 ${a.library_number}">${a.library_number}</span>`}
const completion=manifest.asset_standard.completion;
document.getElementById('completion-summary').innerHTML=`<strong>角色素材配置 · 本轮 ${manifest.asset_standard.scope?.character_count||0} 位角色</strong><span>本轮新增 ${completion.generated_additions} 张 · 缺口已补 ${completion.available} / ${completion.initial_gaps} 项 · 尚余 ${completion.pending} 项</span><a href="${manifest.asset_standard.progress_path||'imports/role-completion-20260924/progress.json'}" download>下载补齐进度</a>`;
const styleLabels={"all": "全部风格", "realistic_live_action": "真人写实", "cozy_photoreal_domestic": "居家写实", "otome_2d5d_3d": "乙游 2.5D / 3D", "cinematic_night": "电影夜景", "watercolor": "透明水彩", "oil_painting": "厚涂油画", "cel_animation": "赛璐璐动画", "clay_miniature": "黏土微缩", "paper_art": "层叠纸雕", "ink_wash": "水墨淡彩", "retro_poster": "复古旅行海报", "vintage_film": "复古胶片", "dreamy_3d": "梦幻3D"};
const speciesLabels={all:'全部物种',prop:'道具物件',environment:'环境 / 空间',object:'服装 / 配饰',human:'人类',cat:'猫',dog:'狗',merfolk:'人鱼',mixed:'混合 / 双人'};
const categoryLabels={all:'全部用途',prop:'道具图',full_body:'单人全身',expression_grid:'九宫格表情',head_angles:'头部多角度',identity:'身份',character_board:'角色板',face_turnaround:'脸部三视图',body_turnaround:'全身三视图',pov:'POV',outfit:'完整造型',costume:'服装',accessory:'配饰单品',style_reference:'风格参考',relationship:'关系',expression:'表情',pose:'动作姿态',detail:'身份细节'};
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
function filtered(character=activeCharacter){const list=assets.filter(a=>{const hay=(a.title+' '+a.source+' '+a.category+' '+(a.scene_names||[]).join(' ')+' '+a.character_names.join(' ')+' '+a.view_label).toLowerCase();return kindMatches(a)&&sceneMatches(a)&&(activeCollection==='trash'?isTrashed(a):!isTrashed(a))&&(activeCollection!=='favorites'||favorites.has(favoriteKey(a)))&&(activeStyle==='all'||a.style_family===activeStyle)&&(activeSpecies==='all'||a.species===activeSpecies)&&(activeCategory==='all'||a.category===activeCategory)&&characterMatches(a,character)&&(!query||hay.includes(query.toLowerCase()))});return activeKind==='costume'?list.sort((a,b)=>a.library_number-b.library_number):list}
function renderStats(){const current=liveAssets();const styles=new Set(current.map(a=>a.style_family)),species=new Set(current.map(a=>a.species));document.getElementById('policy-count').textContent=current.length;stats.innerHTML=`<div class="stat"><b>${current.length}</b><span>确认资产</span></div><div class="stat"><b>${styles.size}</b><span>风格分类</span></div><div class="stat"><b>${species.size}</b><span>物种分类</span></div><div class="stat"><b>${current.filter(a=>a.category==='identity').length}</b><span>身份资产</span></div>`}
function starButton(a,index){const saved=favorites.has(favoriteKey(a));return `<button type="button" class="favorite-button" data-favorite-index="${index}" aria-pressed="${saved}" aria-label="${saved?'取消收藏':'收藏'}：${escapeHTML(a.title)}" title="${saved?'取消收藏':'收藏'}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.78 5.64L21 9.55l-4.5 4.39 1.06 6.2L12 17.21l-5.56 2.93 1.06-6.2L3 9.55l6.22-.91Z"/></svg></button>`}
function renderGrid(){
 const list=filtered();
 grid.innerHTML=characterGridHTML(list,a=>{const index=assets.indexOf(a);return `<article class="card ${selectedAssets.has(favoriteKey(a))?'selected':''}"><div class="thumb ${a.generation.dimensions.height>a.generation.dimensions.width?'portrait-thumb':'sheet-thumb'}" data-index="${index}" tabindex="0" aria-label="预览：${escapeHTML(a.title)}"><img loading="lazy" src="${escapeHTML(assetURL(a))}" alt="${escapeHTML(a.title)}">${starButton(a,index)}${selectionMode?`<input type="checkbox" class="select-image" data-select-index="${index}" aria-label="选择：${escapeHTML(a.title)}" ${selectedAssets.has(favoriteKey(a))?'checked':''}>`:''}</div><div class="meta">${numberBadge(a)}<h3>${escapeHTML(a.title)}</h3><div class="chips"><span class="chip">${styleLabels[a.style_family]}</span><span class="chip">${speciesLabels[a.species]}</span><span class="chip">${escapeHTML(a.view_label)}</span></div><div class="source">${escapeHTML(a.generation.generation_date||'生成日期未记录')} · ${a.completion_round?'补充素材':'已入库'}</div>${cardActions(a,index)}</div></article>`});
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
 document.getElementById('generation-facts').innerHTML=`<dt>生图模型</dt><dd>${escapeHTML(g.model.display_name)}</dd><dt>生成日期</dt><dd>${escapeHTML(dateLabel(g))}<div class="detail-small">${escapeHTML(g.generation_date?'时区：'+g.generation_timezone:g.generation_date_note)}</div></dd><dt>图像尺寸</dt><dd>${g.dimensions.width} × ${g.dimensions.height} px</dd>`;
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
initGalleryActions();renderStats();render();initPermanentDelete();

</script>
<script src="gallery-voices.js?v=20260929-commercial-v1"></script>
<script src="gallery-bgm.js?v=20260929-number-default"></script>
<script src="gallery-bulk.js?v=__ACTIONS_HASH__"></script>
</body>
</html>'''
(LIB / 'index.html').write_text(html.replace('__MANIFEST__', embedded).replace('__ACTIONS_HASH__', hashlib.sha256((LIB / 'gallery-bulk.js').read_bytes() + (LIB / 'gallery-actions.js').read_bytes() + (LIB / 'gallery-actions.css').read_bytes() + (LIB / 'gallery-characters.js').read_bytes() + (LIB / 'gallery-delete.js').read_bytes() + (LIB / 'gallery-navigation.js').read_bytes() + (LIB / 'gallery-navigation.css').read_bytes() + (LIB / 'gallery-wardrobe.js').read_bytes() + (LIB / 'gallery-scenes.js').read_bytes()).hexdigest()[:12]))
print(f'built gallery with {len(manifest["assets"])} confirmed assets')
