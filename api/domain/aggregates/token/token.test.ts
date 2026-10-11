import { assertEquals, assertMatch, assertThrows } from "@std/assert";
import { ValidationError } from "../../shared/validation.error.ts";
import { Token } from "./token.ts";
import { SiteName } from "./value-objects/site-name.ts";
import { TokenId } from "./value-objects/token-id.ts";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const NOW = new Date("2026-07-04T12:00:00Z");
const LATER = new Date("2026-07-05T12:00:00Z");

/** 復元に使う値（ドメインの型だけで表す） */
const PROPS = {
  id: TokenId.from("01ARZ3NDEKTSV4RRFFQ69G5FAV"),
  site: SiteName.from("blog"),
  name: "テスト",
  createdAt: new Date("2026-07-04T11:00:00.000Z"),
  expiresAt: new Date("2026-07-05T12:00:00.000Z"),
};

/** Entityの状態を比較しやすい値に取り出す */
const stateOf = (token: Token) => ({
  id: token.id.value,
  site: token.site.value,
  name: token.name,
  createdAt: token.createdAt.getTime(),
  expiresAt: token.expiresAt.getTime(),
});

const PROPS_STATE = {
  id: PROPS.id.value,
  site: PROPS.site.value,
  name: PROPS.name,
  createdAt: PROPS.createdAt.getTime(),
  expiresAt: PROPS.expiresAt.getTime(),
};

Deno.test("Token.create: ULIDを発行し、発行日時と失効日時を持つ", () => {
  const token = Token.create({
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

Deno.test("Token.create: 名前が未指定・空なら既定名になる", () => {
  for (const name of [undefined, "", "   "]) {
    const token = Token.create(
      { site: SiteName.from("blog"), name, expiresAt: LATER },
      NOW,
    );
    assertEquals(token.name, "無題のトークン");
  }
});

Deno.test("Token.create: 現在以前の失効日時はValidationError", () => {
  for (const expiresAt of [NOW, new Date("2026-07-04T11:59:59Z")]) {
    assertThrows(
      () => Token.create({ site: SiteName.from("blog"), expiresAt }, NOW),
      ValidationError,
    );
  }
});

Deno.test("Token.restore: ドメインの型で表した値から復元する", () => {
  assertEquals(stateOf(Token.restore(PROPS)), PROPS_STATE);
});

Deno.test("Token.restore: 失効済みでも復元できる", () => {
  const expiresAt = new Date("2000-01-01T00:00:00.000Z");
  assertEquals(
    Token.restore({ ...PROPS, expiresAt }).expiresAt,
    expiresAt,
  );
});

Deno.test("Token.restore: 日時として不正な値はValidationError", () => {
  const invalid = new Date("not a date");

  assertThrows(
    () => Token.restore({ ...PROPS, createdAt: invalid }),
    ValidationError,
  );
  assertThrows(
    () => Token.restore({ ...PROPS, expiresAt: invalid }),
    ValidationError,
  );
});

Deno.test("Token.restore: 渡した日時を後から書き換えても内部状態は変わらない", () => {
  const createdAt = new Date(PROPS.createdAt);
  const expiresAt = new Date(PROPS.expiresAt);
  const token = Token.restore({ ...PROPS, createdAt, expiresAt });

  createdAt.setFullYear(2000);
  expiresAt.setFullYear(2000);
  assertEquals(stateOf(token), PROPS_STATE);
});

Deno.test("Token.rename: 表示名を変更し、空なら既定名にする", () => {
  const token = Token.restore(PROPS);

  token.rename(" 更新後 ");
  assertEquals(token.name, "更新後");

  token.rename("   ");
  assertEquals(token.name, "無題のトークン");
});

Deno.test("Token.changeExpiry: 未来の失効日時に変更できる", () => {
  const token = Token.restore(PROPS);
  const next = new Date("2026-07-06T12:00:00Z");

  token.changeExpiry(next, NOW);
  assertEquals(token.expiresAt, next);
});

Deno.test("Token.changeExpiry: 現在以前の失効日時はValidationErrorで、値は変わらない", () => {
  const token = Token.restore(PROPS);

  assertThrows(() => token.changeExpiry(NOW, NOW), ValidationError);
  assertEquals(stateOf(token), PROPS_STATE);
});

Deno.test("Token.isExpiredAt: 失効日時ちょうど以降は失効とみなす", () => {
  const token = Token.restore(PROPS);

  assertEquals(token.isExpiredAt(new Date("2026-07-05T11:59:59Z")), false);
  assertEquals(token.isExpiredAt(new Date("2026-07-05T12:00:00Z")), true);
  assertEquals(token.isExpiredAt(new Date("2026-07-05T12:00:01Z")), true);
});

Deno.test("Token.equals: サイト名とIDの組が同じなら同一のトークンとみなす", () => {
  const token = Token.restore(PROPS);

  assertEquals(token.equals(Token.restore({ ...PROPS, name: "別名" })), true);
  assertEquals(
    token.equals(
      Token.restore({
        ...PROPS,
        id: TokenId.from("01ARZ3NDEKTSV4RRFFQ69G5FAW"),
      }),
    ),
    false,
  );
  // リポジトリはサイト名とIDの組で保存・取得するため、IDが同じでもサイトが違えば別物
  assertEquals(
    token.equals(
      Token.restore({ ...PROPS, site: SiteName.from("other-site") }),
    ),
    false,
  );
});

Deno.test("Token: 取得した日時を書き換えても内部状態は変わらない", () => {
  const token = Token.restore(PROPS);

  token.expiresAt.setFullYear(2000);
  token.createdAt.setFullYear(2000);
  assertEquals(stateOf(token), PROPS_STATE);
});

Deno.test("Token: 永続化やHTTPの形式への変換は持たない", () => {
  assertEquals("toRecord" in Token.restore(PROPS), false);
});
