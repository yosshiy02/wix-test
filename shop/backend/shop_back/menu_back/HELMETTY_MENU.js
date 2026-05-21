// backend/shop_back/menu_back/HELMETTY_MENU.js

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
        link: ["OFFICIAL LINKSHOP TOP", "HELMETTY", "HATODAIYA", "Rasiːm"],
        insta: [
            `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.4" fill="currentColor"/></svg><span>INSTAGRAM</span>`,
            `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M11.2 17.6c.35-1.42.7-2.84 1.04-4.25.48.9 1.38 1.34 2.48 1.34 2.42 0 4.08-2.18 4.08-5.02 0-2.16-1.84-4.17-4.78-4.17-3.58 0-5.38 2.45-5.38 4.5 0 1.24.47 2.35 1.48 2.76.17.07.32 0 .37-.18.04-.13.12-.45.16-.59.05-.18.03-.25-.1-.41-.29-.35-.48-.8-.48-1.45 0-1.82 1.36-3.45 3.55-3.45 1.94 0 3 1.18 3 2.77 0 2.08-.92 3.83-2.28 3.83-.75 0-1.32-.62-1.14-1.39.22-.92.64-1.92.64-2.59 0-.6-.32-1.1-.99-1.1-.78 0-1.41.81-1.41 1.89 0 .69.23 1.16.23 1.16s-.8 3.4-.94 4c-.28 1.18-.04 2.63-.02 2.77.01.08.12.1.17.04.07-.09.95-1.17 1.25-2.25z" fill="#fff"/></svg><span>PINTEREST（公開予定）</span>`,
            `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h4.7l4.08 5.62L17.58 4H20l-6.05 7.08L20.5 20h-4.7l-4.35-5.98L6.33 20H4l6.27-7.35L4 4zm3.32 1.74 9.34 12.52h1.48L8.78 5.74H7.32z" fill="currentColor"/></svg><span>X（公開予定）</span>`,
            `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 3c.35 2.36 1.7 3.76 4 3.92v3.24c-1.38.13-2.64-.32-3.86-1.09v5.98c0 3.02-1.84 5.08-4.64 5.08-2.55 0-4.5-1.78-4.5-4.12 0-2.6 2.1-4.34 5.08-4.1v3.32c-.88-.14-1.62.28-1.62 1.02 0 .64.52 1.08 1.2 1.08.82 0 1.26-.48 1.26-1.58V3h3.08z" fill="currentColor"/></svg><span>TIKTOK（公開予定）</span>`
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
        const dropdownShopName = String(text || "")
            .replace(/<[^>]*>/g, "")
            .replace("Rasiːm", "Rasi:m")
            .trim()
            .toLowerCase();

        if (action === "link" && currentShopName && dropdownShopName === currentShopName) {
            return `<span class="helmetty-link-dropdown-item is-current-shop"><svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.2 16.6 4.9 12.3l1.7-1.7 2.6 2.6 8.2-8.2 1.7 1.7-9.9 9.9z" fill="currentColor"/></svg><span>${escHtml(text)}</span><span class="helmetty-link-current-badge">NOW</span></span>`;
        }

        return `<span class="helmetty-link-dropdown-item">${text}</span>`;
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
      <a href="${escAttr(normalizedUrl)}" class="helmetty-link" data-action="${escAttr(action)}" data-url="${escAttr(normalizedUrl)}" style="--dropdown-height:${dropdownHeight}rem">
        <span class="helmetty-link-label">${escHtml(label)}</span>
        <span class="helmetty-link-dropdown" aria-hidden="true">
          ${renderDropdown(action, brand)}
        </span>
      </a>
    `;
}

export function getHelmettyHtml(settings = {}) {
    const s = {
        brand: "HELMETTY",
        brandPrefix: "he",
        brandLogo: "https://static.wixstatic.com/media/414ae9_65ab64b531c549699eb7420ea84e0c95~mv2.jpg",
        colorBoxBg: "#fff1f0",
        colorBoxText: "#ff8acb",
        colorBackBg: "#fffbd1",
        colorBackBorder: "#ffd6d6",
        colorBackText: "#e89aaa",
        colorButtonBg: "#fff6f6",
        colorButtonText: "#e68ab8",
        colorButtonBorder: "#ffc7ee",
        linkTop: "/helmetty-top",
        linkPolicy: "/policy",
        linkForm: "/contact",
        linkNotice: "/notice",
        linkLink: "/onlinestore-top",
        linkInsta: "https://www.instagram.com/helmetty_shop",
        instaLink: "INSTAGRAM",
        ...settings
    };

    const brand = firstText(s.brand, "HELMETTY");
    const logoUrl = firstText(s.brandLogo);
    const catchEyebrow = firstText(s.catchEyebrow, "HELMETTY ONLINE STORE");
    const catchMain = firstText(s.catchMain, "今日の足もとに、ちょっとした遊び心を。");
    const catchSub = firstText(s.catchSub, "かわいくて、気分が上がるシューズを集めました。");

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
    --helmetty-box-bg: ${firstText(s.colorBoxBg, "#fff1f0")};
    --helmetty-box-text: ${firstText(s.colorBoxText, "#ff8acb")};
    --helmetty-back-bg: ${firstText(s.colorBackBg, "#fffbd1")};
    --helmetty-back-border: ${firstText(s.colorBackBorder, "#ffd6d6")};
    --helmetty-back-text: ${firstText(s.colorBackText, "#e89aaa")};
    --helmetty-button-bg: ${firstText(s.colorButtonBg, "#fff6f6")};
    --helmetty-button-text: ${firstText(s.colorButtonText, "#e68ab8")};
    --helmetty-button-border: ${firstText(s.colorButtonBorder, "#ffc7ee")};
    --helmetty-muted: color-mix(in srgb, var(--helmetty-back-text) 80%, #5c344a);
    --helmetty-soft: color-mix(in srgb, var(--helmetty-box-bg) 62%, #ffffff);
    --helmetty-line: color-mix(in srgb, var(--helmetty-button-border) 42%, transparent);
    --helmetty-shadow-soft: 0 1.125rem 2.5rem rgba(105, 26, 78, 0.07);
  }

  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    background: transparent;
    font-family: "Yu Gothic", "Hiragino Sans", "Helvetica Neue", Arial, sans-serif;
  }

  .helmetty-box {
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
      linear-gradient(90deg, color-mix(in srgb, var(--helmetty-box-bg) 26%, transparent), rgba(255,255,255,0.82));
    color: var(--helmetty-box-text);
    box-shadow: var(--helmetty-shadow-soft);
    border: 1px solid rgba(216, 203, 184, 0.75);
    border-radius: 36px;
    animation: helmettyPanelBreath 7.8s ease-in-out infinite;
  }

  .helmetty-box::before,
  .helmetty-box::after {
    content: "";
    position: absolute;
    left: 2.125rem;
    right: 2.125rem;
    height: 0.0625rem;
    background: var(--helmetty-line);
    pointer-events: none;
    z-index: -1;
  }

  .helmetty-box::before {
    top: 1.125rem;
  }

  .helmetty-box::after {
    bottom: 1.125rem;
  }

  .helmetty-copy {
    grid-area: copy;
    min-width: 0;
    max-width: 47.5rem;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      "eyebrow"
      "main"
      "sub";
    row-gap: 0.5625rem;
    position: relative;
    padding: 0.125rem 0 0.125rem 1.375rem;
    align-items: start;
    align-content: start;
    border-left: 0.0625rem solid color-mix(in srgb, var(--helmetty-box-text) 28%, transparent);
    animation: helmettyCopyBlockIn 0.72s cubic-bezier(.2,.82,.24,1) both;
  }

  .helmetty-copy::before {
    content: "";
    position: absolute;
    left: -0.25rem;
    top: 0.25rem;
    width: 0.4375rem;
    height: 0.4375rem;
    border-radius: 999rem;
    background: var(--helmetty-button-border);
    opacity: 0.55;
    box-shadow: 0 0 0 0.3125rem color-mix(in srgb, var(--helmetty-button-border) 14%, transparent);
    pointer-events: none;
  }

  .helmetty-logo-wrap {
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

  .helmetty-logo {
    display: block;
    width: min(29.375rem, 100%);
    max-height: 7.875rem;
    object-fit: contain;
    transform: translateX(0.375rem) rotate(0deg);
    filter: none;
  }

  .helmetty-logo-placeholder {
    width: 100%;
    max-width: 21.25rem;
    height: 5.5rem;
    display: grid;
    place-items: center;
    font-size: 0.9375rem;
    font-weight: 500;
    letter-spacing: 0.22em;
    opacity: 0.58;
    background: transparent;
    color: var(--helmetty-muted);
  }

  .helmetty-catch-eyebrow {
    grid-area: eyebrow;
    width: fit-content;
    max-width: 100%;
    font-size: 0.6875rem;
    line-height: 1;
    font-weight: 700;
    letter-spacing: 0.22em;
    color: color-mix(in srgb, var(--helmetty-box-text) 72%, #ffffff);
    white-space: nowrap;
    text-transform: uppercase;
    padding: 0.4375rem 0.625rem 0.375rem;
    background: var(--helmetty-soft);
    border: 0.0625rem solid color-mix(in srgb, var(--helmetty-button-border) 32%, #ffffff);
    border-radius: 999rem;
    box-shadow: 0 0.5rem 1.125rem rgba(168, 107, 141, 0.06);
    animation: helmettyCopyLineIn 0.58s cubic-bezier(.2,.82,.24,1) 0.08s both;
  }

  .helmetty-catch-main {
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
    color: color-mix(in srgb, var(--helmetty-box-text) 78%, #3f2433);
    text-shadow:
      0 0.0625rem 0 rgba(255,255,255,0.7),
      0 0.5rem 1.125rem rgba(168,107,141,0.07);
    animation: helmettyCopyMainIn 0.78s cubic-bezier(.2,.82,.24,1) 0.16s both;
  }

  .helmetty-catch-sub {
    grid-area: sub;
    align-self: start;
    font-size: clamp(0.75rem, 0.9vw, 0.9375rem);
    line-height: 1.75;
    font-weight: 400;
    letter-spacing: 0.055em;
    color: var(--helmetty-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 35rem;
    padding-bottom: 0;
    animation: helmettyCopyLineIn 0.68s cubic-bezier(.2,.82,.24,1) 0.28s both;
  }

  .helmetty-links {
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

  .helmetty-links::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    width: auto;
    height: 0.0625rem;
    background: var(--helmetty-line);
    transform: none;
    pointer-events: none;
  }

  .helmetty-link {
    --tab-bg: color-mix(in srgb, var(--helmetty-box-text) 62%, #ffffff);
    --tab-hover: color-mix(in srgb, var(--helmetty-button-text) 68%, #ffffff);
    --tab-ink: rgba(92, 52, 74, 0.92);
    --tab-drop-bg: color-mix(in srgb, var(--tab-bg) 46%, #ffffff);
    --tab-drop-hover: color-mix(in srgb, var(--tab-hover) 46%, #ffffff);
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
    box-shadow: 0 0.625rem 1.375rem rgba(168, 107, 141, 0.06);
    border-radius: 0;
    text-align: center;
    text-shadow:
      0 0.0625rem 0 rgba(255,255,255,0.55),
      0 0 0.625rem rgba(255,255,255,0.35);
    transform: translateY(0);
    transform-origin: center center;
    overflow: visible;
    will-change: transform;
    backface-visibility: hidden;
    animation: helmettyLinkRiseIn 0.54s cubic-bezier(.2,.82,.24,1) both;
    transition:
      background-color 0.28s ease,
      color 0.22s ease,
      opacity 0.22s ease,
      transform 0.28s cubic-bezier(.73,.32,.34,1.5),
      box-shadow 0.28s ease;
  }

  .helmetty-link:nth-child(1) {
    --tab-bg: color-mix(in srgb, var(--helmetty-box-text) 58%, #ffffff);
    --tab-hover: color-mix(in srgb, var(--helmetty-button-text) 66%, #ffffff);
    animation-delay: 0.34s;
  }

  .helmetty-link:nth-child(2) {
    --tab-bg: #9ecfe0;
    --tab-hover: #83c0d4;
    animation-delay: 0.4s;
  }

  .helmetty-link:nth-child(3) {
    --tab-bg: #e8aaaa;
    --tab-hover: #dc9696;
    animation-delay: 0.46s;
  }

  .helmetty-link:nth-child(4) {
    --tab-bg: #efd093;
    --tab-hover: #e6c176;
    animation-delay: 0.52s;
  }

  .helmetty-link:nth-child(5) {
    --tab-bg: #c7df91;
    --tab-hover: #b7d978;
    animation-delay: 0.58s;
  }

  .helmetty-link-label {
    position: relative;
    z-index: 4;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    pointer-events: none;
  }

  .helmetty-link::before {
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

  .helmetty-link::after {
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

  .helmetty-link:last-child {
    margin-right: 0;
  }

  .helmetty-link:hover,
  .helmetty-link.is-open,
  .helmetty-link.is-closing {
    background: var(--tab-hover);
    color: var(--tab-ink);
    opacity: 1;
    box-shadow: 0 1rem 1.75rem rgba(168,107,141,0.1);
    transform: translateY(-0.25rem);
  }

  .helmetty-link:hover::before,
  .helmetty-link.is-open::before,
  .helmetty-link.is-closing::before {
    background: var(--tab-drop-hover);
    height: 0;
    opacity: 0;
    animation: none;
  }

  .helmetty-link:hover::after,
  .helmetty-link.is-open::after,
  .helmetty-link.is-closing::after {
    height: 0;
  }

  .helmetty-link:active {
    transform: translateY(-0.125rem);
    opacity: 0.78;
  }

  .helmetty-link-dropdown {
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
    box-shadow: 0 1.125rem 1.75rem rgba(168,107,141,0.08);
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

  .helmetty-link.is-open .helmetty-link-dropdown {
    height: var(--dropdown-height, 9.75rem);
    padding: 0.625rem 0 2.375rem;
    background: var(--tab-drop-hover);
    opacity: 1;
    transform: translateY(0) scaleY(1);
    pointer-events: auto;
    animation: helmettyDropdownOpenBounce 0.96s cubic-bezier(.18,.9,.2,1) both;
  }

  .helmetty-link.is-closing .helmetty-link-dropdown {
    height: 0;
    padding: 0;
    background: var(--tab-drop-hover);
    opacity: 0;
    transform: translateY(0) scaleY(0.02);
    pointer-events: none;
    animation: none;
  }

  .helmetty-link-dropdown-item {
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
    color: rgba(92,52,74,0.78);
    text-shadow:
      0 0.0625rem 0 rgba(255,255,255,0.5),
      0 0 0.5rem rgba(255,255,255,0.28);
    opacity: 0;
    transform: translateY(-0.375rem);
    border-bottom: 0.0625rem solid rgba(92,52,74,0.12);
    transition:
      opacity 0.34s ease,
      transform 0.44s cubic-bezier(.2,.82,.24,1),
      background-color 0.22s ease;
  }

  .helmetty-link-dropdown-item:hover {
    background: rgba(92,52,74,0.13);
  }

  .helmetty-link-dropdown-item span {
    min-width: 0;
    white-space: normal;
    line-height: 1.25;
  }

  .helmetty-link-dropdown-item.is-current-shop {
    background: rgba(92,52,74,0.18);
    font-weight: 900;
    box-shadow: inset 0 0 0 0.0625rem rgba(92,52,74,0.18);
  }

  .helmetty-link-current-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 2.25rem;
    padding: 0.1875rem 0.375rem;
    border-radius: 999rem;
    background: rgba(92,52,74,0.18);
    font-size: 0.625rem;
    line-height: 1;
    font-weight: 900;
    letter-spacing: 0.08em;
  }

  .helmetty-link-dropdown-item:last-child {
    border-bottom: 0;
  }

  .helmetty-link.is-open .helmetty-link-dropdown-item,
  .helmetty-link.is-closing .helmetty-link-dropdown-item {
    opacity: 1;
    transform: translateY(0);
  }

  .helmetty-link.is-open .helmetty-link-dropdown-item {
    animation: helmettyDropdownItemPop 0.42s cubic-bezier(.18,.9,.2,1) both;
  }

  .helmetty-link.is-open .helmetty-link-dropdown-item:nth-child(1) {
    animation-delay: 0.04s;
  }

  .helmetty-link.is-open .helmetty-link-dropdown-item:nth-child(2) {
    animation-delay: 0.08s;
  }

  .helmetty-link.is-open .helmetty-link-dropdown-item:nth-child(3) {
    animation-delay: 0.12s;
  }

  .helmetty-link.is-open .helmetty-link-dropdown-item:nth-child(4) {
    animation-delay: 0.16s;
  }

  .helmetty-link.is-open .helmetty-link-dropdown-item:nth-child(5) {
    animation-delay: 0.2s;
  }

  @keyframes helmettyPanelBreath {
    0%, 100% {
      background-position: 0% 50%, 0 0, 0 0;
    }

    50% {
      background-position: 100% 50%, 0 0, 0 0;
    }
  }

  @keyframes helmettyCopyBlockIn {
    from {
      opacity: 0;
      transform: translateY(0.625rem);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes helmettyCopyLineIn {
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

  @keyframes helmettyCopyMainIn {
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

  @keyframes helmettyLinkRiseIn {
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

  @keyframes helmettyDropdownOpenBounce {
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

  @keyframes helmettyDropdownItemPop {
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
    .helmetty-box {
      grid-template-columns: minmax(0, 1fr) 13.75rem;
      grid-template-areas:
        "copy logo"
        "links links";
      gap: 0.125rem 1.125rem;
      min-height: 9.5rem;
      padding: 1.375rem 1.125rem 1.25rem;
      border-radius: 28px;
    }

    .helmetty-box::before,
    .helmetty-box::after {
      left: 1.125rem;
      right: 1.125rem;
    }

    .helmetty-copy {
      max-width: 38.75rem;
      padding-left: 1.125rem;
    }

    .helmetty-catch-main {
      font-size: clamp(1.375rem, 3.2vw, 1.9375rem);
    }

    .helmetty-catch-sub {
      font-size: 0.75rem;
      max-width: 32.5rem;
    }

    .helmetty-links {
      margin-top: -0.25rem;
      padding: 0.125rem 0.875rem 0;
      transform: none;
    }

    .helmetty-link {
      flex: 0 0 8.25rem;
      width: 8.25rem;
      min-height: 2.75rem;
      font-size: clamp(0.6875rem, 1.6vw, 0.875rem);
      padding: 0 0.75rem;
      margin: 0 0.5rem 1rem 0;
    }

    .helmetty-logo-wrap {
      height: 5.125rem;
    }

    .helmetty-logo {
      max-height: 5.625rem;
      width: min(16.875rem, 100%);
      transform: translateX(0.125rem) rotate(0deg);
    }
  }

  @media (max-width: 640px) {
    .helmetty-box {
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

    .helmetty-box::before,
    .helmetty-box::after {
      left: 1rem;
      right: 1rem;
    }

    .helmetty-copy {
      padding-left: 1rem;
    }

    .helmetty-catch-eyebrow {
      font-size: 0.625rem;
      letter-spacing: 0.18em;
      padding: 0.375rem 0.5625rem 0.3125rem;
    }

    .helmetty-catch-main {
      font-size: clamp(1.25rem, 6.2vw, 1.75rem);
      line-height: 1.22;
      white-space: normal;
    }

    .helmetty-catch-sub {
      white-space: normal;
      max-width: none;
      font-size: 0.75rem;
      line-height: 1.65;
    }

    .helmetty-links {
      row-gap: 0.5rem;
      margin-top: -0.125rem;
      padding: 0.125rem 0 0;
      transform: none;
      flex-wrap: wrap;
      justify-content: flex-start;
    }

    .helmetty-link {
      flex: 0 0 8.625rem;
      width: 8.625rem;
      min-height: 2.75rem;
      font-size: clamp(0.6875rem, 3.4vw, 0.875rem);
      padding: 0 0.625rem;
      margin: 0 0.5rem 1rem 0;
    }

    .helmetty-logo-wrap {
      justify-content: flex-start;
      height: 3.875rem;
    }

    .helmetty-logo {
      width: min(19.375rem, 96%);
      max-height: 4.5rem;
      transform: none;
    }
  }
</style>

<div class="helmetty-box">
  <div class="helmetty-copy">
    <div class="helmetty-catch-eyebrow">
      ${escHtml(catchEyebrow)}
    </div>

    <div class="helmetty-catch-main">
      ${escHtml(catchMain)}
    </div>

    <div class="helmetty-catch-sub">
      ${escHtml(catchSub)}
    </div>

  </div>

  <div class="helmetty-logo-wrap">
    ${
        logoUrl
            ? `<img class="helmetty-logo" src="${escAttr(logoUrl)}" alt="${escAttr(brand)}" />`
            : `<div class="helmetty-logo-placeholder">${escHtml(brand)}</div>`
    }
  </div>

  <nav class="helmetty-links" aria-label="ブランドリンク">
    ${links}
  </nav>
</div>

<script>
  (function () {
    var brandName = ${JSON.stringify(brand)};

    document.querySelectorAll(".helmetty-link").forEach(function (link) {
      var closeTimer = null;
      var dropdown = link.querySelector(".helmetty-link-dropdown");

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

    document.querySelectorAll(".helmetty-box a[href]").forEach(function (link) {
      link.addEventListener("click", function (event) {
        var href = String(link.getAttribute("href") || "").trim();
        var action = String(link.dataset.action || "").trim();

        if (!href || href === "#") {
          event.preventDefault();
          return;
        }

        if (action === "insta") {
          event.preventDefault();
          window.open(href, "_blank");
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
          return;
        }

        window.location.href = href;
      });
    });
  })();
</script>
`;
}
