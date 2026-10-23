"""Incremental private R2 publication. Credentials arrive on hidden stdin only."""
from pathlib import Path
import concurrent.futures,json,sys,threading,time,urllib.request,urllib.parse,urllib.error
import termios
import http.client
attrs=termios.tcgetattr(sys.stdin)
hidden=attrs[:];hidden[3]&=~termios.ECHO
termios.tcsetattr(sys.stdin,termios.TCSANOW,hidden)
print('Ready for private publisher JSON on stdin (input is hidden).',flush=True)
try:config=json.loads(sys.stdin.readline())
finally:termios.tcsetattr(sys.stdin,termios.TCSANOW,attrs)
root=Path(__file__).resolve().parents[1]/'private-site'
manifest=json.loads((root/'work/export/upload-manifest.json').read_text())
base=config['url'].rstrip('/')
headers={'OAI-Sites-Authorization':'Bearer '+config['service_token'],'X-Library-Publish-Token':config['publish_token']}
def call(path,method='GET',body=None,extra=None):
    for attempt in range(5):
        try:
            req=urllib.request.Request(base+path,data=body,method=method,headers={**headers,**(extra or {})})
            with urllib.request.urlopen(req,timeout=1200) as r:return json.load(r)
        except (urllib.error.URLError,TimeoutError,http.client.IncompleteRead,http.client.RemoteDisconnected,ConnectionResetError) as exc:
            if attempt==4:raise RuntimeError(f'Publication request failed: {path.split("?")[0]} ({getattr(exc,"code",type(exc).__name__)})') from None
            time.sleep(min(2**attempt,12))
existing={o['sha256']:o['size'] for o in call('/api/publish/objects')['objects']}
unique={f['sha256']:f for f in manifest['files']}
pending=[f for h,f in unique.items() if existing.get(h)!=f['size']]
total=sum(f['size'] for f in pending)
print(json.dumps({'stage':'upload','files':len(manifest['files']),'unique':len(unique),'reused':len(unique)-len(pending),'upload_files':len(pending),'upload_bytes':total}),flush=True)
lock=threading.Lock();done=0;done_bytes=0;started=time.monotonic()
progress=root/'work/upload-progress.json'
def upload(f):
    global done,done_bytes
    data=Path(f['local_path']).read_bytes()
    path='/api/publish/object?'+urllib.parse.urlencode({'release':manifest['release'],'key':f['path']})
    result=call(path,'PUT',data,{'Content-Type':f['type'],'X-Content-SHA256':f['sha256']})
    if result.get('sha256')!=f['sha256'] or result.get('size')!=f['size']:raise RuntimeError('Uploaded object verification failed: '+f['path'])
    with lock:
        done+=1;done_bytes+=f['size']
        state={'stage':'upload','done':done,'total':len(pending),'bytes':done_bytes,'total_bytes':total,'elapsed_seconds':round(time.monotonic()-started,1)}
        if done%25==0 or done==len(pending):
            progress.write_text(json.dumps(state)+'\n');print(json.dumps(state),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=32) as pool:
    futures=[pool.submit(upload,f) for f in pending]
    for future in concurrent.futures.as_completed(futures):future.result()
public_manifest={**manifest,'files':[{k:v for k,v in f.items() if k!='local_path'} for f in manifest['files']]}
result=call('/api/publish/activate','POST',json.dumps(public_manifest,ensure_ascii=False).encode(),{'Content-Type':'application/json'})
if not result.get('active'):raise RuntimeError('Activation was not confirmed')
receipt={**result,'url':base,'elapsed_seconds':round(time.monotonic()-started,1),'total_bytes':sum(f['size'] for f in unique.values())}
(root/'work/publication-receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'stage':'complete',**receipt},ensure_ascii=False),flush=True)
