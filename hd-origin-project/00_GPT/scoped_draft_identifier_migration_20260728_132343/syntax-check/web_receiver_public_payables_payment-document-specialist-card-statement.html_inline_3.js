
(function () {
  function cleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function showResultSafe(value) {
    var text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    var result = document.getElementById("result");

    if (result) {
      result.textContent = text;
      result.classList.add("has-message");
      return;
    }

    alert(text);
  }

  function isElementActuallyVisible(element) {
    if (!element) return false;

    if (element.closest(".ai-section-hidden")) return false;
    if (element.closest(".ai-field-hidden")) return false;

    var node = element;

    while (node && node.nodeType === 1) {
      if (node.hidden) return false;

      var style = window.getComputedStyle(node);

      if (!style) return false;
      if (style.display === "none") return false;
      if (style.visibility === "hidden") return false;

      if (node === document.body) break;

      node = node.parentElement;
    }

    return true;
  }

  function labelFor(control) {
    if (!control) return "";

    var label = control.closest("label");

    if (!label) {
      return control.id || control.name || control.tagName || "";
    }

    var clone = label.cloneNode(true);

    clone.querySelectorAll("input, select, textarea, button, option").forEach(function (el) {
      el.remove();
    });

    return cleanText(clone.textContent) || control.id || control.name || "";
  }

  function sectionFor(control) {
    var section = control && control.closest(".analysis-section");

    if (!section) {
      return "未分類";
    }

    var title = section.querySelector(".analysis-section-title");

    return title ? cleanText(title.textContent) : "未分類";
  }

  function valueFor(control) {
    if (!control) {
      return {
        value: "",
        displayText: ""
      };
    }

    if (control.tagName === "SELECT") {
      var option = control.options && control.selectedIndex >= 0
        ? control.options[control.selectedIndex]
        : null;

      return {
        value: String(control.value || ""),
        displayText: option ? cleanText(option.textContent) : ""
      };
    }

    return {
      value: control.value === null || control.value === undefined ? "" : String(control.value),
      displayText: ""
    };
  }

  function collectVisibleFieldsOnly() {
    var controls = Array.from(document.querySelectorAll(".analysis-panel .analysis-field"))
      .filter(function (control) {
        if (!control || control.type === "hidden") return false;

        var label = control.closest("label") || control;
        var section = control.closest(".analysis-section");

        if (!isElementActuallyVisible(section || label)) return false;
        if (!isElementActuallyVisible(label)) return false;
        if (!isElementActuallyVisible(control)) return false;

        return true;
      });

    return controls.map(function (control, index) {
      var valueInfo = valueFor(control);

      return {
        no: index + 1,
        section: sectionFor(control),
        label: labelFor(control),
        id: control.id || "",
        tagName: control.tagName || "",
        type: control.type || "",
        value: valueInfo.value,
        displayText: valueInfo.displayText,
        placeholder: control.getAttribute("placeholder") || "",
        masterType: control.dataset ? (control.dataset.masterType || "") : "",
        masterLabel: control.dataset ? (control.dataset.masterLabel || "") : ""
      };
    });
  }

  function safeSelectedIndex() {
    try {
      if (typeof selectedIndex === "number") {
        return selectedIndex;
      }
    } catch (error) {
      return -1;
    }

    return -1;
  }

  function safeSelectedItem() {
    try {
      if (typeof items !== "undefined" && Array.isArray(items)) {
        var index = safeSelectedIndex();

        if (index >= 0 && items[index]) {
          return items[index];
        }
      }
    } catch (error) {
      return null;
    }

    return null;
  }

  function safeSelectedOcrImportId() {
    try {
      if (typeof selectedOcrImportId === "function") {
        return selectedOcrImportId() || "";
      }
    } catch (error) {
      // noop
    }

    var item = safeSelectedItem();

    if (!item) {
      return "";
    }

    return item.paymentDocumentOcrImportId || item.payment_document_ocr_import_id || "";
  }

  async function exportVisibleFieldsMemoVisibleOnly() {
    var button = document.getElementById("visibleFieldsMemoButton") || document.querySelector(".mini-memo-button");
    var oldText = button ? button.textContent : "";
    var item = safeSelectedItem();

    if (button) {
      button.disabled = true;
      button.textContent = "出力中";
    }

    try {
      var fields = collectVisibleFieldsOnly();

      var payload = {
        pageTitle: document.title || "",
        pagePath: location.pathname,
        selectedIndex: safeSelectedIndex(),
        selectedOcrImportId: safeSelectedOcrImportId(),
        selectedItem: item ? {
          paymentDocumentOcrImportId: item.paymentDocumentOcrImportId || item.payment_document_ocr_import_id || "",
          originalFileName: item.originalFileName || "",
          savedFileName: item.savedFileName || item.fileName || "",
          mimeType: item.mimeType || "",
          ocrStatus: item.ocrStatus || "",
          savedAt: item.savedAt || "",
          updatedAt: item.updatedAt || ""
        } : null,
                ocrRawText: item ? String(item.ocrRawText || item.ocr_raw_text || item.ocrText || "") : "",
        ocrTextLength: item ? Number(item.ocrTextLength || item.ocr_text_length || String(item.ocrRawText || item.ocr_raw_text || item.ocrText || "").length || 0) : 0,sortingAppliedCount: window.__lastAnalysisResultAppliedCount || 0,
        aiMissingControls: Array.isArray(window.__lastAnalysisResultMissingControls) ? window.__lastAnalysisResultMissingControls : [],
        fields: fields
      };

      showResultSafe({
        ok: true,
        message: "表示中の項目だけをmemoへ出します。",
        visibleFieldCount: fields.length
      });

      var res = await fetch("/api/payment-documents/review-visible-fields-memo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify(payload)
      });

      var responseText = await res.text();
      var data = {};

      try {
        data = JSON.parse(responseText || "{}");
      } catch (error) {
        throw new Error("API応答がJSONではありません: " + responseText.slice(0, 300));
      }

      if (!res.ok || !data.ok) {
        throw new Error(data.error || data.message || ("HTTP " + res.status));
      }

      showResultSafe({
        ok: true,
        message: "表示中の項目だけをmemoへ出しました。",
        count: data.count,
        memoPath: data.memoPath,
        openedNotepad: data.openedNotepad
      });
    } catch (error) {
      showResultSafe({
        ok: false,
        error: error.message || String(error)
      });
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = oldText || "表示";
      }
    }
  }

  function attachVisibleMemoButton() {
    var button = document.getElementById("visibleFieldsMemoButton") || document.querySelector(".mini-memo-button");

    if (!button) {
      return;
    }

    button.onclick = null;

    button.addEventListener("click", function (event) {
      event.preventDefault();
      exportVisibleFieldsMemoVisibleOnly();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", attachVisibleMemoButton);
  } else {
    attachVisibleMemoButton();
  }

  window.exportVisibleFieldsMemoVisibleOnly = exportVisibleFieldsMemoVisibleOnly;
})();
