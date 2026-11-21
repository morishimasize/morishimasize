#!/usr/bin/env python3
"""Safely pull this app's public GitHub main into its local folder.
No credentials, pushes, parent Git operations, or forced overwrites.
"""
from __future__ import annotations
import argparse
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request

REPO = 'morishimasize/morishimasize'
INITIAL_BASE = '55561686074ecba606a8ed936b99661680117159'
API = f'https://api.github.com/repos/{REPO}'
ROOT = Path(__file__).resolve().parents[1]
DATA = '.sync-data'


def blob_hash(content: bytes | None) -> str | None:
    if content is None:
        return None
    return hashlib.sha1(b'blob ' + str(len(content)).encode() + b'\0' + content).hexdigest()


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={'User-Agent': 'Hissan-Notebook-Sync/1', 'Accept': 'application/vnd.github+json'})
    with urllib.request.urlopen(req, timeout=45) as response:
        return response.read()


def snapshot(ref: str = 'main') -> dict:
    if ref == 'main':
        commit = json.loads(fetch(API + '/branches/main'))['commit']
        commit_sha, tree_sha = commit['sha'], commit['commit']['tree']['sha']
    else:
        commit = json.loads(fetch(API + '/git/commits/' + ref))
        commit_sha, tree_sha = commit['sha'], commit['tree']['sha']
    tree = json.loads(fetch(API + '/git/trees/' + tree_sha + '?recursive=1'))
    if tree.get('truncated'):
        raise RuntimeError('GitHubのファイル一覧が途中で切れています。同期を中止しました。')
    files = {x['path']: {'sha': x['sha'], 'mode': x['mode']} for x in tree['tree'] if x['type'] == 'blob'}
    return {'commit': commit_sha, 'files': files}


def remote_bytes(commit: str, name: str) -> bytes:
    return fetch(f'https://raw.githubusercontent.com/{REPO}/{commit}/' + urllib.parse.quote(name, safe='/'))


def safe_path(root: Path, name: str) -> Path:
    p = PurePosixPath(name)
    if p.is_absolute() or not p.parts or any(x in ('..', '.', '.git', DATA) for x in p.parts) or '\\' in name:
        raise RuntimeError(f'安全に扱えないパスです: {name}')
    dest = root.joinpath(*p.parts)
    for part in [dest, *dest.parents]:
        if part == root:
            break
        if part.is_symlink():
            raise RuntimeError(f'シンボリックリンクがあるため同期しません: {name}')
    if not dest.resolve().is_relative_to(root.resolve()):
        raise RuntimeError(f'フォルダの外を示すパスです: {name}')
    return dest


def atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix='hissan-sync-', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as f:
            f.write(content)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def entry_sha(item) -> str | None:
    return item.get('sha') if isinstance(item, dict) else item


def action(base: str | None, local: str | None, remote: str | None) -> str:
    if local == remote:
        return 'same'
    if remote == base:
        return 'local'
    if local == base:
        return 'delete' if remote is None else 'download'
    return 'merge'


def merge_text(local: bytes, base: bytes, remote: bytes) -> bytes | None:
    try:
        for content in [local, base, remote]:
            if b'\0' in content:
                return None
            content.decode('utf-8')
    except UnicodeDecodeError:
        return None
    git = shutil.which('git')
    if not git:
        return None
    with tempfile.TemporaryDirectory(prefix='hissan-merge-') as d:
        paths = [Path(d) / n for n in ['local', 'base', 'remote']]
        for p, b in zip(paths, [local, base, remote]):
            p.write_bytes(b)
        p = subprocess.run([git, 'merge-file', '-p', str(paths[0]), str(paths[1]), str(paths[2])], capture_output=True, timeout=20)
        return p.stdout if p.returncode == 0 else None


