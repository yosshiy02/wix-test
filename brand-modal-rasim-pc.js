// public/brand-modal/brand-modal-rasim-pc.js
// @ts-nocheck
function installBrandModalRasimPc() {
    (function () {
        var STYLE_ID = "brand-modal-rasim-pc-style";

        var modal = null;
        var modalCard = null;
        var modalViewer = null;
        var modalStage = null;
        var mainImage = null;

        var albumWrap = null;
        var albumTrack = null;
        var albumPrevBtn = null;
        var albumNextBtn = null;
        var albumCaption = null;
        var albumImages = [];
        var cachedRasimImages = [];
        var currentRasimGalleryItems = [];
        var storeSignLayer = null;
        var storeSignImage = null;

        var polaroidHero = null;
        var polaroidSource = null;
        var polaroidDeco = null;
        var polaroidNote = null;
        var polaroidPostit = null;
        var closeHint = null;
        var introDecos = [];
        var introDecoTimer = null;

        var openTimer = null;
        var decoTimer = null;
        var noteTimer = null;
        var postitTimer = null;
        var closeFallbackTimer = null;
        var autoSetupTimer = null;
        var autoObserver = null;

        var isEnabled = false;
        var isPolaroidOpen = false;
        var isPolaroidAnimating = false;
        var pointerStartX = 0;
        var pointerStartY = 0;
        var didMove = false;
        var RASIM_PC_DEBUG_SEQ = 0;

        var RASIM_PC_MODAL_DATA = {
            cat: "Love at First Step.",
            watermark: "Rasi:m",
            logoUrl: "https://static.wixstatic.com/media/414ae9_bfc09f7d984144509a47326f6ab911f8~mv2.webp",
            desc: "<span class=\"rasim-pc-intro-copy-lead\">LADIES SHOES BRAND</span><span class=\"rasim-pc-intro-copy-main\">落ち着いた色と履きやすさを<br>大切にした靴のブランドです</span>",
            linkText: "ONLINE STORE ＞",
            linkUrl: "https://rasim20230110.square.site/",
            theme: { bg: "rgba(248,187,208,0.98)", text: "#FF4081", btn: "#0288D1", btnText: "#ffffff" }
        };

        window.BrandModalRasimData = Object.assign({}, RASIM_PC_MODAL_DATA, window.BrandModalRasimData || {});

        function debugToParent(label, payload) {
            RASIM_PC_DEBUG_SEQ += 1;

            var safePayload = payload || null;
            var debugLabel = "RASIM-PC " + String(RASIM_PC_DEBUG_SEQ) + " " + label;
            var message = {
                type: "rasimPcAddonDebug",
                label: debugLabel,
                payload: safePayload
            };
            var mirrorMessage = {
                type: "helmettyPcAddonDebug",
                label: debugLabel,
                payload: safePayload
            };

            console.log("[DEBUG pc rasim addon]", debugLabel, safePayload || "");

            try {
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage(message, "*");
                    window.parent.postMessage(mirrorMessage, "*");
                }
            } catch (error) {
                console.log("[DEBUG pc rasim addon] parent debug post failed", error);
            }
        }

        debugToParent("BOOT installBrandModalRasimPc entered", {
            href: window.location && window.location.href ? window.location.href : "",
            hasParent: !!(window.parent && window.parent !== window),
            hasDocumentElement: !!document.documentElement
        });

        function normalizeRasimBrandKey(value) {
            return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
        }

        function findRasimBrandModalItem(payload) {
            var data = payload;
            var list = [];
            var i;
            var item;

            if (!data || typeof data !== "object") return null;

            if (Array.isArray(data)) {
                list = data;
            } else if (Array.isArray(data.items)) {
                list = data.items;
            } else if (Array.isArray(data.data)) {
                list = data.data;
            } else if (Array.isArray(data.payload)) {
                list = data.payload;
            } else if (Array.isArray(data.brandModalData)) {
                list = data.brandModalData;
            } else if (normalizeRasimBrandKey(data.brand) === "rasim") {
                return data;
            }

            for (i = 0; i < list.length; i += 1) {
                item = list[i];

                if (item && normalizeRasimBrandKey(item.brand) === "rasim") {
                    return item;
                }
            }

            return null;
        }

        function applyRasimBrandModalItem(item) {
            var images = [];

            if (!item || typeof item !== "object") return false;

            window.BrandModalRasimData = Object.assign({}, RASIM_PC_MODAL_DATA, window.BrandModalRasimData || {}, item);

            if (Array.isArray(item.images)) {
                window.BrandModalRasimData.images = item.images.slice();
                cachedRasimImages = item.images.slice();
            }

            if (
                (!Array.isArray(window.BrandModalRasimData.images) || !window.BrandModalRasimData.images.length) &&
                Array.isArray(item.galleryItems)
            ) {
                images = item.galleryItems.map(getImageSrc).filter(function (src, index, array) {
                    return src && array.indexOf(src) === index;
                });

                window.BrandModalRasimData.images = images.slice();
                cachedRasimImages = images.slice();
            }

            if (Array.isArray(item.galleryItems)) {
                currentRasimGalleryItems = item.galleryItems.slice();
                window.BrandModalRasimData.galleryItems = item.galleryItems.slice();
            }

            debugToParent("BRAND_MODAL_DATA synced", {
                imagesLength: Array.isArray(window.BrandModalRasimData.images) ? window.BrandModalRasimData.images.length : 0,
                galleryItemsLength: Array.isArray(window.BrandModalRasimData.galleryItems) ? window.BrandModalRasimData.galleryItems.length : 0,
                firstGalleryItem: Array.isArray(window.BrandModalRasimData.galleryItems) ? window.BrandModalRasimData.galleryItems[0] : null
            });

            return true;
        }

        function rerunRasimPcSetupFromSyncedData() {
            var parts = getModalParts();

            if (
                !parts.foundModal ||
                !parts.foundCard ||
                !parts.foundViewer ||
                !parts.foundStage
            ) {
                return;
            }

            if (
                parts.foundModal.classList.contains("is-open") &&
                parts.foundModal.getAttribute("data-active-brand") === "rasim" &&
                !parts.foundModal.classList.contains("is-archive-mode")
            ) {
                setup({
                    enabled: true,
                    modal: parts.foundModal,
                    modalCard: parts.foundCard,
                    modalViewer: parts.foundViewer,
                    modalStage: parts.foundStage,
                    mainImage: parts.foundMainImage,
                    images: window.BrandModalRasimData && Array.isArray(window.BrandModalRasimData.images) ? window.BrandModalRasimData.images : [],
                    galleryItems: window.BrandModalRasimData && Array.isArray(window.BrandModalRasimData.galleryItems) ? window.BrandModalRasimData.galleryItems : []
                });
            }
        }

        function onRasimBrandModalDataMessage(event) {
            var data = event && event.data ? event.data : null;
            var type;
            var payload;
            var rasimItem;

            if (!data || typeof data !== "object") {
                debugToParent("MESSAGE ignored non-object", {
                    hasEvent: !!event,
                    dataType: typeof data
                });
                return;
            }

            type = data.type || "";

            debugToParent("MESSAGE received", {
                type: type,
                keys: Object.keys(data)
            });

            if (
                type !== "BRAND_MODAL_DATA" &&
                type !== "brandModalData" &&
                type !== "setBrandModalData"
            ) {
                debugToParent("MESSAGE ignored type", {
                    type: type
                });
                return;
            }

            payload = data.payload || data.items || data.data || data.brandModalData || data;
            rasimItem = findRasimBrandModalItem(payload);

            debugToParent("MESSAGE BRAND_MODAL_DATA payload check", {
                payloadIsArray: Array.isArray(payload),
                payloadKeys: payload && typeof payload === "object" && !Array.isArray(payload) ? Object.keys(payload) : [],
                rasimItemFound: !!rasimItem,
                rasimItemBrand: rasimItem && rasimItem.brand ? rasimItem.brand : "",
                rasimItemImagesLength: rasimItem && Array.isArray(rasimItem.images) ? rasimItem.images.length : 0,
                rasimItemGalleryItemsLength: rasimItem && Array.isArray(rasimItem.galleryItems) ? rasimItem.galleryItems.length : 0
            });

            if (!applyRasimBrandModalItem(rasimItem)) {
                debugToParent("MESSAGE apply failed", {
                    rasimItemFound: !!rasimItem
                });
                return;
            }

            debugToParent("MESSAGE apply complete before rerun", {
                windowImagesLength: window.BrandModalRasimData && Array.isArray(window.BrandModalRasimData.images) ? window.BrandModalRasimData.images.length : 0,
                windowGalleryItemsLength: window.BrandModalRasimData && Array.isArray(window.BrandModalRasimData.galleryItems) ? window.BrandModalRasimData.galleryItems.length : 0
            });

            rerunRasimPcSetupFromSyncedData();
        }

        function rasimToVw(value) {
            var base = window.innerWidth || document.documentElement.clientWidth || 1;
            return String((Number(value) / base) * 100) + "vw";
        }

        function rasimToVh(value) {
            var base = window.innerHeight || document.documentElement.clientHeight || 1;
            return String((Number(value) / base) * 100) + "vh";
        }

        function rasimToModalX(value, rect) {
            var base = rect && rect.width ? rect.width : 1;
            return String((Number(value) / base) * 100) + "%";
        }

        function rasimToModalY(value, rect) {
            var base = rect && rect.height ? rect.height : 1;
            return String((Number(value) / base) * 100) + "%";
        }

        function injectStyle() {
            if (document.getElementById(STYLE_ID)) return;

            var style = document.createElement("style");
            style.id = STYLE_ID;

            style.textContent = [
                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready {",
                "  overflow: hidden;",
                "  background: #ffffff;",
                "  box-shadow: 0 2.5rem 6.875rem rgba(0,0,0,0.36), 0 0 0 0.0625rem rgba(255,126,179,0.16) inset;",
                "}",

                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready::before {",
                "  content: \"\";",
                "  position: absolute;",
                "  inset: 1.125rem;",
                "  z-index: 1;",
                "  pointer-events: none;",
                "  border-radius: 0.875rem;",
                "  border: 0.1875rem solid #FFD94A;",
                "}",

                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready::after {",
                "  content: \"Rasi:m PHOTO ALBUM\";",
                "  position: absolute;",
                "  right: 4.2vw;",
                "  bottom: 3.2vh;",
                "  z-index: 1;",
                "  color: rgba(82,55,34,0.14);",
                "  font-family: Jost, sans-serif;",
                "  font-size: clamp(2rem, 3.6vw, 5.4rem);",
                "  font-weight: 900;",
                "  letter-spacing: 0.12em;",
                "  pointer-events: none;",
                "  transform: rotate(-2deg);",
                "  white-space: nowrap;",
                "}",

                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .pc-modal-viewer {",
                "  position: relative;",
                "  z-index: 4;",
                "}",

                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .pc-modal-stage {",
                "  position: relative;",
                "  overflow: visible;",
                "  background: radial-gradient(circle at 50% 45%, rgba(255,255,255,0.58), transparent 60%), rgba(224,203,170,0.24);",
                "  border-radius: 0.875rem;",
                "  box-shadow: 0 1.125rem 3rem rgba(184,63,120,0.12), 0 0 0 0.0625rem rgba(255,255,255,0.34) inset;",
                "}",

                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .pc-modal-main-img,",
                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .pc-modal-thumbs {",
                "  opacity: 0;",
                "  visibility: hidden;",
                "  pointer-events: none;",
                "}",
                "",
                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .pc-modal-arrow {",
                "  display: none !important;",
                "}",

                ".rasim-pc-album-wrap {",
                "  position: absolute;",
                "  inset: 0;",
                "  z-index: 8;",
                "  display: flex;",
                "  align-items: center;",
                "  justify-content: center;",
                "  overflow: visible;",
                "  pointer-events: auto;",
                "}",

                ".rasim-pc-album-track {",
                "  width: 100%;",
                "  height: 100%;",
                "  display: flex;",
                "  align-items: center;",
                "  gap: clamp(1.5rem, 2.2vw, 2.625rem);",
                "  padding: 0 clamp(2.25rem, 5vw, 5.125rem);",
                "  overflow-x: auto;",
                "  overflow-y: visible;",
                "  scroll-snap-type: x mandatory;",
                "  scrollbar-width: thin;",
                "  -webkit-overflow-scrolling: touch;",
                "}",

                ".rasim-pc-album-track::-webkit-scrollbar {",
                "  height: 0.5rem;",
                "}",

                ".rasim-pc-album-track::-webkit-scrollbar-track {",
                "  background: rgba(255,255,255,0.34);",
                "  border-radius: 62.4375rem;",
                "}",

                ".rasim-pc-album-track::-webkit-scrollbar-thumb {",
                "  background: rgba(255,126,179,0.45);",
                "  border-radius: 62.4375rem;",
                "}",

                ".rasim-pc-album-arrow {",
                "  position: absolute;",
                "  top: 50%;",
                "  z-index: 12;",
                "  width: clamp(2.625rem, 3.8vw, 3.875rem);",
                "  height: clamp(2.625rem, 3.8vw, 3.875rem);",
                "  border: 0.125rem solid rgba(255,126,179,0.46);",
                "  border-radius: 50%;",
                "  background: rgba(255,255,255,0.82);",
                "  -webkit-appearance: none;",
                "  appearance: none;",
                "  padding: 0;",
                "  color: #FF5FA2;",
                "  font-family: Jost, sans-serif;",
                "  font-size: clamp(1.45rem, 2.1vw, 2.6rem);",
                "  font-weight: 900;",
                "  line-height: 1;",
                "  box-shadow: 0 0.75rem 1.625rem rgba(150,80,110,0.18);",
                "  transform: translateY(-50%);",
                "  cursor: pointer;",
                "  pointer-events: auto;",
                "}",

                ".rasim-pc-album-arrow.is-prev {",
                "  left: clamp(1.125rem, 2.2vw, 2.125rem);",
                "}",

                ".rasim-pc-album-arrow.is-next {",
                "  right: clamp(1.125rem, 2.2vw, 2.125rem);",
                "}",

                ".rasim-pc-album-arrow:hover {",
                "  background: rgba(255,255,255,0.94);",
                "  box-shadow: 0 0.9375rem 1.875rem rgba(150,80,110,0.24);",
                "}",
                "",
                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready.is-rasim-polaroid-open .rasim-pc-album-arrow {",
                "  display: none;",
                "}",

                ".rasim-pc-gallery-img {",
                "  box-sizing: content-box;",
                "  width: clamp(11.25rem, 18vw, 18.75rem);",
                "  height: clamp(11.25rem, 18vw, 18.75rem);",
                "  flex: 0 0 auto;",
                "  scroll-snap-align: center;",
                "  object-fit: cover;",
                "  border: solid rgba(255,255,255,0.97);",
                "  border-width: clamp(0.8125rem, 1vw, 1.25rem) clamp(0.6875rem, 0.8vw, 1.0625rem) clamp(2.875rem, 3vw, 4.5rem);",
                "  border-radius: 0.5rem;",
                "  background: #ffffff;",
                "  box-shadow: 0 1.625rem 3.375rem rgba(150,80,110,0.24), 0 0.5rem 1.125rem rgba(0,0,0,0.18), 0 0.0625rem 0 rgba(255,255,255,0.85) inset;",
                "  transform: rotate(-3deg) scale(0.9);",
                "  opacity: 0.72;",
                "  filter: brightness(0.96) saturate(1.08);",
                "  cursor: zoom-in;",
                "  user-select: none;",
                "  -webkit-user-drag: none;",
                "  transition: transform 0.58s var(--ease-silk, cubic-bezier(0.22, 1, 0.36, 1)), opacity 0.58s var(--ease-silk, cubic-bezier(0.22, 1, 0.36, 1)), filter 0.58s var(--ease-silk, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow 0.58s var(--ease-silk, cubic-bezier(0.22, 1, 0.36, 1));",
                "}",

                ".rasim-pc-gallery-img:nth-child(2n) {",
                "  transform: rotate(2.5deg) scale(0.9);",
                "}",

                ".rasim-pc-gallery-img:nth-child(3n) {",
                "  transform: rotate(-1.5deg) scale(0.9);",
                "}",

                ".rasim-pc-gallery-img:hover,",
                ".rasim-pc-gallery-img.is-focused {",
                "  transform: rotate(0deg) scale(1);",
                "  opacity: 1;",
                "  filter: brightness(1) saturate(1.14);",
                "  box-shadow: 0 2.25rem 4.5rem rgba(150,80,110,0.32), 0 0.75rem 1.75rem rgba(0,0,0,0.24), 0 0 0 0.0625rem rgba(255,255,255,0.58) inset;",
                "}",

                ".rasim-pc-album-caption {",
                "  position: absolute;",
                "  left: 50%;",
                "  bottom: clamp(3.625rem, 7vh, 5.625rem);",
                "  z-index: 9;",
                "  transform: translateX(-50%);",
                "  display: inline-flex;",
                "  align-items: center;",
                "  gap: 0.75rem;",
                "  padding: 0.75rem 1.5rem 0.6875rem;",
                "  border-radius: 62.4375rem;",
                "  background: rgba(255,255,255,0.72);",
                "  border: 0.0625rem solid rgba(255,126,179,0.3);",
                "  box-shadow: 0 0.625rem 1.5rem rgba(150,80,110,0.12);",
                "  color: #B83F78;",
                "  font-family: Jost, sans-serif;",
                "  font-size: 0.95rem;",
                "  font-weight: 800;",
                "  letter-spacing: 0.16em;",
                "  text-transform: uppercase;",
                "  pointer-events: none;",
                "}",

                ".rasim-pc-album-caption::before,",
                ".rasim-pc-album-caption::after {",
                "  content: \"♡\";",
                "  color: #FF6FAE;",
                "  font-size: 1.15rem;",
                "  letter-spacing: 0;",
                "}",

                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .brand-logo-banner,",
                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .pc-modal-logo,",
                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .modal-logo {",
                "  position: absolute;",
                "  left: clamp(1.75rem, 2.6vw, 2.75rem);",
                "  top: clamp(4.375rem, 6.8vh, 6rem);",
                "  z-index: 7;",
                "  display: block;",
                "  margin-top: 0;",
                "  margin-bottom: 0;",
                "  max-width: min(23.4vw, 20.25rem);",
                "  height: auto;",
                "  object-fit: contain;",
                "  filter: drop-shadow(0 0.625rem 1.125rem rgba(184,63,120,0.16));",
                "}",
                "",
                   ".rasim-pc-store-sign-layer {",
                "  position: absolute;",
                "  inset: 0;",
                "  z-index: 0;",
                "  pointer-events: none;",
                "}",
                "",
                ".rasim-pc-store-sign {",
                "  position: absolute;",
                "  left: calc(clamp(1.125rem, 1.6vw, 2.125rem) + clamp(4.275rem, 5.7vw, 6.0563rem));",
                "  top: calc(clamp(3rem, 5.2vh, 4.375rem) + clamp(7.125rem, 9.5vw, 10.0938rem));",
                "  z-index: 0;",
                "  width: clamp(21.375rem, 28.5vw, 30.2812rem);",
                "  height: clamp(21.375rem, 28.5vw, 30.2812rem);",
                "  object-fit: contain;",
                "  pointer-events: auto;",
                "  cursor: pointer;",
                "  user-select: none;",
                "  -webkit-user-drag: none;",
                "  filter: drop-shadow(0 0.875rem 1.375rem rgba(150,80,110,0.2));",
                "  transform: translate(-0%, 0%);",
                "}",
                "",
                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .pc-modal-cat,",
                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .modal-cat {",
                "  position: absolute;",
                "  left: clamp(1.75rem, 2.6vw, 2.75rem);",
                "  top: clamp(2.25rem, 3.8vh, 3.5rem);",
                "  z-index: 7;",
                "  margin-top: 0;",
                "  margin-bottom: 0;",
                "}",

                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .rasim-pc-title-hidden {",
                "  display: none !important;",
                "}",

                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .pc-modal-title,",
                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .modal-title {",
                "  color: #111111;",
                "  font-family: 'Cormorant Garamond', serif;",
                "  font-weight: 600;",
                "  letter-spacing: 0.04em;",
                "  line-height: 1.08;",
                "  text-shadow: none;",
                "}",

                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .pc-modal-desc,",
                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .modal-desc,",
                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .pc-modal-desc.cute-shop-copy,",
                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .modal-desc.cute-shop-copy {",
                "  position: absolute;",
                "  left: clamp(2.125rem, 3.2vw, 3.875rem);",
                "  top: calc(clamp(8.25rem, 14.9vh, 10.25rem) + clamp(4.375rem, 6.8vh, 4.875rem));",
                "  z-index: 9;",
                "  box-sizing: border-box;",
                "  width: clamp(19.8125rem, 23.92vw, 25.8125rem);",
                "  max-width: none;",
                "  min-height: clamp(5.5rem, 7.15vw, 7.125rem);",
                "  margin: 0;",
                "  padding: clamp(1.25rem, 1.58vw, 1.625rem) clamp(1.4375rem, 1.76vw, 1.9375rem) clamp(1.0625rem, 1.3vw, 1.375rem);",
                "  color: rgba(61,36,19,0.84);",
                "  font-family: 'Hiragino Kaku Gothic ProN', 'Yu Gothic', YuGothic, Meiryo, sans-serif;",
                "  font-weight: 600;",
                "  line-height: 1.5;",
                "  text-align: center;",
                "  background:",
                "    linear-gradient(90deg, rgba(174,126,73,0.1), transparent 20%, rgba(255,255,255,0.16) 50%, transparent 80%, rgba(174,126,73,0.1)),",
                "    repeating-linear-gradient(2deg, rgba(118,76,38,0.12) 0, rgba(118,76,38,0.12) 0.0625rem, rgba(255,241,206,0.1) 0.1875rem, transparent 0.6875rem),",
                "    repeating-linear-gradient(-2deg, transparent 0, transparent 0.5rem, rgba(190,138,78,0.1) 0.625rem, transparent 1.0625rem),",
                "    linear-gradient(180deg, #f9e9c7 0%, #efd1a0 48%, #e0b477 100%);",
                "  border: 0.0625rem solid rgba(150,108,66,0.34);",
                "  border-radius: 0.5625rem;",
                "  box-shadow: 0 0.9375rem 1.625rem rgba(82,58,35,0.14), 0 0.0625rem 0 rgba(255,254,241,0.82) inset, 0 -0.5rem 0.9375rem rgba(143,99,54,0.1) inset, 0.5625rem 0 1.125rem rgba(143,99,54,0.05) inset, -0.5625rem 0 1.125rem rgba(143,99,54,0.05) inset;",
                "  cursor: pointer;",
                "  overflow: hidden;",
                "  transform: rotate(-3deg);",
                "  transform-origin: center top;",
                "}",
                "",
                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .pc-modal-desc.cute-shop-copy::before,",
                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .modal-desc.cute-shop-copy::before {",
                "  content: \"\";",
                "  position: absolute;",
                "  inset: 0.5625rem;",
                "  z-index: 1;",
                "  border: 0.0625rem solid rgba(142,101,60,0.16);",
                "  border-radius: 0.375rem;",
                "  box-shadow: inset 0 0 1rem rgba(130,88,48,0.08);",
                "  pointer-events: none;",
                "}",
                "",
                ".rasim-pc-intro-copy-main {",
                "  position: relative;",
                "  z-index: 2;",
                "  display: block;",
                "  color: rgba(61,36,19,0.84);",
                "  font-family: 'Hiragino Kaku Gothic ProN', 'Yu Gothic', YuGothic, Meiryo, sans-serif;",
                "  font-size: clamp(1.05rem, 2vw, 1.25rem);",
                "  font-weight: 600;",
                "  letter-spacing: 0.055em;",
                "  line-height: 1.58;",
                "  text-shadow: 0 0.0625rem 0 rgba(255,232,190,0.24), 0 -0.0625rem 0 rgba(50,27,13,0.18), 0 0 0.3125rem rgba(74,42,20,0.14);",
                "  mix-blend-mode: multiply;",
                "}",
                "",
                ".rasim-pc-intro-copy-main {",
                "  position: relative;",
                "  z-index: 2;",
                "  display: block;",
                "  color: rgba(61,36,19,0.84);",
                "  font-family: 'Hiragino Kaku Gothic ProN', 'Yu Gothic', YuGothic, Meiryo, sans-serif;",
                "  font-size: clamp(1.05rem, 2vw, 1.25rem);",
                "  font-weight: 600;",
                "  letter-spacing: 0.055em;",
                "  line-height: 1.58;",
                "  text-shadow: 0 0.0625rem 0 rgba(255,232,190,0.24), 0 -0.0625rem 0 rgba(50,27,13,0.18), 0 0 0.3125rem rgba(74,42,20,0.14);",
                "  mix-blend-mode: multiply;",
                "}",
                "",
                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .pc-modal-desc.cute-shop-copy.is-intro-deco-shake,",
                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .modal-desc.cute-shop-copy.is-intro-deco-shake {",
                "  animation: rasimPcIntroCardShake 0.48s cubic-bezier(0.18, 1.25, 0.4, 1);",
                "}",
                "",
                ".rasim-pc-intro-deco {",
                "  position: absolute;",
                "  left: var(--intro-deco-left);",
                "  top: var(--intro-deco-top);",
                "  z-index: 10;",
                "  pointer-events: none;",
                "  transform: translate(-50%, -50%) rotate(var(--intro-deco-rotate, -8deg)) scale(0.2);",
                "  opacity: 0;",
                "  animation: rasimPcIntroDecoPop 0.46s cubic-bezier(0.18, 1.45, 0.4, 1) forwards;",
                "  will-change: transform, opacity;",
                "}",
                "",
                ".rasim-pc-intro-deco.is-dropping {",
                "  animation: rasimPcIntroDecoDrop 0.68s cubic-bezier(0.34, 0.01, 0.5, 1) forwards;",
                "}",
                "",
                ".rasim-pc-intro-deco.is-pin {",
                "  width: clamp(0.8125rem, 1.08vw, 0.9375rem);",
                "  height: clamp(0.8125rem, 1.08vw, 0.9375rem);",
                "  border-radius: 50%;",
                "  background: radial-gradient(circle at 34% 28%, rgba(255,247,210,0.82) 0 13%, transparent 14%), radial-gradient(circle at 50% 54%, #c6a15c 0%, #8f6a32 58%, #5a3c1b 100%);",
                "  box-shadow: inset 0 -0.125rem 0.1875rem rgba(67,42,18,0.42), 0 0.125rem 0.1875rem rgba(62,40,22,0.24);",
                "  opacity: 1;",
                "}",

                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .pc-modal-link,",
                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .modal-link-btn {",
                "  position: absolute;",
                "  left: clamp(7.375rem, 8.4vw, 9.75rem);",
                "  top: calc(clamp(18.25rem, 32.5vh, 22.25rem) + clamp(0.9688rem, 1.21vw, 1.25rem));",
                "  z-index: 11;",
                "  display: inline-flex;",
                "  align-items: center;",
                "  justify-content: center;",
                "  min-width: clamp(8rem, 9.35vw, 10.25rem);",
                "  min-height: clamp(1.9375rem, 2.42vw, 2.5rem);",
                "  padding: 0 clamp(1.125rem, 1.45vw, 1.625rem);",
                "  background: linear-gradient(180deg, #efe0bd 0%, #c99d61 100%);",
                "  border: 0.125rem solid rgba(92,58,30,0.62);",
                "  color: rgba(56,32,16,0.92);",
                "  font-family: Jost, 'Hiragino Kaku Gothic ProN', 'Yu Gothic', YuGothic, Meiryo, sans-serif;",
                "  font-size: clamp(0.72rem, 0.75vw, 0.94rem);",
                "  font-weight: 600;",
                "  letter-spacing: 0.16em;",
                "  border-radius: 0.75rem;",
                "  text-decoration: none;",
                "  cursor: pointer;",
                "  text-shadow: 0 0.0625rem 0 rgba(255,232,190,0.3), 0 -0.0625rem 0 rgba(50,27,13,0.2);",
                "  box-shadow: 0 0.25rem 0 rgba(92,58,30,0.38), 0 0.6875rem 1.125rem rgba(82,58,35,0.18), 0 0.0625rem 0 rgba(255,254,241,0.78) inset, 0 -0.1875rem 0.5rem rgba(120,78,39,0.13) inset;",
                "  transform: rotate(-1deg);",
                "  animation: none;",
                "  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;",
                "}",
                "",
                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .pc-modal-link:hover,",
                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .modal-link-btn:hover {",
                "  transform: translateY(-0.125rem) rotate(-1deg);",
                "  background: linear-gradient(180deg, #f6e8c8 0%, #d4a96c 100%);",
                "  box-shadow: 0 0.3125rem 0 rgba(92,58,30,0.36), 0 0.8125rem 1.25rem rgba(82,58,35,0.22), 0 0.0625rem 0 rgba(255,254,241,0.82) inset, 0 -0.1875rem 0.5rem rgba(120,78,39,0.14) inset;",
                "}",
                "",
                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .pc-modal-link:active,",
                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .modal-link-btn:active {",
                "  transform: translateY(0.1875rem) rotate(-1deg);",
                "  box-shadow: 0 0.0625rem 0 rgba(92,58,30,0.3), 0 0.25rem 0.75rem rgba(82,58,35,0.12), 0 0.0625rem 0 rgba(255,254,241,0.62) inset;",
                "}",
                "",
                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .pc-modal-link::before,",
                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .modal-link-btn::before {",
                "  content: \"\";",
                "  display: none;",
                "}",
                "",
                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .pc-modal-link::after,",
                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-ready .modal-link-btn::after {",
                "  content: \"\";",
                "  display: none;",
                "}",

                ".pc-brand-modal[data-active-brand=\"rasim\"] .pc-modal-panel.is-rasim-polaroid-open .rasim-pc-gallery-img.is-hero-source {",
                "  opacity: 0;",
                "  pointer-events: none;",
                "}",

                ".rasim-pc-polaroid-hero {",
                "  position: absolute;",
                "  left: var(--hero-left);",
                "  top: var(--hero-top);",
                "  width: var(--hero-width);",
                "  height: var(--hero-height);",
                "  z-index: 3030;",
                "  box-sizing: border-box;",
                "  object-fit: cover;",
                "  border-radius: 0.55vw;",
                "  border: solid rgba(255,255,255,0.97);",
                "  border-width: clamp(0.8vw, 1vw, 1.25vw) clamp(0.68vw, 0.8vw, 1.05vw) clamp(2.8vw, 3vw, 4.5vw);",
                "  background: #ffffff;",
                "  box-shadow: 0 2.1vw 4.4vw rgba(0,0,0,0.44), 0 0.62vw 1.38vw rgba(0,0,0,0.25), 0 0 1.5vw rgba(255,255,255,0.55);",
                "  transform: rotate(0deg) translateX(0);",
                "  transform-origin: center center;",
                "  cursor: zoom-out;",
                "  user-select: none;",
                "  -webkit-user-drag: none;",
                "  transition: left 0.78s var(--ease-silk, cubic-bezier(0.22, 1, 0.36, 1)), top 0.78s var(--ease-silk, cubic-bezier(0.22, 1, 0.36, 1)), width 0.78s var(--ease-silk, cubic-bezier(0.22, 1, 0.36, 1)), height 0.78s var(--ease-silk, cubic-bezier(0.22, 1, 0.36, 1)), border-width 0.78s var(--ease-silk, cubic-bezier(0.22, 1, 0.36, 1)), border-radius 0.78s var(--ease-silk, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow 0.78s var(--ease-silk, cubic-bezier(0.22, 1, 0.36, 1)), transform 0.78s var(--ease-silk, cubic-bezier(0.22, 1, 0.36, 1));",
                "}",

                ".rasim-pc-polaroid-hero.is-open {",
                "  left: var(--rasim-pc-open-left);",
                "  top: var(--rasim-pc-open-top);",
                "  width: var(--rasim-pc-open-width);",
                "  height: var(--rasim-pc-open-height);",
                "  transform: rotate(0deg) translateX(0);",
                "  border-width: 1.05vw 0.9vw 4.1vw;",
                "  border-radius: 0.75vw;",
                "  box-shadow: 0 2.4vw 5.2vw rgba(0,0,0,0.44), 0 0 1.9vw rgba(255,255,255,0.56);",
                "}",

                ".rasim-pc-polaroid-hero.is-deco-shake {",
                "  transform-origin: var(--shake-origin-x, 50%) var(--shake-origin-y, 0%);",
                "  animation: rasimPcPolaroidDecoShake 0.52s cubic-bezier(0.18, 1.25, 0.4, 1);",
                "}",

                ".rasim-pc-close-hint {",
                "  position: absolute;",
                "  left: var(--rasim-pc-hint-left, 50%);",
                "  top: var(--rasim-pc-hint-top);",
                "  z-index: 3044;",
                "  transform: translateX(-50%);",
                "  padding: 0.5625rem 1.125rem 0.5rem;",
                "  border-radius: 62.4375rem;",
                "  background: rgba(255,255,255,0.82);",
                "  border: 0.0625rem solid rgba(255,126,179,0.42);",
                "  color: #B83F78;",
                "  font-family: Jost, sans-serif;",
                "  font-size: 0.86rem;",
                "  font-weight: 800;",
                "  letter-spacing: 0.16em;",
                "  text-transform: uppercase;",
                "  box-shadow: 0 0.5rem 1.25rem rgba(0,0,0,0.12);",
                "  pointer-events: none;",
                "  opacity: 0;",
                "  animation: rasimPcHintIn 0.5s cubic-bezier(0.18, 1.25, 0.4, 1) 0.95s forwards;",
                "}",

                ".rasim-pc-deco {",
                "  position: absolute;",
                "  left: var(--rasim-pc-deco-left, var(--deco-left, 50%));",
                "  top: var(--rasim-pc-deco-top, var(--deco-top, 3.25rem));",
                "  z-index: 3040;",
                "  pointer-events: none;",
                "  transform: translate(-50%, -50%) rotate(var(--deco-rotate, -8deg)) scale(0.2);",
                "  opacity: 0;",
                "  animation: rasimPcPolaroidDecoPop 0.5s cubic-bezier(0.18, 1.45, 0.4, 1) forwards;",
                "}",

                ".rasim-pc-deco.is-dropping {",
                "  animation: rasimPcPolaroidDecoDrop 0.72s cubic-bezier(0.34, 0.01, 0.5, 1) forwards;",
                "}",

                ".rasim-pc-deco.is-pin {",
                "  width: 2.125rem;",
                "  height: 2.125rem;",
                "  border-radius: 50%;",
                "  background: radial-gradient(circle at 35% 30%, rgba(255,255,255,0.95) 0 18%, transparent 19%), linear-gradient(135deg, var(--deco-color), var(--deco-color-2));",
                "  border: 0.125rem solid rgba(90,20,55,0.28);",
                "  box-shadow: 0 0.4375rem 0 rgba(0,0,0,0.16), 0 0.75rem 1.125rem rgba(0,0,0,0.24), 0 0 0 0.25rem rgba(255,255,255,0.45) inset;",
                "}",

                ".rasim-pc-deco.is-pin::after {",
                "  content: \"\";",
                "  position: absolute;",
                "  left: 50%;",
                "  top: 1.6875rem;",
                "  width: 0.25rem;",
                "  height: 1.5rem;",
                "  background: rgba(80,80,80,0.55);",
                "  border-radius: 62.4375rem;",
                "  transform: translateX(-50%) rotate(8deg);",
                "  z-index: -1;",
                "}",

                ".rasim-pc-deco.is-tape {",
                "  width: 2.875rem;",
                "  height: 7.75rem;",
                "  border-radius: 0.25rem;",
                "  background: linear-gradient(90deg, rgba(255,255,255,0.62), rgba(255,255,255,0.2) 42%, transparent 72%), linear-gradient(135deg, rgba(255,255,255,0.72), var(--deco-color));",
                "  border: 0.0625rem solid var(--deco-color-2);",
                "  box-shadow: 0 0.3125rem 0.625rem rgba(80,80,80,0.2);",
                "  opacity: 0.96;",
                "}",

                ".rasim-pc-note {",
                "  position: absolute;",
                "  left: var(--rasim-pc-note-left, 50%);",
                "  top: var(--rasim-pc-note-top, auto);",
                "  z-index: 3041;",
                "  width: clamp(17.5rem, 25vw, 22.5rem);",
                "  padding: 1.125rem 1.375rem 1.25rem;",
                "  background: linear-gradient(90deg, rgba(180,140,90,0.035) 0.0625rem, transparent 0.0625rem), linear-gradient(0deg, rgba(180,140,90,0.025) 0.0625rem, transparent 0.0625rem), linear-gradient(135deg, rgba(255,254,246,0.98), rgba(255,248,224,0.96));",
                "  background-size: 0.875rem 0.875rem, 0.875rem 0.875rem, 100% 100%;",
                "  border: 0.0625rem solid rgba(180,130,90,0.24);",
                "  border-radius: 0.5rem;",
                "  box-shadow: 0 0.875rem 1.625rem rgba(0,0,0,0.18), 0 0.0625rem 0 rgba(255,255,255,0.88) inset;",
                "  color: #B83F78;",
                "  font-family: sans-serif;",
                "  text-align: center;",
                "  pointer-events: auto;",
                "  transform: translateX(-50%) rotate(-3deg) scale(0.2);",
                "  opacity: 0;",
                "  animation: rasimPcPolaroidNotePop 0.54s cubic-bezier(0.18, 1.45, 0.4, 1) forwards;",
                "}",

                ".rasim-pc-note.is-dropping {",
                "  pointer-events: none;",
                "  animation: rasimPcPolaroidNoteDrop 0.72s cubic-bezier(0.34, 0.01, 0.5, 1) forwards;",
                "}",

                ".rasim-pc-note-title {",
                "  display: block;",
                "  margin-bottom: 0.4375rem;",
                "  font-size: clamp(1rem, 1.2vw, 1.25rem);",
                "  font-weight: 900;",
                "  letter-spacing: 0.0625rem;",
                "  line-height: 1.2;",
                "  color: #FF6FAE;",
                "  text-shadow: 0.0625rem 0.0625rem 0 #ffffff, 0.1875rem 0.1875rem 0 rgba(255,216,77,0.34);",
                "}",

                ".rasim-pc-note-text {",
                "  margin: 0 0 0.75rem;",
                "  font-size: clamp(0.74rem, 0.82vw, 0.9rem);",
                "  font-weight: 700;",
                "  line-height: 1.45;",
                "  color: #B83F78;",
                "}",

                ".rasim-pc-note-btn {",
                "  display: inline-block;",
                "  padding: 0.625rem 2rem 0.5625rem;",
                "  background: linear-gradient(180deg, #F4D94F 0%, #D8B84A 100%);",
                "  color: #4B2F1E;",
                "  border: 0.125rem solid rgba(120,86,38,0.58);",
                "  border-radius: 62.4375rem;",
                "  font-size: 0.86rem;",
                "  font-weight: 900;",
                "  letter-spacing: 0.0625rem;",
                "  text-decoration: none;",
                "  white-space: nowrap;",
                "  box-shadow: 0 0.25rem 0 rgba(120,86,38,0.32), 0 0.5rem 1rem rgba(216,184,74,0.28), 0 0.0625rem 0 rgba(255,255,255,0.62) inset;",
                "}",

                ".rasim-pc-postit {",
                "  position: absolute;",
                "  left: var(--rasim-pc-postit-left);",
                "  top: var(--rasim-pc-postit-top);",
                "  z-index: 3042;",
                "  width: 7rem;",
                "  min-height: 5.75rem;",
                "  padding: 1.125rem 0.75rem 0.75rem;",
                "  background: linear-gradient(135deg, rgba(255,255,255,0.26), transparent 42%), linear-gradient(180deg, var(--postit-color), var(--postit-color-2));",
                "  border: 0.0625rem solid rgba(150,120,70,0.2);",
                "  border-radius: 0.375rem 0.375rem 0.75rem 0.375rem;",
                "  box-shadow: 0 0.75rem 1.375rem rgba(0,0,0,0.16), 0 0.0625rem 0 rgba(255,255,255,0.75) inset;",
                "  color: #B83F78;",
                "  font-family: sans-serif;",
                "  font-size: 0.96rem;",
                "  font-weight: 700;",
                "  letter-spacing: 0.075rem;",
                "  line-height: 1.15;",
                "  text-align: center;",
                "  pointer-events: none;",
                "  transform: rotate(var(--postit-rotate, 5deg)) scale(0.2);",
                "  opacity: 0;",
                "  animation: rasimPcPolaroidPostitPop 0.52s cubic-bezier(0.18, 1.45, 0.4, 1) forwards;",
                "}",

                ".rasim-pc-postit.is-dropping {",
                "  animation: rasimPcPolaroidPostitDrop 0.72s cubic-bezier(0.34, 0.01, 0.5, 1) forwards;",
                "}",

                ".rasim-pc-fall-out {",
                "  animation: rasimPcCuteFallOut 0.68s cubic-bezier(0.34, 0.01, 0.5, 1) forwards !important;",
                "  animation-delay: var(--fall-delay, 0s) !important;",
                "  pointer-events: none !important;",
                "}",

                ".rasim-pc-return-in {",
                "  animation: rasimPcCuteReturnIn 0.64s cubic-bezier(0.18, 1.25, 0.4, 1) both !important;",
                "  animation-delay: var(--return-delay, 0s) !important;",
                "}",

                ".rasim-pc-logo-out {",
                "  animation: rasimPcLogoFlyOut 0.74s cubic-bezier(0.34, 0.01, 0.5, 1) forwards !important;",
                "  animation-delay: var(--fall-delay, 0s) !important;",
                "  pointer-events: none !important;",
                "}",

                ".rasim-pc-logo-in {",
                "  animation: rasimPcLogoFlyIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both !important;",
                "  animation-delay: var(--return-delay, 0s) !important;",
                "}",

                ".rasim-pc-note-out {",
                "  animation: rasimPcNoteFlutterOut 0.78s cubic-bezier(0.34, 0.01, 0.5, 1) forwards !important;",
                "  animation-delay: var(--fall-delay, 0s) !important;",
                "  pointer-events: none !important;",
                "}",

                ".rasim-pc-note-in {",
                "  animation: rasimPcNoteFlutterIn 0.74s cubic-bezier(0.34, 1.56, 0.64, 1) both !important;",
                "  animation-delay: var(--return-delay, 0s) !important;",
                "}",

                ".rasim-pc-button-out {",
                "  animation: rasimPcButtonBounceOut 0.76s cubic-bezier(0.34, 0.01, 0.5, 1) forwards !important;",
                "  animation-delay: var(--fall-delay, 0s) !important;",
                "  pointer-events: none !important;",
                "}",

                ".rasim-pc-button-in {",
                "  animation: rasimPcButtonBounceIn 0.74s cubic-bezier(0.34, 1.56, 0.64, 1) both !important;",
                "  animation-delay: var(--return-delay, 0s) !important;",
                "}",

                "@keyframes rasimPcIntroButtonFloat {",
                "  0%, 100% { transform: rotate(-2deg) translateY(0) scale(1); }",
                "  50% { transform: rotate(-2deg) translateY(-0.1875rem) scale(1.025); }",
                "}",
                "",
                "@keyframes rasimPcIntroCardShake {",
                "  0% { transform: rotate(-3deg) translateY(0); }",
                "  22% { transform: rotate(-4.4deg) translateY(0.125rem); }",
                "  46% { transform: rotate(-1.8deg) translateY(-0.0625rem); }",
                "  70% { transform: rotate(-3.6deg) translateY(0.0625rem); }",
                "  100% { transform: rotate(-3deg) translateY(0); }",
                "}",
                "",
                "@keyframes rasimPcIntroDecoPop {",
                "  0% { opacity: 0; transform: translate(-50%, -50%) rotate(var(--intro-deco-rotate, -8deg)) scale(0.2); }",
                "  70% { opacity: 1; transform: translate(-50%, -50%) rotate(var(--intro-deco-rotate, -8deg)) scale(1.18); }",
                "  100% { opacity: 1; transform: translate(-50%, -50%) rotate(var(--intro-deco-rotate, -8deg)) scale(1); }",
                "}",
                "",
                "@keyframes rasimPcIntroDecoDrop {",
                "  0% { opacity: 1; transform: translate(-50%, -50%) rotate(var(--intro-deco-rotate, -8deg)) scale(1); }",
                "  18% { opacity: 1; transform: translate(-50%, calc(-50% - 0.5rem)) rotate(calc(var(--intro-deco-rotate, -8deg) + 8deg)) scale(1.06); }",
                "  100% { opacity: 0; transform: translate(-50%, 9.375rem) rotate(calc(var(--intro-deco-rotate, -8deg) + 34deg)) scale(0.82); }",
                "}",
                "",
                "@keyframes rasimPcCuteFallOut {",
                "  0% { opacity: var(--cute-opacity, 1); translate: 0 0; rotate: 0deg; scale: 1; }",
                "  18% { opacity: 1; translate: 0 -0.75rem; rotate: var(--fall-rotate, -4deg); scale: 1.05; }",
                "  45% { opacity: 1; translate: var(--fall-sway, 1.375rem) 3.625rem; rotate: calc(var(--fall-rotate-end, 12deg) * 0.4); scale: 0.96; }",
                "  72% { opacity: 1; translate: calc(var(--fall-sway, 1.375rem) * -1) 7.375rem; rotate: var(--fall-rotate-end, 12deg); scale: 0.9; }",
                "  100% { opacity: 0; translate: 0 var(--fall-y, 11.25rem); rotate: calc(var(--fall-rotate-end, 12deg) * 1.4); scale: 0.8; }",
                "}",

                "@keyframes rasimPcCuteReturnIn {",
                "  0% { opacity: 0; translate: 0 var(--fall-y, 11.25rem); rotate: calc(var(--fall-rotate-end, 12deg) * 1.4); scale: 0.8; }",
                "  35% { opacity: 1; translate: calc(var(--fall-sway, 1.375rem) * -1) 7.375rem; rotate: var(--fall-rotate-end, 12deg); scale: 0.92; }",
                "  60% { opacity: 1; translate: var(--fall-sway, 1.375rem) 2.75rem; rotate: calc(var(--fall-rotate-end, 12deg) * 0.4); scale: 1; }",
                "  82% { opacity: var(--cute-opacity, 1); translate: 0 -0.875rem; rotate: var(--fall-rotate, -4deg); scale: 1.06; }",
                "  100% { opacity: var(--cute-opacity, 1); translate: 0 0; rotate: 0deg; scale: 1; }",
                "}",

                "@keyframes rasimPcLogoFlyOut {",
                "  0% { opacity: var(--cute-opacity, 1); transform: translate(0,0) rotate(0deg) scale(1, 1); }",
                "  20% { opacity: 1; transform: translate(0,-0.5rem) rotate(-3deg) scale(0.92, 1.18); }",
                "  45% { opacity: 1; transform: translate(-1.125rem,-1.875rem) rotate(-10deg) scale(1.04, 1.04); }",
                "  100% { opacity: 0; transform: translate(-3.375rem, 11.875rem) rotate(-28deg) scale(0.78, 0.78); }",
                "}",

                "@keyframes rasimPcLogoFlyIn {",
                "  0% { opacity: 0; transform: translate(-3.375rem, 11.875rem) rotate(-28deg) scale(0.78, 0.78); }",
                "  55% { opacity: 1; transform: translate(0.375rem,-0.875rem) rotate(4deg) scale(1.08, 1.08); }",
                "  78% { opacity: 1; transform: translate(-0.1875rem, 0.1875rem) rotate(-2deg) scale(0.98, 0.98); }",
                "  100% { opacity: var(--cute-opacity, 1); transform: translate(0,0) rotate(0deg) scale(1, 1); }",
                "}",

                "@keyframes rasimPcNoteFlutterOut {",
                "  0% { opacity: var(--cute-opacity, 1); transform: translate(0,0) rotate(-5deg) scale(1); }",
                "  18% { opacity: 1; transform: translate(0,-0.4375rem) rotate(-2deg) scale(1.08); }",
                "  40% { opacity: 1; transform: translate(1.25rem, 1.625rem) rotate(8deg) scale(1); }",
                "  65% { opacity: 1; transform: translate(-1.125rem, 5.375rem) rotate(-12deg) scale(0.96); }",
                "  100% { opacity: 0; transform: translate(1rem, 12.8125rem) rotate(22deg) scale(0.85); }",
                "}",

                "@keyframes rasimPcNoteFlutterIn {",
                "  0% { opacity: 0; transform: translate(1rem, 12.8125rem) rotate(22deg) scale(0.85); }",
                "  50% { opacity: 1; transform: translate(-0.75rem, 0.875rem) rotate(-10deg) scale(1.04); }",
                "  75% { opacity: 1; transform: translate(0.375rem, -0.375rem) rotate(-2deg) scale(1.06); }",
                "  100% { opacity: var(--cute-opacity, 1); transform: translate(0,0) rotate(-5deg) scale(1); }",
                "}",

                "@keyframes rasimPcButtonBounceOut {",
                "  0% { opacity: var(--cute-opacity, 1); transform: translateY(0) scale(1, 1) rotate(0deg); }",
                "  18% { opacity: 1; transform: translateY(0.375rem) scale(1.22, 0.78) rotate(0deg); }",
                "  40% { opacity: 1; transform: translateY(-1.5rem) scale(0.86, 1.18) rotate(0deg); }",
                "  65% { opacity: 1; transform: translateY(1.875rem) scale(1.1, 0.92) rotate(6deg); }",
                "  100% { opacity: 0; transform: translateY(13.75rem) scale(0.82, 0.82) rotate(-14deg); }",
                "}",

                "@keyframes rasimPcButtonBounceIn {",
                "  0% { opacity: 0; transform: translateY(13.75rem) scale(0.82, 0.82) rotate(-14deg); }",
                "  55% { opacity: 1; transform: translateY(-1.25rem) scale(0.9, 1.15) rotate(0deg); }",
                "  75% { opacity: 1; transform: translateY(0.5rem) scale(1.15, 0.88) rotate(0deg); }",
                "  90% { opacity: 1; transform: translateY(-0.25rem) scale(0.97, 1.04) rotate(0deg); }",
                "  100% { opacity: var(--cute-opacity, 1); transform: translateY(0) scale(1, 1) rotate(0deg); }",
                "}",

                "@keyframes rasimPcPolaroidDecoShake {",
                "  0% { transform: rotate(0deg) translateY(0); }",
                "  22% { transform: rotate(-2.4deg) translateY(0.1875rem); }",
                "  46% { transform: rotate(1.8deg) translateY(-0.125rem); }",
                "  70% { transform: rotate(-0.9deg) translateY(0.0625rem); }",
                "  100% { transform: rotate(0deg) translateY(0); }",
                "}",

                "@keyframes rasimPcPolaroidDecoPop {",
                "  0% { opacity: 0; transform: translate(-50%, -50%) rotate(var(--deco-rotate, -8deg)) scale(0.2); }",
                "  70% { opacity: 1; transform: translate(-50%, -50%) rotate(var(--deco-rotate, -8deg)) scale(1.18); }",
                "  100% { opacity: 1; transform: translate(-50%, -50%) rotate(var(--deco-rotate, -8deg)) scale(1); }",
                "}",

                "@keyframes rasimPcPolaroidDecoDrop {",
                "  0% { opacity: 1; transform: translate(-50%, -50%) rotate(var(--deco-rotate, -8deg)) scale(1); }",
                "  18% { opacity: 1; transform: translate(-50%, calc(-50% - 0.625rem)) rotate(calc(var(--deco-rotate, -8deg) + 8deg)) scale(1.06); }",
                "  100% { opacity: 0; transform: translate(-50%, 13.125rem) rotate(calc(var(--deco-rotate, -8deg) + 34deg)) scale(0.82); }",
                "}",

                "@keyframes rasimPcPolaroidNotePop {",
                "  0% { opacity: 0; transform: translateX(-50%) rotate(-3deg) scale(0.2); }",
                "  70% { opacity: 1; transform: translateX(-50%) rotate(-5deg) scale(1.08); }",
                "  100% { opacity: 1; transform: translateX(-50%) rotate(-3deg) scale(1); }",
                "}",

                "@keyframes rasimPcPolaroidNoteDrop {",
                "  0% { opacity: 1; transform: translateX(-50%) rotate(-3deg) scale(1); }",
                "  18% { opacity: 1; transform: translateX(-50%) translateY(-0.625rem) rotate(4deg) scale(1.04); }",
                "  100% { opacity: 0; transform: translateX(-50%) translateY(13.125rem) rotate(-18deg) scale(0.82); }",
                "}",

                "@keyframes rasimPcPolaroidPostitPop {",
                "  0% { opacity: 0; transform: rotate(var(--postit-rotate, 5deg)) scale(0.2); }",
                "  70% { opacity: 1; transform: rotate(calc(var(--postit-rotate, 5deg) + 3deg)) scale(1.12); }",
                "  100% { opacity: 1; transform: rotate(var(--postit-rotate, 5deg)) scale(1); }",
                "}",

                "@keyframes rasimPcPolaroidPostitDrop {",
                "  0% { opacity: 1; transform: rotate(var(--postit-rotate, 5deg)) scale(1); }",
                "  18% { opacity: 1; transform: translateY(-0.625rem) rotate(calc(var(--postit-rotate, 5deg) + 6deg)) scale(1.05); }",
                "  100% { opacity: 0; transform: translateY(13.125rem) rotate(calc(var(--postit-rotate, 5deg) - 24deg)) scale(0.82); }",
                "}",

                "@keyframes rasimPcHintIn {",
                "  0% { opacity: 0; transform: translateX(-50%) translateY(0.5rem) scale(0.96); }",
                "  100% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }",
                "}"
            ].join("\n");

            document.head.appendChild(style);
        }

        function getModalParts() {
            var foundModal = document.getElementById("brandModal") || document.querySelector(".pc-brand-modal");
            var foundCard = document.querySelector(".pc-modal-panel");
            var foundViewer = document.querySelector(".pc-modal-viewer");
            var foundStage = document.querySelector(".pc-modal-stage") || foundViewer;
            var foundMainImage = document.getElementById("modalMainImage") || document.querySelector(".pc-modal-main-img");

            return {
                foundModal: foundModal,
                foundCard: foundCard,
                foundViewer: foundViewer,
                foundStage: foundStage,
                foundMainImage: foundMainImage
            };
        }

        function normalizeImages(options) {
            var images = [];
            var i;

            if (options && Array.isArray(options.images)) {
                for (i = 0; i < options.images.length; i += 1) {
                    if (options.images[i]) images.push(options.images[i]);
                }
            }

            if (
                window.BrandModalRasimData &&
                Array.isArray(window.BrandModalRasimData.images)
            ) {
                for (i = 0; i < window.BrandModalRasimData.images.length; i += 1) {
                    if (window.BrandModalRasimData.images[i]) images.push(window.BrandModalRasimData.images[i]);
                }
            }

            try {
                console.log("[DEBUG pc rasim addon] normalizeImages raw options.images", options && options.images);
                console.log("[DEBUG pc rasim addon] normalizeImages raw window.BrandModalRasimData.images", window.BrandModalRasimData && window.BrandModalRasimData.images);
                console.log("[DEBUG pc rasim addon] normalizeImages raw images before filter", images);
            } catch (error) {
                console.log("[DEBUG pc rasim addon] normalizeImages raw log failed", error);
            }

            images = images.filter(function (src, index, array) {
                return src && array.indexOf(src) === index;
            });

            if (images.length) {
                cachedRasimImages = images.slice();

                return images;
            }
            return cachedRasimImages.slice();
        }

        function pickImageValue(item, keys) {
            var i;
            var value;

            if (!item || typeof item !== "object") return "";

            for (i = 0; i < keys.length; i += 1) {
                value = item[keys[i]];

                if (value && typeof value === "string") {
                    return value;
                }

                if (value && typeof value === "object") {
                    if (typeof value.text === "string") return value.text;
                    if (typeof value.description === "string") return value.description;
                    if (typeof value.href === "string") return value.href;
                    if (typeof value.url === "string") return value.url;
                }
            }

            return "";
        }

        function getImageSrc(item) {
            if (typeof item === "string") return item;
            if (!item || typeof item !== "object") return "";

            if (typeof item.src === "string") return item.src;
            if (typeof item.imageUrl === "string") return item.imageUrl;
            if (typeof item.url === "string") return item.url;
            if (item.src && typeof item.src.url === "string") return item.src.url;
            if (item.image && typeof item.image === "string") return item.image;
            if (item.image && typeof item.image.url === "string") return item.image.url;

            return "";
        }

        function getImageAlt(item, index) {
            return pickImageValue(item, ["alt", "title", "name", "label"]) || "Rasi:m gallery " + String(index + 1);
        }

        function getImageNoteText(item) {
            return pickImageValue(item, ["description", "details", "detail", "noteText", "itemText", "desc", "text", "caption", "productText"]);
        }

        function getImageProductUrl(item) {
            return pickImageValue(item, ["link", "productUrl", "itemUrl", "linkUrl", "href"]);
        }

        function getSelectedGalleryItem() {
            var index;

            if (!polaroidSource || !Array.isArray(albumImages)) return null;

            index = albumImages.indexOf(polaroidSource);

            if (index < 0 || !Array.isArray(currentRasimGalleryItems)) return null;

            return currentRasimGalleryItems[index] || null;
        }

        function getSelectedImageNoteText() {
            var galleryItem = getSelectedGalleryItem();

            if (!polaroidSource || !polaroidSource.dataset) return "";

            return polaroidSource.dataset.rasimPcNoteText || (galleryItem && galleryItem.description ? String(galleryItem.description) : "");
        }

        function getSelectedImageProductUrl() {
            var galleryItem = getSelectedGalleryItem();

            if (!polaroidSource || !polaroidSource.dataset) return "";

            return polaroidSource.dataset.rasimPcProductUrl || (galleryItem && galleryItem.link ? String(galleryItem.link) : "");
        }

        function getSelectedImageTitle() {
            var galleryItem = getSelectedGalleryItem();

            if (!polaroidSource || !polaroidSource.dataset) return "";

            return polaroidSource.dataset.rasimPcTitle || (galleryItem && galleryItem.title ? String(galleryItem.title) : "");
        }

        function getSelectedImageTarget() {
            var galleryItem = getSelectedGalleryItem();

            if (!polaroidSource || !polaroidSource.dataset) return "";

            return polaroidSource.dataset.rasimPcTarget || (galleryItem && galleryItem.target ? String(galleryItem.target) : "");
        }

        function collectRasimDomImages(parts) {
            var images = [];
            var nodes = [];
            var i;
            var src;

            if (parts && parts.foundMainImage) {
                nodes.push(parts.foundMainImage);
            }

            if (parts && parts.foundCard) {
                nodes = nodes.concat(Array.prototype.slice.call(parts.foundCard.querySelectorAll(".pc-modal-thumb img, .pc-modal-thumbs img, .pc-modal-main-img, #modalMainImage")));
            }

            for (i = 0; i < nodes.length; i += 1) {
                src = nodes[i].currentSrc || nodes[i].src || nodes[i].getAttribute("src") || "";

                if (src && images.indexOf(src) === -1) {
                    images.push(src);
                }
            }

            return images;
        }

        function getStoreSignImageSrc() {
            if (
                window.BrandModalRasimData &&
                window.BrandModalRasimData.modalStoreSignImage
            ) {
                return window.BrandModalRasimData.modalStoreSignImage;
            }

            return "";
        }

        function syncStoreSignImage() {
            if (!modalCard) return;

            var src = getStoreSignImageSrc();

            if (!src) {
                if (storeSignImage) {
                    storeSignImage.remove();
                    storeSignImage = null;
                }

                if (storeSignLayer) {
                    storeSignLayer.remove();
                    storeSignLayer = null;
                }

                return;
            }

            if (!storeSignLayer) {
                storeSignLayer = document.createElement("div");
                storeSignLayer.className = "rasim-pc-store-sign-layer";
                modalCard.insertBefore(storeSignLayer, modalCard.firstChild);
            }

            if (!storeSignImage) {
                storeSignImage = document.createElement("img");
                storeSignImage.className = "rasim-pc-store-sign";
                storeSignImage.alt = "Rasi:m store sign";
                storeSignImage.draggable = false;
                storeSignLayer.appendChild(storeSignImage);
            }

            storeSignImage.src = src;
        }

        function openRasimOnlineStore() {
            var rasimData = window.BrandModalRasimData || RASIM_PC_MODAL_DATA;
            var url = rasimData.linkUrl || "https://rasim20230110.square.site/";

            window.open(url, "_blank", "noopener,noreferrer");
        }

        function syncRasimPcInfoWithMobile() {
            if (!modalCard) return;

            syncStoreSignImage();

            var rasimData = window.BrandModalRasimData || RASIM_PC_MODAL_DATA;
            var logo = modalCard.querySelector(".brand-logo-banner") || modalCard.querySelector(".pc-modal-logo") || modalCard.querySelector(".modal-logo");
            var cat = modalCard.querySelector(".pc-modal-cat") || modalCard.querySelector(".modal-cat");
            var watermark = modalCard.querySelector(".pc-modal-watermark") || modalCard.querySelector(".modal-watermark");
            var title = modalCard.querySelector(".pc-modal-title") || modalCard.querySelector(".modal-title");
            var desc = modalCard.querySelector(".modal-desc.cute-shop-copy") || modalCard.querySelector(".pc-modal-desc") || modalCard.querySelector(".modal-desc");
            var btn = modalCard.querySelector(".modal-link-btn") || modalCard.querySelector(".pc-modal-link");

            if (modal) {
                modal.style.setProperty("--pc-modal-bg", rasimData.theme.bg);
                modal.style.setProperty("--pc-modal-text", rasimData.theme.text);
                modal.style.setProperty("--pc-modal-btn", rasimData.theme.btn);
                modal.style.setProperty("--pc-modal-btn-text", rasimData.theme.btnText);
            }

            if (logo) {
                logo.classList.add("brand-logo-banner");
                logo.src = rasimData.logoUrl;
                logo.setAttribute("alt", rasimData.watermark);

                if (logo.parentNode !== modalCard) {
                    modalCard.appendChild(logo);
                }
            }

            if (cat) {
                cat.textContent = rasimData.cat;

                if (cat.parentNode !== modalCard) {
                    modalCard.appendChild(cat);
                }
            }

            if (watermark) {
                watermark.textContent = rasimData.watermark;
            }

            if (title && logo && logo.getAttribute && logo.getAttribute("src")) {
                title.classList.add("rasim-pc-title-hidden");
            }

            if (desc) {
                desc.classList.add("cute-shop-copy");
                desc.innerHTML = rasimData.desc || "";
                desc.setAttribute("role", "link");
                desc.setAttribute("tabindex", "0");
                desc.onclick = openRasimOnlineStore;
                desc.onkeydown = function (event) {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openRasimOnlineStore();
                    }
                };
            }

            if (storeSignImage) {
                storeSignImage.onclick = openRasimOnlineStore;
            }

            if (btn) {
                btn.classList.add("modal-link-btn");
                btn.textContent = rasimData.linkText || "";
                btn.setAttribute("href", rasimData.linkUrl || "https://rasim20230110.square.site/");
                btn.setAttribute("target", "_blank");
                btn.setAttribute("rel", "noopener noreferrer");
            }

            if (introDecoTimer) {
                clearTimeout(introDecoTimer);
            }

            introDecoTimer = setTimeout(showIntroCardDecos, 120);
        }

        function getIntroCard() {
            if (!modalCard) return null;

            return modalCard.querySelector(".pc-modal-desc.cute-shop-copy") || modalCard.querySelector(".modal-desc.cute-shop-copy");
        }

        function shakeIntroCard(card) {
            if (!card) return;

            card.classList.remove("is-intro-deco-shake");
            void card.offsetWidth;
            card.classList.add("is-intro-deco-shake");

            setTimeout(function () {
                if (card) {
                    card.classList.remove("is-intro-deco-shake");
                }
            }, 520);
        }

        function clearIntroCardDecos() {
            introDecos.forEach(function (deco) {
                deco.remove();
            });

            introDecos = [];
        }

        function showIntroCardDecos() {
            if (!modal || !modalCard || isPolaroidOpen) return;
            if (!modal.classList.contains("is-open") || modal.getAttribute("data-active-brand") !== "rasim") return;

            var card = getIntroCard();
            if (!card) return;

            clearIntroCardDecos();

            var patterns = [
                { left: "6%", top: "12%", rotate: "-8deg" },
                { left: "94%", top: "12%", rotate: "8deg" }
            ];

            shakeIntroCard(card);

            patterns.forEach(function (pattern) {
                var deco = document.createElement("div");
                deco.className = "rasim-pc-intro-deco is-pin";
                deco.style.setProperty("--intro-deco-left", pattern.left);
                deco.style.setProperty("--intro-deco-top", pattern.top);
                deco.style.setProperty("--intro-deco-rotate", pattern.rotate);

                card.appendChild(deco);
                introDecos.push(deco);
            });
        }

        function dropIntroCardDecos() {
            if (introDecoTimer) {
                clearTimeout(introDecoTimer);
                introDecoTimer = null;
            }

            introDecos.forEach(function (deco) {
                deco.classList.add("is-dropping");

                setTimeout(function () {
                    deco.remove();
                }, 700);
            });

            introDecos = [];
        }

        function clearCuteState(el) {
            if (!el) return;

            el.classList.remove(
                "rasim-pc-fall-out",
                "rasim-pc-return-in",
                "rasim-pc-logo-out",
                "rasim-pc-logo-in",
                "rasim-pc-note-out",
                "rasim-pc-note-in",
                "rasim-pc-button-out",
                "rasim-pc-button-in"
            );

            el.style.removeProperty("--fall-delay");
            el.style.removeProperty("--return-delay");
            el.style.removeProperty("--fall-y");
            el.style.removeProperty("--fall-rotate");
            el.style.removeProperty("--fall-rotate-end");
            el.style.removeProperty("--fall-sway");
            el.style.removeProperty("--cute-opacity");
        }

        function albumFallTargets() {
            return albumImages.filter(function (img) {
                return img !== polaroidSource;
            });
        }

        function extraFallTargets() {
            if (!modalCard) return [];

            var items = [];
            var title = modalCard.querySelector(".pc-modal-title") || modalCard.querySelector(".modal-title");
            var note = modalCard.querySelector(".modal-desc.cute-shop-copy") || modalCard.querySelector(".pc-modal-desc") || modalCard.querySelector(".modal-desc");
            var btn = modalCard.querySelector(".modal-link-btn") || modalCard.querySelector(".pc-modal-link");
            var caption = modalCard.querySelector(".rasim-pc-album-caption");

            if (storeSignImage) items.push({ el: storeSignImage, kind: "logo" });
            if (title && !title.classList.contains("rasim-pc-title-hidden")) items.push({ el: title, kind: "note" });
            if (note) items.push({ el: note, kind: "note" });
            if (btn) items.push({ el: btn, kind: "button" });
            if (caption) items.push({ el: caption, kind: "button" });

            return items.filter(function (item, index, array) {
                return item.el && array.findIndex(function (x) { return x.el === item.el; }) === index;
            });
        }

        function fallAwayElements() {
            albumFallTargets().forEach(function (el, index) {
                var originalOpacity = getComputedStyle(el).opacity || "1";

                clearCuteState(el);
                el.dataset.rasimPcCuteOpacity = originalOpacity;
                el.style.setProperty("--cute-opacity", originalOpacity);
                el.style.setProperty("--fall-delay", String(0.08 + index * 0.045) + "s");
                el.style.setProperty("--fall-y", rasimToVh(150 + index * 10));
                el.style.setProperty("--fall-rotate", index % 2 === 0 ? "-5deg" : "5deg");
                el.style.setProperty("--fall-rotate-end", index % 2 === 0 ? "18deg" : "-18deg");
                el.style.setProperty("--fall-sway", index % 2 === 0 ? rasimToVw(24) : rasimToVw(-24));
                el.classList.add("rasim-pc-fall-out");
            });

            var kindToClass = {
                logo: "rasim-pc-logo-out",
                note: "rasim-pc-note-out",
                button: "rasim-pc-button-out"
            };

            var kindOrder = {
                logo: 1,
                note: 2,
                button: 4
            };

            extraFallTargets().forEach(function (item) {
                var originalOpacity = getComputedStyle(item.el).opacity || "1";
                var order = kindOrder[item.kind] != null ? kindOrder[item.kind] : 3;

                clearCuteState(item.el);
                item.el.dataset.rasimPcCuteOpacity = originalOpacity;
                item.el.style.setProperty("--cute-opacity", originalOpacity);
                item.el.style.setProperty("--fall-delay", String(order * 0.06) + "s");
                item.el.classList.add(kindToClass[item.kind] || "rasim-pc-fall-out");
            });
        }

        function returnElements() {
            albumFallTargets().reverse().forEach(function (el, index) {
                var originalOpacity = el.dataset.rasimPcCuteOpacity || "1";

                clearCuteState(el);
                void el.offsetWidth;

                el.style.setProperty("--cute-opacity", originalOpacity);
                el.style.setProperty("--return-delay", String(index * 0.045) + "s");
                el.style.setProperty("--fall-y", rasimToVh(150 + index * 10));
                el.style.setProperty("--fall-rotate", index % 2 === 0 ? "-5deg" : "5deg");
                el.style.setProperty("--fall-rotate-end", index % 2 === 0 ? "18deg" : "-18deg");
                el.style.setProperty("--fall-sway", index % 2 === 0 ? rasimToVw(24) : rasimToVw(-24));
                el.classList.add("rasim-pc-return-in");

                setTimeout(function () {
                    clearCuteState(el);
                    delete el.dataset.rasimPcCuteOpacity;
                }, 1100);
            });

            var kindToClass = {
                logo: "rasim-pc-logo-in",
                note: "rasim-pc-note-in",
                button: "rasim-pc-button-in"
            };

            var kindOrder = {
                button: 0,
                note: 2,
                logo: 3
            };

            extraFallTargets().forEach(function (item) {
                var originalOpacity = item.el.dataset.rasimPcCuteOpacity || "1";
                var order = kindOrder[item.kind] != null ? kindOrder[item.kind] : 3;

                clearCuteState(item.el);
                void item.el.offsetWidth;

                item.el.style.setProperty("--cute-opacity", originalOpacity);
                item.el.style.setProperty("--return-delay", String(order * 0.07) + "s");
                item.el.classList.add(kindToClass[item.kind] || "rasim-pc-return-in");

                setTimeout(function () {
                    clearCuteState(item.el);
                    delete item.el.dataset.rasimPcCuteOpacity;
                }, 1100);
            });
        }

        var decoPatterns = [
            { type: "pin", left: "50%", top: "3.25rem", rotate: "-6deg", color: "#E83B78", color2: "#FF78A8" },
            { type: "pin", left: "50%", top: "3.25rem", rotate: "7deg", color: "#D94335", color2: "#FF8A66" },
            { type: "pin", left: "50%", top: "3.25rem", rotate: "-4deg", color: "#6E63D9", color2: "#A390FF" },
            { type: "tape", left: "50%", top: "4.75rem", rotate: "-4deg", color: "rgba(150,220,255,0.9)", color2: "rgba(80,170,220,0.38)" },
            { type: "tape", left: "50%", top: "4.75rem", rotate: "4deg", color: "rgba(255,218,86,0.88)", color2: "rgba(230,180,40,0.42)" },
            { type: "tape", left: "50%", top: "5rem", rotate: "3deg", color: "rgba(255,165,210,0.88)", color2: "rgba(255,126,179,0.42)" }
        ];

        var postitPatterns = [
            { text1: "PICK", text2: "UP", color: "rgba(255,232,120,0.96)", color2: "rgba(255,246,172,0.94)", rotate: "6deg" },
            { text1: "NEW", text2: "ITEM", color: "rgba(255,174,214,0.94)", color2: "rgba(255,218,236,0.92)", rotate: "-5deg" },
            { text1: "CUTE", text2: "♡", color: "rgba(166,226,255,0.94)", color2: "rgba(218,244,255,0.92)", rotate: "5deg" },
            { text1: "FANCY", text2: "★", color: "rgba(190,238,196,0.94)", color2: "rgba(226,250,224,0.92)", rotate: "-6deg" }
        ];

        function shakePolaroid() {
            if (!polaroidHero) return;

            polaroidHero.classList.remove("is-deco-shake");
            void polaroidHero.offsetWidth;
            polaroidHero.classList.add("is-deco-shake");

            setTimeout(function () {
                if (polaroidHero) {
                    polaroidHero.classList.remove("is-deco-shake");
                }
            }, 560);
        }

        function showPolaroidDeco() {
            if (!modalCard || !polaroidHero || polaroidDeco) return;

            var pattern = decoPatterns[Math.floor(Math.random() * decoPatterns.length)];
            var cardRect = modalCard.getBoundingClientRect();
            var heroRect = polaroidHero.getBoundingClientRect();
            var heroLeft = heroRect.left - cardRect.left;
            var heroTop = heroRect.top - cardRect.top;
            var decoX = heroLeft + heroRect.width * 0.5;
            var decoY = heroTop + heroRect.height * 0.08;

            polaroidHero.style.setProperty("--shake-origin-x", String(((decoX - heroLeft) / Math.max(heroRect.width, 1)) * 100) + "%");
            polaroidHero.style.setProperty("--shake-origin-y", String(((decoY - heroTop) / Math.max(heroRect.height, 1)) * 100) + "%");

            shakePolaroid();

            polaroidDeco = document.createElement("div");
            polaroidDeco.className = "rasim-pc-deco is-" + pattern.type;
            polaroidDeco.style.setProperty("--deco-left", pattern.left);
            polaroidDeco.style.setProperty("--deco-top", pattern.top);
            polaroidDeco.style.setProperty("--deco-rotate", pattern.rotate);
            polaroidDeco.style.setProperty("--deco-color", pattern.color);
            polaroidDeco.style.setProperty("--deco-color-2", pattern.color2);

            modalCard.appendChild(polaroidDeco);
        }

        function dropPolaroidDeco() {
            if (decoTimer) {
                clearTimeout(decoTimer);
                decoTimer = null;
            }

            if (!polaroidDeco) return;

            var deco = polaroidDeco;
            polaroidDeco = null;
            deco.classList.add("is-dropping");

            setTimeout(function () {
                deco.remove();
            }, 760);
        }

        function showPolaroidNote() {
            if (!modalCard || !polaroidHero || polaroidNote) return;

            shakePolaroid();

            polaroidNote = document.createElement("div");
            polaroidNote.className = "rasim-pc-note";

            var title = document.createElement("span");
            title.className = "rasim-pc-note-title";
            title.textContent = "PICK UP ITEM";

            var text = document.createElement("p");
            text.className = "rasim-pc-note-text";
            text.textContent = getSelectedImageNoteText();

            var btn = document.createElement("a");
            var productUrl = getSelectedImageProductUrl();
            var target = getSelectedImageTarget();

            btn.className = "rasim-pc-note-btn";

            if (productUrl) {
                btn.href = productUrl;
            }

            if (target) {
                btn.target = target;

                if (target === "_blank") {
                    btn.rel = "noopener noreferrer";
                }
            }

            btn.textContent = "この商品を見る";

            polaroidNote.appendChild(title);
            polaroidNote.appendChild(text);
            polaroidNote.appendChild(btn);

            modalCard.appendChild(polaroidNote);
        }

        function dropPolaroidNote() {
            if (noteTimer) {
                clearTimeout(noteTimer);
                noteTimer = null;
            }

            if (!polaroidNote) return;

            var note = polaroidNote;
            polaroidNote = null;
            note.classList.add("is-dropping");

            setTimeout(function () {
                note.remove();
            }, 760);
        }

        function showPolaroidPostit() {
            if (!modalCard || !polaroidHero || polaroidPostit) return;

            var title = getSelectedImageTitle();
            var pattern = postitPatterns[Math.floor(Math.random() * postitPatterns.length)];

            debugToParent("showPolaroidPostit title check", {
                sourceTitle: polaroidSource && polaroidSource.dataset ? polaroidSource.dataset.rasimPcTitle || "" : "",
                sourceDescription: polaroidSource && polaroidSource.dataset ? polaroidSource.dataset.rasimPcNoteText || "" : "",
                sourceProductUrl: polaroidSource && polaroidSource.dataset ? polaroidSource.dataset.rasimPcProductUrl || "" : "",
                sourceTarget: polaroidSource && polaroidSource.dataset ? polaroidSource.dataset.rasimPcTarget || "" : "",
                hasModalCard: !!modalCard,
                hasPolaroidHero: !!polaroidHero,
                hasPolaroidPostit: !!polaroidPostit
            });

            if (!title) return;

            polaroidPostit = document.createElement("div");
            polaroidPostit.className = "rasim-pc-postit";
            polaroidPostit.style.setProperty("--postit-color", pattern.color);
            polaroidPostit.style.setProperty("--postit-color-2", pattern.color2);
            polaroidPostit.style.setProperty("--postit-rotate", pattern.rotate);

            var line1 = document.createElement("span");
            line1.textContent = title;

            polaroidPostit.appendChild(line1);

            modalCard.appendChild(polaroidPostit);
        }

        function dropPolaroidPostit() {
            if (postitTimer) {
                clearTimeout(postitTimer);
                postitTimer = null;
            }

            if (!polaroidPostit) return;

            var postit = polaroidPostit;
            polaroidPostit = null;
            postit.classList.add("is-dropping");

            setTimeout(function () {
                postit.remove();
            }, 760);
        }

        function showCloseHint() {
            if (!modalCard || closeHint) return;

            closeHint = document.createElement("div");
            closeHint.className = "rasim-pc-close-hint";
            closeHint.textContent = "写真をクリックで閉じる";
            modalCard.appendChild(closeHint);
        }

        function removeCloseHint() {
            if (!closeHint) return;

            closeHint.remove();
            closeHint = null;
        }

        function clearTimers() {
            [
                openTimer,
                decoTimer,
                noteTimer,
                postitTimer,
                introDecoTimer,
                closeFallbackTimer,
                autoSetupTimer
            ].forEach(function (timer) {
                if (timer) clearTimeout(timer);
            });

            openTimer = null;
            decoTimer = null;
            noteTimer = null;
            postitTimer = null;
            introDecoTimer = null;
            closeFallbackTimer = null;
            autoSetupTimer = null;
        }

        function setOpenLayoutToPhotoStageCenter(cardRect) {
            if (!modalCard || !modalStage || !cardRect) return;

            var stageRect = modalStage.getBoundingClientRect();
            var stageLeft = stageRect.left - cardRect.left;
            var stageTop = stageRect.top - cardRect.top;
            var openSize = Math.min(stageRect.width * 0.94, stageRect.height * 0.94);
            var openLeft = stageLeft + (stageRect.width - openSize) / 2;
            var openTop = stageTop + (stageRect.height - openSize) / 2;

            modalCard.style.setProperty("--rasim-pc-open-left", rasimToModalX(openLeft, cardRect));
            modalCard.style.setProperty("--rasim-pc-open-top", rasimToModalY(openTop, cardRect));
            modalCard.style.setProperty("--rasim-pc-open-width", rasimToModalX(openSize, cardRect));
            modalCard.style.setProperty("--rasim-pc-open-height", rasimToModalY(openSize, cardRect));

            modalCard.style.setProperty("--rasim-pc-deco-left", rasimToModalX(openLeft + openSize * 0.5, cardRect));
            modalCard.style.setProperty("--rasim-pc-deco-top", rasimToModalY(openTop + openSize * 0.02, cardRect));
            modalCard.style.setProperty("--rasim-pc-deco-x", rasimToModalX(openLeft + openSize * 0.5, cardRect));
            modalCard.style.setProperty("--rasim-pc-deco-y", rasimToModalY(openTop + openSize * 0.02, cardRect));

            modalCard.style.setProperty("--rasim-pc-note-left", rasimToModalX(openLeft + openSize * 0.5, cardRect));
            modalCard.style.setProperty("--rasim-pc-note-top", rasimToModalY(openTop + openSize * 0.84, cardRect));

            modalCard.style.setProperty("--rasim-pc-postit-left", rasimToModalX(openLeft - openSize * 0.08, cardRect));
            modalCard.style.setProperty("--rasim-pc-postit-top", rasimToModalY(openTop + openSize * 0.12, cardRect));

            modalCard.style.setProperty("--rasim-pc-hint-left", rasimToModalX(openLeft + openSize * 0.5, cardRect));
            modalCard.style.setProperty("--rasim-pc-hint-top", rasimToModalY(openTop - openSize * 0.1, cardRect));
        }

        function closePolaroid() {
            if (!isPolaroidOpen || !polaroidHero || !polaroidSource) return;

            if (openTimer) {
                clearTimeout(openTimer);
                openTimer = null;
            }

            if (closeFallbackTimer) {
                clearTimeout(closeFallbackTimer);
                closeFallbackTimer = null;
            }

            isPolaroidAnimating = true;

            var hero = polaroidHero;
            hero.removeEventListener("click", closePolaroid);

            dropPolaroidDeco();
            dropPolaroidNote();
            dropPolaroidPostit();
            removeCloseHint();

            hero.classList.remove("is-open");

            function finishClose() {
                if (closeFallbackTimer) {
                    clearTimeout(closeFallbackTimer);
                    closeFallbackTimer = null;
                }

                hero.removeEventListener("transitionend", finishClose);

                if (polaroidHero) {
                    polaroidHero.remove();
                    polaroidHero = null;
                }

                if (polaroidSource) {
                    polaroidSource.classList.remove("is-hero-source");
                }

                if (modalCard) {
                    modalCard.classList.remove("is-rasim-polaroid-open");
                }

                returnElements();

                introDecoTimer = setTimeout(showIntroCardDecos, 760);

                polaroidSource = null;
                isPolaroidOpen = false;
                isPolaroidAnimating = false;
            }

            hero.addEventListener("transitionend", finishClose, { once: true });
            closeFallbackTimer = setTimeout(finishClose, 980);
        }

        function openPolaroid(img) {
            if (!isEnabled || !modalCard || !img || isPolaroidOpen || isPolaroidAnimating || didMove) return;

            isPolaroidOpen = true;
            isPolaroidAnimating = true;
            polaroidSource = img;

            debugToParent("openPolaroid source dataset check", {
                title: img.dataset.rasimPcTitle || "",
                description: img.dataset.rasimPcNoteText || "",
                productUrl: img.dataset.rasimPcProductUrl || "",
                target: img.dataset.rasimPcTarget || "",
                className: img.className || ""
            });

            debugToParent("openPolaroid source dataset check", {
                title: img.dataset.rasimPcTitle || "",
                description: img.dataset.rasimPcNoteText || "",
                productUrl: img.dataset.rasimPcProductUrl || "",
                target: img.dataset.rasimPcTarget || "",
                className: img.className || ""
            });

            var cardRect = modalCard.getBoundingClientRect();
            var imgRect = img.getBoundingClientRect();

            polaroidHero = img.cloneNode(true);
            polaroidHero.className = "rasim-pc-polaroid-hero";
            polaroidHero.removeAttribute("id");
            polaroidHero.style.setProperty("--hero-left", rasimToModalX(imgRect.left - cardRect.left, cardRect));
            polaroidHero.style.setProperty("--hero-top", rasimToModalY(imgRect.top - cardRect.top, cardRect));
            polaroidHero.style.setProperty("--hero-width", rasimToModalX(imgRect.width, cardRect));
            polaroidHero.style.setProperty("--hero-height", rasimToModalY(imgRect.height, cardRect));
            setOpenLayoutToPhotoStageCenter(cardRect);

            modalCard.appendChild(polaroidHero);
            modalCard.classList.add("is-rasim-polaroid-open");
            img.classList.add("is-hero-source");

            dropIntroCardDecos();
            fallAwayElements();

            openTimer = setTimeout(function () {
                openTimer = null;

                requestAnimationFrame(function () {
                    if (!polaroidHero || !isPolaroidOpen) return;

                    polaroidHero.classList.add("is-open");
                    showCloseHint();

                    decoTimer = setTimeout(showPolaroidDeco, 660);
                    noteTimer = setTimeout(showPolaroidNote, 880);
                    postitTimer = setTimeout(showPolaroidPostit, 1040);

                    setTimeout(function () {
                        isPolaroidAnimating = false;
                    }, 820);
                });
            }, 520);

            polaroidHero.addEventListener("click", closePolaroid);
        }

        function onPointerDown(e) {
            pointerStartX = e.clientX;
            pointerStartY = e.clientY;
            didMove = false;
        }

        function onPointerMove(e) {
            if (
                Math.abs(e.clientX - pointerStartX) > 8 ||
                Math.abs(e.clientY - pointerStartY) > 8
            ) {
                didMove = true;
            }
        }

        function onImageClick(e) {
            e.preventDefault();
            e.stopPropagation();
            openPolaroid(e.currentTarget);
        }

        function preventDrag(e) {
            e.preventDefault();
        }

        function onKeyDown(e) {
            if (e.key === "Escape" && isPolaroidOpen) {
                closePolaroid();
            }
        }

        function scrollAlbumByDirection(direction) {
            if (!albumTrack) return;

            albumTrack.scrollBy({
                left: albumTrack.clientWidth * 0.72 * direction,
                behavior: "smooth"
            });
        }

        function onAlbumPrevClick(e) {
            e.preventDefault();
            e.stopPropagation();
            scrollAlbumByDirection(-1);
        }

        function onAlbumNextClick(e) {
            e.preventDefault();
            e.stopPropagation();
            scrollAlbumByDirection(1);
        }

        function bindAlbumImages() {
            albumImages.forEach(function (img) {
                img.addEventListener("pointerdown", onPointerDown);
                img.addEventListener("pointermove", onPointerMove);
                img.addEventListener("click", onImageClick);
                img.addEventListener("dragstart", preventDrag);
            });

            if (albumPrevBtn) {
                albumPrevBtn.addEventListener("click", onAlbumPrevClick);
            }

            if (albumNextBtn) {
                albumNextBtn.addEventListener("click", onAlbumNextClick);
            }

            document.addEventListener("keydown", onKeyDown);
        }

        function unbindAlbumImages() {
            albumImages.forEach(function (img) {
                img.removeEventListener("pointerdown", onPointerDown);
                img.removeEventListener("pointermove", onPointerMove);
                img.removeEventListener("click", onImageClick);
                img.removeEventListener("dragstart", preventDrag);
                img.classList.remove("is-hero-source");
            });

            if (albumPrevBtn) {
                albumPrevBtn.removeEventListener("click", onAlbumPrevClick);
            }

            if (albumNextBtn) {
                albumNextBtn.removeEventListener("click", onAlbumNextClick);
            }

            document.removeEventListener("keydown", onKeyDown);
        }

        function removeAlbum() {
            if (albumWrap) {
                albumWrap.remove();
            }

            albumWrap = null;
            albumTrack = null;
            albumPrevBtn = null;
            albumNextBtn = null;
            albumCaption = null;
            albumImages = [];
        }

        function buildAlbum(images) {
            removeAlbum();

            if (!modalStage || !images || images.length === 0) return;

            albumWrap = document.createElement("div");
            albumWrap.className = "rasim-pc-album-wrap";

            albumTrack = document.createElement("div");
            albumTrack.className = "rasim-pc-album-track";

            albumPrevBtn = document.createElement("button");
            albumPrevBtn.className = "rasim-pc-album-arrow is-prev";
            albumPrevBtn.type = "button";
            albumPrevBtn.setAttribute("aria-label", "前のアイテムへ");
            albumPrevBtn.textContent = "‹";

            albumNextBtn = document.createElement("button");
            albumNextBtn.className = "rasim-pc-album-arrow is-next";
            albumNextBtn.type = "button";
            albumNextBtn.setAttribute("aria-label", "次のアイテムへ");
            albumNextBtn.textContent = "›";

            images.forEach(function (src, index) {
                var galleryItems = Array.isArray(currentRasimGalleryItems) && currentRasimGalleryItems.length
                    ? currentRasimGalleryItems
                    : (
                        window.BrandModalRasimData &&
                        Array.isArray(window.BrandModalRasimData.galleryItems)
                            ? window.BrandModalRasimData.galleryItems
                            : []
                    );
                var galleryItem = galleryItems[index] || null;
                var description = galleryItem && galleryItem.description ? String(galleryItem.description) : "";
                var productUrl = galleryItem && galleryItem.link ? String(galleryItem.link) : "";
                var title = galleryItem && galleryItem.title ? String(galleryItem.title) : "";
                var fileName = galleryItem && galleryItem.fileName ? String(galleryItem.fileName) : "";
                var alt = galleryItem && galleryItem.alt ? String(galleryItem.alt) : "";
                var target = galleryItem && galleryItem.target ? String(galleryItem.target) : "";
                var img = document.createElement("img");

                img.className = "rasim-pc-gallery-img";
                img.src = src;
                img.alt = alt || title || fileName || "Rasi:m gallery " + String(index + 1);
                img.draggable = false;
                img.loading = "eager";

                if (title) {
                    img.dataset.rasimPcTitle = title;
                }

                if (description) {
                    img.dataset.rasimPcNoteText = description;
                    img.dataset.rasimPcDescription = description;
                }

                if (productUrl) {
                    img.dataset.rasimPcProductUrl = productUrl;
                }

                if (target) {
                    img.dataset.rasimPcTarget = target;
                }

                debugToParent("buildAlbum image dataset check", {
                    index: index,
                    datasetTitle: img.dataset.rasimPcTitle || "",
                    datasetDescription: img.dataset.rasimPcNoteText || "",
                    datasetProductUrl: img.dataset.rasimPcProductUrl || "",
                    datasetTarget: img.dataset.rasimPcTarget || ""
                });

                if (index === 0) {
                    img.classList.add("is-focused");
                }

                albumTrack.appendChild(img);
            });

            albumWrap.appendChild(albumTrack);
            albumWrap.appendChild(albumPrevBtn);
            albumWrap.appendChild(albumNextBtn);
            modalStage.appendChild(albumWrap);

            albumImages = Array.prototype.slice.call(albumTrack.querySelectorAll(".rasim-pc-gallery-img"));
        }

        function destroy() {
            clearTimers();
            clearIntroCardDecos();
            unbindAlbumImages();

            albumFallTargets().forEach(function (el) {
                clearCuteState(el);
                delete el.dataset.rasimPcCuteOpacity;
            });

            extraFallTargets().forEach(function (item) {
                clearCuteState(item.el);
                delete item.el.dataset.rasimPcCuteOpacity;
            });

            if (polaroidHero) {
                polaroidHero.removeEventListener("click", closePolaroid);
                polaroidHero.remove();
                polaroidHero = null;
            }

            if (polaroidDeco) {
                polaroidDeco.remove();
                polaroidDeco = null;
            }

            if (polaroidNote) {
                polaroidNote.remove();
                polaroidNote = null;
            }

            if (polaroidPostit) {
                polaroidPostit.remove();
                polaroidPostit = null;
            }

            if (storeSignImage) {
                storeSignImage.remove();
                storeSignImage = null;
            }

            removeCloseHint();

            if (polaroidSource) {
                polaroidSource.classList.remove("is-hero-source");
                polaroidSource = null;
            }

            removeAlbum();

            if (modalCard) {
                modalCard.classList.remove("is-rasim-ready", "is-rasim-polaroid-open");
                modalCard.style.removeProperty("--rasim-pc-open-left");
                modalCard.style.removeProperty("--rasim-pc-open-top");
                modalCard.style.removeProperty("--rasim-pc-open-size");
                modalCard.style.removeProperty("--rasim-pc-deco-left");
                modalCard.style.removeProperty("--rasim-pc-deco-top");
                modalCard.style.removeProperty("--rasim-pc-deco-x");
                modalCard.style.removeProperty("--rasim-pc-deco-y");
                modalCard.style.removeProperty("--rasim-pc-note-left");
                modalCard.style.removeProperty("--rasim-pc-note-top");
                modalCard.style.removeProperty("--rasim-pc-postit-left");
                modalCard.style.removeProperty("--rasim-pc-postit-top");
                modalCard.style.removeProperty("--rasim-pc-hint-left");
                modalCard.style.removeProperty("--rasim-pc-hint-top");
            }

            isEnabled = false;
            isPolaroidOpen = false;
            isPolaroidAnimating = false;

            modal = null;
            modalCard = null;
            modalViewer = null;
            modalStage = null;
            mainImage = null;
        }

        function setup(options) {
            options = options || {};

            debugToParent("SETUP entered", {
                enabled: !!options.enabled,
                optionsImagesLength: Array.isArray(options.images) ? options.images.length : 0,
                optionsGalleryItemsLength: Array.isArray(options.galleryItems) ? options.galleryItems.length : 0
            });

            destroy();
            injectStyle();

            var parts = getModalParts();

            modal = options.modal || parts.foundModal || null;
            modalCard = options.modalCard || parts.foundCard || null;
            modalViewer = options.modalTrack || options.modalViewer || parts.foundViewer || null;
            modalStage = options.modalStage || parts.foundStage || modalViewer || null;
            mainImage =
                (options.galleryImages && Array.prototype.slice.call(options.galleryImages)[0]) ||
                options.mainImage ||
                parts.foundMainImage ||
                null;

            isEnabled = !!options.enabled;

            if (
                !isEnabled ||
                !modal ||
                !modalCard ||
                !modalViewer ||
                !modalStage ||
                modal.getAttribute("data-active-brand") !== "rasim" ||
                modal.classList.contains("is-archive-mode")
            ) {
                debugToParent("SETUP blocked", {
                    isEnabled: isEnabled,
                    hasModal: !!modal,
                    hasModalCard: !!modalCard,
                    hasModalViewer: !!modalViewer,
                    hasModalStage: !!modalStage,
                    activeBrand: modal ? modal.getAttribute("data-active-brand") : "",
                    isArchiveMode: modal ? modal.classList.contains("is-archive-mode") : false
                });

                isEnabled = false;
                return;
            }

            var images = normalizeImages(options);

            debugToParent("SETUP images normalized", {
                imagesLength: images.length,
                firstImage: images[0] || "",
                windowImagesLength: window.BrandModalRasimData && Array.isArray(window.BrandModalRasimData.images) ? window.BrandModalRasimData.images.length : 0,
                windowGalleryItemsLength: window.BrandModalRasimData && Array.isArray(window.BrandModalRasimData.galleryItems) ? window.BrandModalRasimData.galleryItems.length : 0
            });

            currentRasimGalleryItems = [];

            if (options && Array.isArray(options.galleryItems)) {
                currentRasimGalleryItems = options.galleryItems.slice();

                if (window.BrandModalRasimData) {
                    window.BrandModalRasimData.galleryItems = options.galleryItems.slice();
                }
            } else if (
                window.BrandModalRasimData &&
                Array.isArray(window.BrandModalRasimData.galleryItems)
            ) {
                currentRasimGalleryItems = window.BrandModalRasimData.galleryItems.slice();
            }

            if (!images.length) {
                isEnabled = false;
                return;
            }

            modalCard.classList.add("is-rasim-ready");
            syncRasimPcInfoWithMobile();

            debugToParent("setup galleryItems check", {
                imagesLength: images.length,
                hasWindowGalleryItems: !!(window.BrandModalRasimData && Array.isArray(window.BrandModalRasimData.galleryItems)),
                windowGalleryItemsLength: window.BrandModalRasimData && Array.isArray(window.BrandModalRasimData.galleryItems) ? window.BrandModalRasimData.galleryItems.length : 0,
                hasCurrentGalleryItems: Array.isArray(currentRasimGalleryItems),
                currentGalleryItemsLength: Array.isArray(currentRasimGalleryItems) ? currentRasimGalleryItems.length : 0,
                firstGalleryItem: Array.isArray(currentRasimGalleryItems) ? currentRasimGalleryItems[0] : null
            });

            buildAlbum(images);
            bindAlbumImages();

            debugToParent("setup complete", {
                imagesLength: images.length,
                images: images,
                thumbImageCount: document.querySelectorAll(".pc-modal-thumb img").length,
                thumbButtonCount: document.querySelectorAll(".pc-modal-thumb").length,
                hasModal: !!modal,
                hasModalCard: !!modalCard,
                hasModalViewer: !!modalViewer,
                hasModalStage: !!modalStage,
                activeBrand: modal ? modal.getAttribute("data-active-brand") : null
            });
        }

        function setupFromDomIfActive() {
            var parts = getModalParts();

            if (
                !parts.foundModal ||
                !parts.foundCard ||
                !parts.foundViewer ||
                !parts.foundStage
            ) {
                return;
            }

            var hasWindowGalleryItems = !!(
                window.BrandModalRasimData &&
                Array.isArray(window.BrandModalRasimData.galleryItems) &&
                window.BrandModalRasimData.galleryItems.length
            );
            var needsSetup =
                !parts.foundCard.classList.contains("is-rasim-ready") ||
                (
                    hasWindowGalleryItems &&
                    (!Array.isArray(currentRasimGalleryItems) || !currentRasimGalleryItems.length)
                );

            debugToParent("AUTO setupFromDomIfActive check", {
                modalIsOpen: parts.foundModal.classList.contains("is-open"),
                activeBrand: parts.foundModal.getAttribute("data-active-brand"),
                isArchiveMode: parts.foundModal.classList.contains("is-archive-mode"),
                cardReady: parts.foundCard.classList.contains("is-rasim-ready"),
                hasWindowGalleryItems: hasWindowGalleryItems,
                currentGalleryItemsLength: Array.isArray(currentRasimGalleryItems) ? currentRasimGalleryItems.length : 0,
                needsSetup: needsSetup
            });

            if (
                parts.foundModal.classList.contains("is-open") &&
                parts.foundModal.getAttribute("data-active-brand") === "rasim" &&
                !parts.foundModal.classList.contains("is-archive-mode") &&
                needsSetup
            ) {
                setup({
                    enabled: true,
                    modal: parts.foundModal,
                    modalCard: parts.foundCard,
                    modalViewer: parts.foundViewer,
                    modalStage: parts.foundStage,
                    mainImage: parts.foundMainImage,
                    galleryItems: window.BrandModalRasimData && Array.isArray(window.BrandModalRasimData.galleryItems) ? window.BrandModalRasimData.galleryItems : []
                });
            }
        }

        function startAutoObserver() {
            if (autoObserver) {
                return;
            }

            autoObserver = new MutationObserver(function () {
                if (autoSetupTimer) {
                    clearTimeout(autoSetupTimer);
                }

                autoSetupTimer = setTimeout(setupFromDomIfActive, 80);
            });

            autoObserver.observe(document.documentElement, {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: ["class", "data-active-brand", "src"]
            });

            setTimeout(setupFromDomIfActive, 100);
            setTimeout(setupFromDomIfActive, 800);
            setTimeout(setupFromDomIfActive, 1600);
        }

        window.BrandModalRasim = {
            setup: setup,
            destroy: destroy,
            close: closePolaroid,
            isOpen: function () {
                return isPolaroidOpen;
            },
            setupFromDomIfActive: setupFromDomIfActive
        };

        window.addEventListener("message", onRasimBrandModalDataMessage);

        startAutoObserver();

        debugToParent("installed", {
            hasBrandModalRasim: !!window.BrandModalRasim
        });
    })();
}

export const rasimPcPolaroidCode = "(" + installBrandModalRasimPc.toString() + ")();";