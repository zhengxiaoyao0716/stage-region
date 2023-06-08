import QuadGridIdx, { Depth, GridI } from "./QuadGridIdx";
import RegionQuery from "./RegionQuery";
import {
  FileChannel,
  RegionFlag as Flag,
  RegionId as Id,
  IllegalArgumentException,
  IndexOutOfBoundsException,
  PosValue,
  byte,
  int32,
} from "./utils";

/** 场景区域索引器 */
export class RegionIdx implements RegionQuery {
  private readonly idNames: readonly string[];
  private readonly regions: Region[];

  /**
   * 创建区域索引器
   *
   * @param openFile 文件管道
   * @param idx         四叉网格索引器
   * @param dir         区域资源目录
   * @param regionNames 区域名集合
   */
  constructor(
    readonly openFile: (path: string) => FileChannel | null,
    readonly idx: QuadGridIdx,
    readonly dir: string,
    regionNames: string[]
  ) {
    if (regionNames.length > RegionQuery.MAX_REGIONS) {
      throw new IndexOutOfBoundsException();
    }
    this.idNames = Object.freeze(Array.from(regionNames));
    this.regions = new Array(this.idNames.length);
  }

  // override
  regionFlag(posX: PosValue, posY: PosValue): Flag {
    if (!this.idx.isXYInBounds(posX, posY)) return 0;
    const maxDepth = this.idx.maxDepth;
    const gridX = this.idx.calcMaxDepthGridX(posX);
    const gridY = this.idx.calcMaxDepthGridY(posY);

    let flag = 0;
    for (let i = 0; i < this.idNames.length; i++) {
      const region = this.region(i + 1);
      const has = Region.includeGrid(region, maxDepth, gridX, gridY);
      if (has) flag |= 1 << i;
    }
    return flag;
  }

  // override
  inRegion(id: Id, posX: PosValue, posY: PosValue): boolean {
    if (!this.idx.isXYInBounds(posX, posY)) return false;
    const maxDepth = this.idx.maxDepth;
    const gridX = this.idx.calcMaxDepthGridX(posX);
    const gridY = this.idx.calcMaxDepthGridY(posY);
    const region = this.region(id);
    return Region.includeGrid(region, maxDepth, gridX, gridY);
  }

  region(regionId: Id): Region {
    if (regionId <= 0 || regionId > this.idNames.length) {
      throw new IndexOutOfBoundsException();
    }
    const index = regionId - 1;
    try {
      const cache = this.regions[index];
      if (cache != null) return cache;
      const name = this.idNames[index];
      if (!name) return Region.EXCLUDE;

      const region = this.createRegion(name);
      this.regions[index] = region;
      return region;
    } catch (error) {
      console.error(
        `加载区域索引失败，dir: ${this.dir}, id: ${regionId}`,
        error
      );
      return Region.EXCLUDE;
    }
  }

  private createRegion(name: string): MappedRegion {
    if (!name) throw new IllegalArgumentException();
    const path = `${this.dir}/${name}.data.bin`;
    const channel = this.openFile(path);
    if (channel == null) throw new Error("File not found");
    try {
      return new MappedRegion(this.idx.maxDepth, channel);
    } finally {
      channel.close();
    }
  }
}

export module Region {
  export const STAT_UNKNOWN = 0b00; //  代表默认、未知，即需要进一步查更深一层的格子。
  export const STAT_INCLUDE = 0b01; //  代表该格完全位于区域内，无需进一步查深层。
  export const STAT_EXCLUDE = 0b10; //  代表该格子完全位于区域外，无需进一步查深层。

  export type /*def*/ STAT =
    | typeof STAT_UNKNOWN
    | typeof STAT_INCLUDE
    | typeof STAT_EXCLUDE;

  export const EXCLUDE: Region = Object.freeze({
    gridStatus: () => Region.STAT_EXCLUDE,
  });

