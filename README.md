# timed-access-app

時限式アクセストークン管理アプリ。サイトごとに失効日時を設定してULIDを発行し、その時刻になるとトークンが自動で失効します。発行・検証はAPIが担い、デスクトップアプリからCRUD操作ができます。

## 構成

Deno Workspaceで3つのパッケージを管理しています。

| ディレクトリ | 役割                                                                |
| ------------ | ------------------------------------------------------------------- |
| `api/`       | トークンの発行・検証API（Hono + Deno KV + `@std/ulid`）             |
| `desktop/`   | CRUD用デスクトップアプリ（Hono + hono/jsx、`deno desktop`でビルド） |
| `shared/`    | 型と定数の共有パッケージ                                            |

- ULIDは `@std/ulid` で生成し、Deno KVの `expireIn`
  により失効日時ちょうどにレコードが自動削除されます
- トークンはサイト名（英小文字・数字・ハイフンのスラッグ）ごとに保存・検証されます
- 依存関係はすべてJSRから取得しています

## セットアップ

1. リポジトリ直下に `.env` を作成します

   ```dotenv
   # APIとデスクトップアプリで共有する認証キー
   TIMED_ACCESS_API_KEY=your-secret-key
   # デスクトップアプリが参照するAPIのURL（省略時 http://localhost:8000）
   API_BASE_URL=http://localhost:8000
   ```

2. 依存関係を取得します

   ```bash
   deno install
   ```

## 開発

```bash
deno task dev:api        # APIサーバーを http://localhost:8000 で起動
deno task dev:desktop    # デスクトップUIをブラウザ向けに http://localhost:8080 で起動
deno task desktop:window # デスクトップUIをwebviewウィンドウで起動（HMR付き）
```

テスト・チェック:

```bash
deno task test   # APIのユニットテスト
deno task check  # fmt --check / lint / type check
```

## デスクトップアプリのビルド

開発用の `.env` を使ってビルドします。

```bash
deno task desktop:build
```

`desktop/TimedAccess.app`（ダブルクリックで起動できる単一アプリ）が生成されます。
`.env` の `API_BASE_URL` と `TIMED_ACCESS_API_KEY`
がバイナリに焼き込まれ、起動時に
環境変数やAPIサーバーの手動起動は不要です（APIサーバー本体は別途 `API_BASE_URL`
の場所で稼働している必要があります）。

生成した `.app` を macOS の `/Applications`
へ移動するには（既存があれば置き換え）:

```bash
deno task desktop:install
```

### 本番ビルド

本番用の値は開発用と分けるため `.env.production` に置きます（Git管理外）。

```bash
cp .env .env.production   # 雛形としてコピー
# .env.production を編集し、API_BASE_URL を本番APIのURLに、
# TIMED_ACCESS_API_KEY を本番のキーに設定する
deno task desktop:build:prod
```

`--env-file=../.env.production` を読んでビルドするため、本番URL/キーを焼き込んだ
アプリが生成されます。

> [!IMPORTANT]
> `TIMED_ACCESS_API_KEY` はバイナリに焼き込まれ、`strings` 等で抽出できます。
> このバイナリは**公開・再配布しないでください**（自分専用に留める）。第三者に渡す
> 場合はキーを焼き込まず、起動時に与える方式へ変更する必要があります。

アプリ名・アイコン・出力パスは `desktop/deno.json` の `desktop`
ブロックで設定します（CLIフラグではなく設定ファイルに集約）。

```jsonc
"desktop": {
  "app": {
    "name": "TimedAccess", // ウィンドウタイトル/メニューバー名等
    "icons": { "macos": "icon.png", "windows": "icon.ico", "linux": "icon.png" }
  },
  "output": { "macos": "TimedAccess.app", "windows": "TimedAccess.exe" }
}
```

別プラットフォーム向けは `--target`（例 `x86_64-pc-windows-msvc`）を付けて
ビルドします。ターゲットに応じて上記の `icons` / `output` が自動で選ばれます。

### アイコン

