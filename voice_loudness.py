"""Measured loudness derivatives; archived source audio is never modified."""
from pathlib import Path
import hashlib,json,subprocess,re,math,uuid,array
from concurrent.futures import ThreadPoolExecutor

FF=Path('/Users/vicky/Interactive storyline/.media-runtime/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1')
POLICY={'version':4,'target_lufs':-18.0,'max_true_peak_dbtp':-1.5,'render_true_peak_dbtp':-2.0,'tolerance_lu':0.3,'lra_target_lu':11,'sample_rate':48000,'channels':1,'codec':'libmp3lame','bitrate':'192k','onset_relative_threshold_db':18,'onset_preroll_seconds':0.12,'onset_max_seconds':0.25,'trailing_padding_seconds':0.18,'long_pause_seconds':1.0,'retained_pause_seconds':0.5,'verified_max_pause_seconds':1.2,'verified_max_trailing_seconds':0.5}
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
 # Sustained speech energy, not low-level model noise, anchors audition cuts.
 p=subprocess.run([str(FF),'-v','error','-nostdin','-i',str(path),'-map','0:a:0','-ac','1','-ar','16000','-f','f32le','-'],capture_output=True,check=True)
 samples=array.array('f',p.stdout);levels=[]
 for i in range(0,len(samples),160):
  frame=samples[i:i+160];levels.append(10*math.log10(max(sum(x*x for x in frame)/len(frame),1e-16)))
 if len(levels)<6:raise ValueError('Audio too short for onset detection')
 p95=sorted(levels)[int(len(levels)*.95)];threshold=p95-POLICY['onset_relative_threshold_db']
 active=[i for i in range(len(levels)-5) if sum(x>threshold for x in levels[i:i+6])>=4]
 if not active or p95 < -90:raise ValueError('No audible signal')
 duration=len(samples)/16000;start=active[0]*.01;end=min(duration,active[-1]*.01+.06)
 # A quarter-second on each side of a long gap protects quiet consonants,
 # breaths and word endings. Short expressive pauses remain untouched.
 gaps=[]
 for left,right in zip(active,active[1:]):
  a=left*.01+.06;b=right*.01
  if b-a>=POLICY['long_pause_seconds']:
   pad=POLICY['retained_pause_seconds']/2
   gaps.append({'start':round(a+pad,4),'end':round(b-pad,4),'original_gap_seconds':round(b-a,4)})
 trim_start=round(max(0,start-POLICY['onset_preroll_seconds']),4)
 trim_end=round(min(duration,end+POLICY['trailing_padding_seconds']),4)
 keep=[];cursor=trim_start
 for gap in gaps:
  keep.append([cursor,gap['start']]);cursor=gap['end']
 keep.append([cursor,trim_end])
 return {'signal_onset_seconds':round(start,4),'signal_end_seconds':round(end,4),'trim_start_seconds':trim_start,'trim_end_seconds':trim_end,'trailing_silence_seconds':round(duration-end,4),'threshold_dbfs':round(threshold,3),'p95_frame_rms_dbfs':round(p95,3),'duration_seconds':duration,'long_gaps':gaps,'keep_segments':keep,'expected_duration_seconds':sum(b-a for a,b in keep)}
