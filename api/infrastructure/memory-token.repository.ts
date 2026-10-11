import type { SiteName } from "../domain/aggregates/token/value-objects/site-name.ts";
import type { TokenId } from "../domain/aggregates/token/value-objects/token-id.ts";
import type { Token } from "../domain/aggregates/token/token.ts";
import type { TokenRepository } from "../domain/aggregates/token/token.repository.ts";
import {
  fromStoredToken,
  type StoredToken,
  toStoredToken,
} from "./stored-token.mapper.ts";

/** プロセス内メモリにトークンを保持する永続化（テスト用。自動削除はしない） */
export class InMemoryTokenRepository implements TokenRepository {
  // 保存後のEntityの変更が反映されないよう、値に変換して保持する
  #records = new Map<string, StoredToken>();

  #keyOf = (site: string, id: string): string => JSON.stringify([site, id]);

  put(token: Token): Promise<void> {
    const record = toStoredToken(token);
    this.#records.set(this.#keyOf(record.site, record.id), record);
    return Promise.resolve();
  }

  get(site: SiteName, id: TokenId): Promise<Token | null> {
    const record = this.#records.get(this.#keyOf(site.value, id.value));
    return Promise.resolve(
      record === undefined ? null : fromStoredToken(record),
    );
  }

  list(site?: SiteName): Promise<Token[]> {
    const tokens = [...this.#records.values()]
      .filter((record) => site === undefined || record.site === site.value)
      .sort((a, b) =>
        a.site === b.site ? compare(a.id, b.id) : compare(a.site, b.site)
      )
      .map((record) => fromStoredToken(record));
    return Promise.resolve(tokens);
  }

  delete(site: SiteName, id: TokenId): Promise<void> {
    this.#records.delete(this.#keyOf(site.value, id.value));
    return Promise.resolve();
  }
}

const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
