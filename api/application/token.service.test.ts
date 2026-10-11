import {
  assertEquals,
  assertMatch,
  assertNotEquals,
  assertRejects,
} from "@std/assert";
import type { Token } from "../domain/token.ts";
import type { TokenRepository } from "../domain/token.repository.ts";
import { InMemoryTokenRepository } from "../infrastructure/memory-token.repository.ts";
import { TokenService } from "./token.service.ts";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const SITE = "blog";

const withStore = async (
  fn: (store: TokenService, repo: TokenRepository) => Promise<void>,
) => {
  const repo = new InMemoryTokenRepository();
  await fn(new TokenService(repo), repo);
};

/** 失効済みトークンをリポジトリへ直接書き込む（自動削除を経由しない失効状態の再現） */
const seedExpiredToken = async (repo: TokenRepository): Promise<Token> => {
  const expired: Token = {
    id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    site: SITE,
    name: "期限切れ",
    createdAt: new Date(Date.now() - 120_000).toISOString(),
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
  };
  await repo.put(expired);
  return expired;
};

Deno.test("create: ULIDと失効日時を持つトークンをサイト配下に発行する", () =>
  withStore(async (store) => {
    const expiresAt = new Date(Date.now() + 60_000);
    const token = await store.create({ site: SITE, name: "テスト", expiresAt });

    assertMatch(token.id, ULID_PATTERN);
    assertEquals(token.site, SITE);
    assertEquals(token.name, "テスト");
    assertEquals(token.expiresAt, expiresAt.toISOString());
    assertEquals(await store.get(SITE, token.id), token);
  }));

Deno.test("create: 名前を省略すると既定の表示名になる", () =>
  withStore(async (store) => {
    const token = await store.create({
      site: SITE,
      expiresAt: new Date(Date.now() + 60_000),
    });
    assertEquals(token.name, "無題のトークン");
  }));

Deno.test("create: 過去の失効日時では発行できない", () =>
  withStore(async (store) => {
    await assertRejects(
      () =>
        store.create({ site: SITE, expiresAt: new Date(Date.now() - 1_000) }),
      RangeError,
    );
  }));

Deno.test("list: 有効なトークンのみを作成順で返す", () =>
  withStore(async (store, repo) => {
    await seedExpiredToken(repo);
    const first = await store.create({
      site: SITE,
      name: "1つ目",
      expiresAt: new Date(Date.now() + 60_000),
    });
    const second = await store.create({
      site: SITE,
      name: "2つ目",
      expiresAt: new Date(Date.now() + 120_000),
    });

    assertEquals(await store.list(), [first, second]);
  }));

Deno.test("list: サイトを指定するとそのサイトのトークンのみ返す", () =>
  withStore(async (store) => {
    const blogToken = await store.create({
      site: "blog",
      expiresAt: new Date(Date.now() + 60_000),
    });
    const portfolioToken = await store.create({
      site: "portfolio",
      expiresAt: new Date(Date.now() + 60_000),
    });

    assertEquals(await store.list("blog"), [blogToken]);
    assertEquals(await store.list("portfolio"), [portfolioToken]);
    assertEquals(await store.list(), [blogToken, portfolioToken]);
    assertEquals(await store.list("unknown"), []);
  }));

Deno.test("get: 失効済みトークンはnullを返す", () =>
  withStore(async (store, repo) => {
    const expired = await seedExpiredToken(repo);
    assertEquals(await store.get(SITE, expired.id), null);
  }));

Deno.test("get: サイトが異なるとnullを返す", () =>
  withStore(async (store) => {
    const token = await store.create({
      site: SITE,
      expiresAt: new Date(Date.now() + 60_000),
    });
    assertEquals(await store.get("other-site", token.id), null);
  }));

Deno.test("update: 表示名と失効日時を更新し、失効済みには適用しない", () =>
  withStore(async (store, repo) => {
    const token = await store.create({
      site: SITE,
      name: "更新前",
      expiresAt: new Date(Date.now() + 60_000),
    });
    const newExpiresAt = new Date(Date.now() + 120_000);

    const updated = await store.update(SITE, token.id, {
      name: "更新後",
      expiresAt: newExpiresAt,
    });
    assertEquals(updated?.name, "更新後");
    assertEquals(updated?.expiresAt, newExpiresAt.toISOString());
    assertNotEquals(updated?.expiresAt, token.expiresAt);

    const expired = await seedExpiredToken(repo);
    assertEquals(await store.update(SITE, expired.id, { name: "無効" }), null);
  }));

Deno.test("update: nameの未指定は維持、空文字は既定名にリセットする", () =>
  withStore(async (store) => {
    const token = await store.create({
      site: SITE,
      name: "元の名前",
      expiresAt: new Date(Date.now() + 60_000),
    });

    // name未指定 → 維持（失効日時だけ更新）
    const kept = await store.update(SITE, token.id, {
      expiresAt: new Date(Date.now() + 120_000),
    });
    assertEquals(kept?.name, "元の名前");

    // name="" → 既定名にリセット（createと同じ扱い）
    const reset = await store.update(SITE, token.id, { name: "" });
    assertEquals(reset?.name, "無題のトークン");

    // 空白のみも既定名にリセット
    const resetBlank = await store.update(SITE, token.id, { name: "   " });
    assertEquals(resetBlank?.name, "無題のトークン");
  }));

Deno.test("update: 過去の失効日時には更新できない", () =>
  withStore(async (store) => {
    const token = await store.create({
      site: SITE,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await assertRejects(
      () =>
        store.update(SITE, token.id, {
          expiresAt: new Date(Date.now() - 1_000),
        }),
      RangeError,
    );
  }));

Deno.test("delete: トークンを失効させ、二重削除はfalseを返す", () =>
  withStore(async (store) => {
    const token = await store.create({
      site: SITE,
      expiresAt: new Date(Date.now() + 60_000),
    });

    assertEquals(await store.delete(SITE, token.id), true);
    assertEquals(await store.get(SITE, token.id), null);
    assertEquals(await store.delete(SITE, token.id), false);
  }));

Deno.test("verify: 有効ならトークン付き、無効ならvalid: falseを返す", () =>
  withStore(async (store, repo) => {
    const token = await store.create({
      site: SITE,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const expired = await seedExpiredToken(repo);

    assertEquals(await store.verify(SITE, token.id), { valid: true, token });
    assertEquals(await store.verify(SITE, expired.id), { valid: false });
    assertEquals(await store.verify(SITE, "存在しないID"), { valid: false });
  }));

Deno.test("verify: サイトが異なるとvalid: falseを返す", () =>
  withStore(async (store) => {
    const token = await store.create({
      site: SITE,
      expiresAt: new Date(Date.now() + 60_000),
    });

    assertEquals(await store.verify("other-site", token.id), { valid: false });
  }));