def sync(root: Path, state: dict, latest: dict, reader=remote_bytes, check=False) -> dict:
    stamp = dt.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    backup = root / DATA / 'backups' / stamp
    conflicts = root / DATA / 'conflicts' / stamp
    report = {'commit': latest['commit'], 'updated': [], 'merged': [], 'deleted_to_backup': [], 'local_changes': [], 'conflicts': [], 'check_only': check}
    new_files = dict(latest['files'])
    # An unresolved file keeps its old merge base for the next run.
    next_state = {'commit': latest['commit'], 'files': new_files, 'bases': dict(state.get('bases', {}))}
    old_files = state.get('files', {})
    names = sorted(set(old_files) | set(latest['files']))
    for name in names:
        try:
            dest = safe_path(root, name)
            old_entry, new_entry = old_files.get(name), latest['files'].get(name)
            if new_entry and new_entry.get('mode', '100644') not in ('100644', '100755'):
                raise RuntimeError('通常のファイルではありません')
            if dest.exists() and not dest.is_file():
                raise RuntimeError('同じ名前のフォルダがあります')
            local = dest.read_bytes() if dest.exists() else None
            base_sha, remote_sha = entry_sha(old_entry), entry_sha(new_entry)
            how = action(base_sha, blob_hash(local), remote_sha)
            if how == 'same':
                next_state['bases'].pop(name, None)
                continue
            if how == 'local':
                report['local_changes'].append(name)
                continue
            remote = reader(latest['commit'], name) if remote_sha else None
            if remote_sha and blob_hash(remote) != remote_sha:
                raise RuntimeError('ダウンロードした内容がGitHubのハッシュと一致しません')
            merged = None
            if how == 'merge' and local is not None and remote is not None and base_sha:
                base_commit = state.get('bases', {}).get(name, state['commit'])
                base = reader(base_commit, name)
                if blob_hash(base) != base_sha:
                    raise RuntimeError('統合の基準ファイルを確認できません')
                merged = merge_text(local, base, remote)
            if how == 'merge' and merged is None:
                report['conflicts'].append(name)
                if old_entry:
                    next_state['files'][name] = old_entry
                    next_state['bases'][name] = state.get('bases', {}).get(name, state['commit'])
                else:
                    next_state['files'].pop(name, None)
                if not check:
                    if local is not None:
                        atomic_write(conflicts / 'PC' / name, local)
                    if remote is not None:
                        atomic_write(conflicts / 'GitHub' / name, remote)
                    else:
                        atomic_write(conflicts / 'GitHub' / (name + '.deleted.txt'), b'Deleted on GitHub\n')
                continue
            if how == 'delete':
                report['deleted_to_backup'].append(name)
                if not check and local is not None:
                    atomic_write(backup / name, local)
                    dest.unlink()
            else:
                content = merged if how == 'merge' else remote
                report['merged' if how == 'merge' else 'updated'].append(name)
                if not check:
                    if local is not None:
                        atomic_write(backup / name, local)
                    old_mode = dest.stat().st_mode & 0o777 if dest.exists() else None
                    atomic_write(dest, content)
                    mode = 0o755 if new_entry.get('mode') == '100755' else (old_mode if old_mode is not None else 0o644)
                    dest.chmod(mode)
            next_state['bases'].pop(name, None)
        except (OSError, RuntimeError, urllib.error.URLError, subprocess.TimeoutExpired) as exc:
            report['conflicts'].append(name)
            report.setdefault('errors', {})[name] = str(exc)
            if name in old_files:
                next_state['files'][name] = old_files[name]
                next_state['bases'][name] = state.get('bases', {}).get(name, state['commit'])
            else:
                next_state['files'].pop(name, None)
    report['backup_directory'] = str(backup)
    report['conflict_directory'] = str(conflicts)
    if not check:
        atomic_write(root / DATA / 'state.json', json.dumps(next_state, ensure_ascii=False, indent=2).encode())
        atomic_write(root / DATA / 'last-report.json', json.dumps(report, ensure_ascii=False, indent=2).encode())
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description='ひっさんノートのGitHub→PC安全同期')
    parser.add_argument('--check', action='store_true', help='変更せず差分だけ確認')
    parser.add_argument('--initialize-snapshot', type=Path, help='接続済みGitHubツールで確認した一覧を基準として保存')
    args = parser.parse_args()
    data = ROOT / DATA
    data.mkdir(exist_ok=True)
    with (data / 'sync.lock').open('a+') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            print('ほかの同期が動いています。終了してからもう一度実行してください。')
            return 2
        state_file = data / 'state.json'
        if args.initialize_snapshot:
            if state_file.exists():
                print('同期の基準はすでにあります。既存の記録は変更しません。')
                return 2
            state = json.loads(args.initialize_snapshot.read_text())
            if not state.get('commit') or not isinstance(state.get('files'), dict):
                raise RuntimeError('基準ファイルの形式が正しくありません')
            for name in state['files']:
                safe_path(ROOT, name)
            atomic_write(state_file, json.dumps(state, ensure_ascii=False, indent=2).encode())
            print('GitHubの確認済みコミットを同期の基準として保存しました。')
            return 0
        state = json.loads(state_file.read_text()) if state_file.exists() else snapshot(INITIAL_BASE)
        latest = snapshot()
        report = sync(ROOT, state, latest, check=args.check)
        print(('差分確認のみ' if args.check else '同期結果') + f"：GitHub main {report['commit'][:10]}")
        print(f"更新 {len(report['updated'])}件 / 自動統合 {len(report['merged'])}件 / 削除をバックアップへ移動 {len(report['deleted_to_backup'])}件")
        print(f"PCだけの変更 {len(report['local_changes'])}件 / 要確認 {len(report['conflicts'])}件")
        if report['conflicts']:
            print('要確認のファイルは上書きしていません。PC版とGitHub版を残しています。')
            print(report['conflict_directory'])
            for name in report['conflicts']:
                print(' - ' + name)
            return 2
        if report['local_changes'] or report['merged']:
            print('PC側の変更のGitHubへの反映は、ChatGPT/Codexへ依頼してください。このツールから送信はしません。')
        if not args.check:
            print('変更前のファイルの保存先：' + report['backup_directory'])
        return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, ValueError, KeyError, RuntimeError, urllib.error.URLError) as exc:
        print('同期を完了できませんでした：' + str(exc), file=sys.stderr)
        print('ローカルのファイルは無理に上書きしません。接続と設定を確認してください。', file=sys.stderr)
        raise SystemExit(1)
