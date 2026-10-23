"""Keep explicitly selected audition bytes stable across future gallery rebuilds."""
from pathlib import Path
import hashlib,json,math

def preserve_approved_playback(voice,root):
 root=Path(root).resolve(); approved=voice['approved_playback']
 def verified(rel,expected):
  p=(root/rel).resolve();p.relative_to(root)
  assert p.is_file() and hashlib.sha256(p.read_bytes()).hexdigest()==expected,'Approved voice bytes changed: '+rel
  return p
 verified(voice['path'],voice['sha256']);verified(approved['path'],approved['sha256'])
 record=(root/approved['measurement_record']).resolve();record.relative_to(root)
 data=json.loads(record.read_text())
 assert data['sha256']==approved['sha256'] and data['source_sha256']==voice['sha256']
 assert data['duration_seconds']>0 and all(math.isfinite(data[k]) for k in ['measured_lufs','true_peak_dbtp'])
 v=dict(voice);v['original_audio']={'path':voice['path'],'sha256':voice['sha256']}
 v.update(path=approved['path'],sha256=approved['sha256'],duration_seconds=data['duration_seconds'])
 v['normalization']={'target_lufs':-20.0,'measured_lufs':data['measured_lufs'],'true_peak_dbtp':data['true_peak_dbtp'],'true_peak_ceiling_dbtp':-2.0,'source_lufs':data['source_lufs'],'record':approved['measurement_record'],'policy':{'method':'approved_audition_fixed_gain','preserve_timing':True,'reprocess':False}}
 v['onset_cleanup']={'removed_seconds':0,'signal_onset_seconds':data['signal_onset_seconds'],'preroll_seconds':None,'internal_pauses_preserved':True,'long_pauses_shortened':0,'trailing_removed_seconds':0,'total_removed_seconds':0}
 return v
