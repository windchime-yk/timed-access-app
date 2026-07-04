import { assertEquals } from "@std/assert";
import { toDatetimeLocal } from "./datetime.ts";

Deno.test("toDatetimeLocal: 秒を含まない分単位のローカル日時文字列を返す", () => {
  // ローカルタイムのDateを渡すとローカルのgetterでそのまま整形される
  const date = new Date(2026, 6, 4, 9, 5, 3);
  assertEquals(toDatetimeLocal(date), "2026-07-04T09:05");
});

Deno.test("toDatetimeLocal: Dateとその値をISO化した文字列で結果が一致する", () => {
  const date = new Date(2026, 11, 31, 23, 59);
  assertEquals(toDatetimeLocal(date), toDatetimeLocal(date.toISOString()));
  assertEquals(toDatetimeLocal(date), "2026-12-31T23:59");
});
