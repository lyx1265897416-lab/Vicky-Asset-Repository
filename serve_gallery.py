"""Run the local gallery with a persistent, same-origin deletion API."""
import argparse
import json
import re
import subprocess
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
from library_deletion import deleted_keys, completed_deleted_keys, purge_assets

LOCK=threading.Lock()
class GalleryHandler(SimpleHTTPRequestHandler):
    def __init__(self,request,client_address,server):super().__init__(request,client_address,server,directory=str(server.root))
    def json_response(self,status,data):
        body=json.dumps(data,ensure_ascii=False).encode()
        self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
    def local_host(self):
        return self.headers.get('Host') in {f'127.0.0.1:{self.server.server_port}',f'localhost:{self.server.server_port}'}
    def do_GET(self):
        if not self.local_host():return self.json_response(403,{'error':'只允许本机访问'})
        path=unquote(urlsplit(self.path).path).lstrip('/')
        if path=='api/library-state':return self.json_response(200,{'permanent_delete':True,'deleted_ids':sorted(completed_deleted_keys(self.server.root))})
        if path in deleted_keys(self.server.root):return self.send_error(410,'Image permanently deleted')
        if path.startswith('assets/videos/') and path.endswith('.mp4'):
            return self.send_video(path)
        return super().do_GET()
    def send_video(self,path,head=False):
        target=(self.server.root/path).resolve()
        if not target.is_relative_to(self.server.root/'assets/videos') or not target.is_file():
            return self.send_error(404)
        size=target.stat().st_size;start=0;end=size-1
        value=self.headers.get('Range')
        if value:
            match=re.fullmatch(r'bytes=(\d*)-(\d*)',value)
            if not match or not any(match.groups()):
                self.send_response(416);self.send_header('Content-Range',f'bytes */{size}');self.end_headers();return
            left,right=match.groups()
            if left:
                start=int(left);end=min(int(right),size-1) if right else size-1
            else:
                start=max(0,size-int(right))
            if start>end or start>=size:
                self.send_response(416);self.send_header('Content-Range',f'bytes */{size}');self.end_headers();return
        self.send_response(206 if value else 200)
        self.send_header('Content-Type','video/mp4');self.send_header('Accept-Ranges','bytes')
        self.send_header('Content-Length',str(end-start+1))
        if value:self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
        self.end_headers()
        if head:return
        try:
            with target.open('rb') as source:
                source.seek(start);remaining=end-start+1
                while remaining:
                    chunk=source.read(min(262144,remaining))
                    if not chunk:break
                    self.wfile.write(chunk);remaining-=len(chunk)
        except (BrokenPipeError,ConnectionResetError):pass
    def do_HEAD(self):
        if not self.local_host():return self.send_error(403)
        path=unquote(urlsplit(self.path).path).lstrip('/')
        if path.startswith('assets/videos/') and path.endswith('.mp4'):return self.send_video(path,head=True)
        return super().do_HEAD()
    def do_POST(self):
        if self.path!='/api/permanently-delete':return self.json_response(404,{'error':'接口不存在'})
        host=self.headers.get('Host','')
        if not self.local_host() or self.headers.get('Origin')!=f'http://{host}' or self.headers.get('X-Vicky-Action')!='permanently-delete':
            return self.json_response(403,{'error':'请求来源无效'})
        if self.headers.get_content_type()!='application/json':return self.json_response(415,{'error':'需要 JSON 请求'})
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=300000:raise ValueError('请求过大或为空')
            payload=json.loads(self.rfile.read(size))
            if not isinstance(payload,dict):raise ValueError('请求格式无效')
            if payload.get('confirmed') is not True:raise ValueError('请先确认彻底删除')
            with LOCK:
                removed=purge_assets(self.server.root,payload.get('ids'))
                build=subprocess.run([sys.executable,str(self.server.root/'build_gallery.py')],cwd=self.server.root,capture_output=True,text=True)
            self.json_response(200,{'deleted_ids':removed,'rebuild_ok':build.returncode==0})
        except (ValueError,TypeError,KeyError) as exc:self.json_response(400,{'error':str(exc)})
        except OSError:self.json_response(500,{'error':'磁盘删除未完成，请检查文件权限并重试'})
    def end_headers(self):
        self.send_header('Cache-Control','no-cache')
        super().end_headers()

def main():
    p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8768);p.add_argument('--root',type=Path,default=Path(__file__).resolve().parent);args=p.parse_args()
    server=ThreadingHTTPServer(('127.0.0.1',args.port),GalleryHandler);server.root=args.root.resolve()
    print(f'Gallery ready at http://127.0.0.1:{args.port}/',flush=True);server.serve_forever()
if __name__=='__main__':main()
