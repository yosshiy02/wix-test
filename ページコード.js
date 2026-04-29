
// ================== ページコード（Wix Velo） ==================
import wixData from "wix-data";
import { listFilesByPath } from "backend/media.jsw"; // 画像フォルダ探索
import { saveOrUpdateProduct, deleteStoreProductsByIds } from 'backend/storesProductsCreate.jsw';
import { upsertVariants } from 'backend/variantsUpsert.jsw';
import { listProductsWithMediaByNameBase } from 'backend/storesProductsRead.jsw';
import { saveImageToMedia, saveImageBytesToMediaBoth } from "backend/saveToMedia.jsw";
import { generatePinterestFeedParent, generatePinterestFeedVariant } from "backend/pinterestFeed.jsw";
/* ==================== 設定 ==================== */
const ALLOW_GAPS = false;        // 非連続サイズ選択はブロック
const useBackend = false;        // 将来バックエンド切替用（今はフロント保存のみ）
const SIMPLE_RESPONSES = true;   // レスポンスを簡易表示に

/* ==================== 定数 ==================== */
const NEW_BRAND_VALUE = "__NEW_BRAND__";
const BRAND_PLACEHOLDER = { label: "ブランドを選択", value: "" };
const SLUG_EXEMPT_TITLES = new Set(["SUNGENOVA", "LADY GENOVINA"]); // 大文字比較
const LIVEVIEW_OPTIONS = [
  { label: "Shop",         value: "shop" },
  { label: "Link Catalog", value: "linkCatalog" }
];

// サイズ
const SIZE_ORDER = [
  "21.5","22.0","22.5","23.0","23.5","24.0","24.5","25.0",
  "S","M","L","LL"
];
const SIZE_OPTIONS = [
  ...SIZE_ORDER.slice(0,8).map(v => ({ label: `${v}cm`, value: v })),
  { label:"S", value:"S" }, { label:"M", value:"M" },
  { label:"L", value:"L" }, { label:"LL", value:"LL" }
];

/* ==================== 通貨ユーティリティ ==================== */
function parseJPY(input) {
  if (input == null) return null;
  const s = String(input).replace(/[^\d.]/g, "").replace(/^0+(\d)/, "$1");
  if (s === "" || isNaN(Number(s))) return null;
  const n = Math.floor(Number(s));
  return n >= 0 ? n : null;
}
function formatJPY(n) { return "¥" + Number(n).toLocaleString("ja-JP"); }
function calcPretaxFromPriceBox() {
  const raw = $w("#priceBox")?.value ?? "";
  const inc = parseJPY(raw);
  if (inc == null) throw new Error("価格が不正です");
  return Math.round(inc / 1.1);
}

/* ============== mediaItems / 照合ヘルパー（重要） ============== */
// URL → ファイル名（クエリ/フラグメント除去、lowercase）
function fileNameFromUrl(u){
  const s = String(u || '');
  if (!s) return '';
  const noQuery   = s.split('?')[0];
  const noFrag    = noQuery.split('#')[0];
  const lastPart  = noFrag.split('/').pop() || '';
  return String(lastPart).toLowerCase();
}

// 画像テーブル(gFilesForMain)からファイル名で "001" を逆引き（保険）
function findImageNoByFileName(name){
  const target = String(name || '').toLowerCase();
  if (!target) return '';
  const idx = (gFilesForMain || []).findIndex(f => {
    const base = String(f?.url || '').split('?')[0].split('/').pop().toLowerCase();
    const disp = String(f?.name || '').toLowerCase();
    return base === target || disp === target;
  });
  return idx >= 0 ? String(idx + 1).padStart(3, '0') : '';
}

/* ============================================================
   エディットモード時：productsimgDropdown1/2 を既存値（URL等）で初期選択
   ============================================================ */

// スラグ生成
function toSlug(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]/g, '');
}

/**
 * Stores/Products の slug をキーに mediaItems（ギャラリーURL）をログ出力
 * 例: prodSlug = "he4580-クロ"
 */
async function logMediaItemsBySlug(prodSlug) {
  try {
    const q = await wixData.query('Stores/Products').eq('slug', prodSlug).limit(1).find();
    if (!q?.items?.length) {
      console.log(`[mediaItems:${prodSlug}] not found`);
      return;
    }
    const item = q.items[0];
    const media = Array.isArray(item?.mediaItems) ? item.mediaItems : [];
    if (!media.length) {
      console.log(`[mediaItems:${prodSlug}] (empty)`);
      return;
    }
    media.forEach((m, i) => {
      const url = m?.url || m?.src || m?.image?.url || '';
      console.log(`[mediaItems:${prodSlug}][${i}] ${url}`);
    });
  } catch (e) {
    console.log(`[mediaItems:${prodSlug}] error:`, e?.message || e);
  }
}

/* ============== # ⇄ filename ⇄ URL の対応インデックス ============== */
let gFilesForMain = [];                 // listFilesByPath の生配列
let gNoByFilename = new Map();          // "he4580.jpg" → "013"
let gFilenameByNo = new Map();          // "013"       → "he4580.jpg"
let gRowByMediaId = new Map();          // "<mediaId>" → imageTable の行（{no, url, ...}
let repeaterBound = false;   // ★追加（グローバル）
/** imageTable の行から対応表を生成（setImageTableRowsの最後で呼ぶ） */
// ★追加：shopBrand（埋め込みHTML #shopBrandHtml 用）
let gShopBrand = ""; // "he,ra,lg"

/** filename → "001" 等に解決（インデックス優先、ダメなら保険検索） */
function getNoByFilename(fname){
  const key = String(fname || '').toLowerCase();
  if (!key) return '';
  if (gNoByFilename.has(key)) return gNoByFilename.get(key);
  return findImageNoByFileName(key);
}
// DD値を安全にセット
function setDropdownValueSafe(dd, value) {
  if (!dd) return;
  const opts = Array.isArray(dd.options) ? dd.options : [];
  const has = opts.some(o => String(o.value) === String(value));
  try {
    dd.value = has ? String(value) : undefined;
  } catch (e) {
    try { dd.value = has ? String(value) : ""; } catch {}
  }
}

/** Products の mediaUrls とローカル表（#・filename）突合ログ */
function debugCrossCheckWithProducts(rows){
  (rows || []).forEach(r => {
    const color = r.color || '(no-color)';
    (r.mediaUrls || []).forEach((u,i) => {
      const fn = fileNameFromUrl(u);
      const no = getNoByFilename(fn);
      console.log(`[XCHK] ${color} P${i+1}`, {url:u, file:fn, no, hasNo: !!no});
    });
  });
}

/* ==================== brand 関連 ==================== */
function resolveBrandOrShowError(){
  let ddVal = "";
  try { ddVal = String(($w("#brandDropdown")?.value) || ""); } catch { ddVal = ""; }
  if (!ddVal) { setResponse("ブランドを選択してください。"); return null; }
  return ddVal;
}

function previewResolveBrand(){
  try {
    const ddVal = String(($w("#brandDropdown")?.value) || "");
    if (!ddVal) return null;
    return ddVal;
  } catch { return null; }
}


/* ==================== 初期化 & 更新モード ==================== */
let gUpdateMode = false;
let gUpdateTargetId = "";
let confirmContext = "";     // 'showList' | 'save' | ''
let confirmResolver = null;  // showList側の結果返却用
let pendingExistingItem = null;

// ★追加：メイン画像（iframeプレビュー→最終保存用）
let gMainImageDataUrl = "";   // iframeから来たプレビュー(dataUrl)
let gMainImageUrl = "";       // 既存/保存後の mainMedia URL
let gMainImageFileName = "";  // 任意（ログ用）

let confirmBound = false;

// ★追加：行単位 更新/削除（HTMLの行ボタン用）
let pendingRowId = "";


// ★追加：salesTextHtml 用
let gDescriptionText = "";
let gSalesCatchHtml = "";
let gSalesTextsHtml = "";
let gViewMoreHtml = "";

