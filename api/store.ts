import { monotonicUlid } from "@std/ulid";
import type { TokenRecord, VerifyResult } from "../shared/mod.ts";

const KEY_PREFIX = "tokens";

const DEFAULT_NAME = "無題のトークン";

/**
 * トークンが失効日時を過ぎているか判定する
 * @param token 判定対象のトークン
 * @param now 判定基準の日時
 * @returns 失効していれば true
 */
export const isExpired = (token: TokenRecord, now = new Date()): boolean =>
  new Date(token.expiresAt).getTime() <= now.getTime();

/** Deno KVを用いた時限式トークンの永続化層 */
export class TokenStore {
  #kv: Deno.Kv;

  constructor(kv: Deno.Kv) {
    this.#kv = kv;
  }

  /**
   * ULIDを生成し、指定したサイト配下に失効日時付きで保存する
   * @param input サイト名・表示名・失効日時
   * @returns 発行されたトークン
   * @throws {RangeError} 失効日時が現在以前の場合
   */
  async create(
    input: { site: string; name?: string; expiresAt: Date },
  ): Promise<TokenRecord> {
    const now = new Date();
    const expireIn = input.expiresAt.getTime() - now.getTime();
    if (expireIn <= 0) {
      throw new RangeError("失効日時は未来の日時を指定してください");
    }

    const token: TokenRecord = {
      id: monotonicUlid(),
      site: input.site,
      name: input.name?.trim() || DEFAULT_NAME,
      createdAt: now.toISOString(),
      expiresAt: input.expiresAt.toISOString(),
    };

    // 失効日時ちょうどにKVからも自動削除されるよう expireIn を設定
    await this.#kv.set([KEY_PREFIX, token.site, token.id], token, {
      expireIn,
    });

    return token;
  }

  /**
   * 有効なトークンをサイト名・作成順（ULID順）で列挙する
   * @param site 指定した場合はそのサイトのトークンのみ列挙
   * @returns 有効なトークンの一覧
   */
  async list(site?: string): Promise<TokenRecord[]> {
    const tokens: TokenRecord[] = [];
    const prefix = site === undefined ? [KEY_PREFIX] : [KEY_PREFIX, site];
    for await (const entry of this.#kv.list<TokenRecord>({ prefix })) {
      // KVの自動削除は失効直後に反映されない場合があるため日時でも判定
      if (!isExpired(entry.value)) tokens.push(entry.value);
    }
    return tokens;
  }

  /**
   * トークンを取得する
   * @param site トークンが属するサイト名
   * @param id トークンのULID
   * @returns トークン。存在しないか失効済みなら null
   */
  async get(site: string, id: string): Promise<TokenRecord | null> {
    const entry = await this.#kv.get<TokenRecord>([KEY_PREFIX, site, id]);
    if (entry.value === null || isExpired(entry.value)) return null;
    return entry.value;
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
  ): Promise<TokenRecord | null> {
    const current = await this.get(site, id);
    if (current === null) return null;

    const expiresAt = patch.expiresAt ?? new Date(current.expiresAt);
    const expireIn = expiresAt.getTime() - Date.now();
    if (expireIn <= 0) {
      throw new RangeError("失効日時は未来の日時を指定してください");
    }

    const updated: TokenRecord = {
      ...current,
      // name未指定なら維持、指定ありで空なら既定名にリセット（createと同じ扱い）
      name: patch.name === undefined
        ? current.name
        : patch.name.trim() || DEFAULT_NAME,
      expiresAt: expiresAt.toISOString(),
    };
    await this.#kv.set([KEY_PREFIX, site, id], updated, { expireIn });

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

    await this.#kv.delete([KEY_PREFIX, site, id]);
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
