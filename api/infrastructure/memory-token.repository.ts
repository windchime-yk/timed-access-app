import type { Token } from "../domain/token.ts";
import type { TokenRepository } from "../domain/token.repository.ts";

/** プロセス内メモリにトークンを保持する永続化（テスト用。自動削除はしない） */
export class InMemoryTokenRepository implements TokenRepository {
  #tokens = new Map<string, Token>();

  #keyOf = (site: string, id: string): string => JSON.stringify([site, id]);

  put(token: Token): Promise<void> {
    this.#tokens.set(this.#keyOf(token.site, token.id), structuredClone(token));
    return Promise.resolve();
  }

  get(site: string, id: string): Promise<Token | null> {
    const token = this.#tokens.get(this.#keyOf(site, id));
    return Promise.resolve(token === undefined ? null : structuredClone(token));
  }

  list(site?: string): Promise<Token[]> {
    const tokens = [...this.#tokens.values()]
      .filter((token) => site === undefined || token.site === site)
      .sort((a, b) =>
        a.site === b.site ? compare(a.id, b.id) : compare(a.site, b.site)
      )
      .map((token) => structuredClone(token));
    return Promise.resolve(tokens);
  }

  delete(site: string, id: string): Promise<void> {
    this.#tokens.delete(this.#keyOf(site, id));
    return Promise.resolve();
  }
}

const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
