"""Download a new snapshot bundle and restore three actual assets to verify bytes."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.github-transfer'


def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(chunk)
    return result.hexdigest()


def main():
    inventory = json.loads((ROOT / 'github-content-manifest.json').read_text())
    tag = inventory['snapshot']
    candidates = {}
    for path, record in inventory['files'].items():
        obj = inventory['objects'][record['sha256']]
        if path.startswith('assets/') and obj['release'] == tag:
            candidates.setdefault(obj['bundle'], {})[record['sha256']] = (path, record)
    candidates = {name: values for name, values in candidates.items()
                  if len(values) >= 3 and f'{tag}/{name}' in inventory['bundles']}
    if not candidates:
        raise SystemExit('No verified new bundle with three assets is available yet.')
    name = min(candidates, key=lambda value: inventory['bundles'][f'{tag}/{value}']['size'])
    wanted = dict(list(candidates[name].items())[:3])
    destination = CACHE / 'restore-check' / tag
    destination.mkdir(parents=True, exist_ok=True)
    subprocess.run(['gh', 'release', 'download', tag, '--repo', inventory['repository'],
                    '--pattern', name, '--dir', str(destination), '--clobber'], check=True)
    pack = destination / name
    assert digest(pack) == inventory['bundles'][f'{tag}/{name}']['sha256'], 'Downloaded bundle mismatch'
    verified = []
    with tarfile.open(pack) as archive:
        for sha, (path, record) in wanted.items():
            target = destination / sha
            with archive.extractfile(f'objects/{sha}') as source, target.open('wb') as output:
                shutil.copyfileobj(source, output)
            assert target.stat().st_size == record['size'] and digest(target) == sha, path
            verified.append({'path': path, 'sha256': sha, 'size': record['size']})
    proof = {'snapshot': tag, 'status': 'passed', 'bundle': name, 'files': verified,
             'method': 'Downloaded the GitHub release bundle, verified its SHA-256, and restored three assets with exact size and SHA-256.'}
    (CACHE / f'{tag}-restore-check.json').write_text(json.dumps(proof, ensure_ascii=False, indent=2) + '\n')
    pack.unlink()
    print(json.dumps(proof, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
