import type { MiddlewareHandler } from "@hono/hono";
import { HTTPException } from "@hono/hono/http-exception";
import { STATUS_CODE } from "@std/http/status";
import { API_KEY_ENV, API_KEY_HEADER } from "../../shared/mod.ts";

/** 環境変数のAPIキーと一致するリクエストだけを通すミドルウェア */
export const requireApiKey: MiddlewareHandler = (ctx, next) => {
  const expected = Deno.env.get(API_KEY_ENV);
  if (!expected || ctx.req.header(API_KEY_HEADER) !== expected) {
    throw new HTTPException(STATUS_CODE.Unauthorized, {
      message: `有効なAPIキーを ${API_KEY_HEADER} ヘッダーに設定してください`,
    });
  }
  return next();
};
