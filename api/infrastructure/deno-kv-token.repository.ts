import type { TokenRecord } from "../../shared/mod.ts";
import type { SiteName } from "../domain/site-name.value-object.ts";
import type { TokenId } from "../domain/token-id.value-object.ts";
import { Token } from "../domain/token.entity.ts";
import type { TokenRepository } from "../domain/token.repository.ts";

const KEY_PREFIX = "tokens";

/** Deno KVを用いたトークンの永続化 */
export class DenoKvTokenRepository implements TokenRepository {
  #kv: Deno.Kv;

  constructor(kv: Deno.Kv) {
    this.#kv = kv;
  }

  async put(token: Token): Promise<void> {
    // 失効日時ちょうどにKVからも自動削除されるよう expireIn を設定
    const expireIn = token.expiresAt.getTime() - Date.now();
    await this.#kv.set(
      [KEY_PREFIX, token.site.value, token.id.value],
      token.toRecord(),
      expireIn > 0 ? { expireIn } : undefined,
    );
  }

  async get(site: SiteName, id: TokenId): Promise<Token | null> {
    const entry = await this.#kv.get<TokenRecord>([
      KEY_PREFIX,
      site.value,
      id.value,
    ]);
    return entry.value === null ? null : Token.restore(entry.value);
  }

  async list(site?: SiteName): Promise<Token[]> {
    const tokens: Token[] = [];
    const prefix = site === undefined ? [KEY_PREFIX] : [KEY_PREFIX, site.value];
    for await (const entry of this.#kv.list<TokenRecord>({ prefix })) {
      tokens.push(Token.restore(entry.value));
    }
    return tokens;
  }

  async delete(site: SiteName, id: TokenId): Promise<void> {
    await this.#kv.delete([KEY_PREFIX, site.value, id.value]);
  }
}