$w.onReady(async () => {
  await hideElem("#confirmOverlay");
  await loadBrandOptionsWithPlaceholder();
  await hideElem("#SalesTextSection");


  safeSetValue("#titleBox", "", "[INIT] titleBox");
  safeSetValue("#slugheadBox", "", "[INIT] slugheadBox");
  await hideElem("#slugheadBox");
  gDescriptionText = "";

  if ($w("#sizeCheck")) { try { $w("#sizeCheck").options = SIZE_OPTIONS; $w("#sizeCheck").value = []; } catch {} }
  if ($w("#liveviewCheck")) { try { $w("#liveviewCheck").options = LIVEVIEW_OPTIONS; $w("#liveviewCheck").value = []; } catch {} }

  if ($w("#priceBox")) {
    $w("#priceBox").onFocus(() => {
      const raw = String($w("#priceBox").value || "");
      $w("#priceBox").value = raw.replace(/[^\d.]/g, "");
    });
    $w("#priceBox").onInput(() => {
      const v = String($w("#priceBox").value || "");
      const sanitized = v.replace(/[^\d.]/g, "");
      if (v !== sanitized) $w("#priceBox").value = sanitized;
    });
    $w("#priceBox").onBlur(() => {
      const n = parseJPY($w("#priceBox").value);
      if (n !== null) $w("#priceBox").value = formatJPY(n);
    });
  }

  if ($w("#brandDropdown")) $w("#brandDropdown").onChange(handleBrandDropdownChange);

  if ($w("#titleBox")) {
    $w("#titleBox").onInput(async () => {
      await sendSalesEditorDataToHtml();
    });
  }

  if ($w("#priceBox")) {
    $w("#priceBox").onInput(async () => {
      await sendSalesEditorDataToHtml();
    });
  }
  await bindSalesTextSectionToggle();

  if ($w("#salesTextHtml")?.onMessage) {
    $w("#salesTextHtml").onMessage(async (event) => {
      const d = event?.data;
      if (!d) return;

      if (d.type === "salesTextHtmlReady" || d.type === "productSummaryReady") {
        await sendSalesEditorDataToHtml();
        return;
      }

      if (d.type === "salesTextChanged") {
        gDescriptionText = String(d?.description || "");
        gSalesCatchHtml = String(d?.salesCatch || "");
        gSalesTextsHtml = String(d?.salesTexts || "");
        gViewMoreHtml = String(d?.viewMore || "");
        return;
      }

      if (d.type === "titleChanged") {
        safeSetValue("#titleBox", String(d?.value || ""), "[HTML] titleBox");
        await sendSalesEditorDataToHtml();
        return;
      }

      if (d.type === "brandDropdownChanged") {
        try {
          if ($w("#brandDropdown")) {
            $w("#brandDropdown").value = String(d?.value || "");
          }
        } catch {}
        await handleBrandDropdownChange();
        await sendSalesEditorDataToHtml();
        return;
      }

      if (d.type === "slugheadChanged") {
        safeSetValue("#slugheadBox", String(d?.value || "").trim().toLowerCase(), "[HTML] slugheadBox");
        await sendSalesEditorDataToHtml();
        return;
      }

      if (d.type === "priceChanged") {
        safeSetValue("#priceBox", String(d?.value || ""), "[HTML] priceBox");
        return;
      }

      if (d.type === "liveviewCheckChanged") {
        try {
          if ($w("#liveviewCheck")) {
            $w("#liveviewCheck").value = Array.isArray(d?.values) ? d.values : [];
          }
        } catch {}
        await sendSalesEditorDataToHtml();
        return;
      }

      if (d.type === "sizeCheckChanged") {
        try {
          if ($w("#sizeCheck")) {
            $w("#sizeCheck").value = Array.isArray(d?.values) ? d.values : [];
          }
        } catch {}
        await sendSalesEditorDataToHtml();
        return;
      }

      if (d.type === "shopBrandChanged") {
        gShopBrand = normalizeShopBrandCsv(d?.shopBrand || "");
        await sendSalesEditorDataToHtml();
        return;
      }

      if (d.type === "decisionClick") {
        await handleSaveClick();
        return;
      }

      if (d.type === "pinterestFeedGenerateClick") {
        try {
          $w("#salesTextHtml").postMessage({ type: "pinterestFeedSetBusy", busy: true });

          let res = null;
          if (String(d?.mode || "") === "parent") {
            res = await generatePinterestFeedParent();
          } else if (String(d?.mode || "") === "variant") {
            res = await generatePinterestFeedVariant();
          }
          const msg =
            String(res?.message || "") ||
            (res?.ok ? "完了しました。" : "エラーが発生しました。");

          $w("#salesTextHtml").postMessage({ type: "pinterestFeedSetResponse", message: msg });
        } catch (e) {
          $w("#salesTextHtml").postMessage({
            type: "pinterestFeedSetResponse",
            message: String(e?.message || "エラーが発生しました。")
          });
        } finally {
          $w("#salesTextHtml").postMessage({ type: "pinterestFeedSetBusy", busy: false });
        }
        return;
      }

      if (d.type === "confirmDialogResult") {
        if (d?.confirmed) {
          if (String(d?.confirmType || "") === "showList") {
            if (pendingExistingItem) await populateUIFromExisting(pendingExistingItem);
          }
        }
        return;
      }

      if (d.type === "salesTextHtmlHeight") {
        console.log("[SALES:height]", d?.height);
        return;
      }
    });
  }
 
  bindConfirmHandlersOnce();
  if ($w("#saveButton")) $w("#saveButton").onClick(handleSaveClick);
if ($w("#showListButton")) {
  $w("#showListButton").onClick(async () => {
    console.log("[CLICK] showListButton");
    setResponse("読み込み中…");
    const r = await checkExistingOnShowListWithConfirm();
    console.log("[CLICK] showListButton done:", r);
    if (r === false) setResponse("該当なし");
  });
}
// ★追加：#shopBrandHtml 受信（ブランドチェックボックスHTML）
if ($w("#shopBrandHtml")?.onMessage) {
  console.log("[BIND] shopBrandHtml onMessage bound");

  $w("#shopBrandHtml").onMessage(async (event) => {
    const d = event?.data;
    if (!d) return;

    // HTML側準備完了 → 一覧と現在値を送る
    if (d.type === "iframeReady") {
      await sendShopBrandInitToIframe();
      return;
    }

    // HTML側でチェック変更 → 親で保持
    if (d.type === "shopBrandChanged") {
      gShopBrand = normalizeShopBrandCsv(d.shopBrand);
      console.log("[SHOPBRAND] changed", { shopBrand: gShopBrand, reason: d.reason });
      return;
    }

    // HTML側から現在値要求
    if (d.type === "requestCurrentShopBrandHandled") {
      try {
        $w("#shopBrandHtml").postMessage({
          type: "setCurrentShopBrand",
          currentShopBrand: gShopBrand || ""
        });
      } catch {}
      return;
    }
  });
}
// ★追加：#colorRowsIframe 受信（カラーHTMLの更新を親の colorRows に反映）
if ($w("#colorRowsIframe")?.onMessage) {
  console.log("[BIND] colorRowsIframe onMessage bound");

  $w("#colorRowsIframe").onMessage(async (event) => {
    const d = event?.data;
    console.log("[RECV] colorRowsIframe", d?.type || "(no-type)", d);

    if (!d) return;
    await handleColorRowsIframeMessage(d);
  });
}

// ★追加：親側の初期1行を作って iframe と同期（空行ドロップ時の rowId 不一致防止）
initColorRowsIframeUI();

// ★追加：#mediagalleryRowDrop 受信
if ($w("#mediagalleryRowDrop")?.onMessage) {
  console.log("[BIND] mediagalleryRowDrop onMessage bound");

  $w("#mediagalleryRowDrop").onMessage(async (event) => {
    const d = event?.data;
    console.log("[RECV] mediagalleryRowDrop", d?.type || "(no-type)", d);

    if (!d) return;
    await handlemediagalleryRowDropMessage(d);
  });
}

// ★追加：親側の初期1行を作って iframe と同期
initmediagalleryRowDropUI();

 // ★差し替え：#mainimageUpdate 受信（プレビューはHTML側で完結）
if ($w("#mainimageUpdate")?.onMessage) {
  $w("#mainimageUpdate").onMessage(async (event) => {
    const d = event?.data;
    if (!d) return;

    // HTML起動通知（必要ならログだけ）
    if (d.type === "mainimageIframeReady") {
      console.log("[mainimageIframeReady]");
      return;
    }

    // ★ドロップ：bytes を dataUrl にせず、必要情報を保持
    if (d.type === "mainimageDropped") {
      try {
        const bytes = d?.bytes;
        const mime = String(d?.mimeType || "");
        const fileName = String(d?.fileName || "");

        if (!Array.isArray(bytes) || bytes.length === 0) return;

        const out = await saveImageBytesToMediaBoth(bytes, mime);
        const fileUrl = String(out?.fileUrl || "");
        const viewUrl = String(out?.displayUrl || fileUrl);

          gMainImageUrl = fileUrl;
        gMainImageDataUrl = "";
        gMainImageFileName = fileName;

        await sendSalesEditorDataToHtml();

        console.log("[MAIN:DROPPED]", { fileName, fileUrl, viewUrl });
      } catch (e) {
        console.log("[MAIN:DROPPED] failed", e?.message || e);
      }
      return;
    }

    // ★クリア：保持も消す
    if (d.type === "mainimageCleared") {
       gMainImageDataUrl = "";
      gMainImageUrl = "";
      gMainImageFileName = "";
      await sendSalesEditorDataToHtml();
      console.log("[MAIN:CLEAR] from iframe");
      return;
    }
  });
}
});
// ==================== shopBrand iframe 用 helpers ====================
function normalizeShopBrandCsv(csv) {
  const arr = String(csv ?? "")
    .split(",")
    .map(s => String(s || "").trim().toLowerCase())
    .filter(Boolean);

  return [...new Set(arr)].join(",");
}

async function getBrandListForShopBrandEditor() {
  const rows = [];

  try {
    let res = await wixData.query("BrandSettings").ascending("brand").limit(1000).find();

    const pushItems = (items) => {
      (items || []).forEach(it => {
        const name = String(it?.brand || "").trim();
        const prefix = String(it?.brandPrefix || "").trim().toLowerCase();
        if (!name || !prefix) return;
        rows.push({ name, prefix });
      });
    };

    pushItems(res?.items);

    while (res?.hasNext()) {
      res = await res.next();
      pushItems(res?.items);
    }
  } catch (e) {
    console.log("[SHOPBRAND] getBrandListForShopBrandEditor failed", e?.message || e);
  }

  // prefix重複除去
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.prefix)) map.set(r.prefix, r);
  }

  return Array.from(map.values()).sort((a, b) =>
    String(a.name).localeCompare(String(b.name), "ja")
  );
}

async function sendShopBrandInitToIframe() {
  try {
    if (!$w("#shopBrandHtml") || typeof $w("#shopBrandHtml").postMessage !== "function") return;

    const brands = await getBrandListForShopBrandEditor();

    $w("#shopBrandHtml").postMessage({
      type: "initShopBrandEditor",
      brands,
      currentShopBrand: normalizeShopBrandCsv(gShopBrand || "")
    });

    console.log("[SHOPBRAND] init sent", {
      count: brands.length,
      currentShopBrand: normalizeShopBrandCsv(gShopBrand || "")
    });
  } catch (e) {
    console.log("[SHOPBRAND] sendShopBrandInitToIframe failed", e?.message || e);
  }
}
/* ============= ブランド options ============= */
async function loadBrandOptionsWithPlaceholder() {
  const set = new Set();
  try {
    let res = await wixData.query("BrandSettings").ascending("brand").limit(1000).find();
    accumulateBrands(res, set);
    while (res.hasNext()) { res = await res.next(); accumulateBrands(res, set); }
  } catch (e) { setResponse("エラーが発生しました。"); }

  const list = Array.from(set)
    .filter(Boolean).map(x => String(x).trim()).filter(x => x.length > 0)
    .sort((a,b)=>a.localeCompare(b,"ja"));

  const options = [
    BRAND_PLACEHOLDER,
    ...list.map(x => ({ label: x, value: x }))
  ];

  try {
    if ($w("#brandDropdown")) {
      $w("#brandDropdown").options = options;
      $w("#brandDropdown").value = BRAND_PLACEHOLDER.value;
    }
  } catch {}
}
function bindConfirmHandlersOnce(){
  if (confirmBound) return;

  if ($w("#confirmYes")) $w("#confirmYes").onClick(async ()=>{
    console.log("[VLOG] confirmYes", { confirmContext, gUpdateMode, gUpdateTargetId });
    await hideElem("#confirmOverlay");
    try { $w("#saveButton")?.enable(); } catch{}

    if (confirmContext === 'showList') {
      if (pendingExistingItem) await populateUIFromExisting(pendingExistingItem);
      if (typeof confirmResolver === 'function') confirmResolver(true);
      confirmContext = '';
      pendingExistingItem = null;
      confirmResolver = null;
      return;
    }

    if (confirmContext === 'save') {
      if (gUpdateMode) {
        await saveItemFacadeUpdate();
      } else {
        await saveItemFacade();
      }
      confirmContext = '';
      confirmResolver = null;
      return;
    }

    if (confirmContext === "rowDelete") {
      const rowId = String(pendingRowId || "");
      pendingRowId = "";
      confirmContext = "";
      await applyRowDeleteNow(rowId);
      return;
    }

    if (confirmContext === "mediagalleryRowDelete") {
      const rowId = String(pendingRowId || "");
      pendingRowId = "";
      confirmContext = "";
      await applymediagalleryRowDeleteNow(rowId);
      return;
    }

if (confirmContext === "rowUpdateInv") {
  const rowId = String(pendingRowId || "");
  console.log("[FLOW:YES] rowUpdateInv -> applyRowUpdateNow(keep) START", {
    rowId,
    gUpdateMode,
    gUpdateTargetId
  });

  pendingRowId = "";
  confirmContext = "";

  await applyRowUpdateNow(rowId, "keep");

  console.log("[FLOW:YES] rowUpdateInv -> applyRowUpdateNow(keep) END", { rowId });
  return;
}

if (confirmContext === "rowUpdateInv") {
  await hideElem("#confirmOverlay");
  try { $w("#saveButton")?.enable(); } catch{}

  const rowId = String(pendingRowId || "");
  console.log("[FLOW:NO] rowUpdateInv -> applyRowUpdateNow(reset) START", {
    rowId,
    gUpdateMode,
    gUpdateTargetId
  });

  pendingRowId = "";
  confirmContext = "";

  await applyRowUpdateNow(rowId, "reset");

  console.log("[FLOW:NO] rowUpdateInv -> applyRowUpdateNow(reset) END", { rowId });
  return;
}

    confirmContext = '';
    pendingExistingItem = null;
    confirmResolver = null;
  });

  if ($w("#confirmNo")) $w("#confirmNo").onClick(async ()=>{
    if (confirmContext === "rowUpdateInv") {
      await hideElem("#confirmOverlay");
      try { $w("#saveButton")?.enable(); } catch{}

      const rowId = String(pendingRowId || "");
      pendingRowId = "";
      confirmContext = "";
      await applyRowUpdateNow(rowId, "reset");
      return;
    }

    setResponse("キャンセルしました。");
    await hideElem("#confirmOverlay");
    try { $w("#saveButton")?.enable(); } catch{}
    if (typeof confirmResolver === 'function') confirmResolver(false);

    confirmContext = '';
    pendingExistingItem = null;
    confirmResolver = null;
  });

  confirmBound = true;
}
function accumulateBrands(result, set){
  const items = (result && result.items) ? result.items : [];
  items.forEach(it=>{
    const b = it && it.brand;
    if (typeof b === "string") set.add(b.trim());
    else if (typeof b === "number") set.add(String(b));
  });
}

async function handleBrandDropdownChange(){
  const val = String($w("#brandDropdown")?.value || "");
  if (!val) {
    safeSetValue("#slugheadBox", "", "[BRAND] プレースホルダ → slughead 空");
    return;
  }

  try {
    const r = await wixData.query("BrandSettings")
      .eq("brand", val)
      .limit(1)
      .find();

    const it = r?.items?.[0];
    const px = String(it?.brandPrefix || "").trim().toLowerCase();

    safeSetValue("#slugheadBox", px, "[BRAND] brandPrefix → slugheadBox");
  } catch {
    safeSetValue("#slugheadBox", "", "[BRAND] brandPrefix 取得失敗");
  }
   await sendSalesEditorDataToHtml();
}

