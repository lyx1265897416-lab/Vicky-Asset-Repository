"""Validate original approved video cases without treating them as image assets."""
from pathlib import Path
import hashlib, json

def attach_videos(manifest, root):
    root=Path(root).resolve()
    catalog=root/'video-library.json'
    videos=json.loads(catalog.read_text())['videos'] if catalog.exists() else []
    ids=set(); hashes=set()
    for video in videos:
        if video['id'] in ids or video['sha256'] in hashes:
            raise ValueError('Duplicate video: '+video['id'])
        ids.add(video['id']);hashes.add(video['sha256'])
        if video['status']!='confirmed' or video['duration_seconds']<=0:
            raise ValueError('Video must be confirmed and playable')
        for path in [video['path'],video['poster'],video['record_download'],video['reuse_pack']['path']]:
            target=(root/path).resolve()
            if not target.is_relative_to(root) or not target.is_file():
                raise ValueError('Missing or invalid video file: '+path)
        if hashlib.sha256((root/video['path']).read_bytes()).hexdigest()!=video['sha256']:
            raise ValueError('Video bytes changed: '+video['path'])
        if video.get('playback'):
            playback=video['playback'];target=(root/playback['path']).resolve()
            if not target.is_relative_to(root) or not target.is_file() or hashlib.sha256(target.read_bytes()).hexdigest()!=playback['sha256']:
                raise ValueError('Invalid video playback copy')
        if not video['prompts'] or not all(p['text'].strip() for p in video['prompts']):
            raise ValueError('Missing video prompt provenance')
    manifest['videos']=videos
    manifest['video_count']=len(videos)
    return manifest
