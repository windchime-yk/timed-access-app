import {
  assertEquals,
  assertMatch,
  assertNotEquals,
  assertRejects,
} from "@std/assert";
import type { TokenRecord } from "../../shared/mod.ts";
import { Token } from "../domain/aggregates/token/token.ts";
import type { TokenRepository } from "../domain/aggregates/token/token.repository.ts";
import { InMemoryTokenRepository } from "../infrastructure/memory-token.repository.ts";
import { ValidationError } from "./errors.ts";
import { TokenService } from "./token.service.ts";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const SITE = "blog";

const withService = async (
  fn: (service: TokenService, repo: TokenRepository) => Promise<void>,
) => {
  const repo = new InMemoryTokenRepository();
  await fn(new TokenService(repo), repo);
};

/** Entityを比較しやすい値に変換する（null はそのまま） */
const recordOf = (token: Token | null): TokenRecord | null =>
  token?.toRecord() ?? null;

/** 失効済みトークンをリポジトリへ直接書き込む（自動削除を経由しない失効状態の再現） */
const seedExpiredToken = async (
  repo: TokenRepository,
): Promise<TokenRecord> => {
  const expired: TokenRecord = {
    id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    site: SITE,
    name: "期限切れ",
    createdAt: new Date(Date.now() - 120_000).toISOString(),
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
  };
  await repo.put(Token.restore(expired));
  return expired;
};

Deno.test("create: ULIDと失効日時を持つトークンをサイト配下に発行する", () =>
  withService(async (service) => {
    const expiresAt = new Date(Date.now() + 60_000);
    const token = await service.create({
      site: SITE,
      name: "テスト",
      expiresAt,
    });

    assertMatch(token.id.value, ULID_PATTERN);
    assertEquals(token.site.value, SITE);
    assertEquals(token.name, "テスト");
    assertEquals(token.expiresAt, expiresAt);
    assertEquals(
      recordOf(await service.get(SITE, token.id.value)),
      token.toRecord(),
    );
  }));

Deno.test("create: 名前を省略すると既定の表示名になる", () =>
  withService(async (service) => {
    const token = await service.create({
      site: SITE,
      expiresAt: new Date(Date.now() + 60_000),
    });
    assertEquals(token.name, "無題のトークン");
  }));

Deno.test("create: 過去の失効日時では発行できない", () =>
  withService(async (service) => {
    await assertRejects(
      () =>
        service.create({
          site: SITE,
          expiresAt: new Date(Date.now() - 1_000),
        }),
      ValidationError,
    );
  }));

Deno.test("create: 不正なサイト名では発行できない", () =>
  withService(async (service) => {
    await assertRejects(
      () =>
        service.create({
          site: "Blog!",
          expiresAt: new Date(Date.now() + 60_000),
        }),
      ValidationError,
    );
  }));

Deno.test("list: 有効なトークンのみを作成順で返す", () =>
  withService(async (service, repo) => {
    await seedExpiredToken(repo);
    const first = await service.create({
      site: SITE,
      name: "1つ目",
      expiresAt: new Date(Date.now() + 60_000),
    });
    const second = await service.create({
      site: SITE,
      name: "2つ目",
      expiresAt: new Date(Date.now() + 120_000),
    });

    assertEquals((await service.list()).map(recordOf), [
      first.toRecord(),
      second.toRecord(),
    ]);
  }));

Deno.test("list: サイトを指定するとそのサイトのトークンのみ返す", () =>
  withService(async (service) => {
    const blogToken = await service.create({
      site: "blog",
      expiresAt: new Date(Date.now() + 60_000),
    });
    const portfolioToken = await service.create({
      site: "portfolio",
      expiresAt: new Date(Date.now() + 60_000),
    });

    assertEquals((await service.list("blog")).map(recordOf), [
      blogToken.toRecord(),
    ]);
    assertEquals((await service.list("portfolio")).map(recordOf), [
      portfolioToken.toRecord(),
    ]);
    assertEquals((await service.list()).map(recordOf), [
      blogToken.toRecord(),
      portfolioToken.toRecord(),
    ]);
    assertEquals(await service.list("unknown"), []);
  }));

Deno.test("list: 不正なサイト名はValidationError", () =>
  withService(async (service) => {
    await assertRejects(() => service.list("Blog!"), ValidationError);
  }));

