#!/bin/bash
# Rebuild packages + restart dev-server
# Usage: ./rebuild.sh [--front]

set -e

echo "==> Building packages..."
npx turbo build --filter=@enlocal/core-db --filter=@enlocal/core-server --filter=@enlocal/mod-invoicing --filter=@enlocal/mod-payables --filter=@enlocal/mod-quotes --force 2>&1 | tail -5

if [[ "$1" == "--front" ]]; then
  echo "==> Building frontend..."
  npx vite build apps/caja/webapp 2>&1 | tail -3
fi

echo "==> Restarting dev-server..."
kill $(lsof -t -i :9005) 2>/dev/null || true
sleep 1
nohup npx tsx apps/caja/dev-server.ts > /tmp/dev-server.log 2>&1 &
sleep 3
tail -3 /tmp/dev-server.log

echo "==> Done!"
