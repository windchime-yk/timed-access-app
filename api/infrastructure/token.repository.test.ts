import { assertEquals } from "@std/assert";
import type { TokenRecord } from "../../shared/mod.ts";
import { SiteName } from "../domain/aggregates/token/value-objects/site-name.ts";
import { TokenId } from "../domain/aggregates/token/value-objects/token-id.ts";
import { Token } from "../domain/aggregates/token/token.ts";
import type { TokenRepository } from "../domain/aggregates/token/token.repository.ts";
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

const tokenOf = (site: string, id: string, expiresInMs = 60_000): Token =>
  Token.restore({
    id,
    site,
    name: `${site}/${id}`,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
  });

const site = (value: string) => SiteName.from(value);
const id = (value: string) => TokenId.from(value);

/** Entityを比較しやすい値に変換する（null はそのまま） */
const recordOf = (token: Token | null): TokenRecord | null =>
  token?.toRecord() ?? null;

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

      const found = await repo.get(token.site, token.id);
      assertEquals(found instanceof Token, true);
      assertEquals(recordOf(found), token.toRecord());
      assertEquals(
        await repo.get(site("blog"), id("01ARZ3NDEKTSV4RRFFQ69G5FAW")),
        null,
      );
      assertEquals(await repo.get(site("other-site"), token.id), null);
    }));

  Deno.test(`${name}: 同じsite/idへのputは上書きする`, () =>
    withRepo(async (repo) => {
      const token = tokenOf("blog", "01ARZ3NDEKTSV4RRFFQ69G5FAV");
      await repo.put(token);
      token.rename("更新後");
      await repo.put(token);

      assertEquals(
        recordOf(await repo.get(token.site, token.id)),
        token.toRecord(),
      );
      assertEquals((await repo.list()).map(recordOf), [token.toRecord()]);
    }));

  Deno.test(`${name}: 保存後にEntityを変更しても保存済みの値は変わらない`, () =>
    withRepo(async (repo) => {
      const token = tokenOf("blog", "01ARZ3NDEKTSV4RRFFQ69G5FAV");
      const saved = token.toRecord();
      await repo.put(token);
      token.rename("保存していない変更");

      assertEquals(recordOf(await repo.get(token.site, token.id)), saved);
    }));

  Deno.test(`${name}: deleteで削除でき、存在しなくても失敗しない`, () =>
    withRepo(async (repo) => {
      const token = tokenOf("blog", "01ARZ3NDEKTSV4RRFFQ69G5FAV");
      await repo.put(token);

      await repo.delete(token.site, token.id);
      assertEquals(await repo.get(token.site, token.id), null);
      await repo.delete(token.site, token.id);
    }));

  Deno.test(`${name}: listはsite→id昇順で返す`, () =>
    withRepo(async (repo) => {
      const b2 = tokenOf("portfolio", "01ARZ3NDEKTSV4RRFFQ69G5FB0");
      const a2 = tokenOf("blog", "01ARZ3NDEKTSV4RRFFQ69G5FB1");
      const b1 = tokenOf("portfolio", "01ARZ3NDEKTSV4RRFFQ69G5FAV");
      const a1 = tokenOf("blog", "01ARZ3NDEKTSV4RRFFQ69G5FAW");
      for (const token of [b2, a2, b1, a1]) await repo.put(token);

      assertEquals(
        (await repo.list()).map(recordOf),
        [a1, a2, b1, b2].map(recordOf),
      );
    }));

  Deno.test(`${name}: listのsite指定は完全一致のみ`, () =>
    withRepo(async (repo) => {
      const blog = tokenOf("blog", "01ARZ3NDEKTSV4RRFFQ69G5FAV");
      const blog2 = tokenOf("blog-2", "01ARZ3NDEKTSV4RRFFQ69G5FAW");
      await repo.put(blog);
      await repo.put(blog2);

      assertEquals((await repo.list(site("blog"))).map(recordOf), [
        blog.toRecord(),
      ]);
      assertEquals((await repo.list(site("blog-2"))).map(recordOf), [
        blog2.toRecord(),
      ]);
      assertEquals(await repo.list(site("blo")), []);
    }));

  Deno.test(`${name}: 失効済みトークンも保存でき、除外は呼び出し側に任せる`, () =>
    withRepo(async (repo) => {
      const expired = tokenOf("blog", "01ARZ3NDEKTSV4RRFFQ69G5FAV", -60_000);
      await repo.put(expired);

      assertEquals(
        recordOf(await repo.get(expired.site, expired.id)),
        expired.toRecord(),
      );
    }));
}
