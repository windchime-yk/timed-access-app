import { assertEquals, assertMatch, assertThrows } from "@std/assert";
import { TokenId } from "./token-id.value-object.ts";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

Deno.test("TokenId.generate: ULIDを発行し、後から発行したものほど大きい", () => {
  const first = TokenId.generate();
  const second = TokenId.generate();

  assertMatch(first.value, ULID_PATTERN);
  assertMatch(second.value, ULID_PATTERN);
  assertEquals(first.value < second.value, true);
});

Deno.test("TokenId.from: ULIDを受け付ける", () => {
  const value = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
  assertEquals(TokenId.from(value).value, value);
});

Deno.test("TokenId.from: ULIDでない値はRangeError", () => {
  for (
    const value of [
      undefined,
      1,
      "",
      "unknown",
      "01arz3ndektsv4rrffq69g5fav",
      "01ARZ3NDEKTSV4RRFFQ69G5FA",
      "01ARZ3NDEKTSV4RRFFQ69G5FAVX",
      "01ARZ3NDEKTSV4RRFFQ69G5FAI",
    ]
  ) {
    assertThrows(
      () => TokenId.from(value),
      RangeError,
      undefined,
      String(value),
    );
  }
});

Deno.test("TokenId.tryFrom: ULIDでない値はnullを返す", () => {
  const value = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
  assertEquals(TokenId.tryFrom(value)?.value, value);
  assertEquals(TokenId.tryFrom("unknown"), null);
});

Deno.test("TokenId.equals: 値が同じなら等しい", () => {
  const value = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
  assertEquals(TokenId.from(value).equals(TokenId.from(value)), true);
  assertEquals(TokenId.from(value).equals(TokenId.generate()), false);
});

Deno.test("TokenId.toString: 値をそのまま返す", () => {
  const value = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
  assertEquals(`${TokenId.from(value)}`, value);
});
