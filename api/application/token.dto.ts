import type { Token } from "../domain/aggregates/token/token.ts";

/** application層の外へ渡すトークンの値（Entityの操作は持たない） */
export type TokenDto = {
  /** トークン本体となるULID */
  id: string;
  /** トークンが属するサイト名 */
  site: string;
  /** 管理用の表示名 */
  name: string;
  /** 発行日時（ISO 8601） */
  createdAt: string;
  /** 失効日時（ISO 8601） */
  expiresAt: string;
};

/** トークンの検証結果 */
export type VerificationDto =
  | { valid: false }
  | { valid: true; token: TokenDto };

/**
 * EntityをDTOに変換する
 * @param token 変換するトークン
 * @returns 新しく作ったDTO（書き換えてもEntityには影響しない）
 */
export const toTokenDto = (token: Token): TokenDto => ({
  id: token.id.value,
  site: token.site.value,
  name: token.name,
  createdAt: token.createdAt.toISOString(),
  expiresAt: token.expiresAt.toISOString(),
});
