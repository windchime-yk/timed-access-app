import type { TokenRecord } from "../../shared/mod.ts";
import { SiteName } from "./site-name.value-object.ts";
import { TokenId } from "./token-id.value-object.ts";

/** 表示名が未指定・空のときに使う既定の表示名 */
const DEFAULT_NAME = "無題のトークン";

/** 表示名の前後の空白を除き、空なら既定名にする */
const normalizeName = (name?: string): string => name?.trim() || DEFAULT_NAME;

/**
 * 失効日時が未来であることを確かめる
 * @throws {RangeError} 失効日時が現在以前の場合
 */
const assertFutureExpiry = (expiresAt: Date, now: Date): void => {
  if (expiresAt.getTime() <= now.getTime()) {
    throw new RangeError("失効日時は未来の日時を指定してください");
  }
};

/** 時限式トークン。IDで同一性を判定し、状態の変更はメソッド経由に限る */
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
   * @throws {RangeError} 失効日時が現在以前の場合
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
   * 永続化された値からトークンを復元する（失効済みでも復元する）
   * @param record 永続化された値
   * @throws {RangeError} サイト名・IDが不正な場合
   */
  static restore(record: TokenRecord): Token {
    return new Token(
      TokenId.from(record.id),
      SiteName.from(record.site),
      record.name,
      new Date(record.createdAt),
      new Date(record.expiresAt),
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
   * @throws {RangeError} 失効日時が現在以前の場合
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

  /** IDが同じなら同一のトークンとみなす */
  equals(other: Token): boolean {
    return this.id.equals(other.id);
  }

  /** HTTP・永続化の境界で使う値に変換する */
  toRecord(): TokenRecord {
    return {
      id: this.id.value,
      site: this.site.value,
      name: this.#name,
      createdAt: this.#createdAt.toISOString(),
      expiresAt: this.#expiresAt.toISOString(),
    };
  }
}
