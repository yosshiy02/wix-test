function escAttr(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;");
}

export function getHelmettyHtml(settings = {}) {
    const s = settings || {};

    return `
<style>
  .helmetty-box {
    background: ${s.colorBoxBg};
    color: ${s.colorBoxText};
    padding: 1.25rem 2rem;
    border-radius: 36px;
    border: 1px solid rgba(216, 203, 184, 0.75);
    box-shadow: 0 1.125rem 2.5rem rgba(105, 26, 78, 0.07);
  }

  .helmetty-logo {
    display: block;
    max-width: min(29.375rem, 100%);
    max-height: 7.875rem;
    object-fit: contain;
    margin-left: auto;
    margin-bottom: 0.75rem;
  }

  .helmetty-catch-eyebrow {
    font-size: 0.6875rem;
    line-height: 1;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    margin-bottom: 0.5rem;
  }

  .helmetty-catch-main {
    font-size: clamp(0.8125rem, 2.1vw, 2.25rem);
    line-height: 1.18;
    font-weight: 500;
    margin: 0 0 0.5rem;
  }

  .helmetty-catch-sub {
    font-size: clamp(0.75rem, 0.9vw, 0.9375rem);
    line-height: 1.75;
    margin: 0 0 1rem;
  }

  .helmetty-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: ${s.colorButtonBg};
    color: ${s.colorButtonText};
    border: 1px solid ${s.colorButtonBorder};
    padding: 0.75rem 1.25rem;
    text-decoration: none;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .helmetty-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .helmetty-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: ${s.colorButtonBg};
    color: ${s.colorButtonText};
    border: 1px solid ${s.colorButtonBorder};
    padding: 0.5rem 0.875rem;
    text-decoration: none;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
</style>

<div class="helmetty-box">

  <img class="helmetty-logo" src="${escAttr(s.brandLogo)}" alt="${escAttr(s.brand || "HELMETTY")}" />

  <div class="helmetty-catch-eyebrow">
    HELMETTY ONLINE STORE
  </div>

  <div class="helmetty-catch-main">
    今日の足もとに、ちょっとした遊び心を。
  </div>

  <div class="helmetty-catch-sub">
    かわいくて、気分が上がるシューズを集めました。
  </div>

  <a href="${escAttr(s.linkTop)}" class="helmetty-button">
    VIEW MORE
  </a>

  <nav class="helmetty-links" aria-label="ブランドリンク">
    <a href="${escAttr(s.linkTop)}" class="helmetty-link">TOP</a>
    <a href="${escAttr(s.linkLink)}" class="helmetty-link">LINKSTORE</a>
    <a href="${escAttr(s.linkInsta)}" class="helmetty-link">SNS</a>
    <a href="${escAttr(s.linkPolicy)}" class="helmetty-link">GUIDE</a>
    <a href="${escAttr(s.linkForm)}" class="helmetty-link">CONTACT</a>
  </nav>

</div>

<script>
  (function () {
    console.log("HELMETTY animation start");

    document.querySelectorAll(".helmetty-box a[href]").forEach(function (link) {
      link.addEventListener("click", function (event) {
        var href = String(link.getAttribute("href") || "").trim();
        if (!href || href === "#") {
          event.preventDefault();
          return;
        }

        if (window.parent && window.parent !== window) {
          event.preventDefault();
          window.parent.postMessage({
            channel: "PcBrandBoxHtml",
            type: "brandBoxClick",
            url: href,
            brand: ${JSON.stringify(String(s.brand || "HELMETTY"))}
          }, "*");
        }
      });
    });
  })();
</script>
`;
}
