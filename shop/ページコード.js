

import wixData from "wix-data";
import wixWindow from "wix-window";
import { cart } from "wix-stores-frontend";
import { session } from "wix-storage";
import wixLocation from "wix-location";
import { createSquarePaymentLink } from 'backend/squareCheckout.jsw';
import { getInitialPageData } from 'backend/products.jsw';
import { getHelmettyBrandBoxHtml } from 'backend/shop_back/menuService.jsw';
import { initCartHtmlBridge } from "public/cartHtmlBridge";
import { setMetaTags, setTitle } from "wix-seo-frontend";

import {
  DEBUG,
  variantNames,
  BRAND_CONFIG,
  CheckoutSectionId,
  MobileCloseButtonId,
  cartHideTargets as __cartHideTargets,
  formatYen,
  toHtmlImageSrc,
  toStaticMediaUrl,
  stripHtmlTags,
  normalizeRichTextHtml,
  toProductInfoList,
  toPointTextList,
  firstNonEmptyValue,
  buildProductSpecList,
  getImport307GalleryImages,
  getSizeFromLineItem,
  getColorFromName,
  getLineItemUnitPrice,
  getLineItemImageUrl,
  getCartTotalCount,
  parseStock,
  buildSquareCartItems,
  extractSelectedKeyFromSlug,
  buildItemSlug,
  buildTargetTitle,
  filterG1CategoriesForShop,
  buildCategoryCountMap,
  buildCategoryHtmlItems,
  filterProductsByCategoryKey,
  buildGalleryItemFromStoreProduct,
  buildGalleryStateFromProducts
} from "public/shop/gallery/G1G2.js";

const cartHideTargets = __cartHideTargets.filter((id) => id !== "#mobileBlankSection");

let __cartSnapshot = null;
let __cartFetchPromise = null;
let __cartSnapshotAt = 0;

async function getCartSnapshot(maxAgeMs = 300) {
  const now = Date.now();

  if (__cartSnapshot && (now - __cartSnapshotAt) <= maxAgeMs) {
    return __cartSnapshot;
  }

  if (__cartFetchPromise) {
    return __cartFetchPromise;
  }

  __cartFetchPromise = (async () => {
    const c = await cart.getCurrentCart();
    __cartSnapshot = c;
    __cartSnapshotAt = Date.now();
    return c;
  })();

  try {
    return await __cartFetchPromise;
  } finally {
    __cartFetchPromise = null;
  }
}

let isMobile;
let productNameID; // グローバル変数として定義
let description;   // グローバル変数として定義
let menuOpen = false; // メニュー開閉状態
let mobileMenuBeforeState = null;
let mobileViewAlt = false; // モバイル用：false=1枚目, true=2枚目

// ギャラリー配列（hover最適化：通常/hoverを事前生成して使い回し）
let galleryItems = [];
let galleryNormalItems = [];
let galleryHoverItems = [];

// クエリ結果の共有キャッシュ
const cache = {
  productByName: new Map(),        // name -> product
  variantsByProductId: new Map(),  // productId -> variants[]
};

const productMainMediaById = new Map(); // productId -> mainMedia

let currentBrandText = "";
let currentBrandLogoUrl = "";
let currentProductNoText = "";
let currentColorHtml = "";
let currentSalesCatchHtml = "";
let currentSalesTextsHtml = "";
let currentSelectedSize = "";
let currentPurchaseResponse = "";

let __openItemRequestId = 0;

function beginOpenItemRequest(label = "") {
  __openItemRequestId += 1;
  const requestId = __openItemRequestId;
  console.log("[OPENITEM][begin]", { requestId, label });
  return requestId;
}

function invalidateOpenItemRequests(label = "") {
  __openItemRequestId += 1;
  console.log("[OPENITEM][invalidate]", { latest: __openItemRequestId, label });
}

function isOpenItemRequestAlive(requestId) {
  return requestId === __openItemRequestId;
}

let __productSwitchRequestId = 0;
let __stockUpdateTimer = null;

function beginProductSwitchRequest(productName) {
  __productSwitchRequestId += 1;
  const requestId = __productSwitchRequestId;

  console.log("[PRODUCT-SWITCH][begin]", {
    requestId,
    productName
  });

  return requestId;
}

function isCurrentProductRequest(requestId, productName) {
  return (
    requestId === __productSwitchRequestId &&
    String(productName || "").trim() === String(productNameID || "").trim()
  );
}

function skipStaleProductRequest(requestId, productName, label) {
  if (isCurrentProductRequest(requestId, productName)) return false;

  console.log("[PRODUCT-SWITCH][stale-skip]", {
    requestId,
    latestRequestId: __productSwitchRequestId,
    productName,
    currentProductNameID: productNameID,
    label
  });

  return true;
}

function scheduleStockUpdateForCurrentProduct(requestId, targetProductNameID) {
  if (__stockUpdateTimer) {
    clearTimeout(__stockUpdateTimer);
  }

  __stockUpdateTimer = setTimeout(async () => {
    if (skipStaleProductRequest(requestId, targetProductNameID, "before stock update")) return;

    try {
      const cartData = await getCartSnapshot();

      if (skipStaleProductRequest(requestId, targetProductNameID, "after getCartSnapshot")) return;

      const res = await fetchAndLogVariants(targetProductNameID, cartData);

      if (skipStaleProductRequest(requestId, targetProductNameID, "after fetchAndLogVariants")) return;
      if (!res) return;

      await updateDropdownAndStockDisplay(
        targetProductNameID,
        res.tempStock,
        res.productId,
        res.variants,
        cartData
      );
    } catch (error) {
      if (!skipStaleProductRequest(requestId, targetProductNameID, "stock update error")) {
        console.error('バリアント情報の取得中にエラーが発生しました:', error);
      }
    }
  }, 120);
}

let currentG1G2BrandKey = "";
let currentG1G2ShopKey = "";
let currentG1G2AllValue = "false";
let currentG1G2HideBrandSelect = false;
let currentG1G2BrandSelectBrands = [];
let currentPcBrandBoxHtml = "";

const PREVIEW_SHOP_FALLBACK = {
  brand: "HELMETTY",
  shop: "HELMETTY",
  all: "false"
};


// ======================================================
// G1/G2 強制 HELMETTY モード
// いったん G1G2 を HELMETTY 固定にする
// ======================================================
const FORCE_G1G2_HELMETTY_MODE = false;
const FORCE_G1G2_BRAND_KEY = "HELMETTY";
const FORCE_G1G2_SHOP_KEY = "HELMETTY";
const FORCE_G1G2_ALL_VALUE = "false";
let currentG1G2CategoryPrefix = "";

function isForceHelmettyMode() {
  return FORCE_G1G2_HELMETTY_MODE === true;
}

function filterForceHelmettyRows(items = []) {
  const source = Array.isArray(items) ? items : [];

  if (!isForceHelmettyMode()) {
    return source;
  }

  const prefix = String(currentG1G2CategoryPrefix || "").trim().toLowerCase();
  if (!prefix) {
    return source;
  }

  return source.filter((item) => {
    const raw = String(
      item?.slug ||
      item?.categoryKey ||
      item?.key ||
      item?.title ||
      item?.html ||
      ""
    ).trim().toLowerCase();

    return raw.startsWith(prefix) || raw.includes(`/${prefix}`);
  });
}

function getQueryValueWithPreviewFallback(key, fallbackValue = "") {
  const value = String(wixLocation.query[key] || "").trim();
  if (value) return value;

  if (wixWindow.viewMode === "Preview") {
    return String(fallbackValue || "").trim();
  }

  return "";
}

function normalizeCategoryKeyByPrefix(rawCategoryKey, prefixValue) {
  const key = String(rawCategoryKey ?? "").toLowerCase().trim();
  if (!key) return "";

  const prefix = String(prefixValue || "").toLowerCase().trim();
  if (!prefix) return key;

  if (key.startsWith(prefix)) return key;

  return (prefix + key).toLowerCase();
}

function getActiveCartUiHtml() {
  return isMobile ? $w("#MobileCombinedHtml") : $w("#CartUiHtml");
}

function postMobileMainGalleryMessage(message) {
  if (!isMobile) return;

  const html = $w("#mobilemainGalleryHtml");
  if (!html || typeof html.postMessage !== "function") {
    console.warn("[G1G2][mobilemainGalleryHtml] not found or postMessage unsupported");
    return;
  }

  html.postMessage(message);
}

function setPurchaseResponse(text) {
  currentPurchaseResponse = String(text || "");
}

function pushPurchaseUi(options = null, value = null, response = null, canAdd = null, cartData = null) {
  const html = getActiveCartUiHtml();
  if (!html || typeof html.postMessage !== "function") return;

  const dropdownOptions = Array.isArray(options)
    ? options
    : [];

  const selectedValue = (value !== null && value !== undefined)
    ? String(value)
    : String(currentSelectedSize || "");

  const responseText = (response !== null && response !== undefined)
    ? String(response)
    : String(currentPurchaseResponse || "");

  const addEnabled = (typeof canAdd === "boolean")
    ? canAdd
    : (dropdownOptions.length > 1);

  const totalCount = getCartTotalCount(cartData);

  html.postMessage({
    type: "setPurchaseUi",
    options: dropdownOptions,
    value: selectedValue,
    response: responseText,
    cartCount: totalCount,
    canAdd: addEnabled
  });
}

function setupCartUiHtml() {
  const html = getActiveCartUiHtml();
  if (!html || typeof html.onMessage !== "function") return;

  html.onMessage(async (event) => {
    const data = event?.data;
    if (!data || typeof data !== "object") return;

    if (data.type === "purchaseSizeChanged") {
      currentSelectedSize = String(data.value || "");
      return;
    }

    if (data.type === "purchaseAddCart") {
      await addProductToCart();
      return;
    }

    if (data.type === "purchaseOpenCart") {
      await openSharedCartSection();
      return;
    }
if (data.type === "purchaseBuyNow") {
  await openSharedCartSection();
  return;
}
  });
}

let __mobileCombinedHeightTimer = null;
let __mobileCombinedLastHeight = 0;
let __mobileScreenMode = "g1g2";

function setupMobileCombinedHtmlMetrics() {
  if (!isMobile) return;

  const html = $w("#MobileCombinedHtml");
  if (!html || typeof html.onMessage !== "function") return;

  html.onMessage((event) => {
    const data = event?.data;
    if (!data || typeof data !== "object") return;
    if (data.type !== "mobileCombinedViewportMetrics") return;

    const payload = data.payload || {};
    const contentHeight = Number(payload.contentHeight || 0);

    if (!contentHeight) return;

    const targetHeight = Math.round(
      Math.max(
        420,
        Math.min(12000, contentHeight)
      )
    );

    if (Math.abs(targetHeight - __mobileCombinedLastHeight) < 8) {
      return;
    }

    __mobileCombinedLastHeight = targetHeight;

    if (__mobileCombinedHeightTimer) {
      clearTimeout(__mobileCombinedHeightTimer);
    }

    __mobileCombinedHeightTimer = setTimeout(() => {
      try {
        if (__mobileScreenMode !== "combined") return;

        html.height = targetHeight;

        console.log("[MobileCombinedHtml][height applied]", {
          targetHeight,
          contentHeight,
          payload
        });
      } catch (e) {
        console.error("[MobileCombinedHtml][height apply failed]", e);
      }
    }, 80);

  });
}



let __mobileMainGalleryHeightTimer = null;
let __mobileMainGalleryLastHeight = 0;

function setupMobileMainGalleryHtmlMetrics() {
  if (!isMobile) return;

  const html = $w("#mobilemainGalleryHtml");
  if (!html || typeof html.onMessage !== "function") return;

  html.onMessage((event) => {
    const data = event?.data;
    if (!data || typeof data !== "object") return;
    if (data.type !== "mobileMainGalleryMetrics") return;

    const payload = data.payload || {};
    const contentHeight = Number(payload.contentHeight || 0);

    if (!contentHeight) return;

    const targetHeight = Math.round(
      Math.max(
        80,
        Math.min(12000, contentHeight)
      )
    );

    if (Math.abs(targetHeight - __mobileMainGalleryLastHeight) < 8) {
      return;
    }

    __mobileMainGalleryLastHeight = targetHeight;

    if (__mobileMainGalleryHeightTimer) {
      clearTimeout(__mobileMainGalleryHeightTimer);
    }

    __mobileMainGalleryHeightTimer = setTimeout(() => {
      try {
        html.height = targetHeight;

        console.log("[mobilemainGalleryHtml][height applied]", {
          targetHeight,
          contentHeight,
          payload
        });

        setTimeout(async () => {
          if (!isMobile) return;
          if (__mobileScreenMode !== "g1g2") return;
          if (menuOpen) return;

          const section = $w("#G1G2GallerySection");
          if (!section || typeof section.scrollTo !== "function") return;

          if (typeof section.collapsed === "boolean" && section.collapsed) return;

          await section.scrollTo();
        }, 120);
      } catch (e) {
        console.error("[mobilemainGalleryHtml][height apply failed]", e);
      }
    }, 80);
  });
}


function pushCatalogInfo() {
  if ($w("#catalogInfoHtml") && typeof $w("#catalogInfoHtml").postMessage === "function") {
    $w("#catalogInfoHtml").postMessage({
      type: "catalogInfo",
      payload: {
        brandText: currentBrandText,
        productNoText: currentProductNoText,
        colorHtml: currentColorHtml,
        salesCatchHtml: currentSalesCatchHtml,
        salesTextsHtml: currentSalesTextsHtml
      }
    });
  }
}

function postCatalogTitleFromItem(item) {
  console.log("PC送信item.brand", item?.brand);
console.log("PC送信item.brandText", item?.brandText);
console.log("PC送信currentBrandText", currentBrandText);
  if (isMobile) return;
  if (!$w("#CatalogTitleHtml") || typeof $w("#CatalogTitleHtml").postMessage !== "function") return;
  if (!item) return;

  const fallbackItem = galleryNormalItems.find(g =>
    (item.productId && g.productId === item.productId) ||
    (item.title && g.title === item.title)
  );

  const title = String(item.titleText || item.title || fallbackItem?.title || "");
  const price = String(
    item.priceText ||
    item.priceTaxIn ||
    fallbackItem?.priceTaxIn ||
    fallbackItem?.formattedPrice ||
    fallbackItem?.price ||
    ""
  );

  $w("#CatalogTitleHtml").postMessage({
    type: "catalogInfo",
    payload: {
      brandText: currentBrandText || item.brandText || "",
      titleText: title,
      priceText: price
    }
  });
}

function postMobileCatalogTitleFromItem(item) {
  if (!isMobile) return;
  if (!$w("#MobileCombinedHtml") || typeof $w("#MobileCombinedHtml").postMessage !== "function") return;
  if (!item) return;

  const fallbackItem = galleryNormalItems.find(g =>
    (item.productId && g.productId === item.productId) ||
    (item.title && g.title === item.title)
  );

  const title = String(item.titleText || item.title || fallbackItem?.title || "");
  const price = String(
    item.priceText ||
    item.priceTaxIn ||
    fallbackItem?.priceTaxIn ||
    ""
  );

  const message = {
    type: "catalogInfo",
payload: {
  brandText: currentBrandText || item.brandText || "",
  titleText: title,
  priceText: price,
  colorHtml: item.colorHtml || currentColorHtml || ""
}
  };

  console.log("[SEND][MobileCombinedHtml][catalogInfo] raw item =", item);
  console.log("[SEND][MobileCombinedHtml][catalogInfo] fallbackItem =", fallbackItem);
  console.log("[SEND][MobileCombinedHtml][catalogInfo] title =", title);
  console.log("[SEND][MobileCombinedHtml][catalogInfo] price =", price);
  console.log("[SEND][MobileCombinedHtml][catalogInfo] colorHtml =", item.colorHtml || currentColorHtml || "");
  console.log("[SEND][MobileCombinedHtml][catalogInfo] message =", message);

  $w("#MobileCombinedHtml").postMessage(message);
}

async function postHelmettyBrandBoxHtmlToMainGallery(brand, brandPrefix) {
  if (isMobile) return;

  const html = $w("#mainGalleryHtml");
  if (!html || typeof html.postMessage !== "function") return;

  try {
    const brandBoxHtml = await getHelmettyBrandBoxHtml({
      brand: String(brand || "").trim(),
      brandPrefix: String(brandPrefix || "").trim()
    });

    html.postMessage({
      type: "brandBoxHtml",
      html: brandBoxHtml
    });
  } catch (e) {
    console.error("[mainGalleryHtml][brandBoxHtml] send failed:", e);
  }
}

function pushMainImages(items = []) {
  if (isMobile) return;

  const html = $w("#mainGalleryHtml");
  if (!html || typeof html.postMessage !== "function") {
    console.warn("[G1G2][mainGalleryHtml] not found or postMessage unsupported");
    return;
  }

  html.postMessage({
    channel: "mainGallery",
    type: "setGalleryItems",
    items: Array.isArray(items) ? items : [],
    brand: currentG1G2BrandKey,
    brandKey: currentG1G2BrandKey,
    selectedBrand: currentG1G2BrandKey,
    shop: currentG1G2ShopKey,
    all: currentG1G2AllValue,
    hideBrandSelect: currentG1G2HideBrandSelect,
    showBrandSelect: !currentG1G2HideBrandSelect,
    brands: currentG1G2BrandSelectBrands,
    brandOptions: Object.keys(BRAND_CONFIG).map((key) => ({
      value: key,
      label: BRAND_CONFIG[key]?.mbBrandText || key
    }))
  });

  html.postMessage({
    channel: "mainGallery",
    type: "setOtherProductsButtonDisabled",
    disabled: true,
    brand: currentG1G2BrandKey,
    brandKey: currentG1G2BrandKey,
    selectedBrand: currentG1G2BrandKey,
    shop: currentG1G2ShopKey,
    all: currentG1G2AllValue,
    hideBrandSelect: currentG1G2HideBrandSelect,
    showBrandSelect: !currentG1G2HideBrandSelect,
    brands: currentG1G2BrandSelectBrands,
    brandOptions: Object.keys(BRAND_CONFIG).map((key) => ({
      value: key,
      label: BRAND_CONFIG[key]?.mbBrandText || key
    }))
  });

  console.log("[G1G2][mainGalleryHtml] setGalleryItems sent", {
    itemsLength: Array.isArray(items) ? items.length : 0,
    brand: currentG1G2BrandKey,
    shop: currentG1G2ShopKey,
    all: currentG1G2AllValue,
    hideBrandSelect: currentG1G2HideBrandSelect
  });
}

function pushMobileMainImages(items) {
  if (!isMobile) return;

  if ($w("#MobileCombinedHtml") && typeof $w("#MobileCombinedHtml").postMessage === "function") {
    const mobileItems = Array.isArray(items)
      ? items.map(item => {
          const title = String(item?.title || "");
          const lastSpaceIndex = title.lastIndexOf(" ");
          const extractedText = lastSpaceIndex >= 0 ? title.substring(lastSpaceIndex + 1) : title;
          
          // ▼ 2枚目の画像データ（Hover画像）を探して合体させる
          const hoverItem = galleryHoverItems.find(h =>
            h.title === item.title ||
            String(h.productId || "") === String(item.productId || "") ||
            String(h.slug || "") === String(item.slug || "")
          ) || {};

          return {
            ...item,
            hoverImage: item.hoverImage || hoverItem.hoverImage || hoverItem.src || hoverItem.originalImage || null,
            brandText: currentBrandText || "",
            productNoText: currentProductNoText || "",
            colorHtml: `<div style="font-size: 18px;">${extractedText}</div>`
          };
        })
      : [];

    console.log("[MobileCombinedHtml][setGalleryItems][first item check]", mobileItems[0]);

    $w("#MobileCombinedHtml").postMessage({
      type: "setGalleryItems",
      items: mobileItems
    });
  }
}

