// @ts-nocheck
function installBrandModalHelmettyPc() {
    (function () {
        var STYLE_ID = "brand-modal-helmetty-pc-style";

        var modal = null;
        var modalCard = null;
        var modalViewer = null;
        var modalStage = null;
        var mainImage = null;

        var albumWrap = null;
        var albumTrack = null;
        var albumCaption = null;
        var albumImages = [];

        var polaroidHero = null;
        var polaroidSource = null;
        var polaroidDeco = null;
        var polaroidNote = null;
        var polaroidPostit = null;
        var closeHint = null;

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

        function debugToParent(label, payload) {
            var message = {
                type: "helmettyPcAddonDebug",
                label: label,
                payload: payload || null
            };

            console.log("[DEBUG pc helmetty addon]", label, payload || "");

            try {
                if (window.parent && window.parent !== window) {
                    window.parent.postMessage(message, "*");
                }
            } catch (error) {
                console.log("[DEBUG pc helmetty addon] parent debug post failed", error);
            }
        }

        function injectStyle() {
            if (document.getElementById(STYLE_ID)) return;

            var style = document.createElement("style");
            style.id = STYLE_ID;

            style.textContent = [
                ".pc-brand-modal[data-active-brand=\"helmetty\"] .pc-modal-panel.is-helmetty-ready {",
                "  overflow: hidden;",
                "  background:",
                "    radial-gradient(circle at 18% 18%, rgba(255,255,255,0.62), transparent 32%),",
                "    radial-gradient(circle at 82% 72%, rgba(98,191,239,0.18), transparent 35%),",
                "    linear-gradient(90deg, rgba(255,126,179,0.022) 1px, transparent 1px),",
                "    linear-gradient(0deg, rgba(255,179,107,0.018) 1px, transparent 1px),",
                "    linear-gradient(135deg, #fff8df 0%, #f9efcf 48%, #ffe8f2 100%);",
                "  background-size: 100% 100%, 100% 100%, 18px 18px, 18px 18px, 100% 100%;",
                "  box-shadow: 0 40px 110px rgba(0,0,0,0.36), 0 0 0 1px rgba(255,126,179,0.16) inset;",
                "}",

                ".pc-brand-modal[data-active-brand=\"helmetty\"] .pc-modal-panel.is-helmetty-ready::before {",
                "  content: \"\";",
                "  position: absolute;",
                "  inset: 18px;",
                "  z-index: 1;",
                "  pointer-events: none;",
                "  border-radius: 14px;",
                "  background:",
                "    repeating-linear-gradient(90deg, rgba(255,126,179,0.9) 0 14px, transparent 14px 28px) top left / 100% 3px no-repeat,",
                "    repeating-linear-gradient(90deg, rgba(255,126,179,0.9) 0 14px, transparent 14px 28px) bottom left / 100% 3px no-repeat,",
                "    repeating-linear-gradient(180deg, rgba(255,126,179,0.9) 0 14px, transparent 14px 28px) top left / 3px 100% no-repeat,",
                "    repeating-linear-gradient(180deg, rgba(255,126,179,0.9) 0 14px, transparent 14px 28px) top right / 3px 100% no-repeat;",
                "}",

                ".pc-brand-modal[data-active-brand=\"helmetty\"] .pc-modal-panel.is-helmetty-ready::after {",
                "  content: \"HELMETTY PHOTO ALBUM\";",
                "  position: absolute;",
                "  right: 4.2vw;",
                "  bottom: 3.2vh;",
                "  z-index: 1;",
                "  color: rgba(184,63,120,0.14);",
                "  font-family: Jost, sans-serif;",
                "  font-size: clamp(2rem, 3.6vw, 5.4rem);",
                "  font-weight: 900;",
                "  letter-spacing: 0.12em;",
                "  pointer-events: none;",
                "  transform: rotate(-2deg);",
                "  white-space: nowrap;",
                "}",

                ".pc-brand-modal[data-active-brand=\"helmetty\"] .pc-modal-panel.is-helmetty-ready .pc-modal-info,",
                ".pc-brand-modal[data-active-brand=\"helmetty\"] .pc-modal-panel.is-helmetty-ready .pc-modal-viewer {",
                "  position: relative;",
                "  z-index: 4;",
                "}",

                ".pc-brand-modal[data-active-brand=\"helmetty\"] .pc-modal-panel.is-helmetty-ready .pc-modal-stage {",
                "  position: relative;",
                "  overflow: visible;",
                "  background: radial-gradient(circle at 50% 45%, rgba(255,255,255,0.58), transparent 60%), rgba(255,255,255,0.14);",
                "  border-radius: 14px;",
                "  box-shadow: 0 18px 48px rgba(184,63,120,0.12), 0 0 0 1px rgba(255,255,255,0.34) inset;",
                "}",

                ".pc-brand-modal[data-active-brand=\"helmetty\"] .pc-modal-panel.is-helmetty-ready .pc-modal-main-img,",
                ".pc-brand-modal[data-active-brand=\"helmetty\"] .pc-modal-panel.is-helmetty-ready .pc-modal-thumbs {",
                "  opacity: 0;",
                "  visibility: hidden;",
                "  pointer-events: none;",
                "}",

                ".helmetty-pc-album-wrap {",
                "  position: absolute;",
                "  inset: 0;",
                "  z-index: 8;",
                "  display: flex;",
                "  align-items: center;",
                "  justify-content: center;",
                "  overflow: visible;",
                "  pointer-events: auto;",
                "}",

                ".helmetty-pc-album-track {",
                "  width: 100%;",
                "  height: 100%;",
                "  display: flex;",
                "  align-items: center;",
                "  gap: clamp(24px, 2.2vw, 42px);",
                "  padding: 0 clamp(36px, 5vw, 82px);",
                "  overflow-x: auto;",
                "  overflow-y: visible;",
                "  scroll-snap-type: x mandatory;",
                "  scrollbar-width: thin;",
                "  -webkit-overflow-scrolling: touch;",
                "}",

                ".helmetty-pc-album-track::-webkit-scrollbar {",
                "  height: 8px;",
                "}",

                ".helmetty-pc-album-track::-webkit-scrollbar-track {",
                "  background: rgba(255,255,255,0.34);",
                "  border-radius: 999px;",
                "}",

                ".helmetty-pc-album-track::-webkit-scrollbar-thumb {",
                "  background: rgba(255,126,179,0.45);",
                "  border-radius: 999px;",
                "}",

                ".helmetty-pc-gallery-img {",
                "  box-sizing: content-box;",
                "  width: clamp(180px, 18vw, 300px);",
                "  height: clamp(180px, 18vw, 300px);",
                "  flex: 0 0 auto;",
                "  scroll-snap-align: center;",
                "  object-fit: cover;",
                "  border: solid rgba(255,255,255,0.97);",
                "  border-width: clamp(13px, 1vw, 20px) clamp(11px, 0.8vw, 17px) clamp(46px, 3vw, 72px);",
                "  border-radius: 8px;",
                "  background: #ffffff;",
                "  box-shadow: 0 26px 54px rgba(150,80,110,0.24), 0 8px 18px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.85) inset;",
                "  transform: rotate(-3deg) scale(0.9);",
                "  opacity: 0.72;",
                "  filter: brightness(0.96) saturate(1.08);",
                "  cursor: zoom-in;",
                "  user-select: none;",
                "  -webkit-user-drag: none;",
                "  transition: transform 0.58s var(--ease-silk, cubic-bezier(0.22, 1, 0.36, 1)), opacity 0.58s var(--ease-silk, cubic-bezier(0.22, 1, 0.36, 1)), filter 0.58s var(--ease-silk, cubic-bezier(0.22, 1, 0.36, 1)), box-shadow 0.58s var(--ease-silk, cubic-bezier(0.22, 1, 0.36, 1));",
                "}",

                ".helmetty-pc-gallery-img:nth-child(2n) {",
                "  transform: rotate(2.5deg) scale(0.9);",
                "}",

                ".helmetty-pc-gallery-img:nth-child(3n) {",
                "  transform: rotate(-1.5deg) scale(0.9);",
                "}",

                ".helmetty-pc-gallery-img:hover,",
                ".helmetty-pc-gallery-img.is-focused {",
                "  transform: rotate(0deg) scale(1);",
                "  opacity: 1;",
                "  filter: brightness(1) saturate(1.14);",
                "  box-shadow: 0 36px 72px rgba(150,80,110,0.32), 0 12px 28px rgba(0,0,0,0.24), 0 0 0 1px rgba(255,255,255,0.58) inset;",
                "}",

                ".helmetty-pc-album-caption {",
                "  position: absolute;",
                "  left: 50%;",
                "  bottom: clamp(24px, 3.4vh, 44px);",
                "  z-index: 9;",
                "  transform: translateX(-50%);",
                "  display: inline-flex;",
                "  align-items: center;",
                "  gap: 10px;",
                "  padding: 9px 18px 8px;",
                "  border-radius: 999px;",
                "  background: rgba(255,255,255,0.72);",
                "  border: 1px solid rgba(255,126,179,0.3);",
                "  box-shadow: 0 10px 24px rgba(150,80,110,0.12);",
                "  color: #B83F78;",
                "  font-family: Jost, sans-serif;",
                "  font-size: 0.72rem;",
                "  font-weight: 800;",
                "  letter-spacing: 0.15em;",
                "  text-transform: uppercase;",
                "  pointer-events: none;",
                "}",

                ".helmetty-pc-album-caption::before,",
                ".helmetty-pc-album-caption::after {",
                "  content: \"♡\";",
                "  color: #FF6FAE;",
                "  font-size: 0.9rem;",
                "  letter-spacing: 0;",
                "}",

                ".pc-brand-modal[data-active-brand=\"helmetty\"] .pc-modal-panel.is-helmetty-ready .brand-logo-banner,",
                ".pc-brand-modal[data-active-brand=\"helmetty\"] .pc-modal-panel.is-helmetty-ready .pc-modal-logo,",
                ".pc-brand-modal[data-active-brand=\"helmetty\"] .pc-modal-panel.is-helmetty-ready .modal-logo {",
                "  filter: drop-shadow(0 10px 18px rgba(184,63,120,0.16));",
                "}",

                ".pc-brand-modal[data-active-brand=\"helmetty\"] .pc-modal-panel.is-helmetty-ready .pc-modal-title,",
                ".pc-brand-modal[data-active-brand=\"helmetty\"] .pc-modal-panel.is-helmetty-ready .modal-title {",
                "  color: #FF5FA2;",
                "  font-family: 'Fredoka', 'Zen Maru Gothic', 'Hiragino Maru Gothic ProN', sans-serif;",
                "  font-weight: 900;",
                "  letter-spacing: 0.04em;",
                "  line-height: 1.08;",
                "  text-shadow: 1px 1px 0 #ffffff, 2px 2px 0 rgba(255,216,77,0.34);",
                "}",

                ".pc-brand-modal[data-active-brand=\"helmetty\"] .pc-modal-panel.is-helmetty-ready .pc-modal-desc,",
                ".pc-brand-modal[data-active-brand=\"helmetty\"] .pc-modal-panel.is-helmetty-ready .modal-desc,",
                ".pc-brand-modal[data-active-brand=\"helmetty\"] .pc-modal-panel.is-helmetty-ready .modal-desc.cute-shop-copy {",
                "  color: #B83F78;",
                "  font-family: 'Zen Maru Gothic', 'Hiragino Maru Gothic ProN', sans-serif;",
                "  font-weight: 700;",
                "  line-height: 1.55;",
                "  background: none;",
                "  border: 0;",
                "  border-radius: 0;",
                "  box-shadow: none;",
                "  padding: 0;",
                "  transform: rotate(-5deg);",
                "}",

                ".pc-brand-modal[data-active-brand=\"helmetty\"] .pc-modal-panel.is-helmetty-ready .pc-modal-link,",
                ".pc-brand-modal[data-active-brand=\"helmetty\"] .pc-modal-panel.is-helmetty-ready .modal-link-btn {",
                "  background: #62BFEF;",
                "  border: 2px solid rgba(255,143,86,0.86);",
                "  color: #ffffff;",
                "  font-family: 'Fredoka', 'Zen Maru Gothic', sans-serif;",
                "  font-weight: 900;",
                "  letter-spacing: 0.08em;",
                "  border-radius: 999px;",
                "  text-shadow: none;",
                "  box-shadow: 0 3px 0 rgba(255,143,86,0.42), 0 6px 12px rgba(98,191,239,0.28);",
                "}",

                ".pc-brand-modal[data-active-brand=\"helmetty\"] .pc-modal-panel.is-helmetty-polaroid-open .helmetty-pc-gallery-img.is-hero-source {",
                "  opacity: 0;",
                "  pointer-events: none;",
                "}",

                ".helmetty-pc-polaroid-hero {",
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

                ".helmetty-pc-polaroid-hero.is-open {",
                "  left: var(--helmetty-pc-open-left);",
                "  top: var(--helmetty-pc-open-top);",
                "  width: var(--helmetty-pc-open-size);",
                "  height: var(--helmetty-pc-open-size);",
                "  transform: rotate(0deg) translateX(0);",
                "  border-width: 1.05vw 0.9vw 4.1vw;",
                "  border-radius: 0.75vw;",
                "  box-shadow: 0 2.4vw 5.2vw rgba(0,0,0,0.44), 0 0 1.9vw rgba(255,255,255,0.56);",
                "}",

                ".helmetty-pc-polaroid-hero.is-deco-shake {",
                "  transform-origin: var(--shake-origin-x, 50%) var(--shake-origin-y, 0%);",
                "  animation: helmettyPcPolaroidDecoShake 0.52s cubic-bezier(0.18, 1.25, 0.4, 1);",
                "}",

                ".helmetty-pc-close-hint {",
                "  position: absolute;",
                "  left: var(--helmetty-pc-hint-left, 50%);",
                "  top: var(--helmetty-pc-hint-top);",
                "  z-index: 3044;",
                "  transform: translateX(-50%);",
                "  padding: 9px 18px 8px;",
                "  border-radius: 999px;",
                "  background: rgba(255,255,255,0.82);",
                "  border: 1px solid rgba(255,126,179,0.42);",
                "  color: #B83F78;",
                "  font-family: Jost, sans-serif;",
                "  font-size: 0.72rem;",
                "  font-weight: 800;",
                "  letter-spacing: 0.16em;",
                "  text-transform: uppercase;",
                "  box-shadow: 0 8px 20px rgba(0,0,0,0.12);",
                "  pointer-events: none;",
                "  opacity: 0;",
                "  animation: helmettyPcHintIn 0.5s cubic-bezier(0.18, 1.25, 0.4, 1) 0.95s forwards;",
                "}",

                ".helmetty-pc-deco {",
                "  position: absolute;",
                "  left: var(--helmetty-pc-deco-left, var(--deco-left, 50%));",
                "  top: var(--helmetty-pc-deco-top, var(--deco-top, 52px));",
                "  z-index: 3040;",
                "  pointer-events: none;",
                "  transform: translate(-50%, -50%) rotate(var(--deco-rotate, -8deg)) scale(0.2);",
                "  opacity: 0;",
                "  animation: helmettyPcPolaroidDecoPop 0.5s cubic-bezier(0.18, 1.45, 0.4, 1) forwards;",
                "}",

                ".helmetty-pc-deco.is-dropping {",
                "  animation: helmettyPcPolaroidDecoDrop 0.72s cubic-bezier(0.34, 0.01, 0.5, 1) forwards;",
                "}",

                ".helmetty-pc-deco.is-pin {",
                "  width: 34px;",
                "  height: 34px;",
                "  border-radius: 50%;",
                "  background: radial-gradient(circle at 35% 30%, rgba(255,255,255,0.95) 0 18%, transparent 19%), linear-gradient(135deg, var(--deco-color), var(--deco-color-2));",
                "  border: 2px solid rgba(90,20,55,0.28);",
                "  box-shadow: 0 7px 0 rgba(0,0,0,0.16), 0 12px 18px rgba(0,0,0,0.24), 0 0 0 4px rgba(255,255,255,0.45) inset;",
                "}",

                ".helmetty-pc-deco.is-pin::after {",
                "  content: \"\";",
                "  position: absolute;",
                "  left: 50%;",
                "  top: 27px;",
                "  width: 4px;",
                "  height: 24px;",
                "  background: rgba(80,80,80,0.55);",
                "  border-radius: 999px;",
                "  transform: translateX(-50%) rotate(8deg);",
                "  z-index: -1;",
                "}",

                ".helmetty-pc-deco.is-tape {",
                "  width: 46px;",
                "  height: 124px;",
                "  border-radius: 4px;",
                "  background: linear-gradient(90deg, rgba(255,255,255,0.62), rgba(255,255,255,0.2) 42%, transparent 72%), linear-gradient(135deg, rgba(255,255,255,0.72), var(--deco-color));",
                "  border: 1px solid var(--deco-color-2);",
                "  box-shadow: 0 5px 10px rgba(80,80,80,0.2);",
                "  opacity: 0.96;",
                "}",

                ".helmetty-pc-note {",
                "  position: absolute;",
                "  left: var(--helmetty-pc-note-left, 50%);",
                "  top: var(--helmetty-pc-note-top, auto);",
                "  z-index: 3041;",
                "  width: clamp(280px, 25vw, 360px);",
                "  padding: 18px 22px 20px;",
                "  background: linear-gradient(90deg, rgba(180,140,90,0.035) 1px, transparent 1px), linear-gradient(0deg, rgba(180,140,90,0.025) 1px, transparent 1px), linear-gradient(135deg, rgba(255,254,246,0.98), rgba(255,248,224,0.96));",
                "  background-size: 14px 14px, 14px 14px, 100% 100%;",
                "  border: 1px solid rgba(180,130,90,0.24);",
                "  border-radius: 8px;",
                "  box-shadow: 0 14px 26px rgba(0,0,0,0.18), 0 1px 0 rgba(255,255,255,0.88) inset;",
                "  color: #B83F78;",
                "  font-family: sans-serif;",
                "  text-align: center;",
                "  pointer-events: auto;",
                "  transform: translateX(-50%) rotate(-3deg) scale(0.2);",
                "  opacity: 0;",
                "  animation: helmettyPcPolaroidNotePop 0.54s cubic-bezier(0.18, 1.45, 0.4, 1) forwards;",
                "}",

                ".helmetty-pc-note.is-dropping {",
                "  pointer-events: none;",
                "  animation: helmettyPcPolaroidNoteDrop 0.72s cubic-bezier(0.34, 0.01, 0.5, 1) forwards;",
                "}",

                ".helmetty-pc-note-title {",
                "  display: block;",
                "  margin-bottom: 7px;",
                "  font-size: clamp(1rem, 1.2vw, 1.25rem);",
                "  font-weight: 900;",
                "  letter-spacing: 1px;",
                "  line-height: 1.2;",
                "  color: #FF6FAE;",
                "  text-shadow: 1px 1px 0 #ffffff, 3px 3px 0 rgba(255,216,77,0.34);",
                "}",

                ".helmetty-pc-note-text {",
                "  margin: 0 0 12px;",
                "  font-size: clamp(0.74rem, 0.82vw, 0.9rem);",
                "  font-weight: 700;",
                "  line-height: 1.45;",
                "  color: #B83F78;",
                "}",

                ".helmetty-pc-note-btn {",
                "  display: inline-block;",
                "  padding: 10px 32px 9px;",
                "  background: #62BFEF;",
                "  color: #FFFFFF;",
                "  border: 2px solid rgba(255,143,86,0.86);",
                "  border-radius: 999px;",
                "  font-size: 0.86rem;",
                "  font-weight: 900;",
                "  letter-spacing: 1px;",
                "  text-decoration: none;",
                "  white-space: nowrap;",
                "  box-shadow: 0 4px 0 rgba(255,143,86,0.42), 0 8px 16px rgba(98,191,239,0.28);",
                "}",

                ".helmetty-pc-postit {",
                "  position: absolute;",
                "  left: var(--helmetty-pc-postit-left);",
                "  top: var(--helmetty-pc-postit-top);",
                "  z-index: 3042;",
                "  width: 112px;",
                "  min-height: 92px;",
                "  padding: 18px 12px 12px;",
                "  background: linear-gradient(135deg, rgba(255,255,255,0.26), transparent 42%), linear-gradient(180deg, var(--postit-color), var(--postit-color-2));",
                "  border: 1px solid rgba(150,120,70,0.2);",
                "  border-radius: 6px 6px 12px 6px;",
                "  box-shadow: 0 12px 22px rgba(0,0,0,0.16), 0 1px 0 rgba(255,255,255,0.75) inset;",
                "  color: #B83F78;",
                "  font-family: sans-serif;",
                "  font-size: 0.96rem;",
                "  font-weight: 700;",
                "  letter-spacing: 1.2px;",
                "  line-height: 1.15;",
                "  text-align: center;",
                "  pointer-events: none;",
                "  transform: rotate(var(--postit-rotate, 5deg)) scale(0.2);",
                "  opacity: 0;",
                "  animation: helmettyPcPolaroidPostitPop 0.52s cubic-bezier(0.18, 1.45, 0.4, 1) forwards;",
                "}",

                ".helmetty-pc-postit.is-dropping {",
                "  animation: helmettyPcPolaroidPostitDrop 0.72s cubic-bezier(0.34, 0.01, 0.5, 1) forwards;",
                "}",

                ".helmetty-pc-fall-out {",
                "  animation: helmettyPcCuteFallOut 0.68s cubic-bezier(0.34, 0.01, 0.5, 1) forwards !important;",
                "  animation-delay: var(--fall-delay, 0s) !important;",
                "  pointer-events: none !important;",
                "}",

                ".helmetty-pc-return-in {",
                "  animation: helmettyPcCuteReturnIn 0.64s cubic-bezier(0.18, 1.25, 0.4, 1) both !important;",
                "  animation-delay: var(--return-delay, 0s) !important;",
                "}",

                ".helmetty-pc-logo-out {",
                "  animation: helmettyPcLogoFlyOut 0.74s cubic-bezier(0.34, 0.01, 0.5, 1) forwards !important;",
                "  animation-delay: var(--fall-delay, 0s) !important;",
                "  pointer-events: none !important;",
                "}",

                ".helmetty-pc-logo-in {",
                "  animation: helmettyPcLogoFlyIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both !important;",
                "  animation-delay: var(--return-delay, 0s) !important;",
                "}",

                ".helmetty-pc-note-out {",
                "  animation: helmettyPcNoteFlutterOut 0.78s cubic-bezier(0.34, 0.01, 0.5, 1) forwards !important;",
                "  animation-delay: var(--fall-delay, 0s) !important;",
                "  pointer-events: none !important;",
                "}",

                ".helmetty-pc-note-in {",
                "  animation: helmettyPcNoteFlutterIn 0.74s cubic-bezier(0.34, 1.56, 0.64, 1) both !important;",
                "  animation-delay: var(--return-delay, 0s) !important;",
                "}",

                ".helmetty-pc-button-out {",
                "  animation: helmettyPcButtonBounceOut 0.76s cubic-bezier(0.34, 0.01, 0.5, 1) forwards !important;",
                "  animation-delay: var(--fall-delay, 0s) !important;",
                "  pointer-events: none !important;",
                "}",

                ".helmetty-pc-button-in {",
                "  animation: helmettyPcButtonBounceIn 0.74s cubic-bezier(0.34, 1.56, 0.64, 1) both !important;",
                "  animation-delay: var(--return-delay, 0s) !important;",
                "}",

                "@keyframes helmettyPcCuteFallOut {",
                "  0% { opacity: var(--cute-opacity, 1); translate: 0 0; rotate: 0deg; scale: 1; }",
                "  18% { opacity: 1; translate: 0 -12px; rotate: var(--fall-rotate, -4deg); scale: 1.05; }",
                "  45% { opacity: 1; translate: var(--fall-sway, 22px) 58px; rotate: calc(var(--fall-rotate-end, 12deg) * 0.4); scale: 0.96; }",
                "  72% { opacity: 1; translate: calc(var(--fall-sway, 22px) * -1) 118px; rotate: var(--fall-rotate-end, 12deg); scale: 0.9; }",
                "  100% { opacity: 0; translate: 0 var(--fall-y, 180px); rotate: calc(var(--fall-rotate-end, 12deg) * 1.4); scale: 0.8; }",
                "}",

                "@keyframes helmettyPcCuteReturnIn {",
                "  0% { opacity: 0; translate: 0 var(--fall-y, 180px); rotate: calc(var(--fall-rotate-end, 12deg) * 1.4); scale: 0.8; }",
                "  35% { opacity: 1; translate: calc(var(--fall-sway, 22px) * -1) 118px; rotate: var(--fall-rotate-end, 12deg); scale: 0.92; }",
                "  60% { opacity: 1; translate: var(--fall-sway, 22px) 44px; rotate: calc(var(--fall-rotate-end, 12deg) * 0.4); scale: 1; }",
                "  82% { opacity: var(--cute-opacity, 1); translate: 0 -14px; rotate: var(--fall-rotate, -4deg); scale: 1.06; }",
                "  100% { opacity: var(--cute-opacity, 1); translate: 0 0; rotate: 0deg; scale: 1; }",
                "}",

                "@keyframes helmettyPcLogoFlyOut {",
                "  0% { opacity: var(--cute-opacity, 1); transform: translate(0,0) rotate(0deg) scale(1, 1); }",
                "  20% { opacity: 1; transform: translate(0,-8px) rotate(-3deg) scale(0.92, 1.18); }",
                "  45% { opacity: 1; transform: translate(-18px,-30px) rotate(-10deg) scale(1.04, 1.04); }",
                "  100% { opacity: 0; transform: translate(-54px, 190px) rotate(-28deg) scale(0.78, 0.78); }",
                "}",

                "@keyframes helmettyPcLogoFlyIn {",
                "  0% { opacity: 0; transform: translate(-54px, 190px) rotate(-28deg) scale(0.78, 0.78); }",
                "  55% { opacity: 1; transform: translate(6px,-14px) rotate(4deg) scale(1.08, 1.08); }",
                "  78% { opacity: 1; transform: translate(-3px, 3px) rotate(-2deg) scale(0.98, 0.98); }",
                "  100% { opacity: var(--cute-opacity, 1); transform: translate(0,0) rotate(0deg) scale(1, 1); }",
                "}",

                "@keyframes helmettyPcNoteFlutterOut {",
                "  0% { opacity: var(--cute-opacity, 1); transform: translate(0,0) rotate(-5deg) scale(1); }",
                "  18% { opacity: 1; transform: translate(0,-7px) rotate(-2deg) scale(1.08); }",
                "  40% { opacity: 1; transform: translate(20px, 26px) rotate(8deg) scale(1); }",
                "  65% { opacity: 1; transform: translate(-18px, 86px) rotate(-12deg) scale(0.96); }",
                "  100% { opacity: 0; transform: translate(16px, 205px) rotate(22deg) scale(0.85); }",
                "}",

                "@keyframes helmettyPcNoteFlutterIn {",
                "  0% { opacity: 0; transform: translate(16px, 205px) rotate(22deg) scale(0.85); }",
                "  50% { opacity: 1; transform: translate(-12px, 14px) rotate(-10deg) scale(1.04); }",
                "  75% { opacity: 1; transform: translate(6px, -6px) rotate(-2deg) scale(1.06); }",
                "  100% { opacity: var(--cute-opacity, 1); transform: translate(0,0) rotate(-5deg) scale(1); }",
                "}",

                "@keyframes helmettyPcButtonBounceOut {",
                "  0% { opacity: var(--cute-opacity, 1); transform: translateY(0) scale(1, 1) rotate(0deg); }",
                "  18% { opacity: 1; transform: translateY(6px) scale(1.22, 0.78) rotate(0deg); }",
                "  40% { opacity: 1; transform: translateY(-24px) scale(0.86, 1.18) rotate(0deg); }",
                "  65% { opacity: 1; transform: translateY(30px) scale(1.1, 0.92) rotate(6deg); }",
                "  100% { opacity: 0; transform: translateY(220px) scale(0.82, 0.82) rotate(-14deg); }",
                "}",

                "@keyframes helmettyPcButtonBounceIn {",
                "  0% { opacity: 0; transform: translateY(220px) scale(0.82, 0.82) rotate(-14deg); }",
                "  55% { opacity: 1; transform: translateY(-20px) scale(0.9, 1.15) rotate(0deg); }",
                "  75% { opacity: 1; transform: translateY(8px) scale(1.15, 0.88) rotate(0deg); }",
                "  90% { opacity: 1; transform: translateY(-4px) scale(0.97, 1.04) rotate(0deg); }",
                "  100% { opacity: var(--cute-opacity, 1); transform: translateY(0) scale(1, 1) rotate(0deg); }",
                "}",

                "@keyframes helmettyPcPolaroidDecoShake {",
                "  0% { transform: rotate(0deg) translateY(0); }",
                "  22% { transform: rotate(-2.4deg) translateY(3px); }",
                "  46% { transform: rotate(1.8deg) translateY(-2px); }",
                "  70% { transform: rotate(-0.9deg) translateY(1px); }",
                "  100% { transform: rotate(0deg) translateY(0); }",
                "}",

                "@keyframes helmettyPcPolaroidDecoPop {",
                "  0% { opacity: 0; transform: translate(-50%, -50%) rotate(var(--deco-rotate, -8deg)) scale(0.2); }",
                "  70% { opacity: 1; transform: translate(-50%, -50%) rotate(var(--deco-rotate, -8deg)) scale(1.18); }",
                "  100% { opacity: 1; transform: translate(-50%, -50%) rotate(var(--deco-rotate, -8deg)) scale(1); }",
                "}",

                "@keyframes helmettyPcPolaroidDecoDrop {",
                "  0% { opacity: 1; transform: translate(-50%, -50%) rotate(var(--deco-rotate, -8deg)) scale(1); }",
                "  18% { opacity: 1; transform: translate(-50%, calc(-50% - 10px)) rotate(calc(var(--deco-rotate, -8deg) + 8deg)) scale(1.06); }",
                "  100% { opacity: 0; transform: translate(-50%, 210px) rotate(calc(var(--deco-rotate, -8deg) + 34deg)) scale(0.82); }",
                "}",

                "@keyframes helmettyPcPolaroidNotePop {",
                "  0% { opacity: 0; transform: translateX(-50%) rotate(-3deg) scale(0.2); }",
                "  70% { opacity: 1; transform: translateX(-50%) rotate(-5deg) scale(1.08); }",
                "  100% { opacity: 1; transform: translateX(-50%) rotate(-3deg) scale(1); }",
                "}",

                "@keyframes helmettyPcPolaroidNoteDrop {",
                "  0% { opacity: 1; transform: translateX(-50%) rotate(-3deg) scale(1); }",
                "  18% { opacity: 1; transform: translateX(-50%) translateY(-10px) rotate(4deg) scale(1.04); }",
                "  100% { opacity: 0; transform: translateX(-50%) translateY(210px) rotate(-18deg) scale(0.82); }",
                "}",

                "@keyframes helmettyPcPolaroidPostitPop {",
                "  0% { opacity: 0; transform: rotate(var(--postit-rotate, 5deg)) scale(0.2); }",
                "  70% { opacity: 1; transform: rotate(calc(var(--postit-rotate, 5deg) + 3deg)) scale(1.12); }",
                "  100% { opacity: 1; transform: rotate(var(--postit-rotate, 5deg)) scale(1); }",
                "}",

                "@keyframes helmettyPcPolaroidPostitDrop {",
                "  0% { opacity: 1; transform: rotate(var(--postit-rotate, 5deg)) scale(1); }",
                "  18% { opacity: 1; transform: translateY(-10px) rotate(calc(var(--postit-rotate, 5deg) + 6deg)) scale(1.05); }",
                "  100% { opacity: 0; transform: translateY(210px) rotate(calc(var(--postit-rotate, 5deg) - 24deg)) scale(0.82); }",
                "}",

                "@keyframes helmettyPcHintIn {",
                "  0% { opacity: 0; transform: translateX(-50%) translateY(8px) scale(0.96); }",
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
                window.galleryData &&
                window.galleryData.helmetty &&
                Array.isArray(window.galleryData.helmetty.images)
            ) {
                for (i = 0; i < window.galleryData.helmetty.images.length; i += 1) {
                    if (window.galleryData.helmetty.images[i]) images.push(window.galleryData.helmetty.images[i]);
                }
            }

            Array.prototype.forEach.call(document.querySelectorAll(".pc-modal-thumb img"), function (thumbImg) {
                var src = thumbImg.getAttribute("src");
                if (src) images.push(src);
            });

            Array.prototype.forEach.call(document.querySelectorAll(".pc-modal-thumb"), function (thumb) {
                var src = thumb.getAttribute("data-src") || thumb.getAttribute("src");
                if (src) images.push(src);
            });

            if (mainImage && mainImage.getAttribute("src")) {
                images.push(mainImage.getAttribute("src"));
            }

            return images.filter(function (src, index, array) {
                return src && array.indexOf(src) === index;
            });
        }

        function syncHelmettyPcInfoWithMobile() {
            if (!modalCard) return;

            var logo = modalCard.querySelector(".brand-logo-banner") || modalCard.querySelector(".pc-modal-logo") || modalCard.querySelector(".modal-logo");
            var title = modalCard.querySelector(".pc-modal-title") || modalCard.querySelector(".modal-title");
            var desc = modalCard.querySelector(".modal-desc.cute-shop-copy") || modalCard.querySelector(".pc-modal-desc") || modalCard.querySelector(".modal-desc");
            var btn = modalCard.querySelector(".modal-link-btn") || modalCard.querySelector(".pc-modal-link");

            if (logo) {
                logo.classList.add("brand-logo-banner");
            }

            if (title) {
                title.textContent = "HELMETTY";
            }

            if (desc) {
                desc.classList.add("cute-shop-copy");
                desc.textContent = "ちょっとカワイイ毎日にぴったりのアイテムです";
            }

            if (btn) {
                btn.classList.add("modal-link-btn");
                btn.textContent = "この商品を見る";
            }
        }

        function clearCuteState(el) {
            if (!el) return;

            el.classList.remove(
                "helmetty-pc-fall-out",
                "helmetty-pc-return-in",
                "helmetty-pc-logo-out",
                "helmetty-pc-logo-in",
                "helmetty-pc-note-out",
                "helmetty-pc-note-in",
                "helmetty-pc-button-out",
                "helmetty-pc-button-in"
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
            var logo = modalCard.querySelector(".brand-logo-banner") || modalCard.querySelector(".pc-modal-logo") || modalCard.querySelector(".modal-logo");
            var title = modalCard.querySelector(".pc-modal-title") || modalCard.querySelector(".modal-title");
            var note = modalCard.querySelector(".pc-modal-desc") || modalCard.querySelector(".modal-desc.cute-shop-copy") || modalCard.querySelector(".modal-desc");
            var btn = modalCard.querySelector(".pc-modal-link") || modalCard.querySelector(".modal-link-btn");
            var caption = modalCard.querySelector(".helmetty-pc-album-caption");

            if (logo) items.push({ el: logo, kind: "logo" });
            if (title) items.push({ el: title, kind: "note" });
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
                el.dataset.helmettyPcCuteOpacity = originalOpacity;
                el.style.setProperty("--cute-opacity", originalOpacity);
                el.style.setProperty("--fall-delay", String(0.08 + index * 0.045) + "s");
                el.style.setProperty("--fall-y", String(150 + index * 10) + "px");
                el.style.setProperty("--fall-rotate", index % 2 === 0 ? "-5deg" : "5deg");
                el.style.setProperty("--fall-rotate-end", index % 2 === 0 ? "18deg" : "-18deg");
                el.style.setProperty("--fall-sway", index % 2 === 0 ? "24px" : "-24px");
                el.classList.add("helmetty-pc-fall-out");
            });

            var kindToClass = {
                logo: "helmetty-pc-logo-out",
                note: "helmetty-pc-note-out",
                button: "helmetty-pc-button-out"
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
                item.el.dataset.helmettyPcCuteOpacity = originalOpacity;
                item.el.style.setProperty("--cute-opacity", originalOpacity);
                item.el.style.setProperty("--fall-delay", String(order * 0.06) + "s");
                item.el.classList.add(kindToClass[item.kind] || "helmetty-pc-fall-out");
            });
        }

        function returnElements() {
            albumFallTargets().reverse().forEach(function (el, index) {
                var originalOpacity = el.dataset.helmettyPcCuteOpacity || "1";

                clearCuteState(el);
                void el.offsetWidth;

                el.style.setProperty("--cute-opacity", originalOpacity);
                el.style.setProperty("--return-delay", String(index * 0.045) + "s");
                el.style.setProperty("--fall-y", String(150 + index * 10) + "px");
                el.style.setProperty("--fall-rotate", index % 2 === 0 ? "-5deg" : "5deg");
                el.style.setProperty("--fall-rotate-end", index % 2 === 0 ? "18deg" : "-18deg");
                el.style.setProperty("--fall-sway", index % 2 === 0 ? "24px" : "-24px");
                el.classList.add("helmetty-pc-return-in");

                setTimeout(function () {
                    clearCuteState(el);
                    delete el.dataset.helmettyPcCuteOpacity;
                }, 1100);
            });

            var kindToClass = {
                logo: "helmetty-pc-logo-in",
                note: "helmetty-pc-note-in",
                button: "helmetty-pc-button-in"
            };

            var kindOrder = {
                button: 0,
                note: 2,
                logo: 3
            };

            extraFallTargets().forEach(function (item) {
                var originalOpacity = item.el.dataset.helmettyPcCuteOpacity || "1";
                var order = kindOrder[item.kind] != null ? kindOrder[item.kind] : 3;

                clearCuteState(item.el);
                void item.el.offsetWidth;

                item.el.style.setProperty("--cute-opacity", originalOpacity);
                item.el.style.setProperty("--return-delay", String(order * 0.07) + "s");
                item.el.classList.add(kindToClass[item.kind] || "helmetty-pc-return-in");

                setTimeout(function () {
                    clearCuteState(item.el);
                    delete item.el.dataset.helmettyPcCuteOpacity;
                }, 1100);
            });
        }

        var decoPatterns = [
            { type: "pin", left: "50%", top: "52px", rotate: "-6deg", color: "#E83B78", color2: "#FF78A8" },
            { type: "pin", left: "50%", top: "52px", rotate: "7deg", color: "#D94335", color2: "#FF8A66" },
            { type: "pin", left: "50%", top: "52px", rotate: "-4deg", color: "#6E63D9", color2: "#A390FF" },
            { type: "tape", left: "50%", top: "76px", rotate: "-4deg", color: "rgba(150,220,255,0.9)", color2: "rgba(80,170,220,0.38)" },
            { type: "tape", left: "50%", top: "76px", rotate: "4deg", color: "rgba(255,218,86,0.88)", color2: "rgba(230,180,40,0.42)" },
            { type: "tape", left: "50%", top: "80px", rotate: "3deg", color: "rgba(255,165,210,0.88)", color2: "rgba(255,126,179,0.42)" }
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
            var modalCardStyle = getComputedStyle(modalCard);
            var decoX = parseFloat(modalCardStyle.getPropertyValue("--helmetty-pc-deco-x")) || heroLeft + heroRect.width * 0.5;
            var decoY = parseFloat(modalCardStyle.getPropertyValue("--helmetty-pc-deco-y")) || heroTop + heroRect.height * 0.08;

            polaroidHero.style.setProperty("--shake-origin-x", String(decoX - heroLeft) + "px");
            polaroidHero.style.setProperty("--shake-origin-y", String(decoY - heroTop) + "px");

            shakePolaroid();

            polaroidDeco = document.createElement("div");
            polaroidDeco.className = "helmetty-pc-deco is-" + pattern.type;
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
            polaroidNote.className = "helmetty-pc-note";

            var title = document.createElement("span");
            title.className = "helmetty-pc-note-title";
            title.textContent = "Fancy Item";

            var text = document.createElement("p");
            text.className = "helmetty-pc-note-text";
            text.textContent = "ちょっとカワイイ毎日にぴったりのアイテムです";

            var btn = document.createElement("a");
            btn.className = "helmetty-pc-note-btn";
            btn.href = "#";
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

            var pattern = postitPatterns[Math.floor(Math.random() * postitPatterns.length)];

            polaroidPostit = document.createElement("div");
            polaroidPostit.className = "helmetty-pc-postit";
            polaroidPostit.style.setProperty("--postit-color", pattern.color);
            polaroidPostit.style.setProperty("--postit-color-2", pattern.color2);
            polaroidPostit.style.setProperty("--postit-rotate", pattern.rotate);

            var line1 = document.createElement("span");
            line1.textContent = pattern.text1;

            var br = document.createElement("br");

            var line2 = document.createElement("span");
            line2.textContent = pattern.text2;

            polaroidPostit.appendChild(line1);
            polaroidPostit.appendChild(br);
            polaroidPostit.appendChild(line2);

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
            closeHint.className = "helmetty-pc-close-hint";
            closeHint.textContent = "Click photo to close";
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
                closeFallbackTimer,
                autoSetupTimer
            ].forEach(function (timer) {
                if (timer) clearTimeout(timer);
            });

            openTimer = null;
            decoTimer = null;
            noteTimer = null;
            postitTimer = null;
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

            modalCard.style.setProperty("--helmetty-pc-open-left", String(openLeft) + "px");
            modalCard.style.setProperty("--helmetty-pc-open-top", String(openTop) + "px");
            modalCard.style.setProperty("--helmetty-pc-open-size", String(openSize) + "px");

            modalCard.style.setProperty("--helmetty-pc-deco-left", String(openLeft + openSize * 0.5) + "px");
            modalCard.style.setProperty("--helmetty-pc-deco-top", String(openTop + openSize * 0.02) + "px");
            modalCard.style.setProperty("--helmetty-pc-deco-x", String(openLeft + openSize * 0.5) + "px");
            modalCard.style.setProperty("--helmetty-pc-deco-y", String(openTop + openSize * 0.02) + "px");

            modalCard.style.setProperty("--helmetty-pc-note-left", String(openLeft + openSize * 0.5) + "px");
            modalCard.style.setProperty("--helmetty-pc-note-top", String(openTop + openSize * 0.84) + "px");

            modalCard.style.setProperty("--helmetty-pc-postit-left", String(openLeft - openSize * 0.08) + "px");
            modalCard.style.setProperty("--helmetty-pc-postit-top", String(openTop + openSize * 0.12) + "px");

            modalCard.style.setProperty("--helmetty-pc-hint-left", String(openLeft + openSize * 0.5) + "px");
            modalCard.style.setProperty("--helmetty-pc-hint-top", String(openTop - openSize * 0.1) + "px");
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
                    modalCard.classList.remove("is-helmetty-polaroid-open");
                }

                returnElements();

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

            var cardRect = modalCard.getBoundingClientRect();
            var imgRect = img.getBoundingClientRect();

            polaroidHero = img.cloneNode(true);
            polaroidHero.className = "helmetty-pc-polaroid-hero";
            polaroidHero.removeAttribute("id");
            polaroidHero.style.setProperty("--hero-left", String(imgRect.left - cardRect.left) + "px");
            polaroidHero.style.setProperty("--hero-top", String(imgRect.top - cardRect.top) + "px");
            polaroidHero.style.setProperty("--hero-width", String(imgRect.width) + "px");
            polaroidHero.style.setProperty("--hero-height", String(imgRect.height) + "px");
            setOpenLayoutToPhotoStageCenter(cardRect);

            modalCard.appendChild(polaroidHero);
            modalCard.classList.add("is-helmetty-polaroid-open");
            img.classList.add("is-hero-source");

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

        function bindAlbumImages() {
            albumImages.forEach(function (img) {
                img.addEventListener("pointerdown", onPointerDown);
                img.addEventListener("pointermove", onPointerMove);
                img.addEventListener("click", onImageClick);
                img.addEventListener("dragstart", preventDrag);
            });

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

            document.removeEventListener("keydown", onKeyDown);
        }

        function removeAlbum() {
            if (albumWrap) {
                albumWrap.remove();
            }

            albumWrap = null;
            albumTrack = null;
            albumCaption = null;
            albumImages = [];
        }

        function buildAlbum(images) {
            removeAlbum();

            if (!modalStage || !images || images.length === 0) return;

            albumWrap = document.createElement("div");
            albumWrap.className = "helmetty-pc-album-wrap";

            albumTrack = document.createElement("div");
            albumTrack.className = "helmetty-pc-album-track";

            images.forEach(function (src, index) {
                var img = document.createElement("img");
                img.className = "helmetty-pc-gallery-img";
                img.src = src;
                img.alt = "HELMETTY gallery " + String(index + 1);
                img.draggable = false;
                img.loading = "eager";

                if (index === 0) {
                    img.classList.add("is-focused");
                }

                albumTrack.appendChild(img);
            });

            albumCaption = document.createElement("div");
            albumCaption.className = "helmetty-pc-album-caption";
            albumCaption.textContent = "Choose a photo";

            albumWrap.appendChild(albumTrack);
            albumWrap.appendChild(albumCaption);
            modalStage.appendChild(albumWrap);

            albumImages = Array.prototype.slice.call(albumTrack.querySelectorAll(".helmetty-pc-gallery-img"));
        }

        function destroy() {
            clearTimers();
            unbindAlbumImages();

            albumFallTargets().forEach(function (el) {
                clearCuteState(el);
                delete el.dataset.helmettyPcCuteOpacity;
            });

            extraFallTargets().forEach(function (item) {
                clearCuteState(item.el);
                delete item.el.dataset.helmettyPcCuteOpacity;
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

            removeCloseHint();

            if (polaroidSource) {
                polaroidSource.classList.remove("is-hero-source");
                polaroidSource = null;
            }

            removeAlbum();

            if (modalCard) {
                modalCard.classList.remove("is-helmetty-ready", "is-helmetty-polaroid-open");
                modalCard.style.removeProperty("--helmetty-pc-open-left");
                modalCard.style.removeProperty("--helmetty-pc-open-top");
                modalCard.style.removeProperty("--helmetty-pc-open-size");
                modalCard.style.removeProperty("--helmetty-pc-deco-left");
                modalCard.style.removeProperty("--helmetty-pc-deco-top");
                modalCard.style.removeProperty("--helmetty-pc-deco-x");
                modalCard.style.removeProperty("--helmetty-pc-deco-y");
                modalCard.style.removeProperty("--helmetty-pc-note-left");
                modalCard.style.removeProperty("--helmetty-pc-note-top");
                modalCard.style.removeProperty("--helmetty-pc-postit-left");
                modalCard.style.removeProperty("--helmetty-pc-postit-top");
                modalCard.style.removeProperty("--helmetty-pc-hint-left");
                modalCard.style.removeProperty("--helmetty-pc-hint-top");
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
                modal.getAttribute("data-active-brand") !== "helmetty" ||
                modal.classList.contains("is-archive-mode")
            ) {
                isEnabled = false;
                return;
            }

            var images = normalizeImages(options);

            if (!images.length) {
                isEnabled = false;
                return;
            }

            modalCard.classList.add("is-helmetty-ready");
            syncHelmettyPcInfoWithMobile();

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

            if (
                parts.foundModal.classList.contains("is-open") &&
                parts.foundModal.getAttribute("data-active-brand") === "helmetty" &&
                !parts.foundModal.classList.contains("is-archive-mode") &&
                !parts.foundCard.classList.contains("is-helmetty-ready")
            ) {
                setup({
                    enabled: true,
                    modal: parts.foundModal,
                    modalCard: parts.foundCard,
                    modalViewer: parts.foundViewer,
                    modalStage: parts.foundStage,
                    mainImage: parts.foundMainImage
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

        window.BrandModalHelmetty = {
            setup: setup,
            destroy: destroy,
            close: closePolaroid,
            isOpen: function () {
                return isPolaroidOpen;
            },
            setupFromDomIfActive: setupFromDomIfActive
        };

        startAutoObserver();

        debugToParent("installed", {
            hasBrandModalHelmetty: !!window.BrandModalHelmetty
        });
    })();
}

export const helmettyPcPolaroidCode = "(" + installBrandModalHelmettyPc.toString() + ")();";