Deno.test("get: 失効済みトークンはnullを返す", () =>
  withService(async (service, repo) => {
    const expired = await seedExpiredToken(repo);
    assertEquals(await service.get(SITE, expired.id), null);
  }));

Deno.test("get: サイトが異なるとnullを返す", () =>
  withService(async (service) => {
    const token = await service.create({
      site: SITE,
      expiresAt: new Date(Date.now() + 60_000),
    });
    assertEquals(await service.get("other-site", token.id.value), null);
  }));

Deno.test("get: サイト名・IDの形式が不正ならnullを返す", () =>
  withService(async (service) => {
    const token = await service.create({
      site: SITE,
      expiresAt: new Date(Date.now() + 60_000),
    });
    assertEquals(await service.get("Blog!", token.id.value), null);
    assertEquals(await service.get(SITE, "unknown"), null);
  }));

Deno.test("update: 表示名と失効日時を更新し、失効済みには適用しない", () =>
  withService(async (service, repo) => {
    const token = await service.create({
      site: SITE,
      name: "更新前",
      expiresAt: new Date(Date.now() + 60_000),
    });
    const newExpiresAt = new Date(Date.now() + 120_000);

    const updated = await service.update(SITE, token.id.value, {
      name: "更新後",
      expiresAt: newExpiresAt,
    });
    assertEquals(updated?.name, "更新後");
    assertEquals(updated?.expiresAt, newExpiresAt);
    assertNotEquals(updated?.expiresAt, token.expiresAt);
    assertEquals(
      recordOf(await service.get(SITE, token.id.value)),
      recordOf(updated),
    );

    const expired = await seedExpiredToken(repo);
    assertEquals(
      await service.update(SITE, expired.id, { name: "無効" }),
      null,
    );
  }));

Deno.test("update: nameの未指定は維持、空文字は既定名にリセットする", () =>
  withService(async (service) => {
    const token = await service.create({
      site: SITE,
      name: "元の名前",
      expiresAt: new Date(Date.now() + 60_000),
    });

    // name未指定 → 維持（失効日時だけ更新）
    const kept = await service.update(SITE, token.id.value, {
      expiresAt: new Date(Date.now() + 120_000),
    });
    assertEquals(kept?.name, "元の名前");

    // name="" → 既定名にリセット（createと同じ扱い）
    const reset = await service.update(SITE, token.id.value, { name: "" });
    assertEquals(reset?.name, "無題のトークン");

    // 空白のみも既定名にリセット
    const resetBlank = await service.update(SITE, token.id.value, {
      name: "   ",
    });
    assertEquals(resetBlank?.name, "無題のトークン");
  }));

Deno.test("update: 過去の失効日時には更新できない", () =>
  withService(async (service) => {
    const token = await service.create({
      site: SITE,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await assertRejects(
      () =>
        service.update(SITE, token.id.value, {
          expiresAt: new Date(Date.now() - 1_000),
        }),
      ValidationError,
    );
  }));

Deno.test("delete: トークンを失効させ、二重削除はfalseを返す", () =>
  withService(async (service) => {
    const token = await service.create({
      site: SITE,
      expiresAt: new Date(Date.now() + 60_000),
    });

    assertEquals(await service.delete(SITE, token.id.value), true);
    assertEquals(await service.get(SITE, token.id.value), null);
    assertEquals(await service.delete(SITE, token.id.value), false);
    assertEquals(await service.delete(SITE, "unknown"), false);
  }));

Deno.test("verify: 有効ならトークン付き、無効ならvalid: falseを返す", () =>
  withService(async (service, repo) => {
    const token = await service.create({
      site: SITE,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const expired = await seedExpiredToken(repo);

    assertEquals(await service.verify(SITE, token.id.value), {
      valid: true,
      token: token.toRecord(),
    });
    assertEquals(await service.verify(SITE, expired.id), { valid: false });
    assertEquals(await service.verify(SITE, "存在しないID"), { valid: false });
  }));

Deno.test("verify: サイトが異なるとvalid: falseを返す", () =>
  withService(async (service) => {
    const token = await service.create({
      site: SITE,
      expiresAt: new Date(Date.now() + 60_000),
    });

    assertEquals(await service.verify("other-site", token.id.value), {
      valid: false,
    });
    assertEquals(await service.verify("Blog!", token.id.value), {
      valid: false,
    });
  }));
