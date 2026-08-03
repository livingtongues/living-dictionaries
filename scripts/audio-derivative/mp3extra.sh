#!/bin/bash
f="$1"; base=$(basename "$f"); out=/tmp/ld-audio/mp3
MONO="aformat=channel_layouts=mono"
eb=$(ffmpeg -hide_banner -nostats -i "$f" -af "$MONO,ebur128=peak=true" -f null - 2>&1 | sed -n '/Integrated loudness/,$p')
I=$(echo "$eb" | grep -m1 -E "^\s+I:" | awk '{print $2}')
SP=$(ffmpeg -hide_banner -nostats -i "$f" -af "$MONO,astats=measure_perchannel=none:measure_overall=Peak_level" -f null - 2>&1 | grep -m1 "Peak level dB" | awk '{print $NF}')
NF=$(ffmpeg -hide_banner -nostats -i "$f" -af "$MONO,astats=measure_perchannel=none:measure_overall=Noise_floor" -f null - 2>&1 | grep -m1 "Noise floor dB" | awk '{print $NF}')
read G T FG < <(python3 -c "
def n(s,d):
    try:
        v=float(s); return d if v!=v or v in (float('inf'),float('-inf')) else v
    except Exception: return d
I=n('$I',-20.); SP=n('$SP',-1.); NF=n('$NF',-70.)
print(round(min(-16.-I, -1.-SP),2), round(max(-70.,min(-30.,min(NF+6., I-20.))),1), round(-16.-I,2))")
TRIM="silenceremove=start_periods=1:start_duration=0:start_threshold=${T}dB:start_silence=0.08:detection=rms,areverse,silenceremove=start_periods=1:start_duration=0:start_threshold=${T}dB:start_silence=0.12:detection=rms,areverse"
V6="-c:a libmp3lame -q:a 6 -ar 32000"
ffmpeg -v error -y -i "$f" -af "$MONO" $V6 "$out/${base}__mV6_noproc.mp3" 2>/dev/null
ffmpeg -v error -y -i "$f" -af "$MONO,volume=${FG}dB,alimiter=limit=0.891:level=disabled:attack=1:release=10,$TRIM" $V6 "$out/${base}__mV6_limited.mp3" 2>/dev/null
