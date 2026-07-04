/**
 * ISO日時文字列を input[type=datetime-local] 用のローカル日時文字列に変換する
 * @param iso ISO 8601形式の日時文字列
 * @returns "YYYY-MM-DDTHH:mm" 形式のローカル日時文字列
 */
export const toDatetimeLocal = (iso: string): string => {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  const ymd = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${
    pad(date.getDate())
  }`;
  return `${ymd}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

/**
 * ISO日時文字列を日本語表記に整形する
 * @param iso ISO 8601形式の日時文字列
 * @returns 例: "2026/07/04 12:30"
 */
export const formatDateTime = (iso: string): string =>
  new Date(iso).toLocaleString("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  });

/**
 * 失効日時までの残り時間を日本語で表す
 * @param iso 失効日時（ISO 8601）
 * @param now 基準日時
 * @returns 例: "残り2日3時間"
 */
export const formatRemaining = (iso: string, now = new Date()): string => {
  const ms = new Date(iso).getTime() - now.getTime();
  if (ms <= 0) return "失効済み";

  const totalMinutes = Math.floor(ms / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `残り${days}日${hours}時間`;
  if (hours > 0) return `残り${hours}時間${minutes}分`;
  if (minutes > 0) return `残り${minutes}分`;
  return "残り1分未満";
};
