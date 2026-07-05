import type { Context, MiddlewareHandler } from "@hono/hono";
import { getConnInfo } from "@hono/hono/deno";
import { HTTPException } from "@hono/hono/http-exception";
import { STATUS_CODE } from "@std/http/status";

type Bucket = {
  count: number;
  resetAt: number;
};

export type RateLimitOptions = {
  /** ウィンドウあたりの許容リクエスト数 */
  limit: number;
  /** ウィンドウ長（ミリ秒） */
  windowMs: number;
  /** クライアント識別子の取得方法（既定はIPアドレス） */
  keyOf?: (ctx: Context) => string;
};

/** 掃除を発火させるバケット数の閾値（メモリの無制限な増加を防ぐ） */
const SWEEP_THRESHOLD = 10_000;

/**
 * 信頼するリバースプロキシの段数を TRUST_PROXY から読む
 *
 * `true`（=1段）または正の整数を指定する。直接公開時は未設定のままにする。
 * @returns 信頼する段数。0なら x-forwarded-for を信頼しない
 */
const trustedProxyHops = (): number => {
  const raw = Deno.env.get("TRUST_PROXY");
  if (raw === undefined || raw === "" || raw === "false") return 0;
  if (raw === "true") return 1;
  const hops = Number(raw);
  return Number.isInteger(hops) && hops > 0 ? hops : 0;
};

/**
 * クライアントのIPアドレスを取得する
 *
 * リバースプロキシ配下では TRUST_PROXY に信頼する段数を設定する。
 * x-forwarded-for は各プロキシが接続元IPを右へ追記するため、信頼できるのは
 * 末尾側の段数ぶんだけ。クライアントが偽装できる先頭側は採用しない。
 */
const clientAddress = (ctx: Context): string => {
  const hops = trustedProxyHops();
  if (hops > 0) {
    const parts = ctx.req.header("x-forwarded-for")
      ?.split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    if (parts && parts.length > 0) {
      // 末尾から hops 段さかのぼった位置が、信頼できる最も外側のクライアントIP
      return parts[Math.max(0, parts.length - hops)];
    }
  }
  try {
    return getConnInfo(ctx).remote.address ?? "unknown";
  } catch {
    // app.request() などDeno.serveを経由しない呼び出しでは接続情報が無い
    return "unknown";
  }
};

/**
 * 固定ウィンドウ方式のインメモリレート制限ミドルウェアを作る
 *
 * 制限内のレスポンスにも RateLimit-* ヘッダーを付け、超過時は
 * Retry-After ヘッダー付きの429を返す
 */
export const rateLimit = (
  { limit, windowMs, keyOf = clientAddress }: RateLimitOptions,
): MiddlewareHandler => {
  // 不正な閾値はレート制限を黙って無効化してしまうため、構築時に弾く
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new RangeError(
      `rateLimitのlimitは正の整数を指定してください: ${limit}`,
    );
  }
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    throw new RangeError(
      `rateLimitのwindowMsは正の数を指定してください: ${windowMs}`,
    );
  }

  const buckets = new Map<string, Bucket>();

  const sweep = (now: number) => {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  };

  return async (ctx, next) => {
    const now = Date.now();
    if (buckets.size >= SWEEP_THRESHOLD) sweep(now);

    const key = keyOf(ctx);
    const current = buckets.get(key);
    const bucket = current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + windowMs };
    bucket.count += 1;
    buckets.set(key, bucket);

    const resetSeconds = Math.ceil((bucket.resetAt - now) / 1000);
    ctx.header("ratelimit-limit", String(limit));
    ctx.header(
      "ratelimit-remaining",
      String(Math.max(0, limit - bucket.count)),
    );
    ctx.header("ratelimit-reset", String(resetSeconds));

    if (bucket.count > limit) {
      ctx.header("retry-after", String(resetSeconds));
      throw new HTTPException(STATUS_CODE.TooManyRequests, {
        message: "リクエストが多すぎます。時間をおいて再試行してください",
      });
    }

    await next();
  };
};
