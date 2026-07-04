# timed-access-app

時限式アクセストークン管理アプリ。失効日時を設定してULIDを発行し、その時刻になるとトークンが自動で失効します。発行・検証はAPIが担い、デスクトップアプリからCRUD操作ができます。

## 構成

Deno Workspaceで3つのパッケージを管理しています。

| ディレクトリ | 役割                                                                |
| ------------ | ------------------------------------------------------------------- |
| `api/`       | トークンの発行・検証API（Hono + Deno KV + `@std/ulid`）             |
| `desktop/`   | CRUD用デスクトップアプリ（Hono + hono/jsx、`deno desktop`でビルド） |
| `shared/`    | 型と定数の共有パッケージ                                            |

- ULIDは `@std/ulid` で生成し、Deno KVの `expireIn`
  により失効日時ちょうどにレコードが自動削除されます
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

```bash
deno task desktop:build
```

`desktop/TimedAccess.app` が生成されます。別プラットフォーム向けは
`desktop/deno.json` の `build` タスクの `--output` や `--target`
相当のオプションを調整してください。

## API仕様

トークンの管理操作（`/tokens` 配下）は `x-api-key` ヘッダーに
`TIMED_ACCESS_API_KEY`
と同じ値が必要です。検証（`/verify`）は外部アプリからの利用を想定しているため、認証不要でCORS許可（`Access-Control-Allow-Origin: *`）です。

| メソッド | パス          | 認証 | 説明                                                               |
| -------- | ------------- | ---- | ------------------------------------------------------------------ |
| `POST`   | `/tokens`     | 必要 | トークン発行。`{ "name"?: string, "expiresAt": string(ISO 8601) }` |
| `GET`    | `/tokens`     | 必要 | 有効なトークンの一覧                                               |
| `GET`    | `/tokens/:id` | 必要 | トークンの取得（失効済みは404）                                    |
| `PATCH`  | `/tokens/:id` | 必要 | 表示名・失効日時の更新                                             |
| `DELETE` | `/tokens/:id` | 必要 | トークンの即時失効                                                 |
| `GET`    | `/verify/:id` | 不要 | トークン検証。`{ "valid": boolean, "token"?: TokenRecord }`        |

### 外部アプリからの検証

デスクトップアプリで発行したULIDを外部アプリで検証し、コンテンツの出し分けなどに利用できます。APIキーは不要です。

```ts
const res = await fetch(
  `https://your-api.example.com/verify/${ulid}`,
);
const { valid } = await res.json();
if (valid) {
  // 有効期間内のみコンテンツを表示する
}
```

- 失効日時を過ぎたULIDや削除済みのULIDは `{ "valid": false }` になります
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
  "name": "社外向け共有リンク",
  "createdAt": "2026-07-04T03:00:00.000Z",
  "expiresAt": "2026-07-05T03:00:00.000Z"
}
```
