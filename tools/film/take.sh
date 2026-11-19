#!/bin/zsh
# take.sh <clip dir> [wide|tall|draft]   shoot <clip dir>/shot.json in one format, encode it and make a contact sheet of six frames. draft: 960x540, for trying a move.
D=$1; V=${2:-draft}; M=${0:A:h:h:h}
case $V in wide) W=1920; H=1080;; tall) W=1080; H=1920;; *) W=960; H=540;; esac
python3 -I -c "import json,sys; s=json.load(open('$D/shot.json')); s['size']=$W; s['height']=$H; json.dump(s, open('$D/.shot-$V.json','w'))"
rm -rf $D/frames-$V; $M/tools/release/withbrowser.sh node $M/tools/film/shoot.mjs $D/frames-$V $D/.shot-$V.json 2>&1 | tail -1
n=$(ls $D/frames-$V | wc -l | tr -d ' '); [ $n -gt 0 ] || exit 1
ffmpeg -v error -y -framerate 60 -i $D/frames-$V/f_%05d.jpg -c:v libx264 -crf $([ $V = draft ] && echo 22 || echo 16) -preset medium -pix_fmt yuv420p -movflags +faststart $D/$(basename $D)-$V.mp4 </dev/null
tw=$([ $V = tall ] && echo 300 || echo 640); tl=$([ $V = tall ] && echo 6x1 || echo 3x2); ffmpeg -v error -y -framerate 60 -i $D/frames-$V/f_%05d.jpg -vf "select='not(mod(n\,$((n / 6))))',scale=$tw:-1,tile=$tl" -frames:v 1 $D/sheet-$V.jpg </dev/null
rm -rf $D/frames-$V; echo "$D/sheet-$V.jpg"
