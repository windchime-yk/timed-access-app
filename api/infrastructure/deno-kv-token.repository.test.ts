import { assertEquals, assertRejects } from "@std/assert";
import { CorruptedStoredTokenError } from "./corrupted-stored-token.error.ts";
import { DenoKvTokenRepository } from "./deno-kv-token.repository.ts";

/** Deno KVに直接書き込んだ状態でリポジトリを使う */
const withKv = async (
  fn: (kv: Deno.Kv, repo: DenoKvTokenRepository) => Promise<void>,
) => {
  const kv = await Deno.openKv(":memory:");
  try {
    await fn(kv, new DenoKvTokenRepository(kv));
  } finally {
    kv.close();
  }
};

Deno.test("DenoKvTokenRepository: 壊れたレコードがあれば一覧はCorruptedStoredTokenErrorになる", () =>
  withKv(async (kv, repo) => {
    await kv.set(["tokens", "blog", "01ARZ3NDEKTSV4RRFFQ69G5FAV"], {
      id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      site: "blog",
      name: "壊れたデータ",
      createdAt: "not a date",
      expiresAt: "not a date",
    });

    const error = await assertRejects(
      () => repo.list(),
      CorruptedStoredTokenError,
    );
    assertEquals(error.message.includes("01ARZ3NDEKTSV4RRFFQ69G5FAV"), true);
  }));