async function getBrandPrefixLower(brand){
  try{
    const r = await wixData.query("BrandSettings")
      .eq("brand", String(brand || "").trim())
      .limit(1)
      .find();
    const it = r?.items?.[0];
    const px = String(it?.brandPrefix || "").trim().toLowerCase();
    return px;
  }catch{
    return "";
  }
}
/* ============= 既存判定（showList前に確認） ============= */
function computeFinalTitleFromInputs() {
  const baseTitle = String($w("#titleBox")?.value || "").trim();
  const slugHeadLower = String($w("#slugheadBox")?.value || "").trim().toLowerCase();
  if (!baseTitle || !slugHeadLower) return { ok:false, finalTitle:"", slugHeadLower, baseTitle };
  const slugHeadUpper = slugHeadLower.toUpperCase();
  const isExempt = SLUG_EXEMPT_TITLES.has(baseTitle.toUpperCase());
  const finalTitle = isExempt ? baseTitle : `${slugHeadUpper}${baseTitle}`;
  return { ok:true, finalTitle, slugHeadLower, baseTitle };
}

async function checkExistingOnShowListWithConfirm() {
  try {
    const { ok, finalTitle, baseTitle } = computeFinalTitleFromInputs();
    if (!ok) { setResponse("エラーが発生しました。"); return false; }

    const brand = String($w("#brandDropdown")?.value || "");

    // ★追加：LG/SG は「brand + 数字title（接頭語なし）」を優先して探す
    const isLgOrSg = (brand === "LADY GENOVINA" || brand === "SUNGENOVA");

    let q = null;

    if (isLgOrSg) {
      // まず：brand一致 & title=5168（接頭語なし）
      q = await wixData.query("Import307")
        .eq("brand", brand)
        .eq("title", baseTitle)
        .limit(1)
        .find();

      // 無ければ：brand一致 & title=LG5168（従来形式）
      if (!(q?.items?.length > 0)) {
        q = await wixData.query("Import307")
          .eq("brand", brand)
          .eq("title", finalTitle)
          .limit(1)
          .find();
      }
    } else {
      // 従来：title=HE002 など
      q = await wixData.query("Import307")
        .eq("title", finalTitle)
        .limit(1)
        .find();
    }

    const exists = !!(q?.items?.length > 0);
    if (!exists) {
      gUpdateMode = false;
      gUpdateTargetId = "";
      return false;
    }

    gUpdateMode = true;
    gUpdateTargetId = String(q.items[0]._id || "");
    pendingExistingItem = q.items[0];

    await dumpExistingDataOnce(pendingExistingItem);

    if ($w("#confirmText")) {
      $w("#confirmText").text =
        `該当データが見つかりました。編集内容を表示しますか？\n` +
        `・タイトル: ${String(q.items[0]?.title || "")}\n` +
        `・ブランド: ${String(q.items[0]?.brand || "")}\n` +
        `・既存ID: ${gUpdateTargetId}`;
    }

    confirmContext = 'showList';
    await showElem("#confirmOverlay");

    const result = await new Promise(resolve => { confirmResolver = resolve; });
    return result === true;
  } catch {
    setResponse("エラーが発生しました。");
    return false;
  }
}
/* ==================== サイズ/画像 復元ヘルパー ==================== */
function parseSizeRangeToSelections(sizeText) {
  const t = String(sizeText || "").trim();
  if (!t) return [];
  const s = t.replace(/\u3000/g, " ")
             .replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
  const parts = s.split(/[~～-]/).map(p => p.trim()).filter(Boolean);

  if (parts.length !== 2) {
    const single = parts[0].replace(/cm$/i, "");
    return SIZE_ORDER.includes(single) ? [single] : [];
  }

  const normLabel = (v) => v.replace(/cm$/i, "");
  const a = normLabel(parts[0]);
  const b = normLabel(parts[1]);

  const idxA = SIZE_ORDER.indexOf(a);
  const idxB = SIZE_ORDER.indexOf(b);
  if (idxA === -1 || idxB === -1) return [];

  const [lo, hi] = idxA <= idxB ? [idxA, idxB] : [idxB, idxA];
  return SIZE_ORDER.slice(lo, hi + 1);
}

function findImageNoByUrl(url) {
  if (!url) return "";
  const target = String(url).split("?")[0];
  const targetName = target.split("/").pop();
  const idx = (gFilesForMain || []).findIndex(f => {
    const u = String(f?.url || "");
    const uBase = u.split("?")[0];
    const uName = uBase.split("/").pop();
    return uBase === target || uName === targetName;
  });
  return idx >= 0 ? String(idx + 1).padStart(3, "0") : "";
}

/* ============= Products から色行復元 + URLログ ============= */
async function loadColorRowsFromProducts(slugHeadLower, baseTitle) {
  const slugHeadUpper = String(slugHeadLower || '').toUpperCase();
  const isExempt = SLUG_EXEMPT_TITLES.has(String(baseTitle || '').toUpperCase());
  const nameBase = isExempt ? String(baseTitle || '') : `${slugHeadUpper}${baseTitle}`;
  const slugBase = `${String(slugHeadLower || '').toLowerCase()}${String(baseTitle || '')}`;

  const res = await listProductsWithMediaByNameBase(nameBase);

  if (!res.ok) {
    console.log('[V2 NOT READY]', res.error);
    try { $w('#response').text = 'Wix Stores v2 が使えません（アプリ未追加 or モジュール名不一致）。'; } catch {}
    return [makeColorRow()];
  }

const rows = res.items.map(p => {
  const color = p.name.startsWith(`${nameBase} `)
    ? p.name.slice(`${nameBase} `.length).trim()
    : '';
  const mu = p.mediaUrls || [];

  const pid = String(
    (p && (p.productId || p._id || p.id || p.product_id)) || ""
  );

  return {
    _id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    color,
    img1Url: mu[0] || '',
    img2Url: mu[1] || '',
    img1MediaUrl: mu[0] || '',
    img2MediaUrl: mu[1] || '',
    mediaUrls: mu,
    slug: p.slug || `${slugBase}-${String(color)}`,
    productId: pid
  };
});


  // mediaUrls が空の行は旧v1の mediaItems を slug で補完（URLは取得文字列のまま）
  // mediaUrls が空の行は旧v1の mediaItems を slug で補完（URLは取得文字列のまま）
  for (const r of rows) {
    if ((!Array.isArray(r.mediaUrls) || r.mediaUrls.length === 0) && r.slug) {
      const fallback = await getMediaUrlsBySlug(r.slug);
      if (fallback.length > 0) {
        r.mediaUrls = fallback.slice();

        // ★追加：保存用（wix:image://）もセット
        if (!r.img1MediaUrl) r.img1MediaUrl = String(fallback[0] || '');
        if (!r.img2MediaUrl) r.img2MediaUrl = String(fallback[1] || '');

        // 表示用（https）もセット
        if (!r.img1Url) r.img1Url = toPreviewUrl(fallback[0] || '');
        if (!r.img2Url) r.img2Url = toPreviewUrl(fallback[1] || '');

 r.mediaTouched = false;   // ★追加：既存復元は「編集してない」

        console.log('[FALLBACK mediaUrls applied]', r.color, r.mediaUrls);
      }
    }
  }
  const logLines = rows.map(r => `[${r.color}] ${ (r.mediaUrls||[]).join(', ') || '(no mediaItems)' }`).join('\n');
  console.log('[MEDIA-URL]\n' + logLines);
  try { $w('#response').text = logLines || 'MEDIA-URL: (no items)'; } catch {}

  for (const r of rows) {
    const s = String(r.slug || '').trim();
    if (s) await logMediaItemsBySlug(s);
  }

  return rows.length ? rows : [makeColorRow()];
}

/* ==================== 既存UI復元 ==================== */
async function populateUIFromExisting(item) {
  try {
    const title = String(item?.title || "");
    const brand = String(item?.brand || "");
    const price = Number(item?.price ?? 0);
    const formattedPrice = item?.formattedPrice ? String(item.formattedPrice) : (price ? formatJPY(Math.round(price*1.1)) : "");
    const description = String(item?.description || "");
    const shop = !!item?.shop;
    const linkCatalog = !!item?.linkCatalog;
    const shopBrand = String(item?.shopBrand || ""); // ★追加
    const mainMedia = String(item?.mainMedia || "");
    const mediagallerySaved = Array.isArray(item?.mediagallery) ? item.mediagallery : [];
    const sizeText = String(item?.size || "");

    // title → slughead/baseTitle 復元
    // title → slughead/baseTitle 復元
    let slugHeadUpper = "";
    let baseTitle = title;

    const isLgOrSgBrand = (brand === "LADY GENOVINA" || brand === "SUNGENOVA");
    const isNumericTitle = /^\d+$/.test(String(title || "").trim());

    if (isLgOrSgBrand && isNumericTitle) {
      // ★LG/SGで title=5076 のような「接頭語なし保存」に対応
      const px = await getBrandPrefixLower(brand);  // "lg" / "sg"
      slugHeadUpper = String(px || "").toUpperCase();
      baseTitle = String(title || "").trim();
    } else if (!SLUG_EXEMPT_TITLES.has(title.toUpperCase()) && title.length >= 2) {
      slugHeadUpper = title.slice(0,2).toUpperCase();
      baseTitle = title.slice(2);
    }

    const slugHeadLower = slugHeadUpper.toLowerCase();

    // UI: ベース項目
    safeSetValue("#titleBox", baseTitle, "[POP] titleBox");
    safeSetValue("#slugheadBox", slugHeadLower, "[POP] slugheadBox");
 if ($w("#brandDropdown")) {
  try {
    const opts = $w("#brandDropdown").options || [];
    if (opts.some(o => o.value === brand)) {
      $w("#brandDropdown").value = brand;
    } else {
      $w("#brandDropdown").value = BRAND_PLACEHOLDER.value;
    }
  } catch {}
}

    safeSetValue("#priceBox", formattedPrice, "[POP] priceBox");
    gDescriptionText = String(description || "");
    if ($w("#liveviewCheck")) {
      const vals = []; if (shop) vals.push("shop"); if (linkCatalog) vals.push("linkCatalog");
      try { $w("#liveviewCheck").value = vals; } catch {}
    }

 // ★追加：shopBrand 復元 → 埋め込みHTMLへ反映
gShopBrand = normalizeShopBrandCsv(shopBrand);
try {
  $w("#shopBrandHtml")?.postMessage({
    type: "setCurrentShopBrand",
    currentShopBrand: gShopBrand
  });
} catch {}
console.log("[POP] shopBrand", gShopBrand);
    // サイズの復元
    try {
      const sel = parseSizeRangeToSelections(sizeText);
      if ($w("#sizeCheck")) { $w("#sizeCheck").value = sel; }
      console.log("[RESTORE] sizeCheck:", $w("#sizeCheck")?.value);
    } catch(e) {}


    // メイン画像復元（★mainimageDropdownは使わない：#mainImageへ表示＋既存URL保持）
    // メイン画像復元（★mainimageDropdownは使わない：#mainImageへ表示＋既存URL保持）
try {
  if (mainMedia) {
    gMainImageUrl = String(mainMedia || "");
    gMainImageDataUrl = "";

    // ★HTMLへ表示指示（統一枠に出す）
    try {
      $w("#mainimageUpdate")?.postMessage({ type:"mainimageSetUrl", url: toPreviewUrl(gMainImageUrl) });
    } catch {}

    console.log("[RESTORE] mainImage:", gMainImageUrl);
  } else {
    // 空ならHTML側もクリア表示
    try {
      $w("#mainimageUpdate")?.postMessage({ type:"mainimageSetUrl", url: "" });
    } catch {}
  }
} catch(e) {}

 // ★追加：mediagallery 復元
    try {
      mediagalleryRows = (mediagallerySaved || [])
        .map((x, i) => {
          const src = String(x?.src || "").trim();
          return {
            _id: `${Date.now()}-${i}-${Math.random().toString(36).slice(2,8)}`,
            imgUrl: toPreviewUrl(src),
            mediaUrl: src
          };
        })
        .filter(r => String(r.mediaUrl || "").trim());

      if (!mediagalleryRows.length) {
        mediagalleryRows = [makemediagalleryRow()];
      }

      syncmediagalleryRowsToIframe();
      console.log("[POP] mediagallery", mediagalleryRows);
    } catch(e) {}
    // カラー行（Products から）
      // カラー行（Products から）
    try {
      const rows = await loadColorRowsFromProducts(slugHeadLower, baseTitle);
      debugCrossCheckWithProducts(rows);
      colorRows = rows;
      syncColorRowsToIframe();   // iframeへ反映（ここだけ残す）
    } catch(e) {}

    // ★追加：ProductSalesTexts 呼び出し
    try {
      const currentSlug = `${slugHeadLower}${baseTitle}`;
      await loadSalesTextBySlugToEditor(currentSlug);
      await syncSalesSectionPreviewButton();
    } catch(e) {}

  } catch(e) {
    console.log("[populateUIFromExisting] error:", e?.message || e);
  }
}

