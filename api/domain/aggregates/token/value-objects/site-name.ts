import { ValidationError } from "../../../shared/validation.error.ts";
import { ValueObject } from "../../../shared/value-object.ts";

/** サイト名として使えるスラッグ（URLセグメントになるため英小文字・数字・ハイフンのみ） */
const SITE_NAME_PATTERN = /^[a-z0-9-]{1,64}$/;

/** トークンが属するサイト名（英小文字・数字・ハイフン1〜64文字のスラッグ） */
export class SiteName extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  /**
   * 値を検証してサイト名を作る
   * @param value 入力値
   * @throws {ValidationError} スラッグとして不正な場合
   */
  static from(value: unknown): SiteName {
    const siteName = SiteName.tryFrom(value);
    if (siteName === null) {
      throw new ValidationError(
        "サイト名は英小文字・数字・ハイフン1〜64文字で指定してください",
      );
    }
    return siteName;
  }

  /**
   * 値を検証してサイト名を作る
   * @param value 入力値
   * @returns サイト名。不正な場合は null
   */
  static tryFrom(value: unknown): SiteName | null {
    if (typeof value !== "string" || !SITE_NAME_PATTERN.test(value)) {
      return null;
    }
    return new SiteName(value);
  }
}
