import { assertEquals, assertThrows } from "@std/assert";
import { SiteName } from "./site-name.ts";

Deno.test("SiteName.from: 英小文字・数字・ハイフン1〜64文字を受け付ける", () => {
  for (const value of ["blog", "my-site-2", "a".repeat(64)]) {
    assertEquals(SiteName.from(value).value, value);
  }
});

Deno.test("SiteName.from: 不正な値はRangeError", () => {
  for (
    const value of [undefined, 1, "", "Blog", "日本語", "a b", "a".repeat(65)]
  ) {
    assertThrows(
      () => SiteName.from(value),
      RangeError,
      undefined,
      String(value),
    );
  }
});

Deno.test("SiteName.tryFrom: 不正な値はnullを返す", () => {
  assertEquals(SiteName.tryFrom("blog")?.value, "blog");
  assertEquals(SiteName.tryFrom("Blog!"), null);
  assertEquals(SiteName.tryFrom(undefined), null);
});

Deno.test("SiteName.equals: 値が同じなら等しい", () => {
  assertEquals(SiteName.from("blog").equals(SiteName.from("blog")), true);
  assertEquals(SiteName.from("blog").equals(SiteName.from("blog-2")), false);
});

Deno.test("SiteName.toString: 値をそのまま返す", () => {
  assertEquals(`${SiteName.from("blog")}`, "blog");
});
