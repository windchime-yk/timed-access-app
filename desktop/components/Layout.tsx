import { cx, Style } from "@hono/hono/css";
import type { Child } from "@hono/hono/jsx";
import {
  button,
  buttonDanger,
  buttonGhost,
  dialog,
  globalStyles,
  main,
  siteHeader,
} from "../styles.ts";

// confirm()/prompt() はwebview（WKWebView等）で無反応になり得るため使わない。
// 削除確認は<dialog>で行い、コピーはclipboard→execCommandでフォールバックする。
const uiScript = `
(function () {
  var dialog = document.getElementById("confirm-dialog");
  var messageEl = document.getElementById("confirm-message");
  var pendingForm = null;

  document.addEventListener("submit", function (event) {
    var form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.dataset.confirm) return;
    event.preventDefault();
    pendingForm = form;
    messageEl.textContent = form.dataset.confirm;
    if (dialog && typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      var f = pendingForm;
      pendingForm = null;
      if (f) f.submit();
    }
  });

  if (dialog) {
    dialog.addEventListener("close", function () {
      var form = pendingForm;
      pendingForm = null;
      if (dialog.returnValue === "confirm" && form) form.submit();
    });
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (_) { /* fall through */ }
    try {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      var ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch (_) {
      return false;
    }
  }

  document.addEventListener("click", async function (event) {
    var button = event.target.closest("[data-copy]");
    if (!button) return;
    var ok = await copyText(button.dataset.copy);
    var original = button.textContent;
    button.textContent = ok ? "コピー済" : "コピー失敗";
    setTimeout(function () { button.textContent = original; }, 1500);
  });

  // トースト: 数秒で自動的に消え、閉じるボタンでも消せる
  function dismissToast(el) {
    el.style.transition = "opacity .3s";
    el.style.opacity = "0";
    setTimeout(function () { el.remove(); }, 300);
  }
  document.addEventListener("click", function (event) {
    var closeBtn = event.target.closest("[data-dismiss]");
    if (!closeBtn) return;
    var toast = closeBtn.closest("[data-toast]");
    if (toast) dismissToast(toast);
  });

  // URLに残る通知パラメータを消し、再読み込みでトーストが復活しないようにする
  var params = new URLSearchParams(location.search);
  if (params.has("notice") || params.has("error")) {
    history.replaceState(null, "", location.pathname);
  }
  document.querySelectorAll("[data-toast]").forEach(function (el) {
    setTimeout(function () { dismissToast(el); }, 5000);
  });

  // 残り時間表示を保つための定期リロード。通知パラメータを引き継がないよう
  // クエリを除いたパスへ再読み込みする（meta refreshだと古い?notice=…が復活する）
  var refreshSec = document.body.getAttribute("data-auto-refresh");
  if (refreshSec) {
    setTimeout(function () {
      location.replace(location.pathname);
    }, Number(refreshSec) * 1000);
  }
})();
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
      <title>{`${title} | Timed Access`}</title>
      <Style>{globalStyles}</Style>
    </head>
    <body data-auto-refresh={autoRefresh ? "60" : undefined}>
      <header class={siteHeader}>
        <h1>Timed Access</h1>
        <nav>
          <a href="/">トークン一覧</a>
          <a href="/verify">検証</a>
        </nav>
      </header>
      <main class={main}>{children}</main>
      <dialog id="confirm-dialog" class={dialog}>
        <form method="dialog">
          <p id="confirm-message"></p>
          <menu>
            <button
              type="submit"
              value="cancel"
              class={cx(button, buttonGhost)}
            >
              キャンセル
            </button>
            <button
              type="submit"
              value="confirm"
              class={cx(button, buttonDanger)}
            >
              実行する
            </button>
          </menu>
        </form>
      </dialog>
      <script dangerouslySetInnerHTML={{ __html: uiScript }} />
    </body>
  </html>
);
