import type { TokenRecord } from "../../shared/mod.ts";
import type { SiteName } from "../domain/site-name.value-object.ts";
import type { TokenId } from "../domain/token-id.value-object.ts";
import { Token } from "../domain/token.entity.ts";
import type { TokenRepository } from "../domain/token.repository.ts";

/** プロセス内メモリにトークンを保持する永続化（テスト用。自動削除はしない） */
export class InMemoryTokenRepository implements TokenRepository {
  // 保存後のEntityの変更が反映されないよう、値に変換して保持する
  #records = new Map<string, TokenRecord>();

  #keyOf = (site: string, id: string): string => JSON.stringify([site, id]);

  put(token: Token): Promise<void> {
    const record = token.toRecord();
    this.#records.set(this.#keyOf(record.site, record.id), record);
    return Promise.resolve();
  }

  get(site: SiteName, id: TokenId): Promise<Token | null> {
    const record = this.#records.get(this.#keyOf(site.value, id.value));
    return Promise.resolve(
      record === undefined ? null : Token.restore(record),
    );
  }

  list(site?: SiteName): Promise<Token[]> {
    const tokens = [...this.#records.values()]
      .filter((record) => site === undefined || record.site === site.value)
      .sort((a, b) =>
        a.site === b.site ? compare(a.id, b.id) : compare(a.site, b.site)
      )
      .map((record) => Token.restore(record));
    return Promise.resolve(tokens);
  }

  delete(site: SiteName, id: TokenId): Promise<void> {
    this.#records.delete(this.#keyOf(site.value, id.value));
    return Promise.resolve();
  }
}

const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
