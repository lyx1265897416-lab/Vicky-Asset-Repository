"""Generate another line with an archived Kokoro preset (no voice cloning).
Run: .voice-runtime312/bin/python generate_stock_voice.py --preset af_heart --text 'Hello there.' --output outputs/heart.wav
"""
from pathlib import Path
import argparse,json,hashlib
import numpy as np
import torch,soundfile as sf
from kokoro import KModel,KPipeline
import unidic,unidic_lite
unidic.DICDIR=unidic_lite.DICDIR
root=Path(__file__).resolve().parent
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--preset',required=True);parser.add_argument('--text',required=True);parser.add_argument('--output',required=True);parser.add_argument('--speed',type=float,default=1)
a=parser.parse_args();plan=json.loads((root/'imports/commercial-voices-20260929/kokoro-plan.json').read_text())
x=next((x for x in plan if x['preset']==a.preset),None)
if x is None:parser.error('Preset not archived in this batch')
out=(root/a.output).resolve()
if out.exists():parser.error('Output already exists; choose a new filename')
voice=root/x['voice_path'];assert hashlib.sha256(voice.read_bytes()).hexdigest()==x['voice_sha256']
folder=root/'voice-models/kokoro'/x['repo'].split('/')[-1];cn=a.preset.startswith('z')
modelpath=folder/('kokoro-v1_1-zh.pth' if cn else 'kokoro-v1_0.pth')
expected='b1d8410fa44dfb5c15471fd6c4225ea6b4e9ac7fa03c98e8bea47a9928476e2b' if cn else '496dba118d1a58f5f3db2efc88dbdc216e0483fc89fe6e47ee1f2c53f18ad1e4'
assert hashlib.sha256(modelpath.read_bytes()).hexdigest()==expected,'Model checksum mismatch'
torch.set_num_threads(4);torch.manual_seed(20260929)
device='mps' if torch.backends.mps.is_available() else 'cpu'
model=KModel(repo_id=x['repo'],config=str(folder/'config.json'),model=str(modelpath),disable_complex=True).to(device).eval()
pipeline=KPipeline(lang_code=a.preset[0],repo_id=x['repo'],model=model)
with torch.inference_mode():chunks=[r.audio.cpu().numpy() for r in pipeline(a.text,voice=str(voice),speed=a.speed)]
out.parent.mkdir(parents=True,exist_ok=True);sf.write(out,np.concatenate(chunks),24000,subtype='PCM_16');print(out)