  export function includeGrid(
    region: Region,
    depth: Depth,
    gridX: GridI,
    gridY: GridI
  ): boolean {
    for (let i = 0; i <= depth; i++) {
      const x = gridX >> (depth - i);
      const y = gridY >> (depth - i);
      const status = region.gridStatus(i, x, y);
      if (status !== 0) return status === STAT_INCLUDE;
    }
    return true; // 所有层查完了，区块状态仍未知，视同 INCLUDE
  }
}

interface Region {
  gridStatus(depth: Depth, gridX: GridI, gridY: GridI): Region.STAT;
}

const HEADER_LEN = 32;
class MappedRegion implements Region {
  private readonly layers: RegionLayer[];

  constructor(maxDepth: Depth, channel: FileChannel) {
    this.layers = new Array(1 + maxDepth);

    const header = channel.map(0, HEADER_LEN);
    let begin = HEADER_LEN + (((header[0] << 4) | header[1]) << 10); // offset * 1024
    for (let depth = 0; depth < maxDepth; depth++) {
      const byteIndex = (depth + 1) << 1;
      const offset = (header[byteIndex] << 4) | header[byteIndex + 1];
      const end = HEADER_LEN + (offset << 10); // offset * 1024
      if (end < begin) {
        throw new IllegalArgumentException(
          `解析偏移量信息异常，depth: ${depth}, begin: ${begin}, end: ${end}`
        );
      } else if (end > begin) {
        this.layers[depth] = channel.map(begin, end);
        begin = end;
      }
    }
    const buffer = channel.mapAll(begin);
    if (buffer != null && buffer.byteLength > 0) {
      this.layers[maxDepth] = buffer;
    }
  }

  // override
  gridStatus(depth: Depth, gridX: GridI, gridY: GridI): Region.STAT {
    const union = this.layers[depth];
    if (union === undefined) return Region.STAT_UNKNOWN;
    if (union instanceof Uint8Array) {
      const gridStatus = RegionLayer.parse(union, depth);
      this.layers[depth] = gridStatus;
      return gridStatus(gridX, gridY);
    } else {
      const gridStatus = union;
      return gridStatus(gridX, gridY);
    }
  }
}

type /*def*/ RegionLayer = undefined | Uint8Array | RegionLayer.GridStatus;

module RegionLayer {
  export interface GridStatus {
    (gridX: GridI, gridY: GridI): Region.STAT;
  }

  interface Tile {
    (gridX: GridI, gridY: GridI): Region.STAT;
  }

