#!/bin/bash
f="$1"; base=$(basename "$f"); out=/tmp/ld-audio/mp3; mkdir -p "$out"
MONO="aformat=channel_layouts=mono"
eb=$(ffmpeg -hide_banner -nostats -i "$f" -af "$MONO,ebur128=peak=true" -f null - 2>&1 | sed -n '/Integrated loudness/,$p')
I=$(echo "$eb" | grep -m1 -E "^\s+I:" | awk '{print $2}')
SP=$(ffmpeg -hide_banner -nostats -i "$f" -af "$MONO,astats=measure_perchannel=none:measure_overall=Peak_level+Noise_floor" -f null - 2>&1 | grep -m1 "Peak level dB" | awk '{print $NF}')
NF=$(ffmpeg -hide_banner -nostats -i "$f" -af "$MONO,astats=measure_perchannel=none:measure_overall=Noise_floor" -f null - 2>&1 | grep -m1 "Noise floor dB" | awk '{print $NF}')
read G T < <(python3 -c "
def n(s,d):
    try:
        v=float(s); return d if v!=v or v in (float('inf'),float('-inf')) else v
    except Exception: return d
I=n('$I',-20.); SP=n('$SP',-1.); NF=n('$NF',-70.)
print(round(min(-16.-I, -1.-SP),2), round(max(-70.,min(-30.,min(NF+6., I-20.))),1))")
CH="$MONO,volume=${G}dB,silenceremove=start_periods=1:start_duration=0:start_threshold=${T}dB:start_silence=0.08:detection=rms,areverse,silenceremove=start_periods=1:start_duration=0:start_threshold=${T}dB:start_silence=0.12:detection=rms,areverse"
e(){ ffmpeg -v error -y -i "$f" -af "$CH" $2 "$out/${base}__$1.mp3" 2>/dev/null; }
e m48_32k  "-c:a libmp3lame -b:a 48k -ar 32000"
e m56_32k  "-c:a libmp3lame -b:a 56k -ar 32000"
e m64_32k  "-c:a libmp3lame -b:a 64k -ar 32000"
e m64_44k  "-c:a libmp3lame -b:a 64k -ar 44100"
e m80_44k  "-c:a libmp3lame -b:a 80k -ar 44100"
e mV6_32k  "-c:a libmp3lame -q:a 6 -ar 32000"
e mV7_32k  "-c:a libmp3lame -q:a 7 -ar 32000"
e mV5_44k  "-c:a libmp3lame -q:a 5 -ar 44100"
printf "%s\t%s\t%s\t%s\t%s\t%s\n" "$base" "$I" "$SP" "$NF" "$G" "$T"
