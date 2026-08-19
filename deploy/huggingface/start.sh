#!/bin/sh
set -eu

node /app/backend/dist/server.js &
backend_pid=$!

cleanup() {
  kill "$backend_pid" 2>/dev/null || true
}
trap cleanup INT TERM EXIT

exec nginx -g 'daemon off;'
