import QuadGridIdx from "./QuadGridIdx";
import { RegionIdx } from "./RegionIdx";
import RegionQuery from "./RegionQuery";
import { FileChannel } from "./utils";

export { RegionFlag, RegionId } from "./utils";
export { FileChannel, QuadGridIdx, RegionQuery };

export function createRegionQuery(
  openFile: (path: string) => FileChannel | null,
  idx: QuadGridIdx,
  dir: string,
  regionNames: string[]
): RegionQuery {
  return new RegionIdx(openFile, idx, dir, regionNames);
}