function postG2OpenItemToMobileCombinedHtml(item) {
  if (!isMobile) return;

  const html = $w("#MobileCombinedHtml");
  if (!html || typeof html.postMessage !== "function") {
    console.warn("[G2->MobileCombinedHtml] #MobileCombinedHtml not found or postMessage unsupported");
    return;
  }

  if (!item) return;

  const clickedProductId = String(item.productId || "").trim();
  const clickedSlug = String(item.slug || "").toLowerCase().trim();
  const clickedTitle = String(item.title || "").trim();

  const matchedGalleryItem = galleryNormalItems.find(galleryItem =>
    (clickedProductId && String(galleryItem.productId || "").trim() === clickedProductId) ||
    (clickedSlug && String(galleryItem.slug || "").toLowerCase().trim() === clickedSlug) ||
    (clickedTitle && String(galleryItem.title || "").trim() === clickedTitle)
  ) || null;

  const title = String(
    matchedGalleryItem?.title ||
    item?.title ||
    ""
  );

  const lastSpaceIndex = title.lastIndexOf(" ");
  const extractedText = lastSpaceIndex >= 0 ? title.substring(lastSpaceIndex + 1) : title;

  const hoverItem = galleryHoverItems.find(h =>
    (clickedProductId && String(h.productId || "").trim() === clickedProductId) ||
    (clickedSlug && String(h.slug || "").toLowerCase().trim() === clickedSlug) ||
    (clickedTitle && String(h.title || "").trim() === clickedTitle)
  ) || {};

  const selectedSrc =
    matchedGalleryItem?.src ||
    matchedGalleryItem?.originalImage ||
    matchedGalleryItem?.image ||
    item.src ||
    item.originalImage ||
    item.image ||
    "";

  const selectedOriginalImage =
    matchedGalleryItem?.originalImage ||
    matchedGalleryItem?.src ||
    matchedGalleryItem?.image ||
    item.originalImage ||
    item.src ||
    item.image ||
    selectedSrc;

  const selectedHoverImage =
    matchedGalleryItem?.hoverImage ||
    item.hoverImage ||
    hoverItem.hoverImage ||
    hoverItem.src ||
    hoverItem.originalImage ||
    null;

  const combinedItem = {
    ...(matchedGalleryItem || {}),
    ...item,
    src: selectedSrc,
    originalImage: selectedOriginalImage,
    image: selectedSrc,
    hoverImage: selectedHoverImage,
    title,
    productId: String(
      matchedGalleryItem?.productId ||
      item.productId ||
      ""
    ),
    slug: String(
      matchedGalleryItem?.slug ||
      item.slug ||
      ""
    ),
    brandText: currentBrandText || item.brandText || item.brand || matchedGalleryItem?.brandText || matchedGalleryItem?.brand || "",
    productNoText: currentProductNoText || item.productNoText || matchedGalleryItem?.productNoText || "",
    colorHtml: item.colorHtml || currentColorHtml || matchedGalleryItem?.colorHtml || `<div style="font-size: 18px;">${extractedText}</div>`,
    priceText: item.priceText || item.priceTaxIn || item.formattedPrice || item.price || matchedGalleryItem?.priceText || matchedGalleryItem?.priceTaxIn || matchedGalleryItem?.formattedPrice || matchedGalleryItem?.price || ""
  };

  const hasCombinedImage = !!(
    combinedItem.src ||
    combinedItem.originalImage ||
    combinedItem.image
  );

  const combinedItems = hasCombinedImage
    ? [
        combinedItem,
        ...galleryNormalItems.filter(galleryItem =>
          !(
            (combinedItem.productId && String(galleryItem.productId || "") === String(combinedItem.productId || "")) ||
            (combinedItem.slug && String(galleryItem.slug || "").toLowerCase().trim() === String(combinedItem.slug || "").toLowerCase().trim()) ||
            (combinedItem.title && String(galleryItem.title || "").trim() === String(combinedItem.title || "").trim())
          )
        )
      ]
    : galleryNormalItems.slice();

  console.log("[G2->MobileCombinedHtml] clicked item =", item);
  console.log("[G2->MobileCombinedHtml] matchedGalleryItem =", matchedGalleryItem);
  console.log("[G2->MobileCombinedHtml] combinedItem =", combinedItem);
  console.log("[G2->MobileCombinedHtml] hasCombinedImage =", hasCombinedImage);
  console.log("[G2->MobileCombinedHtml] combinedItems length =", combinedItems.length);

  html.postMessage({
    type: "catalogInfo",
    payload: {
      brandText: currentBrandText || combinedItem.brandText || "",
      titleText: String(combinedItem.titleText || combinedItem.title || ""),
      priceText: String(combinedItem.priceText || combinedItem.priceTaxIn || combinedItem.formattedPrice || combinedItem.price || ""),
      colorHtml: String(combinedItem.colorHtml || currentColorHtml || "")
    }
  });

  html.postMessage({
    type: "setGalleryItems",
    items: combinedItems
  });
}

function pushInitialPreviewImageDirect(item) {
  if (!item) return;

  const payload = [item];

  const sendPc = () => {
    const html = $w("#mainGalleryHtml");

    if (html && typeof html.postMessage === "function") {
      html.postMessage({
        channel: "mainGallery",
        type: "setGalleryItems",
        items: payload,
        brand: currentG1G2BrandKey,
        brandKey: currentG1G2BrandKey,
        shop: currentG1G2ShopKey,
        all: currentG1G2AllValue,
        hideBrandSelect: currentG1G2HideBrandSelect
      });

      html.postMessage({
        channel: "mainGallery",
        type: "setOtherProductsButtonDisabled",
        disabled: true,
        brand: currentG1G2BrandKey,
        brandKey: currentG1G2BrandKey,
        shop: currentG1G2ShopKey,
        all: currentG1G2AllValue,
        hideBrandSelect: currentG1G2HideBrandSelect
      });
    }
  };

  const sendMobile = () => {
    if ($w("#MobileCombinedHtml") && typeof $w("#MobileCombinedHtml").postMessage === "function") {
      const title = String(item?.title || "");
      const lastSpaceIndex = title.lastIndexOf(" ");
      const extractedText = lastSpaceIndex >= 0 ? title.substring(lastSpaceIndex + 1) : title;

      $w("#MobileCombinedHtml").postMessage({
        type: "setGalleryItems",
        items: [{
          ...item,
          brandText: currentBrandText || "",
          productNoText: currentProductNoText || "",
          colorHtml: `<div style="font-size: 18px;">${extractedText}</div>`
        }]
      });
    }
  };

  if (isMobile) {
    sendMobile();
  } else {
    sendPc();
  }
}

function pushPCMainImageHtml(items = []) {
  if (isMobile) return;

  const html = $w("#MainImageHtml");
  if (!html || typeof html.postMessage !== "function") {
    console.warn("[MainImageHtml] not found or postMessage unsupported");
    return;
  }

  // ▼ PC用も同様に2枚目の画像データ（Hover画像）を合体させて送る
  const payloadItems = (Array.isArray(items) ? items : []).map(item => {
    const hoverItem = galleryHoverItems.find(h => h.title === item.title) || {};
    return {
      ...item,
      hoverImage: item.hoverImage || hoverItem.src || hoverItem.originalImage || null
    };
  });

  html.postMessage({
    type: "setGalleryItems",
    items: payloadItems
  });
}

function pushMobileCatalogInfo() {
  if (!isMobile) return;

  const html = $w("#MobileCombinedHtml");
  if (!html || typeof html.postMessage !== "function") return;

  html.postMessage({
    type: "catalogInfo",
    payload: {
      brandText: currentBrandText,
      productNoText: currentProductNoText,
      colorHtml: currentColorHtml,
      salesCatchHtml: currentSalesCatchHtml,
      salesTextsHtml: currentSalesTextsHtml
    }
  });
}


async function updateCurrentBrandLogoUrl(brand) {
  const brandName = String(brand || "").trim();
  if (!brandName) {
    return currentBrandLogoUrl;
  }

  try {
    const result = await wixData.query("BrandSettings")
      .eq("brand", brandName)
      .limit(1)
      .find();

    const item = result.items?.[0] || {};
    const logoUrl = toHtmlImageSrc(item.brandLogo);
    if (logoUrl) currentBrandLogoUrl = logoUrl;
    console.log("[BrandSettings] lookup brand =", brandName);
    console.log("[BrandSettings] brandLogo raw =", item.brandLogo);
    console.log("[BrandSettings] currentBrandLogoUrl =", currentBrandLogoUrl);
  } catch (e) {
    console.error("[BrandSettings] brandLogo lookup failed =", e);
  }

  return currentBrandLogoUrl;
}

async function getImport307InfoItemBySlug(slug) {
  const normalizedSlug = String(slug || "").toLowerCase().trim();
  if (!normalizedSlug) return null;

  const result = await wixData.query("Import307")
    .eq("slug", normalizedSlug)
    .limit(1)
    .find();

  return result.items[0] || null;
}

async function getSalesPointImageByTitle(title) {
  const pointTitle = String(title || "").trim();
  if (!pointTitle) return "";

  const result = await wixData.query("SalesPoint")
    .eq("title", pointTitle)
    .limit(1)
    .find();

  return toHtmlImageSrc(result.items?.[0]?.pointImage);
}

async function getSoleNameImageByTitle(title) {
  const soleName = String(title || "").trim();
  if (!soleName) return "";

  const result = await wixData.query("SoleNameTable")
    .eq("title", soleName)
    .limit(1)
    .find();

  return toHtmlImageSrc(result.items?.[0]?.soleNameImage);
}

async function getSoleHeightByTitle(title) {
  const soleName = String(title || "").trim();
  if (!soleName) return "";

  const result = await wixData.query("SoleNameTable")
    .eq("title", soleName)
    .limit(1)
    .find();

  return String(result.items?.[0]?.soleHeight || "").trim();
}

async function getSoleMaterialByTitle(title) {
  const soleName = String(title || "").trim();
  if (!soleName) return "";

  const result = await wixData.query("SoleNameTable")
    .eq("title", soleName)
    .limit(1)
    .find();

  return String(result.items?.[0]?.soleMaterial || "").trim();
}

async function postProductInfoToHtml(salesData = null, infoItem = null, isAlive = null) {
  const html = isMobile ? $w("#MobileCombinedHtml") : $w("#ProductInfoHtml");
  if (!html || typeof html.postMessage !== "function") return false;
  if (!infoItem) return false;



  const mainImage1 = toHtmlImageSrc(infoItem.mainMedia);
  const popup2Items = getImport307GalleryImages(infoItem.mediaGallery || infoItem.mediagallery || infoItem.mediaItems);
  const mainImage2 = popup2Items[0] || "";
  const pointImage1 = await getSalesPointImageByTitle(infoItem.point);
  const pointImage2 = toHtmlImageSrc(infoItem.itempointImage);
  const soleTitle = firstNonEmptyValue(infoItem?.soleName, infoItem?.sole);
  const pointImage3 = await getSoleNameImageByTitle(soleTitle);
  const soleHeight = await getSoleHeightByTitle(soleTitle);
  const resolvedSoleMaterial = await getSoleMaterialByTitle(soleTitle);
  const brandLogoUrl =
    currentBrandLogoUrl ||
    toHtmlImageSrc(infoItem.brandlogo || infoItem.brandLogo || infoItem.logo);
  console.log("[INFOHTML] target =", isMobile ? "#MobileCombinedHtml" : "#ProductInfoHtml");
  console.log("[INFOHTML] infoItem.slug =", infoItem.slug);
  console.log("[INFOHTML] infoItem keys =", Object.keys(infoItem || {}));
  console.log("[INFOHTML] mainMedia raw =", infoItem.mainMedia);
  console.log("[INFOHTML] mediaGallery raw =", infoItem.mediaGallery);
  console.log("[INFOHTML] mediaItems raw =", infoItem.mediaItems);
  console.log("[INFOHTML] mainImage1 =", mainImage1);
  console.log("[INFOHTML] popup2Items =", popup2Items);
  console.log("[INFOHTML] currentBrandLogoUrl =", currentBrandLogoUrl);
  console.log("[INFOHTML] brandLogoUrl =", brandLogoUrl);
  console.log("[INFOHTML] mainImage2 =", mainImage2);

  if (typeof isAlive === "function" && !isAlive()) {
    console.log("[OPENITEM][stale skip] before productInfo postMessage");
    return false;
  }

  html.postMessage({
    type: "productInfo",
    payload: {
      slug: String(infoItem.slug || ""),
      catchcopy: stripHtmlTags(salesData?.catchcopy || salesData?.catchCopy || salesData?.salesCatch),
      description: normalizeRichTextHtml(salesData?.salesTexts || salesData?.description),
      mainimage1: mainImage1,
      mainimage2: mainImage2,
      mainpopup1: mainImage1,
      mainpopup2: mainImage2,
      mainpopup2Items: popup2Items,
      pointimage1: pointImage1,
      pointimage2: pointImage2,
      pointimage3: pointImage3,
      pointlabel1: stripHtmlTags(infoItem.pointlabel1 || infoItem.pointLabel1 || "POINT 01"),
      pointlabel2: stripHtmlTags(infoItem.pointlabel2 || infoItem.pointLabel2 || "POINT 02"),
      pointlabel3: stripHtmlTags(infoItem.pointlabel3 || infoItem.pointLabel3 || "POINT 03"),
        brandlogo: brandLogoUrl,
      spec: buildProductSpecList(infoItem, soleHeight, resolvedSoleMaterial),
      feature: toPointTextList(salesData?.pointText).length
        ? toPointTextList(salesData?.pointText)
        : toProductInfoList(infoItem.feature || infoItem.features || infoItem.points)
    }
  });

  if (isMobile) {
  } else {
  }

  return true;
}

function applyPinterestMeta({ product, salesData, currentItem, selectedKey }) {
  if (!product) return;

  const titleText = String(product.name || `${currentItem} ${selectedKey || ""}`).trim();

  const descText =
    stripHtmlTags(salesData?.salesTexts) ||
    stripHtmlTags(salesData?.salesCatch) ||
    String(product.description || "").trim() ||
    titleText;

  const imageUrl = toHtmlImageSrc(product.mainMedia);
  const priceTaxIn = Math.floor(Number(product.price || 0) * 1.1);

  setTitle(titleText);

  setMetaTags([
    { name: "description", content: descText },
    { property: "og:title", content: titleText },
    { property: "og:description", content: descText },
    { property: "og:image", content: imageUrl },
    { property: "product:price:amount", content: String(priceTaxIn) },
    { property: "product:price:currency", content: "JPY" }
  ]);
}

async function clearWixCartAll() {
  const c = await cart.getCurrentCart();
  const items = c?.lineItems || [];
  for (const li of items) {
    await cart.removeProduct(li.id);
  }
}

/* ========= 共通ヘルパー ========= */
function safeOnClick(el, handler, name = "") {
  if (!el) {
    console.warn(`onClick未登録: ${name || "(ID不明)"} が見つかりません`);
    return;
  }
  if (typeof el.onClick !== "function") {
    console.warn(`onClick未登録: ${name || "(ID不明)"} は onClick に未対応`);
    return;
  }
  el.onClick(handler);
}

async function collapseIfPossible(el) {
  if (!el) return;

  if (typeof el.collapse === "function") {
    if (typeof el.collapsed === "boolean" && el.collapsed) return;
    await el.collapse();
    return;
  }

  if (typeof el.hide === "function") {
    if (typeof el.hidden === "boolean" && el.hidden) return;
    await el.hide();
    return;
  }

  console.warn("collapseIfPossible: collapse/hide未対応の要素", el.id);
}

async function expandIfPossible(el) {
  if (!el) return;

  if (typeof el.expand === "function") {
    if (typeof el.collapsed === "boolean" && !el.collapsed) return;
    await el.expand();
    return;
  }

  if (typeof el.show === "function") {
    if (typeof el.hidden === "boolean" && !el.hidden) return;
    await el.show();
    return;
  }

  console.warn("expandIfPossible: expand/show未対応の要素", el.id);
}

async function requestMobileCombinedHeight() {
  const html = $w("#MobileCombinedHtml");
  if (!html || typeof html.postMessage !== "function") return;

  html.postMessage({ type: "requestCombinedHeight" });

  setTimeout(() => {
    if (__mobileScreenMode !== "combined") return;

    const htmlLater = $w("#MobileCombinedHtml");
    if (htmlLater && typeof htmlLater.postMessage === "function") {
      htmlLater.postMessage({ type: "requestCombinedHeight" });
    }
  }, 120);

  setTimeout(() => {
    if (__mobileScreenMode !== "combined") return;

    const htmlLater = $w("#MobileCombinedHtml");
    if (htmlLater && typeof htmlLater.postMessage === "function") {
      htmlLater.postMessage({ type: "requestCombinedHeight" });
    }
  }, 500);

  setTimeout(() => {
    if (__mobileScreenMode !== "combined") return;

    const htmlLater = $w("#MobileCombinedHtml");
    if (htmlLater && typeof htmlLater.postMessage === "function") {
      htmlLater.postMessage({ type: "requestCombinedHeight" });
    }
  }, 1000);
}

async function openMobileCombinedScreen() {
  if (!isMobile) return;

  __mobileScreenMode = "combined";

  await collapseIfPossible($w("#G1G2GallerySection"));
  await collapseIfPossible($w("#mobilemainGalleryHtml"));
  await collapseIfPossible($w("#CheckoutSection"));

  await expandIfPossible($w("#MobileUiSection"));
  await expandIfPossible($w("#MobileCombinedHtml"));

  await requestMobileCombinedHeight();

  if ($w("#MobileUiSection") && typeof $w("#MobileUiSection").scrollTo === "function") {
    await $w("#MobileUiSection").scrollTo();
  }

  await wixWindow.scrollTo(0, 0);
}

async function openMobileG1G2Screen() {
  if (!isMobile) return;

  __mobileScreenMode = "g1g2";

  await collapseIfPossible($w("#MobileUiSection"));
  await collapseIfPossible($w("#MobileCombinedHtml"));
  await collapseIfPossible($w("#CheckoutSection"));

  await expandIfPossible($w("#G1G2GallerySection"));
  await expandIfPossible($w("#mobilemainGalleryHtml"));

  const bannerHtml = $w("#mobilemainGalleryHtml");
  if (bannerHtml && typeof bannerHtml.postMessage === "function") {
    bannerHtml.postMessage({ type: "setProductScreenActive", active: false });
    bannerHtml.postMessage({ type: "resetG1G2Scroll" });
  }

  if ($w("#G1G2GallerySection") && typeof $w("#G1G2GallerySection").scrollTo === "function") {
    await $w("#G1G2GallerySection").scrollTo();
  }
}




// ✅ スタイル安全適用ヘルパー（存在チェック＆style存在チェック）
function applyStyleIfPossible(selector, mutator) {
  const el = $w(selector);
  if (!el) return;
  if (!el.style) return;
  try { mutator(el.style); } catch (e) { console.warn(`style適用失敗: ${selector}`, e); }
}

async function closeMobileMenu() {
  const brandBoxHtml = $w("#mobilemainGalleryHtml");

  __mobileMainGalleryLastHeight = 0;

  if (brandBoxHtml && typeof brandBoxHtml.postMessage === "function") {
    brandBoxHtml.postMessage({
      type: "setMobileMenuState",
      open: false
    });
  }

  if (mobileMenuBeforeState) {
    if (mobileMenuBeforeState.MobileUiSection) {
      await openMobileCombinedScreen();
    } else if (mobileMenuBeforeState.G1G2GallerySection) {
      await openMobileG1G2Screen();
    } else {
      await collapseIfPossible($w("#G1G2GallerySection"));
      await collapseIfPossible($w("#mobilemainGalleryHtml"));
      await collapseIfPossible($w("#MobileUiSection"));
      await collapseIfPossible($w("#MobileCombinedHtml"));
    }

    if (mobileMenuBeforeState.CheckoutSection) {
      await expandIfPossible($w("#CheckoutSection"));
    } else {
      await collapseIfPossible($w("#CheckoutSection"));
    }
  }

  mobileMenuBeforeState = null;
  menuOpen = false;
  pushMobileCatalogInfo();
  console.log("📂 メニュー閉じ");
}

async function openMobileMenu() {
  const brandBoxHtml = $w("#mobilemainGalleryHtml");

  mobileMenuBeforeState = {
    G1G2GallerySection: !$w("#G1G2GallerySection").collapsed,
    mobilemainGalleryHtml: !$w("#mobilemainGalleryHtml").collapsed,
    MobileUiSection: !$w("#MobileUiSection").collapsed,
    MobileCombinedHtml: !$w("#MobileCombinedHtml").collapsed,
    CheckoutSection: !$w("#CheckoutSection").collapsed
  };

  await expandIfPossible($w("#G1G2GallerySection"));
  await expandIfPossible($w("#mobilemainGalleryHtml"));

  await collapseIfPossible($w("#MobileUiSection"));
  await collapseIfPossible($w("#MobileCombinedHtml"));
  await collapseIfPossible($w("#CheckoutSection"));

  __mobileMainGalleryLastHeight = 0;

  if (brandBoxHtml) {
    brandBoxHtml.height = 80;
  }

  if (brandBoxHtml && typeof brandBoxHtml.postMessage === "function") {
    brandBoxHtml.postMessage({
      type: "setMobileMenuState",
      open: true
    });
  }

  menuOpen = true;
  console.log("📂 メニュー開き");
}
/* ============================== */
/* ===============================
   Mobile Cart (Custom UI) - Wix Cartを中身に使用
   対象: #CheckoutSection / リピーター / 合計表示
   =============================== */

