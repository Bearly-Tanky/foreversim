#!/usr/bin/env bash
# shots.sh <out-prefix> <wait-ms> <state-json>... : one screenshot per state, side by side in <out-prefix>.png
set -u
here="$(dirname "$0")"
out="$1"; wait="$2"; shift 2
i=0
for state in "$@"; do
	node "$here/shot.mjs" "http://127.0.0.1:8090/" "$out-$i.png" "$state" "$wait" "" 640 600 2>&1 | grep -v "^saved" | tail -5 &
	i=$((i + 1))
done
wait
python3 -c "
import sys
from PIL import Image
n=int(sys.argv[2]); ims=[Image.open('%s-%d.png'%(sys.argv[1],i)).crop((320,0,640,600)) for i in range(n)]
out=Image.new('RGB',(320*n,600))
for k,im in enumerate(ims): out.paste(im,(320*k,0))
out.save(sys.argv[1]+'.png')" "$out" "$i"
