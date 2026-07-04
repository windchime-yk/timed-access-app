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
   * ULIDを生成し、指定した失効日時付きで保存する
   * @param input 表示名と失効日時
   * @returns 発行されたトークン
   * @throws {RangeError} 失効日時が現在以前の場合
   */
  async create(
    input: { name?: string; expiresAt: Date },
  ): Promise<TokenRecord> {
    const now = new Date();
    const expireIn = input.expiresAt.getTime() - now.getTime();
    if (expireIn <= 0) {
      throw new RangeError("失効日時は未来の日時を指定してください");
    }

    const token: TokenRecord = {
      id: monotonicUlid(),
      name: input.name?.trim() || DEFAULT_NAME,
      createdAt: now.toISOString(),
      expiresAt: input.expiresAt.toISOString(),
    };

    // 失効日時ちょうどにKVからも自動削除されるよう expireIn を設定
    await this.#kv.set([KEY_PREFIX, token.id], token, { expireIn });

    return token;
  }

  /**
   * 有効なトークンを作成順（ULID順）で列挙する
   * @returns 有効なトークンの一覧
   */
  async list(): Promise<TokenRecord[]> {
    const tokens: TokenRecord[] = [];
    for await (
      const entry of this.#kv.list<TokenRecord>({ prefix: [KEY_PREFIX] })
    ) {
      // KVの自動削除は失効直後に反映されない場合があるため日時でも判定
      if (!isExpired(entry.value)) tokens.push(entry.value);
    }
    return tokens;
  }

  /**
   * トークンを取得する
   * @param id トークンのULID
   * @returns トークン。存在しないか失効済みなら null
   */
  async get(id: string): Promise<TokenRecord | null> {
    const entry = await this.#kv.get<TokenRecord>([KEY_PREFIX, id]);
    if (entry.value === null || isExpired(entry.value)) return null;
    return entry.value;
  }

  /**
   * トークンの表示名・失効日時を更新する
   * @param id トークンのULID
   * @param patch 更新内容（未指定の項目は維持）
   * @returns 更新後のトークン。存在しないか失効済みなら null
   * @throws {RangeError} 失効日時が現在以前の場合
   */
  async update(
    id: string,
    patch: { name?: string; expiresAt?: Date },
  ): Promise<TokenRecord | null> {
    const current = await this.get(id);
    if (current === null) return null;

    const expiresAt = patch.expiresAt ?? new Date(current.expiresAt);
    const expireIn = expiresAt.getTime() - Date.now();
    if (expireIn <= 0) {
      throw new RangeError("失効日時は未来の日時を指定してください");
    }

    const updated: TokenRecord = {
      ...current,
      name: patch.name?.trim() || current.name,
      expiresAt: expiresAt.toISOString(),
    };
    await this.#kv.set([KEY_PREFIX, id], updated, { expireIn });

    return updated;
  }

  /**
   * トークンを失効（削除）させる
   * @param id トークンのULID
   * @returns 削除できたら true。存在しないか失効済みなら false
   */
  async delete(id: string): Promise<boolean> {
    const current = await this.get(id);
    if (current === null) return false;

    await this.#kv.delete([KEY_PREFIX, id]);
    return true;
  }

  /**
   * トークンが有効か検証する
   * @param id トークンのULID
   * @returns 検証結果。有効ならトークン情報も返す
   */
  async verify(id: string): Promise<VerifyResult> {
    const token = await this.get(id);
    return token === null ? { valid: false } : { valid: true, token };
  }
}
