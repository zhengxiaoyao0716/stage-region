//#region type def
export type byte = number;
export type short = number;
export type int32 = number;
export type double = number;

export type RegionId = byte; // 区域 id，取值范围为 [1, 30]
export type RegionFlag = int32; // 区域标识，一个标识代表了某个地点所处的多个区域 id 的集合

export interface Pos3D {
  readonly x: double;
  readonly y: double;
  readonly z: double;
}

export type PosValue = Pos3D[keyof Pos3D]; // double
//#endregion

export class IllegalArgumentException extends Error {
  constructor(message?: string) {
    super(message);
  }
}

// 算数工具
export module Arithmetic {
  //#region 位运算

  /**
   * 判定某个数是否为二的次方
   *
   * @param val .
   * @return .
   */
  export function isPowerOfTwo(val: int32): boolean {
    return (val & -val) == val; // 0b0010 & (0b1101 + 1) == 0b0010
  }

  export function fillAfterHighestOneBit(val: int32): int32 {
    val |= val >> 1; // 0b0...01?????????
    val |= val >> 2; // 0b0...011????????
    val |= val >> 4; // 0b0...01111??????
    val |= val >> 8; // 0b0...011111111??
    val |= val >> 16; // 0b0...01111111111
    // int 总共 32 位，到这里就足够了
    return val;
  }

  /**
   * 找到大于目标值的最小的二的次方数
   * <p>
   * 例如，大于 15 的最小二的次方数就是 16，大于 16 的最小二的次方数则是 32。
   * ！注意，该方法为非严谨的快速算法，仅适用于 0 <= val < 0x40000000 的情景！
   * </p>
   *
   * @param val .
   * @return .
   * @see Integer#highestOneBit(int) 当 0 < val < 0x40000000 时等价于 `Integer.highestOneBit(val) << 1`，当 val == 0 时返回为 1。
   */
  export function nextPowerOfTwo(val: int32): int32 {
    return /*inline*/ fillAfterHighestOneBit(val) + 1;
  }

  export const INTEGER_SIZE = 32;

  /**
   * 获取某个二的次方数的位数
   * <p>
   * 例如，powerOfTwoBit(1) = 0, powerOfTwoBit(2) = 1, powerOfTwoBit(4) = 2, ...
   * </p>
   *
   * @param val .
   * @return .
   */
  export function powerOfTwoBit(val: int32): byte {
    return INTEGER_SIZE - 1 - numberOfLeadingZeros(val);
  }

  // prettier-ignore
  // java.lang.Integer.numberOfLeadingZeros
  export function numberOfLeadingZeros(i: int32) {
  // HD, Count leading 0's
  if (i <= 0)
      return i == 0 ? INTEGER_SIZE : 0;
  let n = 31;
  if (i >= 1 << 16) { n -= 16; i >>>= 16; }
  if (i >= 1 <<  8) { n -=  8; i >>>=  8; }
  if (i >= 1 <<  4) { n -=  4; i >>>=  4; }
  if (i >= 1 <<  2) { n -=  2; i >>>=  2; }
  return n - (i >>> 1);
}

  export function isEven(val: int32): boolean {
    return (val & 1) == 0;
  }
  //#endregion
}

//#region 文件系统

export interface FileChannel {
  map(begin: number, size: int32): Uint8Array;
  mapAll(begin: number): Uint8Array | undefined;
  close(): void;
}
//#endregion
