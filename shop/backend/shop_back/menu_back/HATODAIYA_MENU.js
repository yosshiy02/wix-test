// backend/shop_back/menu_back/HATODAIYA_MENU.js

function escAttr(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;");
}

function escHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function firstText(...values) {
    for (const value of values) {
        const text = String(value ?? "").trim();
        if (text) {
            return text;
        }
    }

    return "";
}

function getDropdownItems(action) {
    const dummyMap = {
        top: ["ストアTOPへ"],
        policy: ["特定商取引法に基づく表記", "プライバシーポリシー"],
        form: ["お問い合わせ"],
        notice: ["NEW", "RESTOCK", "EVENT", "SALE"],
        link: ["OFFICIAL LINKSHOP TOP", "HATODAIYA", "HELMETTY", "Rasiːm"],
        insta: [
            `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.4" fill="currentColor"/></svg><span>INSTAGRAM</span>`
        ]
    };

    return dummyMap[action] || ["DETAIL", "MORE"];
}

function renderDropdown(action, brand) {
    const currentShopName = String(brand || "")
        .replace("Rasiːm", "Rasi:m")
        .trim()
        .toLowerCase();

    return getDropdownItems(action).map((text) => {
        const textValue = String(text || "");
        const dropdownShopName = textValue
            .replace(/<[^>]*>/g, "")
            .replace("Rasiːm", "Rasi:m")
            .trim()
            .toLowerCase();

        const itemHtml = textValue.includes("<svg") ? textValue : escHtml(textValue);

        if (action === "link" && currentShopName && dropdownShopName === currentShopName) {
            return `<span class="hatodaiya-link-dropdown-item is-current-shop"><svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.2 16.6 4.9 12.3l1.7-1.7 2.6 2.6 8.2-8.2 1.7 1.7-9.9 9.9z" fill="currentColor"/></svg><span>${escHtml(textValue)}</span><span class="hatodaiya-link-current-badge">NOW</span></span>`;
        }

        return `<span class="hatodaiya-link-dropdown-item">${itemHtml}</span>`;
    }).join("");
}

function renderLink({ action, label, url }, brand) {
    const normalizedUrl = String(url || "").trim();
    if (!normalizedUrl) {
        return "";
    }

    const dropdownItems = getDropdownItems(action);
    const dropdownHeight = dropdownItems.length * 2.625 + 3.25;

    return `
      <a href="${escAttr(normalizedUrl)}" class="hatodaiya-link" data-action="${escAttr(action)}" data-url="${escAttr(normalizedUrl)}" style="--dropdown-height:${dropdownHeight}rem">
        <span class="hatodaiya-link-label">${escHtml(label)}</span>
        <span class="hatodaiya-link-dropdown" aria-hidden="true">
          ${renderDropdown(action, brand)}
        </span>
      </a>
    `;
}

