import os, json, base64, collections, subprocess
ORIG='/tmp/ld-audio/orig'; OUT='/tmp/ld-audio/mp3'
CDN='https://media.livingdictionaries.app/'
INLINE=['mV6_noproc','m48_32k','mV7_32k','mV6_32k','m64_44k','m80_44k','mV6_limited','c3_opus32audio']
MIME={'opus':'audio/ogg','mp3':'audio/mpeg'}
LABEL={
 'mV6_noproc':('MP3 V6 — no processing','mono downmix + encode only. No loudness, no trim. This is the byte win alone.'),
 'm48_32k':('MP3 CBR 48k / 32 kHz','constant 48 kbps. 27× smaller.'),
 'mV7_32k':('MP3 VBR V7 / 32 kHz','variable ~40 kbps average. 33× smaller — the smallest MP3 worth considering.'),
 'mV6_32k':('★ MP3 VBR V6 / 32 kHz','variable ~45 kbps average. 29× smaller. RECOMMENDED: 30% fewer bytes than CBR 64k and bits follow the speech.'),
 'm64_44k':('MP3 CBR 64k / 44.1 kHz','what you picked in Q1. 20× smaller. The safe, boring baseline.'),
 'm80_44k':('MP3 CBR 80k / 44.1 kHz','16× smaller. The “is 64k enough?” control — if this sounds no better, 64k is not the limit.'),
 'mV6_limited':('MP3 V6 + LIMITER to −16','same as V6 but reaches −16 LUFS on every file using a true-peak limiter. Dynamics ARE processed. This is Q3 option B.'),
 'c3_opus32audio':('(reference) Opus 32k','not a candidate any more — here so you can hear what MP3-only costs. 12 KB vs 19 KB per word.'),
}
src_meta={}
for line in open('/tmp/ld-audio/mp3-meta.tsv'):
    b,I,SP,NF,G,T=line.rstrip('\n').split('\t'); src_meta[b]=dict(I=I,SP=SP,NF=NF,GAIN=G,THR=T)
out_meta=collections.defaultdict(dict)
for line in open('/tmp/ld-audio/mp3-out.tsv'):
    name,size,I,dur=line.rstrip('\n').split('\t')
    b,v=name.rsplit('__',1); out_meta[b][v.rsplit('.',1)[0]]=dict(size=int(size),I=I,dur=float(dur),file=name)
lex={(r['dict'],r['id']):r for r in json.load(open('/tmp/ld-audio/lexemes.json'))}
keys={}
for line in open('/tmp/audio-sample.tsv'):
    k=line.split('\t')[0]; keys[k.replace('/audio/','__').replace('/','_')]=k
def f1(v):
    try: return f'{float(v):.1f}'
    except: return '—'
rows=[]
for b in sorted(os.listdir(ORIG)):
    key=keys.get(b)
    if not key: continue
    dict_id,_,fid=key.split('/'); uuid=fid.rsplit('.',1)[0]
    info=lex.get((dict_id,uuid),{})
    lx=json.loads(info['lexeme']) if info.get('lexeme') else {}
    gl=json.loads(info['gloss']) if info.get('gloss') else {}
    lexeme=(lx.get('default') or next(iter(lx.values()),'—')) if lx else '—'
    gloss=(gl.get('en') or next(iter(gl.values()),'')) if gl else ''
    sm=src_meta.get(b,{})
    variants=[]
    for v in INLINE:
        om=out_meta[b].get(v)
        if not om: continue
        ext=om['file'].rsplit('.',1)[1]
        data=base64.b64encode(open(os.path.join(OUT,om['file']),'rb').read()).decode()
        variants.append(dict(id=v,size=om['size'],I=f1(om['I']),dur=round(om['dur'],2),src=f"data:{MIME[ext]};base64,{data}"))
    dur=float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',os.path.join(ORIG,b)],capture_output=True,text=True).stdout.strip())
    rows.append(dict(dict_id=dict_id,lexeme=lexeme,gloss=gloss,key=key,
        orig=dict(size=os.path.getsize(os.path.join(ORIG,b)),I=f1(sm.get('I')),tp=f1(sm.get('SP')),
                  lra='',gain=sm.get('GAIN'),thr=sm.get('THR'),dur=round(dur,2),src=CDN+key),
        variants=variants))
open('/tmp/ld-audio/payload2.json','w').write(json.dumps(dict(rows=rows,labels=LABEL,inline=INLINE),ensure_ascii=False))
print('rows',len(rows))
