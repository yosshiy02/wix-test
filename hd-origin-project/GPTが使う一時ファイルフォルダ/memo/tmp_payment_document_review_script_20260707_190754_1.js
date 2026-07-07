
/* PAYMENT_DOCUMENT_REVIEW_VISIBLE_FIELDS_MEMO_20260707_START */
  function visibleDraftMemoCleanText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function visibleDraftMemoLabelForControl(control) {
    if (!control) return "";

    const label = control.closest("label");

    if (!label) {
      return control.id || control.name || control.tagName || "";
    }

    const clone = label.cloneNode(true);
    clone.querySelectorAll("input, select, textarea, button, option").forEach(el => el.remove());

    return visibleDraftMemoCleanText(clone.textContent) || control.id || control.name || "";
  }

  function visibleDraftMemoSectionForControl(control) {
    const section = control && control.closest(".draft-section");
    if (!section) return "未分類";

    const title = section.querySelector(".draft-section-title");
    return title ? visibleDraftMemoCleanText(title.textContent) : "未分類";
  }

  function visibleDraftMemoValueForControl(control) {
    if (!control) {
      return {
        value: "",
        displayText: ""
      };
    }

    if (control.tagName === "SELECT") {
      const option = control.options && control.selectedIndex >= 0
        ? control.options[control.selectedIndex]
        : null;

      const value = String(control.value || "");
      const displayText = option ? visibleDraftMemoCleanText(option.textContent) : "";

      return {
        value,
        displayText
      };
    }

    return {
      value: control.value === null || control.value === undefined ? "" : String(control.value),
      displayText: ""
    };
  }

  function collectVisibleDraftFieldsForMemo() {
    const controls = Array.from(document.querySelectorAll(".draft-panel .draft-field"))
      .filter(control => control && control.type !== "hidden");

    return controls.map((control, index) => {
      const valueInfo = visibleDraftMemoValueForControl(control);

      return {
        no: index + 1,
        section: visibleDraftMemoSectionForControl(control),
        label: visibleDraftMemoLabelForControl(control),
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

  function visibleDraftMemoSelectedItem() {
    if (Array.isArray(items) && selectedIndex >= 0 && items[selectedIndex]) {
      return items[selectedIndex];
    }

    return null;
  }

  async function exportVisibleDraftFieldsMemo() {
    const button = document.querySelector(".mini-memo-button");
    const oldText = button ? button.textContent : "";
    const item = visibleDraftMemoSelectedItem();

    if (button) {
      button.disabled = true;
      button.textContent = "出力中";
    }

    try {
      const payload = {
        pageTitle: document.title || "",
        pagePath: location.pathname,
        selectedIndex: selectedIndex,
        selectedOcrImportId: typeof selectedOcrImportId === "function" ? selectedOcrImportId() : "",
        selectedItem: item ? {
          paymentDocumentOcrImportId: item.paymentDocumentOcrImportId || item.payment_document_ocr_import_id || "",
          originalFileName: item.originalFileName || "",
          savedFileName: item.savedFileName || item.fileName || "",
          mimeType: item.mimeType || "",
          ocrStatus: item.ocrStatus || "",
          savedAt: item.savedAt || "",
          updatedAt: item.updatedAt || ""
        } : null,
        aiAppliedCount: window.__lastAiDraftAppliedCount || 0,
        aiMissingControls: Array.isArray(window.__lastAiDraftMissingControls) ? window.__lastAiDraftMissingControls : [],
        fields: collectVisibleDraftFieldsForMemo()
      };

      const res = await fetch("/api/payment-documents/review-visible-fields-memo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || "memo出力に失敗しました。");
      }

      showResult(JSON.stringify({
        ok: true,
        message: "表示中の項目をmemoへ出しました。",
        count: data.count,
        memoPath: data.memoPath,
        openedNotepad: data.openedNotepad
      }, null, 2));
    } catch (error) {
      showResult(JSON.stringify({
        ok: false,
        error: error.message || String(error)
      }, null, 2));
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = oldText || "表示";
      }
    }
  }
/* PAYMENT_DOCUMENT_REVIEW_VISIBLE_FIELDS_MEMO_20260707_END */