// ---- MBカートを描画 ----
let __isRenderingMobileCart = false;

async function renderMobileCart(cartData) {
  if (__isRenderingMobileCart) return;
  __isRenderingMobileCart = true;

  try {
    const section = $w(CheckoutSectionId);
    if (!section) return;

    const lineItems = cartData?.lineItems || [];

    let subtotal = 0;

const repeaterData = lineItems.map(li => {
  const qty = Number(li.quantity || 0);
  const unit = getLineItemUnitPrice(li);
  const unitTaxIn = Math.floor(unit * 1.1);
  const lineTotal = unitTaxIn * qty;
  subtotal += lineTotal;

  const lineItemId = String(li.id);
  const displayName = String(li.name || "");

  return {
    _id: lineItemId,
    lineItemId: lineItemId,
    name: displayName,
    image: productMainMediaById.get(li.productId) || getLineItemImageUrl(li),

    size: getSizeFromLineItem(li),
    
    qty: qty,
    unitPrice: unitTaxIn,
    lineTotal: lineTotal
  };
});



// ▼ 追加：カート総数量を表示
    const totalCount = lineItems.reduce((sum, li) => sum + Number(li.quantity || 0), 0);
  } finally {
    __isRenderingMobileCart = false;
  }
}

let __cartViewPrev = null;

// ---- MBカートを開く/閉じる（セクション切替方式） ----

async function openCheckoutSection() {
   console.log("✅ openCheckoutSection() start");
  // ▼追加：初回だけ元状態を保存して、カート以外を閉じる
  if (!__cartViewPrev) {
    __cartViewPrev = {};
    cartHideTargets.forEach(id => {
      const el = $w(id);
      if (!el) return;
      if (typeof el.collapsed === "boolean") {
        __cartViewPrev[id] = el.collapsed;
      }
    });
  }

  for (const id of cartHideTargets) {
    await collapseIfPossible($w(id));
  }
  const sec = $w(CheckoutSectionId);
  console.log("CheckoutSection exists?", !!sec);

  await expandIfPossible(sec);

    if (sec && typeof sec.scrollTo === "function") await sec.scrollTo();

  if (sec) {
    console.log("CheckoutSection collapsed:", sec.collapsed);
    console.log("CheckoutSection hidden:", sec.hidden);
  }

  const cartData = await getCartSnapshot();
  await renderMobileCart(cartData);

  console.log("✅ openCheckoutSection() end");
}

async function openSharedCartSection() {
  await openCheckoutSection();

  if (!isMobile) {
    const sideCart = $w("#SideCartHtml");
    if (sideCart && typeof sideCart.scrollTo === "function") {
      await sideCart.scrollTo();
    }
  }
}

async function closeCheckoutSection() {
  await collapseIfPossible($w(CheckoutSectionId));
    // ▼追加：保存していた表示状態に復帰
  if (__cartViewPrev) {
    for (const id of cartHideTargets) {
      const el = $w(id);
      if (!el) continue;

      const wasCollapsed = __cartViewPrev[id];
      if (wasCollapsed === false) {
        await expandIfPossible(el);
      } else {
        await collapseIfPossible(el);
      }
    }
    __cartViewPrev = null;
  }
}

// ---- onReadyでイベントを紐づける ----
function setupMobileCartUI() {
  // 初期は閉じる
  collapseIfPossible($w(CheckoutSectionId));

  // 閉じるボタン
safeOnClick($w(MobileCloseButtonId), async () => {
  await closeCheckoutSection();
  return;
}, "MobileCloseButton");

safeOnClick($w("#MobileCloseButton2"), async () => {
  await closeCheckoutSection();
  return;
}, "MobileCloseButton2");

  // レジへ進む
  


}

