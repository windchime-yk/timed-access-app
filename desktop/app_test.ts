import { assertEquals } from "@std/assert";
import type { TokenRecord } from "../shared/mod.ts";
import type { ApiClient } from "./api_client.ts";
import { createDesktopApp } from "./app.tsx";

const sampleToken: TokenRecord = {
  id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  name: "テスト",
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
};

/** createTokenの呼び出し回数を数える最小限のApiClientスタブ */
const createStubClient = () => {
  const calls = { createToken: 0 };
  const client = {
    listTokens: () => Promise.resolve([]),
    createToken: () => {
      calls.createToken += 1;
      return Promise.resolve(sampleToken);
    },
  } as unknown as ApiClient;
  return { client, calls };
};

const HOST = "localhost:8080";

const postToken = (
  app: ReturnType<typeof createDesktopApp>,
  headers: Record<string, string>,
) =>
  app.request("/tokens", {
    method: "POST",
    headers: {
      host: HOST,
      "content-type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body: new URLSearchParams({
      name: "テスト",
      expires_at: "2027-01-01T12:00",
    }),
  });

Deno.test("CSRF: クロスオリジンのPOSTは403で拒否しAPIを呼ばない", async () => {
  const { client, calls } = createStubClient();
  const app = createDesktopApp(client);

  const res = await postToken(app, { origin: "https://evil.example" });
  assertEquals(res.status, 403);
  assertEquals(calls.createToken, 0);
  await res.body?.cancel();
});

Deno.test("CSRF: 同一オリジンのPOSTは通過する", async () => {
  const { client, calls } = createStubClient();
  const app = createDesktopApp(client);

  const res = await postToken(app, { origin: `http://${HOST}` });
  // 同一オリジンなら発行に進み303リダイレクト
  assertEquals(res.status, 303);
  assertEquals(calls.createToken, 1);
  await res.body?.cancel();
});

Deno.test("CSRF: Originヘッダーなし（webview等）のPOSTは通過する", async () => {
  const { client, calls } = createStubClient();
  const app = createDesktopApp(client);

  const res = await postToken(app, {});
  assertEquals(res.status, 303);
  assertEquals(calls.createToken, 1);
  await res.body?.cancel();
});

Deno.test("CSRF: GETリクエストはオリジンに関わらず通過する", async () => {
  const { client } = createStubClient();
  const app = createDesktopApp(client);

  const res = await app.request("/", {
    headers: { host: HOST, origin: "https://evil.example" },
  });
  assertEquals(res.status, 200);
  await res.body?.cancel();
});