`desktop/scripts/generate_icon.ts`
が時計モチーフのアイコンを手続き的に生成します。 1コマンドで macOS用
`desktop/icon.png`（1024px）と Windows用 `desktop/icon.ico`
（16〜256pxの複数サイズを内包）を同時に出力します。デザインを変えたいときは
スクリプトを編集して再生成してください。

```bash
deno task desktop:icon   # icon.png と icon.ico を再生成
```

どのアイコンを使うかは `desktop/deno.json` の `desktop.app.icons` （`macos` /
`windows` / `linux`）で設定済みです。ビルドターゲットに応じて
自動で選ばれるため、`--icon` をCLIで渡す必要はありません。

## API仕様

トークンの管理操作（`/tokens` 配下）は `x-api-key` ヘッダーに
`TIMED_ACCESS_API_KEY`
と同じ値が必要です。検証（`/verify`）は外部アプリからの利用を想定しているため、認証不要でCORS許可（`Access-Control-Allow-Origin: *`）です。

| メソッド | パス                | 認証 | 説明                                                                               |
| -------- | ------------------- | ---- | ---------------------------------------------------------------------------------- |
| `POST`   | `/tokens`           | 必要 | トークン発行。`{ "site": string, "name"?: string, "expiresAt": string(ISO 8601) }` |
| `GET`    | `/tokens`           | 必要 | 有効なトークンの一覧。`?site=` でサイト絞り込み                                    |
| `GET`    | `/tokens/:site/:id` | 必要 | トークンの取得（失効済みは404）                                                    |
| `PATCH`  | `/tokens/:site/:id` | 必要 | 表示名・失効日時の更新                                                             |
| `DELETE` | `/tokens/:site/:id` | 必要 | トークンの即時失効                                                                 |
| `GET`    | `/verify/:site/:id` | 不要 | トークン検証。`{ "valid": boolean, "token"?: TokenRecord }`                        |

`site` はトークンを使うサイトを区別するスラッグで、英小文字・数字・ハイフン
1〜64文字（`^[a-z0-9-]{1,64}$`）です。発行時に指定したサイト名と一致するパスで
のみ検証が通るため、同じAPIを複数サイトで使い分けられます。

### 外部アプリからの検証

デスクトップアプリで発行したULIDを外部アプリで検証し、コンテンツの出し分けなどに利用できます。APIキーは不要です。

```ts
const res = await fetch(
  `https://your-api.example.com/verify/${siteName}/${ulid}`,
);
const { valid } = await res.json();
if (valid) {
  // 有効期間内のみコンテンツを表示する
}
```

- 失効日時を過ぎたULIDや削除済みのULID、発行時と異なるサイト名での検証は
  `{ "valid": false }` になります
- レスポンスには `Cache-Control: no-store`
  が付き、判定結果はキャッシュされません
- 存在しないIDでも200で `{ "valid": false }`
  を返します（IDの存在有無を推測させないためではなく、クライアント実装を単純にするためです）

### レート制限

公開エンドポイントの `/verify` にはIPアドレスごとのレート制限（既定:
60回/分）があります。

- 制限内でもレスポンスに `RateLimit-Limit` / `RateLimit-Remaining` /
  `RateLimit-Reset`（秒）ヘッダーが付きます
- 超過すると `Retry-After` ヘッダー付きの429を返します
- 環境変数で調整できます
  - `VERIFY_RATE_LIMIT` … 1分あたりの許容リクエスト数（既定: 60）
  - `TRUST_PROXY` … リバースプロキシ配下で `x-forwarded-for`
    をクライアントIPとして信頼する段数。`true`（=1段）または正の整数を指定する。
    `x-forwarded-for`
    の値は各プロキシが右へ追記するため、末尾から段数ぶんさかのぼった
    IPを採用する（先頭側はクライアントが偽装できるため使わない）。直接公開時は設定しないでください
- カウントはプロセス内メモリ管理のため、再起動でリセットされ、複数インスタンス構成ではインスタンスごとに独立します

`TokenRecord` の形は次のとおりです。

```json
{
  "id": "01JZ0000000000000000000000",
  "site": "blog",
  "name": "社外向け共有リンク",
  "createdAt": "2026-07-04T03:00:00.000Z",
  "expiresAt": "2026-07-05T03:00:00.000Z"
}
```
