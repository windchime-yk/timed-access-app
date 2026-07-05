import { ApiClient } from "./api_client.ts";
import { createDesktopApp } from "./app.tsx";

const app = createDesktopApp(new ApiClient());

// deno desktop 経由ではポート未指定にして、webviewが参照するアドレスへ自動バインドさせる。
// DESKTOP_PORT指定時（ブラウザ確認用のdevモード）はLANへ露出しないよう127.0.0.1に固定する
const port = Deno.env.get("DESKTOP_PORT");

Deno.serve(
  port ? { hostname: "127.0.0.1", port: Number(port) } : {},
  app.fetch,
);

// deno desktop 実行時は、最初に構築した BrowserWindow が自動生成された起動ウィンドウを
// 引き取る。タイトルバーの既定表示（dylibのファイル名）を上書きしてアプリ名にする。
// 通常の deno run（dev/ブラウザ確認）では Deno.BrowserWindow が無いのでスキップする。
const BrowserWindow =
  (Deno as { BrowserWindow?: new (options: { title: string }) => unknown })
    .BrowserWindow;
if (BrowserWindow) new BrowserWindow({ title: "TimedAccess" });
