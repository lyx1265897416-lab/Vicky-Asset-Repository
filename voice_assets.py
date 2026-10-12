"""Confirmed audio is kept separate from image generation and character-image slots."""
from pathlib import Path
import json, hashlib
from voice_loudness import normalize_voice, POLICY

def attach_voices(manifest, root):
    root=Path(root); catalog=root/'voice-library.json'
    if not catalog.exists():
        manifest['voices']=[]
        return manifest
    voices=[normalize_voice(v,root) for v in json.loads(catalog.read_text())['voices']]
    ids=set()
    for voice in voices:
        if voice['id'] in ids:raise ValueError('Duplicate voice ID')
        ids.add(voice['id'])
        path=root/voice['path']
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest()!=voice['sha256']:
            raise ValueError('Audio missing or changed: '+voice['path'])
        if voice['status'] not in ('confirmed','generated') or voice['duration_seconds']<=0:raise ValueError('Invalid voice')
        for evidence in [voice['confirmation_evidence'],*voice['source_records']]:
            if not (root/evidence).is_file():raise ValueError('Missing voice provenance: '+evidence)
        record=Path('metadata/voices')/(voice['id']+'.txt')
        target=root/record;target.parent.mkdir(parents=True,exist_ok=True)
        target.write_text('\n'.join([voice['name'],'项目：'+voice['project'],'角色：'+voice['character'],
            '年龄设计：'+voice.get('age_range','未标注'),'身份用途：'+voice.get('role_group','剧集角色'),'音色标签：'+voice.get('timbre','详见声音描述'),'模型：'+voice['model'],'入库依据：'+voice['confirmation']['note'],'原始样音：'+voice['source'],
            '试听/下载文件SHA256：'+voice['sha256'],'原始音频（保留）：'+voice['original_audio']['path'],'原始SHA256：'+voice['original_audio']['sha256'],'响度标准：−18 LUFS；真实峰值不超过−1.5 dBTP','实测响度：'+str(voice['normalization']['measured_lufs'])+' LUFS；真实峰值：'+str(voice['normalization']['true_peak_dbtp'])+' dBTP','响度处理记录：'+voice['normalization']['record'],'去除开头等待：'+str(voice['onset_cleanup']['removed_seconds'])+'秒；处理后有效声音起点：'+str(voice['onset_cleanup']['signal_onset_seconds'])+'秒','当前试听时长：'+str(round(voice['duration_seconds'],3))+'秒','','试听台词：',voice['text'],'','声音描述：',voice['direction'],
            '','自动台词检查：',voice.get('transcript_note','见来源记录'),voice.get('observed_transcript',''),'','已有生成参数：',json.dumps(voice['parameters'],ensure_ascii=False,indent=2),
            '',('原创设计音色，标签为选角方向。' if voice['status']=='generated' else '原始音频保留。')+'试听与下载使用统一响度版本，不改变音高或语速。'+('现成音色请使用相同模型版本与预设 ID 复用。' if voice.get('preset_id') else '参考驱动声线需保留原参考；文字描述不保证精确复现。'),
            '商用许可与复用信息：',json.dumps({k:voice[k] for k in ['preset_id','provider','official_url','commercial_license','reuse_note','quality_note'] if k in voice},ensure_ascii=False,indent=2),'确认记录：'+voice['confirmation_evidence'],*voice['source_records']]),encoding='utf-8-sig')
        voice['record_download']=record.as_posix()
    manifest['voices']=voices
    manifest['voice_count']=len(voices)
    manifest['voice_loudness_policy']=POLICY
    return manifest
