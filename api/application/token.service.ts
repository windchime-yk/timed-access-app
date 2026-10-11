import { monotonicUlid } from "@std/ulid";
import type { VerifyResult } from "../../shared/mod.ts";
import { isExpired, type Token } from "../domain/token.ts";
import type { TokenRepository } from "../domain/token.repository.ts";

const DEFAULT_NAME = "無題のトークン";

/** Deno KVを用いた時限式トークンの永続化層 */
export class TokenService {
  #repo: TokenRepository;

  constructor(repo: TokenRepository) {
    this.#repo = repo;
  }

  /**
   * ULIDを生成し、指定したサイト配下に失効日時付きで保存する
   * @param input サイト名・表示名・失効日時
   * @returns 発行されたトークン
   * @throws {RangeError} 失効日時が現在以前の場合
   */
  async create(
    input: { site: string; name?: string; expiresAt: Date },
  ): Promise<Token> {
    const now = new Date();
    const expireIn = input.expiresAt.getTime() - now.getTime();
    if (expireIn <= 0) {
      throw new RangeError("失効日時は未来の日時を指定してください");
    }

    const token: Token = {
      id: monotonicUlid(),
      site: input.site,
      name: input.name?.trim() || DEFAULT_NAME,
      createdAt: now.toISOString(),
      expiresAt: input.expiresAt.toISOString(),
    };

    await this.#repo.put(token);

    return token;
  }

  /**
   * 有効なトークンをサイト名・作成順（ULID順）で列挙する
   * @param site 指定した場合はそのサイトのトークンのみ列挙
   * @returns 有効なトークンの一覧
   */
  async list(site?: string): Promise<Token[]> {
    const tokens = await this.#repo.list(site);
    // 永続化先の自動削除は失効直後に反映されない場合があるため日時でも判定
    return tokens.filter((token) => !isExpired(token));
  }

  /**
   * トークンを取得する
   * @param site トークンが属するサイト名
   * @param id トークンのULID
   * @returns トークン。存在しないか失効済みなら null
   */
  async get(site: string, id: string): Promise<Token | null> {
    const token = await this.#repo.get(site, id);
    if (token === null || isExpired(token)) return null;
    return token;
  }

  /**
   * トークンの表示名・失効日時を更新する
   * @param site トークンが属するサイト名
   * @param id トークンのULID
   * @param patch 更新内容（未指定の項目は維持）
   * @returns 更新後のトークン。存在しないか失効済みなら null
   * @throws {RangeError} 失効日時が現在以前の場合
   */
  async update(
    site: string,
    id: string,
    patch: { name?: string; expiresAt?: Date },
  ): Promise<Token | null> {
    const current = await this.get(site, id);
    if (current === null) return null;

    const expiresAt = patch.expiresAt ?? new Date(current.expiresAt);
    const expireIn = expiresAt.getTime() - Date.now();
    if (expireIn <= 0) {
      throw new RangeError("失効日時は未来の日時を指定してください");
    }

    const updated: Token = {
      ...current,
      // name未指定なら維持、指定ありで空なら既定名にリセット（createと同じ扱い）
      name: patch.name === undefined
        ? current.name
        : patch.name.trim() || DEFAULT_NAME,
      expiresAt: expiresAt.toISOString(),
    };
    await this.#repo.put(updated);

    return updated;
  }

  /**
   * トークンを失効（削除）させる
   * @param site トークンが属するサイト名
   * @param id トークンのULID
   * @returns 削除できたら true。存在しないか失効済みなら false
   */
  async delete(site: string, id: string): Promise<boolean> {
    const current = await this.get(site, id);
    if (current === null) return false;

    await this.#repo.delete(site, id);
    return true;
  }

  /**
   * トークンが指定サイトで有効か検証する
   * @param site トークンが属するサイト名
   * @param id トークンのULID
   * @returns 検証結果。有効ならトークン情報も返す
   */
  async verify(site: string, id: string): Promise<VerifyResult> {
    const token = await this.get(site, id);
    return token === null ? { valid: false } : { valid: true, token };
  }
}
