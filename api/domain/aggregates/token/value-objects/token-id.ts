import { monotonicUlid } from "@std/ulid";
import { ValidationError } from "../../../shared/validation.error.ts";
import { ValueObject } from "../../../shared/value-object.ts";

const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

/** トークン本体となるULID */
export class TokenId extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  /** 新しいULIDを発行する（同一ミリ秒内でも単調増加） */
  static generate(): TokenId {
    return new TokenId(monotonicUlid());
  }

  /**
   * 値を検証してトークンIDを作る
   * @param value 入力値
   * @throws {ValidationError} ULIDとして不正な場合
   */
  static from(value: unknown): TokenId {
    const tokenId = TokenId.tryFrom(value);
    if (tokenId === null) {
      throw new ValidationError("トークンIDはULID形式で指定してください");
    }
    return tokenId;
  }

  /**
   * 値を検証してトークンIDを作る
   * @param value 入力値
   * @returns トークンID。不正な場合は null
   */
  static tryFrom(value: unknown): TokenId | null {
    if (typeof value !== "string" || !ULID_PATTERN.test(value)) return null;
    return new TokenId(value);
  }
}
