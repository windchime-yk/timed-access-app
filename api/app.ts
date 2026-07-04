import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";
import { cors } from "@hono/hono/cors";
import { HTTPException } from "@hono/hono/http-exception";
import { STATUS_CODE } from "@std/http/status";
import type { TokenCreateInput, TokenUpdateInput } from "../shared/mod.ts";
import { requireApiKey } from "./middleware/api_key.ts";
import { rateLimit, type RateLimitOptions } from "./middleware/rate_limit.ts";
import type { TokenStore } from "./store.ts";

/**
 * リクエストボディをJSONとして解釈する
 * @throws {HTTPException} 解釈できない場合は400
 */
const parseJsonBody = async <T>(ctx: Context): Promise<T> => {
  try {
    return await ctx.req.json<T>();
  } catch {
    throw new HTTPException(STATUS_CODE.BadRequest, {
      message: "リクエストボディをJSONとして解釈できません",
    });
  }
};

/**
 * 失効日時の入力値を検証してDateに変換する
 * @throws {HTTPException} 日時として不正、または過去の日時の場合は400
 */
const parseExpiresAt = (value: unknown): Date => {
  const date = typeof value === "string" ? new Date(value) : null;
  if (date === null || Number.isNaN(date.getTime())) {
    throw new HTTPException(STATUS_CODE.BadRequest, {
      message: "expiresAt はISO 8601形式の日時で指定してください",
    });
  }
  if (date.getTime() <= Date.now()) {
    throw new HTTPException(STATUS_CODE.BadRequest, {
      message: "expiresAt は未来の日時を指定してください",
    });
  }
  return date;
};

const tokenNotFound = () =>
  new HTTPException(STATUS_CODE.NotFound, {
    message: "指定されたトークンは存在しないか、既に失効しています",
  });

/**
 * トークン発行・検証APIを構築する
 * @param store トークンの永続化層
 * @returns Honoアプリケーション
 */
export type AppOptions = {
  /** 公開エンドポイント /verify のレート制限（既定: 60回/分/IP） */
  verifyRateLimit?: RateLimitOptions;
};

export const createApp = (store: TokenStore, options: AppOptions = {}) => {
  const app = new Hono();

  // トークンの管理操作はAPIキー必須
  app.use("/tokens", requireApiKey);
  app.use("/tokens/*", requireApiKey);

  // 検証は外部アプリからも呼ばれるため認証不要とし、ブラウザ向けにCORSを許可する。
  // そのぶん公開エンドポイントとして乱用されないようレート制限をかける
  app.use("/verify/*", cors());
  app.use(
    "/verify/*",
    rateLimit(options.verifyRateLimit ?? { limit: 60, windowMs: 60_000 }),
  );

  app.post("/tokens", async (ctx) => {
    const body = await parseJsonBody<TokenCreateInput>(ctx);
    const token = await store.create({
      name: body.name,
      expiresAt: parseExpiresAt(body.expiresAt),
    });
    return ctx.json(token, STATUS_CODE.Created);
  });

  app.get("/tokens", async (ctx) => {
    return ctx.json({ tokens: await store.list() });
  });

  app.get("/tokens/:id", async (ctx) => {
    const token = await store.get(ctx.req.param("id"));
    if (token === null) throw tokenNotFound();
    return ctx.json(token);
  });

  app.patch("/tokens/:id", async (ctx) => {
    const body = await parseJsonBody<TokenUpdateInput>(ctx);
    const token = await store.update(ctx.req.param("id"), {
      name: body.name,
      expiresAt: body.expiresAt === undefined
        ? undefined
        : parseExpiresAt(body.expiresAt),
    });
    if (token === null) throw tokenNotFound();
    return ctx.json(token);
  });

  app.delete("/tokens/:id", async (ctx) => {
    const deleted = await store.delete(ctx.req.param("id"));
    if (!deleted) throw tokenNotFound();
    return ctx.body(null, STATUS_CODE.NoContent);
  });

  app.get("/verify/:id", async (ctx) => {
    // 有効性の判定結果が中間キャッシュに残らないようにする
    ctx.header("cache-control", "no-store");
    return ctx.json(await store.verify(ctx.req.param("id")));
  });

  app.notFound((ctx) =>
    ctx.json({
      status: STATUS_CODE.NotFound,
      message: "お探しのエンドポイントは存在しません",
    }, STATUS_CODE.NotFound)
  );

  app.onError((err, ctx) => {
    if (err instanceof HTTPException) {
      return ctx.json({ status: err.status, message: err.message }, err.status);
    }
    if (err instanceof RangeError) {
      return ctx.json(
        { status: STATUS_CODE.BadRequest, message: err.message },
        STATUS_CODE.BadRequest,
      );
    }
    console.error(err);
    return ctx.json({
      status: STATUS_CODE.InternalServerError,
      message: "サーバー内部でエラーが発生しました",
    }, STATUS_CODE.InternalServerError);
  });

  return app;
};
