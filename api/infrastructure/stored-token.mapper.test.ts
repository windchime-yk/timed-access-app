import { assertEquals, assertThrows } from "@std/assert";
import { ValidationError } from "../domain/shared/validation.error.ts";
import { CorruptedStoredTokenError } from "./corrupted-stored-token.error.ts";
import { Token } from "../domain/aggregates/token/token.ts";
import { SiteName } from "../domain/aggregates/token/value-objects/site-name.ts";
import { TokenId } from "../domain/aggregates/token/value-objects/token-id.ts";
import {
  fromStoredToken,
  type StoredToken,
  toStoredToken,
} from "./stored-token.mapper.ts";

/** 既存のDeno KVに保存されている値と同じ形 */
const STORED: StoredToken = {
  id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
  site: "blog",
  name: "テスト",
  createdAt: "2026-07-04T11:00:00.000Z",
  expiresAt: "2026-07-05T12:00:00.000Z",
};

Deno.test("toStoredToken: Entityを既存の保存形式に変換する", () => {
  const token = Token.restore({
    id: TokenId.from(STORED.id),
    site: SiteName.from(STORED.site),
    name: STORED.name,
    createdAt: new Date(STORED.createdAt),
    expiresAt: new Date(STORED.expiresAt),
  });

  assertEquals(toStoredToken(token), STORED);
});

Deno.test("fromStoredToken: 保存形式からEntityを復元し、元の形に戻せる", () => {
  const token = fromStoredToken(STORED);

  assertEquals(token instanceof Token, true);
  assertEquals(toStoredToken(token), STORED);
});

Deno.test("fromStoredToken: 壊れた保存データはCorruptedStoredTokenErrorで、入力のエラーとは区別する", () => {
  const broken: Partial<Record<keyof StoredToken, string>>[] = [
    { site: "Blog!" },
    { id: "unknown" },
    { createdAt: "not a date" },
    { expiresAt: "not a date" },
  ];
  for (const patch of broken) {
    const error = assertThrows(
      () => fromStoredToken({ ...STORED, ...patch }),
      CorruptedStoredTokenError,
      undefined,
      JSON.stringify(patch),
    );
    assertEquals(error instanceof ValidationError, false);
    assertEquals(error.cause instanceof ValidationError, true);
  }
});

Deno.test("fromStoredToken: 保存データにフィールドが欠けていてもCorruptedStoredTokenError", () => {
  const { site: _site, ...withoutSite } = STORED;
  assertThrows(
    () => fromStoredToken(withoutSite as StoredToken),
    CorruptedStoredTokenError,
  );
});
