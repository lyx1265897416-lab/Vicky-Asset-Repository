"""Create a read-only Pages gallery below GitHub's 1 GB site limit.

Original media remain in the repository's verified Releases. Voice recordings
and source records are copied byte-for-byte; images, music and oversized video
have labelled web copies. Never edits the local gallery or original media.
"""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import os
from pathlib import Path
import re
import runpy
import shutil
import subprocess
import sys

from PIL import Image, ImageOps
from imageio_ffmpeg import get_ffmpeg_exe
from optimize_gallery_export import optimize

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'deployment/github-pages/public'
CACHE = ROOT / 'deployment/github-pages/cache'
BACKUP = 'https://github.com/lyx1265897416-lab/Vicky-Asset-Repository/releases/latest'


def main():
    runpy.run_path(str(ROOT / 'tools/prepare_private_export.py'))
    export = ROOT / 'private-site/work/export'
    inventory = json.loads((export / 'upload-manifest.json').read_text())
    catalog = json.loads((ROOT / 'gallery-manifest.json').read_text())
    music = {v['path'] for track in catalog.get('bgm', []) for v in track['variants']}
    web_videos = {v['id'] for v in catalog.get('videos', []) if (ROOT / v['path']).stat().st_size >= 100_000_000}
    for video in catalog.get('videos', []):
        if video['id'] in web_videos:
            video['pages_web_copy'] = True
    OUT.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    files = {entry['path']: entry for entry in inventory['files']}
    mapping = {}
    ffmpeg = get_ffmpeg_exe()

    def convert(entry):
        path = entry['path']
        source = Path(entry['local_path'])
        suffix = source.suffix.lower()
        if suffix in {'.png', '.jpg', '.jpeg', '.webp'}:
            relative = f'web/images/{entry["sha256"]}-1280-q80.webp'
            cached = CACHE / Path(relative).name
            if not cached.exists():
                with Image.open(source) as original:
                    image = ImageOps.exif_transpose(original)
                    image.thumbnail((1280, 1280), Image.Resampling.LANCZOS)
                    image.save(cached, 'WEBP', quality=80, method=4)
        elif suffix == '.mp4' and source.stat().st_size >= 100_000_000:
            relative = f'web/videos/{entry["sha256"]}-web.mp4'
            cached = CACHE / Path(relative).name
            if not cached.exists():
                temporary = cached.with_suffix('.tmp.mp4')
                subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y',
                                '-i', str(source), '-c:v', 'libx264', '-preset', 'fast',
                                '-crf', '24', '-maxrate', '4M', '-bufsize', '8M',
                                '-pix_fmt', 'yuv420p', '-threads', '4', '-c:a', 'aac',
                                '-b:a', '128k', '-movflags', '+faststart', str(temporary)], check=True)
                temporary.replace(cached)
        elif path in music:
            relative = f'web/music/{entry["sha256"]}-80k.m4a'
            cached = CACHE / Path(relative).name
            if not cached.exists():
                temporary = cached.with_suffix('.tmp.m4a')
                subprocess.run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-y',
                                '-i', str(source), '-vn', '-c:a', 'aac', '-b:a', '80k',
                                '-movflags', '+faststart', str(temporary)], check=True)
                temporary.replace(cached)
        else:
            return path, path, source
        return path, relative, cached

    # Avoid converting duplicate content concurrently.
    unique = {}
    for entry in inventory['files']:
        key = (entry['sha256'], entry['path'] in music)
        unique.setdefault(key, entry)
    converted = {}
    with ThreadPoolExecutor(max_workers=4) as workers:
        for index, (path, relative, source) in enumerate(workers.map(convert, unique.values()), 1):
            entry = files[path]
            converted[(entry['sha256'], path in music)] = (relative, source)
            if index % 500 == 0:
                print(f'Prepared {index}/{len(unique)} unique files', flush=True)
    wanted = set()
    for entry in inventory['files']:
        path = entry['path']
        relative, source = converted[(entry['sha256'], path in music)]
        # Identical ordinary files retain every referenced relative path.
        if relative == unique[(entry['sha256'], path in music)]['path']:
            relative = path
        mapping[path] = relative
        wanted.add(relative)
        target = OUT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            target.unlink()
        # Rendered text is written below; never modify a hard link to a source file.
        if path == 'index.html' or path == 'gallery-manifest.json' or path.endswith('.js') or path.startswith('metadata/details/'):
            shutil.copyfile(source, target)
        else:
            os.link(source, target)

    def rewrite(value):
        if isinstance(value, dict):
            return {key: rewrite(item) for key, item in value.items()}
        if isinstance(value, list):
            return [rewrite(item) for item in value]
        if isinstance(value, str):
            return mapping.get(value, value)
        return value

    html = (export / 'index.html').read_text()
    start = html.index('const manifest=') + len('const manifest=')
    end = html.index(';\nconst assets=manifest.assets;', start)
    compact = rewrite(json.loads(html[start:end]))
    for video in compact.get('videos', []):
        if video['id'] in web_videos:
            video['pages_web_copy'] = True
    html = html[:start] + json.dumps(compact, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c') + html[end:]
    html = html.replace('下载原图', '下载展示图').replace('<dt>图像尺寸</dt>', '<dt>原图尺寸</dt>')
    html = re.sub(r'<div class="footer">.*?</div>',
                  f'<div class="footer">图片、背景音乐和超大视频使用网页展示版；角色音色保留原文件。<a href="{BACKUP}" target="_blank" rel="noopener">完整原文件备份 ↗</a></div>', html, flags=re.S)
    html = html.replace('<details class="library-overview">', f'<p class="pages-edition">网页展示版 · <a href="{BACKUP}" target="_blank" rel="noopener">完整原文件备份 ↗</a></p><details class="library-overview">', 1)
    html = html.replace('</head>', '<style>.pages-edition{font-size:13px;color:#6b625b}.pages-edition a,.footer a{color:#365747}.pages-edition{margin:8px 0 0}.footer{line-height:1.8}</style></head>', 1)
    (OUT / 'index.html').write_text(html)
    (OUT / 'gallery-manifest.json').write_text(json.dumps(rewrite(catalog), ensure_ascii=False, separators=(',', ':')))
    for path in (OUT / 'metadata/details').glob('*.json'):
        path.write_text(json.dumps(rewrite(json.loads(path.read_text())), ensure_ascii=False, separators=(',', ':')))
    # UI wording must not describe web copies as the original lossless media.
    actions = OUT / 'gallery-actions.js'
    actions.write_text(actions.read_text().replace("'下载原图'", "'下载展示图'"))
    music_js = OUT / 'gallery-bgm.js'
    music_js.write_text(music_js.read_text().replace(".extension.slice(1).toUpperCase()", ".path.split('.').pop().toUpperCase()")
                        .replace('下载当前版本', '下载网页试听版'))
    video_js = OUT / 'gallery-videos.js'
    video_js.write_text(video_js.read_text()
                        .replace('· 原文件</div>', "· ${v.pages_web_copy?'网页播放版':'原文件'}</div>")
                        .replace('>下载原视频</button>', ">${v.pages_web_copy?'下载网页视频':'下载原视频'}</button>")
                        .replace("${v.playback?", "${v.pages_web_copy?'<p class=\"source\">超大视频使用网页播放版；原文件请从完整备份获取。</p>':v.playback?"))
    (OUT / '.nojekyll').write_text('')
    wanted.add('.nojekyll')
    # Remove files from a previous export, while leaving an existing Git checkout intact.
    for path in OUT.rglob('*'):
        if path.is_file() and '.git' not in path.relative_to(OUT).parts and path.relative_to(OUT).as_posix() not in wanted:
            path.unlink()
    performance = optimize(OUT)
    exported_files = [path for path in OUT.rglob('*') if path.is_file() and '.git' not in path.relative_to(OUT).parts]
    total = sum(path.stat().st_size for path in exported_files)
    if total >= 950_000_000:
        raise RuntimeError(f'Pages export exceeds safe budget: {total:,} bytes')
    assert all(path.stat().st_size < 100_000_000 for path in OUT.rglob('*')
               if path.is_file() and '.git' not in path.relative_to(OUT).parts), 'File exceeds GitHub Git limit'
    for entry in compact['assets']:
        assert (OUT / entry['path']).is_file(), entry['path']
    for voice in compact.get('voices', []):
        assert (OUT / voice['path']).read_bytes() == (ROOT / next(v['path'] for v in catalog['voices'] if v['id'] == voice['id'])).read_bytes()
    receipt = {'release': inventory['release'], 'bytes': total, 'files': len(exported_files), 'counts': inventory['counts'], 'performance': performance,
               'backup_url': BACKUP, 'voice_files_unchanged': True, 'source_media_unchanged': True,
               'url': 'https://lyx1265897416-lab.github.io/Vicky-Asset-Repository/'}
    (OUT.parent / 'inventory.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(receipt, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    main()
