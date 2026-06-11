// public/brand-modal/brand-modal-rasim-mobile.js
// @ts-nocheck
function installBrandModalRasim() {
    (() => {
        const STYLE_ID = 'brand-modal-rasim-style';

        let modal = null;
        let modalCard = null;
        let modalTrack = null;
        let galleryImages = [];

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
            logoUrl: "https://static.wixstatic.com/media/414ae9_65ab64b531c549699eb7420ea84e0c95~mv2.jpg",
            desc: `
                <small>CUTE FANCY SHOP</small>
                <span>ちょっとカワイイものを集めた<br>ファンシーなショップです</span>
            `,
            theme: { bg: "rgba(248,187,208,0.98)", text: "#FF4081", btn: "#0288D1", btnText: "#ffffff" }
        };

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
                    background-color: #F8EECF !important;
                    background-image:
                        linear-gradient(90deg, rgba(255,126,179,0.025) calc(1 * var(--ru)), transparent calc(1 * var(--ru))),
                        linear-gradient(0deg, rgba(255,179,107,0.018) calc(1 * var(--ru)), transparent calc(1 * var(--ru))),
                        radial-gradient(circle at 30% 20%, rgba(255,255,255,0.55), transparent 35%) !important;
                    background-size:
                        calc(14 * var(--rx)) calc(14 * var(--ry)),
                        calc(14 * var(--rx)) calc(14 * var(--ry)),
                        100% 100% !important;
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
                    display: inline-block !important;
                    padding:
                        calc(8 * var(--ry))
                        calc(21 * var(--rx))
                        calc(8 * var(--ry)) !important;
                    background: #FFE86F !important;
                    color: #B83F78 !important;
                    font-family: 'Zen Maru Gothic', 'Hiragino Maru Gothic ProN', sans-serif !important;
                    font-size: clamp(calc(9.6 * var(--ru)), calc(0.72rem), calc(11.52 * var(--ru))) !important;
                    font-weight: 900 !important;
                    letter-spacing: calc(0.7 * var(--rx)) !important;
                    border: calc(2 * var(--ru)) solid rgba(255,126,179,0.9) !important;
                    border-radius: 999px !important;
                    text-decoration: none !important;
                    text-transform: none !important;
                    box-shadow:
                        0 calc(2 * var(--ry)) 0 rgba(255,154,190,0.72),
                        0 calc(5 * var(--ry)) 0 rgba(255,205,64,0.50),
                        0 calc(9 * var(--ry)) calc(16 * var(--ru)) rgba(255,126,179,0.22) !important;
                    text-shadow:
                        calc(1 * var(--rx)) calc(1 * var(--ry)) 0 rgba(255,255,255,0.95),
                        calc(2 * var(--rx)) calc(2 * var(--ry)) 0 rgba(255,183,213,0.24) !important;
                    animation: cuteCopyFloat 2.8s ease-in-out infinite !important;
                    will-change: transform !important;
                }

                .brand-modal[data-active-brand="rasim"] .modal-link-btn::before {
                    content: "♥";
                    position: absolute;
                    left: calc(-12 * var(--rx));
                    top: calc(-12 * var(--ry));
                    color: #E83B3B;
                    font-size: clamp(calc(13 * var(--ru)), calc(1rem), calc(16 * var(--ru)));
                    font-weight: 900;
                    text-shadow:
                        calc(-0.5 * var(--rx)) calc(-0.5 * var(--ry)) 0 #111111,
                        calc(0.5 * var(--rx)) calc(-0.5 * var(--ry)) 0 #111111,
                        calc(-0.5 * var(--rx)) calc(0.5 * var(--ry)) 0 #111111,
                        calc(0.5 * var(--rx)) calc(0.5 * var(--ry)) 0 #111111,
                        calc(1 * var(--rx)) calc(1 * var(--ry)) 0 #ffffff;
                    transform: rotate(-18deg);
                    animation: cutePopHeart 1.8s ease-in-out infinite;
                    will-change: transform;
                }

                .brand-modal[data-active-brand="rasim"] .modal-link-btn::after {
                    content: "★";
                    position: absolute;
                    right: calc(-11 * var(--rx));
                    bottom: calc(-10 * var(--ry));
                    color: #8FDFFF;
                    font-size: clamp(calc(12 * var(--ru)), calc(0.95rem), calc(15.2 * var(--ru)));
                    text-shadow:
                        calc(-0.5 * var(--rx)) calc(-0.5 * var(--ry)) 0 #111111,
                        calc(0.5 * var(--rx)) calc(-0.5 * var(--ry)) 0 #111111,
                        calc(-0.5 * var(--rx)) calc(0.5 * var(--ry)) 0 #111111,
                        calc(0.5 * var(--rx)) calc(0.5 * var(--ry)) 0 #111111,
                        calc(1 * var(--rx)) calc(1 * var(--ry)) 0 #ffffff;
                    transform: rotate(14deg);
                    animation: cutePopStar 2.1s ease-in-out infinite;
                    will-change: transform;
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
                    gap: calc(3 * var(--ry));
                    width: fit-content;
                    max-width: calc(281.6 * var(--rx));
                    margin:
                        calc(-10 * var(--ry))
                        auto
                        0;
                    padding:
                        calc(9 * var(--ry))
                        calc(22 * var(--rx))
                        calc(9 * var(--ry));
                    white-space: normal;
                    overflow: visible;
                    text-overflow: clip;
                    color: #FF6FAE;
                    background:
                        linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(255,245,250,0.96) 52%, rgba(255,251,229,0.94) 100%);
                    border: calc(2 * var(--ru)) solid rgba(255,126,179,0.52);
                    border-radius: calc(9 * var(--ru));
                    box-shadow:
                        0 calc(2 * var(--ry)) 0 rgba(255,216,77,0.65),
                        0 calc(7 * var(--ry)) calc(16 * var(--ru)) rgba(255,126,179,0.20),
                        0 calc(1 * var(--ry)) 0 rgba(255,255,255,0.95) inset;
                    transform: rotate(-5deg);
                    animation: none;
                    will-change: transform;
                }

                .brand-modal[data-active-brand="rasim"] .cute-shop-copy::before {
                    content: "";
                    position: absolute;
                    left: calc(-12 * var(--rx));
                    top: calc(-10 * var(--ry));
                    width: calc(42 * var(--rx));
                    height: calc(15 * var(--ry));
                    background:
                        linear-gradient(135deg, rgba(255,255,255,0.72), rgba(150,220,255,0.9));
                    border: calc(1 * var(--ru)) solid rgba(80,170,220,0.38);
                    border-radius: calc(3 * var(--ru));
                    box-shadow: 0 calc(2 * var(--ry)) calc(5 * var(--ru)) rgba(80,170,220,0.18);
                    transform: rotate(-18deg);
                    animation: none;
                    will-change: transform;
                }

                .brand-modal[data-active-brand="rasim"] .cute-shop-copy::after {
                    content: "";
                    position: absolute;
                    right: calc(-11 * var(--rx));
                    bottom: calc(-8 * var(--ry));
                    width: calc(38 * var(--rx));
                    height: calc(14 * var(--ry));
                    background:
                        linear-gradient(135deg, rgba(255,255,255,0.72), rgba(255,218,86,0.88));
                    border: calc(1 * var(--ru)) solid rgba(230,180,40,0.42);
                    border-radius: calc(3 * var(--ru));
                    box-shadow: 0 calc(2 * var(--ry)) calc(5 * var(--ru)) rgba(230,180,40,0.18);
                    transform: rotate(16deg);
                    animation: none;
                    will-change: transform;
                }

                .brand-modal[data-active-brand="rasim"] .cute-shop-copy span {
                    font-family: 'Zen Maru Gothic', 'Hiragino Maru Gothic ProN', sans-serif;
                    font-size: clamp(calc(10 * var(--ru)), calc(0.78rem), calc(12.48 * var(--ru)));
                    font-weight: 900;
                    letter-spacing: calc(0.4 * var(--rx));
                    line-height: 1.18;
                    color: #FF6FAE;
                    white-space: nowrap;
                    text-shadow:
                        calc(1 * var(--rx)) calc(1 * var(--ry)) 0 #ffffff,
                        calc(2 * var(--rx)) calc(2 * var(--ry)) 0 rgba(255,216,77,0.32);
                }

                .brand-modal[data-active-brand="rasim"] .cute-shop-copy small {
                    font-family: 'Fredoka', 'Zen Maru Gothic', sans-serif;
                    font-size: clamp(calc(8 * var(--ru)), calc(0.56rem), calc(8.96 * var(--ru)));
                    font-weight: 700;
                    letter-spacing: calc(1.1 * var(--rx));
                    line-height: 1.05;
                    color: #FF9A66;
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
                    width: min(66%, calc(210 * var(--rx))) !important;
                    height: auto !important;
                    margin:
                        calc(-14 * var(--ry))
                        auto
                        calc(6 * var(--ry)) !important;
                    object-fit: contain !important;
                }

                .brand-modal[data-active-brand="rasim"] .modal-desc.cute-shop-copy {
                    display: flex !important;
                    font-size: initial !important;
                    line-height: initial !important;
                    opacity: 1 !important;
                    max-width: 96% !important;
                    margin:
                        calc(-14 * var(--ry))
                        auto
                        0 !important;
                    white-space: normal !important;
                    overflow: visible !important;
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
                    background-color: #F8EECF;
                    background-image:
                        linear-gradient(90deg, rgba(255,126,179,0.025) 1px, transparent 1px),
                        linear-gradient(0deg, rgba(255,179,107,0.018) 1px, transparent 1px),
                        radial-gradient(circle at 30% 20%, rgba(255,255,255,0.55), transparent 35%);
                    background-size: 14px 14px, 14px 14px, 100% 100%;
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
                    border-radius: 6px;
                    pointer-events: none;
                    z-index: 1;
                    background:
                        repeating-linear-gradient(90deg, rgba(255,126,179,0.9) 0 14px, transparent 14px 28px) top left / 100% 3px no-repeat,
                        repeating-linear-gradient(90deg, rgba(255,126,179,0.9) 0 14px, transparent 14px 28px) bottom left / 100% 3px no-repeat,
                        repeating-linear-gradient(180deg, rgba(255,126,179,0.9) 0 14px, transparent 14px 28px) top left / 3px 100% no-repeat,
                        repeating-linear-gradient(180deg, rgba(255,126,179,0.9) 0 14px, transparent 14px 28px) top right / 3px 100% no-repeat;
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
                    background: #62BFEF;
                    color: #FFFFFF;
                    border: 2px solid rgba(255,143,86,0.86);
                    border-radius: 999px;
                    font-size: 0.78rem;
                    font-weight: 900;
                    letter-spacing: 0.8px;
                    text-decoration: none;
                    white-space: nowrap;
                    box-shadow:
                        0 3px 0 rgba(255,143,86,0.42),
                        0 6px 12px rgba(98,191,239,0.28);
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

        const showPolaroidNote = () => {
            if (!modalCard || !polaroidHero || polaroidNote) return;

            shakePolaroid();

            polaroidNote = document.createElement('div');
            polaroidNote.className = 'rasim-polaroid-note';
            polaroidNote.innerHTML = `
                <span class="rasim-polaroid-note-title">Fancy Item</span>
                <p class="rasim-polaroid-note-text">ちょっとカワイイ毎日にぴったりのアイテムです</p>
                <a href="#" class="rasim-polaroid-note-btn">この商品を見る</a>
            `;

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

            const pattern = postitPatterns[Math.floor(Math.random() * postitPatterns.length)];

            polaroidPostit = document.createElement('div');
            polaroidPostit.className = 'rasim-polaroid-postit';
            polaroidPostit.innerHTML = pattern.text;
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
            galleryImages.forEach(img => {
                img.addEventListener('pointerdown', onPointerDown);
                img.addEventListener('pointermove', onPointerMove);
                img.addEventListener('click', onImageClick);
                img.addEventListener('dragstart', preventDrag);
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

        const applyRasimModalView = () => {
            if (!modalCard) return;

            const logo = modalCard.querySelector('.brand-logo-banner');
            const title = modalCard.querySelector('.modal-title');
            const desc = modalCard.querySelector('.modal-desc');

            if (logo && RASIM_MOBILE_MODAL_DATA.logoUrl) {
                logo.src = RASIM_MOBILE_MODAL_DATA.logoUrl;
                logo.alt = RASIM_MOBILE_MODAL_DATA.titleHTML || 'Rasi:m';
            }

            if (title) {
                title.innerHTML = '';
            }

            if (desc) {
                desc.classList.add('cute-shop-copy');
                desc.innerHTML = RASIM_MOBILE_MODAL_DATA.desc;
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
