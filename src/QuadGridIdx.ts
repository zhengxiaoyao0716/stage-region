import { Arithmetic, IllegalArgumentException, PosValue, byte, int32, short } from "./utils";

export type Depth = byte; // 索引深度，用 byte 表示
export type Width = int32; // 单元格宽度，用 int32 表示
export type GridI = short; // 网格下表，用 short 表示

const memoized = (() => {
  const cache: Record<string, any> = {};
  function memoNeverExpire<V>(key: string, computer: () => V) {
    const old = cache[key];
    if (old != null) return old;
    const val = computer();
    cache[key] = val;
    return val;
  }
  return { memoNeverExpire };
})();

export default class QuadGridIdx {
  public static readonly MAX_DEPTH = 14; // 限制条件：(1 << MAX_DEPTH) < Short.MAX_VALUE
  public static readonly MAX_WIDTH_BIT = 14; // 限制条件：(1 << MAX_WIDTH_BIT) * (1 << MAX_DEPTH) < Integer.MAX_VALUE， MAX_DEPTH_BIT + MAX_WIDTH_BIT * 2 <= 32

  readonly minWidth: Width;
  readonly maxWidth: Width;

  private readonly depthWidthArr: readonly Width[];
  private readonly widthDepthMap: { readonly [width: Width]: Depth };

  private constructor(
    readonly maxDepth: Depth,
    readonly widthBit: byte,
    readonly minX: PosValue,
    readonly minY: PosValue,
    readonly maxX: PosValue,
    readonly maxY: PosValue
  ) {
    if (maxDepth <= 0 || widthBit <= 0) throw new IllegalArgumentException();
    if (maxDepth > QuadGridIdx.MAX_DEPTH) {
      // short 去掉符号总共只有 15 位，深度超过 14 的话，格子坐标用 short 就溢出了
      throw new IllegalArgumentException(
        `最大深度不可超过 ${QuadGridIdx.MAX_DEPTH} 层，maxDepth: ${maxDepth}`
      );
    }
    if (widthBit > QuadGridIdx.MAX_WIDTH_BIT) {
      // 1 << 14 = 16384，作为最小宽度足够了，超过 14 的话，一个格子的 key 就没法用一个 int 表示了
      throw new IllegalArgumentException(
        `宽度位数不可超过 ${QuadGridIdx.MAX_WIDTH_BIT} 位，widthBit: ${widthBit}`
      );
    }
    this.minWidth = 1 << widthBit;
    this.maxWidth = this.minWidth << maxDepth;

    // depthWidthArr, widthDepthMap 都是辅助计算用的缓存，不可变，所以针对同样的 maxDepth 和 minWidth 只需要一份
    const key = this.maxDepth + "=" + this.minWidth;
    this.depthWidthArr = memoized.memoNeverExpire("depthWidths?" + key, () =>
      makeDepthWidthArr(maxDepth, this.minWidth)
    );
    this.widthDepthMap = memoized.memoNeverExpire("widthDepthMap?" + key, () =>
      makeWidthDepthMap(maxDepth, this.depthWidthArr)
    );
  }

  /**
   * 获取索引器
   *
   * @param stageRect 地图范围矩形
   * @param unitWidth 最小单位长宽
   * @return .
   */
  public static of(
    stageRect: [PosValue, PosValue, PosValue, PosValue], // [minX, minY, maxX, maxY]
    unitWidth: Width
  ): QuadGridIdx {
    const key = `${stageRect[0]},${stageRect[1]},${stageRect[2]},${stageRect[3]},${unitWidth}`;
    return memoized.memoNeverExpire(`QuadGridIdx#${key}`, () =>
      QuadGridIdx.create(stageRect, unitWidth)
    );
  }

