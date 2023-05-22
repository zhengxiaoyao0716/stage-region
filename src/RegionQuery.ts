import { PosValue, RegionFlag, RegionId, byte } from "./utils";

/** 区域查询器 */

type Id = RegionId; // 区域 id，取值范围为 [1, 30]
type Flag = RegionFlag; // 区域标识，一个标识代表了某个地点所处的多个区域 id 的集合

// 查询接口
interface RegionQuery {
  /**
   * 查询区域标识
   *
   * @param posX .
   * @param posY .
   * @return 区域标识
   */
  regionFlag(posX: PosValue, posY: PosValue): Flag;

  /**
   * 判定某坐标是否位于指定区域内
   *
   * 效果类似于 `regionMatch(regionFlag(posX, posY), id)`，
   * 但当已知目标区域时，无需查询其他区域，该方法效率更高。
   *
   * @param id   区域 id
   * @param posX .
   * @param posY .
   * @return .
   */
  inRegion(id: Id, posX: PosValue, posY: PosValue): boolean;
}

// 基础工具
module RegionQuery {
  /**
   * 最大区域数量
   * <p>
   * 每个区域索引器实例最大只能支持 30 种区域，
   * 但不相干的区域可以放到不同的索引器实例中。
   * </p>
   */
  export const MAX_REGIONS: byte = 30;

  /**
   * 判定某区域 id 是否匹配某区域标识
   *
   * @param flag 区域标识
   * @param id   区域 id
   * @return .
   */
  export function regionMatch(flag: Flag, id: Id): boolean {
    const mask = 1 << (id - 1);
    return (flag & mask) > 0;
  }

  /**
   * 解析区域标识内所包含的区域 id
   *
   * @param flag 区域标识
   * @return 区域 id 集合
   */
  export function* regionIds(flag: Flag): Generator<Id> {
    if (flag <= 0) return;
    for (let id = 1; id <= 30; id++) {
      const mask = 1 << id;
      if (mask > flag) break;
      if ((flag & mask) > 0) yield id;
    }
  }

  /**
   * 求两区域标识中不同区域 id 集合
   *
   * @param flagOne .
   * @param flagOth .
   * @return 区域 id 集合
   */
  export function regionDiff(flagOne: Flag, flagOth: Flag): Generator<Id> {
    return regionIds(flagOne ^ flagOth);
  }
}

export default RegionQuery;
