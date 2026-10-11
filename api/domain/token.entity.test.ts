import { assertEquals, assertMatch, assertThrows } from "@std/assert";
import type { TokenRecord } from "../../shared/mod.ts";
import { SiteName } from "./site-name.value-object.ts";
import { Token } from "./token.entity.ts";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const NOW = new Date("2026-07-04T12:00:00Z");
const LATER = new Date("2026-07-05T12:00:00Z");

const RECORD: TokenRecord = {
  id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  site: "blog",
  name: "テスト",
  createdAt: "2026-07-04T11:00:00.000Z",
  expiresAt: "2026-07-05T12:00:00.000Z",
};

Deno.test("Token.issue: ULIDを発行し、発行日時と失効日時を持つ", () => {
  const token = Token.issue({
    site: SiteName.from("blog"),
    name: " テスト ",
    expiresAt: LATER,
  }, NOW);

  assertMatch(token.id.value, ULID_PATTERN);
  assertEquals(token.site.value, "blog");
  assertEquals(token.name, "テスト");
  assertEquals(token.createdAt, NOW);
  assertEquals(token.expiresAt, LATER);
});

Deno.test("Token.issue: 名前が未指定・空なら既定名になる", () => {
  for (const name of [undefined, "", "   "]) {
    const token = Token.issue(
      { site: SiteName.from("blog"), name, expiresAt: LATER },
      NOW,
    );
    assertEquals(token.name, "無題のトークン");
  }
});

Deno.test("Token.issue: 現在以前の失効日時はRangeError", () => {
  for (const expiresAt of [NOW, new Date("2026-07-04T11:59:59Z")]) {
    assertThrows(
      () => Token.issue({ site: SiteName.from("blog"), expiresAt }, NOW),
      RangeError,
    );
  }
});

Deno.test("Token.reconstruct: 保存済みの値から復元し、toRecordで元に戻る", () => {
  const token = Token.reconstruct(RECORD);

  assertEquals(token.id.value, RECORD.id);
  assertEquals(token.site.value, RECORD.site);
  assertEquals(token.toRecord(), RECORD);
});

Deno.test("Token.reconstruct: 失効済みでも復元できる", () => {
  const expired = { ...RECORD, expiresAt: "2000-01-01T00:00:00.000Z" };
  assertEquals(Token.reconstruct(expired).toRecord(), expired);
});

Deno.test("Token.reconstruct: 不正なサイト名・IDはRangeError", () => {
  assertThrows(
    () => Token.reconstruct({ ...RECORD, site: "Blog!" }),
    RangeError,
  );
  assertThrows(
    () => Token.reconstruct({ ...RECORD, id: "unknown" }),
    RangeError,
  );
});

Deno.test("Token.rename: 表示名を変更し、空なら既定名にする", () => {
  const token = Token.reconstruct(RECORD);

  token.rename(" 更新後 ");
  assertEquals(token.name, "更新後");

  token.rename("   ");
  assertEquals(token.name, "無題のトークン");
});

Deno.test("Token.changeExpiry: 未来の失効日時に変更できる", () => {
  const token = Token.reconstruct(RECORD);
  const next = new Date("2026-07-06T12:00:00Z");

  token.changeExpiry(next, NOW);
  assertEquals(token.expiresAt, next);
});

Deno.test("Token.changeExpiry: 現在以前の失効日時はRangeErrorで、値は変わらない", () => {
  const token = Token.reconstruct(RECORD);

  assertThrows(() => token.changeExpiry(NOW, NOW), RangeError);
  assertEquals(token.toRecord(), RECORD);
});

Deno.test("Token.isExpiredAt: 失効日時ちょうど以降は失効とみなす", () => {
  const token = Token.reconstruct(RECORD);

  assertEquals(token.isExpiredAt(new Date("2026-07-05T11:59:59Z")), false);
  assertEquals(token.isExpiredAt(new Date("2026-07-05T12:00:00Z")), true);
  assertEquals(token.isExpiredAt(new Date("2026-07-05T12:00:01Z")), true);
});

Deno.test("Token.equals: IDが同じなら同一のトークンとみなす", () => {
  const token = Token.reconstruct(RECORD);

  assertEquals(
    token.equals(Token.reconstruct({ ...RECORD, name: "別名" })),
    true,
  );
  assertEquals(
    token.equals(
      Token.reconstruct({ ...RECORD, id: "01ARZ3NDEKTSV4RRFFQ69G5FAW" }),
    ),
    false,
  );
});

Deno.test("Token: 取得した日時を書き換えても内部状態は変わらない", () => {
  const token = Token.reconstruct(RECORD);

  token.expiresAt.setFullYear(2000);
  token.createdAt.setFullYear(2000);
  assertEquals(token.toRecord(), RECORD);
});
