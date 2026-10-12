"""Production asset coverage. A multi-character board never fills a solo slot."""
import json
from pathlib import Path

SLOTS = [
    ('identity', '身份母版', ('instance', 'front', 'face_turnaround', 'head_angles')),
    ('front', '正面平视', ('front', 'face_turnaround', 'head_angles')),
    ('full_body', '单人全身照', ('full_body',)),
    ('body_turnaround', '全身三视图', ('body_turnaround',)),
    ('head_angles', '头部多角度', ('face_turnaround', 'head_angles')),
    ('expression_grid', '九宫格表情', ('expression_grid',)),
]


def coverage(character, assets):
    solo = [a for a in assets if a.get('character_ids') == [character['id']]]
    return [{'key': key, 'label': label, 'paths': [a['path'] for a in solo if a.get('view_type') in views or key in a.get('verified_slots', [])]}
            for key, label, views in SLOTS]


def attach_standard(manifest, root):
    reviewed_path = Path(root)/'asset-slot-reviews.json'
    reviewed = json.loads(reviewed_path.read_text()) if reviewed_path.exists() else {}
    for a in manifest['assets']:
        a['verified_slots'] = reviewed.get(a['path'], {}).get('slots', [])
    round_config = Path(root)/'active-completion-round.json'
    round_id = json.loads(round_config.read_text())['round'] if round_config.exists() else '20260924'
    if not round_id.isdigit() or len(round_id) != 8: raise ValueError('Invalid completion round')
    round_dir = Path(root)/('imports/role-completion-'+round_id)
    path = round_dir/'snapshot/info.json'
    scope = round_dir/'snapshot/gallery-manifest.json'
    scope_ids = {c['id'] for c in json.loads(scope.read_text())['characters']} if scope.exists() else set()
    if path.exists():
        info = json.loads(path.read_text())
        scope_ids = set(info.get('character_ids', scope_ids))
    for c in manifest['characters']:
        c['asset_slots'] = coverage(c, manifest['assets'])
        c['completion_round'] = round_id if c['id'] in scope_ids else None
    queue = round_dir/'queue.json'
    jobs = json.loads(queue.read_text()) if queue.exists() else []
    current = {c['id']: c for c in manifest['characters']}
    rows = []
    for j in jobs:
        c = current.get(j['character_id'])
        paths = next((s['paths'] for s in c['asset_slots'] if s['key'] == j['view_type']), []) if c else []
        rows.append({'job_id':j['job_id'], 'character_id':j['character_id'], 'character_name':j['character_name'],
                     'view_type':j['view_type'], 'status':'available' if paths else ('pending' if c else 'removed_from_library'), 'paths':paths})
    completion = {'initial_gaps':len(jobs), 'available':sum(r['status']=='available' for r in rows),
                  'pending':sum(r['status']=='pending' for r in rows), 'removed':sum(r['status']=='removed_from_library' for r in rows),
                  'generated_additions':sum(a.get('completion_round')==round_id for a in manifest['assets'])}
    if queue.exists():
        from library_deletion import write_json
        write_json(queue.with_name('progress.json'), {'summary':completion,'jobs':rows})
    manifest['asset_standard'] = {'version': 1, 'slots': [{'key': k, 'label': l, 'views': list(v)} for k,l,v in SLOTS],
                                  'progress_path': (round_dir/'progress.json').relative_to(root).as_posix(), 'scope': json.loads(path.read_text()) if path.exists() else None, 'completion':completion}
    return manifest
