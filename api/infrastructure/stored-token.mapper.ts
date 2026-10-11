import { Token } from "../domain/aggregates/token/token.ts";
import { SiteName } from "../domain/aggregates/token/value-objects/site-name.ts";
import { TokenId } from "../domain/aggregates/token/value-objects/token-id.ts";
import { CorruptedStoredTokenError } from "./corrupted-stored-token.error.ts";

/**
 * 永続化先に保存するトークンの形
 *
 * APIのレスポンスの形（TokenRecord）とは独立させる。既存のDeno KVのデータを
 * 読めるよう、フィールド名と日時の表現（ISO 8601の文字列）は変えない。
 */
export type StoredToken = {
  id: string;
  site: string;
  name: string;
  createdAt: string;
  expiresAt: string;
};

/**
 * Entityを保存形式に変換する
 * @param token 保存するトークン
 */
export const toStoredToken = (token: Token): StoredToken => ({
  id: token.id.value,
  site: token.site.value,
  name: token.name,
  createdAt: token.createdAt.toISOString(),
  expiresAt: token.expiresAt.toISOString(),
});

/**
 * 保存形式からEntityを復元する
 * @param stored 保存されていた値
 * @throws {CorruptedStoredTokenError} 保存されていた値から復元できない場合
 */
export const fromStoredToken = (stored: StoredToken): Token => {
  try {
    return Token.restore({
      id: TokenId.from(stored.id),
      site: SiteName.from(stored.site),
      name: stored.name,
      createdAt: new Date(stored.createdAt),
      expiresAt: new Date(stored.expiresAt),
    });
  } catch (error) {
    throw new CorruptedStoredTokenError(
      `保存されていたトークンを復元できません: ${JSON.stringify(stored)}`,
      { cause: error },
    );
  }
};
