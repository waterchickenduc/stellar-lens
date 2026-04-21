#!/usr/bin/env bash
set -e

podman-compose down || true
podman-compose build --no-cache
podman-compose up -d

echo "Hit [CTRL] + [SHIFT] +[R] in the browser to reload"