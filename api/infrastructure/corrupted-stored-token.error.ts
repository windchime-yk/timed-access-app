/**
 * 永続化先に保存されていた値からトークンを復元できなかったことを表すエラー
 *
 * クライアントの入力ではなくサーバー側のデータの問題なので、ドメインの
 * ValidationError（400）とは区別し、500として扱う。
 */
export class CorruptedStoredTokenError extends Error {
  override name = "CorruptedStoredTokenError";
}
