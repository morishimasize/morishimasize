# スマホから筆算アプリの開発を続ける

## このプロジェクトの情報

- GitHub： https://github.com/morishimasize/morishimasize
- ブランチ：`main`
- 最新の作業内容：ルートの `DEVELOPMENT_STATUS.md`
- 作業ルール：ルートの `AGENTS.md`
- 公開アプリ： https://morishimasize.github.io/morishimasize/
- 筆算を全部手書きする試作： https://morishimasize.github.io/morishimasize/prototypes/full-notebook.html

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
筆算を全部手書きする試作は prototypes/full-notebook.html です。
本体 index.html への組み込みは、私が頼むまで行わないでください。
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