$w.onReady(async function () {
  console.time("🟩 onReady 全体");
  isMobile = wixWindow.formFactor === "Mobile";

    setTitle("META TEST TITLE");
  setMetaTags([
    { name: "description", content: "META TEST DESCRIPTION" },
    { property: "og:title", content: "META TEST OG TITLE" },
    { property: "og:description", content: "META TEST OG DESCRIPTION" },
    { property: "product:price:amount", content: "3300" },
    { property: "product:price:currency", content: "JPY" }
  ]);
    // ---- Square戻り（sqret=1）なら無条件でカートをクリア ----
  try {
    const sqret = String(wixLocation.query.sqret || "").trim();
    const internalOrderIdFromUrl = String(wixLocation.query.internalOrderId || "").trim();

    if (sqret === "1" && internalOrderIdFromUrl) {
      const already = String(session.getItem("cartClearedInternalOrderId") || "");
      if (already !== internalOrderIdFromUrl) {
        await clearWixCartAll();
        session.setItem("cartClearedInternalOrderId", internalOrderIdFromUrl);
      }
    }
  } catch (e) {
    console.error("Square戻りカートクリア失敗:", e);
  }

  console.log("✅ mobile/PC選択　取得成功");

  if (isMobile) {
    menuOpen = false;
    console.log("📂 初期状態でモバイルメニュー非表示");
  }

if (isMobile && $w("#MobileCombinedHtml") && typeof $w("#MobileCombinedHtml").onMessage === "function") {
  $w("#MobileCombinedHtml").onMessage(async (event) => {
    const data = event?.data;
    if (!data || typeof data !== "object") return;

    if (data.type === "mobileImageChanged") {
      const changedItem = data.item || {};

      mobileViewAlt = !!data.isAlt;

      if (data.reason === "toggle") {
        return;
      }

      postMobileCatalogTitleFromItem(changedItem);
      updateText({ item: changedItem });
      return;
    }

      if (data.type === "openOtherProducts") {
        await goBackToG1();
        return;
      }
  });
}

// ▼ 追加：PC版スライダー（MainImageHtml）で画像（色）が切り替わった際の通知を受信し、在庫を更新する
if (!isMobile && $w("#MainImageHtml") && typeof $w("#MainImageHtml").onMessage === "function") {
  $w("#MainImageHtml").onMessage(async (event) => {
    const data = event?.data;
    if (!data || typeof data !== "object") return;

    // HTML側からの通知名が imageChanged または mobileImageChanged であることを想定
    if (data.type === "imageChanged" || data.type === "mobileImageChanged") {
      const changedItem = data.item || {};
      
      // ▼ 安全装置：今と同じ商品（色）の連続通知なら無視してストップ（ループ防止）
      if (String(changedItem.title || "").trim() === String(productNameID || "").trim()) {
        return;
      }
      
      updateText({ item: changedItem });
      postCatalogTitleFromItem(changedItem);
    }
  });
}

  await setupViewBasedOnDevice();
  setupEventHandlers();           // ギャラリーのクリック/選択イベントなど



  setupPasswordProtectedActions();// 管理系ボタン
  setupCartEventHandlers();       // カートイベント
  setupMobileCartUI();
  setupCartUiHtml();
  setupMobileCombinedHtmlMetrics();
  setupMobileMainGalleryHtmlMetrics();

  const productInfoHtml = isMobile ? null : $w("#ProductInfoHtml");
  if (productInfoHtml && typeof productInfoHtml.onMessage === "function") {
    productInfoHtml.onMessage((event) => {
      const data = event?.data;
      if (!data || typeof data !== "object") return;
      if (data.type !== "brandStopMetrics") return;

      const brandTop = Number(data.payload?.brandTop || 0);
      const brandHeight = Number(data.payload?.brandHeight || 0);
      const contentHeight = Number(data.payload?.contentHeight || 0);

      if (!contentHeight) return;

      if (!brandTop || !brandHeight) return;

      const viewportH = wixWindow.formFactor === "Mobile" ? 844 : 900;

      // ロゴ中心を画面下3/4付近に置く
      const targetCenterY = viewportH * 0.75;

      const extraBelow = Math.max(0, contentHeight - (brandTop + brandHeight));
      const targetHtmlHeight = Math.round(targetCenterY + extraBelow + (brandHeight / 2));

      // 念のため最低高さを確保
      const finalHeight = Math.max(300, targetHtmlHeight);

      try {
        productInfoHtml.height = finalHeight;
        console.log("[brandStopMetrics]", {
          brandTop,
          brandHeight,
          contentHeight,
          targetHtmlHeight,
          finalHeight
        });
      } catch (e) {
        console.error("ProductInfoHtml 高さ調整失敗:", e);
      }
    });
  }


if (isMobile && $w("#mobilemainGalleryHtml") && typeof $w("#mobilemainGalleryHtml").onMessage === "function") {
  $w("#mobilemainGalleryHtml").onMessage(async (event) => {
    const data = event?.data || {};

    console.log("[mobilemainGalleryHtml][onMessage received]", {
      type: data.type,
      channel: data.channel,
      data
    });

    if (data.channel !== "mainGallery") return;

    if (data.type === "toggleMobileMenu") {
      if (menuOpen) {
        await closeMobileMenu();
      } else {
        await openMobileMenu();
      }
      return;
    }

    if (data.type === "closeMenu") {
      await closeMobileMenu();
      return;
    }

    if (data.type === "openTop") {
      const url = String(data.url || "").trim();
      const cfgNow = BRAND_CONFIG[String(brandKey || "").trim()];
      await closeMobileMenu();
      wixLocation.to(url || cfgNow?.topUrl || "https://www.hatodaiya.com");
      return;
    }

    if (data.type === "openInstagram") {
      const url = String(data.url || "").trim();
      const cfgNow = BRAND_CONFIG[String(brandKey || "").trim()];
      await closeMobileMenu();

      menuOpen = false;
      mobileMenuBeforeState = null;

      const brandBoxHtml = $w("#mobilemainGalleryHtml");
      if (brandBoxHtml && typeof brandBoxHtml.postMessage === "function") {
        brandBoxHtml.postMessage({
          type: "setMobileMenuState",
          open: false
        });

        brandBoxHtml.postMessage({
          type: "closeMenu"
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 180));

      wixLocation.to(url || cfgNow?.instagramUrl || "https://www.instagram.com/hatodaiya");
      return;
    }

    if (data.type === "openContact") {
      const url = String(data.url || "").trim();
      await closeMobileMenu();
      wixLocation.to(url || "https://www.hatodaiya.com/contact");
      return;
    }

    if (data.type === "openLinkshop") {
      const url = String(data.url || "").trim();
      await closeMobileMenu();
      wixLocation.to(url || "https://www.hatodaiya.com/onlinestore-top");
      return;
    }

    if (data.type === "ready") {
      console.log("[mobilemainGalleryHtml][ready received] G1再送信");

      await postCategoryThumbnailMenu("");

      return;
    }

    if (data.type === "openCategory") {
      const categoryKeyFromMobileMainGallery = String(data.categoryKey || "").trim();

      if (!categoryKeyFromMobileMainGallery) {
        console.warn("[mobilemainGalleryHtml][openCategory] categoryKey が空です", data);
        return;
      }

      const categoryGalleryState = await loadCategoryGalleryFromPayload({
        slug: categoryKeyFromMobileMainGallery
      });

      if (!categoryGalleryState) {
        console.warn("[mobilemainGalleryHtml][openCategory] categoryGalleryState が取得できません", {
          categoryKey: categoryKeyFromMobileMainGallery
        });
        return;
      }

      await collapseIfPossible($w("#MainSection"));
      await openMobileG1G2Screen();

      menuOpen = false;

      return;
    }

    if (data.type === "backToG1") {
      categoryKey = "";
      currentItem = "";
      await postCategoryThumbnailMenu("");


      return;
    }

    if (data.type === "openItem") {
      const item = data.item || {};
      const clickedTitle = String(item.title || "").trim();
      const clickedCategoryKey = String(item.categoryKey || categoryKey || currentItem || "").toLowerCase().trim();

      if (!clickedTitle) {
        console.warn("[mobilemainGalleryHtml][openItem] title が空です", item);
        return;
      }

      if (clickedCategoryKey) {
        categoryKey = clickedCategoryKey;
        currentItem = clickedCategoryKey;
      }

      productNameID = clickedTitle;
      currentBrandText = String(item.brandText || item.brand || currentBrandText || "");
      currentProductNoText = String(item.productNoText || currentProductNoText || "");
      currentColorHtml = String(item.colorHtml || currentColorHtml || "");

      galleryNormalItems = [
        item,
        ...galleryNormalItems.filter((galleryItem) =>
          String(galleryItem.title || "").trim() !== clickedTitle
        )
      ];

      galleryItems = galleryNormalItems.slice();

      postG2OpenItemToMobileCombinedHtml(item);
      pushCatalogInfo();
      updateText({ item });

      let salesDataLocal = null;

      const salesTextQueryLocal = await wixData.query("ProductSalesTexts")
        .eq("title", currentItem)
        .find();

      if (salesTextQueryLocal.items.length > 0) {
        salesDataLocal = salesTextQueryLocal.items[0];
      } else {
        const normKeyLocal = String(currentItem || "").trim().toLowerCase();
        const retryLocal = await wixData.query("ProductSalesTexts")
          .contains("title", currentItem)
          .find();

        if (retryLocal.items.length > 0) {
          salesDataLocal = retryLocal.items.find(x => ((x.title || "").trim().toLowerCase() === normKeyLocal)) || null;
        }

        if (!salesDataLocal && retryLocal.items.length > 0) {
          salesDataLocal = retryLocal.items[0];
        }
      }

      const selectedInfoItemLocal = await getImport307InfoItemBySlug(currentItem);
      const productInfoPostedLocal = await postProductInfoToHtml(salesDataLocal, selectedInfoItemLocal);

      if (salesDataLocal) {
        currentSalesCatchHtml = salesDataLocal.salesCatch || "";
        currentSalesTextsHtml = salesDataLocal.salesTexts || "";
      } else {
        currentSalesCatchHtml = "";
        currentSalesTextsHtml = "";
      }

      if (productInfoPostedLocal) {
        pushMobileCatalogInfo();
      }

      const cartDataLocal = await getCartSnapshot();
      const resLocal = await fetchAndLogVariants(productNameID, cartDataLocal);

      if (resLocal) {
        await updateDropdownAndStockDisplay(
          productNameID,
          resLocal.tempStock,
          resLocal.productId,
          resLocal.variants,
          cartDataLocal
        );
      } else {
        console.warn("[mobilemainGalleryHtml][openItem] 在庫取得失敗 productNameID =", productNameID);
        showNoStock();
      }

      await openMobileCombinedScreen();

      menuOpen = false;

      return;
    }
  });
}

if (!isMobile && $w("#mainGalleryHtml") && typeof $w("#mainGalleryHtml").onMessage === "function") {
  $w("#mainGalleryHtml").onMessage(async (event) => {
    const data = event?.data || {};

    console.log("[mainGalleryHtml][onMessage received]", {
      type: data.type,
      channel: data.channel,
      data
    });

    if (data.type === "ready") {
      if (currentPcBrandBoxHtml && $w("#mainGalleryHtml") && typeof $w("#mainGalleryHtml").postMessage === "function") {
        $w("#mainGalleryHtml").postMessage({
          channel: "mainGallery",
          type: "setBrandBoxHtml",
          html: currentPcBrandBoxHtml
        });
      }
      return;
    }

    if (data.type === "switchBrand") {
      const selectedBrandFromHtml = String(
        data.brand ||
        data.brandKey ||
        data.selectedBrand ||
        data.value ||
        data.key ||
        data.name ||
        ""
      ).trim();

      if (!selectedBrandFromHtml) {
        console.warn("[mainGalleryHtml][switchBrand] selectedBrand が空です", data);
        return;
      }

      if (String(shopKey || "").trim().toUpperCase() !== "HATODAIYA") {
        console.warn("[mainGalleryHtml][switchBrand] HATODAIYA以外ではブランドセレクトを使用しません", {
          shopKey,
          selectedBrandFromHtml
        });
        return;
      }

      const isAllBrand =
        selectedBrandFromHtml.toUpperCase() === "ALL" ||
        selectedBrandFromHtml.toUpperCase() === "HATODAIYA";

      const nextBrand = isAllBrand ? "HATODAIYA" : selectedBrandFromHtml;
      const nextAll = isAllBrand ? "true" : "false";

      invalidateOpenItemRequests("switchBrand");

      const brandSettingsLookupBrand = isAllBrand ? "HATODAIYA" : nextBrand;
      const selectedBrandSettingsRes = await wixData.query("BrandSettings")
        .eq("brand", brandSettingsLookupBrand)
        .limit(1)
        .find();

      const selectedBrandSettingsItem = selectedBrandSettingsRes.items?.[0] || {};
      const selectedBrandPrefix = String(
        isAllBrand
          ? shopPrefixFromBrandSettings
          : selectedBrandSettingsItem.brandPrefix
      ).trim().toLowerCase();

      const selectedBrandLogoUrl = toHtmlImageSrc(selectedBrandSettingsItem.brandLogo);

      if (selectedBrandLogoUrl) {
        currentBrandLogoUrl = selectedBrandLogoUrl;
      }

      currentG1G2BrandKey = nextBrand;
      currentG1G2ShopKey = "HATODAIYA";
      currentG1G2AllValue = nextAll;
      currentG1G2HideBrandSelect = false;

      categoryKey = "";
      currentItem = "";
      selectedKey = "";
      itemSlug = "";
      targetTitle = "";
      galleryItems = [];
      galleryNormalItems = [];
      galleryHoverItems = [];

      const categoriesForBrand = filterG1CategoriesForShop(categoriesResult.items || [], {
        shopKey: isAllBrand ? "HATODAIYA" : nextBrand,
        shopPrefix: selectedBrandPrefix,
        allValue: nextAll
      });

      const productsForCountResult = await getAllProductsForCount();

      const countMapForBrand = buildCategoryCountMap(
        productsForCountResult.items || [],
        categoriesForBrand,
        {
          requireHyphen: true
        }
      );

      const mainGalleryCategories = categoriesForBrand.map((item) => {
        const key = String(item.slug || item.categoryKey || item.title || "").trim().toLowerCase();
        const count = Number(countMapForBrand[key] || 0);

        return {
          key,
          name: String(item.description || item.title || key),
          count,
          sizeLabel: String(item.sizeLabel || item.size || item.sizes || item.sizeRange || "").trim(),
          thumb: toHtmlImageSrc(item.mainMedia || item.image || item.thumbnail),
          description: String(item.description || item.title || key),
          items: [],
          raw: item
        };
      });

      if ($w("#mainGalleryHtml") && typeof $w("#mainGalleryHtml").postMessage === "function") {
        $w("#mainGalleryHtml").postMessage({
          channel: "mainGallery",
          type: "g1",
          brand: nextBrand,
          brandKey: nextBrand,
          selectedBrand: nextBrand,
          shop: "HATODAIYA",
          all: nextAll,
          hideBrandSelect: false,
          showBrandSelect: true,
          brands: currentG1G2BrandSelectBrands,
          brandLogoUrl: currentBrandLogoUrl,
          activeCategoryKey: "",
          categories: mainGalleryCategories
        });
      }

      if ($w("#categoryThumbnailMenu") && typeof $w("#categoryThumbnailMenu").postMessage === "function") {
        $w("#categoryThumbnailMenu").postMessage({
          type: "setCategories",
          items: buildCategoryHtmlItems(categoriesForBrand, countMapForBrand, "", {
            countColor: "#C71585"
          }),
          brand: nextBrand,
          selectedBrand: nextBrand,
          shop: "HATODAIYA",
          all: nextAll,
          hideBrandSelect: false,
          showBrandSelect: true,
          brandOptions: currentG1G2BrandSelectBrands
        });
      }

      await collapseIfPossible($w("#MainSection"));
      await collapseIfPossible($w("#desktopsection"));
      await expandIfPossible($w("#G1G2GallerySection"));

      return;
    }

    // ▼重複して処理を妨害していたブロックを無効化
    if (data.type === "openItem_DISABLE") {
      console.log("[mainGalleryHtml][openItem collapse start]", data);

      await $w("#G1G2GallerySection").collapse();

      console.log("[mainGalleryHtml][openItem collapse done]", {
        collapsed: $w("#G1G2GallerySection").collapsed
      });

      return;
    }

    if (data.type === "openCategory") {
      const categoryKeyFromMainGallery = String(data.categoryKey || "").trim();

      console.log("[mainGalleryHtml][openCategory received]", {
        categoryKey: categoryKeyFromMainGallery,
        channel: data.channel
      });

      if (!categoryKeyFromMainGallery) {
        console.warn("[mainGalleryHtml][openCategory] categoryKey が空です", data);
        return;
      }

      const categoryGalleryState = await loadCategoryGalleryFromPayload({
        slug: categoryKeyFromMainGallery
      });

      if (!categoryGalleryState) {
        console.warn("[mainGalleryHtml][openCategory] categoryGalleryState が取得できません", {
          categoryKey: categoryKeyFromMainGallery
        });
        return;
      }

      console.log("[mainGalleryHtml][openCategory] G2商品送信完了", {
        categoryKey,
        selectedKey,
        galleryNormalItemsLength: galleryNormalItems.length,
        firstItem: galleryNormalItems[0]
      });

      setTimeout(() => {
        if (galleryNormalItems.length > 0) {
          const firstItem = galleryNormalItems[0];
          productNameID = firstItem.title;

          currentBrandText = String(
            firstItem.brand ||
            firstItem.brandText ||
            currentBrandText ||
            ""
          );

          postCatalogTitleFromItem({
            ...firstItem,
            brandText: currentBrandText,
            productNoText: currentProductNoText,
            priceText: firstItem.priceTaxIn || firstItem.formattedPrice || firstItem.price || ""
          });

          pushCatalogInfo();
        }
      }, 0);

      return;
    }

    if (data.type === "openItem") {
      const clickedItem = data.item || {};

      const clickedTitle = String(clickedItem.title || "").trim();
      const clickedProductId = String(clickedItem.productId || "").trim();
      const clickedSlug = String(clickedItem.slug || "").toLowerCase().trim();
      const clickedCategoryKey = String(clickedItem.categoryKey || "").toLowerCase().trim();

      console.log("[mainGalleryHtml][openItem received]", {
        clickedTitle,
        clickedProductId,
        clickedSlug,
        clickedCategoryKey,
        raw: clickedItem
      });

      const openItemRequestId = beginOpenItemRequest(clickedTitle || clickedSlug || clickedProductId);

      if (clickedCategoryKey) {
        categoryKey = clickedCategoryKey;
        currentItem = clickedCategoryKey;
      }

      const fastSelectedGalleryItem =
        galleryNormalItems.find(item =>
          (clickedProductId && String(item.productId || "") === clickedProductId) ||
          (clickedSlug && String(item.slug || "").toLowerCase().trim() === clickedSlug) ||
          (clickedTitle && String(item.title || "").trim() === clickedTitle)
        ) || {
          src: String(clickedItem.image || clickedItem.src || clickedItem.originalImage || ""),
          originalImage: String(clickedItem.image || clickedItem.src || clickedItem.originalImage || ""),
          hoverImage: String(clickedItem.hoverImage || ""),
          title: clickedTitle,
          productId: clickedProductId,
          brand: String(clickedItem.brand || ""),
          slug: clickedSlug,
          priceTaxIn: String(clickedItem.priceText || clickedItem.price || ""),
          formattedPrice: String(clickedItem.priceText || clickedItem.price || ""),
          price: String(clickedItem.priceText || clickedItem.price || ""),
          type: "image"
        };

      if (fastSelectedGalleryItem.src || fastSelectedGalleryItem.originalImage) {
        galleryNormalItems = [
          fastSelectedGalleryItem,
          ...galleryNormalItems.filter(item =>
            !(
              (fastSelectedGalleryItem.productId && String(item.productId || "") === String(fastSelectedGalleryItem.productId || "")) ||
              (fastSelectedGalleryItem.slug && String(item.slug || "").toLowerCase().trim() === String(fastSelectedGalleryItem.slug || "").toLowerCase().trim()) ||
              (fastSelectedGalleryItem.title && String(item.title || "").trim() === String(fastSelectedGalleryItem.title || "").trim())
            )
          )
        ];

        galleryItems = galleryNormalItems.slice();

        pushPCMainImageHtml(galleryNormalItems);

        await collapseIfPossible($w("#G1G2GallerySection"));
        await expandIfPossible($w("#MainSection"));
        await expandIfPossible($w("#desktopsection"));

        if ($w("#MainSection") && typeof $w("#MainSection").scrollTo === "function") {
          await $w("#MainSection").scrollTo();
        }
      }

      let productResultLocal = null;
      let productLocal = null;

      try {
        if (clickedProductId) {
          productResultLocal = await wixData.query("Stores/Products")
            .eq("_id", clickedProductId)
            .limit(1)
            .find();
        }

        if ((!productResultLocal || productResultLocal.items.length === 0) && clickedSlug) {
          productResultLocal = await wixData.query("Stores/Products")
            .eq("slug", clickedSlug)
            .limit(1)
            .find();
        }

        if ((!productResultLocal || productResultLocal.items.length === 0) && clickedTitle) {
          productResultLocal = await wixData.query("Stores/Products")
            .eq("name", clickedTitle)
            .limit(1)
            .find();
        }

        productLocal = productResultLocal?.items?.[0] || null;
      } catch (e) {
        console.error("[mainGalleryHtml][openItem] Stores/Products 取得失敗", e);
      }

      if (openItemRequestId !== __openItemRequestId) {
        console.log("[mainGalleryHtml][openItem stale skip after product query]", {
          openItemRequestId,
          latest: __openItemRequestId,
          clickedTitle
        });
        return;
      }

      if (productLocal) {
        productNameID = String(productLocal.name || clickedTitle || "");
        selectedKey = extractSelectedKeyFromSlug(productLocal.slug);
        itemSlug = String(productLocal.slug || "");
        await updateCurrentBrandLogoUrl(productLocal.brand);

        if (openItemRequestId !== __openItemRequestId) {
          console.log("[mainGalleryHtml][openItem stale skip after brand logo]", {
            openItemRequestId,
            latest: __openItemRequestId,
            clickedTitle
          });
          return;
        }
      } else {
        productNameID = clickedTitle;

        if (clickedSlug) {
          selectedKey = extractSelectedKeyFromSlug(clickedSlug);
          itemSlug = clickedSlug;
        }
      }

      if (!productNameID) {
        console.warn("[mainGalleryHtml][openItem] productNameID が空です", {
          clickedItem,
          productLocal
        });
        return;
      }

      const selectedGalleryItem =
        galleryNormalItems.find(item =>
          (clickedProductId && String(item.productId || "") === clickedProductId) ||
          (clickedTitle && String(item.title || "").trim() === clickedTitle)
        ) || {
          src: toHtmlImageSrc(productLocal?.mainMedia) || String(clickedItem.image || ""),
          originalImage: toHtmlImageSrc(productLocal?.mainMedia) || String(clickedItem.image || ""),
          hoverImage: (productLocal?.mediaItems && productLocal.mediaItems.length > 1) 
            ? toHtmlImageSrc(productLocal.mediaItems[1].src || productLocal.mediaItems[1].url) 
            : null,
          title: productNameID,
          productId: String(productLocal?._id || clickedProductId || ""),
          brand: String(productLocal?.brand || clickedItem.brand || ""),
          priceTaxIn: String(clickedItem.priceText || ""),
          formattedPrice: String(clickedItem.priceText || ""),
          price: String(clickedItem.priceText || ""),
          type: "image"
        };

      galleryNormalItems = [
        selectedGalleryItem,
        ...galleryNormalItems.filter(item =>
          !(
            (selectedGalleryItem.productId && String(item.productId || "") === String(selectedGalleryItem.productId || "")) ||
            (selectedGalleryItem.title && String(item.title || "").trim() === String(selectedGalleryItem.title || "").trim())
          )
        )
      ];

      const selectedHoverItem = galleryHoverItems.find(item =>
        (selectedGalleryItem.productId && String(item.productId || "") === String(selectedGalleryItem.productId || "")) ||
        (selectedGalleryItem.title && String(item.title || "").trim() === String(selectedGalleryItem.title || "").trim())
      ) || {
        ...selectedGalleryItem,
        src: selectedGalleryItem.hoverImage || selectedGalleryItem.src || selectedGalleryItem.originalImage || "",
        originalImage: selectedGalleryItem.hoverImage || selectedGalleryItem.src || selectedGalleryItem.originalImage || ""
      };

      galleryHoverItems = [
        selectedHoverItem,
        ...galleryHoverItems.filter(item =>
          !(
            (selectedHoverItem.productId && String(item.productId || "") === String(selectedHoverItem.productId || "")) ||
            (selectedHoverItem.title && String(item.title || "").trim() === String(selectedHoverItem.title || "").trim())
          )
        )
      ];

      galleryItems = galleryNormalItems.slice();

      currentBrandText = String(
        productLocal?.brand ||
        selectedGalleryItem.brand ||
        clickedItem.brand ||
        currentBrandText ||
        ""
      );

      const categoryItemLocal = categoriesResult.items.find(
        item => String(item.slug || "").toLowerCase().trim() === String(categoryKey || "").toLowerCase().trim()
      );

      currentProductNoText = categoryItemLocal ? String(categoryItemLocal.description || "") : "";

      const selectedDisplayItem = {
        ...selectedGalleryItem,
        brandText: currentBrandText,
        productNoText: currentProductNoText,
        priceText: selectedGalleryItem.priceText || selectedGalleryItem.priceTaxIn || selectedGalleryItem.formattedPrice || selectedGalleryItem.price || clickedItem.priceText || ""
      };

      pushPCMainImageHtml(galleryNormalItems);

      await collapseIfPossible($w("#G1G2GallerySection"));
      await expandIfPossible($w("#MainSection"));
      await expandIfPossible($w("#desktopsection"));

      if ($w("#MainSection") && typeof $w("#MainSection").scrollTo === "function") {
        await $w("#MainSection").scrollTo();
      }

      updateText({ item: selectedDisplayItem });
      postCatalogTitleFromItem(selectedDisplayItem);
      pushCatalogInfo();

      let salesDataLocal = null;

      const salesTextQueryLocal = await wixData.query("ProductSalesTexts")
        .eq("title", currentItem)
        .find();

      if (salesTextQueryLocal.items.length > 0) {
        salesDataLocal = salesTextQueryLocal.items[0];
      } else {
        const normKeyLocal = String(currentItem || "").trim().toLowerCase();
        const retryLocal = await wixData.query("ProductSalesTexts")
          .contains("title", currentItem)
          .find();

        if (retryLocal.items.length > 0) {
          salesDataLocal = retryLocal.items.find(x => ((x.title || "").trim().toLowerCase() === normKeyLocal)) || null;
        }

        if (!salesDataLocal && retryLocal.items.length > 0) {
          salesDataLocal = retryLocal.items[0];
        }
      }

      if (productLocal) {
        applyPinterestMeta({
          product: productLocal,
          salesData: salesDataLocal,
          currentItem,
          selectedKey
        });
      }

      const selectedInfoItemLocal = await getImport307InfoItemBySlug(currentItem);

      if (!isOpenItemRequestAlive(openItemRequestId)) {
        console.log("[OPENITEM][stale skip] before productInfo", {
          openItemRequestId,
          latest: __openItemRequestId,
          clickedTitle
        });
        return;
      }

      const productInfoPostedLocal = await postProductInfoToHtml(
        salesDataLocal,
        selectedInfoItemLocal,
        () => isOpenItemRequestAlive(openItemRequestId)
      );

      if (salesDataLocal) {
        currentSalesCatchHtml = salesDataLocal.salesCatch || "";
        currentSalesTextsHtml = salesDataLocal.salesTexts || "";

        if (salesDataLocal.salesCatch) {
          $w("#salesCatch").html = salesDataLocal.salesCatch;
        } else {
          $w("#salesCatch").text = "";
        }

        if (productInfoPostedLocal) {
          pushMobileCatalogInfo();
        } else if (isMobile) {
        } else {
        }

        pushMobileCatalogInfo();
      } else {
        currentSalesCatchHtml = "";
        currentSalesTextsHtml = "";
        $w("#salesCatch").text = "";
        pushMobileCatalogInfo();
      }

      setPurchaseResponse('');

      if (!isOpenItemRequestAlive(openItemRequestId)) {
        console.log("[OPENITEM][stale skip] before stock", {
          openItemRequestId,
          latest: __openItemRequestId,
          clickedTitle
        });
        return;
      }

      const cartDataLocal = await getCartSnapshot();

      if (!isOpenItemRequestAlive(openItemRequestId)) {
        console.log("[OPENITEM][stale skip] after cart snapshot", {
          openItemRequestId,
          latest: __openItemRequestId,
          clickedTitle
        });
        return;
      }

      const resLocal = await fetchAndLogVariants(productNameID, cartDataLocal);

      if (!isOpenItemRequestAlive(openItemRequestId)) {
        console.log("[OPENITEM][stale skip] after stock fetch", {
          openItemRequestId,
          latest: __openItemRequestId,
          clickedTitle
        });
        return;
      }

      if (resLocal) {
        await updateDropdownAndStockDisplay(
          productNameID,
          resLocal.tempStock,
          resLocal.productId,
          resLocal.variants,
          cartDataLocal
        );
      } else {
        console.warn("[mainGalleryHtml][openItem] 在庫取得失敗 productNameID =", productNameID);
        showNoStock();
      }

      // ▼画像反映後にセクションを切り替える処理を追加
      await collapseIfPossible($w("#G1G2GallerySection"));
      await expandIfPossible($w("#MainSection"));
      await expandIfPossible($w("#desktopsection"));

      if ($w("#MainSection") && typeof $w("#MainSection").scrollTo === "function") {
        await $w("#MainSection").scrollTo();
      }

      return;
    }

    if (data.type === "openItem") {
      console.log("[mainGalleryHtml][openItem received]", data.item || {});

      await collapseIfPossible($w("#G1G2GallerySection"));
      await expandIfPossible($w("#MainSection"));
      await expandIfPossible($w("#desktopsection"));

      if ($w("#MainSection") && typeof $w("#MainSection").scrollTo === "function") {
        await $w("#MainSection").scrollTo();
      }

      return;
    }

    if (data.type === "openItem") {
      const clickedItem = data.item || {};

      const clickedTitle = String(clickedItem.title || "").trim();
      const clickedProductId = String(clickedItem.productId || "").trim();
      const clickedSlug = String(clickedItem.slug || "").toLowerCase().trim();
      const clickedCategoryKey = String(clickedItem.categoryKey || "").toLowerCase().trim();

      console.log("[mainGalleryHtml][openItem received]", {
        clickedTitle,
        clickedProductId,
        clickedSlug,
        clickedCategoryKey,
        raw: clickedItem
      });

      const openItemRequestId = beginOpenItemRequest(clickedTitle || clickedSlug || clickedProductId);

      if (clickedCategoryKey) {
        categoryKey = clickedCategoryKey;
        currentItem = clickedCategoryKey;
      }

      let productResultLocal = null;
      let productLocal = null;

      try {
        if (clickedProductId) {
          productResultLocal = await wixData.query("Stores/Products")
            .eq("_id", clickedProductId)
            .limit(1)
            .find();
        }

        if ((!productResultLocal || productResultLocal.items.length === 0) && clickedSlug) {
          productResultLocal = await wixData.query("Stores/Products")
            .eq("slug", clickedSlug)
            .limit(1)
            .find();
        }

        if ((!productResultLocal || productResultLocal.items.length === 0) && clickedTitle) {
          productResultLocal = await wixData.query("Stores/Products")
            .eq("name", clickedTitle)
            .limit(1)
            .find();
        }

        productLocal = productResultLocal?.items?.[0] || null;
      } catch (e) {
        console.error("[mainGalleryHtml][openItem] Stores/Products 取得失敗", e);
      }

      if (!isOpenItemRequestAlive(openItemRequestId)) {
        console.log("[OPENITEM][stale skip] after product query", {
          openItemRequestId,
          latest: __openItemRequestId,
          clickedTitle
        });
        return;
      }

      if (productLocal) {
          productNameID = String(productLocal.name || clickedTitle || "");
        selectedKey = extractSelectedKeyFromSlug(productLocal.slug);
        itemSlug = String(productLocal.slug || "");
        await updateCurrentBrandLogoUrl(productLocal.brand);

        if (!isOpenItemRequestAlive(openItemRequestId)) {
          console.log("[OPENITEM][stale skip] after brand logo", {
            openItemRequestId,
            latest: __openItemRequestId,
            clickedTitle
          });
          return;
        }
      } else {

        productNameID = clickedTitle;

        if (clickedSlug) {
          selectedKey = extractSelectedKeyFromSlug(clickedSlug);
          itemSlug = clickedSlug;
        }
      }

      if (!productNameID) {
        console.warn("[mainGalleryHtml][openItem] productNameID が空です", {
          clickedItem,
          productLocal
        });
        return;
      }

      const selectedGalleryItem =
        galleryNormalItems.find(item =>
          (clickedProductId && String(item.productId || "") === clickedProductId) ||
          (clickedSlug && String(item.slug || "").toLowerCase().trim() === clickedSlug) ||
          (clickedTitle && String(item.title || "").trim() === clickedTitle)
        ) || {
          src: toHtmlImageSrc(productLocal?.mainMedia) || String(clickedItem.image || ""),
          originalImage: toHtmlImageSrc(productLocal?.mainMedia) || String(clickedItem.image || ""),
          hoverImage: null,
          title: productNameID,
          productId: String(productLocal?._id || clickedProductId || ""),
          brand: String(productLocal?.brand || clickedItem.brand || ""),
          slug: String(productLocal?.slug || clickedSlug || ""),
          priceTaxIn: String(clickedItem.priceText || ""),
          formattedPrice: String(clickedItem.priceText || ""),
          price: String(clickedItem.priceText || ""),
          type: "image"
        };

      galleryNormalItems = [
        selectedGalleryItem,
        ...galleryNormalItems.filter(item =>
          !(
            (selectedGalleryItem.productId && String(item.productId || "") === String(selectedGalleryItem.productId || "")) ||
            (selectedGalleryItem.slug && String(item.slug || "").toLowerCase().trim() === String(selectedGalleryItem.slug || "").toLowerCase().trim()) ||
            (selectedGalleryItem.title && String(item.title || "").trim() === String(selectedGalleryItem.title || "").trim())
          )
        )
      ];

      // ▼ ★ 2枚目の画像のリストには、間違えて1枚目を入れずに、ちゃんと2枚目（hover用）を探して入れる！
      const selectedHoverItem = galleryHoverItems.find(item =>
          (clickedProductId && String(item.productId || "") === clickedProductId) ||
          (clickedSlug && String(item.slug || "").toLowerCase().trim() === clickedSlug) ||
          (clickedTitle && String(item.title || "").trim() === clickedTitle)
      ) || selectedGalleryItem;

      galleryHoverItems = [
        selectedHoverItem,
        ...galleryHoverItems.filter(item =>
          !(
            (selectedHoverItem.productId && String(item.productId || "") === String(selectedHoverItem.productId || "")) ||
            (selectedHoverItem.slug && String(item.slug || "").toLowerCase().trim() === String(selectedHoverItem.slug || "").toLowerCase().trim()) ||
            (selectedHoverItem.title && String(item.title || "").trim() === String(selectedHoverItem.title || "").trim())
          )
        )
      ];

      galleryItems = galleryNormalItems.slice();

      currentBrandText = String(
        productLocal?.brand ||
        selectedGalleryItem.brand ||
        clickedItem.brand ||
        currentBrandText ||
        ""
      );

      const categoryItemLocal = categoriesResult.items.find(
        item => String(item.slug || "").toLowerCase().trim() === String(categoryKey || "").toLowerCase().trim()
      );

      currentProductNoText = categoryItemLocal ? String(categoryItemLocal.description || "") : "";

      const selectedDisplayItem = {
        ...selectedGalleryItem,
        brandText: currentBrandText,
        productNoText: currentProductNoText,
        priceText: selectedGalleryItem.priceText || selectedGalleryItem.priceTaxIn || selectedGalleryItem.formattedPrice || selectedGalleryItem.price || clickedItem.priceText || ""
      };

      if ($w("#MainImageHtml") && typeof $w("#MainImageHtml").postMessage === "function") {
        $w("#MainImageHtml").postMessage({
          type: "setGalleryItems",
          items: galleryNormalItems
        });
      }

      updateText({ item: selectedDisplayItem });
      postCatalogTitleFromItem(selectedDisplayItem);
      pushCatalogInfo();

      let salesDataLocal = null;

      const salesTextQueryLocal = await wixData.query("ProductSalesTexts")
        .eq("title", currentItem)
        .find();

      if (salesTextQueryLocal.items.length > 0) {
        salesDataLocal = salesTextQueryLocal.items[0];
      } else {
        const normKeyLocal = String(currentItem || "").trim().toLowerCase();
        const retryLocal = await wixData.query("ProductSalesTexts")
          .contains("title", currentItem)
          .find();

        if (retryLocal.items.length > 0) {
          salesDataLocal = retryLocal.items.find(x => ((x.title || "").trim().toLowerCase() === normKeyLocal)) || null;
        }

        if (!salesDataLocal && retryLocal.items.length > 0) {
          salesDataLocal = retryLocal.items[0];
        }
      }

      if (productLocal) {
        applyPinterestMeta({
          product: productLocal,
          salesData: salesDataLocal,
          currentItem,
          selectedKey
        });
      }

      const selectedInfoItemLocal = await getImport307InfoItemBySlug(currentItem);
      const productInfoPostedLocal = await postProductInfoToHtml(salesDataLocal, selectedInfoItemLocal);

      if (salesDataLocal) {
        currentSalesCatchHtml = salesDataLocal.salesCatch || "";
        currentSalesTextsHtml = salesDataLocal.salesTexts || "";

        if (salesDataLocal.salesCatch) {
          $w("#salesCatch").html = salesDataLocal.salesCatch;
        } else {
          $w("#salesCatch").text = "";
        }

        if (productInfoPostedLocal) {
          pushMobileCatalogInfo();
        } else if (isMobile) {
        } else {
        }

        pushMobileCatalogInfo();
      } else {
        currentSalesCatchHtml = "";
        currentSalesTextsHtml = "";
        $w("#salesCatch").text = "";
        pushMobileCatalogInfo();
      }

      setPurchaseResponse('');

      const cartDataLocal = await getCartSnapshot();
      const resLocal = await fetchAndLogVariants(productNameID, cartDataLocal);

      if (resLocal) {
        await updateDropdownAndStockDisplay(
          productNameID,
          resLocal.tempStock,
          resLocal.productId,
          resLocal.variants,
          cartDataLocal
        );
      } else {
        console.warn("[mainGalleryHtml][openItem] 在庫取得失敗 productNameID =", productNameID);
        showNoStock();
      }

      await collapseIfPossible($w("#G1G2GallerySection"));
      await expandIfPossible($w("#MainSection"));
      await expandIfPossible($w("#desktopsection"));

      if ($w("#MainSection") && typeof $w("#MainSection").scrollTo === "function") {
        await $w("#MainSection").scrollTo();
      }

      return;
    }

    if (data.type === "openItem") {
      const clickedItem = data.item || {};

      const clickedTitle = String(clickedItem.title || "").trim();
      const clickedProductId = String(clickedItem.productId || "").trim();
      const clickedBrand = String(clickedItem.brand || "").trim();
      const clickedCategoryKey = String(clickedItem.categoryKey || "").toLowerCase().trim();
      const clickedPriceText = String(clickedItem.priceText || "").trim();
      const clickedImage = String(clickedItem.image || "").trim();

      console.log("[mainGalleryHtml][openItem received]", {
        clickedTitle,
        clickedProductId,
        clickedBrand,
        clickedCategoryKey,
        clickedPriceText,
        clickedImage,
        raw: clickedItem
      });

      if (!clickedTitle && !clickedProductId) {
        console.warn("[mainGalleryHtml][openItem] 商品特定情報が空です", clickedItem);
        return;
      }

      if (clickedCategoryKey) {
        categoryKey = clickedCategoryKey;
        currentItem = clickedCategoryKey;
      }

      const selectedGalleryItem =
        galleryNormalItems.find(item =>
          (clickedProductId && String(item.productId || "") === clickedProductId) ||
          (clickedTitle && String(item.title || "").trim() === clickedTitle)
        ) || {
          src: clickedImage,
          originalImage: clickedImage,
          hoverImage: null,
          title: clickedTitle,
          productId: clickedProductId,
          brand: clickedBrand,
          priceTaxIn: clickedPriceText,
          formattedPrice: clickedPriceText,
          price: clickedPriceText,
          type: "image"
        };

      productNameID = String(selectedGalleryItem.title || clickedTitle || "");

      currentBrandText = String(
        selectedGalleryItem.brand ||
        clickedBrand ||
        currentBrandText ||
        ""
      );

      const categoryItemLocal = categoriesResult.items.find(
        item => String(item.slug || "").toLowerCase().trim() === String(categoryKey || "").toLowerCase().trim()
      );

      currentProductNoText = categoryItemLocal ? String(categoryItemLocal.description || "") : "";

      galleryNormalItems = [
        selectedGalleryItem,
        ...galleryNormalItems.filter(item =>
          !(
            (selectedGalleryItem.productId && String(item.productId || "") === String(selectedGalleryItem.productId || "")) ||
            (selectedGalleryItem.title && String(item.title || "").trim() === String(selectedGalleryItem.title || "").trim())
          )
        )
      ];

      galleryHoverItems = [
        selectedGalleryItem,
        ...galleryHoverItems.filter(item =>
          !(
            (selectedGalleryItem.productId && String(item.productId || "") === String(selectedGalleryItem.productId || "")) ||
            (selectedGalleryItem.title && String(item.title || "").trim() === String(selectedGalleryItem.title || "").trim())
          )
        )
      ];

      galleryItems = galleryNormalItems.slice();

      const selectedDisplayItem = {
        ...selectedGalleryItem,
        brandText: currentBrandText,
        productNoText: currentProductNoText,
        priceText: selectedGalleryItem.priceText || selectedGalleryItem.priceTaxIn || selectedGalleryItem.formattedPrice || selectedGalleryItem.price || clickedPriceText || ""
      };

      if ($w("#MainImageHtml") && typeof $w("#MainImageHtml").postMessage === "function") {
        $w("#MainImageHtml").postMessage({
          type: "setGalleryItems",
          items: galleryNormalItems
        });
      }

      updateText({ item: selectedDisplayItem });
      postCatalogTitleFromItem(selectedDisplayItem);
      pushCatalogInfo();

      setPurchaseResponse('');

      const cartDataLocal = await getCartSnapshot();
      const resLocal = await fetchAndLogVariants(productNameID, cartDataLocal);

      if (resLocal) {
        await updateDropdownAndStockDisplay(
          productNameID,
          resLocal.tempStock,
          resLocal.productId,
          resLocal.variants,
          cartDataLocal
        );
      } else {
        console.warn("[mainGalleryHtml][openItem] 在庫取得失敗 productNameID =", productNameID);
        showNoStock();
      }

      await collapseIfPossible($w("#G1G2GallerySection"));
      await expandIfPossible($w("#MainSection"));
      await expandIfPossible($w("#desktopsection"));

      if ($w("#MainSection") && typeof $w("#MainSection").scrollTo === "function") {
        await $w("#MainSection").scrollTo();
      }

      return;
    }

    if (data.type === "openItem") {
      const clickedItem = data.item || {};

      const clickedTitle = String(clickedItem.title || "").trim();
      const clickedProductId = String(clickedItem.productId || "").trim();
      const clickedBrand = String(clickedItem.brand || "").trim();
      const clickedCategoryKey = String(clickedItem.categoryKey || "").toLowerCase().trim();
      const clickedPriceText = String(clickedItem.priceText || "").trim();
      const clickedImage = String(clickedItem.image || "").trim();

      console.log("[mainGalleryHtml][openItem received]", {
        clickedTitle,
        clickedProductId,
        clickedBrand,
        clickedCategoryKey,
        clickedPriceText,
        clickedImage,
        raw: clickedItem
      });

      if (!clickedTitle && !clickedProductId) {
        console.warn("[mainGalleryHtml][openItem] 商品特定情報が空です", clickedItem);
        return;
      }

      if (clickedCategoryKey) {
        categoryKey = clickedCategoryKey;
        currentItem = clickedCategoryKey;
      }

      const selectedGalleryItem =
        galleryNormalItems.find(item =>
          (clickedProductId && String(item.productId || "") === clickedProductId) ||
          (clickedTitle && String(item.title || "").trim() === clickedTitle)
        ) || {
          src: clickedImage,
          originalImage: clickedImage,
          hoverImage: null,
          title: clickedTitle,
          productId: clickedProductId,
          brand: clickedBrand,
          priceTaxIn: clickedPriceText,
          formattedPrice: clickedPriceText,
          price: clickedPriceText,
          type: "image"
        };

      productNameID = String(selectedGalleryItem.title || clickedTitle || "");

      currentBrandText = String(
        selectedGalleryItem.brand ||
        clickedBrand ||
        currentBrandText ||
        ""
      );

      const categoryItemLocal = categoriesResult.items.find(
        item => String(item.slug || "").toLowerCase().trim() === String(categoryKey || "").toLowerCase().trim()
      );

      currentProductNoText = categoryItemLocal ? String(categoryItemLocal.description || "") : "";

      galleryNormalItems = [
        selectedGalleryItem,
        ...galleryNormalItems.filter(item =>
          !(
            (selectedGalleryItem.productId && String(item.productId || "") === String(selectedGalleryItem.productId || "")) ||
            (selectedGalleryItem.title && String(item.title || "").trim() === String(selectedGalleryItem.title || "").trim())
          )
        )
      ];

      galleryHoverItems = [
        selectedGalleryItem,
        ...galleryHoverItems.filter(item =>
          !(
            (selectedGalleryItem.productId && String(item.productId || "") === String(selectedGalleryItem.productId || "")) ||
            (selectedGalleryItem.title && String(item.title || "").trim() === String(selectedGalleryItem.title || "").trim())
          )
        )
      ];

      galleryItems = galleryNormalItems.slice();

      const selectedDisplayItem = {
        ...selectedGalleryItem,
        brandText: currentBrandText,
        productNoText: currentProductNoText,
        priceText: selectedGalleryItem.priceText || selectedGalleryItem.priceTaxIn || selectedGalleryItem.formattedPrice || selectedGalleryItem.price || clickedPriceText || ""
      };

      if ($w("#MainImageHtml") && typeof $w("#MainImageHtml").postMessage === "function") {
        $w("#MainImageHtml").postMessage({
          type: "setGalleryItems",
          items: galleryNormalItems
        });
      }

      updateText({ item: selectedDisplayItem });
      postCatalogTitleFromItem(selectedDisplayItem);
      pushCatalogInfo();

      setPurchaseResponse('');

      const cartDataLocal = await getCartSnapshot();
      const resLocal = await fetchAndLogVariants(productNameID, cartDataLocal);

      if (resLocal) {
        await updateDropdownAndStockDisplay(
          productNameID,
          resLocal.tempStock,
          resLocal.productId,
          resLocal.variants,
          cartDataLocal
        );
      } else {
        console.warn("[mainGalleryHtml][openItem] 在庫取得失敗 productNameID =", productNameID);
        showNoStock();
      }

      await collapseIfPossible($w("#G1G2GallerySection"));
      await expandIfPossible($w("#MainSection"));
      await expandIfPossible($w("#desktopsection"));

      if ($w("#MainSection") && typeof $w("#MainSection").scrollTo === "function") {
        await $w("#MainSection").scrollTo();
      }

      return;
    }

    if (data.type === "openItem") {
      await collapseIfPossible($w("#G1G2GallerySection"));
      return;
    }

    if (data.type === "openItem") {
      await $w("#G1G2GallerySection").collapse();
      return;
    }

    if (data.type !== "mobileImageChanged") return;

    const item = data.item || {};
    productNameID = String(item.title || "");
    currentBrandText = String(item.brandText || "");
    currentProductNoText = String(item.productNoText || "");
    currentColorHtml = String(item.colorHtml || "");

    pushCatalogInfo();
    updateText({ item });
    postCatalogTitleFromItem(item);

    getCartSnapshot()
      .then((cartData) => fetchAndLogVariants(productNameID, cartData).then((res) => ({ cartData, res })))
      .then(({ cartData, res }) => {
        if (!res) return;
        updateDropdownAndStockDisplay(productNameID, res.tempStock, res.productId, res.variants, cartData);
      })
      .catch((error) => {
        console.error('バリアント情報の取得中にエラーが発生しました:', error);
      });
  });
}

  // ▼ ギャラリーの hover（PC/タブレットのみ有効。モバイルはホバー無し）
  if (!isMobile) {
  }

  // ▼ 全デバイス共通：#viewChange ボタンで 1枚目/2枚目 切替
  safeOnClick($w("#viewChange"), toggleMobileGallery, "#viewChange");
  await expandIfPossible($w("#viewChange"));

await expandIfPossible($w("#section2"));

  // ▼ メニューは全デバイスでイベントだけ登録（表示は open/close が制御）


const mobileBrandBoxHtml = $w("#mobileBrandBoxHtml");

if (isMobile && mobileBrandBoxHtml && typeof mobileBrandBoxHtml.onMessage === "function") {
  mobileBrandBoxHtml.onMessage(async (event) => {
    const data = event?.data || {};
    const type = String(data.type || "").trim();

    if (type === "ready") {
      mobileBrandBoxHtml.postMessage({
        type: "setMobileMenuState",
        open: menuOpen
      });
      return;
    }

    if (type === "toggleMobileMenu") {
      if (menuOpen) {
        await closeMobileMenu();
      } else {
        await openMobileMenu();
      }
      return;
    }
  });

  console.log("✅ #mobilemainGalleryHtml mobileBrandBox onMessage 設定完了");
} else if (isMobile) {
  console.warn("⚠️ #mobilemainGalleryHtml が見つからないか、onMessage 非対応です。");
}



// ✅ URLクエリパラメータを取得
let categoryKey = String(wixLocation.query.category || "").trim();
let selectedKey = String(wixLocation.query.selected || "").trim();
let brandKey    = isForceHelmettyMode()
  ? FORCE_G1G2_BRAND_KEY
  : getQueryValueWithPreviewFallback("brand", PREVIEW_SHOP_FALLBACK.brand);

  const __hasSelectedParam = (typeof wixLocation.query.selected === "string") && (wixLocation.query.selected.trim() !== "");

const allValue = isForceHelmettyMode()
  ? FORCE_G1G2_ALL_VALUE
  : ((String(getQueryValueWithPreviewFallback("all", PREVIEW_SHOP_FALLBACK.all) || "").toLowerCase() === "true") ? "true" : "false");

// ▼ 追加：categoryNameText / 件数計算 用のショップ判定キー
const shopKey = isForceHelmettyMode()
  ? FORCE_G1G2_SHOP_KEY
  : (getQueryValueWithPreviewFallback("shop", PREVIEW_SHOP_FALLBACK.shop) || String(brandKey || "").trim());

// ▼ BrandSettings.brandPrefix を唯一のprefixとして使用
const brandSettingsRes = await wixData.query("BrandSettings").eq("brand", shopKey).limit(1).find();
const brandSettingsItem = brandSettingsRes.items?.[0] || {};
const shopPrefixFromBrandSettings = String(brandSettingsItem.brandPrefix || "").trim().toLowerCase();
currentG1G2CategoryPrefix = shopPrefixFromBrandSettings;
currentBrandLogoUrl = toHtmlImageSrc(brandSettingsItem.brandLogo);

const brandSelectSettingsRes = await wixData.query("BrandSettings")
  .eq("parentsBrand", shopKey)
  .ascending("brand")
  .find();

currentG1G2BrandSelectBrands = (brandSelectSettingsRes.items || [])
  .map((item) => {
    const brandName = String(item.brand || "").trim();
    const logoUrl = toHtmlImageSrc(item.brandLogo);

    return {
      key: brandName,
      name: brandName,
      itemCount: 0,
      logoSvg: logoUrl
        ? `<img src="${logoUrl}" alt="${brandName}" style="width:100%;height:100%;object-fit:contain;display:block;">`
        : ""
    };
  })
  .filter((item) => item.key);

categoryKey = normalizeCategoryKeyByPrefix(categoryKey, shopPrefixFromBrandSettings);

const isBrandMatagi = (allValue === "true");

// ▼ 強制 HELMETTY モードでは、URLに category が無い初期表示でも BrandSettings.brandPrefix + 001 を開く
if (isForceHelmettyMode() && !categoryKey) {
  categoryKey = normalizeCategoryKeyByPrefix("001", shopPrefixFromBrandSettings);
}

currentG1G2BrandKey = String(brandKey || "").trim();
currentG1G2ShopKey = String(shopKey || "").trim();
currentG1G2AllValue = String(allValue || "false").trim();
currentG1G2HideBrandSelect = !(String(shopKey || "").trim().toUpperCase() === "HATODAIYA" && currentG1G2BrandSelectBrands.length > 1);

console.log("[G1G2-FORCE][HELMETTY MODE]", {
  force: isForceHelmettyMode(),
  categoryKey,
  selectedKey,
  brandKey,
  shopKey,
  allValue,
  prefix: currentG1G2CategoryPrefix
});

console.log("[G1G2-STATE][resolved-before-initial-push]", {
  currentG1G2BrandKey,
  currentG1G2ShopKey,
  currentG1G2AllValue,
  currentG1G2HideBrandSelect
});

if (!isMobile && String(shopKey || "").trim().toUpperCase() === "HELMETTY") {
  try {
    console.log("[PcBrandBoxHtml][HELMETTY] condition hit", {
      isMobile,
      shopKey,
      shopPrefixFromBrandSettings
    });

    currentPcBrandBoxHtml = await getHelmettyBrandBoxHtml({
      brand: shopKey,
      brandPrefix: shopPrefixFromBrandSettings
    });

    console.log("[PcBrandBoxHtml][HELMETTY] html loaded", {
      length: String(currentPcBrandBoxHtml || "").length,
      startsWith: String(currentPcBrandBoxHtml || "").slice(0, 80)
    });

    if (currentPcBrandBoxHtml && $w("#mainGalleryHtml") && typeof $w("#mainGalleryHtml").postMessage === "function") {
      console.log("[PcBrandBoxHtml][HELMETTY] postMessage send", {
        type: "setBrandBoxHtml"
      });

      $w("#mainGalleryHtml").postMessage({
        channel: "mainGallery",
        type: "setBrandBoxHtml",
        html: currentPcBrandBoxHtml
      });
    } else {
      console.warn("[PcBrandBoxHtml][HELMETTY] postMessage skipped", {
        hasHtml: !!currentPcBrandBoxHtml,
        hasMainGalleryHtml: !!$w("#mainGalleryHtml"),
        hasPostMessage: !!($w("#mainGalleryHtml") && typeof $w("#mainGalleryHtml").postMessage === "function")
      });
    }
  } catch (e) {
    console.error("[PcBrandBoxHtml][HELMETTY] backend html load failed", e);
  }
}

const initialItemSlug = `${categoryKey}-${selectedKey}`;

// ▼ 追加：初期表示用データを backend から取得
const initialPageDataPromise = getInitialPageData(categoryKey, brandKey, shopKey, allValue);

if (__hasSelectedParam && initialItemSlug !== "-") {
  try {
    const initialMainImageResult = await wixData.query("Stores/Products")
      .eq("slug", initialItemSlug)
      .limit(1)
      .find();

    if (initialMainImageResult.items.length > 0) {
      const initialProduct = initialMainImageResult.items[0];
      const initialMainImageItem = buildGalleryItemFromStoreProduct(initialProduct);

      const initialHoverImage = initialProduct.mediaItems && initialProduct.mediaItems.length > 1
        ? toHtmlImageSrc(initialProduct.mediaItems[1].src || initialProduct.mediaItems[1].url)
        : initialMainImageItem.hoverImage;

      initialMainImageItem.hoverImage = initialMainImageItem.hoverImage || initialHoverImage;

      galleryNormalItems = [initialMainImageItem];
      galleryHoverItems = [initialMainImageItem];
      galleryItems = [initialMainImageItem];

      if (isMobile) {
        pushMobileMainImages(galleryNormalItems);
      } else {
        pushMainImages(galleryNormalItems);
      }
    }
  } catch (e) {
    console.error("初期メイン画像の先出し失敗:", e);
  }
}

  console.log("🔎 URLから取得した category:", categoryKey);
  console.log("🔎 URLから取得した selected:", selectedKey);
  console.log("🔎 URLから取得した brand:", brandKey);
  console.log("🔎 URLから取得した shop:", shopKey);
  console.log("🔎 URLから取得した all:", allValue);

  console.log("[G1G2-STATE][resolved]", {
    currentG1G2BrandKey,
    currentG1G2ShopKey,
    currentG1G2AllValue,
    currentG1G2HideBrandSelect
  });

  console.log("[G1G2-DEBUG][preview-fallback]", {
    viewMode: wixWindow.viewMode,
    rawQuery: wixLocation.query,
    categoryKey,
    selectedKey,
    brandKey,
    shopKey,
    allValue,
    isPreviewFallbackBrand: !String(wixLocation.query.brand || "").trim() && wixWindow.viewMode === "Preview",
    isPreviewFallbackShop: !String(wixLocation.query.shop || "").trim() && wixWindow.viewMode === "Preview",
    isPreviewFallbackAll: !String(wixLocation.query.all || "").trim() && wixWindow.viewMode === "Preview"
  });

 // ✅ 追加：HTML（#categoryThumbnailMenu）からのクリック通知を受信（既存Repeaterは残す）
// 対象ファイル名：ページコード
console.log("[G1G2-DEBUG][categoryThumbnailMenu-element]", {
  exists: !!$w("#categoryThumbnailMenu"),
  hasOnMessage: !!($w("#categoryThumbnailMenu") && typeof $w("#categoryThumbnailMenu").onMessage === "function"),
  hasPostMessage: !!($w("#categoryThumbnailMenu") && typeof $w("#categoryThumbnailMenu").postMessage === "function")
});

 if ($w("#categoryThumbnailMenu") && typeof $w("#categoryThumbnailMenu").onMessage === "function") {
   $w("#categoryThumbnailMenu").onMessage(async (event) => {
     const data = event?.data;
     if (!data || typeof data !== "object") return;
if (data.type === "backToMainButton") {
  return;
}
     if (data.type !== "categoryClick") return;

     invalidateOpenItemRequests("categoryClick");

     // ▼ データの読み込み・G2の更新が完了するのを待つ
     const categoryGalleryState = await loadCategoryGalleryFromPayload(data.payload || {});
      if (!categoryGalleryState) return;

     // ▼ 更新が完了してから、詳細画面を閉じてG1/G2ギャラリーセクションをパッと表示する（チラつき防止）
     await collapseIfPossible($w("#MainSection"));

     if (isMobile) {
       await openMobileG1G2Screen();
     } else {
       await expandIfPossible($w("#G1G2GallerySection"));

       if ($w("#anchor1") && typeof $w("#anchor1").scrollTo === "function") {
         await $w("#anchor1").scrollTo();
       }
     }

const { matchedItemsLocal, queryResultsLocalPromise, brandLogoUpdatePromise } = categoryGalleryState;
      let salesDataLocal = null;

      const salesTextQueryLocal = await wixData.query("ProductSalesTexts").eq("title", currentItem).find();

      if (salesTextQueryLocal.items.length > 0) {
        salesDataLocal = salesTextQueryLocal.items[0];
      } else {
        const normKeyLocal = String(currentItem || "").trim().toLowerCase();
        const retryLocal = await wixData.query("ProductSalesTexts")
          .contains("title", currentItem)
          .find();

        if (retryLocal.items.length > 0) {
          salesDataLocal = retryLocal.items.find(x => ((x.title || "").trim().toLowerCase() === normKeyLocal)) || null;
        }
        if (!salesDataLocal && retryLocal.items.length > 0) {
          salesDataLocal = retryLocal.items[0];
        }
      }

const queryResultsLocal = queryResultsLocalPromise
  ? await queryResultsLocalPromise
  : { items: [] };

if (queryResultsLocal.items.length > 0) {
  const product = queryResultsLocal.items[0];



  if (product.price) {
    let originalPrice = product.price;
    let finalPrice = Math.floor(originalPrice * 1.1);
  } else {
  }

  applyPinterestMeta({
    product,
    salesData: salesDataLocal,
    currentItem,
    selectedKey
  });
}
if (brandLogoUpdatePromise) {
  await brandLogoUpdatePromise;
}

const selectedInfoItemLocal = await getImport307InfoItemBySlug(currentItem);
const productInfoPostedLocal = await postProductInfoToHtml(salesDataLocal, selectedInfoItemLocal);

if (salesDataLocal) {
  currentSalesCatchHtml = salesDataLocal.salesCatch || "";
  currentSalesTextsHtml = salesDataLocal.salesTexts || "";

  if (salesDataLocal.salesCatch) {
    $w("#salesCatch").html = salesDataLocal.salesCatch;
  } else {
    $w("#salesCatch").text = "";
  }

  if (productInfoPostedLocal) {
    pushMobileCatalogInfo();
  } else if (isMobile) {
  } else {
  }

  pushMobileCatalogInfo();
} else {
  currentSalesCatchHtml = "";
  currentSalesTextsHtml = "";
  $w("#salesCatch").text = "";
  pushMobileCatalogInfo();
}
const categoryItemLocal = categoriesResult.items.find(
  item => String(item.slug || "").toLowerCase().trim() === String(categoryKey || "").toLowerCase().trim()
);
const productNoTextLocal = categoryItemLocal ? categoryItemLocal.description : "";
currentProductNoText = productNoTextLocal;

if (galleryNormalItems.length > 0) {
  updateText({ item: galleryNormalItems[0] });

  console.log("選択商品brand", galleryNormalItems[0]?.brand);
  console.log("選択商品brandText", galleryNormalItems[0]?.brandText);

  const selectedBrandText = String(
    galleryNormalItems[0]?.brand ||
    galleryNormalItems[0]?.brandText ||
    currentBrandText ||
    ""
  );

  console.log("selectedBrandText", selectedBrandText);

  currentBrandText = selectedBrandText;

  if (isMobile) {
    pushMobileMainImages(galleryNormalItems);

    const mobileTitlePayload = {
      ...galleryNormalItems[0],
      brandText: selectedBrandText,
      productNoText: currentProductNoText,
      priceText: galleryNormalItems[0].priceTaxIn || galleryNormalItems[0].formattedPrice || galleryNormalItems[0].price || ""
    };

    console.log("[SEND-BEFORE][MobileCatalogTitleHtml] galleryNormalItems[0] =", galleryNormalItems[0]);
    console.log("[SEND-BEFORE][MobileCatalogTitleHtml] mobileTitlePayload =", mobileTitlePayload);
    console.log("モバイル送信brandText", mobileTitlePayload.brandText);

    postMobileCatalogTitleFromItem(mobileTitlePayload);
    pushMobileCatalogInfo();
  } else {
    postCatalogTitleFromItem({
      ...galleryNormalItems[0],
      brandText: selectedBrandText,
      productNoText: currentProductNoText,
      priceText: galleryNormalItems[0].priceTaxIn || galleryNormalItems[0].formattedPrice || galleryNormalItems[0].price || ""
    });
  }
} else {
  showNoStock();
  pushCatalogInfo();
  pushMobileCatalogInfo();
}


pushCatalogInfo();
if (isMobile) {
  await openMobileCombinedScreen();
}
      // ▼ G1に強制的に戻ってしまう原因だった全体の再構築処理を削除し、メニューのアクティブ状態だけを更新
      if ($w("#categoryThumbnailMenu") && typeof $w("#categoryThumbnailMenu").postMessage === "function") {
        $w("#categoryThumbnailMenu").postMessage({ type: "setActiveCategory", categoryKey: categoryKey });
      }

      if (isMobile && menuOpen) {
        await closeMobileMenu();
        console.log("📂 メニュー閉じ（カテゴリ選択）");
      }

      if (galleryNormalItems.length > 0) {
        const firstItem = galleryNormalItems[0];
        productNameID = firstItem.title;

        const lastSpaceIndex = productNameID.lastIndexOf(' ');
        const extractedText = productNameID.substring(lastSpaceIndex + 1);
                setPurchaseResponse('');

        console.log("[CAT-CLICK] currentItem =", currentItem);
        console.log("[CAT-CLICK] categoryKey =", categoryKey);
        console.log("[CAT-CLICK] selectedKey =", selectedKey);
        console.log("[CAT-CLICK] itemSlug =", itemSlug);
        console.log("[CAT-CLICK] firstItem =", firstItem);
        console.log("[CAT-CLICK] productNameID =", productNameID);

        const cartDataLocal = await getCartSnapshot();
        const resLocal = await fetchAndLogVariants(productNameID, cartDataLocal);

        console.log("[CAT-CLICK] fetchAndLogVariants result =", resLocal);

        if (resLocal) {
          await updateDropdownAndStockDisplay(
            productNameID,
            resLocal.tempStock,
            resLocal.productId,
            resLocal.variants,
            cartDataLocal
          );
        } else {
          console.warn("[CAT-CLICK] 在庫取得失敗 productNameID =", productNameID);
          showNoStock();
        }
      } else {
        console.warn("[CAT-CLICK] galleryNormalItems が0件です");
        showNoStock();
      }
    });
    console.log("✅ #categoryThumbnailMenu onMessage 設定完了");
  } else {
    console.warn("⚠️ #categoryThumbnailMenu が見つからないか、onMessage 非対応です。");
  }

// ▼ BrandSettings は上部で取得済み
console.log("[BrandSettings] brandSettingsItem =", brandSettingsItem);
console.log("[BrandSettings] brandLogo raw =", brandSettingsItem.brandLogo);
console.log("[BrandSettings] currentBrandLogoUrl =", currentBrandLogoUrl);

console.log("[G1G2-DEBUG][brand-settings]", {
  shopKey,
  brandKey,
  brandSettingsItem,
  shopPrefixFromBrandSettings,
  brandLogoRaw: brandSettingsItem.brandLogo,
  currentBrandLogoUrl
});

const cfg = BRAND_CONFIG[brandKey];
currentBrandText = String(
  BRAND_CONFIG[String(brandKey || "").trim()]?.mbBrandText ||
  brandKey ||
  shopKey ||
  ""
);
if (cfg) {
  // backボタン（2個）※スタイルだけ
  applyStyleIfPossible("#back-A-Button", s => {
    s.backgroundColor = cfg.backBtn.backgroundColor;
    s.color = cfg.backBtn.color;
    s.borderColor = cfg.backBtn.borderColor;
    s.borderWidth = cfg.backBtn.borderWidth;
  });

  // モバイルメニュー外枠と開くボタン

  applyStyleIfPossible("#mobileMenuOpen", s => {
    s.backgroundColor = cfg.mobileMenu.open.backgroundColor;
    s.color = cfg.mobileMenu.open.color;
    s.borderColor = cfg.mobileMenu.open.borderColor;
    s.borderWidth = cfg.mobileMenu.open.borderWidth;
  });

  const mobileMainGalleryHtmlForMenu = $w("#mobilemainGalleryHtml");
  if (mobileMainGalleryHtmlForMenu && typeof mobileMainGalleryHtmlForMenu.postMessage === "function") {
    mobileMainGalleryHtmlForMenu.postMessage({
      type: "setMenuData",
      payload: {
        brandText: cfg.mbBrandText || "",
        topUrl: cfg.topUrl || "",
        instagramUrl: cfg.instagramUrl || "",
        contactUrl: "https://www.hatodaiya.com/contact",
        linkshopUrl: "https://www.hatodaiya.com/onlinestore-top"
      }
    });
  }
}

// ▼ 戻るボタン遷移（cfgの有無に関係なく必ず登録）
const goBackToG1 = async () => {
  invalidateOpenItemRequests("goBackToG1");

  if (isMobile) {
    await openMobileG1G2Screen();
  } else {
    await collapseIfPossible($w("#MainSection"));
    await collapseIfPossible($w("#desktopsection"));
    await expandIfPossible($w("#G1G2GallerySection"));
  }

  // ▼ カテゴリ選択状態をリセットし、G1の初期データ（カテゴリ一覧）をギャラリーに再送信して強制的にG1に戻す
  categoryKey = "";
  currentItem = "";
  await postCategoryThumbnailMenu("");

  return;
};

safeOnClick($w("#back-A-Button"), goBackToG1, "#back-A-Button");

let currentItem = categoryKey;
let itemSlug = "";
let targetTitle = "";

async function loadCategoryGalleryFromPayload(payload = {}) {
  const slug = String(payload.slug || "").toLowerCase().trim();
  if (!slug) return null;

  categoryKey = slug;
  currentItem = categoryKey;

  const productsForG2Result = await getAllProductsForCount();
  const matchedItemsLocal = filterProductsByCategoryKey(productsForG2Result.items || [], categoryKey)
    .map((product) => {
      const firstImage = product.mediaItems && product.mediaItems.length > 0
        ? toHtmlImageSrc(product.mediaItems[0].src || product.mediaItems[0].url)
        : "";
      const src = firstImage;
      const taxInPrice = Math.floor(Number(product.price || 0) * 1.1);

      // ▼ 2枚目の画像があれば取得する
      const secondImage = product.mediaItems && product.mediaItems.length > 1 
        ? toHtmlImageSrc(product.mediaItems[1].src || product.mediaItems[1].url) 
        : null;

      return {
        src,
        originalImage: src,
        hoverImage: secondImage,
        title: String(product.name || ""),
        productId: String(product._id || ""),
        brand: product.brand,
        priceTaxIn: taxInPrice,
        formattedPrice: "税込 " + taxInPrice.toLocaleString() + "円",
        price: "税込 " + taxInPrice.toLocaleString() + "円",
        slug: String(product.slug || ""),
        type: "image"
      };
    })
    .filter((item) => !!item.src);

  const firstSlug = String(matchedItemsLocal[0]?.slug || "");
  selectedKey = extractSelectedKeyFromSlug(firstSlug);

  itemSlug = buildItemSlug(categoryKey, selectedKey);
  targetTitle = buildTargetTitle(currentItem, selectedKey);

  const queryResultsLocalPromise = wixData.query("Stores/Products").eq("slug", itemSlug).find();

  console.log("matchedItemsLocal[0]", matchedItemsLocal[0]);
  console.log("matchedItemsLocal[0].brand", matchedItemsLocal[0]?.brand);

  const brandLogoUpdatePromise = updateCurrentBrandLogoUrl(matchedItemsLocal[0]?.brand);

  const galleryStateLocal = buildGalleryStateFromProducts(matchedItemsLocal, itemSlug);
  galleryNormalItems = galleryStateLocal.galleryNormalItems;
  galleryHoverItems = galleryStateLocal.galleryHoverItems;
  galleryItems = galleryStateLocal.galleryItems;

  if (isMobile) {
    postMobileMainGalleryMessage({
      channel: "mainGallery",
      type: "g2",
      brand: currentG1G2BrandKey,
      brandKey: currentG1G2BrandKey,
      shop: currentG1G2ShopKey,
      all: currentG1G2AllValue,
      hideBrandSelect: currentG1G2HideBrandSelect,
      backButtonStyle: BRAND_CONFIG[currentG1G2BrandKey]?.backBtn
        ? {
            backgroundColor: BRAND_CONFIG[currentG1G2BrandKey].backBtn.backgroundColor || "",
            color: BRAND_CONFIG[currentG1G2BrandKey].backBtn.color || "",
            borderColor: BRAND_CONFIG[currentG1G2BrandKey].backBtn.borderColor || "",
            borderWidth: BRAND_CONFIG[currentG1G2BrandKey].backBtn.borderWidth || "",
            borderStyle: "solid"
          }
        : null,
      activeCategoryKey: categoryKey,
      items: galleryNormalItems
    });

    pushMobileMainImages(galleryNormalItems);
  } else {
    const mainGalleryHtml = $w("#mainGalleryHtml");

    if (mainGalleryHtml && typeof mainGalleryHtml.postMessage === "function") {
      mainGalleryHtml.postMessage({
        channel: "mainGallery",
        type: "g2",
        brand: currentG1G2BrandKey,
        brandKey: currentG1G2BrandKey,
        selectedBrand: currentG1G2BrandKey,
        shop: currentG1G2ShopKey,
        all: currentG1G2AllValue,
        hideBrandSelect: currentG1G2HideBrandSelect,
        showBrandSelect: !currentG1G2HideBrandSelect,
        brands: currentG1G2BrandSelectBrands,
        brandOptions: Object.keys(BRAND_CONFIG).map((key) => ({
          value: key,
          label: BRAND_CONFIG[key]?.mbBrandText || key
        })),
        activeCategoryKey: categoryKey,
        items: galleryNormalItems.map((item) => ({
          ...item,
          image: item.image || item.src || "",
          price: item.priceText || item.priceTaxIn || item.formattedPrice || item.price || "",
          text: item.text || item.description || ""
        }))
      });
    }
  }

  return {
    matchedItemsLocal,
    queryResultsLocalPromise,
    brandLogoUpdatePromise
  };
}

  console.log("curerentItem", currentItem);
  console.log("itemSlug", itemSlug);
  console.log("🔑 マッチ基準 currentItem:", currentItem);

  // ▼ データ取得（slug は完全一致へ最適化）



const [categoryQuery, salesTextQuery, categoriesResult] = await Promise.all([
  wixData.query("Import307").eq("slug", currentItem).find(),
  wixData.query("ProductSalesTexts").eq("title", currentItem).find(),


// ▼ categoryNameText 用カテゴリ一覧（ALLに関係なく shop= 基準 / BrandSettings.brandPrefix使用）
// ▼ categoryNameText 用カテゴリ一覧（0件回避：まず shop=true を取る）
wixData.query("Import307")
  .eq("shop", true)
  .ascending("title")
  .find()
  ]);

const initialPageData = await initialPageDataPromise;

console.log("[G1G2-DEBUG][initialPageData]", {
  success: initialPageData?.success,
  logoSrc: initialPageData?.logoSrc,
  itemsLength: (initialPageData?.items || []).length,
  firstItems: (initialPageData?.items || []).slice(0, 5).map(item => ({
    title: item.title,
    slug: item.slug,
    productId: item.productId,
    brand: item.brand,
    priceTaxIn: item.priceTaxIn
  }))
});



const productsResult = {
  items: initialPageData?.success ? (initialPageData.items || []) : []
};

DEBUG && console.log("📦 categoryQuery 受信:", categoryQuery);

DEBUG && console.log("📦 salesTextQuery 受信:", salesTextQuery);
DEBUG && console.log("📦 categoriesResult 受信:", categoriesResult);
DEBUG && console.log("📦 productsResult 受信:", productsResult);

console.log("[G1G2-DEBUG][categoriesResult]", {
  length: (categoriesResult.items || []).length,
  rows: (categoriesResult.items || []).map(item => ({
    title: item.title,
    slug: item.slug,
    brand: item.brand,
    shopBrand: item.shopBrand,
    shop: item.shop,
    notAll: item.notAll
  }))
});

// ▼ 追加（ProductsのmainMediaをproductIdで引けるようにする）
productsResult.items.forEach(p => {
  if (p?._id && p?.src) productMainMediaById.set(p._id, p.src);
});

let __allProductsCache = null; // ▼ 高速化のためのキャッシュ変数
let __allProductsFetchPromise = null;

async function getAllProductsForCount() {
  // ▼ 既にデータがあればDB通信せずに即座に返す（高速化）
  if (__allProductsCache) {
    return { items: __allProductsCache };
  }

  if (__allProductsFetchPromise) {
    return __allProductsFetchPromise;
  }

  __allProductsFetchPromise = (async () => {
    try {
      let allItems = [];
      let result = await wixData.query("Stores/Products").ascending("name").limit(100).find();

      allItems = allItems.concat(result.items || []);

      while (result.hasNext()) {
        result = await result.next();
        allItems = allItems.concat(result.items || []);
      }

      __allProductsCache = allItems; // ▼ 取得したデータを記憶しておく
      return { items: allItems };
    } catch (e) {
      console.error("件数表示用 Stores/Products 全件取得失敗:", e);
      return { items: [] };
    } finally {
      __allProductsFetchPromise = null;
    }
  })();

  return __allProductsFetchPromise;
}

getAllProductsForCount();

async function postCategoryThumbnailMenu(activeCategoryKey, options = {}) {
  const html = $w("#categoryThumbnailMenu");
  const canPostCategoryThumbnailMenu = html && typeof html.postMessage === "function";

  if (!canPostCategoryThumbnailMenu) {
    console.warn("⚠️ #categoryThumbnailMenu が見つからないか、postMessage 非対応です。mobilemainGalleryHtml送信は継続します。");
  }

  const rawCategoriesForMenu = Array.isArray(options.categories)
    ? options.categories
    : filterG1CategoriesForShop(categoriesResult.items || [], {
        shopKey: isForceHelmettyMode() ? FORCE_G1G2_SHOP_KEY : shopKey,
        shopPrefix: options.shopPrefix !== undefined
          ? options.shopPrefix
          : (
              isForceHelmettyMode()
                ? currentG1G2CategoryPrefix
                : shopPrefixFromBrandSettings
            ),
        allValue: isForceHelmettyMode() ? FORCE_G1G2_ALL_VALUE : allValue
      });

  const categoriesForMenu = rawCategoriesForMenu;

  const productsForCountResult = options.productsForCountResult || await getAllProductsForCount();

  const countMapForMenu = buildCategoryCountMap(
    productsForCountResult.items || [],
    categoriesForMenu,
    options.countOptions || {}
  );

  const htmlItemsRaw = buildCategoryHtmlItems(categoriesForMenu, countMapForMenu, activeCategoryKey, {
    countColor: "#C71585"
  });

  const htmlItems = htmlItemsRaw;

  const payloadBrand = isForceHelmettyMode() ? FORCE_G1G2_BRAND_KEY : brandKey;
  const payloadShop = isForceHelmettyMode() ? FORCE_G1G2_SHOP_KEY : shopKey;
  const payloadAll = isForceHelmettyMode() ? FORCE_G1G2_ALL_VALUE : allValue;
  const payloadHideBrandSelect = currentG1G2HideBrandSelect;

  const payloadBrandOptions = Object.keys(BRAND_CONFIG).map((key) => ({
    value: key,
    label: BRAND_CONFIG[key]?.mbBrandText || key
  }));

  console.log("[G1G2-DEBUG][postCategoryThumbnailMenu]", {
    activeCategoryKey,
    brandKey,
    shopKey,
    allValue,
    payloadBrand,
    payloadShop,
    payloadAll,
    hideBrandSelect: payloadHideBrandSelect,
    forceHelmetty: isForceHelmettyMode(),
    rawCategoriesForMenuLength: rawCategoriesForMenu.length,
    categoriesForMenuLength: categoriesForMenu.length,
    categoriesForMenu: categoriesForMenu.map(item => ({
      title: item.title,
      slug: item.slug,
      brand: item.brand,
      shopBrand: item.shopBrand,
      shop: item.shop,
      notAll: item.notAll
    })),
    countMapForMenu,
    htmlItemsRawLength: htmlItemsRaw.length,
    htmlItemsLength: htmlItems.length,
    htmlItems: htmlItems.slice(0, 10)
  });

  if (canPostCategoryThumbnailMenu) {
    html.postMessage({
      type: "setCategories",
      items: htmlItems,
      brand: payloadBrand,
      selectedBrand: payloadBrand,
      shop: payloadShop,
      all: payloadAll,
      hideBrandSelect: payloadHideBrandSelect,
      showBrandSelect: true,
      brandOptions: payloadBrandOptions
    });
  }

  const mainGalleryCategories = categoriesForMenu.map((item) => {
    const key = String(item.slug || item.categoryKey || item.title || "").trim().toLowerCase();
    const count = Number(countMapForMenu[key] || 0);

    return {
      key,
      name: String(item.description || item.title || key),
      count,
      sizeLabel: String(item.sizeLabel || item.size || item.sizes || item.sizeRange || "").trim(),
      thumb: toHtmlImageSrc(item.mainMedia || item.image || item.thumbnail),
      description: String(item.description || item.title || key),
      items: [],
      raw: item
    };
  });

  const mainGalleryHtml = $w("#mainGalleryHtml");

  if (mainGalleryHtml && typeof mainGalleryHtml.postMessage === "function") {
    mainGalleryHtml.postMessage({
      channel: "mainGallery",
      type: "g1",
      brand: payloadBrand,
      brandKey: payloadBrand,
      shop: payloadShop,
      all: payloadAll,
      hideBrandSelect: payloadHideBrandSelect,
      showBrandSelect: !payloadHideBrandSelect,
      brands: currentG1G2BrandSelectBrands,
      brandLogoUrl: currentBrandLogoUrl,
      activeCategoryKey: "",
      categories: mainGalleryCategories
    });

    console.log("✅ #mainGalleryHtmlへG1カテゴリ送信完了:", mainGalleryCategories.length, "件", {
      brand: payloadBrand,
      shop: payloadShop,
      all: payloadAll,
      hideBrandSelect: payloadHideBrandSelect,
      categories: mainGalleryCategories
    });
  } else {
    console.warn("⚠️ #mainGalleryHtml が見つからないか、postMessage 非対応です。");
  }

  postMobileMainGalleryMessage({
    channel: "mainGallery",
    type: "g1",
    brand: payloadBrand,
    brandKey: payloadBrand,
    shop: payloadShop,
    all: payloadAll,
    hideBrandSelect: payloadHideBrandSelect,
    brandLogoUrl: toHtmlImageSrc(brandSettingsItem.brandLogo),
    activeCategoryKey: "",
    categories: mainGalleryCategories
  });

  console.log("✅ HTMLへカテゴリ送信完了:", htmlItems.length, "件");

  return {
    categories: categoriesForMenu,
    countMap: countMapForMenu,
    htmlItems
  };
}

// matchedItems 抽出
const matchedItems = filterProductsByCategoryKey(productsResult.items, currentItem);

if (!__hasSelectedParam && matchedItems.length > 0) {
  const firstSlug = String(matchedItems[0]?.slug || "");
  const firstColor = extractSelectedKeyFromSlug(firstSlug);
  if (firstColor) selectedKey = firstColor;
}

itemSlug = buildItemSlug(categoryKey, selectedKey);
targetTitle = buildTargetTitle(currentItem, selectedKey);
DEBUG && console.log("itemSlug", itemSlug);
DEBUG && console.log("matchedItems", matchedItems);

// ギャラリー配列（通常/hover）を一度だけ生成
const galleryState = buildGalleryStateFromProducts(matchedItems, itemSlug);
galleryNormalItems = galleryState.galleryNormalItems;

galleryHoverItems = galleryState.galleryHoverItems;
// 選択優先（itemSlug と一致するものを先頭へ）
galleryItems = galleryState.galleryItems;

await updateCurrentBrandLogoUrl(galleryNormalItems[0]?.brand);

if (isMobile) {
  postMobileMainGalleryMessage({
    channel: "mainGallery",
    type: "g2",
    brand: currentG1G2BrandKey,
    brandKey: currentG1G2BrandKey,
    shop: currentG1G2ShopKey,
    all: currentG1G2AllValue,
    hideBrandSelect: currentG1G2HideBrandSelect,
    activeCategoryKey: categoryKey,
    items: galleryNormalItems
  });

  pushMobileMainImages(galleryNormalItems);
} else {
  pushMainImages(galleryNormalItems);
}

console.log("✅ 現在のギャラリーアイテム数: ", galleryNormalItems.length);
console.log("✅ ギャラリー更新完了:", galleryNormalItems.length, "件");


initCartHtmlBridge(
  "#SideCartHtml",
  getCartSnapshot,
  (li) => {
    const pid = li?.productId;
    const mm = productMainMediaById.get(pid);

    return (typeof mm === "string") ? mm : (mm?.image?.url || mm?.url || "");
  },
   goSquareCheckoutFromCart
);

  // ▼ セールス表示（フォールバック付き・デバイス分岐）
  console.time("🟨 セールスデータ取得");
  let salesData = null;

  if (salesTextQuery.items.length > 0) {
    salesData = salesTextQuery.items[0];
  } else {
    const normKey = (currentItem || "").trim().toLowerCase();
    let retry = await wixData.query("ProductSalesTexts")
      .contains("title", currentItem)
      .find();

    if (retry.items.length > 0) {
      salesData = retry.items.find(x => ((x.title || "").trim().toLowerCase() === normKey)) || null;
    }
    if (!salesData && retry.items.length > 0) {
      salesData = retry.items[0];
    }
  }

const selectedProductForInfo = await getImport307InfoItemBySlug(currentItem);
const productInfoPosted = await postProductInfoToHtml(salesData, selectedProductForInfo);

if (salesData) {
  currentSalesCatchHtml = salesData.salesCatch || "";
  currentSalesTextsHtml = salesData.salesTexts || "";

  if (salesData.salesCatch) {
    $w("#salesCatch").html = salesData.salesCatch;
  } else {
    $w("#salesCatch").text = "";
  }

  if (productInfoPosted) {
    pushMobileCatalogInfo();
  } else if (isMobile) {
    if (salesData.info1Mobile) {
      console.log("info1Mobile の画像あり:", salesData.info1Mobile);
    } else {
      console.log("info1Mobile の画像なし");
    }
  } else {
    if (salesData.info1) {
      console.log("info1 の画像あり:", salesData.info1);
    } else {
      console.log("info1 の画像なし");
    }
  }

  pushMobileCatalogInfo();
  console.log("🟨 セールスキー:", currentItem, " → 成功");
} else {
  console.log("🟨 セールスデータ未取得（0件）: key =", currentItem);
  currentSalesCatchHtml = "";
  currentSalesTextsHtml = "";
  $w("#salesCatch").text = "";
  if (!productInfoPosted) {
  }
  pushMobileCatalogInfo();
}
  console.timeEnd("🟨 セールスデータ取得");

// ▼ カテゴリ表示処理（初回描画を阻害しないよう遅延実行）
setTimeout(async () => {
  const allProductsForCount = await getAllProductsForCount();
  console.log("--- カテゴリ表示処理開始 ---");
  try {
    // ★URLを読み直さない（ログで shopNameFromUrl が空になっていたため）
    const shopNameFromUrl = String(shopKey || "").trim();

    // ★BrandSettings の brandPrefix を使用
    const shopPrefixFromUrl =
      String(shopPrefixFromBrandSettings || "")
        .trim()
        .toLowerCase();

    // ★Import307 は Promise.all 側で shop=true を取っている前提
const rawCategories = filterG1CategoriesForShop(categoriesResult.items || [], {
  shopKey: isForceHelmettyMode() ? FORCE_G1G2_SHOP_KEY : shopKey,
  shopPrefix: isForceHelmettyMode() ? currentG1G2CategoryPrefix : shopPrefixFromUrl,
  allValue: isForceHelmettyMode() ? FORCE_G1G2_ALL_VALUE : allValue
});

const categories = rawCategories;

console.log("[G1G2-DEBUG][filterG1CategoriesForShop]", {
  shopKey,
  brandKey,
  allValue,
  forcedShopKey: isForceHelmettyMode() ? FORCE_G1G2_SHOP_KEY : shopKey,
  forcedBrandKey: isForceHelmettyMode() ? FORCE_G1G2_BRAND_KEY : brandKey,
  forcedAllValue: isForceHelmettyMode() ? FORCE_G1G2_ALL_VALUE : allValue,
  forceHelmetty: isForceHelmettyMode(),
  shopPrefixFromBrandSettings,
  shopPrefixFromUrl,
  forcedPrefix: isForceHelmettyMode() ? currentG1G2CategoryPrefix : shopPrefixFromUrl,
  sourceLength: (categoriesResult.items || []).length,
  rawFilteredLength: rawCategories.length,
  filteredLength: categories.length,
  filteredRows: categories.map(item => ({
    title: item.title,
    slug: item.slug,
    brand: item.brand,
    shopBrand: item.shopBrand,
    shop: item.shop,
    notAll: item.notAll
  }))
});

console.log(
  "categories slugs =",
  (categories || []).map(x => ({
    title: x.title,
    slug: x.slug,
    brand: x.brand,
    shopBrand: x.shopBrand,
    shop: x.shop
  }))
);

const productsFromResult = allProductsForCount.items || [];

console.log("shopNameFromUrl =", shopNameFromUrl);
console.log("shopPrefixFromUrl =", shopPrefixFromUrl);
console.log("categoriesResult.items.length =", (categoriesResult.items || []).length);
console.log("filtered categories.length =", categories.length);

console.log(`📊 カテゴリ件数: ${categories.length}件`);
console.log("✅ Import307コレクションからのカテゴリ取得成功");
console.log("✅ Stores/Productsコレクションからの商品取得成功");
console.log(`🛍 全商品件数: ${productsFromResult.length}件`);

const allowedPrefixes = new Set(
  categories.map(item => String(item.slug || "").toLowerCase().trim())
);
console.log("allowedPrefixes =", Array.from(allowedPrefixes));

console.log(
  "LGSG product check =",
  (productsFromResult || [])
    .filter(p => String(p.slug || "").toLowerCase().startsWith("lg") || String(p.slug || "").toLowerCase().startsWith("sg") || String(p.slug || "").toLowerCase().startsWith("he"))
    .map(p => ({
      name: p.name,
      slug: p.slug,
      prefix: String(p.slug || "").split("-")[0].toLowerCase()
    }))
);
const countMap = buildCategoryCountMap(productsFromResult, categories, {
  requireHyphen: true
});
console.log("allowedPrefixes =", Array.from(allowedPrefixes));
console.log("countMap =", countMap);
console.log("countMap[lg5076] =", countMap["lg5076"]);
console.log("✅ 件数マップ作成完了");

/*    console.log(">>> category repeater bind count =", categories.length);

    // ★重要：先に onItemReady を登録 → 最後に data
    if (false) {
       const key = String(itemData.slug || "").toLowerCase().trim();
      const label = String(itemData.description || "");
      const cnt = countMap[key] || 0;

  console.log("repeater row =", {
    title: itemData.title,
    slug: itemData.slug,
    key,
    cnt
  });
  
      const desc = $item("#DescriptionText");
      if (!desc) {
        console.error("❌ リピーター内の #DescriptionText が見つかりません。");
        return;
      }

      desc.text = `${label}（${cnt}件）`;

      desc.onClick(async () => {
        const targetUrl =
      `/linkshop-all?category=${encodeURIComponent(String(itemData.slug || "").toLowerCase().trim())}`
          + `&brand=${encodeURIComponent(shopKey)}`
          + `&shop=${encodeURIComponent(shopKey)}`
          + `&all=${allValue}`;

        if (isMobile && menuOpen) {
          await closeMobileMenu();
          console.log("📂 メニュー閉じ（カテゴリ選択）");
        }
        wixLocation.to(targetUrl);
      });
    });
    console.log("✅ Repeater onItemReady 設定完了");

    }
    console.log("✅ Repeater データバインド開始");
*/
 
 // ✅ 追加：HTML（#categoryThumbnailMenu）へもカテゴリ送信（Import307.mainMedia をサムネに使用）
    try {
      await postCategoryThumbnailMenu(categoryKey, {
        categories,
        productsForCountResult: { items: productsFromResult },
        countMap,
        shopPrefix: shopPrefixFromUrl
      });

      if (isMobile && __mobileScreenMode === "g1g2" && $w("#G1G2GallerySection") && typeof $w("#G1G2GallerySection").scrollTo === "function") {
        await $w("#G1G2GallerySection").scrollTo();

        setTimeout(async () => {
          if (__mobileScreenMode !== "g1g2") return;
          const sectionLater = $w("#G1G2GallerySection");
          if (sectionLater && typeof sectionLater.scrollTo === "function") {
            await sectionLater.scrollTo();
          }
        }, 180);

        setTimeout(async () => {
          if (__mobileScreenMode !== "g1g2") return;
          const sectionLater = $w("#G1G2GallerySection");
          if (sectionLater && typeof sectionLater.scrollTo === "function") {
            await sectionLater.scrollTo();
          }
        }, 600);
      }
    } catch (e) {
      console.warn("⚠️ HTMLカテゴリ送信で例外:", e);
    }
  } catch (err) {
    console.error("--- ❌ カテゴリ取得／件数集計エラーが発生しました ---");
    console.error("エラーオブジェクト全体:", err);
    console.error("エラーメッセージ:", err.message);
    console.error("エラーコード (もしあれば):", err.code);
    console.error("スタックトレース:", err.stack);
    console.log("--- カテゴリ表示処理終了 (エラーのため) ---");
  }
}, 0);

  // ▼ カート更新フラグ確認
  const cartUpdated = session.getItem("cartUpdated");
  if (cartUpdated === "true") {
    updateCartAndDisplay()
      .then(() => {
        console.log("🛒 カート情報を更新しました");
        session.removeItem("cartUpdated");
      })
      .catch(err => {
        console.error("❌ カート更新中にエラー発生:", err);
      });
  }

getCartSnapshot()
  .then((initialCart) => {
    renderMobileCart(initialCart);
    pushPurchaseUi(null, null, null, null, initialCart);
  })
 .catch((e) => {
    console.error("初期カート描画失敗:", e);
  });
  // ✅ ブランド・価格表示
console.time("💰 ブランド・価格表示まで");
if (matchedItems.length > 0) {
  const product =
    matchedItems.find(item => String(item.slug || "").toLowerCase().trim() === itemSlug.toLowerCase())
    || matchedItems[0];

  DEBUG && console.log("product=", product);

  if (product.price) {
    let originalPrice = product.price;
    let finalPrice = Math.floor(originalPrice * 1.1);
  } else {
  }

  applyPinterestMeta({
    product,
    salesData,
    currentItem,
    selectedKey
  });

  console.timeEnd("💰 ブランド・価格表示まで");

  if (categoriesResult.items.length > 0) {
    const categoryItem = categoriesResult.items.find(
      item => String(item.slug || "").toLowerCase().trim() === String(categoryKey || "").toLowerCase().trim()
    );
    const productNoText = categoryItem ? categoryItem.description : "";
    currentProductNoText = productNoText;
  } else {
    currentProductNoText = "";
  }

if (galleryNormalItems.length > 0) {
  updateText({ item: galleryNormalItems[0] });

  if (isMobile) {
    pushMobileMainImages(galleryNormalItems);

    postMobileCatalogTitleFromItem({
      ...galleryNormalItems[0],
      brandText: currentBrandText,
      productNoText: currentProductNoText,
      priceText: galleryNormalItems[0].priceTaxIn || galleryNormalItems[0].formattedPrice || galleryNormalItems[0].price || ""
    });

    pushMobileCatalogInfo();
  } else {
    postCatalogTitleFromItem({
      ...galleryNormalItems[0],
      brandText: currentBrandText,
      productNoText: currentProductNoText,
      priceText: galleryNormalItems[0].priceTaxIn || galleryNormalItems[0].formattedPrice || galleryNormalItems[0].price || ""
    });
  }
} else {
  pushCatalogInfo();
  pushMobileCatalogInfo();
}

  pushCatalogInfo();
  pushMobileCatalogInfo();

  DEBUG && console.log("一致した商品:", product);
  DEBUG && console.log("厳密にマッチした商品:", matchedItems);
  console.log("現在のアイテム:", currentItem);
}
  console.log("--- スクリプト終了 ---");
  console.timeEnd("🟩 onReady 全体");
  console.timeEnd("🟥 ページ表示完了まで");
});

// ← ここで $w.onReady 関数全体が閉じます

async function updateCartAndDisplay() {
  const cartData = await getCartSnapshot();
  const res = await fetchAndLogVariants(productNameID, cartData);
  if (!res) { showNoStock(); return; }
  updateDropdownAndStockDisplay(productNameID, res.tempStock, res.productId, res.variants, cartData);
}

// ======================================================
// モバイル版で現在使用している要素ID一覧
// ※他AI・後任作業者向けメモ
//
// モバイル側でセクションやHTML要素を追加・削除・ID変更した場合は、
// この一覧と、開閉処理・postMessage送信先・cartHideTargets を必ず見直すこと。
//
// 現在のモバイル使用要素:
//
// #section2
//
// #mobileBrandBoxSection
// #mobileBrandBoxHtml
//
// #G1G2GallerySection
// #mobilemainGalleryHtml
//
// #MobileUiSection
// #MobileCombinedHtml
//
// #mobileBlankSection
// #MobileMenuHtml
//
// #CheckoutSection
// #MobileCloseButton
// #MobileCloseButton2
// #SideCartHtml
//
// モバイル開閉の基本:
// ・G1/G2一覧表示        → #G1G2GallerySection を開く
// ・商品メイン表示       → #MobileUiSection を開く
// ・商品詳細情報表示     → #MobileUiSection 内の #MobileCombinedHtml を使う
// ・メニュー表示         → #mobileBlankSection + #MobileMenuHtml
// ・カート表示           → #CheckoutSection
//
// モバイル開閉では基本的に #MainSection は使わない。
// #MainSection はPC用の商品詳細セクションとして扱う。
// ======================================================

// サイズ表の枠作成コード
async function setupViewBasedOnDevice() {
  const columns1 = variantNames.slice(0, 8).map((size) => ({
    id: `quantity_${size.replace('.', '')}`,
    dataPath: `quantity_${size.replace('.', '')}`,
    label: isMobile ? size : `${size} cm`,
    type: "string"
  }));
  const columns2 = variantNames.slice(8).map((size) => ({
    id: `quantity_${size}`,
    dataPath: `quantity_${size}`,
    label: size,
    type: "string"
  }));

// 対象ファイル名：ページコード

if (isMobile) {
  console.log("これはモバイルデバイスです。");

  __mobileScreenMode = "g1g2";

  await collapseIfPossible($w("#desktopsection"));
  await collapseIfPossible($w("#MainSection"));

  await expandIfPossible($w("#G1G2GallerySection"));
  await expandIfPossible($w("#mobilemainGalleryHtml"));

  await collapseIfPossible($w("#MobileUiSection"));
  await collapseIfPossible($w("#MobileCombinedHtml"));
  await collapseIfPossible($w("#CheckoutSection"));

  menuOpen = false;
} else {
  console.log("これはデスクトップデバイスです。");
  await collapseIfPossible($w("#MobileUiSection"));
  await collapseIfPossible($w("#MainSection"));
  await collapseIfPossible($w("#desktopsection"));
  await collapseIfPossible($w("#CheckoutSection"));
}
}

function setupEventHandlers() {
}

// 対象ファイル名：いま貼って頂いたページコード（該当箇所）

function setupCartEventHandlers() {
  cart.onChange(async (event) => {
    console.log("カートに変更がありました: ", event);

    __cartSnapshot = event;
    __cartSnapshotAt = Date.now();

    session.setItem('cartUpdated', 'true');

    const cartData = event;

    // 現在の商品に対してのみ在庫UIを更新（余計な再計算を避ける）
    const res = await fetchAndLogVariants(productNameID, cartData);
    if (!res) return;
    await updateDropdownAndStockDisplay(productNameID, res.tempStock, res.productId, res.variants, cartData);

    // ▼ CheckoutSection が表示中なら再描画（自作カートUI）
    const sec = $w(CheckoutSectionId);
    if (sec) {
      const isVisible =
        (typeof sec.collapsed === "boolean" && sec.collapsed === false) ||
        (typeof sec.hidden === "boolean" && sec.hidden === false);

      if (isVisible) {
        await renderMobileCart(cartData);
      }
    }

    pushPurchaseUi(null, currentSelectedSize, currentPurchaseResponse, null, cartData);
  });
}


function postPCStockHtml(mode, values) {
  try {
    const html = $w("#PCStockHtml");
    if (html && typeof html.postMessage === "function") {
      html.postMessage({
        type: "stockTableUpdate",
        mode,
        values
      });
    }
  } catch (e) {
    DEBUG && console.warn("[PCStockHtml] post skipped:", e);
  }
}

async function addProductToCart() {
  const selectedSize = String(currentSelectedSize || "");
  console.log("選択されたサイズ: ", selectedSize);

  if (selectedSize === "") {
    setPurchaseResponse("サイズを選んでください");
    const cartData0 = await getCartSnapshot();
    pushPurchaseUi(null, selectedSize, "サイズを選んでください", null, cartData0);
    return;
  }

  try {
    console.log("商品名: ", productNameID);
    const productData = await fetchProductAndVariants(productNameID);

    if (!productData) {
      console.log('addProductToCart: 指定された商品が見つかりませんでした');
      showNoStock();
      return;
    }

    const product = productData.product;
 const variant = productData.variants.find(v =>
  String(v.variantName || "").replace(/cm$/i, "").trim() === String(selectedSize || "").replace(/cm$/i, "").trim()
);

    if (variant) {
      const stock = parseStock(variant.stock);
      if (!stock) {
           setPurchaseResponse('在庫データの解析に失敗しました');
        return;
      }
      const stockQuantity = stock.quantity;

      console.log("在庫数: ", stockQuantity);
      DEBUG && console.log(`addProductToCart: バリアントID: ${variant._id}, ストック: ${JSON.stringify(stock)}`);

      const cartData = await getCartSnapshot();
      const cartItem = cartData.lineItems.find(item =>
        item.productId === product._id &&
        item.options.some(option => option.option === "サイズ" && option.selection === selectedSize)
      );
      const cartQuantity = cartItem ? cartItem.quantity : 0;
      const availableStock = stockQuantity - cartQuantity;

      if (availableStock > 0) {
        const quantity = 1;
        const options = { choices: { "サイズ": selectedSize } };
        await cart.addProducts([{ productId: product._id, quantity, options }]);
      setPurchaseResponse('商品がカートに追加されました');

        // 追加後にUIを最新化（過剰な再計算を避ける）
         const cartData2 = await getCartSnapshot();
        const res = await fetchAndLogVariants(productNameID, cartData2);
        if (res) {
          updateDropdownAndStockDisplay(productNameID, res.tempStock, res.productId, res.variants, cartData2);
        } else {
          pushPurchaseUi(null, currentSelectedSize, currentPurchaseResponse, null, cartData2);
        }
      } else {
       setPurchaseResponse('在庫が不足しています');
         pushPurchaseUi(null, currentSelectedSize, currentPurchaseResponse, null, cartData);
      }
    } else {
      setPurchaseResponse('指定されたバリアントが見つかりませんでした');
    }
  } catch (error) {
    console.error('addProductToCart: 商品データの取得中にエラーが発生しました:', error);
    setPurchaseResponse('商品データの取得中にエラーが発生しました');
    showNoStock();
  }
}

async function updateDropdownAndStockDisplay(productNameID, tempStock, productId, variants, cartData) {
  // setPurchaseResponse('');

  if (!productId || !variants || !tempStock) {
    showNoStock();
    return;
  }

  const lineItems = cartData?.lineItems || [];

  let quantities = new Array(variantNames.length).fill(0);

  variants.forEach(item => {
    const normalizedVariantName = String(item.variantName || "").replace(/cm$/i, "").trim();
    const index = variantNames.indexOf(normalizedVariantName);

    if (index !== -1) {
      const stock = parseStock(item.stock);
      const cartItem = lineItems.find(cartItem =>
        cartItem.productId === productId &&
        cartItem.options.some(option => option.option === "サイズ" && String(option.selection || "").replace(/cm$/i, "").trim() === normalizedVariantName)
      );
      const cartQuantity = cartItem ? cartItem.quantity : 0;

      const availableStock = (tempStock[item.variantName] !== undefined)
        ? tempStock[item.variantName]
        : (stock ? stock.quantity - cartQuantity : 0);

      quantities[index] = availableStock;
    }
  });
// 対象ファイル名：ページコード

  const tableData1 = [
    variantNames.slice(0, 8).reduce((obj, size, index) => {
      obj[`quantity_${size.replace('.', '')}`] = quantities[index] > 0 ? (isMobile ? "〇" : "在庫あり") : "-";
      return obj;
    }, {})
  ];
  const tableData2 = [
    variantNames.slice(8).reduce((obj, size, index) => {
      obj[`quantity_${size}`] = quantities[index + 8] > 0 ? (isMobile ? "〇" : "在庫あり") : "-";
      return obj;
    }, {})
  ];

  if (isMobile) {
    const cmValues = variantNames.slice(0, 8).reduce((obj, size, index) => {
      obj[size] = quantities[index] > 0 ? "〇" : "-";
      return obj;
    }, {});

    const size4Values = variantNames.slice(8).reduce((obj, size, index) => {
      obj[size] = quantities[index + 8] > 0 ? "〇" : "-";
      return obj;
    }, {});

    const hasCmVariants = variants.some(item => {
      const name = String(item.variantName || "").replace(/cm$/i, "").trim();
      return variantNames.slice(0, 8).includes(name);
    });

    const has4SizeVariants = variants.some(item => {
      const name = String(item.variantName || "").replace(/cm$/i, "").trim();
      return variantNames.slice(8).includes(name);
    });

    const mode = has4SizeVariants && !hasCmVariants ? "4SIZE" : "CM";
    const values = mode === "4SIZE" ? size4Values : cmValues;

    $w("#MobileCombinedHtml").postMessage({
      type: "stockTableUpdate",
      mode,
      values
    });
  } else {
    const cmValues = variantNames.slice(0, 8).reduce((obj, size, index) => {
      obj[size] = quantities[index] > 0 ? "〇" : "-";
      return obj;
    }, {});

    const size4Values = variantNames.slice(8).reduce((obj, size, index) => {
      obj[size] = quantities[index + 8] > 0 ? "〇" : "-";
      return obj;
    }, {});

    const hasCmVariants = variants.some(item => {
      const name = String(item.variantName || "").replace(/cm$/i, "").trim();
      return variantNames.slice(0, 8).includes(name);
    });

    const has4SizeVariants = variants.some(item => {
      const name = String(item.variantName || "").replace(/cm$/i, "").trim();
      return variantNames.slice(8).includes(name);
    });

    const mode = has4SizeVariants && !hasCmVariants ? "4SIZE" : "CM";
    const values = mode === "4SIZE" ? size4Values : cmValues;
    postPCStockHtml(mode, values);
  }

// 対象ファイル名：ページコード

  if (isMobile) {
    const cmValues = variantNames.slice(0, 8).reduce((obj, size, index) => {
      obj[size] = quantities[index] > 0 ? "〇" : "-";
      return obj;
    }, {});

    const size4Values = variantNames.slice(8).reduce((obj, size, index) => {
      obj[size] = quantities[index + 8] > 0 ? "〇" : "-";
      return obj;
    }, {});

    const has4SizeVariants = variants.some(item => {
      const normalizedVariantName = String(item.variantName || "").replace(/cm$/i, "").trim();
      return variantNames.slice(8).includes(normalizedVariantName);
    });

    $w("#MobileCombinedHtml").postMessage({
      type: "stockTableUpdate",
      mode: has4SizeVariants ? "4SIZE" : "CM",
      values: has4SizeVariants ? size4Values : cmValues
    });
  } else {
    const cmValues = variantNames.slice(0, 8).reduce((obj, size, index) => {
      obj[size] = quantities[index] > 0 ? "〇" : "-";
      return obj;
    }, {});

    const size4Values = variantNames.slice(8).reduce((obj, size, index) => {
      obj[size] = quantities[index + 8] > 0 ? "〇" : "-";
      return obj;
    }, {});

    const has4SizeVariants = variants.some(item => {
      const normalizedVariantName = String(item.variantName || "").replace(/cm$/i, "").trim();
      return variantNames.slice(8).includes(normalizedVariantName);
    });

    postPCStockHtml(has4SizeVariants ? "4SIZE" : "CM", has4SizeVariants ? size4Values : cmValues);
  }


  let dropdownOptions = [{ value: "", label: "サイズ" }];
  variantNames.forEach(size => {
    const idx = variantNames.indexOf(size);
    if (quantities[idx] > 0) {
      dropdownOptions.push({ value: size, label: size });
    }
  });

  if (!dropdownOptions.some(opt => String(opt.value) === String(currentSelectedSize || ""))) {
    currentSelectedSize = "";
  }

  pushPurchaseUi(dropdownOptions, currentSelectedSize, currentPurchaseResponse, dropdownOptions.length > 1, cartData);
}

async function goSquareCheckoutFromCart() {
  try {
    const cartData = await getCartSnapshot();
    const lineItems = cartData?.lineItems || [];
    if (!lineItems.length) return;

    const cartItems = buildSquareCartItems(lineItems);

    if (!cartItems.length) return;

   const internalOrderId = `WIX-${Date.now()}`;

const u = new URL(wixLocation.url);
u.searchParams.set("sqret", "1");
u.searchParams.set("internalOrderId", internalOrderId);
const redirectUrl = u.toString();

const wixCartId = cartData?._id;

const res = await createSquarePaymentLink({ cartItems, internalOrderId, redirectUrl, wixCartId });

    if (res?.checkoutUrl) {
      wixLocation.to(res.checkoutUrl);
    }
  } catch (e) {
    console.error("Square遷移処理エラー:", e);
  }
}

function updateText(event) {
  const itemData = event.item;
  if (!itemData) return;

  // ▼ 安全装置：今と同じ商品ならこれ以上奥へ進ませない（ループ完全防止）
  const newProductNameID = String(itemData.title || "").trim();
  if (newProductNameID === String(productNameID || "").trim()) {
    return;
  }

  DEBUG && console.log(itemData);
  productNameID = newProductNameID;

  const productSwitchRequestId = beginProductSwitchRequest(productNameID);

  const lastSpaceIndex = productNameID.lastIndexOf(' ');
  const extractedText = productNameID.substring(lastSpaceIndex + 1);
  console.log("!", extractedText);

  currentColorHtml = itemData.colorHtml || `<div style="font-size: 18px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${extractedText}</div>`;
 setPurchaseResponse('');

  pushCatalogInfo();

  if (isMobile) {
    postMobileCatalogTitleFromItem({
      ...itemData,
      brandText: currentBrandText,
      productNoText: currentProductNoText,
      colorHtml: currentColorHtml,
      priceText: itemData.priceTaxIn || itemData.formattedPrice || itemData.price || ""
    });
  }

  console.log("カート処理で使う、productNameID", productNameID);

  scheduleStockUpdateForCurrentProduct(productSwitchRequestId, productNameID);
}

async function fetchProductAndVariants(productName) {
  try {
    if (cache.productByName.has(productName)) {
      const product = cache.productByName.get(productName);
      const pid = product._id;
      if (cache.variantsByProductId.has(pid)) {
        return { product, variants: cache.variantsByProductId.get(pid) };
      }
    }
    const productResults = await wixData.query("Stores/Products").eq("name", productName).find();
    if (productResults.items.length === 0) {
      console.error('fetchProductAndVariants: 指定された商品が見つかりませんでした');
      return null;
    }

    const product = productResults.items[0];
    cache.productByName.set(productName, product);

    const variantResults = await wixData.query("Stores/Variants").eq("productId", product._id).find();
    cache.variantsByProductId.set(product._id, variantResults.items);

    return {
      product,
      variants: variantResults.items
    };
  } catch (error) {
    console.error('fetchProductAndVariants: 商品とバリアントの取得中にエラーが発生しました:', error);
    return null;
  }
}

async function fetchAndLogVariants(targetProductNameID, cartData) {
  try {
    const requestProductNameID = String(targetProductNameID || "").trim();
    const isStaleStockRequest = () =>
      requestProductNameID !== String(productNameID || "").trim();

    if (isStaleStockRequest()) {
      return null;
    }

    console.log("[STOCK] fetchAndLogVariants:start productNameID =", requestProductNameID);

    let product;
    if (cache.productByName.has(requestProductNameID)) {
      product = cache.productByName.get(requestProductNameID);
      console.log("[STOCK] product cache hit =", {
        _id: product?._id,
        name: product?.name,
        slug: product?.slug
      });
    } else {
      const pr = await wixData.query("Stores/Products").eq("name", requestProductNameID).find();

      if (isStaleStockRequest()) {
        return null;
      }

      console.log("[STOCK] Stores/Products eq(name) result count =", pr.items.length);
      console.log("[STOCK] Stores/Products eq(name) names =", pr.items.map(x => ({
        _id: x._id,
        name: x.name,
        slug: x.slug
      })));

      if (pr.items.length === 0) {
        console.error("[STOCK] 指定された商品が見つかりませんでした productNameID =", requestProductNameID);
        return null;
      }

      product = pr.items[0];
      cache.productByName.set(requestProductNameID, product);
      console.log("[STOCK] product selected =", {
        _id: product?._id,
        name: product?.name,
        slug: product?.slug
      });
    }

    const productId = product._id;
    console.log("[STOCK] productId =", productId);

    let variants;
    if (cache.variantsByProductId.has(productId)) {
      variants = cache.variantsByProductId.get(productId);
      console.log("[STOCK] variants cache hit count =", variants.length);
    } else {
      const vr = await wixData.query("Stores/Variants").eq("productId", productId).find();

      if (isStaleStockRequest()) {
        return null;
      }

      variants = vr.items;
      cache.variantsByProductId.set(productId, variants);
      console.log("[STOCK] Stores/Variants eq(productId) count =", variants.length);
      console.log("[STOCK] Stores/Variants rows =", variants.map(v => ({
        _id: v._id,
        productId: v.productId,
        variantName: v.variantName,
        stock: v.stock
      })));
    }

    if (isStaleStockRequest()) {
      return null;
    }

    const variantQuantitiesInCart = {};
    for (const item of (cartData?.lineItems || [])) {
      if (item.name === requestProductNameID) {
        const variantName = item.options.find(opt => opt.option === "サイズ")?.selection;
        if (variantName) {
          variantQuantitiesInCart[variantName] = (variantQuantitiesInCart[variantName] ?? 0) + item.quantity;
        }
      }
    }
    console.log("[STOCK] variantQuantitiesInCart =", variantQuantitiesInCart);

    const sortedVariants = variants.slice().sort((a, b) =>
      a.variantName.localeCompare(b.variantName, undefined, { numeric: true })
    );
    console.log("[STOCK] sortedVariants =", sortedVariants.map(v => ({
      variantName: v.variantName,
      stock: v.stock
    })));

    const tempStock = {};
    for (const variant of sortedVariants) {
      const stock = parseStock(variant.stock);
      const variantName = variant.variantName;
      const quantityInCart = variantQuantitiesInCart[variantName] ?? 0;
      const adjustedStock = (stock ? stock.quantity : 0) - quantityInCart;
      tempStock[variantName] = adjustedStock;

      console.log("[STOCK] row =", {
        variantName,
        rawStock: variant.stock,
        parsedStock: stock,
        quantityInCart,
        adjustedStock
      });
    }

    console.log("[STOCK] result =", { productId, tempStock });

    return { tempStock, productId, variants: sortedVariants };
  } catch (error) {
    console.error('fetchAndLogVariants: エラーが発生しました:', error);
    return null;
  }
}

function showNoStock() {
  const noStockData = [
    variantNames.slice(0, 8).reduce((obj, size) => {
      obj[`quantity_${size.replace('.', '')}`] = "-";
      return obj;
    }, {}),
    variantNames.slice(8).reduce((obj, size) => {
      obj[`quantity_${size}`] = "-";
      return obj;
    }, {})
  ];

// 対象ファイル名：ページコード

  if (isMobile) {
    $w("#MobileCombinedHtml").postMessage({
      type: "stockTableUpdate",
      mode: "CM",
      values: variantNames.slice(0, 8).reduce((obj, size) => {
        obj[size] = "-";
        return obj;
      }, {})
    });
  } else {
    postPCStockHtml("CM", variantNames.slice(0, 8).reduce((obj, size) => {
      obj[size] = "-";
      return obj;
    }, {}));
  }

  currentSelectedSize = "";
  pushPurchaseUi([{ value: "", label: "サイズ" }], "", currentPurchaseResponse, false, __cartSnapshot);
}

function setupPasswordProtectedActions() {
  // 初期非表示（対応APIに合わせて安全制御）
  [ "#passwordInput", "#submitPassword", "#errorMessage", "#syncAllButton" ].forEach(id => {
    const el = $w(id);
    if (!el) return;
    collapseIfPossible(el);  // ← これだけでOK（要素種別差異を吸収）
  });

  // 表示トリガー：管理者メニュー表示
  safeOnClick($w("#webmaster"), () => {
    expandIfPossible($w("#passwordInput"));
    expandIfPossible($w("#submitPassword"));
  }, "#webmaster");

  // 認証処理：正/誤で expand/collapse のみ使用
  safeOnClick($w("#submitPassword"), () => {
    const password = $w("#passwordInput")?.value;
    if (password === "19771225") {
      console.log("Access Granted");
      expandIfPossible($w("#syncAllButton"));
      const err = $w("#errorMessage");
      if (err) collapseIfPossible(err);
    } else {
      console.log("Access Denied");
      const err = $w("#errorMessage");
      if (err) {
        err.text = "パスワードが間違っています。";
        expandIfPossible(err);
      }
    }
  }, "#submitPassword");
}

/* ▼ 追加：ギャラリー切替関数（PC/モバイル共通） */
function toggleMobileGallery() {
  if (!galleryNormalItems.length || !galleryHoverItems.length) return;

  mobileViewAlt = !mobileViewAlt;

  const targetItems = mobileViewAlt ? galleryHoverItems : galleryNormalItems;

  if (isMobile) {
    pushMobileMainImages(targetItems);
  } else {
    // ▼ PCの場合は MainImageHtml の画像を切り替える
    if ($w("#MainImageHtml") && typeof $w("#MainImageHtml").postMessage === "function") {
      $w("#MainImageHtml").postMessage({
        type: "setGalleryItems",
        items: targetItems
      });
    }
  }
} 

