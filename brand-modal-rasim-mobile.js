// public/brand-modal/brand-modal-rasim-mobile.js
// @ts-nocheck
function installBrandModalRasim() {
    (() => {
        const STYLE_ID = 'brand-modal-rasim-style';

        let modal = null;
        let modalCard = null;
        let modalTrack = null;
        let galleryImages = [];
        let currentRasimGalleryItems = [];

        let polaroidHero = null;
        let polaroidSource = null;
        let polaroidDeco = null;
        let polaroidDecoTimer = null;
        let polaroidNote = null;
        let polaroidNoteTimer = null;
        let polaroidPostit = null;
        let polaroidPostitTimer = null;

        let isPolaroidOpen = false;
        let isPolaroidAnimating = false;
        let polaroidOpenTimer = null;
        let polaroidCloseFallbackTimer = null;
        let isEnabled = false;
        let pointerStartX = 0;
        let pointerStartY = 0;
        let didMove = false;

        const RASIM_MOBILE_MODAL_DATA = {
            cat: "Love at First Step.",
            titleHTML: "Rasi:m",
            watermark: "Rasi:m",
            logoUrl: "https://static.wixstatic.com/media/414ae9_bfc09f7d984144509a47326f6ab911f8~mv2.webp",
            desc: "<span class=\"rasim-pc-intro-copy-lead\">LADIES SHOES BRAND</span><span class=\"rasim-pc-intro-copy-main\">落ち着いた色と履きやすさを<br>大切にした靴のブランドです</span>",
            linkText: "ONLINE STORE ＞",
            linkUrl: "https://rasim20230110.square.site/",
            theme: { bg: "rgba(248,187,208,0.98)", text: "#FF4081", btn: "#0288D1", btnText: "#ffffff" }
        };

        window.BrandModalRasimData = Object.assign({}, RASIM_MOBILE_MODAL_DATA, window.BrandModalRasimData || {});

        const injectStyle = () => {
            if (document.getElementById(STYLE_ID)) return;

            const style = document.createElement('style');
            style.id = STYLE_ID;
            style.textContent = `
                .brand-modal[data-active-brand="rasim"] .brand-logo-banner {
                    display: block;
                }

                .brand-modal[data-active-brand="rasim"] .modal-title {
                    display: none;
                }

                .brand-modal[data-active-brand="rasim"] .modal-gallery-content {
                    background-color: #ffffff !important;
                    background-image: none !important;
                    background-size: auto !important;
                    --m-img: min(calc(153.6 * var(--rx)), calc(160 * var(--ru))) !important;
                }

                .brand-modal[data-active-brand="rasim"] .modal-gallery-content.is-rasim-polaroid-open {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    padding: calc(34 * var(--ry)) 0 !important;
                }

                .brand-modal[data-active-brand="rasim"] .swipe-indicator {
                    position: absolute !important;
                    left: 50% !important;
                    top: calc(172 * var(--ry)) !important;
                    transform: translateX(-50%) !important;
                    z-index: 9 !important;
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    gap: calc(5 * var(--rx)) !important;
                    margin-top: 0 !important;
                    color: var(--m-text) !important;
                    opacity: 0.88 !important;
                    font-size: clamp(calc(8 * var(--ru)), calc(0.6rem), calc(9.6 * var(--ru))) !important;
                    letter-spacing: calc(0.6 * var(--rx)) !important;
                    border: calc(1 * var(--ru)) solid rgba(255,126,179,0.28) !important;
                    border-radius: 999px !important;
                    padding:
                        calc(3 * var(--ry))
                        calc(8 * var(--rx)) !important;
                    white-space: nowrap !important;
                    font-family: var(--font-sans) !important;
                }

                .brand-modal[data-active-brand="rasim"] .swipe-line {
                    display: none !important;
                }

                .brand-modal[data-active-brand="rasim"] .swipe-dot {
                    width: calc(5 * var(--ru)) !important;
                    height: calc(5 * var(--ru)) !important;
                    border-radius: 50% !important;
                    background-color: var(--accent) !important;
                    animation: none !important;
                }

                .brand-modal[data-active-brand="rasim"] .modal-footer {
                    min-height: 0 !important;
                    text-align: center !important;
                    margin-top: 0 !important;
                    position: absolute !important;
                    left: 0 !important;
                    right: 0 !important;
                    bottom: calc(22 * var(--ry)) !important;
                    z-index: 9999 !important;
                    pointer-events: auto !important;
                }

                .brand-modal[data-active-brand="rasim"] .modal-link-btn {
                    position: relative !important;
                    z-index: 11 !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    min-height: calc(35 * var(--ry)) !important;
                    padding:
                        calc(8 * var(--ry))
                        calc(24 * var(--rx))
                        calc(8 * var(--ry)) !important;
                    background: linear-gradient(180deg, #efe0bd 0%, #c99d61 100%) !important;
                    border: calc(2 * var(--ru)) solid rgba(92,58,30,0.62) !important;
                    color: rgba(56,32,16,0.92) !important;
                    font-family: Jost, 'Hiragino Kaku Gothic ProN', 'Yu Gothic', YuGothic, Meiryo, sans-serif !important;
                    font-size: clamp(calc(9.6 * var(--ru)), calc(0.72rem), calc(11.52 * var(--ru))) !important;
                    font-weight: 600 !important;
                    letter-spacing: 0.16em !important;
                    border-radius: calc(10 * var(--ru)) !important;
                    text-decoration: none !important;
                    cursor: pointer !important;
                    text-shadow:
                        0 calc(1 * var(--ry)) 0 rgba(255,232,190,0.3),
                        0 calc(-1 * var(--ry)) 0 rgba(50,27,13,0.2) !important;
                    box-shadow:
                        0 calc(3 * var(--ry)) 0 rgba(92,58,30,0.38),
                        0 calc(8 * var(--ry)) calc(15 * var(--ru)) rgba(82,58,35,0.18),
                        0 calc(1 * var(--ry)) 0 rgba(255,254,241,0.78) inset !important;
                    transform: rotate(0deg) !important;
                    animation: none !important;
                    transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease !important;
                }

                .brand-modal[data-active-brand="rasim"] .modal-link-btn::before {
                    content: "";
                    display: none;
                }

                .brand-modal[data-active-brand="rasim"] .modal-link-btn::after {
                    content: "";
                    display: none;
                }

                @keyframes cuteCopyFloat {
                    0%,
                    100% {
                        transform: translateY(0) rotate(-2deg);
                    }

                    50% {
                        transform: translateY(calc(-5 * var(--ry))) rotate(2deg);
                    }
                }

                @keyframes cutePopHeart {
                    0%,
                    100% {
                        transform: scale(1) rotate(-18deg);
                    }

                    50% {
                        transform: scale(1.18) rotate(-8deg);
                    }
                }

                @keyframes cutePopStar {
                    0%,
                    100% {
                        transform: scale(1) rotate(14deg);
                    }

                    50% {
                        transform: scale(1.2) rotate(28deg);
                    }
                }

                .brand-modal[data-active-brand="rasim"] .cute-shop-copy {
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: calc(3.8 * var(--ry));
                    width: fit-content;
                    max-width: calc(267.52 * var(--rx));
                    margin:
                        calc(-10 * var(--ry))
                        auto
                        0;
                    padding:
                        calc(9.5 * var(--ry))
                        calc(20.9 * var(--rx))
                        calc(9.5 * var(--ry));
                    white-space: normal;
                    overflow: hidden;
                    text-overflow: clip;
                    color: rgba(61,36,19,0.84);
                    background:
                        linear-gradient(90deg, rgba(174,126,73,0.1), transparent 20%, rgba(255,255,255,0.16) 50%, transparent 80%, rgba(174,126,73,0.1)),
                        repeating-linear-gradient(2deg, rgba(118,76,38,0.12) 0, rgba(118,76,38,0.12) calc(1 * var(--ru)), rgba(255,241,206,0.1) calc(3 * var(--ru)), transparent calc(8 * var(--ru))),
                        linear-gradient(180deg, #f9e9c7 0%, #efd1a0 48%, #e0b477 100%);
                    border: calc(1 * var(--ru)) solid rgba(150,108,66,0.34);
                    border-radius: calc(9 * var(--ru));
                    box-shadow:
                        0 calc(8 * var(--ry)) calc(18 * var(--ru)) rgba(82,58,35,0.14),
                        0 calc(1 * var(--ry)) 0 rgba(255,254,241,0.82) inset,
                        0 calc(-5 * var(--ry)) calc(12 * var(--ru)) rgba(143,99,54,0.1) inset;
                    transform: rotate(-3deg);
                    animation: none;
                    will-change: transform;
                }

                .brand-modal[data-active-brand="rasim"] .cute-shop-copy::before,
                .brand-modal[data-active-brand="rasim"] .cute-shop-copy::after {
                    content: "";
                    position: absolute;
                    top: 12%;
                    z-index: 3;
                    width: calc(9 * var(--ru));
                    height: calc(9 * var(--ru));
                    border-radius: 50%;
                    background:
                        radial-gradient(circle at 35% 28%, rgba(255,255,255,0.96) 0 16%, transparent 17%),
                        linear-gradient(135deg, #f6df8a 0%, #c89635 48%, #8a5a19 100%);
                    border: calc(0.75 * var(--ru)) solid rgba(90,58,24,0.34);
                    box-shadow:
                        0 calc(1.5 * var(--ry)) 0 rgba(94,62,30,0.2),
                        0 calc(3 * var(--ry)) calc(6 * var(--ru)) rgba(82,58,35,0.18),
                        0 0 0 calc(1.4 * var(--ru)) rgba(255,255,255,0.28) inset;
                    pointer-events: none;
                }

                .brand-modal[data-active-brand="rasim"] .cute-shop-copy::before {
                    left: 6%;
                }

                .brand-modal[data-active-brand="rasim"] .cute-shop-copy::after {
                    right: 6%;
                }

                .brand-modal[data-active-brand="rasim"] .rasim-pc-intro-copy-lead {
                    position: relative;
                    z-index: 2;
                    display: block;
                    margin-bottom: calc(3.6 * var(--ry));
                    color: rgba(82,52,30,0.58);
                    font-family: Jost, 'Hiragino Kaku Gothic ProN', 'Yu Gothic', YuGothic, Meiryo, sans-serif;
                    font-size: clamp(calc(6.8 * var(--ru)), calc(0.53rem), calc(8.8 * var(--ru)));
                    font-weight: 800;
                    letter-spacing: 0.18em;
                    line-height: 1.2;
                    text-transform: uppercase;
                    text-shadow: 0 calc(1 * var(--ry)) 0 rgba(255,232,190,0.22);
                }

                .brand-modal[data-active-brand="rasim"] .rasim-pc-intro-copy-main {
                    position: relative;
                    z-index: 2;
                    display: block;
                    color: rgba(61,36,19,0.84);
                    font-family: 'Hiragino Kaku Gothic ProN', 'Yu Gothic', YuGothic, Meiryo, sans-serif;
                    font-size: clamp(calc(9.8 * var(--ru)), calc(0.76rem), calc(12.2 * var(--ru)));
                    font-weight: 600;
                    letter-spacing: 0.055em;
                    line-height: 1.56;
                    text-shadow:
                        0 calc(1 * var(--ry)) 0 rgba(255,232,190,0.24),
                        0 calc(-1 * var(--ry)) 0 rgba(50,27,13,0.18),
                        0 0 calc(4 * var(--ru)) rgba(74,42,20,0.14);
                    mix-blend-mode: multiply;
                }

                .brand-modal[data-active-brand="rasim"] .modal-track-wrap {
                    position: absolute !important;
                    left: 0 !important;
                    right: 0 !important;
                    top: calc(126 * var(--ry)) !important;
                    min-height: 0 !important;
                    width: 100% !important;
                    display: grid !important;
                    grid-template-rows: auto auto !important;
                    align-content: center !important;
                    align-items: center !important;
                    overflow: visible !important;
                    padding: calc(8 * var(--ry)) 0 !important;
                    z-index: 6 !important;
                    opacity: 1 !important;
                    transform: none !important;
                    pointer-events: auto !important;
                }

                .brand-modal[data-active-brand="rasim"] .modal-track {
                    opacity: 1 !important;
                    transform: none !important;
                    display: flex !important;
                    align-items: center !important;
                    width: 100% !important;
                    overflow-x: auto !important;
                    overflow-y: visible !important;
                    pointer-events: auto !important;
                }

                .brand-modal[data-active-brand="rasim"] .modal-close {
                    z-index: 9999 !important;
                    pointer-events: auto !important;
                }

                .brand-modal[data-active-brand="rasim"] .modal-header.modal-anim {
                    position: absolute !important;
                    left: 0 !important;
                    right: 0 !important;
                    top: calc(34 * var(--ry)) !important;
                    z-index: 8 !important;
                    opacity: 1 !important;
                    transform: none !important;
                    pointer-events: none !important;
                }

                .brand-modal[data-active-brand="rasim"] .brand-logo-banner {
                    display: block !important;
                    width: min(58.14%, calc(186.39 * var(--rx))) !important;
                    height: auto !important;
                    margin:
                        calc(-14 * var(--ry))
                        auto
                        calc(6 * var(--ry)) !important;
                    position: relative !important;
                    top: calc(-3 * var(--ry)) !important;
                    object-fit: contain !important;
                    filter: drop-shadow(0 calc(6 * var(--ry)) calc(10 * var(--ru)) rgba(184,63,120,0.16)) !important;
                }

                .brand-modal[data-active-brand="rasim"] .modal-desc.cute-shop-copy {
                    display: flex !important;
                    font-size: initial !important;
                    line-height: initial !important;
                    opacity: 1 !important;
                    max-width: 92% !important;
                    margin:
                        calc(-14 * var(--ry))
                        auto
                        0 !important;
                    white-space: normal !important;
                    overflow: hidden !important;
                    text-overflow: clip !important;
                    pointer-events: auto !important;
                }

                @media (max-height: 560px) {
                    .brand-modal[data-active-brand="rasim"] .modal-desc {
                        display: none !important;
                    }

                    .brand-modal[data-active-brand="rasim"] .modal-gallery-content {
                        padding:
                            calc(env(safe-area-inset-top, 0px) + calc(38 * var(--ry)))
                            0
                            calc(env(safe-area-inset-bottom, 0px) + calc(10 * var(--ry))) !important;
                        --m-img: min(calc(166.4 * var(--rx)), calc(221 * var(--ry)), calc(180 * var(--ru))) !important;
                    }

                    .brand-modal[data-active-brand="rasim"] .modal-divider {
                        margin: 0 auto calc(6 * var(--ry)) !important;
                    }

                    .brand-modal[data-active-brand="rasim"] .modal-title {
                        margin-bottom: calc(4 * var(--ry)) !important;
                    }

                    .brand-modal[data-active-brand="rasim"] .modal-track-wrap {
                        padding: calc(4 * var(--ry)) 0 !important;
                    }

                    .brand-modal[data-active-brand="rasim"] .swipe-indicator {
                        margin-top: calc(4 * var(--ry)) !important;
                        transform: scale(0.9) !important;
                    }

                    .brand-modal[data-active-brand="rasim"] .modal-footer {
                        margin-top: calc(4 * var(--ry)) !important;
                    }

                    .brand-modal[data-active-brand="rasim"] .modal-link-btn {
                        padding:
                            calc(8 * var(--ry))
                            calc(22 * var(--rx)) !important;
                    }
                }

                .brand-modal[data-active-brand="rasim"] .modal-watermark {
                    display: none !important;
                }


                .cute-click-particle {
                    position: fixed;
                    left: 0;
                    top: 0;
                    z-index: 9999;
                    pointer-events: none;
                    font-family: 'Zen Maru Gothic', 'Hiragino Maru Gothic ProN', sans-serif;
                    font-weight: 900;
                    line-height: 1;
                    text-shadow:
                        calc(1 * var(--rx)) calc(1 * var(--ry)) 0 #ffffff,
                        calc(2 * var(--rx)) calc(2 * var(--ry)) 0 rgba(255,216,77,0.65);
                    animation: cuteParticlePop 1s cubic-bezier(0.25, 1, 0.5, 1) forwards;
                    will-change: transform, opacity;
                }

                .cute-click-ring {
                    position: fixed;
                    left: 0;
                    top: 0;
                    z-index: 9998;
                    pointer-events: none;
                    width: calc(80 * var(--rx));
                    height: calc(80 * var(--rx));
                    margin-left: calc(-40 * var(--rx));
                    margin-top: calc(-40 * var(--rx));
                    border: calc(4 * var(--ru)) solid #FF7EB3;
                    border-radius: 50%;
                    opacity: 0;
                    animation: cuteRingExpand 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards;
                    will-change: transform, opacity;
                }

                @keyframes cuteParticlePop {
                    0% {
                        opacity: 0;
                        transform: translate(calc(var(--start-x) - 50%), calc(var(--start-y) - 50%)) scale(0.2) rotate(var(--r));
                    }

                    15% {
                        opacity: 1;
                        transform: translate(calc(var(--start-x) + var(--x) * 0.5 - 50%), calc(var(--start-y) + var(--y) * 0.5 - 50%)) scale(1.2) rotate(var(--r));
                    }

                    100% {
                        opacity: 0;
                        transform: translate(calc(var(--start-x) + var(--x) - 50%), calc(var(--start-y) + var(--y) + calc(20 * var(--ry)) - 50%)) scale(0.5) rotate(var(--r));
                    }
                }

                @keyframes cuteRingExpand {
                    0% {
                        transform: translate(var(--start-x), var(--start-y)) scale(0.3);
                        opacity: 0.8;
                        border-width: calc(8 * var(--ru));
                    }

                    100% {
                        transform: translate(var(--start-x), var(--start-y)) scale(2);
                        opacity: 0;
                        border-width: calc(1 * var(--ru));
                    }
                }

                .brand-modal[data-active-brand="rasim"] .modal-cat,
                .brand-modal[data-active-brand="rasim"] .modal-divider,
                .brand-modal[data-active-brand="rasim"] .modal-title {
                    display: none !important;
                    pointer-events: none !important;
                }

                .brand-modal[data-active-brand="rasim"] .modal-gallery-content.is-rasim-polaroid-open .modal-watermark {
                    display: none !important;
                    pointer-events: none !important;
                }

                .brand-modal[data-active-brand="rasim"] .modal-gallery-content.is-rasim-polaroid-open .modal-link-btn {
                    animation: none !important;
                }

                .brand-modal[data-active-brand="rasim"] .modal-gallery-content.is-rasim-polaroid-open .modal-link-btn.rasim-cute-button-out {
                    animation: rasimButtonBounceOut 0.72s cubic-bezier(0.34, 0.01, 0.5, 1) forwards !important;
                    animation-delay: var(--fall-delay, 0s) !important;
                }

                .brand-modal[data-active-brand="rasim"] .modal-gallery-content.is-rasim-polaroid-open .modal-link-btn.rasim-cute-button-in {
                    animation: rasimButtonBounceIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both !important;
                    animation-delay: var(--return-delay, 0s) !important;
                }

                .brand-modal[data-active-brand="rasim"] .modal-gallery-content.is-rasim-polaroid-open .modal-desc.cute-shop-copy.rasim-cute-note-out {
                    animation: rasimNoteFlutterOut 0.74s cubic-bezier(0.34, 0.01, 0.5, 1) forwards !important;
                    animation-delay: var(--fall-delay, 0s) !important;
                    opacity: 0 !important;
                    transform: translate(10px, 140px) rotate(22deg) scale(0.85) !important;
                }

                .brand-modal[data-active-brand="rasim"] .modal-gallery-content.is-rasim-polaroid-open .modal-desc.cute-shop-copy.rasim-cute-note-in {
                    animation: rasimNoteFlutterIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both !important;
                    animation-delay: var(--return-delay, 0s) !important;
                    transform: none !important;
                }

                .brand-modal[data-active-brand="rasim"] .modal-gallery-content.is-rasim-polaroid-open .swipe-indicator.rasim-cute-swipe-out {
                    animation: rasimSwipeOut 0.5s cubic-bezier(0.34, 0.01, 0.5, 1) forwards !important;
                    animation-delay: var(--fall-delay, 0s) !important;
                    opacity: 0 !important;
                    transform: translateX(-50%) translateY(40px) scale(0.7) !important;
                }

                .brand-modal[data-active-brand="rasim"] .modal-gallery-content.is-rasim-polaroid-open .swipe-indicator.rasim-cute-swipe-in {
                    animation: rasimSwipeIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both !important;
                    animation-delay: var(--return-delay, 0s) !important;
                    transform: none !important;
                }

                .modal-gallery-content.is-rasim-ready {
                    background-color: #ffffff;
                    background-image: none;
                    background-size: auto;
                }

                .modal-gallery-content.is-rasim-ready .modal-track-wrap {
                    position: relative;
                    z-index: 3;
                    width: 100%;
                    display: block;
                    padding: 0;
                    overflow: visible;
                }

                .modal-gallery-content.is-rasim-ready .modal-track {
                    display: flex;
                    align-items: center;
                    gap: 18px;
                    padding: 0 max(28px, calc(50vw - var(--m-img) / 2));
                    overflow-x: auto;
                    overflow-y: visible;
                    scroll-snap-type: x mandatory;
                    touch-action: pan-x;
                }

                .modal-gallery-content.is-rasim-ready .gallery-img {
                    box-sizing: content-box;
                    width: var(--m-img);
                    height: var(--m-img);
                    aspect-ratio: 1 / 1;
                    object-fit: cover;
                    border: solid rgba(255,255,255,0.96);
                    border-width: 10px 8px 30px;
                    border-radius: 5px;
                    background: #ffffff;
                    box-shadow:
                        0 16px 28px rgba(150,80,110,0.22),
                        0 4px 10px rgba(0,0,0,0.16);
                    transform: rotate(-2deg) scale(0.9);
                    opacity: 0.62;
                    filter: brightness(0.92) saturate(1.08);
                }

                .modal-gallery-content.is-rasim-ready .gallery-img:nth-child(even) {
                    transform: rotate(2deg) scale(0.9);
                }

                .modal-gallery-content.is-rasim-ready .gallery-img.is-focused {
                    transform: rotate(0deg) scale(1);
                    opacity: 1;
                    filter: brightness(1) saturate(1.12);
                }

                .modal-gallery-content.is-rasim-ready::before {
                    content: "";
                    position: absolute;
                    inset: 10px;
                    border-radius: 14px;
                    pointer-events: none;
                    z-index: 1;
                    border: 2px solid #FFD94A;
                }

                .modal-gallery-content.is-rasim-polaroid-open {
                    pointer-events: auto;
                }

                .modal-gallery-content.is-rasim-polaroid-open .gallery-img.is-hero-source {
                    opacity: 0;
                    pointer-events: none;
                }

                .modal-gallery-content.is-rasim-polaroid-open .modal-close {
                    z-index: 3060;
                }

                .rasim-cute-fall-out,
                .brand-modal[data-active-brand="rasim"] .modal-gallery-content .rasim-cute-fall-out {
                    animation: rasimCuteFallOut 0.62s cubic-bezier(0.34, 0.01, 0.5, 1) forwards !important;
                    animation-delay: var(--fall-delay, 0s) !important;
                    pointer-events: none !important;
                    will-change: translate, rotate, scale, opacity;
                }

                .rasim-cute-return-in,
                .brand-modal[data-active-brand="rasim"] .modal-gallery-content .rasim-cute-return-in {
                    animation: rasimCuteReturnIn 0.58s cubic-bezier(0.18, 1.25, 0.4, 1) both !important;
                    animation-delay: var(--return-delay, 0s) !important;
                    will-change: translate, rotate, scale, opacity;
                }

                .rasim-polaroid-hero {
                    position: absolute;
                    left: var(--hero-left);
                    top: var(--hero-top);
                    width: var(--hero-width);
                    height: var(--hero-height);
                    z-index: 3030;
                    box-sizing: border-box;
                    object-fit: cover;
                    border-radius: 4px;
                    border: solid rgba(255,255,255,0.95);
                    border-width: 12px 8px 34px;
                    background: #ffffff;
                    box-shadow:
                        0 24px 46px rgba(0,0,0,0.42),
                        0 8px 18px rgba(0,0,0,0.24),
                        0 0 18px rgba(255,255,255,0.55);
                    transform: rotate(0deg);
                    transform-origin: center center;
                    transition:
                        left 0.72s var(--ease-silk, cubic-bezier(0.22, 1, 0.36, 1)),
                        top 0.72s var(--ease-silk, cubic-bezier(0.22, 1, 0.36, 1)),
                        width 0.72s var(--ease-silk, cubic-bezier(0.22, 1, 0.36, 1)),
                        height 0.72s var(--ease-silk, cubic-bezier(0.22, 1, 0.36, 1)),
                        border-width 0.72s var(--ease-silk, cubic-bezier(0.22, 1, 0.36, 1)),
                        border-radius 0.72s var(--ease-silk, cubic-bezier(0.22, 1, 0.36, 1)),
                        box-shadow 0.72s var(--ease-silk, cubic-bezier(0.22, 1, 0.36, 1));
                    cursor: pointer;
                    user-select: none;
                    -webkit-user-drag: none;
                }

                .rasim-polaroid-hero.is-open {
                    left: 32px;
                    top: 38px;
                    width: calc(100% - 64px);
                    height: calc(100% - 118px);
                    border-width: 12px 9px 64px;
                    border-radius: 8px;
                    box-shadow:
                        0 26px 54px rgba(0,0,0,0.46),
                        0 0 24px rgba(255,255,255,0.56);
                }

                .rasim-polaroid-hero.is-deco-shake {
                    transform-origin: var(--shake-origin-x, 50%) var(--shake-origin-y, 0%);
                    animation: rasimPolaroidDecoShake 0.48s cubic-bezier(0.18, 1.25, 0.4, 1);
                }

                .rasim-polaroid-deco {
                    position: absolute;
                    left: var(--deco-left, 50%);
                    top: var(--deco-top, 38px);
                    z-index: 3040;
                    pointer-events: none;
                    transform: translate(-50%, -50%) rotate(var(--deco-rotate, -8deg)) scale(0.2);
                    opacity: 0;
                    animation: rasimPolaroidDecoPop 0.46s cubic-bezier(0.18, 1.45, 0.4, 1) forwards;
                    will-change: transform, opacity;
                }

                .rasim-polaroid-deco.is-dropping {
                    animation: rasimPolaroidDecoDrop 0.68s cubic-bezier(0.34, 0.01, 0.5, 1) forwards;
                }

                .rasim-polaroid-deco.is-pin {
                    width: 23px;
                    height: 23px;
                    border-radius: 50%;
                    background:
                        radial-gradient(circle at 35% 30%, rgba(255,255,255,0.95) 0 18%, transparent 19%),
                        linear-gradient(135deg, var(--deco-color), var(--deco-color-2));
                    border: 2px solid rgba(90, 20, 55, 0.28);
                    box-shadow:
                        0 5px 0 rgba(0,0,0,0.16),
                        0 8px 14px rgba(0,0,0,0.24),
                        0 0 0 3px rgba(255,255,255,0.45) inset;
                }

                .rasim-polaroid-deco.is-pin::after {
                    content: "";
                    position: absolute;
                    left: 50%;
                    top: 18px;
                    width: 3px;
                    height: 16px;
                    background: rgba(80,80,80,0.55);
                    border-radius: 999px;
                    transform: translateX(-50%) rotate(8deg);
                    z-index: -1;
                }

                .rasim-polaroid-deco.is-tape {
                    width: 30px;
                    height: 88px;
                    border-radius: 3px;
                    background:
                        linear-gradient(90deg, rgba(255,255,255,0.62), rgba(255,255,255,0.2) 42%, transparent 72%),
                        linear-gradient(135deg, rgba(255,255,255,0.72), var(--deco-color));
                    border: 1px solid var(--deco-color-2);
                    box-shadow: 0 3px 7px rgba(80,80,80,0.2);
                    opacity: 0.96;
                }

                .rasim-polaroid-note {
                    position: absolute;
                    left: 50%;
                    bottom: 24px;
                    z-index: 3041;
                    width: 214px;
                    padding: 13px 14px 14px;
                    background:
                        linear-gradient(90deg, rgba(180,140,90,0.035) 1px, transparent 1px),
                        linear-gradient(0deg, rgba(180,140,90,0.025) 1px, transparent 1px),
                        linear-gradient(135deg, rgba(255,254,246,0.98), rgba(255,248,224,0.96));
                    background-size: 12px 12px, 12px 12px, 100% 100%;
                    border: 1px solid rgba(180,130,90,0.24);
                    border-radius: 5px;
                    box-shadow:
                        0 10px 20px rgba(0,0,0,0.18),
                        0 1px 0 rgba(255,255,255,0.88) inset;
                    color: #B83F78;
                    font-family: 'Zen Maru Gothic', 'Hiragino Maru Gothic ProN', sans-serif;
                    text-align: center;
                    pointer-events: auto;
                    transform: translateX(-50%) rotate(-3deg) scale(0.2);
                    opacity: 0;
                    animation: rasimPolaroidNotePop 0.5s cubic-bezier(0.18, 1.45, 0.4, 1) forwards;
                    will-change: transform, opacity;
                }

                .rasim-polaroid-note.is-dropping {
                    pointer-events: none;
                    animation: rasimPolaroidNoteDrop 0.68s cubic-bezier(0.34, 0.01, 0.5, 1) forwards;
                }

                .rasim-polaroid-note-title {
                    display: block;
                    margin-bottom: 5px;
                    font-size: 0.86rem;
                    font-weight: 900;
                    letter-spacing: 0.8px;
                    line-height: 1.2;
                    color: #FF6FAE;
                    text-shadow:
                        1px 1px 0 #ffffff,
                        2px 2px 0 rgba(255,216,77,0.34);
                }

                .rasim-polaroid-note-text {
                    margin: 0 0 9px;
                    font-size: 0.62rem;
                    font-weight: 700;
                    line-height: 1.35;
                    color: #B83F78;
                }

                .rasim-polaroid-note-btn {
                    display: inline-block;
                    padding: 8px 24px 7px;
                    background: linear-gradient(180deg, #FFF9E8 0%, #F8EFCF 100%);
                    color: #8A6A3E;
                    border: 2px solid #E7C85A;
                    border-radius: 999px;
                    font-size: 0.78rem;
                    font-weight: 900;
                    letter-spacing: 0.8px;
                    text-decoration: none;
                    white-space: nowrap;
                    box-shadow:
                        0 3px 0 rgba(166,128,35,0.32),
                        0 6px 12px rgba(231,200,90,0.24),
                        0 1px 0 rgba(255,255,255,0.68) inset;
                }

                .rasim-polaroid-postit {
                    position: absolute;
                    right: 34px;
                    bottom: 148px;
                    z-index: 3042;
                    width: 78px;
                    min-height: 64px;
                    padding: 12px 8px 9px;
                    background:
                        linear-gradient(135deg, rgba(255,255,255,0.26), transparent 42%),
                        linear-gradient(180deg, var(--postit-color), var(--postit-color-2));
                    border: 1px solid rgba(150,120,70,0.2);
                    border-radius: 4px 4px 8px 4px;
                    box-shadow:
                        0 8px 16px rgba(0,0,0,0.16),
                        0 1px 0 rgba(255,255,255,0.75) inset;
                    color: #B83F78;
                    font-family: 'Fredoka', 'Zen Maru Gothic', sans-serif;
                    font-size: 0.72rem;
                    font-weight: 700;
                    letter-spacing: 1px;
                    line-height: 1.15;
                    text-align: center;
                    pointer-events: none;
                    transform: rotate(var(--postit-rotate, 5deg)) scale(0.2);
                    opacity: 0;
                    animation: rasimPolaroidPostitPop 0.48s cubic-bezier(0.18, 1.45, 0.4, 1) forwards;
                    will-change: transform, opacity;
                }

                .rasim-polaroid-postit::after {
                    content: "";
                    position: absolute;
                    right: 0;
                    bottom: 0;
                    width: 18px;
                    height: 18px;
                    background:
                        linear-gradient(135deg, rgba(255,255,255,0.45), rgba(0,0,0,0.08));
                    border-radius: 8px 0 7px 0;
                    opacity: 0.55;
                }

                .rasim-polaroid-postit.is-dropping {
                    animation: rasimPolaroidPostitDrop 0.68s cubic-bezier(0.34, 0.01, 0.5, 1) forwards;
                }

                @keyframes rasimCuteFallOut {
                    0% {
                        opacity: var(--cute-opacity, 1);
                        translate: 0 0;
                        rotate: 0deg;
                        scale: 1;
                    }
                    18% {
                        opacity: 1;
                        translate: 0 -8px;
                        rotate: var(--fall-rotate, -4deg);
                        scale: 1.05;
                    }
                    45% {
                        opacity: 1;
                        translate: var(--fall-sway, 14px) 40px;
                        rotate: calc(var(--fall-rotate-end, 12deg) * 0.4);
                        scale: 0.96;
                    }
                    72% {
                        opacity: 1;
                        translate: calc(var(--fall-sway, 14px) * -1) 80px;
                        rotate: var(--fall-rotate-end, 12deg);
                        scale: 0.9;
                    }
                    100% {
                        opacity: 0;
                        translate: 0 var(--fall-y, 120px);
                        rotate: calc(var(--fall-rotate-end, 12deg) * 1.4);
                        scale: 0.82;
                    }
                }

                @keyframes rasimCuteReturnIn {
                    0% {
                        opacity: 0;
                        translate: 0 var(--fall-y, 120px);
                        rotate: calc(var(--fall-rotate-end, 12deg) * 1.4);
                        scale: 0.82;
                    }
                    35% {
                        opacity: 1;
                        translate: calc(var(--fall-sway, 14px) * -1) 80px;
                        rotate: var(--fall-rotate-end, 12deg);
                        scale: 0.92;
                    }
                    60% {
                        opacity: 1;
                        translate: var(--fall-sway, 14px) 30px;
                        rotate: calc(var(--fall-rotate-end, 12deg) * 0.4);
                        scale: 1;
                    }
                    82% {
                        opacity: var(--cute-opacity, 1);
                        translate: 0 -10px;
                        rotate: var(--fall-rotate, -4deg);
                        scale: 1.06;
                    }
                    100% {
                        opacity: var(--cute-opacity, 1);
                        translate: 0 0;
                        rotate: 0deg;
                        scale: 1;
                    }
                }

                @keyframes rasimPolaroidDecoShake {
                    0% {
                        transform: rotate(0deg) translateY(0);
                    }
                    22% {
                        transform: rotate(-2.2deg) translateY(2px);
                    }
                    46% {
                        transform: rotate(1.7deg) translateY(-1px);
                    }
                    70% {
                        transform: rotate(-0.8deg) translateY(1px);
                    }
                    100% {
                        transform: rotate(0deg) translateY(0);
                    }
                }

                @keyframes rasimPolaroidDecoPop {
                    0% {
                        opacity: 0;
                        transform: translate(-50%, -50%) rotate(var(--deco-rotate, -8deg)) scale(0.2);
                    }
                    70% {
                        opacity: 1;
                        transform: translate(-50%, -50%) rotate(var(--deco-rotate, -8deg)) scale(1.18);
                    }
                    100% {
                        opacity: 1;
                        transform: translate(-50%, -50%) rotate(var(--deco-rotate, -8deg)) scale(1);
                    }
                }

                @keyframes rasimPolaroidDecoDrop {
                    0% {
                        opacity: 1;
                        transform: translate(-50%, -50%) rotate(var(--deco-rotate, -8deg)) scale(1);
                    }
                    18% {
                        opacity: 1;
                        transform: translate(-50%, calc(-50% - 8px)) rotate(calc(var(--deco-rotate, -8deg) + 8deg)) scale(1.06);
                    }
                    100% {
                        opacity: 0;
                        transform: translate(-50%, 150px) rotate(calc(var(--deco-rotate, -8deg) + 34deg)) scale(0.82);
                    }
                }

                @keyframes rasimPolaroidNotePop {
                    0% {
                        opacity: 0;
                        transform: translateX(-50%) rotate(-3deg) scale(0.2);
                    }
                    70% {
                        opacity: 1;
                        transform: translateX(-50%) rotate(-5deg) scale(1.08);
                    }
                    100% {
                        opacity: 1;
                        transform: translateX(-50%) rotate(-3deg) scale(1);
                    }
                }

                @keyframes rasimPolaroidNoteDrop {
                    0% {
                        opacity: 1;
                        transform: translateX(-50%) rotate(-3deg) scale(1);
                    }
                    18% {
                        opacity: 1;
                        transform: translateX(-50%) translateY(-8px) rotate(4deg) scale(1.04);
                    }
                    100% {
                        opacity: 0;
                        transform: translateX(-50%) translateY(150px) rotate(-18deg) scale(0.82);
                    }
                }

                @keyframes rasimPolaroidPostitPop {
                    0% {
                        opacity: 0;
                        transform: rotate(var(--postit-rotate, 5deg)) scale(0.2);
                    }
                    70% {
                        opacity: 1;
                        transform: rotate(calc(var(--postit-rotate, 5deg) + 3deg)) scale(1.12);
                    }
                    100% {
                        opacity: 1;
                        transform: rotate(var(--postit-rotate, 5deg)) scale(1);
                    }
                }


                .rasim-cute-logo-out {
                    animation: rasimLogoFlyOut 0.7s cubic-bezier(0.34, 0.01, 0.5, 1) forwards !important;
                    animation-delay: var(--fall-delay, 0s) !important;
                    pointer-events: none !important;
                    will-change: transform, opacity;
                }

                .rasim-cute-logo-in {
                    animation: rasimLogoFlyIn 0.66s cubic-bezier(0.34, 1.56, 0.64, 1) both !important;
                    animation-delay: var(--return-delay, 0s) !important;
                    will-change: transform, opacity;
                }

                .rasim-cute-note-out {
                    animation: rasimNoteFlutterOut 0.74s cubic-bezier(0.34, 0.01, 0.5, 1) forwards !important;
                    animation-delay: var(--fall-delay, 0s) !important;
                    pointer-events: none !important;
                    will-change: transform, opacity;
                }

                .rasim-cute-note-in {
                    animation: rasimNoteFlutterIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both !important;
                    animation-delay: var(--return-delay, 0s) !important;
                    will-change: transform, opacity;
                }

                .rasim-cute-button-out {
                    animation: rasimButtonBounceOut 0.72s cubic-bezier(0.34, 0.01, 0.5, 1) forwards !important;
                    animation-delay: var(--fall-delay, 0s) !important;
                    pointer-events: none !important;
                    will-change: transform, opacity;
                }

                .rasim-cute-button-in {
                    animation: rasimButtonBounceIn 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) both !important;
                    animation-delay: var(--return-delay, 0s) !important;
                    will-change: transform, opacity;
                }

                .rasim-cute-swipe-out {
                    animation: rasimSwipeOut 0.5s cubic-bezier(0.34, 0.01, 0.5, 1) forwards !important;
                    animation-delay: var(--fall-delay, 0s) !important;
                    pointer-events: none !important;
                }

                .rasim-cute-swipe-in {
                    animation: rasimSwipeIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both !important;
                    animation-delay: var(--return-delay, 0s) !important;
                }

                @keyframes rasimLogoFlyOut {
                    0%   { opacity: var(--cute-opacity, 1); transform: translate(0,0) rotate(0deg) scale(1, 1); }
                    20%  { opacity: 1; transform: translate(0,-6px) rotate(-3deg) scale(0.92, 1.18); }
                    45%  { opacity: 1; transform: translate(-12px,-22px) rotate(-10deg) scale(1.04, 1.04); }
                    100% { opacity: 0; transform: translate(-30px, 130px) rotate(-28deg) scale(0.78, 0.78); }
                }

                @keyframes rasimLogoFlyIn {
                    0%   { opacity: 0; transform: translate(-30px, 130px) rotate(-28deg) scale(0.78, 0.78); }
                    55%  { opacity: 1; transform: translate(4px,-10px) rotate(4deg) scale(1.08, 1.08); }
                    78%  { opacity: 1; transform: translate(-2px, 2px) rotate(-2deg) scale(0.98, 0.98); }
                    100% { opacity: var(--cute-opacity, 1); transform: translate(0,0) rotate(0deg) scale(1, 1); }
                }

                @keyframes rasimNoteFlutterOut {
                    0%   { opacity: var(--cute-opacity, 1); transform: translate(0,0) rotate(-5deg) scale(1); }
                    18%  { opacity: 1; transform: translate(0,-5px) rotate(-2deg) scale(1.08); }
                    40%  { opacity: 1; transform: translate(14px, 18px) rotate(8deg) scale(1); }
                    65%  { opacity: 1; transform: translate(-12px, 60px) rotate(-12deg) scale(0.96); }
                    100% { opacity: 0; transform: translate(10px, 140px) rotate(22deg) scale(0.85); }
                }

                @keyframes rasimNoteFlutterIn {
                    0%   { opacity: 0; transform: translate(10px, 140px) rotate(22deg) scale(0.85); }
                    50%  { opacity: 1; transform: translate(-8px, 10px) rotate(-10deg) scale(1.04); }
                    75%  { opacity: 1; transform: translate(4px, -4px) rotate(-2deg) scale(1.06); }
                    100% { opacity: var(--cute-opacity, 1); transform: translate(0,0) rotate(-5deg) scale(1); }
                }

                @keyframes rasimButtonBounceOut {
                    0%   { opacity: var(--cute-opacity, 1); transform: translateY(0) scale(1, 1) rotate(0deg); }
                    18%  { opacity: 1; transform: translateY(4px) scale(1.22, 0.78) rotate(0deg); }
                    40%  { opacity: 1; transform: translateY(-18px) scale(0.86, 1.18) rotate(0deg); }
                    65%  { opacity: 1; transform: translateY(20px) scale(1.1, 0.92) rotate(6deg); }
                    100% { opacity: 0; transform: translateY(150px) scale(0.82, 0.82) rotate(-14deg); }
                }

                @keyframes rasimButtonBounceIn {
                    0%   { opacity: 0; transform: translateY(150px) scale(0.82, 0.82) rotate(-14deg); }
                    55%  { opacity: 1; transform: translateY(-14px) scale(0.9, 1.15) rotate(0deg); }
                    75%  { opacity: 1; transform: translateY(6px) scale(1.15, 0.88) rotate(0deg); }
                    90%  { opacity: 1; transform: translateY(-3px) scale(0.97, 1.04) rotate(0deg); }
                    100% { opacity: var(--cute-opacity, 1); transform: translateY(0) scale(1, 1) rotate(0deg); }
                }

                @keyframes rasimSwipeOut {
                    0%   { opacity: var(--cute-opacity, 0.88); transform: translateY(0) scale(1); }
                    100% { opacity: 0; transform: translateY(40px) scale(0.7); }
                }

                @keyframes rasimSwipeIn {
                    0%   { opacity: 0; transform: translateY(40px) scale(0.7); }
                    70%  { opacity: 1; transform: translateY(-3px) scale(1.05); }
                    100% { opacity: var(--cute-opacity, 0.88); transform: translateY(0) scale(1); }
                }
            `;

            document.head.appendChild(style);
        };

           const fallTargets = () => {
            if (!modalCard) return [];

            return Array.from(galleryImages).filter(img => img !== polaroidSource);
        };

        const extraFallTargets = () => {
            if (!modalCard) return [];

            const root = modalCard;
            const items = [];

            const logo = root.querySelector('.brand-logo-banner');
            if (logo && logo.getAttribute('src')) {
                items.push({ el: logo, kind: 'logo' });
            }

            const note = root.querySelector('.modal-desc.cute-shop-copy');
            if (note) {
                items.push({ el: note, kind: 'note' });
            }

            const swipe = root.querySelector('.swipe-indicator');
            if (swipe) {
                items.push({ el: swipe, kind: 'swipe' });
            }

            const btn = root.querySelector('.modal-link-btn');
            if (btn) {
                items.push({ el: btn, kind: 'button' });
            }

            return items;
        };

        const clearCuteState = (el) => {
            el.classList.remove(
                'rasim-cute-fall-out',
                'rasim-cute-return-in',
                'rasim-cute-logo-out',
                'rasim-cute-logo-in',
                'rasim-cute-note-out',
                'rasim-cute-note-in',
                'rasim-cute-button-out',
                'rasim-cute-button-in',
                'rasim-cute-swipe-out',
                'rasim-cute-swipe-in'
            );
            el.style.removeProperty('--fall-delay');
            el.style.removeProperty('--return-delay');
            el.style.removeProperty('--fall-y');
            el.style.removeProperty('--fall-rotate');
            el.style.removeProperty('--fall-rotate-end');
            el.style.removeProperty('--fall-sway');
            el.style.removeProperty('--cute-opacity');
        };

        const fallAwayElements = () => {
            const imgs = fallTargets();
            const extras = extraFallTargets();
            const kindToClass = {
                logo: 'rasim-cute-logo-out',
                note: 'rasim-cute-note-out',
                button: 'rasim-cute-button-out',
                swipe: 'rasim-cute-swipe-out'
            };
            const kindOrder = { swipe: 0, logo: 1, note: 2, button: 5 };

            imgs.forEach((el, index) => {
                const originalOpacity = getComputedStyle(el).opacity || '1';

                clearCuteState(el);
                el.dataset.rasimCuteOpacity = originalOpacity;
                el.style.setProperty('--cute-opacity', originalOpacity);
                el.style.setProperty('--fall-delay', `${0.12 + index * 0.05}s`);
                el.style.setProperty('--fall-y', `${110 + index * 9}px`);
                el.style.setProperty('--fall-rotate', `${index % 2 === 0 ? -5 : 5}deg`);
                el.style.setProperty('--fall-rotate-end', `${index % 2 === 0 ? 16 : -16}deg`);
                el.style.setProperty('--fall-sway', `${index % 2 === 0 ? 16 : -16}px`);
                el.classList.add('rasim-cute-fall-out');
            });

            extras.forEach(({ el, kind }) => {
                const originalOpacity = getComputedStyle(el).opacity || '1';
                const order = kindOrder[kind] != null ? kindOrder[kind] : 3;

                clearCuteState(el);
                el.dataset.rasimCuteOpacity = originalOpacity;
                el.dataset.rasimCuteKind = kind;
                el.style.setProperty('--cute-opacity', originalOpacity);
                el.style.setProperty('--fall-delay', `${order * 0.06}s`);
                el.classList.add(kindToClass[kind]);
            });
        };

        const returnElements = () => {
            const imgs = fallTargets().reverse();
            const extras = extraFallTargets();
            const kindToClass = {
                logo: 'rasim-cute-logo-in',
                note: 'rasim-cute-note-in',
                button: 'rasim-cute-button-in',
                swipe: 'rasim-cute-swipe-in'
            };
            const kindOrder = { button: 0, note: 2, logo: 3, swipe: 4 };

            imgs.forEach((el, index) => {
                const originalOpacity = el.dataset.rasimCuteOpacity || '1';

                clearCuteState(el);

                void el.offsetWidth;

                el.style.setProperty('--cute-opacity', originalOpacity);
                el.style.setProperty('--return-delay', `${index * 0.05}s`);
                el.style.setProperty('--fall-y', `${110 + index * 9}px`);
                el.style.setProperty('--fall-rotate', `${index % 2 === 0 ? -5 : 5}deg`);
                el.style.setProperty('--fall-rotate-end', `${index % 2 === 0 ? 16 : -16}deg`);
                el.style.setProperty('--fall-sway', `${index % 2 === 0 ? 16 : -16}px`);
                el.classList.add('rasim-cute-return-in');

                setTimeout(() => {
                    clearCuteState(el);
                    delete el.dataset.rasimCuteOpacity;
                }, 1000);
            });

            extras.forEach(({ el, kind }) => {
                const originalOpacity = el.dataset.rasimCuteOpacity || '1';
                const order = kindOrder[kind] != null ? kindOrder[kind] : 3;

                clearCuteState(el);

                void el.offsetWidth;

                el.style.setProperty('--cute-opacity', originalOpacity);
                el.style.setProperty('--return-delay', `${order * 0.07}s`);
                el.classList.add(kindToClass[kind]);

                setTimeout(() => {
                    clearCuteState(el);
                    delete el.dataset.rasimCuteOpacity;
                    delete el.dataset.rasimCuteKind;
                }, 1000);
            });
        };

        const decoPatterns = [
            { type: 'pin', left: '50%', top: '34px', rotate: '-6deg', color: '#E83B78', color2: '#FF78A8' },
            { type: 'pin', left: '50%', top: '34px', rotate: '7deg', color: '#D94335', color2: '#FF8A66' },
            { type: 'pin', left: '50%', top: '34px', rotate: '-4deg', color: '#6E63D9', color2: '#A390FF' },
            { type: 'tape', left: '50%', top: '58px', rotate: '-4deg', color: 'rgba(150,220,255,0.9)', color2: 'rgba(80,170,220,0.38)' },
            { type: 'tape', left: '50%', top: '58px', rotate: '4deg', color: 'rgba(255,218,86,0.88)', color2: 'rgba(230,180,40,0.42)' },
            { type: 'tape', left: '50%', top: '60px', rotate: '3deg', color: 'rgba(255,165,210,0.88)', color2: 'rgba(255,126,179,0.42)' },
            { type: 'tape', left: '50%', top: '60px', rotate: '-3deg', color: 'rgba(170,235,195,0.88)', color2: 'rgba(70,180,120,0.38)' }
        ];

        const postitPatterns = [
            { text: 'PICK<br>UP', color: 'rgba(255,232,120,0.96)', color2: 'rgba(255,246,172,0.94)', rotate: '6deg' },
            { text: 'NEW<br>ITEM', color: 'rgba(255,174,214,0.94)', color2: 'rgba(255,218,236,0.92)', rotate: '-5deg' },
            { text: 'CUTE<br>♡', color: 'rgba(166,226,255,0.94)', color2: 'rgba(218,244,255,0.92)', rotate: '5deg' },
            { text: 'FANCY<br>★', color: 'rgba(190,238,196,0.94)', color2: 'rgba(226,250,224,0.92)', rotate: '-6deg' }
        ];

        const shakePolaroid = () => {
            if (!polaroidHero) return;

            polaroidHero.classList.remove('is-deco-shake');
            void polaroidHero.offsetWidth;
            polaroidHero.classList.add('is-deco-shake');

            setTimeout(() => {
                if (polaroidHero) {
                    polaroidHero.classList.remove('is-deco-shake');
                }
            }, 520);
        };

        const showPolaroidDeco = () => {
            if (!modalCard || !polaroidHero || polaroidDeco) return;

            const pattern = decoPatterns[Math.floor(Math.random() * decoPatterns.length)];

            const cardRect = modalCard.getBoundingClientRect();
            const heroRect = polaroidHero.getBoundingClientRect();
            const heroLeft = heroRect.left - cardRect.left;
            const heroTop = heroRect.top - cardRect.top;
            const decoX = pattern.left.includes('%')
                ? cardRect.width * parseFloat(pattern.left) / 100
                : parseFloat(pattern.left);
            const decoY = parseFloat(pattern.top);

            polaroidHero.style.setProperty('--shake-origin-x', `${decoX - heroLeft}px`);
            polaroidHero.style.setProperty('--shake-origin-y', `${decoY - heroTop}px`);
            shakePolaroid();

            polaroidDeco = document.createElement('div');
            polaroidDeco.className = `rasim-polaroid-deco is-${pattern.type}`;
            polaroidDeco.style.setProperty('--deco-left', pattern.left);
            polaroidDeco.style.setProperty('--deco-top', pattern.top);
            polaroidDeco.style.setProperty('--deco-rotate', pattern.rotate);
            polaroidDeco.style.setProperty('--deco-color', pattern.color);
            polaroidDeco.style.setProperty('--deco-color-2', pattern.color2);

            modalCard.appendChild(polaroidDeco);
        };

        const dropPolaroidDeco = () => {
            if (polaroidDecoTimer) {
                clearTimeout(polaroidDecoTimer);
                polaroidDecoTimer = null;
            }

            if (!polaroidDeco) return;

            const deco = polaroidDeco;
            polaroidDeco = null;
            deco.classList.add('is-dropping');

            setTimeout(() => {
                deco.remove();
            }, 700);
        };

        const getSelectedGalleryItem = () => {
            const index = galleryImages.indexOf(polaroidSource);

            if (index < 0 || !Array.isArray(currentRasimGalleryItems)) return null;

            return currentRasimGalleryItems[index] || null;
        };

        const getSelectedImageTitle = () => {
            const galleryItem = getSelectedGalleryItem();

            if (!polaroidSource || !polaroidSource.dataset) return "";

            return polaroidSource.dataset.rasimMobileTitle || (galleryItem && galleryItem.title ? String(galleryItem.title) : "");
        };

        const getSelectedImageNoteText = () => {
            const galleryItem = getSelectedGalleryItem();

            if (!polaroidSource || !polaroidSource.dataset) return "";

            return polaroidSource.dataset.rasimMobileNoteText || (galleryItem && galleryItem.description ? String(galleryItem.description) : "");
        };

        const getSelectedImageProductUrl = () => {
            const galleryItem = getSelectedGalleryItem();

            if (!polaroidSource || !polaroidSource.dataset) return "";

            return polaroidSource.dataset.rasimMobileProductUrl || (galleryItem && galleryItem.link ? String(galleryItem.link) : "");
        };

        const getSelectedImageTarget = () => {
            const galleryItem = getSelectedGalleryItem();

            if (!polaroidSource || !polaroidSource.dataset) return "";

            return polaroidSource.dataset.rasimMobileTarget || (galleryItem && galleryItem.target ? String(galleryItem.target) : "");
        };

        const showPolaroidNote = () => {
            if (!modalCard || !polaroidHero || polaroidNote) return;

            shakePolaroid();

            polaroidNote = document.createElement('div');
            polaroidNote.className = 'rasim-polaroid-note';

            const title = document.createElement('span');
            title.className = 'rasim-polaroid-note-title';
            title.textContent = 'PICK UP ITEM';

            const text = document.createElement('p');
            text.className = 'rasim-polaroid-note-text';
            text.textContent = getSelectedImageNoteText();

            const btn = document.createElement('a');
            const productUrl = getSelectedImageProductUrl();
            const target = getSelectedImageTarget() || '_blank';

            btn.className = 'rasim-polaroid-note-btn';
            btn.textContent = 'この商品を見る';

            if (productUrl) {
                btn.href = productUrl;
            } else {
                btn.href = '#';
            }

            if (target) {
                btn.target = target;

                if (target === '_blank') {
                    btn.rel = 'noopener noreferrer';
                }
            }

            btn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();

                if (!productUrl) return;

                if (target === '_blank') {
                    window.open(productUrl, '_blank', 'noopener,noreferrer');
                    return;
                }

                try {
                    if (window.parent && window.parent !== window) {
                        window.parent.postMessage({
                            type: 'NAVIGATE_TO_URL',
                            url: productUrl
                        }, '*');
                        return;
                    }
                } catch (error) {
                }

                window.location.href = productUrl;
            });

            polaroidNote.appendChild(title);
            polaroidNote.appendChild(text);
            polaroidNote.appendChild(btn);

            modalCard.appendChild(polaroidNote);
        };

        const dropPolaroidNote = () => {
            if (polaroidNoteTimer) {
                clearTimeout(polaroidNoteTimer);
                polaroidNoteTimer = null;
            }

            if (!polaroidNote) return;

            const note = polaroidNote;
            polaroidNote = null;
            note.classList.add('is-dropping');

            setTimeout(() => {
                note.remove();
            }, 700);
        };

        const showPolaroidPostit = () => {
            if (!modalCard || !polaroidHero || polaroidPostit) return;

            const title = getSelectedImageTitle();
            const pattern = postitPatterns[Math.floor(Math.random() * postitPatterns.length)];

            if (!title) return;

            polaroidPostit = document.createElement('div');
            polaroidPostit.className = 'rasim-polaroid-postit';
            polaroidPostit.textContent = title;
            polaroidPostit.style.setProperty('--postit-color', pattern.color);
            polaroidPostit.style.setProperty('--postit-color-2', pattern.color2);
            polaroidPostit.style.setProperty('--postit-rotate', pattern.rotate);

            modalCard.appendChild(polaroidPostit);
        };

        const dropPolaroidPostit = () => {
            if (polaroidPostitTimer) {
                clearTimeout(polaroidPostitTimer);
                polaroidPostitTimer = null;
            }

            if (!polaroidPostit) return;

            const postit = polaroidPostit;
            polaroidPostit = null;
            postit.classList.add('is-dropping');

            setTimeout(() => {
                postit.remove();
            }, 700);
        };

        const closePolaroid = () => {
            if (!isPolaroidOpen || !polaroidHero || !polaroidSource) return;

            if (polaroidOpenTimer) {
                clearTimeout(polaroidOpenTimer);
                polaroidOpenTimer = null;
            }

            if (polaroidCloseFallbackTimer) {
                clearTimeout(polaroidCloseFallbackTimer);
                polaroidCloseFallbackTimer = null;
            }

            isPolaroidAnimating = true;

            const hero = polaroidHero;
            hero.removeEventListener('click', closePolaroid);

            dropPolaroidDeco();
            dropPolaroidNote();
            dropPolaroidPostit();
            hero.classList.remove('is-open');

            const finishClose = () => {
                if (polaroidCloseFallbackTimer) {
                    clearTimeout(polaroidCloseFallbackTimer);
                    polaroidCloseFallbackTimer = null;
                }

                hero.removeEventListener('transitionend', finishClose);

                if (polaroidHero) {
                    polaroidHero.remove();
                    polaroidHero = null;
                }

                if (polaroidSource) {
                    polaroidSource.classList.remove('is-hero-source');
                }

                if (modalCard) {
                    modalCard.classList.remove('is-rasim-polaroid-open');
                }

                returnElements();

                polaroidSource = null;
                isPolaroidOpen = false;
                isPolaroidAnimating = false;
            };

            hero.addEventListener('transitionend', finishClose, { once: true });

            polaroidCloseFallbackTimer = setTimeout(finishClose, 900);
        };

        const openPolaroid = (img) => {
            if (!isEnabled || !modalCard || !img || isPolaroidOpen || isPolaroidAnimating || didMove) return;

            isPolaroidOpen = true;
            isPolaroidAnimating = true;
            polaroidSource = img;

            const cardRect = modalCard.getBoundingClientRect();
            const imgRect = img.getBoundingClientRect();

            polaroidHero = img.cloneNode(true);
            polaroidHero.className = 'rasim-polaroid-hero';
            polaroidHero.removeAttribute('id');
            polaroidHero.style.setProperty('--hero-left', `${imgRect.left - cardRect.left}px`);
            polaroidHero.style.setProperty('--hero-top', `${imgRect.top - cardRect.top}px`);
            polaroidHero.style.setProperty('--hero-width', `${imgRect.width}px`);
            polaroidHero.style.setProperty('--hero-height', `${imgRect.height}px`);

            modalCard.appendChild(polaroidHero);
            modalCard.classList.add('is-rasim-polaroid-open');
            img.classList.add('is-hero-source');

            fallAwayElements();

            polaroidOpenTimer = setTimeout(() => {
                polaroidOpenTimer = null;

                requestAnimationFrame(() => {
                    if (!polaroidHero || !isPolaroidOpen) return;

                    polaroidHero.classList.add('is-open');

                    polaroidDecoTimer = setTimeout(() => {
                        showPolaroidDeco();
                    }, 620);

                    polaroidNoteTimer = setTimeout(() => {
                        showPolaroidNote();
                    }, 820);

                    polaroidPostitTimer = setTimeout(() => {
                        showPolaroidPostit();
                    }, 980);

                    setTimeout(() => {
                        isPolaroidAnimating = false;
                    }, 760);
                });
            }, 500);

            polaroidHero.addEventListener('click', closePolaroid);
        };

        const onPointerDown = (e) => {
            pointerStartX = e.clientX;
            pointerStartY = e.clientY;
            didMove = false;
        };

        const onPointerMove = (e) => {
            if (Math.abs(e.clientX - pointerStartX) > 8 || Math.abs(e.clientY - pointerStartY) > 8) {
                didMove = true;
            }
        };

        const onImageClick = (e) => {
            e.preventDefault();
            e.stopPropagation();

            openPolaroid(e.currentTarget);
        };

        const preventDrag = (e) => {
            e.preventDefault();
        };

        const bindImages = () => {
            galleryImages.forEach((img, index) => {
                const galleryItem = Array.isArray(currentRasimGalleryItems) ? currentRasimGalleryItems[index] : null;

                img.addEventListener('pointerdown', onPointerDown);
                img.addEventListener('pointermove', onPointerMove);
                img.addEventListener('click', onImageClick);
                img.addEventListener('dragstart', preventDrag);

                if (galleryItem && img.dataset) {
                    img.dataset.rasimMobileTitle = galleryItem.title ? String(galleryItem.title) : "";
                    img.dataset.rasimMobileNoteText = galleryItem.description ? String(galleryItem.description) : "";
                    img.dataset.rasimMobileProductUrl = galleryItem.link ? String(galleryItem.link) : "";
                    img.dataset.rasimMobileTarget = galleryItem.target ? String(galleryItem.target) : "";
                }
            });
        };

        const unbindImages = () => {
            galleryImages.forEach(img => {
                img.removeEventListener('pointerdown', onPointerDown);
                img.removeEventListener('pointermove', onPointerMove);
                img.removeEventListener('click', onImageClick);
                img.removeEventListener('dragstart', preventDrag);
                img.classList.remove('is-hero-source');
            });
        };

        const getRasimMobileData = () => Object.assign({}, RASIM_MOBILE_MODAL_DATA, window.BrandModalRasimData || {});

        const applyRasimModalView = () => {
            if (!modalCard) return;

            const rasimData = getRasimMobileData();
            const logo = modalCard.querySelector('.brand-logo-banner');
            const title = modalCard.querySelector('.modal-title');
            const desc = modalCard.querySelector('.modal-desc');
            const btn = modalCard.querySelector('.modal-link-btn');

            if (logo && rasimData.logoUrl) {
                logo.src = rasimData.logoUrl;
                logo.alt = rasimData.watermark || rasimData.titleHTML || 'Rasi:m';
            }

            if (title) {
                title.innerHTML = '';
            }

            if (desc) {
                desc.classList.add('cute-shop-copy');
                desc.innerHTML = rasimData.desc || '';
            }

            if (btn) {
                btn.textContent = rasimData.linkText || '';
                btn.setAttribute('href', rasimData.linkUrl || 'https://rasim20230110.square.site/');
                btn.setAttribute('target', '_blank');
                btn.setAttribute('rel', 'noopener noreferrer');
            }
        };

        const destroy = () => {
            if (polaroidOpenTimer) {
                clearTimeout(polaroidOpenTimer);
                polaroidOpenTimer = null;
            }

            if (polaroidCloseFallbackTimer) {
                clearTimeout(polaroidCloseFallbackTimer);
                polaroidCloseFallbackTimer = null;
            }

            if (polaroidDecoTimer) {
                clearTimeout(polaroidDecoTimer);
                polaroidDecoTimer = null;
            }

            if (polaroidNoteTimer) {
                clearTimeout(polaroidNoteTimer);
                polaroidNoteTimer = null;
            }

            if (polaroidPostitTimer) {
                clearTimeout(polaroidPostitTimer);
                polaroidPostitTimer = null;
            }

            unbindImages();

            fallTargets().forEach(el => {
                clearCuteState(el);
                delete el.dataset.rasimCuteOpacity;
            });

            if (polaroidHero) {
                polaroidHero.removeEventListener('click', closePolaroid);
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

            if (polaroidSource) {
                polaroidSource.classList.remove('is-hero-source');
                polaroidSource = null;
            }

            if (modalCard) {
                modalCard.classList.remove('is-rasim-ready', 'is-rasim-polaroid-open');
            }

            isPolaroidOpen = false;
            isPolaroidAnimating = false;
            isEnabled = false;
            galleryImages = [];
            currentRasimGalleryItems = [];
        };

        const setup = (options = {}) => {
            destroy();

            isEnabled = !!options.enabled;

            if (!isEnabled) return;

            injectStyle();

            modal = options.modal || null;
            modalCard = options.modalCard || null;
            modalTrack = options.modalTrack || null;
            galleryImages = Array.from(options.galleryImages || []);

            currentRasimGalleryItems = [];

            if (Array.isArray(options.galleryItems)) {
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

            if (!modal || !modalCard || !modalTrack || galleryImages.length === 0) {
                isEnabled = false;
                return;
            }

            applyRasimModalView();

            modalCard.classList.add('is-rasim-ready');
            bindImages();
        };

        injectStyle();

        window.BrandModalRasim = {
            data: RASIM_MOBILE_MODAL_DATA,
            setup,
            destroy,
            close: closePolaroid,
            isOpen: () => isPolaroidOpen
        };
    })();
}

export const rasimPolaroidCode = '(' + installBrandModalRasim.toString() + ')();';
