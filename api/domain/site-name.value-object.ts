import { SITE_NAME_PATTERN } from "../../shared/mod.ts";

/** トークンが属するサイト名（英小文字・数字・ハイフン1〜64文字のスラッグ） */
export class SiteName {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /**
   * 値を検証してサイト名を作る
   * @param value 入力値
   * @throws {RangeError} スラッグとして不正な場合
   */
  static from(value: unknown): SiteName {
    const siteName = SiteName.tryFrom(value);
    if (siteName === null) {
      throw new RangeError(
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

  equals(other: SiteName): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
