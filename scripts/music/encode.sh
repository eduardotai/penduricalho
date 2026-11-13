#!/usr/bin/env sh
# Encode the composed WAVs to streamable OGG Vorbis + MP3 (needs ffmpeg).
set -e
cd "$(dirname "$0")/../../public/music"
for f in *.wav; do
  n="${f%.wav}"
  ffmpeg -loglevel error -y -i "$f" -c:a libvorbis -q:a 2 "$n.ogg"
  ffmpeg -loglevel error -y -i "$f" -c:a libmp3lame -b:a 96k "$n.mp3"
done
rm -f *.wav
ls -la
