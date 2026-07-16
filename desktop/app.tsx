import { Hono } from "@hono/hono";
import type { Context, MiddlewareHandler } from "@hono/hono";
import { ApiClient, ApiError } from "./api_client.ts";
import { EditPage, IndexPage, VerifyPage } from "./pages.tsx";

const errorMessage = (err: unknown): string =>
  err instanceof ApiError ? err.message : "予期しないエラーが発生しました";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * 状態を変更するリクエストを同一オリジンからのものだけに限定する
 *
 * デスクトップUIサーバーは埋め込みの管理APIキーで操作するため、ユーザーが開いた
 * 外部サイトからのクロスサイトフォーム送信（CSRF）を遮断する。ブラウザは
 * クロスオリジンのPOSTに必ずOriginヘッダーを付けるので、Host不一致を拒否する。
 */
const sameOriginOnly: MiddlewareHandler = async (ctx, next) => {
  if (!MUTATING_METHODS.has(ctx.req.method)) {
    await next();
    return;
  }

  const origin = ctx.req.header("origin");
  if (origin !== undefined) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }
    if (originHost === null || originHost !== ctx.req.header("host")) {
      return ctx.text("クロスサイトからのリクエストは許可されていません", 403);
    }
  }
  await next();
};

const redirectWithError = (ctx: Context, message: string) =>
  ctx.redirect(`/?error=${encodeURIComponent(message)}`, 303);

const redirectWithNotice = (ctx: Context, message: string) =>
  ctx.redirect(`/?notice=${encodeURIComponent(message)}`, 303);

/** フォームからサイト名・表示名・失効日時を取り出す */
const parseTokenForm = async (
  ctx: Context,
): Promise<{ site: string; name: string; expiresAt: Date | null }> => {
  const form = await ctx.req.parseBody();
  const site = typeof form.site === "string" ? form.site.trim() : "";
  const name = typeof form.name === "string" ? form.name : "";
  const expiresLocal = typeof form.expires_at === "string"
    ? form.expires_at
    : "";
  const expiresAt = expiresLocal ? new Date(expiresLocal) : null;
  return {
    site,
    name,
    expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime())
      ? expiresAt
      : null,
  };
};

/**
 * トークンCRUDを行うデスクトップ用UIを構築する
 * @param client トークン管理APIのクライアント
 * @returns Honoアプリケーション
 */
export const createDesktopApp = (client: ApiClient) => {
  const app = new Hono();

  app.use(sameOriginOnly);

  app.get("/", async (ctx) => {
    const notice = ctx.req.query("notice");
    const error = ctx.req.query("error");
    try {
      const tokens = await client.listTokens();
      return ctx.html(
        <IndexPage tokens={tokens} notice={notice} error={error} />,
      );
    } catch (err) {
      return ctx.html(<IndexPage tokens={[]} error={errorMessage(err)} />);
    }
  });

  app.post("/tokens", async (ctx) => {
    const { site, name, expiresAt } = await parseTokenForm(ctx);
    if (!site) {
      return redirectWithError(ctx, "サイト名を入力してください");
    }
    if (expiresAt === null) {
      return redirectWithError(ctx, "失効日時を入力してください");
    }
    try {
      const token = await client.createToken({
        site,
        name,
        expiresAt: expiresAt.toISOString(),
      });
      return redirectWithNotice(ctx, `トークン ${token.id} を発行しました`);
    } catch (err) {
      return redirectWithError(ctx, errorMessage(err));
    }
  });

  app.get("/tokens/:site/:id/edit", async (ctx) => {
    try {
      const token = await client.getToken(
        ctx.req.param("site"),
        ctx.req.param("id"),
      );
      return ctx.html(
        <EditPage token={token} error={ctx.req.query("error")} />,
      );
    } catch (err) {
      return redirectWithError(ctx, errorMessage(err));
    }
  });

  app.post("/tokens/:site/:id/edit", async (ctx) => {
    const site = ctx.req.param("site");
    const id = ctx.req.param("id");
    const { name, expiresAt } = await parseTokenForm(ctx);
    if (expiresAt === null) {
      return ctx.redirect(
        `/tokens/${site}/${id}/edit?error=${
          encodeURIComponent("失効日時を入力してください")
        }`,
        303,
      );
    }
    try {
      await client.updateToken(site, id, {
        name,
        expiresAt: expiresAt.toISOString(),
      });
      return redirectWithNotice(ctx, "トークンを更新しました");
    } catch (err) {
      return ctx.redirect(
        `/tokens/${site}/${id}/edit?error=${
          encodeURIComponent(errorMessage(err))
        }`,
        303,
      );
    }
  });

  app.post("/tokens/:site/:id/delete", async (ctx) => {
    try {
      await client.deleteToken(ctx.req.param("site"), ctx.req.param("id"));
      return redirectWithNotice(ctx, "トークンを失効させました");
    } catch (err) {
      return redirectWithError(ctx, errorMessage(err));
    }
  });

  app.get("/verify", async (ctx) => {
    const site = ctx.req.query("site")?.trim();
    const id = ctx.req.query("id")?.trim();
    if (!site || !id) return ctx.html(<VerifyPage site={site} id={id} />);
    try {
      const result = await client.verifyToken(site, id);
      return ctx.html(<VerifyPage site={site} id={id} result={result} />);
    } catch (err) {
      return ctx.html(
        <VerifyPage site={site} id={id} error={errorMessage(err)} />,
      );
    }
  });

  return app;
};
