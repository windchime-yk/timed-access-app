import { assertEquals, assertThrows } from "@std/assert";
import {
  assertFutureExpiry,
  DEFAULT_TOKEN_NAME,
  isExpired,
  isValidSiteName,
  normalizeName,
} from "./token.ts";

Deno.test("isExpired: 失効日時を過ぎたトークンをtrueと判定する", () => {
  const base = {
    id: "01ARZ3NDEKTSV4RRFFQ69G5FAV",
    site: "blog",
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

Deno.test("normalizeName: 前後の空白を除き、空なら既定名にする", () => {
  assertEquals(normalizeName(" テスト "), "テスト");
  assertEquals(normalizeName(undefined), DEFAULT_TOKEN_NAME);
  assertEquals(normalizeName(""), DEFAULT_TOKEN_NAME);
  assertEquals(normalizeName("   "), DEFAULT_TOKEN_NAME);
  assertEquals(DEFAULT_TOKEN_NAME, "無題のトークン");
});

Deno.test("assertFutureExpiry: 現在以前の失効日時はRangeError", () => {
  const now = new Date("2026-07-04T12:00:00Z");

  assertThrows(
    () => assertFutureExpiry(new Date("2026-07-04T11:59:59Z"), now),
    RangeError,
  );
  assertThrows(
    () => assertFutureExpiry(new Date("2026-07-04T12:00:00Z"), now),
    RangeError,
  );
  assertFutureExpiry(new Date("2026-07-04T12:00:01Z"), now);
});

Deno.test("isValidSiteName: 英小文字・数字・ハイフン1〜64文字のみ許可する", () => {
  for (const site of ["blog", "my-site-2", "a".repeat(64)]) {
    assertEquals(isValidSiteName(site), true, site);
  }
  for (
    const site of [undefined, 1, "", "Blog", "日本語", "a b", "a".repeat(65)]
  ) {
    assertEquals(isValidSiteName(site), false, String(site));
  }
});
