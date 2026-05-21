function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function getMobileHelmettyMenuHtml(payload = {}) {
  const logoUrl = String(payload.brandLogoUrl || "").trim();
  const logoAlt = escapeHtml(payload.brandLogoAlt || "HELMETTY");
  const brandSub = escapeHtml(payload.brandSub || payload.shopSubline || "");
  const menuOpen = payload.menuOpen === true;

  return `
<header class="mobile-brand-box${brandSub ? " has-sub" : ""}${logoUrl ? "" : " logo-missing"}${menuOpen ? " is-menu-active" : ""}" id="mobileBrandBox">
    <span class="banner-shine" aria-hidden="true"></span>

    <button id="menuButton" class="menu-button${menuOpen ? " is-door-open" : ""}" type="button">
        <span class="menu-door-ground" aria-hidden="true"></span>
        <span class="menu-door-cover" aria-hidden="true">
            <span class="menu-door-label">MENU</span>
            <span class="menu-house-stairs" aria-hidden="true">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
            </span>
            <span class="menu-door-shadow" aria-hidden="true"></span>
            <span class="menu-inner-door" aria-hidden="true"></span>
        </span>
    </button>

    <div class="brand-area">
        <div class="brand-logo-wrap">
            <img id="brandLogo" class="brand-logo" src="${escapeHtml(logoUrl)}" alt="${logoAlt}" />
        </div>
        <div id="brandText" class="brand-text">
            <span class="brand-line-hd">HELMETTY</span>
            <span class="brand-line-store">ONLINE STORE</span>
        </div>
        <div id="brandSub" class="brand-sub">${brandSub}</div>
    </div>
</header>

<style>
    :root {
        --bg: #f6f1e8;
        --panel: rgba(255, 252, 247, 0.94);
        --text: #2f241c;
        --muted: #7a6a5d;
        --accent: #b86d3c;
        --accent-deep: #8f4e23;
        --shadow: 0 4.8% 10.67% rgba(74, 49, 30, 0.12);
        --radius-lg: 7.47%;
        --radius-md: 4.8%;
        --radius-sm: 3.73%;

        --menu-bg: #ffe5e5;
        --menu-text: #c71585;
        --menu-border: #ff00c8;
        --line: rgba(0, 0, 0, 0.08);
    }

    * {
        box-sizing: border-box;
    }

    .mobile-brand-box {
        position: sticky;
        top: 0;
        z-index: 100;
        width: 100%;
        display: grid;
        grid-template-columns: 12% minmax(0, 1fr) 30%;
        grid-template-rows: auto;
        align-items: center;
        column-gap: 3%;
        padding: 4.2% 3.2%;
        overflow: visible;
        isolation: isolate;
        background:
            radial-gradient(
                circle at 8% 50%,
                color-mix(in srgb, var(--menu-bg) 58%, transparent),
                transparent 40%
            ),
            linear-gradient(
                135deg,
                color-mix(in srgb, var(--menu-bg) 38%, var(--bg)),
                color-mix(in srgb, var(--menu-border) 18%, var(--menu-bg))
            );
        border-bottom: 0.16em solid color-mix(in srgb, var(--menu-border) 34%, transparent);
    }

    .mobile-brand-box::before {
        content: "";
        position: absolute;
        inset: 0;
        z-index: -1;
        background:
            linear-gradient(
                90deg,
                color-mix(in srgb, var(--menu-border) 26%, transparent),
                transparent 42%,
                color-mix(in srgb, var(--menu-bg) 32%, transparent)
            );
        opacity: 0.64;
        pointer-events: none;
    }

    .mobile-brand-box::after {
        content: "";
        position: absolute;
        left: 3.2%;
        right: 3.2%;
        bottom: 0;
        height: 0.12em;
        background:
            linear-gradient(
                90deg,
                transparent,
                color-mix(in srgb, var(--menu-border) 54%, transparent),
                transparent
            );
        pointer-events: none;
    }

    .menu-button {
        grid-column: 3;
        grid-row: 1;
        justify-self: end;
        align-self: end;
        appearance: none;
        position: absolute;
        right: 0;
        bottom: 0;
        z-index: 4;
        width: min(57%, 9.4em);
        height: 5.6em;
        min-width: 0;
        padding: 0;
        border: 0;
        border-radius: 0;
        background: transparent;
        color: var(--menu-text);
        font: inherit;
        font-size: 60%;
        line-height: 1;
        font-weight: 900;
        letter-spacing: 0.12em;
        text-align: center;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        box-shadow: none;
        transform: translateY(0);
        perspective: 24em;
        transform-style: preserve-3d;
        animation: none;
    }

    .menu-button::before,
    .menu-button::after {
        content: none;
    }

    .menu-door-label {
        position: absolute;
        left: 50%;
        top: -24%;
        z-index: 5;
        display: inline-grid;
        place-items: center;
        min-width: 54%;
        padding: 0.26em 0.48em 0.22em;
        border: 0.08em solid color-mix(in srgb, var(--menu-border) 64%, var(--menu-text));
        border-radius: 999em;
        background:
            linear-gradient(
                180deg,
                rgba(255, 255, 255, 0.86),
                color-mix(in srgb, var(--menu-bg) 72%, #ffffff)
            );
        box-shadow:
            0 0.12em 0.24em rgba(0, 0, 0, 0.14),
            inset 0 0 0 0.06em rgba(255, 255, 255, 0.58);
        transform: translateX(-50%);
        color: var(--menu-text);
        font-size: 86%;
        line-height: 1;
        letter-spacing: 0.16em;
        text-shadow:
            0 0.08em 0.12em rgba(255, 255, 255, 0.74),
            0 0.12em 0.24em rgba(0, 0, 0, 0.08);
        pointer-events: none;
    }

    .menu-door-ground {
        position: absolute;
        left: 8%;
        right: 8%;
        bottom: 0;
        height: 0.12em;
        z-index: 0;
        background:
            linear-gradient(
                90deg,
                transparent,
                color-mix(in srgb, var(--menu-border) 54%, var(--text)),
                transparent
            );
        opacity: 0.62;
        pointer-events: none;
    }

    .menu-door-cover {
        position: absolute;
        left: 4%;
        right: 0;
        bottom: 0;
        height: 100%;
        z-index: 3;
        isolation: isolate;
        border: 0.1em solid rgba(190, 151, 105, 0.32);
        border-radius: 1.9em 1.9em 0.08em 0.08em;
        background:
            linear-gradient(
                180deg,
                #fffdf7 0%,
                #fff8e8 58%,
                #f8ecd2 100%
            );
        box-shadow:
            0 0.34em 0.68em rgba(0, 0, 0, 0.14),
            inset 0 0 0 0.08em rgba(255, 255, 255, 0.72),
            inset 0.18em 0 0 rgba(190, 151, 105, 0.1),
            inset -0.18em 0 0 rgba(190, 151, 105, 0.1);
        transform: none;
        transform-style: preserve-3d;
        pointer-events: none;
    }

    .menu-door-cover::before {
        content: "";
        position: absolute;
        left: 20%;
        right: 20%;
        top: 12%;
        bottom: 0;
        z-index: 1;
        border-radius: 999em 999em 0.08em 0.08em;
        border: 0.12em solid rgba(170, 124, 78, 0.56);
        background:
            linear-gradient(
                180deg,
                rgba(255, 255, 255, 0.18),
                rgba(110, 72, 42, 0.04)
            );
        box-shadow:
            inset 0.14em 0 0 rgba(170, 124, 78, 0.16),
            inset -0.14em 0 0 rgba(170, 124, 78, 0.14),
            inset 0 -0.12em 0.22em rgba(110, 72, 42, 0.08);
    }

    .menu-door-cover::after {
        content: none;
    }

    .menu-house-stairs {
        position: absolute;
        left: 30%;
        right: 24%;
        top: 26%;
        bottom: 10%;
        z-index: 3;
        pointer-events: none;
        opacity: 1;
    }

    .menu-house-stairs::before {
        content: "";
        position: absolute;
        left: 4%;
        right: 0;
        top: 0;
        bottom: 0;
        z-index: 0;
        background:
            linear-gradient(
                135deg,
                #efcfaa 0%,
                #e3b782 52%,
                #cf965b 100%
            );
        opacity: 1;
        clip-path: polygon(0% 100%, 100% 18%, 100% 100%);
        box-shadow:
            inset 0 0.06em 0 rgba(255, 241, 219, 0.62),
            inset 0 -0.08em 0 rgba(128, 79, 36, 0.16);
    }

    .menu-house-stairs span {
        position: absolute;
        height: 0.26em;
        border-radius: 0.08em 0.08em 0.04em 0.04em;
        background:
            linear-gradient(
                180deg,
                #f0b86f 0%,
                #d8893e 58%,
                #bd6d2d 100%
            );
        box-shadow:
            0 0.06em 0.12em rgba(94, 55, 25, 0.28),
            inset 0 0.06em 0 rgba(255, 232, 190, 0.78),
            inset 0 -0.05em 0 rgba(111, 60, 22, 0.22);
        transform-origin: left center;
    }

    .menu-house-stairs span::after {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        top: 100%;
        height: 0.34em;
        border-radius: 0 0 0.06em 0.06em;
        background:
            linear-gradient(
                180deg,
                #a85f26 0%,
                #7c431b 100%
            );
        box-shadow:
            inset 0.08em 0 0 rgba(255, 220, 174, 0.16),
            inset 0 -0.05em 0 rgba(67, 32, 12, 0.26);
    }

    .menu-house-stairs span:nth-child(1) {
        left: 4%;
        top: 78%;
        width: 34%;
        opacity: 0.96;
    }

    .menu-house-stairs span:nth-child(2) {
        left: 20%;
        top: 60%;
        width: 34%;
        opacity: 0.9;
    }

    .menu-house-stairs span:nth-child(3) {
        left: 38%;
        top: 42%;
        width: 34%;
        opacity: 0.84;
    }

    .menu-house-stairs span:nth-child(4) {
        left: 56%;
        top: 24%;
        width: 34%;
        opacity: 0.78;
    }

    .menu-inner-door {
        position: absolute;
        left: 20%;
        right: 20%;
        top: 12%;
        bottom: 0;
        z-index: 5;
        border: 0.08em solid rgba(55, 130, 168, 0.68);
        border-radius: 999em 999em 0.08em 0.08em;
        background:
            linear-gradient(
                180deg,
                #bfeeff 0%,
                #7fd1ec 58%,
                #58b8d8 100%
            );
        box-shadow:
            0 0.16em 0.32em rgba(0, 0, 0, 0.12),
            inset 0 0 0 0.08em rgba(255, 255, 255, 0.46),
            inset 0.14em 0 0 rgba(255, 255, 255, 0.2),
            inset -0.14em 0 0 rgba(35, 105, 140, 0.2);
        transform-origin: left center;
        transform: rotateY(0deg);
        transform-style: preserve-3d;
        transition: transform 0.62s cubic-bezier(.2,.7,.1,1.08);
        pointer-events: none;
    }

    .menu-inner-door::before {
        content: "";
        position: absolute;
        inset: 16% 16% 14%;
        border-radius: 999em 999em 0.06em 0.06em;
        border: 0.06em solid rgba(255, 255, 255, 0.5);
        background:
            linear-gradient(
                115deg,
                transparent 0%,
                rgba(255, 255, 255, 0.42) 42%,
                rgba(255, 255, 255, 0.08) 58%,
                transparent 100%
            );
    }

    .menu-inner-door::after {
        content: "";
        position: absolute;
        right: 15%;
        top: 58%;
        width: 0.4em;
        height: 0.4em;
        border-radius: 50%;
        background:
            radial-gradient(
                circle at 35% 32%,
                rgba(255, 255, 255, 0.98),
                #f8b8d9 64%,
                #d36ba7 100%
            );
        box-shadow:
            0 0 0 0.08em rgba(255, 255, 255, 0.42),
            0 0.08em 0.22em rgba(0, 0, 0, 0.2);
    }

    .menu-door-shadow {
        position: absolute;
        left: 20%;
        right: 20%;
        top: 12%;
        bottom: 0;
        z-index: 4;
        border-radius: 999em 999em 0.08em 0.08em;
        background:
            linear-gradient(
                90deg,
                rgba(0, 0, 0, 0.2) 0%,
                rgba(0, 0, 0, 0.12) 38%,
                transparent 82%
            );
        opacity: 0;
        transform-origin: left center;
        transform: rotateY(0deg);
        transition:
            opacity 0.62s cubic-bezier(.2,.7,.1,1.08),
            transform 0.62s cubic-bezier(.2,.7,.1,1.08);
        pointer-events: none;
    }

    .menu-button:active {
        opacity: 0.96;
        transform: translateY(1%);
    }

    .menu-button.is-door-open .menu-inner-door {
        transform: rotateY(-112deg);
    }

    .menu-button.is-door-open .menu-door-shadow {
        opacity: 0.24;
        transform: rotateY(-42deg);
    }

    .brand-area {
        grid-column: 2;
        grid-row: 1;
        justify-self: stretch;
        align-self: center;
        position: relative;
        min-width: 0;
        display: grid;
        align-items: center;
        justify-items: center;
        gap: 0.14em;
        padding: 1.8% 2.4%;
        border-radius: 0;
        background: transparent;
        box-shadow: none;
    }

    .brand-area::before {
        display: none;
    }

    .brand-area::after {
        content: "";
        display: block;
        width: 68%;
        height: 0.08em;
        background:
            linear-gradient(
                90deg,
                transparent,
                color-mix(in srgb, var(--menu-border) 48%, var(--text)),
                transparent
            );
        opacity: 0;
        transform: scaleX(0.12);
        transform-origin: center;
        animation: brandLineEntrance 0.72s ease 0.46s forwards;
        transition:
            width 0.36s ease,
            opacity 0.36s ease,
            transform 0.36s ease;
    }

    .mobile-brand-box.is-menu-active .brand-area::after {
        opacity: 0.38;
        transform: scaleX(0.82);
    }

    .mobile-brand-box.is-scrolled .brand-area::after {
        width: 54%;
        opacity: 0.34;
    }

    .brand-logo-wrap {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: visible;
    }

    .brand-logo {
        display: block;
        width: auto;
        max-width: 68%;
        max-height: 3em;
        object-fit: contain;
        filter:
            drop-shadow(0 0.08em 0.12em rgba(255, 255, 255, 0.72))
            drop-shadow(0 0.12em 0.22em rgba(0, 0, 0, 0.08));
    }

    .brand-text {
        display: block;
        width: 100%;
        color: var(--text);
        font-family:
            "Times New Roman",
            "Yu Mincho",
            "Hiragino Mincho ProN",
            serif;
        line-height: 1;
        font-weight: 600;
        text-align: center;
        text-shadow:
            0 0.08em 0.16em rgba(255, 255, 255, 0.76),
            0 0.12em 0.28em rgba(0, 0, 0, 0.08);
        opacity: 1;
        transform: translateY(0);
        animation: none;
        transition:
            opacity 0.36s ease,
            transform 0.36s ease,
            letter-spacing 0.36s ease;
    }

    .brand-text .brand-line-hd {
        display: block;
        font-size: 74%;
        line-height: 1;
        letter-spacing: 0.34em;
        opacity: 0.82;
        transition:
            letter-spacing 0.36s ease,
            opacity 0.36s ease;
    }

    .brand-text .brand-line-store {
        display: block;
        margin-top: 0.22em;
        font-size: 92%;
        line-height: 1;
        letter-spacing: 0.18em;
        white-space: nowrap;
        transition:
            letter-spacing 0.36s ease,
            opacity 0.36s ease;
    }

    .mobile-brand-box.is-menu-active .brand-text {
        opacity: 0.72;
        transform: translateY(0) scale(0.985);
    }

    .banner-shine {
        position: absolute;
        inset: 0;
        z-index: 1;
        pointer-events: none;
        overflow: hidden;
    }

    .banner-shine::before {
        content: "";
        position: absolute;
        top: -42%;
        left: -58%;
        width: 38%;
        height: 184%;
        background:
            linear-gradient(
                115deg,
                transparent 0%,
                rgba(255, 255, 255, 0.06) 28%,
                rgba(255, 255, 255, 0.92) 48%,
                rgba(255, 255, 255, 0.22) 62%,
                transparent 100%
            );
        filter: blur(0.035em);
        transform: translateX(0) skewX(-18deg);
        opacity: 0;
    }

    .mobile-brand-box.is-menu-active .banner-shine::before {
        animation: bannerShineRun 0.72s ease-out forwards;
    }

    .mobile-brand-box.is-scrolled .brand-text .brand-line-hd {
        letter-spacing: 0.28em;
        opacity: 0.68;
    }

    .mobile-brand-box.is-scrolled .brand-text .brand-line-store {
        letter-spacing: 0.13em;
        opacity: 0.86;
    }

    .brand-sub {
        display: none;
        width: 100%;
        color: var(--muted);
        font-size: 62%;
        line-height: 1.1;
        letter-spacing: 0.08em;
        text-align: center;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .mobile-brand-box.logo-missing .brand-logo-wrap {
        display: none;
    }

    .mobile-brand-box.logo-missing .brand-text {
        display: block;
    }

    .mobile-brand-box.has-sub .brand-sub {
        display: block;
    }

    @keyframes bannerShineRun {
        0% {
            transform: translateX(0) skewX(-18deg);
            opacity: 0;
        }

        18% {
            opacity: 0.95;
        }

        100% {
            transform: translateX(430%) skewX(-18deg);
            opacity: 0;
        }
    }

    @keyframes brandLineEntrance {
        0% {
            opacity: 0;
            transform: scaleX(0.12);
        }

        100% {
            opacity: 0.28;
            transform: scaleX(1);
        }
    }
</style>
`;
}
