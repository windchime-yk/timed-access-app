import type { SiteName } from "../domain/aggregates/token/value-objects/site-name.ts";
import type { TokenId } from "../domain/aggregates/token/value-objects/token-id.ts";
import type { Token } from "../domain/aggregates/token/token.ts";
import type { TokenRepository } from "../domain/aggregates/token/token.repository.ts";
import {
  fromStoredToken,
  type StoredToken,
  toStoredToken,
} from "./stored-token.mapper.ts";

const KEY_PREFIX = "tokens";

/** Deno KVを用いたトークンの永続化 */
export class DenoKvTokenRepository implements TokenRepository {
  #kv: Deno.Kv;

  constructor(kv: Deno.Kv) {
    this.#kv = kv;
  }

  async put(token: Token): Promise<void> {
    const key = [KEY_PREFIX, token.site.value, token.id.value];
    const expireIn = token.expiresAt.getTime() - Date.now();
    // 既に失効しているなら期限なしで残さないよう、保存せずに既存の値も消す
    if (expireIn <= 0) {
      await this.#kv.delete(key);
      return;
    }
    // 失効日時ちょうどにKVからも自動削除されるよう expireIn を設定
    await this.#kv.set(key, toStoredToken(token), { expireIn });
  }

  async get(site: SiteName, id: TokenId): Promise<Token | null> {
    const entry = await this.#kv.get<StoredToken>([
      KEY_PREFIX,
      site.value,
      id.value,
    ]);
    return entry.value === null ? null : fromStoredToken(entry.value);
  }

  async list(site?: SiteName): Promise<Token[]> {
    const tokens: Token[] = [];
    const prefix = site === undefined ? [KEY_PREFIX] : [KEY_PREFIX, site.value];
    for await (const entry of this.#kv.list<StoredToken>({ prefix })) {
      tokens.push(fromStoredToken(entry.value));
    }
    return tokens;
  }

  async delete(token: Token): Promise<void> {
    await this.#kv.delete([KEY_PREFIX, token.site.value, token.id.value]);
  }
}
