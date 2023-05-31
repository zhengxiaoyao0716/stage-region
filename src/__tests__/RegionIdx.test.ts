import { expect, test } from "@jest/globals";
import { closeSync, existsSync, openSync, readSync } from "fs";
import path from "path";
import QuadGridIdx from "../QuadGridIdx";
import { RegionIdx } from "../RegionIdx";
import { FileChannel, int32 } from "../utils";

const dir = path.resolve(process.cwd(), "src", "__tests__", "assets");

test("test region idx", async () => {
  const idx = QuadGridIdx.of([0, 0, 2000_00, 2000_00], 128);
  const query = new RegionIdx(openFile, idx, dir, ["test"]);
  expect(query.regionFlag(0, 0)).toBe(0);
});

function openFile(path: string): FileChannel | null {
  if (!existsSync(path)) return null;
  const fd = openSync(path, "r");

  function mapToBuffer(length: int32): Buffer {
    const buffer = Buffer.alloc(length);
    const position = -1; // If `position` is `null` or `-1 `, data will be read from the current file position, and the file position will be updated
    const bytesRead = readSync(fd, buffer, 0, length, position);
    return bytesRead < length ? buffer.subarray(0, bytesRead) : buffer;
  }

  function mapAllToBuffer(): Buffer | undefined {
    const buffers = [mapToBuffer(1024)];
    let totalLength = buffers[0].byteLength;
    if (totalLength === 0) return undefined;
    if (totalLength < 1024) return buffers[0].subarray(0, totalLength);

    while (true) {
      const buffer = mapToBuffer(1024);
      if (buffer.byteLength === 0) break;
      buffers.push(buffer);
      totalLength += buffer.byteLength;
      if (buffer.byteLength < 1024) break;
    }
    return Buffer.concat(buffers, totalLength);
  }
  return {
    map(begin, end) {
      return mapToBuffer(end - begin);
    },
    mapAll(_begin) {
      return mapAllToBuffer();
    },
    close() {
      closeSync(fd);
    },
  };
}
