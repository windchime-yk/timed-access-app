import { createApp } from "./app.ts";
import { TokenStore } from "./store.ts";

/**
 * 環境変数を正の整数として読み、不正・未設定なら既定値を返す
 * @param name 環境変数名
 * @param fallback 既定値
 */
const positiveIntEnv = (name: string, fallback: number): number => {
  const raw = Deno.env.get(name);
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (Number.isInteger(value) && value > 0) return value;
  console.warn(
    `${name}="${raw}" は正の整数ではないため既定値 ${fallback} を使用します`,
  );
  return fallback;
};

const kv = await Deno.openKv(Deno.env.get("KV_PATH"));
const app = createApp(new TokenStore(kv), {
  verifyRateLimit: {
    limit: positiveIntEnv("VERIFY_RATE_LIMIT", 60),
    windowMs: 60_000,
  },
});
const port = Deno.env.get("PORT");

Deno.serve(port ? { port: Number(port) } : {}, app.fetch);
