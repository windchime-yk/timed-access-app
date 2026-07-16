import { assertEquals } from "@std/assert";
import { ApiClient } from "./api_client.ts";

/** fetchを差し替えて、要求されたURLだけ記録するスタブを仕込む */
const withFetchSpy = async (
  fn: (calls: string[]) => Promise<void>,
) => {
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request) => {
    calls.push(input instanceof Request ? input.url : String(input));
    return Promise.resolve(
      new Response(JSON.stringify({ tokens: [] }), {
        headers: { "content-type": "application/json" },
      }),
    );
  }) as typeof fetch;
  try {
    await fn(calls);
  } finally {
    globalThis.fetch = original;
  }
};

Deno.test("ApiClient: baseUrlのパス接頭辞を保ってリクエストする", () =>
  withFetchSpy(async (calls) => {
    const client = new ApiClient("https://example.com/timed-access", "key");
    await client.listTokens();
    assertEquals(calls[0], "https://example.com/timed-access/tokens");
  }));

Deno.test("ApiClient: baseUrl末尾のスラッシュは重複させない", () =>
  withFetchSpy(async (calls) => {
    const client = new ApiClient("http://localhost:8000/", "key");
    await client.listTokens();
    assertEquals(calls[0], "http://localhost:8000/tokens");
  }));

Deno.test("ApiClient: verifyのサイト名とIDはURLエンコードされる", () =>
  withFetchSpy(async (calls) => {
    const client = new ApiClient("http://localhost:8000", "key");
    await client.verifyToken("s/x", "a/b");
    assertEquals(calls[0], "http://localhost:8000/verify/s%2Fx/a%2Fb");
  }));
