import { ValidationError } from "../../shared/validation.error.ts";
import type { SiteName } from "./value-objects/site-name.ts";
import { TokenId } from "./value-objects/token-id.ts";

/** 表示名が未指定・空のときに使う既定の表示名 */
const DEFAULT_NAME = "無題のトークン";

/** 表示名の前後の空白を除き、空なら既定名にする */
const normalizeName = (name?: string): string => name?.trim() || DEFAULT_NAME;

/**
 * 失効日時が未来であることを確かめる
 * @throws {ValidationError} 失効日時が現在以前の場合
 */
const assertFutureExpiry = (expiresAt: Date, now: Date): void => {
  if (expiresAt.getTime() <= now.getTime()) {
    throw new ValidationError("失効日時は未来の日時を指定してください");
  }
};

/** 時限式トークン（Token Aggregateのルート）。IDで同一性を判定し、状態の変更はメソッド経由に限る */
export class Token {
  readonly id: TokenId;
  readonly site: SiteName;
  #name: string;
  #createdAt: Date;
  #expiresAt: Date;

  private constructor(
    id: TokenId,
    site: SiteName,
    name: string,
    createdAt: Date,
    expiresAt: Date,
  ) {
    this.id = id;
    this.site = site;
    this.#name = name;
    this.#createdAt = createdAt;
    this.#expiresAt = expiresAt;
  }

  /**
   * 新しいトークンを作成する（IDは新しく発行する）
   * @param input サイト名・表示名・失効日時
   * @param now 発行日時
   * @throws {ValidationError} 失効日時が現在以前の場合
   */
  static create(
    input: { site: SiteName; name?: string; expiresAt: Date },
    now = new Date(),
  ): Token {
    assertFutureExpiry(input.expiresAt, now);
    return new Token(
      TokenId.generate(),
      input.site,
      normalizeName(input.name),
      new Date(now),
      new Date(input.expiresAt),
    );
  }

  /**
   * 保存済みのトークンを復元する（失効済みでも復元する）
   * @param props ドメインの型で表したトークンの値
   * @throws {ValidationError} 日時として不正な値を含む場合
   */
  static restore(props: {
    id: TokenId;
    site: SiteName;
    name: string;
    createdAt: Date;
    expiresAt: Date;
  }): Token {
    for (const date of [props.createdAt, props.expiresAt]) {
      if (Number.isNaN(date.getTime())) {
        throw new ValidationError("日時として不正な値は復元できません");
      }
    }
    return new Token(
      props.id,
      props.site,
      props.name,
      new Date(props.createdAt),
      new Date(props.expiresAt),
    );
  }

  get name(): string {
    return this.#name;
  }

  get createdAt(): Date {
    return new Date(this.#createdAt);
  }

  get expiresAt(): Date {
    return new Date(this.#expiresAt);
  }

  /**
   * 表示名を変更する（空なら既定名にする）
   * @param name 新しい表示名
   */
  rename(name?: string): void {
    this.#name = normalizeName(name);
  }

  /**
   * 失効日時を変更する
   * @param expiresAt 新しい失効日時
   * @param now 判定基準の日時
   * @throws {ValidationError} 失効日時が現在以前の場合
   */
  changeExpiry(expiresAt: Date, now = new Date()): void {
    assertFutureExpiry(expiresAt, now);
    this.#expiresAt = new Date(expiresAt);
  }

  /**
   * 指定日時の時点で失効しているか判定する
   * @param now 判定基準の日時
   * @returns 失効日時ちょうど以降なら true
   */
  isExpiredAt(now = new Date()): boolean {
    return this.#expiresAt.getTime() <= now.getTime();
  }

  /** サイト名とIDの組が同じなら同一のトークンとみなす（リポジトリのキーと揃える） */
  equals(other: Token): boolean {
    return this.site.equals(other.site) && this.id.equals(other.id);
  }
}
