#!/bin/zsh
# Run in Terminal so closing a Codex task cannot stop the server.
cd -- "${0:A:h}" || exit 1
if /usr/bin/curl --silent --fail --max-time 3 http://127.0.0.1:8768/api/library-state >/dev/null; then
  /usr/bin/open http://127.0.0.1:8768/
  exit 0
fi
print 'Vicky 资产库：http://127.0.0.1:8768/'
print '服务在此独立终端运行。请保留窗口；按 Ctrl+C 停止。'
trap 'exit 0' INT TERM
(
  for attempt in {1..30}; do
    if /usr/bin/curl --silent --fail --max-time 1 http://127.0.0.1:8768/api/library-state >/dev/null; then
      /usr/bin/open http://127.0.0.1:8768/
      exit 0
    fi
    sleep 1
  done
) &
while true; do
  /usr/bin/python3 -u serve_gallery.py --port 8768
  print '服务已退出，5 秒后重试。按 Ctrl+C 停止。'
  sleep 5
  if /usr/bin/curl --silent --fail --max-time 3 http://127.0.0.1:8768/api/library-state >/dev/null; then
    exit 0
  fi
done
