import { cx } from "@hono/hono/css";
import type { TokenRecord, VerifyResult } from "../shared/mod.ts";
import { Layout } from "./components/Layout.tsx";
import {
  formatDateTime,
  formatRemaining,
  toDatetimeLocal,
} from "./datetime.ts";
import * as styles from "./styles.ts";

const Toast = (
  { kind, message }: { kind: "notice" | "error"; message: string },
) => (
  <div
    class={cx(
      styles.banner,
      kind === "notice" ? styles.bannerNotice : styles.bannerError,
    )}
    data-toast
    role={kind === "error" ? "alert" : "status"}
  >
    <span>{message}</span>
    <button
      type="button"
      class={styles.toastClose}
      data-dismiss
      aria-label="閉じる"
    >
      ×
    </button>
  </div>
);

const Banners = ({ notice, error }: { notice?: string; error?: string }) => (
  <>
    {notice ? <Toast kind="notice" message={notice} /> : null}
    {error ? <Toast kind="error" message={error} /> : null}
  </>
);

const TokenTable = ({ tokens }: { tokens: TokenRecord[] }) => {
  if (tokens.length === 0) {
    return <p class={styles.empty}>有効なトークンはありません。</p>;
  }
  return (
    <table class={styles.table}>
      <thead>
        <tr>
          <th>トークン（ULID）</th>
          <th>表示名</th>
          <th>発行日時</th>
          <th>失効日時</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        {tokens.map((token) => (
          <tr>
            <td>
              <code>{token.id}</code>
            </td>
            <td>{token.name}</td>
            <td>{formatDateTime(token.createdAt)}</td>
            <td>
              {formatDateTime(token.expiresAt)}
              <br />
              <small>{formatRemaining(token.expiresAt)}</small>
            </td>
            <td>
              <div class={styles.actions}>
                <button
                  type="button"
                  class={cx(styles.button, styles.buttonGhost)}
                  data-copy={token.id}
                >
                  コピー
                </button>
                <a
                  class={cx(styles.button, styles.buttonGhost)}
                  href={`/tokens/${token.id}/edit`}
                >
                  編集
                </a>
                <form
                  method="post"
                  action={`/tokens/${token.id}/delete`}
                  data-confirm={`トークン「${token.name}」を失効させますか？`}
                >
                  <button
                    type="submit"
                    class={cx(styles.button, styles.buttonDanger)}
                  >
                    失効
                  </button>
                </form>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

type IndexPageProps = {
  tokens: TokenRecord[];
  notice?: string;
  error?: string;
};

export const IndexPage = ({ tokens, notice, error }: IndexPageProps) => (
  <Layout title="トークン一覧" autoRefresh>
    <Banners notice={notice} error={error} />
    <section class={styles.card}>
      <h2>新しいトークンを発行</h2>
      <form class={styles.stackForm} method="post" action="/tokens">
        <label>
          表示名（任意）
          <input type="text" name="name" placeholder="例：社外向け共有リンク" />
        </label>
        <label>
          失効日時
          <input
            type="datetime-local"
            name="expires_at"
            required
            min={toDatetimeLocal(new Date())}
          />
        </label>
        <button type="submit" class={cx(styles.button, styles.buttonPrimary)}>
          発行する
        </button>
      </form>
    </section>
    <section class={styles.card}>
      <h2>発行済みトークン</h2>
      <TokenTable tokens={tokens} />
    </section>
  </Layout>
);

type EditPageProps = {
  token: TokenRecord;
  error?: string;
};

export const EditPage = ({ token, error }: EditPageProps) => (
  <Layout title="トークンを編集">
    <Banners error={error} />
    <section class={styles.card}>
      <h2>
        トークンを編集：<code>{token.id}</code>
      </h2>
      <form
        class={styles.stackForm}
        method="post"
        action={`/tokens/${token.id}/edit`}
      >
        <label>
          表示名
          <input type="text" name="name" value={token.name} />
        </label>
        <label>
          失効日時
          <input
            type="datetime-local"
            name="expires_at"
            required
            value={toDatetimeLocal(token.expiresAt)}
            min={toDatetimeLocal(new Date())}
          />
        </label>
        <div class={styles.actions}>
          <button type="submit" class={cx(styles.button, styles.buttonPrimary)}>
            更新する
          </button>
          <a class={cx(styles.button, styles.buttonGhost)} href="/">
            キャンセル
          </a>
        </div>
      </form>
    </section>
  </Layout>
);

type VerifyPageProps = {
  id?: string;
  result?: VerifyResult;
  error?: string;
};

export const VerifyPage = ({ id, result, error }: VerifyPageProps) => (
  <Layout title="トークン検証">
    <Banners error={error} />
    <section class={styles.card}>
      <h2>トークンを検証</h2>
      <form class={styles.stackForm} method="get" action="/verify">
        <label>
          トークン（ULID）
          <input
            type="text"
            name="id"
            required
            value={id ?? ""}
            placeholder="26文字のULIDを入力"
          />
        </label>
        <button type="submit" class={cx(styles.button, styles.buttonPrimary)}>
          検証する
        </button>
      </form>
    </section>
    {result
      ? (
        <section class={cx(styles.card, styles.verifyResult)}>
          {result.valid && result.token
            ? (
              <>
                <p class={cx(styles.status, styles.statusValid)}>
                  有効なトークンです
                </p>
                <p>
                  <code>{result.token.id}</code>（{result.token.name}）
                </p>
                <p>
                  失効日時：{formatDateTime(result.token.expiresAt)}（
                  {formatRemaining(result.token.expiresAt)}）
                </p>
              </>
            )
            : (
              <p class={cx(styles.status, styles.statusInvalid)}>
                無効または失効済みのトークンです
              </p>
            )}
        </section>
      )
      : null}
  </Layout>
);
