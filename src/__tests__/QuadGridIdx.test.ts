import { expect, test } from "@jest/globals";
import QuadGridIdx from "../QuadGridIdx";

// prettier-ignore
test("test quad grid idx cm", () => {   // 单位厘米
  // 开放世界，8000 米 * 8000 米（实际空间 10485.76 米 * 10485.76 米，浪费 31%）, 最小格子 20 米（20.48米），最大 9 层
  const idxInCm = QuadGridIdx.of([-5_000_00, -5_000_00, 5_000_00, 5_000_00], 20_00);   // 如果利用 10000 米 * 10000 米的空间，则浪费率只有 4.9%）
  // 副本地图，1000 米 * 1000 米（实际空间 1310.72 米 * 1310.72 米，浪费 31 %），最小格子 20 米（20.48米），最大 6 层
  const idxInCmDungeon = QuadGridIdx.of([-500_00, -500_00, 500_00, 500_00], 20_00);
  // 测试一下以上推断是否成立
  expect(idxInCm.maxDepth).toBe(9);
  expect(idxInCm.minWidth).toBe(20.48 * 100);
  expect(idxInCmDungeon.maxDepth).toBe(6);
  expect(idxInCmDungeon.minWidth).toBe(20.48 * 100);
});

// prettier-ignore
test("test quad grid idx mm", () => {   // 单位毫米
  // 开放世界，8000 米 * 8000 米（实际空间 8388.608 米 * 8388.608 米，浪费 4.9%），最小格子 16 米（16.384米），最大 9 层
  const idxInMm = QuadGridIdx.of([-4_000_000, -4_000_000, 4_000_000, 4_000_000], 16_000);
  // 副本地图，1000 米 * 1000 米（实际空间 1048.576 米 * 1048.576 米，浪费 4.9 %），最小格子 16 米（16.384米），最大 6 层
  const idxInMmDungeon = QuadGridIdx.of([-500_000, -500_000, 500_000, 500_000], 16_000);
  // 测试一下以上推断是否成立
  expect(idxInMm.maxDepth).toBe(9);
  expect(idxInMm.minWidth).toBe(16.384 * 1000);
  expect(idxInMmDungeon.maxDepth).toBe(6);
  expect(idxInMmDungeon.minWidth).toBe(16.384 * 1000);
});

// prettier-ignore
test("test quad grid idx", () => {  // 单位米
  const idx = QuadGridIdx.of([-4000, -4000, 4000, 4000], 16);
  // testFullBuildMemo(root);
  // 数值估算：对于 8km * 8km 大小、单位长度 10m 的地图，
  // 索引树结构的最大深度为 9 层（从 0 开始，共 10 层），
  // 网格最小宽度为 16m，可索引的范围为 16 << 9 = 8192m。
  expect(idx.maxDepth).toBe(9);
  expect(idx.minWidth).toBe(16);
  expect(idx.widthBit).toBe(4);
  expect(idx.maxWidth).toBe(8192);
});