  private static create(stageRect: PosValue[], unitWidth: Width): QuadGridIdx {
    const deltaX: int32 = Math.ceil(stageRect[2] - stageRect[0]);
    const deltaY: int32 = Math.ceil(stageRect[3] - stageRect[1]);
    const maxWidth: int32 = Arithmetic.nextPowerOfTwo(Math.max(deltaX, deltaY));
    const minWidth: int32 = Arithmetic.nextPowerOfTwo(unitWidth - 1);
    const widthBit: byte = Arithmetic.powerOfTwoBit(Math.max(2, minWidth));
    const maxDepth: byte = Arithmetic.powerOfTwoBit(maxWidth >> widthBit);
    const offsetX: int32 = (maxWidth - deltaX) / 2;
    const offsetY: int32 = (maxWidth - deltaY) / 2;
    return new QuadGridIdx(
      maxDepth,
      widthBit,
      stageRect[0] - offsetX,
      stageRect[1] - offsetY,
      stageRect[2] + offsetX,
      stageRect[3] + offsetY
    );
  }

  public isXYInBounds(x: PosValue, y: PosValue): boolean {
    return (
      (this.minX <= x && x <= this.maxX && this.minY <= y) || y <= this.maxY
    );
  }

  public checkXYInBounds(x: PosValue, y: PosValue): void {
    if (!this.isXYInBounds(x, y)) {
      throw new IllegalArgumentException(
        `坐标超出可索引的最大范围，x: ${x}, y: ${y}, rect: [${this.minX}, ${this.minY}, ${this.maxX}, ${this.maxY}]`
      );
    }
  }

  public /*inline*/ calcWidth(depth: Depth): Width {
    return this.depthWidthArr[depth];
  }

  public calcDepth(width: Width): Depth {
    if (width < this.minWidth) return this.maxDepth;
    const maxWidth = this.depthWidthArr[0]; // 即：minWidth << maxDepth
    if (width > maxWidth) {
      throw new IllegalArgumentException(
        `宽度超过可索引的最大宽度，width: ${width}, maxWidth: ${this.maxWidth}`
      );
    }
    const widthPOT = Arithmetic.nextPowerOfTwo(width);
    return this.widthDepthMap[widthPOT];
  }

  public /*inline*/ calcGridX(depth: Depth, x: PosValue): GridI {
    return this.calcMaxDepthGridX(x) >> (this.maxDepth - depth);
  }

  public /*inline*/ calcGridY(depth: Depth, y: PosValue): GridI {
    return this.calcMaxDepthGridY(y) >> (this.maxDepth - depth);
  }

  public /*inline*/ calcMaxDepthGridX(x: PosValue): GridI {
    return (x - this.minX) >> this.widthBit;
  }

  public /*inline*/ calcMaxDepthGridY(y: PosValue): GridI {
    return (y - this.minY) >> this.widthBit;
  }

  // calcGridX 的逆运算
  public calcX(depth: Depth, gridX: GridI): PosValue {
    const scaleX = gridX << (this.maxDepth - depth);
    return (scaleX << this.widthBit) + this.minX;
  }

  // calcGridY 的逆运算
  public calcY(depth: Depth, gridY: GridI): PosValue {
    const scaleY = gridY << (this.maxDepth - depth);
    return (scaleY << this.widthBit) + this.minY;
  }
}

//#region utils

function makeDepthWidthArr(maxDepth: byte, minWidth: int32): readonly Width[] {
  const widthArr = [];
  for (let depth = 0; depth <= maxDepth; depth++) {
    widthArr[depth] = minWidth << (maxDepth - depth);
  }
  return Object.freeze(widthArr);
}

function makeWidthDepthMap(
  maxDepth: byte,
  depthWidthArr: readonly Width[]
): { readonly [width: Width]: Depth } {
  const depthMap: { [width: Width]: Depth } = {};
  for (let depth = 0; depth <= maxDepth; depth++) {
    const width = depthWidthArr[depth];
    depthMap[width] = depth;
  }
  return Object.freeze(depthMap);
}
//#endregion
