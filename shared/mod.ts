/** APIキーを渡すリクエストヘッダー名 */
export const API_KEY_HEADER = "x-api-key";

/** APIキーを設定する環境変数名 */
export const API_KEY_ENV = "TIMED_ACCESS_API_KEY";

/** 発行済みトークンの情報 */
export type TokenRecord = {
  /** トークン本体となるULID */
  id: string;
  /** 管理用の表示名 */
  name: string;
  /** 発行日時（ISO 8601） */
  createdAt: string;
  /** 失効日時（ISO 8601） */
  expiresAt: string;
};

/** トークン発行リクエストのボディ */
export type TokenCreateInput = {
  name?: string;
  /** 失効日時（ISO 8601） */
  expiresAt: string;
};

/** トークン更新リクエストのボディ */
export type TokenUpdateInput = {
  name?: string;
  /** 失効日時（ISO 8601） */
  expiresAt?: string;
};

/** トークン検証レスポンス */
export type VerifyResult = {
  valid: boolean;
  token?: TokenRecord;
};
