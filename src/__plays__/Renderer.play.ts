import QuadGridIdx from "../QuadGridIdx";
import { Region, RegionIdx } from "../RegionIdx";
import { FileChannel } from "../utils";
import "./Renderer.play.css";

export const $renderer = document.createElement("div");
$renderer.id = "renderer";

const $canvas = document.createElement("canvas");
$renderer.appendChild($canvas);

const stageMap = (() => {
  const ctx = $canvas.getContext("2d");
  if (ctx == null) throw new Error(); // NEVER!
  const clear = (maxWidth: number) => {
    ctx.clearRect(0, 0, maxWidth, maxWidth);
  };
  const draw = (maxWidth: number, x: number, y: number, width: number) => {
    console.log(maxWidth, x, y, width);
  };
  return { clear, draw };
})();

const $pannel = document.createElement("div");
$pannel.id = "pannel";
$renderer.appendChild($pannel);

const getIdxArgs = (() => {
  const $idxArgs = document.createElement("form");
  $idxArgs.innerHTML = `
    <input name="stageMinX" type="number" title="stageMinX" placeholder="stageMinX" />
    <input name="stageMinY" type="number" title="stageMinY" placeholder="stageMinY" />
    <input name="stageMaxX" type="number" title="stageMaxX" placeholder="stageMaxX" />
    <input name="stageMaxY" type="number" title="stageMaxY" placeholder="stageMaxY" />
    <input name="unitWidth" type="number" title="unitWidth" placeholder="unitWidth" />
  `;
  $pannel.appendChild($idxArgs);

  function getIdxArgs(): [number, number, number, number, number] {
    const $inputs = $idxArgs.getElementsByTagName("input");
    const saved = JSON.parse(
      localStorage.getItem("idxArgs") ??
        "[-500000, -500000, 500000, 500000, 128]"
    );
    const args = Array.prototype.map.call($inputs, ($input, i) => {
      if ($input.value) return Number.parseInt($input.value);
      $input.value = String(saved[i]);
      return saved[i];
    }) as [number, number, number, number, number];
    localStorage.setItem("idxArgs", JSON.stringify(args));
    return args;
  }
  return getIdxArgs;
})();

const renderLayers = (() => {
  const $layersLabel = document.createElement("i");
  $layersLabel.innerText = "layers";
  $layersLabel.classList.add("label");
  $pannel.appendChild($layersLabel);

  const $layers = document.createElement("div");
  $layers.id = "layers";
  $pannel.appendChild($layers);

  const visibleSvgPath =
    '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"></path>';
  const hiddenSvgPath =
    '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78 3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"></path>';

  let toggleLayerVisible: ((depth: number) => boolean) | undefined;

  $layers.addEventListener("click", (event) => {
    if (toggleLayerVisible == null) return;
    const target = event.target as HTMLElement | null;
    if (target == null) return;
    const depth = Number.parseInt(target.getAttribute("data-x-depth")!);
    if (Number.isNaN(depth)) return;

    const $svg = target.getElementsByTagName("svg")[0];
    const visible = toggleLayerVisible(depth);
    $svg.innerHTML = visible ? visibleSvgPath : hiddenSvgPath;
  });

  function renderLayers(
    depthVisibleArr: boolean[],
    toggleVisible?: (depth: number) => boolean
  ) {
    toggleLayerVisible = toggleVisible;
    if (depthVisibleArr.length === 0) {
      $layers.innerHTML =
        '<span style="display: block; text-align: center;">&lt;empty&gt;</span>';
      return;
    }
    $layers.innerHTML = depthVisibleArr
      .map((visible, i) => {
        const depthText = String(i).padStart(2, "0");
        const svgPath = visible ? visibleSvgPath : hiddenSvgPath;
        return `<div data-x-depth="${i}"><span>no.${depthText}</span><svg viewBox="0 0 24 24">${svgPath}</svg></div>`;
      })
      .join("\n  ");
  }
  renderLayers([]);
  return renderLayers;
})();

export async function handleFile(file?: File) {
  if (file == null) {
    renderLayers([]);
    return;
  }
  const buffer = new Uint8Array(await file.arrayBuffer());
  const channel: FileChannel = {
    close() {},
    map(begin, size) {
      return buffer.slice(begin, size);
    },
    mapAll(begin) {
      return buffer.slice(begin);
    },
  };
  const [stageMinX, stageMinY, stageMaxX, stageMaxY, unitWidth] = getIdxArgs();
  const idx = QuadGridIdx.of(
    [stageMinX, stageMinY, stageMaxX, stageMaxY],
    unitWidth
  );
  const region = new RegionIdx(() => channel, idx, "", [file.name]).region(0);
  const depthVisibleArr = new Array(1 + idx.maxDepth).fill(true);

  function render() {
    const maxWidth = 1 << idx.maxDepth; // idx.maxWidth >> idx.widthBit
    stageMap.clear(maxWidth);

    for (let depth = 0; depth < depthVisibleArr.length; depth++) {
      if (!depthVisibleArr[depth]) continue;
      const width = 1; // idx.calcWidth(depth) >> idx.widthBit
      const widthBit = idx.maxDepth - depth; // idx.widthBit + idx.maxDepth - depth
      const sideGridNum = 1 << depth;

      for (let x = 0; x < sideGridNum; x++) {
        for (let y = 0; y < sideGridNum; y++) {
          const status = region.gridStatus(depth, x, y);
          if (status != Region.STAT_INCLUDE) continue;
          stageMap.draw(maxWidth, x << widthBit, y << widthBit, width);
        }
      }
    }
  }
  render();

  function toggleLayerVisible(depth: number): boolean {
    const visible = !depthVisibleArr[depth];
    depthVisibleArr[depth] = visible;
    render();
    return visible;
  }
  renderLayers(depthVisibleArr, toggleLayerVisible);
}
