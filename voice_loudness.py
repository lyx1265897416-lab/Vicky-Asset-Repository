"""Measured loudness derivatives; archived source audio is never modified."""
from pathlib import Path
import hashlib,json,subprocess,re,math,uuid,array
from concurrent.futures import ThreadPoolExecutor

FF=Path('/Users/vicky/Interactive storyline/.media-runtime/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1')
POLICY={'version':2,'target_lufs':-18.0,'max_true_peak_dbtp':-1.5,'render_true_peak_dbtp':-2.0,'tolerance_lu':0.3,'lra_target_lu':11,'sample_rate':48000,'channels':1,'codec':'libmp3lame','bitrate':'192k','onset_relative_threshold_db':24,'onset_preroll_seconds':0.12,'onset_max_seconds':0.25}
MONO='aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=mono'
def digest(p):return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def run(args):
 p=subprocess.run([str(FF),'-hide_banner','-nostdin',*args],capture_output=True,text=True)
 if p.returncode:raise RuntimeError(p.stderr[-4000:])
 return p.stderr
def stats(stderr):
 matches=re.findall(r'\{\s*"input_i".*?\}',stderr,re.S)
 if not matches:raise ValueError('No loudness measurement')
 data=json.loads(matches[-1]);assert all(math.isfinite(float(data[k])) for k in ['input_i','input_tp','input_lra','input_thresh'])
 return data
def measure(path,target=-18.0,tp=-2.0):
 return stats(run(['-i',str(path),'-map','0:a:0','-af',f'{MONO},loudnorm=I={target}:TP={tp}:LRA=11:print_format=json','-f','null','-']))
def within(m):
 return abs(float(m['input_i'])-POLICY['target_lufs'])<=POLICY['tolerance_lu'] and float(m['input_tp'])<=POLICY['max_true_peak_dbtp']
def onset(path):
 # Relative to sustained signal energy: near-silent generation noise must not
 # count as speech. A 40 ms occupancy test rejects isolated opening clicks.
 p=subprocess.run([str(FF),'-v','error','-nostdin','-i',str(path),'-map','0:a:0','-ac','1','-ar','16000','-f','f32le','-'],capture_output=True,check=True)
 samples=array.array('f',p.stdout);levels=[]
 for i in range(0,len(samples),160):
  frame=samples[i:i+160];levels.append(10*math.log10(max(sum(x*x for x in frame)/len(frame),1e-16)))
 if len(levels)<6:raise ValueError('Audio too short for onset detection')
 p95=sorted(levels)[int(len(levels)*.95)];threshold=p95-POLICY['onset_relative_threshold_db']
 first=next((i for i in range(len(levels)-5) if sum(x>threshold for x in levels[i:i+6])>=4),None)
 if first is None or p95 < -90:raise ValueError('No audible signal')
 start=first*.01
 return {'signal_onset_seconds':round(start,4),'trim_start_seconds':round(max(0,start-POLICY['onset_preroll_seconds']),4),'threshold_dbfs':round(threshold,3),'p95_frame_rms_dbfs':round(p95,3),'duration_seconds':len(samples)/16000}
