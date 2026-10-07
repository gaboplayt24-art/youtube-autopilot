#!/usr/bin/env bash
set -euo pipefail

if command -v ffmpeg >/dev/null && command -v ffprobe >/dev/null; then
  exit 0
fi

# Try cached indexes first; bound installation connections as well as update.
options=(-o Acquire::Retries=0 -o Acquire::http::Timeout=10 -o Acquire::https::Timeout=10 -o DPkg::Lock::Timeout=10 -o Acquire::Languages=none)
if sudo timeout --kill-after=5s 90s apt-get "${options[@]}" install --no-install-recommends -y ffmpeg; then
  command -v ffmpeg >/dev/null && command -v ffprobe >/dev/null
  exit 0
fi

# One bounded retry against signed official Ubuntu repositories. A slow Azure
# mirror or unrelated third-party index must not consume the entire job.
source /etc/os-release
[[ "${ID:-}" == ubuntu && "${VERSION_CODENAME:-}" =~ ^[a-z]+$ ]]
media_tmp=$(mktemp -d)
trap 'rm -rf "$media_tmp"' EXIT
mirror=https://archive.ubuntu.com/ubuntu
if [[ "$(dpkg --print-architecture)" == arm64 ]]; then
  mirror=https://ports.ubuntu.com/ubuntu-ports
fi
for suite in "$VERSION_CODENAME" "$VERSION_CODENAME-updates" "$VERSION_CODENAME-security"; do
  printf 'deb [signed-by=/usr/share/keyrings/ubuntu-archive-keyring.gpg] %s %s main universe\n' "$mirror" "$suite" >> "$media_tmp/ubuntu.list"
done
options+=(-o "Dir::Etc::sourcelist=$media_tmp/ubuntu.list" -o Dir::Etc::sourceparts=-)
sudo timeout --kill-after=5s 60s apt-get "${options[@]}" update
sudo timeout --kill-after=5s 120s apt-get "${options[@]}" install --no-install-recommends -y ffmpeg
command -v ffmpeg >/dev/null && command -v ffprobe >/dev/null
