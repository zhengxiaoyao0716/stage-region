import { $renderer, handleFile } from "./Renderer.play";
import "./index.play.css";

const $app = document.querySelector<HTMLDivElement>("#app")!;

$app.appendChild(
  (() => {
    const $uploadInput = document.createElement("input");
    $uploadInput.id = "upload";
    $uploadInput.type = "file";
    $uploadInput.addEventListener("change", (event: Event) => {
      const target = event.target as HTMLInputElement | null;
      handleFile(target?.files?.[0]);
    });

    const $uploadLabel = document.createElement("label");
    $uploadLabel.setAttribute("for", "upload");
    $uploadLabel.innerText = "拖拽或点击上传数据文件";
    $uploadLabel.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer!.dropEffect = "copy";
    });
    $uploadLabel.addEventListener("drop", (event) => {
      event.preventDefault();
      handleFile(event.dataTransfer?.files?.[0]);
    });

    const $selectFile = document.createElement("div");
    $selectFile.id = "selectFile";
    $selectFile.appendChild($uploadInput);
    $selectFile.appendChild($uploadLabel);
    return $selectFile;
  })()
);

$app.appendChild(
  (() => {
    const $outputArea = document.createElement("div");
    $outputArea.id = "outputArea";
    $outputArea.appendChild($renderer);
    return $outputArea;
  })()
);
