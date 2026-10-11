import { assertEquals, assertThrows } from "@std/assert";
import { ValidationError } from "../domain/shared/validation.error.ts";
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

Deno.test("fromStoredToken: 不正なサイト名・IDはValidationError", () => {
  assertThrows(
    () => fromStoredToken({ ...STORED, site: "Blog!" }),
    ValidationError,
  );
  assertThrows(
    () => fromStoredToken({ ...STORED, id: "unknown" }),
    ValidationError,
  );
});
