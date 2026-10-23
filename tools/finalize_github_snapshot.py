#!/usr/bin/env python3
"""Verify every uploaded bundle, commit the final inventory, then publish its release."""
import argparse,hashlib,json,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
REPO='lyx1265897416-lab/Vicky-Asset-Repository'
def run(*args):
 return subprocess.check_output(args,cwd=ROOT,text=True).strip()
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def main(wait):
 p=ROOT/'github-content-manifest.json'
 while True:
  inv=json.loads(p.read_text());tag=inv['snapshot'];expected={f'{o["release"]}/{o["bundle"]}' for o in inv['objects'].values()}
  if expected.issubset(inv['bundles']):
   release=next(r for r in json.loads(run('gh','api',f'repos/{REPO}/releases')) if r['tag_name']==tag)
   a=next((a for a in release['assets'] if a['name']==p.name),None)
   if a and a.get('digest')=='sha256:'+digest(p):break
  if not wait:raise SystemExit('Content transfer is not complete yet.')
  time.sleep(30)
 releases={r['tag_name']:r for r in json.loads(run('gh','api',f'repos/{REPO}/releases'))}
 verified=[]
 for key in sorted(expected):
  release_tag,name=key.split('/',1);expected_bundle=inv['bundles'][key]
  asset=next(a for a in releases[release_tag]['assets'] if a['name']==name)
  assert asset['state']=='uploaded' and asset['size']==expected_bundle['size']
  assert asset.get('digest')=='sha256:'+expected_bundle['sha256']
  verified.append({'name':name,'release':release_tag,'size':asset['size'],'sha256':expected_bundle['sha256']})
 gallery=json.loads((ROOT/'gallery-manifest.json').read_text())
 assert all(a['path'] in inv['files'] for a in gallery['assets'])
 proof_path=ROOT/'.github-transfer'/f'{tag}-restore-check.json'
 proof=json.loads(proof_path.read_text())
 assert proof['snapshot']==tag and proof['status']=='passed' and len(proof['files'])>=3,'Run remote restore verification first'
 receipt={'repository':REPO,'snapshot':tag,'content_file_count':len(inv['files']),'logical_bytes':sum(f['size'] for f in inv['files'].values()),'gallery_asset_count':len(gallery['assets']),'bundles':verified,'verification':'Every bundle remote state, size and SHA-256 matches the local inventory; release inventory SHA-256 matches exactly.','restoration_test':proof}
 (ROOT/'github-publication.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
 (ROOT/'.github-transfer/inflight.json').unlink(missing_ok=True)
 run('git','add','github-content-manifest.json','github-publication.json','tools/github_assets.py','tools/finalize_github_snapshot.py','README.md','.gitignore')
 if subprocess.run(['git','diff','--cached','--quiet'],cwd=ROOT).returncode:
  print(run('git','commit','-m',f'Finalize verified complete asset snapshot {tag}'),flush=True)
 head=run('git','rev-parse','HEAD')
 existing=subprocess.run(['git','rev-parse','--verify','refs/tags/'+tag],cwd=ROOT,capture_output=True,text=True)
 if existing.returncode:
  run('git','tag',tag)
 else:assert existing.stdout.strip()==head,'Snapshot tag already points to another commit'
 print(run('git','push','origin','main','refs/tags/'+tag),flush=True)
 run('gh','release','edit',tag,'--repo',REPO,'--draft=false','--latest')
 remote=json.loads(run('gh','api',f'repos/{REPO}/releases/tags/{tag}'))
 assert not remote['draft'] and len(remote['assets'])==len({o['bundle'] for o in inv['objects'].values() if o['release']==tag})+1
 assert run('git','ls-remote','origin','refs/heads/main').split()[0]==head
 print(json.dumps({'status':'complete','commit':head,'release_url':remote['html_url'],'content_files':len(inv['files']),'verified_bundles':len(verified)},ensure_ascii=False),flush=True)
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--wait',action='store_true');main(p.parse_args().wait)
