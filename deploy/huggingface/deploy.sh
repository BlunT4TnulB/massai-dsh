#!/bin/sh
# Publish this Space from the repository. Usage:
#   HF_TOKEN=hf_xxx sh deploy/huggingface/deploy.sh <hf-username> [space-name]
set -eu
[ -n "${HF_TOKEN:-}" ] || { echo "HF_TOKEN is required"; exit 2; }
USER="${1:?usage: deploy.sh <hf-username> [space-name]}"
SPACE="${2:-massai}"
REMOTE="https://${USER}:${HF_TOKEN}@huggingface.co/spaces/${USER}/${SPACE}"
WORK="$(mktemp -d)"
echo "creating space ${USER}/${SPACE} if it does not exist"
curl -sS -X POST "https://huggingface.co/api/repos/create" \
  -H "Authorization: Bearer ${HF_TOKEN}" -H 'Content-Type: application/json' \
  -d "{\"type\":\"space\",\"name\":\"${SPACE}\",\"sdk\":\"docker\",\"private\":false}" >/dev/null || true
git clone --depth 1 "${REMOTE}" "${WORK}" 2>/dev/null || {
  mkdir -p "${WORK}"; git -C "${WORK}" init -q; git -C "${WORK}" remote add origin "${REMOTE}"
}
cp deploy/huggingface/README.md "${WORK}/README.md"
cp deploy/huggingface/Dockerfile "${WORK}/Dockerfile"
git -C "${WORK}" add -A
git -C "${WORK}" -c user.name="Massai" -c user.email="dev@massai-itu.ca" commit -q -m "Massai Space: image pin $(date -u +%Y-%m-%dT%H:%M:%SZ)" || true
git -C "${WORK}" push origin HEAD:main 2>/dev/null || git -C "${WORK}" push origin HEAD:master
echo "pushed. Space URL: https://huggingface.co/spaces/${USER}/${SPACE}"
