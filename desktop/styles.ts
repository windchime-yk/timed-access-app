import { css } from "@hono/hono/css";

/** 全ページ共通のグローバルスタイル（Layoutの<Style>から出力される） */
export const globalStyles = css`
  :root {
    --bg: #f5f6f8;
    --surface: #ffffff;
    --text: #1f2328;
    --text-muted: #6b7280;
    --border: #e2e5ea;
    --accent: #2563eb;
    --accent-text: #ffffff;
    --danger: #dc2626;
    --success: #16a34a;
    color-scheme: light dark;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #16181d;
      --surface: #1f232b;
      --text: #e6e8eb;
      --text-muted: #9ca3af;
      --border: #333945;
      --accent: #3b82f6;
    }
  }
  * {
    box-sizing: border-box;
  }
  body {
    margin: 0;
    font-family: system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.6;
  }
  code {
    font-family: ui-monospace, monospace;
    font-size: 0.85em;
    word-break: break-all;
  }
  small {
    color: var(--text-muted);
  }
`;

export const siteHeader = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1.5rem;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  h1 {
    margin: 0;
    font-size: 1.1rem;
  }
  nav {
    display: flex;
    gap: 1rem;
  }
  a {
    color: var(--text-muted);
    text-decoration: none;
    font-size: 0.9rem;
  }
  a:hover {
    color: var(--accent);
  }
`;

export const main = css`
  max-width: 64rem;
  margin: 0 auto;
  padding: 1.5rem;
  display: grid;
  gap: 1.5rem;
`;

export const card = css`
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1.25rem 1.5rem;
  h2 {
    margin: 0 0 1rem;
    font-size: 1rem;
  }
`;

export const banner = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
`;

export const toastClose = css`
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: inherit;
  font-size: 1.2rem;
  line-height: 1;
  padding: 0 0.25rem;
  cursor: pointer;
  opacity: 0.7;
  &:hover {
    opacity: 1;
  }
`;

export const bannerNotice = css`
  background: color-mix(in srgb, var(--success) 12%, transparent);
  color: var(--success);
`;

export const bannerError = css`
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
`;

export const stackForm = css`
  display: grid;
  gap: 0.75rem;
  justify-items: start;
  label {
    display: grid;
    gap: 0.25rem;
    font-size: 0.85rem;
    color: var(--text-muted);
  }
  input[type="text"],
  input[type="datetime-local"] {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    background: var(--bg);
    color: var(--text);
    font: inherit;
    min-width: 18rem;
  }
`;

/*
 * ボタンはcx(button, buttonXxx)で使う。cxはスタイルを1つのクラスにマージするため、
 * ネストした&:hoverの後ろに宣言が続かないよう、&:hoverは各バリアント側の末尾に置く
 */
export const button = css`
  padding: 0.45rem 1rem;
  border: 1px solid transparent;
  border-radius: 0.5rem;
  font: inherit;
  font-size: 0.9rem;
  cursor: pointer;
  text-decoration: none;
`;

export const buttonPrimary = css`
  background: var(--accent);
  color: var(--accent-text);
  &:hover {
    filter: brightness(1.1);
  }
`;

export const buttonDanger = css`
  background: transparent;
  border-color: var(--danger);
  color: var(--danger);
  &:hover {
    filter: brightness(1.1);
  }
`;

export const buttonGhost = css`
  background: transparent;
  border-color: var(--border);
  color: var(--text);
  &:hover {
    filter: brightness(1.1);
  }
`;

export const table = css`
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  th,
  td {
    text-align: left;
    padding: 0.6rem 0.5rem;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  th {
    color: var(--text-muted);
    font-weight: 600;
    font-size: 0.8rem;
  }
  form {
    margin: 0;
  }
`;

export const actions = css`
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

export const empty = css`
  color: var(--text-muted);
`;

export const verifyResult = css`
  display: grid;
  gap: 0.5rem;
`;

export const status = css`
  font-size: 1.1rem;
  font-weight: 700;
`;

export const statusValid = css`
  color: var(--success);
`;

export const statusInvalid = css`
  color: var(--danger);
`;

export const dialog = css`
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  padding: 1.25rem 1.5rem;
  background: var(--surface);
  color: var(--text);
  max-width: 26rem;
  &::backdrop {
    background: rgba(0, 0, 0, 0.4);
  }
  p {
    margin: 0 0 1rem;
  }
  menu {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    margin: 0;
    padding: 0;
  }
`;