/* ============= 保存フロー ============= */
async function handleSaveClick(){
    console.log("[VLOG] handleSaveClick:START", {
    title: String($w("#titleBox")?.value || ""),
    brand: String($w("#brandDropdown")?.value || ""),
    slughead: String($w("#slugheadBox")?.value || ""),
  });

  
  setResponse("");
  const baseTitle = String($w("#titleBox")?.value || "").trim();
  if (!baseTitle){ setResponse("エラーが発生しました。"); return; }

  const brandForCheck = resolveBrandOrShowError();
  if (brandForCheck === null) return;

  const slugHeadLower = String($w("#slugheadBox")?.value || "").trim().toLowerCase();
  const slugHeadUpper = slugHeadLower.toUpperCase();
  if (!slugHeadLower) { setResponse("エラーが発生しました。"); return; }

  const selSizes  = Array.isArray($w("#sizeCheck")?.value) ? $w("#sizeCheck").value : [];
  const rangeInfo = buildSizeRange(selSizes);
  if (rangeInfo.hasGap) { try { $w("#saveButton")?.enable(); } catch {} setResponse("エラーが発生しました。"); return; }

  const rawPrice = $w("#priceBox")?.value ?? "";
  const priceNum = parseJPY(rawPrice);
  if (priceNum === null) { setResponse("エラーが発生しました。"); try { $w("#saveButton")?.enable(); } catch {} return; }

  try { $w("#saveButton")?.disable(); await showElem("#confirmOverlay"); } catch {}

  try {
    const isExempt     = SLUG_EXEMPT_TITLES.has(baseTitle.toUpperCase());
    const previewTitle = isExempt ? baseTitle : `${slugHeadUpper}${baseTitle}`;
    const previewSlug  = `${slugHeadLower}${baseTitle}`;

    const liveVals = Array.isArray($w("#liveviewCheck")?.value) ? $w("#liveviewCheck")?.value : [];
    const livePreview = liveVals.length
      ? liveVals.map(v => LIVEVIEW_OPTIONS.find(o => o.value === v)?.label || v).join(", ")
      : "(None)";
    const previewSizes = rangeInfo.text || "(未選択)";
    const brandPreview = previewResolveBrand() ?? "未選択";
    const mainState = gMainImageDataUrl ? "NEW" : (gMainImageUrl ? "KEEP" : "-");
    const descriptionRaw = String(gDescriptionText || "").trim();
    const descriptionPreview = descriptionRaw
      ? (descriptionRaw.length > 60 ? descriptionRaw.slice(0,60) + "…" : descriptionRaw)
      : "(なし)";

    const header = gUpdateMode
      ? `同一タイトルが既に存在します。編集モードで上書きしますか？`
      : `保存しますか？`;
    const tail = gUpdateMode && gUpdateTargetId ? `\n・既存ID: ${gUpdateTargetId}` : "";

    if ($w("#confirmText")) {
      $w("#confirmText").text =
        `${header}\n` +
        `・タイトル: ${previewTitle}\n` +
        `・slug: ${previewSlug}\n` +
        `・brand/slughead: ${brandPreview} / ${slugHeadUpper}\n` +
        `・サイズ: ${previewSizes}\n` +
        `・価格: ${formatJPY(priceNum)}\n` +
        `・Live View: ${livePreview}\n` +
        `・Main: ${mainState}\n` +
        `・説明: ${descriptionPreview}` +
        tail;
    }

    confirmContext = 'save';
    confirmResolver = null;
  } catch {}
}

// ★追加：行から「保存用 mediaUrls」を確定（空配列でStoresメディアを消さない）
function buildRowMediaUrlsForSave(row) {
  const u1 = String(row?.img1MediaUrl || row?.img1Url || "").trim();
  const u2 = String(row?.img2MediaUrl || row?.img2Url || "").trim();

  const list = [];
  if (u1) list.push(u1);
  if (u2) list.push(u2);

  if (list.length > 0) return list;

  const mu = Array.isArray(row?.mediaUrls) ? row.mediaUrls : [];
  const mu2 = mu.map(v => String(v || "").trim()).filter(Boolean);

  if (mu2.length > 0) return mu2;

  return [];
}

async function saveItemFacade() {
    console.log("[VLOG] saveItemFacade:ENTER", {
    baseTitle: String($w('#titleBox')?.value || ''),
    brand: String($w('#brandDropdown')?.value || ''),
    slugHead: String($w('#slugheadBox')?.value || '')
  });

const payload = {
  baseTitle: String($w('#titleBox')?.value || '').trim(),
  brand: String($w('#brandDropdown')?.value || ''),
  slugHead: String($w('#slugheadBox')?.value || '').trim().toLowerCase(),
};

  const err = validateInput(payload);
  if (err) { setResponse("エラーが発生しました。"); try{ $w('#saveButton')?.enable(); }catch{} return; }

  if (useBackend) {
    // 将来: saveNewItem(...)
  } else {
    await doSaveLocal();
  }
}

async function saveItemFacadeUpdate() {
  const payload = {
    baseTitle: String($w('#titleBox')?.value || '').trim(),
    brand: String($w('#brandDropdown')?.value || ''),
    slugHead: String($w('#slugheadBox')?.value || '').trim().toLowerCase(),
  };

  const err = validateInput(payload);
  if (err) { setResponse("エラーが発生しました。"); try{ $w('#saveButton')?.enable(); }catch{} return; }

  if (useBackend) {
    // 将来: updateItem(...)
  } else {
    await doSaveLocalUpdate();
  }
}

function validateInput({ baseTitle, brand, slugHead }) {
  if (!baseTitle) return 'NG';
  if (!brand)     return 'NG';
  if (!slugHead)  return 'NG';
  const raw = ($w("#priceBox")?.value) ?? "";
  const p = parseJPY(raw);
  if (p === null) return 'NG';
  return '';
}

async function doSaveLocal(){
    console.log("[VLOG] doSaveLocal:ENTER", {
    baseTitle: String($w("#titleBox")?.value || "").trim(),
    brand: String($w("#brandDropdown")?.value || ""),
    slugHead: String($w("#slugheadBox")?.value || ""),
    filesForMain: Array.isArray(gFilesForMain) ? gFilesForMain.length : -1
  });
  const baseTitle = String($w("#titleBox")?.value || "").trim();
const brand = String($w("#brandDropdown")?.value || "");
  const slugHeadLower = String($w("#slugheadBox")?.value || "").trim().toLowerCase();
  const slugHeadUpper = slugHeadLower.toUpperCase();

  const selSizes  = Array.isArray($w("#sizeCheck")?.value) ? $w("#sizeCheck")?.value : [];
  const rangeInfo = buildSizeRange(selSizes);
  if (rangeInfo.hasGap && !ALLOW_GAPS) { try { $w("#saveButton")?.enable(); } catch{} setResponse("エラーが発生しました。"); return; }
  const sizeString = rangeInfo.text;

  const rawPrice = ($w("#priceBox")?.value) ?? "";
  const priceNum = parseJPY(rawPrice);
  if (priceNum === null) { setResponse("エラーが発生しました。"); try { $w("#saveButton")?.enable(); } catch{} return; }

  const liveVals = Array.isArray($w("#liveviewCheck")?.value) ? $w("#liveviewCheck").value : [];
  const liveShop        = liveVals.includes("shop");
  const liveLinkCatalog = liveVals.includes("linkCatalog");

  const descriptionRaw = String(gDescriptionText || "").trim();

  // main image（★mainimageDropdownは使わない）
  // 1) 新しいdataUrlがあれば最終保存時にMediaへアップロードしてURL化
  // 2) 無ければ既存URL（gMainImageUrl）を維持
  let mainMediaUrl = String(gMainImageUrl || "");

  if (gMainImageDataUrl) {
    try {
      mainMediaUrl = await saveImageToMedia(gMainImageDataUrl);
      gMainImageUrl = mainMediaUrl;
      gMainImageDataUrl = "";
    } catch {
      setResponse("エラーが発生しました。");
      try { $w("#saveButton")?.enable(); } catch{}
      return;
    }
  }

  if (!baseTitle || !brand || !slugHeadLower){ try{ $w("#saveButton")?.enable(); }catch{} setResponse("エラーが発生しました。"); return; }

const isLgOrSg = (brand === "LADY GENOVINA" || brand === "SUNGENOVA");
const isExempt   = isLgOrSg || SLUG_EXEMPT_TITLES.has(baseTitle.toUpperCase());
const finalTitle = isExempt ? baseTitle : `${slugHeadUpper}${baseTitle}`;
  const slug       = `${slugHeadLower}${baseTitle}`;

  // 重複チェック（Import307）
  let dup;
  try { dup = await wixData.query("Import307").eq("title", finalTitle).limit(1).find(); }
  catch{ try { $w("#saveButton")?.enable(); } catch{} setResponse("エラーが発生しました。"); return; }
  if (dup?.items?.length > 0){ try { $w("#saveButton")?.enable(); } catch{} setResponse("エラーが発生しました。"); return; }

  // insert Import307
  try {
    const mediagalleryForSave = buildmediagalleryItemsForSave();

    console.log("[MEDIA-GALLERY:SAVE:new]", {
      mediagalleryForSave,
      mediagalleryRows: (mediagalleryRows || []).map(r => ({
        _id: r?._id,
        imgUrl: r?.imgUrl,
        mediaUrl: r?.mediaUrl
      }))
    });
    const payload = {
      title: finalTitle,
      brand,
      slug,
      size: sizeString,
      price: priceNum,
      formattedPrice: formatJPY(priceNum),
      shop: liveShop,
      linkCatalog: liveLinkCatalog,
       shopBrand: normalizeShopBrandCsv(gShopBrand || ""),
      mainMedia: mainMediaUrl,
      mediagallery: buildmediagalleryItemsForSave(),
      description: descriptionRaw,
      trackInventory: true,
      manageVariants: true
    };
    await wixData.insert("Import307", payload, { suppressAuth: false });

// ★追加：ProductSalesTexts 保存
    {
      const salesRes = await upsertSalesTextByCurrentSlug();
      if (!salesRes?.ok) {
        try { $w("#saveButton")?.enable(); } catch{}
        setResponse("エラーが発生しました。");
        return;
      }
    }

    // Stores 商品の一括作成（カラー行）
    await createStoresProductsBatch();

    setResponse("保存しました。");
    await resetForm();
  } catch(e){
    console.log("[VLOG] doSaveLocal:FAIL", {
      message: e?.message || e,
      stack: e?.stack || "(no-stack)"
    });
    setResponse("エラーが発生しました。");
    try { $w("#saveButton")?.enable(); } catch{}
    return;
  }
}

