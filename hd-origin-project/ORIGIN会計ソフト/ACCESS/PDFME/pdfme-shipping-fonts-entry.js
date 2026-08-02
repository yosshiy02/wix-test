import notoSansDataUrl from "./fonts/NotoSansJP-VF.ttf";
import yuMinchoDataUrl from "./fonts/YuMincho-Demibold.ttf";

function dataUrlToArrayBuffer(dataUrl) {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

window.PdfmeShippingFonts = Object.freeze({
  NotoSansJP: { data: dataUrlToArrayBuffer(notoSansDataUrl), fallback: true },
  YuMinchoDemibold: { data: dataUrlToArrayBuffer(yuMinchoDataUrl) }
});