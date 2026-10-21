#!/usr/bin/env bash
# Put the latest version from GitHub online: run on the server, from the project folder
set -euo pipefail

cd "$(dirname "$0")/.."
git pull
.venv/bin/pip install -q -r requirements-prod.txt
sudo systemctl restart datakick
echo "Data-Kick updated and restarted. Logs: journalctl -u datakick -f"
