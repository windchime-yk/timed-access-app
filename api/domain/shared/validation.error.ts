/** ドメインのルールに反する入力を表すエラー */
export class ValidationError extends Error {
  override name = "ValidationError";
}
