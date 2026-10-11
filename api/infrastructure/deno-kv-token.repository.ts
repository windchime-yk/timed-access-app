import type { Token } from "../domain/token.ts";
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
    const expireIn = new Date(token.expiresAt).getTime() - Date.now();
    await this.#kv.set(
      [KEY_PREFIX, token.site, token.id],
      token,
      expireIn > 0 ? { expireIn } : undefined,
    );
  }

  async get(site: string, id: string): Promise<Token | null> {
    const entry = await this.#kv.get<Token>([KEY_PREFIX, site, id]);
    return entry.value;
  }

  async list(site?: string): Promise<Token[]> {
    const tokens: Token[] = [];
    const prefix = site === undefined ? [KEY_PREFIX] : [KEY_PREFIX, site];
    for await (const entry of this.#kv.list<Token>({ prefix })) {
      tokens.push(entry.value);
    }
    return tokens;
  }

  async delete(site: string, id: string): Promise<void> {
    await this.#kv.delete([KEY_PREFIX, site, id]);
  }
}