def normalize_voice(voice,root):
 if voice.get('approved_playback'):
  from approved_voice_playback import preserve_approved_playback
  return preserve_approved_playback(voice,root)
 root=Path(root);source=root/voice['path']
 assert source.is_file() and digest(source)==voice['sha256'],'Source audio changed: '+voice['id']
 key=hashlib.sha256((voice['sha256']+json.dumps(POLICY,sort_keys=True)).encode()).hexdigest()[:20]
 out=root/'assets/voices/normalized-lufs18'/f"{voice['id']}-{key}.mp3"
 rec=root/'metadata/voice-loudness'/f"{voice['id']}-{key}.json"
 if rec.exists():
  data=json.loads(rec.read_text())
  if out.is_file() and digest(out)==data['output_sha256'] and data['policy']==POLICY and within(data['after']) and data['onset_after']['signal_onset_seconds']<=POLICY['onset_max_seconds'] and all(g['original_gap_seconds']<=POLICY['verified_max_pause_seconds'] for g in data['onset_after']['long_gaps']) and data['onset_after']['trailing_silence_seconds']<=POLICY['verified_max_trailing_seconds']:return derivative(voice,data)
 out.parent.mkdir(parents=True,exist_ok=True);rec.parent.mkdir(parents=True,exist_ok=True)
 before=measure(source);start=onset(source);target=POLICY['target_lufs'];tp=POLICY['render_true_peak_dbtp'];attempts=[]
 temp=out.with_name(out.stem+'.'+uuid.uuid4().hex+'.mp3')
 trimmed=temp.with_suffix('.wav');working=source
 try:
  segments=start['keep_segments']
  split='[0:a:0]'+MONO+',asplit='+str(len(segments))+''.join(f'[s{i}]' for i in range(len(segments)))+';'
  cuts=';'.join(f'[s{i}]atrim=start={a}:end={b},asetpts=PTS-STARTPTS[k{i}]' for i,(a,b) in enumerate(segments))
  join=';'+''.join(f'[k{i}]' for i in range(len(segments)))+f'concat=n={len(segments)}:v=0:a=1[out]'
  run(['-y','-i',str(source),'-filter_complex',split+cuts+join,'-map','[out]','-c:a','pcm_f32le',str(trimmed)])
  working=trimmed
  working_measure=measure(working)
  # Constant gain preserves the speech/noise envelope used for trimming.
  # Oversampled limiting is added only when measured peaks need headroom.
  gain=POLICY['target_lufs']-float(working_measure['input_i'])
  ceiling=POLICY['render_true_peak_dbtp']
  for attempt in range(6):
   filt=f'{MONO},volume={gain}dB'
   limited=float(working_measure['input_tp'])+gain>ceiling
   if limited:filt+=f',aresample=192000,alimiter=limit={10**(ceiling/20)}:level=false:latency=true,aresample=48000'
   run(['-y','-i',str(working),'-af',filt,'-c:a','libmp3lame','-b:a','192k',str(temp)])
   after=measure(temp);attempts.append({'gain_db':gain,'peak_limiter':limited,'ceiling_db':ceiling,'verified':after})
   if within(after):break
   gain+=POLICY['target_lufs']-float(after['input_i'])
   if float(after['input_tp'])>POLICY['max_true_peak_dbtp']:ceiling-=float(after['input_tp'])-POLICY['max_true_peak_dbtp']+0.3
  else:raise ValueError('Unable to reach loudness target: '+voice['id']+' '+json.dumps(after))
  onset_after=onset(temp)
  if onset_after['signal_onset_seconds']>POLICY['onset_max_seconds']:raise ValueError('Delayed onset after trimming: '+voice['id']+' '+json.dumps(onset_after))
  if any(g['original_gap_seconds']>POLICY['verified_max_pause_seconds'] for g in onset_after['long_gaps']) or onset_after['trailing_silence_seconds']>POLICY['verified_max_trailing_seconds']:raise ValueError('Residual audition silence: '+voice['id']+' '+json.dumps(onset_after))
  assert abs(onset_after['duration_seconds']-start['expected_duration_seconds'])<0.05,'Duration mismatch'
  temp.replace(out)
  data={'voice_id':voice['id'],'policy':POLICY,'source_path':voice['path'],'source_sha256':voice['sha256'],'output_path':str(out.relative_to(root)),'output_sha256':digest(out),'before':before,'after':after,'onset_before':start,'onset_after':onset_after,'attempts':attempts,'measurement_record':str(rec.relative_to(root)),'processing':'Speech-energy detection rejects low-level model noise. Leading padding trimmed with 120 ms pre-roll; ending padded by 180 ms; pauses of at least 1 second shortened to 500 ms with 250 ms speech-edge protection. Short pauses preserved. Mono 48 kHz; EBU R128 measured constant gain with oversampled peak limiting when needed; MP3 192k; remeasured encoded file. No change to pitch or speaking speed.'}
  tmprec=rec.with_suffix('.'+uuid.uuid4().hex+'.tmp');tmprec.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');tmprec.replace(rec)
  return derivative(voice,data)
 finally:
  if temp.exists():temp.unlink()
  if trimmed.exists():trimmed.unlink()
def derivative(voice,data):
 v=dict(voice);v['original_audio']={'path':voice['path'],'sha256':voice['sha256']}
 v['path']=data['output_path'];v['sha256']=data['output_sha256']
 v['duration_seconds']=data['onset_after']['duration_seconds']
 v['onset_cleanup']={'removed_seconds':data['onset_before']['trim_start_seconds'],'signal_onset_seconds':data['onset_after']['signal_onset_seconds'],'preroll_seconds':POLICY['onset_preroll_seconds'],'internal_pauses_preserved':not bool(data['onset_before']['long_gaps']),'long_pauses_shortened':len(data['onset_before']['long_gaps']),'trailing_removed_seconds':round(data['onset_before']['duration_seconds']-data['onset_before']['trim_end_seconds'],4),'total_removed_seconds':round(data['onset_before']['duration_seconds']-data['onset_after']['duration_seconds'],4)}
 v['normalization']={'target_lufs':POLICY['target_lufs'],'measured_lufs':float(data['after']['input_i']),'true_peak_dbtp':float(data['after']['input_tp']),'true_peak_ceiling_dbtp':POLICY['max_true_peak_dbtp'],'source_lufs':float(data['before']['input_i']),'record':data['measurement_record'],'policy':POLICY}
 return v
if __name__=='__main__':
 root=Path(__file__).resolve().parent;voices=json.loads((root/'voice-library.json').read_text())['voices']
 with ThreadPoolExecutor(max_workers=4) as pool:
  for v in pool.map(lambda x:normalize_voice(x,root),voices):print(v['id'],v['normalization']['source_lufs'],'->',v['normalization']['measured_lufs'],'LUFS; peak',v['normalization']['true_peak_dbtp'],flush=True)