  export function parse(buffer: Uint8Array, depth: Depth): GridStatus {
    const reader = new BufferReader(buffer);
    const tileSideBit = reader.nextByte(); // 图块边长格子数的位数
    const layerTileBit = depth - tileSideBit; // 图层边长图块数的位数
    if (layerTileBit < 0) {
      throw new IllegalArgumentException(
        `解析图层数据异常，depth: ${depth}, tileSideBit: ${tileSideBit}`
      );
    }
    const tileSideLen = 1 << tileSideBit; // 图块边长的格子的数量
    const layerTileNum = 1 << layerTileBit; // 图层边长的图块的数量
    const tileSideMask = tileSideLen - 1; // 图块边长的格子的掩码

    reader.nextByte(); // 移动到下个字节
    const tiles = new Array<Tile>(layerTileNum << layerTileBit);
    for (let ti = 0; ti < tiles.length; ti++) {
      const flag = reader.aft2bit;
      if (flag !== 0b11) {
        // <0b00|0b01|0b10> ...
        const grids = new Array<Region.STAT>(tileSideLen << tileSideBit);
        for (let i = 0; i < grids.length; i++) {
          const stat = reader.aft2bit as Region.STAT;
          if (stat !== Region.STAT_UNKNOWN) grids[i] = stat;
          if (/*eof*/ reader.offset2bit()) break; // NEVER!
        }
        tiles[ti] = (gridX, gridY) => {
          const x = gridX & tileSideMask;
          const y = gridY & tileSideMask;
          return grids[(y << tileSideBit) | x] ?? Region.STAT_UNKNOWN;
        };
        continue;
      }
      // else
      // <0b11-(0b110-0b{7})*-0b{2}> ...
      // <0b11111...> ...
      if (/*eof*/ reader.offset2bit()) break; // 已读取至末尾，这个 0b11 是填充用的，结束

      const stat = reader.aft2bit;
      if (stat !== 0b11) {
        // <0b11-0b{2}> ...
        tiles[ti] = () => stat as Region.STAT;
        reader.offset2bit();    // assert !eof || ti == tiles.length - 1;
        continue;
      }
      // else
      // <0b11-(0b110-0b{7})+-0b{2}> ...
      // <0b11111...> ...
      if (/*eof*/ reader.offset2bit()) break; // 已读取至末尾，这个 0b11-0b11 是填充用的，结束

      if (reader.aft1bit === 0b1) {
        // <0b11111...> ...
        break; // 011-0b11-1...，后续都是填充用的数据了，结束
      }
      // else
      // <0b11-(0b110-0b{7})+-0b{2}> ...

      let sameTileEndIndex = ti;
      while (true) {
        // 0b0-0b{7}
        sameTileEndIndex += reader.aftBitsHigher;
        reader.nextByte();
        sameTileEndIndex += reader.befBitsLower;

        const end = reader.aft2bit;
        reader.offset2bit(); // assert !eof;
        if (end === 0b11) continue; // 重复 0b110-0b{7}

        if (sameTileEndIndex >= tiles.length) {
          const sameTileNum = sameTileEndIndex - ti;
          throw new IndexOutOfBoundsException(
            `解析连续状态图块异常，depth: ${depth}, tileIndex: ${ti}, sameTileNum: ${sameTileNum}, tiles.length: ${tiles.length}`
          );
        }
        const tile = () => end as Region.STAT;
        for (; ti <= sameTileEndIndex; ti++) {
          tiles[ti] = tile;
        }
        ti--; // 这层 while 跳出去后，外面那层 for 会再进行一次 ti++，需要 ti-- 抵消
        break;
      }
    }
    return (gridX, gridY) => {
      const tileX = gridX >> tileSideBit;
      const tileY = gridY >> tileSideBit;
      const tile = tiles[(tileY << layerTileBit) | tileX];
      return tile?.(gridX, gridY) ?? Region.STAT_UNKNOWN;
    };
  }
}

class BufferReader {
  private byteIndex: int32 = 0; // buffer 对齐到 byte 的索引
  private bitOffset: byte = 0; // 索引 bit 在 byte 中的偏移
  private currentByte: byte = 0; // 当前已读入的 byte

  constructor(readonly buffer: Uint8Array) {}

  // 读取当前 byte 中 bitOffset 位置的 1bit
  get aft1bit(): int32 {
    return ((this.currentByte << this.bitOffset) >>> 7) & 0b01;
  }

  // 读取当前 byte 中 bitOffset 位置的 2bit
  get aft2bit(): int32 {
    return ((this.currentByte << this.bitOffset) >>> 6) & 0b11;
  }

  // 读取当前 byte 中 bitOffset 位置之后的 bits，挪到高位 1byte 返回
  get aftBitsHigher(): int32 {
    return (this.currentByte << this.bitOffset) & 0b11111111;
  }

  // 读取当前 byte 中 bitOffset 位置之前的 bits，挪到低位 1byte 返回
  get befBitsLower(): int32 {
    return ((this.currentByte & 0b11111111) << this.bitOffset) >>> 8;
  }

  // buffer 是否已读取至末尾
  get isEOF(): boolean {
    return this.byteIndex >= this.buffer.byteLength;
  }

  // 读取下一个 byte
  readonly nextByte = (): byte => {
    this.currentByte = this.buffer[this.byteIndex++];
    return this.currentByte;
  };

  // 游标向后偏移 2bit，若当前 byte 耗尽则自动读取下一个 byte
  readonly offset2bit = (): boolean /*EOF*/ => {
    this.bitOffset += 2;
    if (this.bitOffset < 8) return false;

    this.bitOffset = 0;
    if (this.isEOF) {
      this.currentByte = 0;
      return true;
    } else {
      this.currentByte = this.buffer[this.byteIndex++];
      return false;
    }
  };
}
