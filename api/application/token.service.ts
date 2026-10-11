import { SiteName } from "../domain/aggregates/token/value-objects/site-name.ts";
import { TokenId } from "../domain/aggregates/token/value-objects/token-id.ts";
import { Token } from "../domain/aggregates/token/token.ts";
import type { TokenRepository } from "../domain/aggregates/token/token.repository.ts";
import {
  type TokenDto,
  toTokenDto,
  type VerificationDto,
} from "./token.dto.ts";

/** 時限式トークンの発行・管理・検証を行うアプリケーションサービス */
export class TokenService {
  #repo: TokenRepository;

  constructor(repo: TokenRepository) {
    this.#repo = repo;
  }

  /**
   * ULIDを生成し、指定したサイト配下に失効日時付きで保存する
   * @param input サイト名・表示名・失効日時
   * @returns 発行されたトークン
   * @throws {ValidationError} サイト名が不正、または失効日時が現在以前の場合
   */
  async create(
    input: { site: string; name?: string; expiresAt: Date },
  ): Promise<TokenDto> {
    const token = Token.create({
      site: SiteName.from(input.site),
      name: input.name,
      expiresAt: input.expiresAt,
    });

    await this.#repo.put(token);

    return toTokenDto(token);
  }

  /**
   * 有効なトークンをサイト名・作成順（ULID順）で列挙する
   * @param site 指定した場合はそのサイトのトークンのみ列挙
   * @returns 有効なトークンの一覧
   * @throws {ValidationError} サイト名が不正な場合
   */
  async list(site?: string): Promise<TokenDto[]> {
    const siteName = site === undefined ? undefined : SiteName.from(site);
    const tokens = await this.#repo.list(siteName);
    // 永続化先の自動削除は失効直後に反映されない場合があるため日時でも判定
    return tokens.filter((token) => !token.isExpiredAt()).map(toTokenDto);
  }

  /**
   * トークンを取得する
   * @param site トークンが属するサイト名
   * @param id トークンのULID
   * @returns トークン。形式が不正・存在しない・失効済みなら null
   */
  async get(site: string, id: string): Promise<TokenDto | null> {
    const token = await this.#find(site, id);
    return token === null ? null : toTokenDto(token);
  }

  /**
   * トークンの表示名・失効日時を更新する
   * @param site トークンが属するサイト名
   * @param id トークンのULID
   * @param patch 更新内容（未指定の項目は維持）
   * @returns 更新後のトークン。存在しないか失効済みなら null
   * @throws {ValidationError} 失効日時が現在以前の場合
   */
  async update(
    site: string,
    id: string,
    patch: { name?: string; expiresAt?: Date },
  ): Promise<TokenDto | null> {
    const token = await this.#find(site, id);
    if (token === null) return null;

    // name未指定なら維持、指定ありで空なら既定名にリセット（createと同じ扱い）
    if (patch.name !== undefined) token.rename(patch.name);
    if (patch.expiresAt !== undefined) token.changeExpiry(patch.expiresAt);
    await this.#repo.put(token);

    return toTokenDto(token);
  }

  /**
   * トークンを失効（削除）させる
   * @param site トークンが属するサイト名
   * @param id トークンのULID
   * @returns 削除できたら true。存在しないか失効済みなら false
   */
  async delete(site: string, id: string): Promise<boolean> {
    const token = await this.#find(site, id);
    if (token === null) return false;

    await this.#repo.delete(token.site, token.id);
    return true;
  }

  /**
   * トークンが指定サイトで有効か検証する
   * @param site トークンが属するサイト名
   * @param id トークンのULID
   * @returns 検証結果。有効ならトークン情報も返す
   */
  async verify(site: string, id: string): Promise<VerificationDto> {
    const token = await this.get(site, id);
    return token === null ? { valid: false } : { valid: true, token };
  }

  /**
   * 有効なトークンのEntityを探す
   * @returns Entity。形式が不正・存在しない・失効済みなら null
   */
  async #find(site: string, id: string): Promise<Token | null> {
    const siteName = SiteName.tryFrom(site);
    const tokenId = TokenId.tryFrom(id);
    if (siteName === null || tokenId === null) return null;

    const token = await this.#repo.get(siteName, tokenId);
    if (token === null || token.isExpiredAt()) return null;
    return token;
  }
}
