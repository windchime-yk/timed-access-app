import { assertEquals, assertThrows } from "@std/assert";
import { Hono } from "@hono/hono";
import { HTTPException } from "@hono/hono/http-exception";
import { rateLimit, type RateLimitOptions } from "./rate_limit.ts";

/** レート制限だけを適用した最小のアプリを作る */
const createLimitedApp = (options: RateLimitOptions) => {
  const app = new Hono();
  app.use("*", rateLimit(options));
  app.get("/", (ctx) => ctx.text("ok"));
  app.onError((err, ctx) => {
    if (err instanceof HTTPException) {
      // 本体のonErrorと同様にctx経由で返し、ctx.headerで積んだヘッダーを反映させる
      return ctx.json({ message: err.message }, err.status);
    }
    throw err;
  });
  return app;
};

Deno.test("rateLimit: 不正なlimitは構築時にRangeErrorを投げる", () => {
  for (const limit of [NaN, 0, -1, 1.5, Infinity]) {
    assertThrows(
      () => rateLimit({ limit, windowMs: 60_000 }),
      RangeError,
    );
  }
});

Deno.test("rateLimit: 不正なwindowMsは構築時にRangeErrorを投げる", () => {
  for (const windowMs of [NaN, 0, -1, Infinity]) {
    assertThrows(
      () => rateLimit({ limit: 60, windowMs }),
      RangeError,
    );
  }
});

Deno.test("clientAddress: TRUST_PROXY時、偽装された先頭ではなく末尾側の信頼IPで数える", async () => {
  Deno.env.set("TRUST_PROXY", "true");
  try {
    // 既定のkeyOf（clientAddress）を使う
    const app = createLimitedApp({ limit: 1, windowMs: 60_000 });

    // 攻撃者が先頭を偽装しても、プロキシが追記する末尾の実IPが同じなら同一バケット
    const first = await app.request("/", {
      headers: { "x-forwarded-for": "1.1.1.1, 203.0.113.9" },
    });
    assertEquals(first.status, 200);
    await first.body?.cancel();

    const spoofed = await app.request("/", {
      headers: { "x-forwarded-for": "2.2.2.2, 203.0.113.9" },
    });
    assertEquals(spoofed.status, 429);
    await spoofed.body?.cancel();
  } finally {
    Deno.env.delete("TRUST_PROXY");
  }
});

Deno.test("clientAddress: TRUST_PROXY未設定ならx-forwarded-forを信頼しない", async () => {
  // TRUST_PROXY無効。app.request経由では接続情報が無く全て "unknown" に集約される
  const app = createLimitedApp({ limit: 1, windowMs: 60_000 });

  const first = await app.request("/", {
    headers: { "x-forwarded-for": "1.1.1.1" },
  });
  assertEquals(first.status, 200);
  await first.body?.cancel();

  const second = await app.request("/", {
    headers: { "x-forwarded-for": "2.2.2.2" },
  });
  // XFFを無視して同一バケット扱いになるので2回目は429
  assertEquals(second.status, 429);
  await second.body?.cancel();
});

Deno.test("rateLimit: 制限内のリクエストを通し、残数ヘッダーを付ける", async () => {
  const app = createLimitedApp({
    limit: 2,
    windowMs: 60_000,
    keyOf: () => "client-a",
  });

  const first = await app.request("/");
  assertEquals(first.status, 200);
  assertEquals(first.headers.get("ratelimit-limit"), "2");
  assertEquals(first.headers.get("ratelimit-remaining"), "1");
  await first.body?.cancel();

  const second = await app.request("/");
  assertEquals(second.status, 200);
  assertEquals(second.headers.get("ratelimit-remaining"), "0");
  await second.body?.cancel();
});

Deno.test("rateLimit: 制限を超えるとRetry-After付きの429を返す", async () => {
  const app = createLimitedApp({
    limit: 1,
    windowMs: 60_000,
    keyOf: () => "client-a",
  });

  await (await app.request("/")).body?.cancel();

  const blocked = await app.request("/");
  assertEquals(blocked.status, 429);
  assertEquals(blocked.headers.get("ratelimit-remaining"), "0");
  assertEquals(blocked.headers.get("retry-after"), "60");
  await blocked.body?.cancel();
});

Deno.test("rateLimit: クライアントごとに独立してカウントする", async () => {
  let client = "client-a";
  const app = createLimitedApp({
    limit: 1,
    windowMs: 60_000,
    keyOf: () => client,
  });

  await (await app.request("/")).body?.cancel();

  client = "client-b";
  const other = await app.request("/");
  assertEquals(other.status, 200);
  await other.body?.cancel();
});

Deno.test("rateLimit: ウィンドウが切り替わるとカウントがリセットされる", async () => {
  const app = createLimitedApp({
    limit: 1,
    windowMs: 50,
    keyOf: () => "client-a",
  });

  await (await app.request("/")).body?.cancel();
  assertEquals((await app.request("/")).status, 429);

  await new Promise((resolve) => setTimeout(resolve, 60));

  const afterReset = await app.request("/");
  assertEquals(afterReset.status, 200);
  await afterReset.body?.cancel();
});
