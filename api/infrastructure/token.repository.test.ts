import { assertEquals } from "@std/assert";
import type { Token } from "../domain/token.ts";
import type { TokenRepository } from "../domain/token.repository.ts";
import { DenoKvTokenRepository } from "./deno-kv-token.repository.ts";
import { InMemoryTokenRepository } from "./memory-token.repository.ts";

/** 契約テストを流す実装。新しい実装はここに追加する */
const implementations: {
  name: string;
  open: () => Promise<{ repo: TokenRepository; close: () => void }>;
}[] = [
  {
    name: "InMemoryTokenRepository",
    open: () =>
      Promise.resolve({ repo: new InMemoryTokenRepository(), close: () => {} }),
  },
  {
    name: "DenoKvTokenRepository",
    open: async () => {
      const kv = await Deno.openKv(":memory:");
      return { repo: new DenoKvTokenRepository(kv), close: () => kv.close() };
    },
  },
];

const tokenOf = (
  site: string,
  id: string,
  expiresInMs = 60_000,
): Token => ({
  id,
  site,
  name: `${site}/${id}`,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
});

for (const { name, open } of implementations) {
  const withRepo = async (fn: (repo: TokenRepository) => Promise<void>) => {
    const { repo, close } = await open();
    try {
      await fn(repo);
    } finally {
      close();
    }
  };

  Deno.test(`${name}: putしたトークンをgetで取得できる`, () =>
    withRepo(async (repo) => {
      const token = tokenOf("blog", "01ARZ3NDEKTSV4RRFFQ69G5FAV");
      await repo.put(token);

      assertEquals(await repo.get("blog", token.id), token);
      assertEquals(await repo.get("blog", "unknown"), null);
      assertEquals(await repo.get("other-site", token.id), null);
    }));

  Deno.test(`${name}: 同じsite/idへのputは上書きする`, () =>
    withRepo(async (repo) => {
      const token = tokenOf("blog", "01ARZ3NDEKTSV4RRFFQ69G5FAV");
      await repo.put(token);
      const updated = { ...token, name: "更新後" };
      await repo.put(updated);

      assertEquals(await repo.get("blog", token.id), updated);
      assertEquals(await repo.list(), [updated]);
    }));

  Deno.test(`${name}: deleteで削除でき、存在しなくても失敗しない`, () =>
    withRepo(async (repo) => {
      const token = tokenOf("blog", "01ARZ3NDEKTSV4RRFFQ69G5FAV");
      await repo.put(token);

      await repo.delete("blog", token.id);
      assertEquals(await repo.get("blog", token.id), null);
      await repo.delete("blog", token.id);
    }));

  Deno.test(`${name}: listはsite→id昇順で返す`, () =>
    withRepo(async (repo) => {
      const b2 = tokenOf("portfolio", "01ARZ3NDEKTSV4RRFFQ69G5FB0");
      const a2 = tokenOf("blog", "01ARZ3NDEKTSV4RRFFQ69G5FB1");
      const b1 = tokenOf("portfolio", "01ARZ3NDEKTSV4RRFFQ69G5FAV");
      const a1 = tokenOf("blog", "01ARZ3NDEKTSV4RRFFQ69G5FAW");
      for (const token of [b2, a2, b1, a1]) await repo.put(token);

      assertEquals(await repo.list(), [a1, a2, b1, b2]);
    }));

  Deno.test(`${name}: listのsite指定は完全一致のみ`, () =>
    withRepo(async (repo) => {
      const blog = tokenOf("blog", "01ARZ3NDEKTSV4RRFFQ69G5FAV");
      const blog2 = tokenOf("blog-2", "01ARZ3NDEKTSV4RRFFQ69G5FAW");
      await repo.put(blog);
      await repo.put(blog2);

      assertEquals(await repo.list("blog"), [blog]);
      assertEquals(await repo.list("blog-2"), [blog2]);
      assertEquals(await repo.list("blo"), []);
    }));

  Deno.test(`${name}: 失効済みトークンも保存でき、除外は呼び出し側に任せる`, () =>
    withRepo(async (repo) => {
      const expired = tokenOf("blog", "01ARZ3NDEKTSV4RRFFQ69G5FAV", -60_000);
      await repo.put(expired);

      assertEquals(await repo.get("blog", expired.id), expired);
    }));
}
