import { Style } from "@hono/hono/css";
import type { Child } from "@hono/hono/jsx";
import { globalStyles, main, siteHeader } from "../styles.ts";

const copyScript = `
document.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-copy]");
  if (!button) return;
  try {
    await navigator.clipboard.writeText(button.dataset.copy);
    const original = button.textContent;
    button.textContent = "コピー済";
    setTimeout(() => { button.textContent = original; }, 1500);
  } catch {
    prompt("以下をコピーしてください", button.dataset.copy);
  }
});
`;

type LayoutProps = {
  title: string;
  /** 一覧の残り時間表示を保つため、定期的にページを再読み込みするか */
  autoRefresh?: boolean;
  children: Child;
};

export const Layout = ({ title, autoRefresh, children }: LayoutProps) => (
  <html lang="ja">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      {autoRefresh ? <meta http-equiv="refresh" content="60" /> : null}
      <title>{`${title} | Timed Access`}</title>
      <Style>{globalStyles}</Style>
    </head>
    <body>
      <header class={siteHeader}>
        <h1>Timed Access</h1>
        <nav>
          <a href="/">トークン一覧</a>
          <a href="/verify">検証</a>
        </nav>
      </header>
      <main class={main}>{children}</main>
      <script dangerouslySetInnerHTML={{ __html: copyScript }} />
    </body>
  </html>
);
