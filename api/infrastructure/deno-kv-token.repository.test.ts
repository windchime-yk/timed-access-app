import { assertEquals, assertRejects } from "@std/assert";
import { CorruptedStoredTokenError } from "./corrupted-stored-token.error.ts";
import { DenoKvTokenRepository } from "./deno-kv-token.repository.ts";
import { fromStoredToken } from "./stored-token.mapper.ts";

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

Deno.test("DenoKvTokenRepository: 失効済みのトークンは期限なしでKVに残さない", () =>
  withKv(async (kv, repo) => {
    const key = ["tokens", "blog", "01ARZ3NDEKTSV4RRFFQ69G5FAV"];
    const stored = {
      id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
      site: "blog",
      name: "テスト",
      createdAt: new Date(Date.now() - 120_000).toISOString(),
    };

    // 有効なトークンを保存したあと、失効済みの値で上書きする
    // （更新の直前に失効日時を過ぎた場合を再現する）
    await repo.put(fromStoredToken({
      ...stored,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    }));
    await repo.put(fromStoredToken({
      ...stored,
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
    }));

    assertEquals((await kv.get(key)).value, null);
  }));