async function doSaveLocalUpdate(){
  try {
    if (!gUpdateMode || !gUpdateTargetId) {
      setResponse("エラーが発生しました。");
      try { $w("#saveButton")?.enable(); } catch{}
      return;
    }

      const baseTitle = String($w("#titleBox")?.value || "").trim();
    const brand     = String($w("#brandDropdown")?.value || "");

    const slugHeadLower = String($w("#slugheadBox")?.value || "").trim().toLowerCase(); 
    const slugHeadUpper = slugHeadLower.toUpperCase();

    const selSizes  = Array.isArray($w("#sizeCheck")?.value) ? $w("#sizeCheck")?.value : [];
    const rangeInfo = buildSizeRange(selSizes);
    if (rangeInfo.hasGap && !ALLOW_GAPS) { try { $w("#saveButton")?.enable(); } catch{} setResponse("エラーが発生しました。"); return; }
    const sizeString = rangeInfo.text;

    const rawPrice = ($w("#priceBox")?.value) ?? "";
    const priceNum = parseJPY(rawPrice);
    if (priceNum === null) { setResponse("エラーが発生しました。"); try { $w("#saveButton")?.enable(); } catch{} return; }

    const liveVals = Array.isArray($w("#liveviewCheck")?.value) ? $w("#liveviewCheck")?.value : [];
    const liveShop        = liveVals.includes("shop");
    const liveLinkCatalog = liveVals.includes("linkCatalog");

    const descriptionRaw = String(gDescriptionText || "").trim();

   // main image（★mainimageDropdownは使わない）
   // 1) 新しいdataUrlがあれば最終保存時にMediaへアップロードしてURL化
   // 2) 無ければ既存URL（gMainImageUrl）を維持
   let mainMediaUrl = String(gMainImageUrl || "");

   if (gMainImageDataUrl) {
     try {
       mainMediaUrl = await saveImageToMedia(gMainImageDataUrl);
       gMainImageUrl = mainMediaUrl;
       gMainImageDataUrl = "";
     } catch(e){
    console.log("[VLOG] doSaveLocalUpdate:FAIL", {
      message: e?.message || e,
      stack: e?.stack || "(no-stack)"
    });
    setResponse("エラーが発生しました。");
    try { $w("#saveButton")?.enable(); } catch{}
    return;
  }
}

    if (!baseTitle || !brand || !slugHeadLower){ try{ $w("#saveButton")?.enable(); }catch{} setResponse("エラーが発生しました。"); return; }

const isLgOrSg = (brand === "LADY GENOVINA" || brand === "SUNGENOVA");
const isExempt   = isLgOrSg || SLUG_EXEMPT_TITLES.has(baseTitle.toUpperCase());
const finalTitle = isExempt ? baseTitle : `${slugHeadUpper}${baseTitle}`;
    const slug       = `${slugHeadLower}${baseTitle}`;
    const mediagalleryForSave = buildmediagalleryItemsForSave();

    console.log("[MEDIA-GALLERY:SAVE:update]", {
      targetId: gUpdateTargetId,
      mediagalleryForSave,
      mediagalleryRows: (mediagalleryRows || []).map(r => ({
        _id: r?._id,
        imgUrl: r?.imgUrl,
        mediaUrl: r?.mediaUrl
      }))
    });
    const payload = {
      _id: gUpdateTargetId,
      title: finalTitle,
      brand,
      slug,
      size: sizeString,
      price: priceNum,
      formattedPrice: formatJPY(priceNum),
      shop: liveShop,
      linkCatalog: liveLinkCatalog,
      shopBrand: normalizeShopBrandCsv(gShopBrand || ""), 
      mainMedia: mainMediaUrl,
      mediagallery: buildmediagalleryItemsForSave(),
      description: descriptionRaw,
      trackInventory: true,
      manageVariants: true
    };

    await wixData.update("Import307", payload, { suppressAuth: false });
  // ★追加：ProductSalesTexts 保存
    {
      const salesRes = await upsertSalesTextByCurrentSlug();
      if (!salesRes?.ok) {
        try { $w("#saveButton")?.enable(); } catch{}
        setResponse("エラーが発生しました。");
        return;
      }
    }
    // Stores 側も最新に上書き
    await createStoresProductsBatch();

    setResponse("更新しました。");
    await resetForm();
  } catch {
    setResponse("エラーが発生しました。");
    try { $w("#saveButton")?.enable(); } catch{}
    return;
  }
}

/* ============= Stores 商品作成：バッチ（URLはそのまま渡す） ============= */
function deriveBaseNameAndSlug() {
  const baseTitle = String($w("#titleBox")?.value || "").trim();
  const slugHeadL = String($w("#slugheadBox")?.value || "").trim().toLowerCase();
  const slugHeadU = slugHeadL.toUpperCase();
  const isExempt  = SLUG_EXEMPT_TITLES.has(baseTitle.toUpperCase());
  if (!baseTitle) throw new Error('title が空です');
  if (!slugHeadL) throw new Error('slughead が空です');
  const nameBase = isExempt ? baseTitle : `${slugHeadU}${baseTitle}`;
  const slugBase = `${slugHeadL}${baseTitle}`;
  return { nameBase, slugBase };
}
function isDataUrl(s){
  return /^data:image\//i.test(String(s || ""));
}

async function createStoresProductsBatch() {
  try {
    if (!Array.isArray(colorRows) || colorRows.length === 0) { setResponse("更新しました。"); return; }
    // gFilesForMain は画像テーブル未使用時に空のため、ここでは判定しない

    const pretax = calcPretaxFromPriceBox();
    const { nameBase, slugBase } = deriveBaseNameAndSlug();

    // #sizeCheck → productOptions
    const rawSelSizes  = Array.isArray($w("#sizeCheck")?.value) ? $w("#sizeCheck")?.value : [];
    const sizesForStores = (Array.isArray(rawSelSizes) ? rawSelSizes : [])
      .map(v => String(v || '').trim().replace(/cm$/i, ''))
      .filter(Boolean);

    // brand 解決
    const brand = String($w("#brandDropdown")?.value || "");

    let ok = 0, ng = 0;

  for (const row of colorRows) {
  try {
    const color = String(row?.color || "").trim();
    if (!color) { ng++; continue; }

    // ★変更：保存用mediaUrlsは「2枠が空でも row.mediaUrls を拾う」
    const urls = buildRowMediaUrlsForSave(row);
const mediaUrlsForSave = (Array.isArray(urls) && urls.length > 0)
  ? urls
  : (Array.isArray(row?.mediaUrls) ? row.mediaUrls.map(v => String(v || "").trim()).filter(Boolean) : []);
const name = `${nameBase} ${color}`;

// B方針：色名変更時は slug も追従（日本語をそのまま使う）
const colorPart = String(color || "").trim();
const slug = `${slugBase}-${colorPart}`;

const existingProductId = String(row?.productId || "").trim();



const res = await saveOrUpdateProduct({
  productId: existingProductId,
  name,
  slug,
  description: String(gDescriptionText || "").trim(),
  price: pretax,
  brand,
  manageVariants: true,      // ★追加
  trackInventory: true,      // ★追加
  sizeValues: sizesForStores,
  mediaUrls: mediaUrlsForSave
});

    if (res?.ok && res?.productId) {
      try {
        const priceInclTax = Math.round(Number(pretax) * 1.1);
        const variantProductId = String(res?.productId || existingProductId || "").trim();
        await upsertVariants({
          collection: 'Stores/Variants',
          productId: variantProductId,
          productName: name,
          slug,
          color,
          sizes: sizesForStores,
          mediaUrls: urls,
          pricePretax: pretax,
          priceInclTax,
          trackQuantity: true,
          initialQuantity: 0
        });
        ok++;
      } catch {
        ng++;
      }
    } else {
      ng++;
    }
  } catch {
    ng++;
  }
}

    // ★追加：行削除で消した既存カラー商品を Stores から削除
    if (Array.isArray(deletedColorProductIds) && deletedColorProductIds.length > 0) {
      try {
        const delRes = await deleteStoreProductsByIds(deletedColorProductIds);
        console.log("[COLOR:deleteStoreProductsByIds]", delRes);

        // 成功分はキューから除外
        if (Array.isArray(delRes?.deletedIds) && delRes.deletedIds.length > 0) {
          const deletedSet = new Set(delRes.deletedIds.map(v => String(v)));
          deletedColorProductIds = deletedColorProductIds.filter(id => !deletedSet.has(String(id)));
        }
      } catch (e) {
        console.log("[COLOR:deleteStoreProductsByIds] failed", e?.message || e);
      }
    }

    if (ok > 0 && ng === 0) setResponse("更新しました。");
    else if (ok > 0 && ng > 0) setResponse("一部更新しました。");
    else setResponse("エラーが発生しました。");
  } catch { setResponse("エラーが発生しました。"); }
}

/* ============= 入力欄初期化 ============= */
async function resetForm(){
  try {
     safeSetValue("#titleBox", "", "[RESET] titleBox");
  
     safeSetValue("#slugheadBox", "", "[RESET] slugheadBox");
    await hideElem("#slugheadBox");
    safeSetValue("#priceBox", "", "[RESET] priceBox");
    gDescriptionText = "";
    if ($w("#sizeCheck")) { try { $w("#sizeCheck").value = []; } catch {} }
    if ($w("#liveviewCheck")) { try { $w("#liveviewCheck").value = []; } catch {} }
    try { if ($w("#brandDropdown")) $w("#brandDropdown").value = BRAND_PLACEHOLDER.value; } catch{}
  
    await hideElem("#confirmOverlay");
    try { $w("#saveButton")?.enable(); } catch{}
  
    gFilesForMain = [];
    resetProductsColorRows();
    deletedColorProductIds = []; // ★追加
    mediagalleryRows = [makemediagalleryRow()];
    syncmediagalleryRowsToIframe();
    // ★追加：メイン画像保持をリセット
    // ★追加：メイン画像保持をリセット
// ★追加：メイン画像保持をリセット
gMainImageDataUrl = "";
gMainImageUrl = "";
gMainImageFileName = "";

// ★追加：HTML（#mainimageUpdate）側のプレビューもクリア
try { $w("#mainimageUpdate")?.postMessage({ type:"mainimageSetUrl", url:"" }); } catch {}

// ★追加：shopBrand リセット（#shopBrandHtml 側のチェックも外す）
gShopBrand = "";
try {
  $w("#shopBrandHtml")?.postMessage({
    type: "setCurrentShopBrand",
    currentShopBrand: ""
  });
} catch {}

gUpdateMode = false;
gUpdateTargetId = "";

// ★追加：salesTextHtml リセット
gDescriptionText = "";
gSalesCatchHtml = "";
gSalesTextsHtml = "";
try {
  $w("#salesTextHtml")?.postMessage({
    type: "clearSalesEditor"
  });
} catch {}
try {
  await hideElem("#SalesTextSection");
  if ($w("#ViewmoreButton")) $w("#ViewmoreButton").label = "View more";
} catch {}

  } catch {}
}

/* ============= UIユーティリティ ============= */
async function showElem(id){ try { const el=$w(id); if (!el) return; if (typeof el.expand==="function") await el.expand(); else if (typeof el.show==="function") await el.show(); } catch{} }
async function hideElem(id){ try { const el=$w(id); if (!el) return; if (typeof el.collapse==="function") await el.collapse(); else if (typeof el.hide==="function") await el.hide(); } catch{} }
function safeSetValue(id, value, log){ try { if ($w(id)) { $w(id).value = value; if (log) console.log(log, value); } } catch{} }
function setResponse(text){
  try {
    if (!$w("#response")) return;
    if (!SIMPLE_RESPONSES) { $w("#response").text = String(text ?? ""); return; }
    const s = String(text ?? "");
    let basic = "";
    if (/キャンセル/.test(s)) basic = "キャンセルしました。";
    else if (/保存しますか|読み込み中|存在します。編集モード|該当データが見つかりました/.test(s)) basic = s;
    else if (/失敗|検索中にエラー|読み込みに失敗|NG|error|エラー/i.test(s)) basic = "エラーが発生しました。";
    else if (/保存|作成|更新|完了|同期/.test(s)) basic = "更新しました。";
    else basic = s || "";
    $w("#response").text = basic;
  } catch {}
}
function appendResponse(msg){ try { setResponse(msg); } catch { setResponse(msg); } }

/* ============= 画像テーブル：列と行（URL列） ============= */



// ★追加：salesTextHtml 用
function getCurrentImport307Slug() {
  const baseTitle = String($w("#titleBox")?.value || "").trim();
  const slugHeadLower = String($w("#slugheadBox")?.value || "").trim().toLowerCase();
  if (!baseTitle || !slugHeadLower) return "";
  return `${slugHeadLower}${baseTitle}`;
}

function getCurrentSalesProductNo() {
  const baseTitle = String($w("#titleBox")?.value || "").trim();
  const brand = String($w("#brandDropdown")?.value || "");
  const slugHeadLower = String($w("#slugheadBox")?.value || "").trim().toLowerCase();
  const slugHeadUpper = slugHeadLower.toUpperCase();

  if (!baseTitle || !brand || !slugHeadLower) return "";

  const isLgOrSg = (brand === "LADY GENOVINA" || brand === "SUNGENOVA");
  const isExempt = isLgOrSg || SLUG_EXEMPT_TITLES.has(baseTitle.toUpperCase());

  return isExempt ? baseTitle : `${slugHeadUpper}${baseTitle}`;
}

function getCurrentSalesPreviewImageUrl() {
  return toPreviewUrl(String(gMainImageUrl || ""));
}

function getCurrentSalesBrandOptions() {
  try {
    const opts = Array.isArray($w("#brandDropdown")?.options) ? $w("#brandDropdown").options : [];
    return opts
      .filter(o => String(o?.value || "") !== "")
      .map(o => ({
        label: String(o?.label || ""),
        value: String(o?.value || "")
      }));
  } catch {
    return [];
  }
}

