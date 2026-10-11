import type { TokenRecord } from "../../shared/mod.ts";

/** 時限式トークン（APIの入出力と同じ形をそのまま使う） */
export type Token = TokenRecord;

/** 表示名が未指定・空のときに使う既定の表示名 */
export const DEFAULT_TOKEN_NAME = "無題のトークン";

/**
 * トークンが失効日時を過ぎているか判定する
 * @param token 判定対象のトークン
 * @param now 判定基準の日時
 * @returns 失効していれば true
 */
export const isExpired = (token: Token, now = new Date()): boolean =>
  new Date(token.expiresAt).getTime() <= now.getTime();

/**
 * 表示名の前後の空白を除き、空なら既定名にする
 * @param name 入力された表示名
 * @returns 保存する表示名
 */
export const normalizeName = (name?: string): string =>
  name?.trim() || DEFAULT_TOKEN_NAME;

/**
 * 失効日時が未来であることを確かめる
 * @param expiresAt 失効日時
 * @param now 判定基準の日時
 * @throws {RangeError} 失効日時が現在以前の場合
 */
export const assertFutureExpiry = (expiresAt: Date, now = new Date()): void => {
  if (expiresAt.getTime() <= now.getTime()) {
    throw new RangeError("失効日時は未来の日時を指定してください");
  }
};
