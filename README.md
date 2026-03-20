# GitHub Titled Link

GitHubのURL（プライベートリポジトリ含む）からタイトル付きリンクを生成し、クリップボードにコピーするChrome拡張機能。

Google DocsにGitHubのプライベートリポジトリURLを貼り付けても、Googleサーバーがアクセスできないためタイトル置換が提案されない問題を解決します。ブラウザの既存GitHub認証（Cookie）を利用してページタイトルを取得します。

## 使い方

1. GitHubにログインした状態でブラウザの拡張アイコンをクリック
2. クリップボードにGitHub URLがあれば自動検出してタイトルを取得
3. 手動でURLを入力して「取得」ボタンを押すことも可能
4. 「リンクとしてコピー」→ Google Docsに貼り付けるとハイパーリンクになる
5. 「Markdownでコピー」→ `[title](url)` 形式でコピー

## タイトルのクリーニング

| GitHubの`<title>` | 変換結果 |
|---|---|
| `GitHub - owner/repo: description` | `owner/repo: description` |
| `Fix bug · Issue #123 · owner/repo` | `Fix bug (owner/repo#123)` |
| `Add feature · Pull Request #456 · owner/repo` | `Add feature (owner/repo#456)` |
| `repo/src/main.ts at main · owner/repo` | `src/main.ts (owner/repo@main)` |

タイトル取得に失敗した場合は、URLからタイトルを生成するフォールバックが動作します（例: `owner/repo#123`）。

## インストール

1. このリポジトリをclone
2. Chromeで `chrome://extensions` を開く
3. 「デベロッパーモード」を有効化
4. 「パッケージ化されていない拡張機能を読み込む」→ cloneしたフォルダを選択

## 必要な権限

| 権限 | 理由 |
|---|---|
| `cookies` (github.com) | GitHubの認証Cookieを使ってプライベートリポジトリにアクセス |
| `clipboardWrite` / `clipboardRead` | URLの自動検出とリンクのコピー |
| `host_permissions` (github.com) | GitHubページのfetch |
