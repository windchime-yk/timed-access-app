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