function getCurrentSalesBrandValue() {
  try {
    return String($w("#brandDropdown")?.value || "");
  } catch {
    return "";
  }
}

function getCurrentSalesSlughead() {
  try {
    return String($w("#slugheadBox")?.value || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

function getCurrentSalesPriceText() {
  try {
    return String($w("#priceBox")?.value || "");
  } catch {
    return "";
  }
}

function getCurrentSalesLiveviews() {
  try {
    return Array.isArray($w("#liveviewCheck")?.value) ? $w("#liveviewCheck").value : [];
  } catch {
    return [];
  }
}

function getCurrentSalesSizes() {
  try {
    return Array.isArray($w("#sizeCheck")?.value) ? $w("#sizeCheck").value : [];
  } catch {
    return [];
  }
}

function buildColorRowsForHtml() {
  try {
    return (Array.isArray(colorRows) ? colorRows : []).map(r => ({
      _id: String(r?._id || ""),
      color: String(r?.color || ""),
      img1Url: toPreviewUrl(String(r?.img1MediaUrl || r?.img1Url || "")),
      img2Url: toPreviewUrl(String(r?.img2MediaUrl || r?.img2Url || ""))
    }));
  } catch {
    return [];
  }
}

function buildMediagalleryRowsForHtml() {
  try {
    return (Array.isArray(mediagalleryRows) ? mediagalleryRows : []).map(r => ({
      _id: String(r?._id || ""),
      imgUrl: toPreviewUrl(String(r?.mediaUrl || r?.imgUrl || ""))
    }));
  } catch {
    return [];
  }
}

async function sendSalesEditorDataToHtml() {
  try {
    if (!$w("#salesTextHtml") || typeof $w("#salesTextHtml").postMessage !== "function") return;

    $w("#salesTextHtml").postMessage({
      type: "setSalesEditorData",
      productNo: getCurrentSalesProductNo(),
      title: String($w("#titleBox")?.value || "").trim(),
      brandOptions: getCurrentSalesBrandOptions(),
      brand: getCurrentSalesBrandValue(),
      slughead: getCurrentSalesSlughead(),
      priceText: getCurrentSalesPriceText(),
      liveviews: getCurrentSalesLiveviews(),
      sizes: getCurrentSalesSizes(),
      currentShopBrand: normalizeShopBrandCsv(gShopBrand || ""),
      mainImageUrl: getCurrentSalesPreviewImageUrl(),
      colorRows: buildColorRowsForHtml(),
      mediagalleryRows: buildMediagalleryRowsForHtml(),
      description: String(gDescriptionText || ""),
      salesCatch: String(gSalesCatchHtml || ""),
      salesTexts: String(gSalesTextsHtml || ""),
      viewMore: String(gViewMoreHtml || "")
    });
  } catch {}
}

async function loadSalesTextBySlugToEditor(slug) {
  try {
    const safeSlug = String(slug || "").trim();
    if (!safeSlug) {
      gSalesCatchHtml = "";
      gSalesTextsHtml = "";
      gViewMoreHtml = "";
      await sendSalesEditorDataToHtml();
      return;
    }

    const q = await wixData.query("ProductSalesTexts")
      .eq("slug", safeSlug)
      .limit(1)
      .find();

    const item = q?.items?.[0];

      gSalesCatchHtml = String(item?.salesCatch || "");
    gSalesTextsHtml = String(item?.salesTexts || "");
    gViewMoreHtml = String(item?.viewMore || "");

    await sendSalesEditorDataToHtml();
   } catch (e) {
    console.log("[SALES:load] failed", e?.message || e);
    gSalesCatchHtml = "";
    gSalesTextsHtml = "";
    gViewMoreHtml = "";
    await sendSalesEditorDataToHtml();
  }
}

async function upsertSalesTextByCurrentSlug() {
  try {
    const slug = getCurrentImport307Slug();
    const productNo = getCurrentSalesProductNo();

    if (!slug) {
      return { ok: false };
    }

    const payload = {
      slug,
      title: productNo,
      salesCatch: String(gSalesCatchHtml || ""),
      salesTexts: String(gSalesTextsHtml || ""),
      viewMore: String(gViewMoreHtml || "")
    };

    const q = await wixData.query("ProductSalesTexts")
      .eq("slug", slug)
      .limit(1)
      .find();

    if (q?.items?.length > 0) {
      await wixData.update("ProductSalesTexts", {
        _id: q.items[0]._id,
        ...payload
      }, { suppressAuth: false });
    } else {
      await wixData.insert("ProductSalesTexts", payload, { suppressAuth: false });
    }

    return { ok: true };
  } catch (e) {
    console.log("[SALES:save] failed", e?.message || e);
    return { ok: false };
  }
}

async function syncSalesSectionPreviewButton() {
  try {
    const hasText =
      !!String(gSalesCatchHtml || "").trim() ||
      !!String(gSalesTextsHtml || "").trim();

    if (!hasText) {
      await hideElem("#SalesTextSection");
      try { if ($w("#ViewmoreButton")) $w("#ViewmoreButton").label = "View more"; } catch {}
      return;
    }

    try {
      if ($w("#ViewmoreButton")) {
        const isOpen = $w("#SalesTextSection")?.collapsed === false;
        $w("#ViewmoreButton").label = isOpen ? "Close" : "View more";
      }
    } catch {}
  } catch {}
}

async function bindSalesTextSectionToggle() {
  try {
    await hideElem("#SalesTextSection");
    try { if ($w("#ViewmoreButton")) $w("#ViewmoreButton").label = "View more"; } catch {}

    if ($w("#ViewmoreButton")) {
      $w("#ViewmoreButton").onClick(async () => {
        try {
          const target = $w("#SalesTextSection");
          if (!target) return;

          const isCollapsed = target.collapsed === true;

          if (isCollapsed) {
            if (typeof target.expand === "function") {
              await target.expand();
            } else if (typeof target.show === "function") {
              await target.show();
            }
            try { $w("#ViewmoreButton").label = "Close"; } catch {}
          } else {
            if (typeof target.collapse === "function") {
              await target.collapse();
            } else if (typeof target.hide === "function") {
              await target.hide();
            }
            try { $w("#ViewmoreButton").label = "View more"; } catch {}
          }
        } catch (e) {
          console.log("[ViewmoreButton] toggle failed", e?.message || e);
        }
      });
    }
  } catch (e) {
    console.log("[ViewmoreButton] bind failed", e?.message || e);
  }
}

/* ============= 画像テーブル：列と行（URL列） ============= */
/* ============= Main Image / Products Image Dropdown 共通 ============= */
function toHalfWidth(s){
  return String(s ?? "")
    .replace(/\u3000/g, " ")
    .replace(/[！-～]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
}
function trimLen(s, n){ const t = String(s || ""); return t.length <= n ? t : t.slice(0, n); }



/* ============================================================
   カラー × 画像#×2（ページ内だけ・保存なし）
   ============================================================ */
let colorRows = [];     // { _id, color, img1Url?, img2Url?, img1MediaUrl?, img2MediaUrl?, ... }
let deletedColorProductIds = []; // ★追加：行削除で消した Stores 商品ID（保存時に削除）
let mediagalleryRows = []; // ★追加：{ _id, imgUrl, mediaUrl }
function makeColorRow(){
  return {
    _id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    color: "",
    img1Url: "",
    img2Url: "",
    img1MediaUrl: "",
    img2MediaUrl: "",
    img1No: "",
    img2No: "",
    mediaUrls: [],
    slug: "",
    mediaTouched: false
  };
}
function addColorRow() {
  colorRows.push(makeColorRow());
  syncColorRowsToIframe();
}

function removeColorRow(rowId) {
  const target = (colorRows || []).find(r => String(r?._id || "") === String(rowId || ""));
  const targetProductId = String(target?.productId || "").trim();

  if (colorRows.length <= 1) {
    // 1行だけのときは空行化（この行が既存商品なら削除対象として記録）
    if (targetProductId) {
      if (!deletedColorProductIds.includes(targetProductId)) {
        deletedColorProductIds.push(targetProductId);
      }
    }

    colorRows[0] = {
      ...colorRows[0],
      color: "",
      img1Url: "",
      img2Url: "",
      img1MediaUrl: "",
      img2MediaUrl: "",
      img1No: "",
      img2No: "",
      mediaUrls: [],
      slug: "",
      productId: "" // ★追加：紐づき解除
    };
  } else {
    // 複数行なら行ごと削除（既存商品なら削除対象として記録）
    if (targetProductId) {
      if (!deletedColorProductIds.includes(targetProductId)) {
        deletedColorProductIds.push(targetProductId);
      }
    }

    colorRows = colorRows.filter(r => r._id !== rowId);
  }

  syncColorRowsToIframe();
}

// ★追加：行ボタンの即時削除用（キューに積まない）
function removeColorRowImmediate(rowId) {
  const target = (colorRows || []).find(r => String(r?._id || "") === String(rowId || ""));
  if (colorRows.length <= 1) {
    colorRows[0] = {
      ...colorRows[0],
      color: "",
      img1Url: "",
      img2Url: "",
      img1MediaUrl: "",
      img2MediaUrl: "",
      img1No: "",
      img2No: "",
      mediaUrls: [],
      slug: "",
      productId: ""
    };
  } else {
    colorRows = colorRows.filter(r => String(r?._id || "") !== String(rowId || ""));
  }
  syncColorRowsToIframe();
}

function patchColorRow(rowId, patch, silent = false) {
  const i = colorRows.findIndex(r => r._id === rowId);
  if (i >= 0) colorRows[i] = { ...colorRows[i], ...patch };
  if (!silent) syncColorRowsToIframe();
}

function syncColorRowsToIframe(){
  try{
    const comp = $w("#colorRowsIframe");
    if (!comp || typeof comp.postMessage !== "function") return;

    const rows = (colorRows || []).map(r => ({
      id: String(r?._id || ""),
      color: String(r?.color || ""),
      img1Url: String(r?.img1Url || ""),
      img2Url: String(r?.img2Url || "")
    }));

    comp.postMessage({ type: "setRows", rows });
  }catch{}
}

function initColorRowsIframeUI(){
  if (!Array.isArray(colorRows) || colorRows.length === 0) colorRows = [makeColorRow()];
  syncColorRowsToIframe();
}
// ★追加：行単位 更新（在庫：維持/リセット）
async function applyRowUpdateNow(rowId, inventoryMode /* 'keep' | 'reset' */) {
  try {
    console.log("[ROW:update] ENTER", { rowId, inventoryMode });

    const row = (colorRows || []).find(r => String(r?._id || "") === String(rowId || ""));
    console.log("[ROW:update] row found?", {
      found: !!row,
      rowId,
      color: String(row?.color || ""),
      productId: String(row?.productId || ""),
      img1MediaUrl: String(row?.img1MediaUrl || ""),
      img2MediaUrl: String(row?.img2MediaUrl || ""),
      img1Url: String(row?.img1Url || ""),
      img2Url: String(row?.img2Url || ""),
      mediaTouched: !!row?.mediaTouched
    });
    if (!row) { setResponse("エラーが発生しました。"); return; }

    const color = String(row?.color || "").trim();
    console.log("[ROW:update] color", { color });
    if (!color) { setResponse("エラーが発生しました。"); return; }

    const pretax = calcPretaxFromPriceBox();
    const { nameBase, slugBase } = deriveBaseNameAndSlug();
    console.log("[ROW:update] base", { pretax, nameBase, slugBase });

    const rawSelSizes  = Array.isArray($w("#sizeCheck")?.value) ? $w("#sizeCheck")?.value : [];
    const sizesForStores = (Array.isArray(rawSelSizes) ? rawSelSizes : [])
      .map(v => String(v || '').trim().replace(/cm$/i, ''))
      .filter(Boolean);
    console.log("[ROW:update] sizesForStores", { sizesForStores });

    const brand = String($w("#brandDropdown")?.value || "");
    console.log("[ROW:update] brand", { brand });

const urls = buildRowMediaUrlsForSave(row);
console.log("[ROW:update] mediaUrls(for save)", {
  count: Array.isArray(urls) ? urls.length : -1,
  urls
});

// 画像を消さない保険：空なら row.mediaUrls を再確認
const mediaUrlsForSave = (Array.isArray(urls) && urls.length > 0)
  ? urls
  : (Array.isArray(row?.mediaUrls) ? row.mediaUrls.map(v => String(v || "").trim()).filter(Boolean) : []);

console.log("[ROW:update] mediaUrls(final)", {
  count: mediaUrlsForSave.length,
  mediaUrlsForSave
});

 const name = `${nameBase} ${color}`;
const existingProductId = String(row?.productId || "").trim();

// B方針：色名変更時は slug も追従（日本語をそのまま使う）
const colorPart = String(color || "").trim();
const slug = `${slugBase}-${colorPart}`;

    console.log("[ROW:update] saveOrUpdateProduct params", {
      existingProductId,
      name,
      slug,
      price: pretax,
      brand
    });

const res = await saveOrUpdateProduct({
  productId: existingProductId, // ★追加：編集時の更新先固定
  name,
  slug,
  description: String(gDescriptionText || "").trim(),
  price: pretax,
  brand,
  manageVariants: true,      // ★追加
  trackInventory: true,      // ★追加
  sizeValues: sizesForStores,
  mediaUrls: urls
});

    console.log("[ROW:update] saveOrUpdateProduct result", res);

    if (!(res?.ok && res?.productId)) {
      console.log("[ROW:update] STOP invalid result", {
        ok: !!res?.ok,
        productId: String(res?.productId || ""),
        res
      });
      setResponse("エラーが発生しました。");
      return;
    }

    patchColorRow(rowId, { productId: String(res.productId) }, true);
    console.log("[ROW:update] patched row productId", {
      rowId,
      productId: String(res.productId)
    });

    {
      const priceInclTax = Math.round(Number(pretax) * 1.1);
      const preserveQuantity = (inventoryMode === "keep");

      console.log("[ROW:update] upsertVariants START", {
        productId: res.productId,
        name,
        slug,
        color,
        sizesForStores,
        pricePretax: pretax,
        priceInclTax,
        mediaUrlsCount: Array.isArray(mediaUrlsForSave) ? mediaUrlsForSave.length : -1,
        inventoryMode,
        preserveQuantity
      });

        const variantProductId = String(res?.productId || existingProductId || row?.productId || "").trim();

      const vr = await upsertVariants({
        collection: 'Stores/Variants',
        productId: variantProductId,
        productName: name,
        slug,
        color,
        sizes: sizesForStores,
        mediaUrls: mediaUrlsForSave,
        pricePretax: pretax,
        priceInclTax,
        trackQuantity: true,
        preserveQuantity: preserveQuantity,
        initialQuantity: preserveQuantity ? undefined : 0
      });

      console.log("[ROW:update] upsertVariants result", vr);

      if (!vr?.ok) {
        throw new Error(vr?.message || "upsertVariants failed");
      }

      console.log("[ROW:update] upsertVariants END", {
        productId: res.productId,
        inventoryMode,
        preserveQuantity
      });
    }
    console.log("[ROW:update] SUCCESS", { rowId, inventoryMode, productId: String(res.productId) });
    setResponse("更新しました。");
  } catch (e) {
    console.log("[ROW:update] failed", {
      message: e?.message || e,
      stack: e?.stack || "(no-stack)",
      rowId,
      inventoryMode
    });
    setResponse("エラーが発生しました。");
  }
}

// ★追加：行単位 削除（即時でStores削除→画面から消す）
async function applyRowDeleteNow(rowId) {
  try {
    const row = (colorRows || []).find(r => String(r?._id || "") === String(rowId || ""));
    if (!row) { setResponse("エラーが発生しました。"); return; }

    const pid = String(row?.productId || "").trim();
    if (pid) {
      const delRes = await deleteStoreProductsByIds([pid]);
      console.log("[ROW:deleteStoreProductsByIds]", delRes);

      // 既存キューに残っていたら除去（後で二重削除しない）
      deletedColorProductIds = (deletedColorProductIds || []).filter(x => String(x) !== String(pid));
    }

    removeColorRowImmediate(rowId);
    setResponse("更新しました。");
  } catch (e) {
    console.log("[ROW:delete] failed", e?.message || e);
    setResponse("エラーが発生しました。");
  }
}
/** iframe → 親：受信ハンドラ（#colorRowsIframe） */
async function handleColorRowsIframeMessage(d){
  const type = String(d?.type || "");
  if (!type) return;

  if (type === "iframeReady"){
    syncColorRowsToIframe();
    return;
  }

  if (type === "addRow"){
    addColorRow();
    return;
  }

  // ★追加：行ボタン（削除）→ 親でYES/NO確認
  if (type === "requestRowDelete"){
    const rowId = String(d?.rowId || "");
    if (!rowId) return;

    pendingRowId = rowId;

    if ($w("#confirmText")) {
      $w("#confirmText").text = "この行を削除しますか？";
    }

    confirmContext = "rowDelete";
    await showElem("#confirmOverlay");
    return;
  }

  // ★追加：行ボタン（更新）→ 親でYES/NO確認→在庫（維持/リセット）
  // ★追加：行ボタン（更新）→ 親でYES/NO確認→在庫（維持/リセット）
  if (type === "requestRowUpdate"){
    const rowId = String(d?.rowId || "");
    if (!rowId) return;

    pendingRowId = rowId;

    if ($w("#confirmText")) {
      $w("#confirmText").text = "この行を更新しますか？";
    }

    confirmContext = "rowUpdateInv";
    await showElem("#confirmOverlay");
    return;
  }

  // 互換：旧deleteRowは従来どおり（キュー積み方式）
  if (type === "deleteRow"){
    const rowId = String(d?.rowId || "");
    if (!rowId) return;
    removeColorRow(rowId);
    return;
  }

  if (type === "patchRow"){
    const rowId = String(d?.rowId || "");
    const patch = d?.patch || {};
    if (!rowId) return;

    const safePatch = { ...patch };

    // ★色変更時に来る「空文字の画像項目」は無視して、既存画像を消さない
    if (Object.prototype.hasOwnProperty.call(safePatch, "img1Url") && !String(safePatch.img1Url || "").trim()) {
      delete safePatch.img1Url;
    }
    if (Object.prototype.hasOwnProperty.call(safePatch, "img2Url") && !String(safePatch.img2Url || "").trim()) {
      delete safePatch.img2Url;
    }
    if (Object.prototype.hasOwnProperty.call(safePatch, "img1MediaUrl") && !String(safePatch.img1MediaUrl || "").trim()) {
      delete safePatch.img1MediaUrl;
    }
    if (Object.prototype.hasOwnProperty.call(safePatch, "img2MediaUrl") && !String(safePatch.img2MediaUrl || "").trim()) {
      delete safePatch.img2MediaUrl;
    }

    // ★追加：HTMLが表示URL(img1Url/img2Url)しか送らない場合の補完
    // 保存処理は img1MediaUrl/img2MediaUrl を使うため、未設定なら表示URLを流用する
    if (!String(safePatch.img1MediaUrl || "").trim() && String(safePatch.img1Url || "").trim()) {
      safePatch.img1MediaUrl = String(safePatch.img1Url).trim();
    }
    if (!String(safePatch.img2MediaUrl || "").trim() && String(safePatch.img2Url || "").trim()) {
      safePatch.img2MediaUrl = String(safePatch.img2Url).trim();
    }

    // ★patchRowで画像値が入ってきた場合は「画像を触った」扱いにする
    const hasImg1 = typeof safePatch.img1Url === "string" && safePatch.img1Url.trim();
    const hasImg2 = typeof safePatch.img2Url === "string" && safePatch.img2Url.trim();
    const hasM1 = typeof safePatch.img1MediaUrl === "string" && safePatch.img1MediaUrl.trim();
    const hasM2 = typeof safePatch.img2MediaUrl === "string" && safePatch.img2MediaUrl.trim();

    if (hasImg1 || hasImg2 || hasM1 || hasM2) {
      safePatch.mediaTouched = true;
    } else {
      delete safePatch.mediaTouched;
    }

    patchColorRow(rowId, safePatch, true); // ★親→iframeの即時syncを止める（カーソル飛び対策）
    return;
  }

if (type === "rowImageDropped"){
  const rowId   = String(d?.rowId || "");
  const slot    = Number(d?.slot || 0);
  const bytes   = d?.bytes;         // ★数値配列
  const mimeIn  = String(d?.mimeType || "");
  const fileName = String(d?.fileName || "");

  if (!rowId || (slot !== 1 && slot !== 2)) return;
  if (!Array.isArray(bytes) || bytes.length === 0) {
    console.log("[COLOR:upload] bytes invalid", { rowId, slot, fileName, mimeIn, bytesType: typeof bytes });
    setResponse("エラーが発生しました。");
    return;
  }

  const mime = (mimeIn && mimeIn.trim()) ? mimeIn.trim() : "image/jpeg";

  console.log("[COLOR:upload] recv", {
    rowId,
    slot,
    fileName,
    mimeIn,
    mime,
    bytesLen: bytes.length,
    b0: bytes[0],
    b1: bytes[1],
    b2: bytes[2],
    b3: bytes[3]
  });

  try {
    const out = await saveImageBytesToMediaBoth(bytes, mime);

    console.log("[COLOR:upload] out", {
      rowId,
      slot,
      fileName,
      mime,
      outType: typeof out,
      outKeys: out ? Object.keys(out) : [],
      out
    });

    const fileUrl = String(out?.fileUrl || "").trim();
    const viewUrl = String(out?.displayUrl || fileUrl).trim();

    if (!fileUrl) {
      console.log("[COLOR:upload] no fileUrl", { rowId, slot, fileName, mime, bytesLen: bytes.length, out });
      setResponse("エラーが発生しました。");
      return;
    }

    if (slot === 1) patchColorRow(rowId, { img1Url: viewUrl, img1MediaUrl: fileUrl, mediaTouched: true });
    if (slot === 2) patchColorRow(rowId, { img2Url: viewUrl, img2MediaUrl: fileUrl, mediaTouched: true });

    try {
      const savedRow = (colorRows || []).find(r => String(r?._id || "") === rowId);
      console.log("[COLOR:savedRow]", {
        rowId,
        slot,
        found: !!savedRow,
        mediaTouched: !!savedRow?.mediaTouched,
        img1MediaUrl: String(savedRow?.img1MediaUrl || ""),
        img2MediaUrl: String(savedRow?.img2MediaUrl || "")
      });
    } catch {}

    console.log("[COLOR:upload] ok", { rowId, slot, fileName, fileUrl, viewUrl });
  } catch (e) {
    console.log("[COLOR:upload] failed", {
      rowId,
      slot,
      fileName,
      mime,
      message: String(e?.message || e),
      stack: String(e?.stack || "(no-stack)")
    });
    setResponse("エラーが発生しました。");
  }
  return;
}
}

function resetProductsColorRows() {
  colorRows = [makeColorRow()];
  syncColorRowsToIframe();
}

// ★追加：mediagalleryRowDrop 用
function makemediagalleryRow() {
  return {
    _id: `${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    imgUrl: "",
    mediaUrl: ""
  };
}

function initmediagalleryRowDropUI() {
  if (!Array.isArray(mediagalleryRows) || mediagalleryRows.length === 0) {
    mediagalleryRows = [makemediagalleryRow()];
  }
  syncmediagalleryRowsToIframe();
}

function syncmediagalleryRowsToIframe() {
  try {
    const comp = $w("#mediagalleryRowDrop");
    if (!comp || typeof comp.postMessage !== "function") return;

    const rows = (mediagalleryRows || []).map(r => ({
      id: String(r?._id || ""),
      imgUrl: String(r?.imgUrl || "")
    }));

    comp.postMessage({ type: "setRows", rows });
  } catch {}
}

function addmediagalleryRow() {
  mediagalleryRows.push(makemediagalleryRow());
  syncmediagalleryRowsToIframe();
}

function patchmediagalleryRow(rowId, patch, silent = false) {
  const i = mediagalleryRows.findIndex(r => String(r?._id || "") === String(rowId || ""));
  if (i >= 0) mediagalleryRows[i] = { ...mediagalleryRows[i], ...patch };
  if (!silent) syncmediagalleryRowsToIframe();
}

function removemediagalleryRowImmediate(rowId) {
  if (mediagalleryRows.length <= 1) {
    mediagalleryRows[0] = {
      ...mediagalleryRows[0],
      imgUrl: "",
      mediaUrl: ""
    };
  } else {
    mediagalleryRows = mediagalleryRows.filter(r => String(r?._id || "") !== String(rowId || ""));
  }
  syncmediagalleryRowsToIframe();
}

function buildmediagalleryItemsForSave() {
  return (mediagalleryRows || [])
    .map(r => String(r?.mediaUrl || "").trim())
    .filter(Boolean)
    .map(url => ({
      type: "image",
      src: url,
      title: "",
      alt: ""
    }));
}

async function applymediagalleryRowDeleteNow(rowId) {
  try {
    removemediagalleryRowImmediate(rowId);
    setResponse("更新しました。");
  } catch (e) {
    console.log("[MEDIA-GALLERY:delete] failed", e?.message || e);
    setResponse("エラーが発生しました。");
  }
}

async function handlemediagalleryRowDropMessage(d) {
  const type = String(d?.type || "");
  if (!type) return;

  if (type === "iframeReady") {
    syncmediagalleryRowsToIframe();
    return;
  }

  if (type === "addRow") {
    addmediagalleryRow();
    return;
  }

  if (type === "requestRowDelete") {
    const rowId = String(d?.rowId || "");
    if (!rowId) return;

    pendingRowId = rowId;

    if ($w("#confirmText")) {
      $w("#confirmText").text = "この行を削除しますか？";
    }

    confirmContext = "mediagalleryRowDelete";
    await showElem("#confirmOverlay");
    return;
  }

  if (type === "requestRowUpdate") {
    setResponse("更新しました。");
    return;
  }

  if (type === "rowImageCleared") {
    const rowId = String(d?.rowId || "");
    if (!rowId) return;

    patchmediagalleryRow(rowId, {
      imgUrl: "",
      mediaUrl: ""
    });
    return;
  }

  if (type === "rowImageDropped") {
    const rowId = String(d?.rowId || "");
    const bytes = d?.bytes;
    const mimeIn = String(d?.mimeType || "");
    const fileName = String(d?.fileName || "");

    if (!rowId) return;
    if (!Array.isArray(bytes) || bytes.length === 0) {
      console.log("[MEDIA-GALLERY:upload] bytes invalid", { rowId, fileName, mimeIn });
      setResponse("エラーが発生しました。");
      return;
    }

    const mime = (mimeIn && mimeIn.trim()) ? mimeIn.trim() : "image/jpeg";

    try {
      const out = await saveImageBytesToMediaBoth(bytes, mime);
      const fileUrl = String(out?.fileUrl || "").trim();
      const viewUrl = String(out?.displayUrl || fileUrl).trim();

      if (!fileUrl) {
        console.log("[MEDIA-GALLERY:upload] no fileUrl", { rowId, fileName, mime, out });
        setResponse("エラーが発生しました。");
        return;
      }

      patchmediagalleryRow(rowId, {
        imgUrl: viewUrl,
        mediaUrl: fileUrl
      });

      console.log("[MEDIA-GALLERY:upload] ok", { rowId, fileName, fileUrl, viewUrl });
    } catch (e) {
      console.log("[MEDIA-GALLERY:upload] failed", {
        rowId,
        fileName,
        mime,
        message: String(e?.message || e),
        stack: String(e?.stack || "(no-stack)")
      });
      setResponse("エラーが発生しました。");
    }
    return;
  }
}


/* === 現用URLをオプションにマージ === */
function mergeOptionsWithCurrentUrls(baseOptions, currentUrls) {
  const base = Array.isArray(baseOptions) ? baseOptions.slice() : [];
  const existValues = new Set(base.map(o => String(o.value || "")));
  const extras = (currentUrls || [])
    .map(u => String(u || "").trim())
    .filter(u => u && !existValues.has(u))
    .map(u => ({ label: `[現用] ${fileNameFromUrl(u) || u}`, value: u }));
  return base.concat(extras);
}

/* === 初期値決定：URL完全一致のみ採用（変換しない） === */
/* 第2引数以降（rowsTbl など）が渡されても無視できるようにする */
function initialValueFromCandidates(candidates, ..._ignored) {
  const cands = (candidates || []).map(s => String(s || "").trim()).filter(Boolean);
  for (const c of cands) {
    if (/^https?:\/\//i.test(c)) return c; // URLそのまま
  }
  return "";
}



/* ============= サイズ配列 -> 範囲＋ギャップ検知 ============= */
function buildSizeRange(selectedValues){
  if (!Array.isArray(selectedValues) || selectedValues.length === 0) {
    return { text:"", hasGap:false, missingBetween:[], minLabel:"", maxLabel:"" };
  }
  const idxs = selectedValues.map(v => SIZE_ORDER.indexOf(String(v))).filter(i => i >= 0).sort((a,b)=>a-b);
  if (idxs.length === 0) return { text:"", hasGap:false, missingBetween:[], minLabel:"", maxLabel:"" };
  const minIdx = idxs[0], maxIdx = idxs[idxs.length - 1];
  const selectedSet = new Set(idxs);
  const missingBetweenIdx = [];
  for (let i=minIdx; i<=maxIdx; i++){ if (!selectedSet.has(i)) missingBetweenIdx.push(i); }
  const hasGap = missingBetweenIdx.length > 0;

  const label = v => (/^\d+\.\d$/.test(v) ? `${v}cm` : v);
  const minVal = SIZE_ORDER[minIdx], maxVal = SIZE_ORDER[maxIdx];
  const text = `${label(minVal)}～${label(maxVal)}`;

  const missingBetween = missingBetweenIdx.map(i => label(SIZE_ORDER[i]));
  return { text, hasGap, missingBetween, minLabel: label(minVal), maxLabel: label(maxVal) };
}

/* ============= 便利関数：番号→URL（Main用） ============= */
function urlFromNo(noStr){
  if (!noStr) return '';
  const idx = parseInt(String(noStr), 10) - 1;
  if (!Number.isInteger(idx) || idx < 0 || idx >= gFilesForMain.length) return '';
  return gFilesForMain[idx]?.url || '';
}

/* ============= 既存データ一括ダンプ（確認ログ） ============= */
async function dumpExistingDataOnce(item) {
  try {
    const title = String(item?.title || "");
    const brand = String(item?.brand || "");
    const price = Number(item?.price ?? 0);
    const formatted = item?.formattedPrice || "";
    const sizeText = String(item?.size || "");
    const mainMedia = String(item?.mainMedia || "");
    console.log("[EXISTING-DUMP:base]", { title, brand, price, formatted, sizeText, mainMedia });

    let baseTitle = title;
    let slugHeadUpper = "";

    const isLgOrSgBrand = (brand === "LADY GENOVINA" || brand === "SUNGENOVA");
    const isNumericTitle = /^\d+$/.test(String(title || "").trim());

    if (isLgOrSgBrand && isNumericTitle) {
      const px = await getBrandPrefixLower(brand);
      slugHeadUpper = String(px || "").toUpperCase();
      baseTitle = String(title || "").trim();
    } else if (!SLUG_EXEMPT_TITLES.has(title.toUpperCase()) && title.length >= 2) {
      baseTitle = title.slice(2);
      slugHeadUpper = title.slice(0,2).toUpperCase();
    }

    const slugHeadLower = slugHeadUpper.toLowerCase();
    let files = [];
    try { files = await listFilesByPath(slugHeadLower, baseTitle); } catch {}
    const table = (files || []).map((f,i)=>(
      {
        no: String(i+1).padStart(3,"0"),
        filename: f?.name || "",
        url: f?.url || ""
      }
    ));
    console.log("[EXISTING-DUMP:files]", table);

    try {
      const nameBase = slugHeadUpper ? `${slugHeadUpper}${baseTitle}` : baseTitle;
      const res = await listProductsWithMediaByNameBase(nameBase);
      if (res?.ok) {
        const rows = res.items.map(p => ({
          name: p.name,
          slug: p.slug,
          mediaUrls: p.mediaUrls || []
        }));
        console.log("[EXISTING-DUMP:products]", rows);
      } else {
        console.log("[EXISTING-DUMP:products] v2 not ready", res?.error);
      }
    } catch (e) {
      console.log("[EXISTING-DUMP:products] error", e?.message || e);
    }
  } catch (e) {
    console.log("[EXISTING-DUMP] error:", e?.message || e);
  }
}

// slug から Stores/Products を引いて mediaItems → URL 配列を返す
async function getMediaUrlsBySlug(slug) {
  try {
    const q = await wixData.query('Stores/Products').eq('slug', String(slug || '')).limit(1).find();
    if (q?.items?.length) {
      const item  = q.items[0];
      const media = Array.isArray(item?.mediaItems) ? item.mediaItems : [];
      return media
        .map(m => m?.url || m?.src || m?.image?.url || '')
        .filter(Boolean);
    }
  } catch (e) {
    console.log('[getMediaUrlsBySlug] error:', e?.message || e);
  }
  return [];
}

/* 追加：wix:image:// → static URL 化ヘルパ（説明用途。保存時は使わない） */

// 任意URL/スキーマから mediaId を抽出（説明用途）
function mediaIdFromAny(u){
  const s = String(u || '');
  if (!s) return '';
  if (/^wix:image:\/\//i.test(s)) {
    const noQF = s.split('?')[0].split('#')[0];
    const parts = noQF.split('/');
    return parts[3] || '';
  }
  const m = s.match(/\/media\/([^/?#]+)/i);
  return m ? m[1] : '';
}
// ★追加：プレビュー表示用 URL に変換（wix:image:// → https://static.wixstatic.com/media/<id>）
function toPreviewUrl(u){
  const s = String(u || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  const id = mediaIdFromAny(s);
  return id ? `https://static.wixstatic.com/media/${id}` : '';
}

/* ============= Stores/Products: slug → _id 解決（存在しなければ ""） ============= */
async function getProductIdBySlugSafe(slug) {
  try {
    const q = await wixData.query('Stores/Products').eq('slug', String(slug || '')).limit(1).find();
    const it = (q?.items && q.items[0]) ? q.items[0] : null;
    return it && typeof it._id === 'string' ? it._id : '';
  } catch (e) {
    console.log('[getProductIdBySlugSafe] error:', e?.message || e);
    return '';
  }
}

// ================== 追加：Pinterestフィード生成UI連携 ==================
if ($w("#pinterestFeedHtml")?.onMessage) {
  $w("#pinterestFeedHtml").onMessage(async (event) => {
    const d = event?.data;
    if (!d) return;

    if (d.type === "pinterestFeedIframeReady") {
      try {
        $w("#pinterestFeedHtml").postMessage({
          type: "pinterestFeedSetResponse",
          message: "待機中"
        });
        $w("#pinterestFeedHtml").postMessage({
          type: "pinterestFeedSetBusy",
          busy: false
        });
      } catch {}
      return;
    }

    if (d.type === "pinterestFeedGenerateClick") {
      try {
        $w("#pinterestFeedHtml").postMessage({
          type: "pinterestFeedSetBusy",
          busy: true
        });
        $w("#pinterestFeedHtml").postMessage({
          type: "pinterestFeedSetResponse",
          message: "生成中…"
        });

        // ここでバックエンド関数を呼ぶ
        // const result = await generatePinterestFeed();

           const mode = String(d?.mode || "").trim().toLowerCase();

        const result = mode === "variant"
          ? await generatePinterestFeedVariant()
          : await generatePinterestFeedParent();

          if (result?.ok) {
          const message =
            (mode === "variant" ? "子" : "親") + "生成しました。\n" +
            "件数: " + String(result.count || 0) + "\n" +
            "URL: " + String(result.url || "") + "\n" +
            "更新: " + String(result.updatedAt || "");
          try {
            $w("#pinterestFeedHtml").postMessage({
              type: "pinterestFeedSetResponse",
              message
            });
          } catch {}

          setResponse("更新しました。");
        } else {
          try {
            $w("#pinterestFeedHtml").postMessage({
              type: "pinterestFeedSetResponse",
              message: "エラーが発生しました。"
            });
          } catch {}

          setResponse("エラーが発生しました。");
        }
      } catch (e) {
        try {
          $w("#pinterestFeedHtml").postMessage({
            type: "pinterestFeedSetResponse",
            message: "エラーが発生しました。"
          });
        } catch {}

        console.log("[PinterestFeed] failed", e?.message || e);
        setResponse("エラーが発生しました。");
      } finally {
        try {
          $w("#pinterestFeedHtml").postMessage({
            type: "pinterestFeedSetBusy",
            busy: false
          });
        } catch {}
      }
      return;
    }
  });
}