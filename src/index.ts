import QuadGridIdx from "./QuadGridIdx";
import { RegionIdx } from "./RegionIdx";
import RegionQuery from "./RegionQuery";
import { FileChannel } from "./utils";

export { RegionFlag, RegionId } from "./utils";
export { FileChannel, QuadGridIdx, RegionQuery };

/**
 * 创建区域查询实例
 *
 * @param openFile 文件管道
 * @param idx 四叉网格索引器
 * @param dir 区域资源目录
 * @param regionNames 区域名集合
 * @returns 区域查询实例
 */
export function createRegionQuery(
  openFile: (path: string) => FileChannel | null,
  idx: QuadGridIdx,
  dir: string,
  regionNames: string[]
): RegionQuery {
  return new RegionIdx(openFile, idx, dir, regionNames);
}
