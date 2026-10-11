import type { SiteName } from "./value-objects/site-name.ts";
import type { TokenId } from "./value-objects/token-id.ts";
import type { Token } from "./token.ts";

/**
 * Token Aggregateの永続化インターフェース
 *
 * 保存・削除はAggregate（Token）単位で行い、トークンはサイト名とIDの組で識別する
 * （`Token.equals` と同じ基準）。
 * 失効済みのトークンを返す場合があるため、失効の判定は呼び出し側で行う。
 * TTLなどの自動削除は `token.expiresAt` をもとに各実装が設定する。
 */
export interface TokenRepository {
  /**
   * トークンを保存する（同じ site/id があれば上書き）
   * @param token 保存するトークン
   */
  put(token: Token): Promise<void>;

  /**
   * トークンを取得する
   * @param site トークンが属するサイト名
   * @param id トークンのULID
   * @returns トークン。存在しなければ null
   */
  get(site: SiteName, id: TokenId): Promise<Token | null>;

  /**
   * トークンをサイト名→ID（ULID）の昇順で列挙する
   * @param site 指定した場合は完全一致するサイトのトークンのみ
   * @returns トークンの一覧
   */
  list(site?: SiteName): Promise<Token[]>;

  /**
   * トークンを削除する（存在しなければ何もしない）
   * @param token 削除するトークン
   */
  delete(token: Token): Promise<void>;
}
