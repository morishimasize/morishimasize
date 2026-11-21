#!/bin/zsh
# このアプリのフォルダだけを同期する。上位のGitには触れない。
APP_DIR="${0:A:h}"
cd "$APP_DIR" || exit 1
if ! command -v python3 >/dev/null 2>&1; then
  print 'Python 3 が見つかりません。ChatGPT/Codexに相談してください。'
  read 'reply?Enterで閉じます。'
  exit 1
fi
python3 "$APP_DIR/tools/sync-local.py" "$@"
SYNC_RESULT=$?
print ''
read 'reply?Enterで閉じます。'
exit "$SYNC_RESULT"
