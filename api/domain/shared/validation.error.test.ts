import { assertEquals, assertInstanceOf } from "@std/assert";
import { ValidationError } from "./validation.error.ts";

Deno.test("ValidationError: メッセージを持つErrorとして扱える", () => {
  const error = new ValidationError("不正な値です");

  assertInstanceOf(error, Error);
  assertEquals(error.name, "ValidationError");
  assertEquals(error.message, "不正な値です");
});

Deno.test("ValidationError: RangeErrorとは区別できる", () => {
  assertEquals(new ValidationError("x") instanceof RangeError, false);
  assertEquals(new RangeError("x") instanceof ValidationError, false);
});
