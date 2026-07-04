import {
  assertEquals,
  assertMatch,
  assertNotEquals,
  assertRejects,
} from "@std/assert";
import type { TokenRecord } from "../shared/mod.ts";
import { isExpired, TokenStore } from "./store.ts";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const withStore = async (
  fn: (store: TokenStore, kv: Deno.Kv) => Promise<void>,
) => {
  const kv = await Deno.openKv(":memory:");
  try {
    await fn(new TokenStore(kv), kv);
  } finally {
    kv.close();
  }
};

/** 失効済みトークンをKVへ直接書き込む（自動削除を経由しない失効状態の再現） */
const seedExpiredToken = async (kv: Deno.Kv): Promise<TokenRecord> => {
  const expired: TokenRecord = {
    id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    name: "期限切れ",
    createdAt: new Date(Date.now() - 120_000).toISOString(),
    expiresAt: new Date(Date.now() - 60_000).toISOString(),
  };
  await kv.set(["tokens", expired.id], expired);
  return expired;
};

Deno.test("isExpired: 失効日時を過ぎたトークンをtrueと判定する", () => {
  const base = {
    id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    name: "テスト",
    createdAt: new Date().toISOString(),
  };
  const now = new Date("2026-07-04T12:00:00Z");

  assertEquals(
    isExpired({ ...base, expiresAt: "2026-07-04T11:59:59Z" }, now),
    true,
  );
  assertEquals(
    isExpired({ ...base, expiresAt: "2026-07-04T12:00:00Z" }, now),
    true,
  );
  assertEquals(
    isExpired({ ...base, expiresAt: "2026-07-04T12:00:01Z" }, now),
    false,
  );
});

Deno.test("create: ULIDと失効日時を持つトークンを発行する", () =>
  withStore(async (store) => {
    const expiresAt = new Date(Date.now() + 60_000);
    const token = await store.create({ name: "テスト", expiresAt });

    assertMatch(token.id, ULID_PATTERN);
    assertEquals(token.name, "テスト");
    assertEquals(token.expiresAt, expiresAt.toISOString());
    assertEquals(await store.get(token.id), token);
  }));

Deno.test("create: 名前を省略すると既定の表示名になる", () =>
  withStore(async (store) => {
    const token = await store.create({
      expiresAt: new Date(Date.now() + 60_000),
    });
    assertEquals(token.name, "無題のトークン");
  }));

Deno.test("create: 過去の失効日時では発行できない", () =>
  withStore(async (store) => {
    await assertRejects(
      () => store.create({ expiresAt: new Date(Date.now() - 1_000) }),
      RangeError,
    );
  }));

Deno.test("list: 有効なトークンのみを作成順で返す", () =>
  withStore(async (store, kv) => {
    await seedExpiredToken(kv);
    const first = await store.create({
      name: "1つ目",
      expiresAt: new Date(Date.now() + 60_000),
    });
    const second = await store.create({
      name: "2つ目",
      expiresAt: new Date(Date.now() + 120_000),
    });

    assertEquals(await store.list(), [first, second]);
  }));

Deno.test("get: 失効済みトークンはnullを返す", () =>
  withStore(async (store, kv) => {
    const expired = await seedExpiredToken(kv);
    assertEquals(await store.get(expired.id), null);
  }));

Deno.test("update: 表示名と失効日時を更新し、失効済みには適用しない", () =>
  withStore(async (store, kv) => {
    const token = await store.create({
      name: "更新前",
      expiresAt: new Date(Date.now() + 60_000),
    });
    const newExpiresAt = new Date(Date.now() + 120_000);

    const updated = await store.update(token.id, {
      name: "更新後",
      expiresAt: newExpiresAt,
    });
    assertEquals(updated?.name, "更新後");
    assertEquals(updated?.expiresAt, newExpiresAt.toISOString());
    assertNotEquals(updated?.expiresAt, token.expiresAt);

    const expired = await seedExpiredToken(kv);
    assertEquals(await store.update(expired.id, { name: "無効" }), null);
  }));

Deno.test("update: nameの未指定は維持、空文字は既定名にリセットする", () =>
  withStore(async (store) => {
    const token = await store.create({
      name: "元の名前",
      expiresAt: new Date(Date.now() + 60_000),
    });

    // name未指定 → 維持（失効日時だけ更新）
    const kept = await store.update(token.id, {
      expiresAt: new Date(Date.now() + 120_000),
    });
    assertEquals(kept?.name, "元の名前");

    // name="" → 既定名にリセット（createと同じ扱い）
    const reset = await store.update(token.id, { name: "" });
    assertEquals(reset?.name, "無題のトークン");

    // 空白のみも既定名にリセット
    const resetBlank = await store.update(token.id, { name: "   " });
    assertEquals(resetBlank?.name, "無題のトークン");
  }));

Deno.test("update: 過去の失効日時には更新できない", () =>
  withStore(async (store) => {
    const token = await store.create({
      expiresAt: new Date(Date.now() + 60_000),
    });
    await assertRejects(
      () =>
        store.update(token.id, {
          expiresAt: new Date(Date.now() - 1_000),
        }),
      RangeError,
    );
  }));

Deno.test("delete: トークンを失効させ、二重削除はfalseを返す", () =>
  withStore(async (store) => {
    const token = await store.create({
      expiresAt: new Date(Date.now() + 60_000),
    });

    assertEquals(await store.delete(token.id), true);
    assertEquals(await store.get(token.id), null);
    assertEquals(await store.delete(token.id), false);
  }));

Deno.test("verify: 有効ならトークン付き、無効ならvalid: falseを返す", () =>
  withStore(async (store, kv) => {
    const token = await store.create({
      expiresAt: new Date(Date.now() + 60_000),
    });
    const expired = await seedExpiredToken(kv);

    assertEquals(await store.verify(token.id), { valid: true, token });
    assertEquals(await store.verify(expired.id), { valid: false });
    assertEquals(await store.verify("存在しないID"), { valid: false });
  }));
