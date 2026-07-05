import { assertEquals, assertMatch } from "@std/assert";
import {
  API_KEY_ENV,
  API_KEY_HEADER,
  type TokenRecord,
  type VerifyResult,
} from "../shared/mod.ts";
import { createApp } from "./app.ts";
import { TokenStore } from "./store.ts";

const API_KEY = "test-api-key";
const AUTH_HEADERS = { [API_KEY_HEADER]: API_KEY };

const withApp = async (
  fn: (app: ReturnType<typeof createApp>) => Promise<void>,
  options?: Parameters<typeof createApp>[1],
) => {
  const kv = await Deno.openKv(":memory:");
  Deno.env.set(API_KEY_ENV, API_KEY);
  try {
    await fn(createApp(new TokenStore(kv), options));
  } finally {
    kv.close();
  }
};

const createToken = async (
  app: ReturnType<typeof createApp>,
  expiresAt: Date,
): Promise<TokenRecord> => {
  const res = await app.request("/tokens", {
    method: "POST",
    headers: AUTH_HEADERS,
    body: JSON.stringify({
      name: "テスト",
      expiresAt: expiresAt.toISOString(),
    }),
  });
  assertEquals(res.status, 201);
  return await res.json();
};

Deno.test("認証: APIキーがない・誤っているリクエストは401", () =>
  withApp(async (app) => {
    const noKey = await app.request("/tokens");
    assertEquals(noKey.status, 401);
    await noKey.body?.cancel();

    const wrongKey = await app.request("/tokens", {
      headers: { [API_KEY_HEADER]: "wrong-key" },
    });
    assertEquals(wrongKey.status, 401);
    await wrongKey.body?.cancel();
  }));

Deno.test("POST /tokens: トークンを発行する", () =>
  withApp(async (app) => {
    const token = await createToken(app, new Date(Date.now() + 60_000));
    assertMatch(token.id, /^[0-9A-HJKMNP-TV-Z]{26}$/);
    assertEquals(token.name, "テスト");
  }));

Deno.test("POST /tokens: 不正な失効日時は400", () =>
  withApp(async (app) => {
    for (const expiresAt of [undefined, "invalid", "2000-01-01T00:00:00Z"]) {
      const res = await app.request("/tokens", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({ expiresAt }),
      });
      assertEquals(res.status, 400);
      await res.body?.cancel();
    }
  }));

Deno.test("GET /tokens: 発行済みトークンを一覧する", () =>
  withApp(async (app) => {
    const token = await createToken(app, new Date(Date.now() + 60_000));

    const res = await app.request("/tokens", { headers: AUTH_HEADERS });
    assertEquals(res.status, 200);
    assertEquals(await res.json(), { tokens: [token] });
  }));

Deno.test("GET /tokens/:id: 存在しないトークンは404", () =>
  withApp(async (app) => {
    const res = await app.request("/tokens/unknown", {
      headers: AUTH_HEADERS,
    });
    assertEquals(res.status, 404);
    await res.body?.cancel();
  }));

Deno.test("PATCH /tokens/:id: 表示名と失効日時を更新する", () =>
  withApp(async (app) => {
    const token = await createToken(app, new Date(Date.now() + 60_000));
    const newExpiresAt = new Date(Date.now() + 120_000);

    const res = await app.request(`/tokens/${token.id}`, {
      method: "PATCH",
      headers: AUTH_HEADERS,
      body: JSON.stringify({
        name: "更新後",
        expiresAt: newExpiresAt.toISOString(),
      }),
    });
    assertEquals(res.status, 200);

    const updated: TokenRecord = await res.json();
    assertEquals(updated.name, "更新後");
    assertEquals(updated.expiresAt, newExpiresAt.toISOString());
  }));

Deno.test("DELETE /tokens/:id: トークンを失効させる", () =>
  withApp(async (app) => {
    const token = await createToken(app, new Date(Date.now() + 60_000));

    const res = await app.request(`/tokens/${token.id}`, {
      method: "DELETE",
      headers: AUTH_HEADERS,
    });
    assertEquals(res.status, 204);

    const verifyRes = await app.request(`/verify/${token.id}`, {
      headers: AUTH_HEADERS,
    });
    const result: VerifyResult = await verifyRes.json();
    assertEquals(result, { valid: false });
  }));

Deno.test("GET /verify/:id: 有効なトークンを検証できる", () =>
  withApp(async (app) => {
    const token = await createToken(app, new Date(Date.now() + 60_000));

    const res = await app.request(`/verify/${token.id}`, {
      headers: AUTH_HEADERS,
    });
    assertEquals(res.status, 200);
    assertEquals(await res.json(), { valid: true, token });
  }));

Deno.test("GET /verify/:id: APIキーなしの外部アプリからも検証できる", () =>
  withApp(async (app) => {
    const token = await createToken(app, new Date(Date.now() + 60_000));

    const res = await app.request(`/verify/${token.id}`);
    assertEquals(res.status, 200);
    assertEquals(res.headers.get("access-control-allow-origin"), "*");
    assertEquals(res.headers.get("cache-control"), "no-store");
    assertEquals(await res.json(), { valid: true, token });

    const invalid = await app.request("/verify/unknown");
    assertEquals(invalid.status, 200);
    assertEquals(await invalid.json(), { valid: false });
  }));

Deno.test("GET /verify/:id: レート制限を超えると429を返す", () =>
  withApp(async (app) => {
    const token = await createToken(app, new Date(Date.now() + 60_000));

    for (let i = 0; i < 2; i++) {
      const ok = await app.request(`/verify/${token.id}`);
      assertEquals(ok.status, 200);
      await ok.body?.cancel();
    }

    const blocked = await app.request(`/verify/${token.id}`);
    assertEquals(blocked.status, 429);
    assertEquals(blocked.headers.get("retry-after"), "60");
    await blocked.body?.cancel();

    // 管理系エンドポイントは/verifyのレート制限の影響を受けない
    const list = await app.request("/tokens", { headers: AUTH_HEADERS });
    assertEquals(list.status, 200);
    await list.body?.cancel();
  }, { verifyRateLimit: { limit: 2, windowMs: 60_000 } }));