export function getHatodaiyaHtml(settings = {}) {
    const s = {
        brand: "HATODAIYA",
        brandPrefix: "ha",
        brandLogo: "",
        colorBoxBg: "#f3f3f3",
        colorBoxText: "#2f2f2f",
        colorBackBg: "#f7f7f7",
        colorBackBorder: "#d5d5d5",
        colorBackText: "#555555",
        colorButtonBg: "#ffffff",
        colorButtonText: "#2f2f2f",
        colorButtonBorder: "#c9c9c9",
        linkTop: "/hatodaiya-top",
        linkPolicy: "/policy",
        linkForm: "/contact",
        linkNotice: "/notice",
        linkLink: "/onlinestore-top",
        linkInsta: "https://www.instagram.com/hatodaiya_shop",
        instaLink: "INSTAGRAM",
        instaLinkUrl: "",
        catchEyebrow: "",
        catchMain: "",
        catchSub: "",
        ...settings
    };

    const brand = firstText(s.brand, "HATODAIYA");
    const logoUrl = firstText(s.brandLogo);
    const catchEyebrow = firstText(s.catchEyebrow, "HATODAIYA ONLINE STORE");
    const catchMain = firstText(s.catchMain, "日常に溶け込むシンプルなデザイン。");
    const catchSub = firstText(s.catchSub, "上質で洗練されたシューズをお届けします。");

    const links = [
        { action: "top", label: "TOP", url: s.linkTop },
        { action: "link", label: "LINKSTORE", url: s.linkLink },
        { action: "insta", label: "SNS", url: s.linkInsta || s.instaLinkUrl },
        { action: "policy", label: "GUIDE", url: s.linkPolicy },
        { action: "form", label: "CONTACT", url: s.linkForm }
    ].map((link) => renderLink(link, brand)).join("");

    return `
<style>
  :root {
    --hatodaiya-box-bg: ${firstText(s.colorBoxBg, "#f3f3f3")};
    --hatodaiya-box-text: ${firstText(s.colorBoxText, "#2f2f2f")};
    --hatodaiya-back-bg: ${firstText(s.colorBackBg, "#f7f7f7")};
    --hatodaiya-back-border: ${firstText(s.colorBackBorder, "#d5d5d5")};
    --hatodaiya-back-text: ${firstText(s.colorBackText, "#555555")};
    --hatodaiya-button-bg: ${firstText(s.colorButtonBg, "#ffffff")};
    --hatodaiya-button-text: ${firstText(s.colorButtonText, "#2f2f2f")};
    --hatodaiya-button-border: ${firstText(s.colorButtonBorder, "#c9c9c9")};
    --hatodaiya-muted: color-mix(in srgb, var(--hatodaiya-back-text) 86%, #333333);
    --hatodaiya-soft: color-mix(in srgb, var(--hatodaiya-box-bg) 72%, #ffffff);
    --hatodaiya-line: color-mix(in srgb, var(--hatodaiya-back-border) 58%, transparent);
    --hatodaiya-shadow-soft: 0 1.125rem 2.5rem rgba(40, 40, 40, 0.08);
    --hatodaiya-tab-bg: color-mix(in srgb, var(--hatodaiya-button-bg) 66%, var(--hatodaiya-back-border));
    --hatodaiya-tab-hover: color-mix(in srgb, var(--hatodaiya-button-bg) 42%, var(--hatodaiya-back-text));
    --hatodaiya-tab-ink: color-mix(in srgb, var(--hatodaiya-button-text) 88%, #111111);
    --hatodaiya-tab-drop-bg: color-mix(in srgb, var(--hatodaiya-tab-bg) 78%, #ffffff);
    --hatodaiya-tab-drop-hover: color-mix(in srgb, var(--hatodaiya-tab-hover) 75%, #ffffff);
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    background: transparent;
    font-family: "Yu Gothic", "Hiragino Sans", "Helvetica Neue", Arial, sans-serif;
  }

  .hatodaiya-box {
    position: relative;
    z-index: 20;
    width: 100%;
    min-height: 2rem;
    margin: 0 auto;
    padding: 1.25rem 2rem;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 22.5rem;
    grid-template-areas:
      "copy logo"
      "links links";
    gap: 0.125rem 2.125rem;
    align-items: start;
    align-content: start;
    overflow: visible;
    isolation: isolate;
    background:
      linear-gradient(135deg, rgba(255,255,255,0.98), rgba(255,255,255,0.94)),
      linear-gradient(90deg, color-mix(in srgb, var(--hatodaiya-box-bg) 34%, transparent), var(--hatodaiya-back-bg));
    background-size: 200% 200%, auto;
    color: var(--hatodaiya-box-text);
    box-shadow: var(--hatodaiya-shadow-soft);
    border: 1px solid color-mix(in srgb, var(--hatodaiya-back-border) 74%, #ffffff);
    border-radius: 36px;
    animation: hatodaiyaPanelBreath 7.8s ease-in-out infinite;
  }

  .hatodaiya-box::before,
  .hatodaiya-box::after {
    content: "";
    position: absolute;
    left: 2.125rem;
    right: 2.125rem;
    height: 0.0625rem;
    background: var(--hatodaiya-line);
    pointer-events: none;
    z-index: -1;
  }

  .hatodaiya-box::before {
    top: 1.125rem;
  }

  .hatodaiya-box::after {
    bottom: 1.125rem;
  }

  .hatodaiya-copy {
    grid-area: copy;
    min-width: 0;
    max-width: 47.5rem;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      "eyebrow"
      "main"
      "sub"
      "button";
    row-gap: 0.5625rem;
    position: relative;
    padding: 0.125rem 0 0.125rem 1.375rem;
    align-items: start;
    align-content: start;
    border-left: 0.0625rem solid color-mix(in srgb, var(--hatodaiya-box-text) 28%, transparent);
    animation: hatodaiyaCopyBlockIn 0.72s cubic-bezier(.2,.82,.24,1) both;
  }

  .hatodaiya-copy::before {
    content: "";
    position: absolute;
    left: -0.25rem;
    top: 0.25rem;
    width: 0.4375rem;
    height: 0.4375rem;
    border-radius: 999rem;
    background: var(--hatodaiya-button-border);
    opacity: 0.62;
    box-shadow: 0 0 0 0.3125rem color-mix(in srgb, var(--hatodaiya-button-border) 18%, transparent);
    pointer-events: none;
  }

  .hatodaiya-logo-wrap {
    grid-area: logo;
    width: 100%;
    height: 7.375rem;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-width: 0;
    position: relative;
    z-index: 1;
  }

  .hatodaiya-logo {
    display: block;
    width: min(29.375rem, 100%);
    max-height: 7.875rem;
    object-fit: contain;
    transform: translateX(0.375rem) rotate(0deg);
    filter: grayscale(0.08) contrast(1.02);
  }

  .hatodaiya-logo-placeholder {
    width: 100%;
    max-width: 21.25rem;
    height: 5.5rem;
    display: grid;
    place-items: center;
    font-size: 0.9375rem;
    font-weight: 700;
    letter-spacing: 0.22em;
    opacity: 0.68;
    background: transparent;
    color: var(--hatodaiya-muted);
  }

  .hatodaiya-catch-eyebrow {
    grid-area: eyebrow;
    width: fit-content;
    max-width: 100%;
    font-size: 0.6875rem;
    line-height: 1;
    font-weight: 700;
    letter-spacing: 0.22em;
    color: color-mix(in srgb, var(--hatodaiya-box-text) 78%, #ffffff);
    white-space: nowrap;
    text-transform: uppercase;
    padding: 0.4375rem 0.625rem 0.375rem;
    background: var(--hatodaiya-soft);
    border: 0.0625rem solid color-mix(in srgb, var(--hatodaiya-button-border) 40%, #ffffff);
    border-radius: 999rem;
    box-shadow: 0 0.5rem 1.125rem rgba(40, 40, 40, 0.05);
    animation: hatodaiyaCopyLineIn 0.58s cubic-bezier(.2,.82,.24,1) 0.08s both;
  }

  .hatodaiya-catch-main {
    grid-area: main;
    margin: 0;
    min-width: 0;
    max-width: 100%;
    font-family: "Hiragino Mincho ProN", "Yu Mincho", "Yu Gothic", "Hiragino Sans", "Meiryo", serif;
    font-size: clamp(0.8125rem, 2.1vw, 2.25rem);
    line-height: 1.18;
    font-weight: 500;
    letter-spacing: 0.045em;
    white-space: nowrap;
    color: color-mix(in srgb, var(--hatodaiya-box-text) 86%, #111111);
    text-shadow:
      0 0.0625rem 0 rgba(255,255,255,0.74),
      0 0.5rem 1.125rem rgba(40,40,40,0.06);
    animation: hatodaiyaCopyMainIn 0.78s cubic-bezier(.2,.82,.24,1) 0.16s both;
  }

  .hatodaiya-catch-sub {
    grid-area: sub;
    align-self: start;
    font-size: clamp(0.75rem, 0.9vw, 0.9375rem);
    line-height: 1.75;
    font-weight: 400;
    letter-spacing: 0.055em;
    color: var(--hatodaiya-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 35rem;
    padding-bottom: 0;
    animation: hatodaiyaCopyLineIn 0.68s cubic-bezier(.2,.82,.24,1) 0.28s both;
  }

  .hatodaiya-button {
    grid-area: button;
    width: fit-content;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--hatodaiya-button-bg);
    color: var(--hatodaiya-button-text);
    border: 1px solid var(--hatodaiya-button-border);
    border-radius: 999rem;
    padding: 0.625rem 1.125rem;
    text-decoration: none;
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    box-shadow: 0 0.625rem 1.375rem rgba(40,40,40,0.06);
    transition: transform 0.28s cubic-bezier(.73,.32,.34,1.5), box-shadow 0.28s ease, filter 0.22s ease;
  }

  .hatodaiya-button:hover {
    transform: translateY(-0.1875rem);
    box-shadow: 0 1rem 1.75rem rgba(40,40,40,0.1);
    filter: saturate(1.02);
  }

  .hatodaiya-links {
    grid-area: links;
    min-width: 0;
    position: relative;
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    justify-content: center;
    gap: 0;
    margin-top: 0.5rem;
    padding: 0.125rem clamp(1.125rem, 2.8vw, 3rem) 0;
    overflow: visible;
    isolation: isolate;
    font-family: "Helvetica Neue", Arial, "Yu Gothic", "Hiragino Sans", sans-serif;
  }

  .hatodaiya-links::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    width: auto;
    height: 0.0625rem;
    background: var(--hatodaiya-line);
    transform: none;
    pointer-events: none;
  }

  .hatodaiya-link {
    --tab-bg: var(--hatodaiya-tab-bg);
    --tab-hover: var(--hatodaiya-tab-hover);
    --tab-ink: var(--hatodaiya-tab-ink);
    --tab-drop-bg: var(--hatodaiya-tab-drop-bg);
    --tab-drop-hover: var(--hatodaiya-tab-drop-hover);
    appearance: none;
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 1 1 0;
    width: auto;
    min-width: 0;
    min-height: 3.25rem;
    padding: 0 clamp(0.375rem, 0.9vw, 0.875rem);
    margin: 0 0.625rem 0 0;
    border: 0;
    outline: 0;
    background: var(--tab-bg);
    color: var(--tab-ink);
    font: inherit;
    font-size: clamp(0.6875rem, 1.08vw, 1rem);
    line-height: 1;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-decoration: none;
    text-transform: uppercase;
    cursor: pointer;
    white-space: nowrap;
    opacity: 1;
    box-shadow: 0 0.625rem 1.375rem rgba(40, 40, 40, 0.06);
    border-radius: 0;
    text-align: center;
    text-shadow:
      0 0.0625rem 0 rgba(255,255,255,0.6),
      0 0 0.625rem rgba(255,255,255,0.28);
    transform: translateY(0);
    transform-origin: center center;
    overflow: visible;
    will-change: transform;
    backface-visibility: hidden;
    animation: hatodaiyaLinkRiseIn 0.54s cubic-bezier(.2,.82,.24,1) both;
    transition:
      background-color 0.28s ease,
      color 0.22s ease,
      opacity 0.22s ease,
      transform 0.28s cubic-bezier(.73,.32,.34,1.5),
      box-shadow 0.28s ease;
  }

  .hatodaiya-link:nth-child(1) {
    animation-delay: 0.34s;
  }

  .hatodaiya-link:nth-child(2) {
    animation-delay: 0.4s;
  }

  .hatodaiya-link:nth-child(3) {
    animation-delay: 0.46s;
  }

  .hatodaiya-link:nth-child(4) {
    animation-delay: 0.52s;
  }

  .hatodaiya-link:nth-child(5) {
    animation-delay: 0.58s;
  }

  .hatodaiya-link-label {
    position: relative;
    z-index: 4;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    pointer-events: none;
  }

  .hatodaiya-link::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 100%;
    height: 0.625rem;
    background: var(--tab-drop-bg);
    clip-path: polygon(0 0, 100% 0, 50% 100%);
    transform: scaleY(1);
    transform-origin: center top;
    opacity: 1;
    pointer-events: none;
    transition:
      height 0.24s cubic-bezier(.73,.32,.34,1.5),
      background-color 0.28s ease,
      opacity 0.22s ease;
  }

  .hatodaiya-link::after {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 0;
    background: rgba(255,255,255,0.72);
    clip-path: polygon(0 100%, 100% 100%, 50% 0);
    opacity: 0.92;
    pointer-events: none;
    transition:
      height 0.22s 0.12s ease-out,
      opacity 0.22s ease;
  }

  .hatodaiya-link:last-child {
    margin-right: 0;
  }

  .hatodaiya-link:hover,
  .hatodaiya-link.is-open,
  .hatodaiya-link.is-closing {
    background: var(--tab-hover);
    color: var(--tab-ink);
    opacity: 1;
    box-shadow: 0 1rem 1.75rem rgba(40,40,40,0.1);
    transform: translateY(-0.25rem);
  }

  .hatodaiya-link:hover::before,
  .hatodaiya-link.is-open::before,
  .hatodaiya-link.is-closing::before {
    background: var(--tab-drop-hover);
    height: 0;
    opacity: 0;
    animation: none;
  }

  .hatodaiya-link:hover::after,
  .hatodaiya-link.is-open::after,
  .hatodaiya-link.is-closing::after {
    height: 0;
  }

  .hatodaiya-link:active {
    transform: translateY(-0.125rem);
    opacity: 0.78;
  }

  .hatodaiya-link-dropdown {
    --dropdown-tail: 1.125rem;
    position: absolute;
    left: 0;
    right: 0;
    top: 100%;
    z-index: 30;
    display: grid;
    gap: 0;
    height: 0;
    padding: 0;
    overflow: hidden;
    background: var(--tab-drop-bg);
    color: var(--tab-ink);
    box-shadow: 0 1.125rem 1.75rem rgba(40,40,40,0.08);
    opacity: 0;
    transform: translateY(0) scaleY(0);
    transform-origin: center top;
    pointer-events: none;
    will-change: transform, opacity;
    backface-visibility: hidden;
    clip-path: polygon(
      0 0,
      100% 0,
      100% calc(100% - var(--dropdown-tail)),
      50% 100%,
      0 calc(100% - var(--dropdown-tail))
    );
    transition:
      height 0.52s cubic-bezier(.22,.72,.24,1),
      padding 0.52s cubic-bezier(.22,.72,.24,1),
      background-color 0.24s ease,
      opacity 0.32s ease,
      transform 0.52s cubic-bezier(.22,.72,.24,1);
  }

  .hatodaiya-link.is-open .hatodaiya-link-dropdown {
    height: var(--dropdown-height, 9.75rem);
    padding: 0.625rem 0 2.375rem;
    background: var(--tab-drop-hover);
    opacity: 1;
    transform: translateY(0) scaleY(1);
    pointer-events: auto;
    animation: hatodaiyaDropdownOpenBounce 0.96s cubic-bezier(.18,.9,.2,1) both;
  }

  .hatodaiya-link.is-closing .hatodaiya-link-dropdown {
    height: 0;
    padding: 0;
    background: var(--tab-drop-hover);
    opacity: 0;
    transform: translateY(0) scaleY(0.02);
    pointer-events: none;
    animation: none;
  }

  .hatodaiya-link-dropdown-item {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    min-height: 2.625rem;
    padding: 0.75rem 0.875rem;
    font-size: clamp(0.75rem, 0.9vw, 0.9375rem);
    line-height: 1.28;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-align: center;
    white-space: normal;
    color: color-mix(in srgb, var(--hatodaiya-tab-ink) 84%, #444444);
    text-shadow:
      0 0.0625rem 0 rgba(255,255,255,0.52),
      0 0 0.5rem rgba(255,255,255,0.24);
    opacity: 0;
    transform: translateY(-0.375rem);
    border-bottom: 0.0625rem solid color-mix(in srgb, var(--hatodaiya-tab-ink) 16%, transparent);
    transition:
      opacity 0.34s ease,
      transform 0.44s cubic-bezier(.2,.82,.24,1),
      background-color 0.22s ease;
  }

  .hatodaiya-link-dropdown-item:hover {
    background: color-mix(in srgb, var(--hatodaiya-tab-ink) 12%, transparent);
  }

  .hatodaiya-link-dropdown-item span {
    min-width: 0;
    white-space: normal;
    line-height: 1.25;
  }

  .hatodaiya-link-dropdown-item.is-current-shop {
    background: color-mix(in srgb, var(--hatodaiya-tab-ink) 16%, transparent);
    font-weight: 900;
    box-shadow: inset 0 0 0 0.0625rem color-mix(in srgb, var(--hatodaiya-tab-ink) 18%, transparent);
  }

  .hatodaiya-link-current-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2.25rem;
    padding: 0.1875rem 0.375rem;
    border-radius: 999rem;
    background: color-mix(in srgb, var(--hatodaiya-tab-ink) 16%, transparent);
    font-size: 0.625rem;
    line-height: 1;
    font-weight: 900;
    letter-spacing: 0.08em;
  }

  .hatodaiya-link-dropdown-item:last-child {
    border-bottom: 0;
  }

  .hatodaiya-link.is-open .hatodaiya-link-dropdown-item,
  .hatodaiya-link.is-closing .hatodaiya-link-dropdown-item {
    opacity: 1;
    transform: translateY(0);
  }

  .hatodaiya-link.is-open .hatodaiya-link-dropdown-item {
    animation: hatodaiyaDropdownItemPop 0.42s cubic-bezier(.18,.9,.2,1) both;
  }

  .hatodaiya-link.is-open .hatodaiya-link-dropdown-item:nth-child(1) {
    animation-delay: 0.04s;
  }

  .hatodaiya-link.is-open .hatodaiya-link-dropdown-item:nth-child(2) {
    animation-delay: 0.08s;
  }

  .hatodaiya-link.is-open .hatodaiya-link-dropdown-item:nth-child(3) {
    animation-delay: 0.12s;
  }

  .hatodaiya-link.is-open .hatodaiya-link-dropdown-item:nth-child(4) {
    animation-delay: 0.16s;
  }

  .hatodaiya-link.is-open .hatodaiya-link-dropdown-item:nth-child(5) {
    animation-delay: 0.2s;
  }

  @keyframes hatodaiyaPanelBreath {
    0%, 100% {
      background-position: 0% 50%, 0 0;
    }

    50% {
      background-position: 100% 50%, 0 0;
    }
  }

  @keyframes hatodaiyaCopyBlockIn {
    from {
      opacity: 0;
      transform: translateY(0.625rem);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes hatodaiyaCopyLineIn {
    from {
      opacity: 0;
      transform: translateY(0.5rem);
      filter: blur(0.25rem);
    }

    to {
      opacity: 1;
      transform: translateY(0);
      filter: blur(0);
    }
  }

  @keyframes hatodaiyaCopyMainIn {
    from {
      opacity: 0;
      transform: translateY(0.75rem);
      letter-spacing: 0.09em;
      filter: blur(0.3125rem);
    }

    to {
      opacity: 1;
      transform: translateY(0);
      letter-spacing: 0.04em;
      filter: blur(0);
    }
  }

  @keyframes hatodaiyaLinkRiseIn {
    from {
      opacity: 0;
      transform: translateY(0.75rem);
      filter: blur(0.3125rem);
    }

    to {
      opacity: 1;
      transform: translateY(0);
      filter: blur(0);
    }
  }

  @keyframes hatodaiyaDropdownOpenBounce {
    0% {
      transform: translateY(0) scaleY(0.02);
    }

    54% {
      transform: translateY(0) scaleY(1.16);
    }

    74% {
      transform: translateY(0) scaleY(0.97);
    }

    100% {
      transform: translateY(0) scaleY(1);
    }
  }

  @keyframes hatodaiyaDropdownItemPop {
    0% {
      opacity: 0;
      transform: translateY(-0.5rem) scale(0.96);
    }

    70% {
      opacity: 1;
      transform: translateY(0.0625rem) scale(1.025);
    }

    100% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @media (max-width: 980px) {
    .hatodaiya-box {
      grid-template-columns: minmax(0, 1fr) 13.75rem;
      grid-template-areas:
        "copy logo"
        "links links";
      gap: 0.125rem 1.125rem;
      min-height: 9.5rem;
      padding: 1.375rem 1.125rem 1.25rem;
      border-radius: 28px;
    }

    .hatodaiya-box::before,
    .hatodaiya-box::after {
      left: 1.125rem;
      right: 1.125rem;
    }

    .hatodaiya-copy {
      max-width: 38.75rem;
      padding-left: 1.125rem;
    }

    .hatodaiya-catch-main {
      font-size: clamp(1.375rem, 3.2vw, 1.9375rem);
    }

    .hatodaiya-catch-sub {
      font-size: 0.75rem;
      max-width: 32.5rem;
    }

    .hatodaiya-links {
      margin-top: -0.25rem;
      padding: 0.125rem 0.875rem 0;
      transform: none;
    }

    .hatodaiya-link {
      flex: 0 0 8.25rem;
      width: 8.25rem;
      min-height: 2.75rem;
      font-size: clamp(0.6875rem, 1.6vw, 0.875rem);
      padding: 0 0.75rem;
      margin: 0 0.5rem 1rem 0;
    }

    .hatodaiya-logo-wrap {
      height: 5.125rem;
    }

    .hatodaiya-logo {
      max-height: 5.625rem;
      width: min(16.875rem, 100%);
      transform: translateX(0.125rem) rotate(0deg);
    }
  }

  @media (max-width: 640px) {
    .hatodaiya-box {
      grid-template-columns: 1fr;
      grid-template-areas:
        "copy"
        "links"
        "logo";
      gap: 0.5rem;
      min-height: auto;
      padding: 1.125rem 1rem 1rem;
      border-radius: 24px;
    }

    .hatodaiya-box::before,
    .hatodaiya-box::after {
      left: 1rem;
      right: 1rem;
    }

    .hatodaiya-copy {
      padding-left: 1rem;
    }

    .hatodaiya-catch-eyebrow {
      font-size: 0.625rem;
      letter-spacing: 0.18em;
      padding: 0.375rem 0.5625rem 0.3125rem;
    }

    .hatodaiya-catch-main {
      font-size: clamp(1.25rem, 6.2vw, 1.75rem);
      line-height: 1.22;
      white-space: normal;
    }

    .hatodaiya-catch-sub {
      white-space: normal;
      max-width: none;
      font-size: 0.75rem;
      line-height: 1.65;
    }

    .hatodaiya-links {
      row-gap: 0.5rem;
      margin-top: -0.125rem;
      padding: 0.125rem 0 0;
      transform: none;
      flex-wrap: wrap;
      justify-content: flex-start;
    }

    .hatodaiya-link {
      flex: 0 0 8.625rem;
      width: 8.625rem;
      min-height: 2.75rem;
      font-size: clamp(0.6875rem, 3.4vw, 0.875rem);
      padding: 0 0.625rem;
      margin: 0 0.5rem 1rem 0;
    }

    .hatodaiya-logo-wrap {
      justify-content: flex-start;
      height: 3.875rem;
    }

    .hatodaiya-logo {
      width: min(19.375rem, 96%);
      max-height: 4.5rem;
      transform: none;
    }
  }
</style>

<div class="hatodaiya-box">
  <div class="hatodaiya-copy">
    <div class="hatodaiya-catch-eyebrow">
      ${escHtml(catchEyebrow)}
    </div>

    <div class="hatodaiya-catch-main">
      ${escHtml(catchMain)}
    </div>

    <div class="hatodaiya-catch-sub">
      ${escHtml(catchSub)}
    </div>

    <a href="${escAttr(s.linkTop)}" class="hatodaiya-button" data-action="top" data-url="${escAttr(s.linkTop)}">
      VIEW MORE
    </a>
  </div>

  <div class="hatodaiya-logo-wrap">
    ${
        logoUrl
            ? `<img class="hatodaiya-logo" src="${escAttr(logoUrl)}" alt="${escAttr(brand)}" />`
            : `<div class="hatodaiya-logo-placeholder">${escHtml(brand)}</div>`
    }
  </div>

  <nav class="hatodaiya-links" aria-label="ブランドリンク">
    ${links}
  </nav>
</div>

<script>
  (function () {
    var brandName = ${JSON.stringify(brand)};

    document.querySelectorAll(".hatodaiya-link").forEach(function (link) {
      var closeTimer = null;
      var dropdown = link.querySelector(".hatodaiya-link-dropdown");

      function openMenu() {
        if (closeTimer) {
          window.clearTimeout(closeTimer);
          closeTimer = null;
        }

        link.classList.remove("is-closing");
        link.classList.add("is-open");

        if (dropdown) {
          dropdown.setAttribute("aria-hidden", "false");
        }
      }

      function closeMenu() {
        if (closeTimer) {
          window.clearTimeout(closeTimer);
        }

        link.classList.remove("is-open");
        link.classList.add("is-closing");

        if (dropdown) {
          dropdown.setAttribute("aria-hidden", "true");
        }

        closeTimer = window.setTimeout(function () {
          link.classList.remove("is-closing");
          closeTimer = null;
        }, 520);
      }

      link.addEventListener("mouseenter", openMenu);
      link.addEventListener("mouseleave", closeMenu);
      link.addEventListener("focus", openMenu);
      link.addEventListener("blur", closeMenu);
    });

    document.querySelectorAll(".hatodaiya-box a[href]").forEach(function (link) {
      link.addEventListener("click", function (event) {
        var href = String(link.getAttribute("href") || "").trim();
        var action = String(link.dataset.action || "").trim();

        if (!href || href === "#") {
          event.preventDefault();
          return;
        }

        if (window.parent && window.parent !== window) {
          event.preventDefault();
          window.parent.postMessage({
            channel: "PcBrandBoxHtml",
            type: "brandBoxClick",
            action: action,
            url: href,
            brand: brandName
          }, "*");
        }
      });
    });
  })();
</script>
`;
}

   