def normalize_voice(voice,root):
 root=Path(root);source=root/voice['path']
 assert source.is_file() and digest(source)==voice['sha256'],'Source audio changed: '+voice['id']
 key=hashlib.sha256((voice['sha256']+json.dumps(POLICY,sort_keys=True)).encode()).hexdigest()[:20]
 out=root/'assets/voices/normalized-lufs18'/f"{voice['id']}-{key}.mp3"
 rec=root/'metadata/voice-loudness'/f"{voice['id']}-{key}.json"
 if rec.exists():
  data=json.loads(rec.read_text())
  if out.is_file() and digest(out)==data['output_sha256'] and data['policy']==POLICY and within(data['after']) and data['onset_after']['signal_onset_seconds']<=POLICY['onset_max_seconds']:return derivative(voice,data)
 out.parent.mkdir(parents=True,exist_ok=True);rec.parent.mkdir(parents=True,exist_ok=True)
 before=measure(source);start=onset(source);target=POLICY['target_lufs'];tp=POLICY['render_true_peak_dbtp'];attempts=[]
 temp=out.with_name(out.stem+'.'+uuid.uuid4().hex+'.mp3')
 trimmed=temp.with_suffix('.wav');working=source
 try:
  if start['trim_start_seconds']>0:
   run(['-y','-i',str(source),'-map','0:a:0','-af',f'{MONO},atrim=start={start["trim_start_seconds"]},asetpts=PTS-STARTPTS','-c:a','pcm_f32le',str(trimmed)])
   working=trimmed
  working_measure=measure(working)
  for attempt in range(4):
   measured=working_measure if attempt==0 else measure(working,target,tp)
   filt=f'{MONO},loudnorm=I={target}:TP={tp}:LRA=11:measured_I={measured["input_i"]}:measured_TP={measured["input_tp"]}:measured_LRA={measured["input_lra"]}:measured_thresh={measured["input_thresh"]}:offset={measured["target_offset"]}:linear=true:print_format=json'
   render=stats(run(['-y','-i',str(working),'-map','0:a:0','-vn','-af',filt,'-ar','48000','-ac','1','-c:a','libmp3lame','-b:a','192k','-map_metadata','-1',str(temp)]))
   after=measure(temp);attempts.append({'filter':filt,'render':render,'verified':after})
   if within(after):break
   target+=POLICY['target_lufs']-float(after['input_i'])
   if float(after['input_tp'])>POLICY['max_true_peak_dbtp']:tp-=float(after['input_tp'])-POLICY['max_true_peak_dbtp']+0.3
  else:
   # Short dialogue with irregular pauses may not converge under loudnorm's
   # gate. Correct from the measured encoded result when peak headroom allows.
   correction=POLICY['target_lufs']-float(after['input_i'])
   if float(after['input_tp'])+correction>POLICY['max_true_peak_dbtp']-0.2:
    raise ValueError('Insufficient peak headroom: '+voice['id']+' '+json.dumps(after))
   corrected=temp.with_name(temp.stem+'-corrected.mp3')
   run(['-y','-i',str(temp),'-af',f'volume={correction}dB','-c:a','libmp3lame','-b:a','192k',str(corrected)])
   corrected.replace(temp);after=measure(temp)
   attempts.append({'final_gain_db':correction,'verified':after})
   if not within(after):raise ValueError('Unable to reach loudness target: '+voice['id']+' '+json.dumps(after))
  onset_after=onset(temp)
  if onset_after['signal_onset_seconds']>POLICY['onset_max_seconds']:raise ValueError('Delayed onset after trimming: '+voice['id']+' '+json.dumps(onset_after))
  assert abs(onset_after['duration_seconds']-(start['duration_seconds']-start['trim_start_seconds']))<0.05,'Duration mismatch'
  temp.replace(out)
  data={'voice_id':voice['id'],'policy':POLICY,'source_path':voice['path'],'source_sha256':voice['sha256'],'output_path':str(out.relative_to(root)),'output_sha256':digest(out),'before':before,'after':after,'onset_before':start,'onset_after':onset_after,'attempts':attempts,'measurement_record':str(rec.relative_to(root)),'processing':'Leading low-level padding trimmed with 120 ms pre-roll; internal pauses preserved. Mono 48 kHz; two-pass EBU R128 loudnorm; MP3 192k; remeasured encoded file. No change to pitch or speaking speed.'}
  tmprec=rec.with_suffix('.'+uuid.uuid4().hex+'.tmp');tmprec.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');tmprec.replace(rec)
  return derivative(voice,data)
 finally:
  if temp.exists():temp.unlink()
  if trimmed.exists():trimmed.unlink()
def derivative(voice,data):
 v=dict(voice);v['original_audio']={'path':voice['path'],'sha256':voice['sha256']}
 v['path']=data['output_path'];v['sha256']=data['output_sha256']
 v['duration_seconds']=data['onset_after']['duration_seconds']
 v['onset_cleanup']={'removed_seconds':data['onset_before']['trim_start_seconds'],'signal_onset_seconds':data['onset_after']['signal_onset_seconds'],'preroll_seconds':POLICY['onset_preroll_seconds'],'internal_pauses_preserved':True}
 v['normalization']={'target_lufs':POLICY['target_lufs'],'measured_lufs':float(data['after']['input_i']),'true_peak_dbtp':float(data['after']['input_tp']),'true_peak_ceiling_dbtp':POLICY['max_true_peak_dbtp'],'source_lufs':float(data['before']['input_i']),'record':data['measurement_record'],'policy':POLICY}
 return v
if __name__=='__main__':
 root=Path(__file__).resolve().parent;voices=json.loads((root/'voice-library.json').read_text())['voices']
 with ThreadPoolExecutor(max_workers=4) as pool:
  for v in pool.map(lambda x:normalize_voice(x,root),voices):print(v['id'],v['normalization']['source_lufs'],'->',v['normalization']['measured_lufs'],'LUFS; peak',v['normalization']['true_peak_dbtp'],flush=True)
