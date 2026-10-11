/** 単一の値を包む値オブジェクトの基底クラス（不変で、同じ種類・同じ値なら等しい） */
export abstract class ValueObject<T> {
  readonly value: T;

  protected constructor(value: T) {
    this.value = value;
  }

  equals(other: ValueObject<T>): boolean {
    return this.constructor === other.constructor && this.value === other.value;
  }

  toString(): string {
    return String(this.value);
  }
}
