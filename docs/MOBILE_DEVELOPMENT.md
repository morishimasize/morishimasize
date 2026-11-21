# スマホから筆算アプリの開発を続ける

## このプロジェクトの情報

- GitHub： https://github.com/morishimasize/morishimasize
- ブランチ：`main`
- 最新の作業内容：ルートの `DEVELOPMENT_STATUS.md`
- 作業ルール：ルートの `AGENTS.md`
- 公開アプリ： https://morishimasize.github.io/morishimasize/
- 手書きノートとゲーム： https://morishimasize.github.io/morishimasize/prototypes/full-notebook.html

## PCの電源に依存しない方法：Codex Cloud

OpenAIの案内では、デスクトップまたはWebで開発環境を作成・公開した後、スマホからその環境を選んでコーディングを開始・継続できます。画面名や利用可否はアプリの版・アカウントの設定によって異なる場合があります。

1. PCまたはWebのCodexで、Cloudの環境作成画面を開きます。
2. 同じChatGPTアカウントでGitHubを接続し、`morishimasize/morishimasize` を対象にします。
3. 環境を作成して公開します。アプリはHTML・CSS・JavaScriptのみなので、開発のためのAPIキーは不要です。必要に応じ、環境に入っているブラウザやNodeで表示・JavaScriptの確認を行います。
4. スマホのChatGPTアプリでCodex Cloudを開き、用意した環境を選びます。
5. 下の再開文を貼り付けて依頼します。
6. スマホのSafari等で試作の公開URLを開き、使い心地を確認します。

この文書を保存しただけでは、Codex Cloud環境の作成・公開やスマホの接続は完了していません。今回の作業から環境そのものは作成していません。

## 今のPC上の作業をスマホから操作する方法：Remote

対応するデスクトップのCodexチャットは、ChatGPTモバイルアプリのRemoteタブからアクセスする別の方法もあります。PC側の接続設定が必要です。クラウドの環境と、PC上のフォルダは別の実行場所です。Remoteの有効化・端末のペアリングはこの作業では実施していません。

通常のスマホのチャットを開くだけで、Macのローカルフォルダへ直接アクセスできるわけではありません。ローカルの履歴がCodex Cloudに自動で移るわけでもありません。最新のコードはGitHub、再開に必要な情報は `AGENTS.md` と `DEVELOPMENT_STATUS.md` を基準にします。

## スマホで貼り付ける再開文

```text
「ひっさんノート」の開発を続けてください。
GitHub: morishimasize/morishimasize、ブランチ main。
最初にAGENTS.md、DEVELOPMENT_STATUS.md、README.mdを読んで、mainの最新状態を確認してください。
正式な開始画面は index.html、電卓は calculator.html、手書きノートとゲームは prototypes/full-notebook.html です。
ゲームの既存の保存データを引き継ぎ、3つの入口と「はじめに」の操作を維持してください。
修正内容を確認し、GitHubに反映して、スマホから触れる公開URLを教えてください。
今回お願いしたい変更：
（ここに希望を書く）
```

## 帰宅後にPCへ戻るとき

「GitHubのmainの変更を確認し、ローカルの未保存・未コミット変更を残して取り込んで」と依頼してください。今のMacのフォルダは上位の別プロジェクトのGit配下にあるため、上位フォルダに対して `git add .` や `git add -A` を行わないルールを守ります。

同じファイルをPCとCloudで同時に修正する場合は、片方の作業を区切り、GitHubの最新コミットを確認してからもう片方で続けてください。force pushや他方の変更の破棄はしません。

公式案内：
- https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex
- https://learn.chatgpt.com/docs/mobile
- https://learn.chatgpt.com/docs/environments/cloud-environments

## PCへ戻ったときの安全同期

このアプリのフォルダにある **`sync-local.command` をダブルクリック**すると、GitHubのmainの変更をこのフォルダへ取り込みます。Terminalが開き、結果を表示します。最後にEnterを押すと終了します。実行できない場合は、ChatGPT/Codexへ「同期ツールを実行して」と依頼してください。

- Python 3.10以上を使用します。このPCではPython 3が利用できます。
- この公開リポジトリのダウンロードにGitHubのログインやAPIキーは不要です。
- PCにしかない変更は残します。同じテキストの別の場所を変更している場合は、Gitで3方向の統合を試みます。
- 同じ箇所を両方で変更した場合や、画像などを両方で変更した場合は上書きしません。`.sync-data/conflicts/` にPC版とGitHub版を残し、対象ファイル名を表示します。ChatGPT/Codexへ統合を依頼してください。
- 更新前の内容は `.sync-data/backups/` に残します。GitHubで削除されたファイルも、PC側が未変更ならバックアップしてから取り除きます。
- 上位フォルダのGitには触れません。ほかのアプリには影響しません。
- 差分を見るだけなら `python3 tools/sync-local.py --check`、取り込みは `python3 tools/sync-local.py` です。
- 初回はツール作成時のコミットを基準に差分を確認し、その後は最後の同期記録を基準にします。未解決の競合は古い基準を保持します。途中でGitHubが進んでも、取得したコミットに固定して内容を検証します。
- PCからGitHubへの反映は、今までどおりこのプロジェクトのエージェントへ依頼します。同期ツール自体から送信することはありません。

つまり、**スマホで変更→GitHubへ反映→PCで同期→PCで続きを開発→エージェントがGitHubへ反映**という流れです。PCの電源を入れただけで動く常駐同期は設定していません。PC上でエージェントが作業を始めるときに取り込むルールと、手動のワンクリック同期を用意しています。

同期の検証では、クラウドの更新、PCだけの変更、別の箇所の自動統合、競合時の双方の保存、削除のバックアップ、差分確認のみ、危険なパスやシンボリックリンクの拒否など42項目をローカルの模擬データで確認しています。実ネットワークでのダウンロードは実行環境のネットワーク制限により未確認です。

### 今回Webで確認できた表示

WebのCodexの入力欄で「実行場所」を開くと「クラウド デフォルト環境」が選べることは確認できました。すでにこの環境がある場合は、まず上の再開文でGitHubリポジトリを指定して開始する方法があります。専用環境を新しく作る必要がある場合は、作成・公開してからスマホで選びます。今回、新しいクラウド作業は開始しておらず、スマホからの実際の起動・Remoteのペアリングも行っていません。
