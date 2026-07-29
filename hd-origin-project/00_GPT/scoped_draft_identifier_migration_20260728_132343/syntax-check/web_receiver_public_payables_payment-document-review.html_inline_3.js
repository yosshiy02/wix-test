
(function () {
  window.__hdOriginPaymentAnalyzeBusyInstalled = true;
  window.__hdOriginPaymentBulkBusyRunning = false;

  function textOf(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;

    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      return String(value);
    }
  }

  function ensureAnalyzeBusyPanel() {
    let panel = document.getElementById("hdPaymentAnalyzeBusyPanel");

    if (panel) {
      return panel;
    }

    panel = document.createElement("div");
    panel.id = "hdPaymentAnalyzeBusyPanel";
    panel.className = "hd-analyze-busy-panel";
    panel.setAttribute("aria-live", "polite");
    panel.innerHTML = [
      '<div class="hd-analyze-busy-card">',
      '  <div class="hd-analyze-spinner" aria-hidden="true"></div>',
      '  <div class="hd-analyze-busy-main">',
      '    <div class="hd-analyze-busy-title" id="hdAnalyzeBusyTitle">仕分け中です</div>',
      '    <div class="hd-analyze-busy-sub" id="hdAnalyzeBusySub">AIが仕分け候補を作成しています。</div>',
      '    <div class="hd-analyze-progress">',
      '      <div class="hd-analyze-progress-bar" id="hdAnalyzeProgressBar"></div>',
      '    </div>',
      '    <div class="hd-analyze-busy-detail" id="hdAnalyzeBusyDetail">画面を閉じずにお待ちください。</div>',
      '  </div>',
      '</div>'
    ].join("");

    document.body.appendChild(panel);
    return panel;
  }

  function setAnalyzeButtonsDisabled(disabled) {
    const selector = [
      'button[onclick*="runSelectedAnalyses"]',
      'button[onclick*="runAnalysisForItemIndex"]',
      'button[onclick*="runAnalysisFromSelectedOcr"]',
      '.sorting-bulk-analyze',
      '.sorting-single-analyze',
      '.action-ai'
    ].join(",");

    document.querySelectorAll(selector).forEach(button => {
      if (!button) return;

      if (disabled) {
        if (!button.dataset.hdAnalyzeOldDisabled) {
          button.dataset.hdAnalyzeOldDisabled = button.disabled ? "1" : "0";
        }

        button.disabled = true;
        button.classList.add("hd-analyze-button-disabled");
      } else {
        if (button.dataset.hdAnalyzeOldDisabled === "0") {
          button.disabled = false;
        }

        if (button.dataset.hdAnalyzeOldDisabled === "1") {
          button.disabled = true;
        }

        delete button.dataset.hdAnalyzeOldDisabled;
        button.classList.remove("hd-analyze-button-disabled");
      }
    });
  }

  window.hdPaymentSetAnalyzeBusy = function (active, options) {
    const panel = ensureAnalyzeBusyPanel();
    const opt = options || {};

    const title = document.getElementById("hdAnalyzeBusyTitle");
    const sub = document.getElementById("hdAnalyzeBusySub");
    const detail = document.getElementById("hdAnalyzeBusyDetail");
    const bar = document.getElementById("hdAnalyzeProgressBar");

    if (active) {
      document.body.classList.add("hd-analyze-busy");
      panel.classList.add("visible");

      if (title) title.textContent = opt.title || "仕分け中です";
      if (sub) sub.textContent = opt.sub || "AIが仕分け候補を作成しています。";

      const current = Number(opt.current || 0);
      const total = Number(opt.total || 0);
      const fileName = String(opt.fileName || "").trim();

      if (detail) {
        if (total > 0 && current > 0) {
          detail.textContent =
            "処理中: " + current + " / " + total +
            (fileName ? "　" + fileName : "");
        } else {
          detail.textContent = fileName || opt.detail || "画面を閉じずにお待ちください。";
        }
      }

      if (bar) {
        if (total > 0 && current > 0) {
          const percent = Math.max(4, Math.min(100, Math.round((current / total) * 100)));
          bar.style.width = percent + "%";
          bar.classList.remove("indeterminate");
        } else {
          bar.style.width = "45%";
          bar.classList.add("indeterminate");
        }
      }

      setAnalyzeButtonsDisabled(true);
    } else {
      document.body.classList.remove("hd-analyze-busy");
      panel.classList.remove("visible");
      setAnalyzeButtonsDisabled(false);

      if (bar) {
        bar.style.width = "0%";
        bar.classList.remove("indeterminate");
      }
    }
  };

  window.hdPaymentAnalyzeStep = function (current, total, fileName) {
    window.hdPaymentSetAnalyzeBusy(true, {
      title: "まとめて仕分け中です",
      sub: "チェックした書類を順番に仕分けています。",
      current: current,
      total: total,
      fileName: fileName || ""
    });
  };

  function parseProgressMessage(message) {
    const text = textOf(message);

    if (!text) return;

    if (text.includes("まとめて解析中") || text.includes("まとめて仕分け中")) {
      const match = text.match(/(\d+)\s*\/\s*(\d+)/);
      const lines = text.split(/\r?\n/);
      const fileName = lines.length ? lines[lines.length - 1] : "";

      window.__hdOriginPaymentBulkBusyRunning = true;

      window.hdPaymentSetAnalyzeBusy(true, {
        title: "まとめて仕分け中です",
        sub: "選択した書類を1件ずつAI仕分けしています。",
        current: match ? Number(match[1]) : 0,
        total: match ? Number(match[2]) : 0,
        fileName: fileName || ""
      });

      return;
    }

    if (
      text.includes("単品解析中") ||
      text.includes("単品仕分け中") ||
      text.includes("AIで書類分類") ||
      text.includes("必要項目だけ抽出")
    ) {
      if (window.__hdOriginPaymentBulkBusyRunning) {
        return;
      }

      window.hdPaymentSetAnalyzeBusy(true, {
        title: "単品仕分け中です",
        sub: "OCR本文から種類・行き先を判定しています。",
        detail: "AI応答待ちです。画面を閉じずにお待ちください。"
      });

      return;
    }

    if (
      text.includes("まとめて解析が完了") ||
      text.includes("まとめて仕分けが完了") ||
      text.includes("解析が完了") ||
      text.includes("仕分けが完了") ||
      text.includes("AI解析失敗") ||
      text.includes("AI仕分け失敗") ||
      text.includes("解析する書類が見つかりません") ||
      text.includes("仕分けする書類が見つかりません") ||
      text.includes("エラー")
    ) {
      if (text.includes("まとめて解析が完了") || text.includes("まとめて仕分けが完了")) {
        window.__hdOriginPaymentBulkBusyRunning = false;
      }

      window.setTimeout(function () {
        if (!window.__hdOriginPaymentBulkBusyRunning) {
          window.hdPaymentSetAnalyzeBusy(false);
        }
      }, 900);
    }
  }

  function wrapShowResult() {
    if (typeof window.showResult !== "function") return false;

    if (window.showResult.__hdAnalyzeBusyWrappedV2) {
      return true;
    }

    const originalShowResult = window.showResult;

    const wrapped = function (message) {
      parseProgressMessage(message);
      return originalShowResult.apply(this, arguments);
    };

    wrapped.__hdAnalyzeBusyWrappedV2 = true;
    window.showResult = wrapped;

    return true;
  }

  function wrapAnalyzerFunction(name) {
    const fn = window[name];

    if (typeof fn !== "function") return false;

    if (fn.__hdAnalyzeBusyWrappedV2) {
      return true;
    }

    const original = fn;

    const wrapped = async function () {
      const isBulk = name === "runSelectedAnalyses";
      const wasBulkRunning = window.__hdOriginPaymentBulkBusyRunning;

      if (isBulk) {
        window.__hdOriginPaymentBulkBusyRunning = true;

        window.hdPaymentSetAnalyzeBusy(true, {
          title: "まとめて仕分け中です",
          sub: "選択した書類を順番に仕分けています。",
          detail: "動いています。画面を閉じずにお待ちください。"
        });
      } else if (!window.__hdOriginPaymentBulkBusyRunning) {
        window.hdPaymentSetAnalyzeBusy(true, {
          title: "単品仕分け中です",
          sub: "AIが仕分け候補を作成しています。",
          detail: "動いています。画面を閉じずにお待ちください。"
        });
      }

      try {
        return await original.apply(this, arguments);
      } finally {
        if (isBulk) {
          window.__hdOriginPaymentBulkBusyRunning = false;

          window.setTimeout(function () {
            window.hdPaymentSetAnalyzeBusy(false);
          }, 1000);
        } else {
          if (!wasBulkRunning && !window.__hdOriginPaymentBulkBusyRunning) {
            window.setTimeout(function () {
              window.hdPaymentSetAnalyzeBusy(false);
            }, 900);
          }
        }
      }
    };

    wrapped.__hdAnalyzeBusyWrappedV2 = true;
    window[name] = wrapped;

    return true;
  }

  function installAnalyzeBusyHooks() {
    ensureAnalyzeBusyPanel();

    wrapShowResult();
    wrapAnalyzerFunction("runSelectedAnalyses");
    wrapAnalyzerFunction("runAnalysisForItemIndex");
    wrapAnalyzerFunction("runAnalysisFromSelectedOcr");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installAnalyzeBusyHooks);
  } else {
    installAnalyzeBusyHooks();
  }

  let retryCount = 0;
  const timer = window.setInterval(function () {
    retryCount++;
    installAnalyzeBusyHooks();

    if (retryCount >= 20) {
      window.clearInterval(timer);
    }
  }, 250);
})();
