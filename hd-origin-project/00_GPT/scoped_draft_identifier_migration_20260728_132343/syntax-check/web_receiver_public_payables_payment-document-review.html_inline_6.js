
(function () {
  "use strict";

  if (window.__hdOriginVisibleMemoDbLatestGpt00Installed) return;
  window.__hdOriginVisibleMemoDbLatestGpt00Installed = true;

  function textValue(value) {
    return String(value === null || value === undefined ? "" : value).trim();
  }

  function showResultLocal(value) {
    if (typeof window.showResultSafe === "function") {
      window.showResultSafe(value);
      return;
    }

    if (typeof window.showResult === "function") {
      window.showResult(value);
      return;
    }

    console.log(value);
  }

  function jsonText(value) {
    if (value === null || value === undefined || value === "") return "";
    if (typeof value === "string") return value;

    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      return String(value);
    }
  }

  function jsonObject(value) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      return value;
    }

    if (
      typeof value !== "string" ||
      !value.trim()
    ) {
      return {};
    }

    try {
      var parsed = JSON.parse(value);

      if (
        parsed &&
        typeof parsed === "object" &&
        !Array.isArray(parsed)
      ) {
        return parsed;
      }

      return {};
    } catch (error) {
      return {};
    }
  }

  async function fetchJson(url) {
    var res = await fetch(url, {
      method: "GET",
      headers: { "Accept": "application/json" }
    });

    var text = await res.text();
    var data = {};

    try {
      data = JSON.parse(text || "{}");
    } catch (error) {
      throw new Error("API応答がJSONではありません: " + text.slice(0, 300));
    }

    if (!res.ok || !data.ok) {
      throw new Error(data.error || data.message || ("HTTP " + res.status));
    }

    return data;
  }

  function getSelectedIndexSafe() {
    try {
      if (typeof selectedIndex === "number") return selectedIndex;
    } catch (error) {}

    return -1;
  }

  function getItemsSafe() {
    try {
      if (typeof items !== "undefined" && Array.isArray(items)) return items;
    } catch (error) {}

    return [];
  }

  function getSelectedItemSafe() {
    var list = getItemsSafe();
    var index = getSelectedIndexSafe();

    if (index >= 0 && list[index]) return list[index];

    return null;
  }

  function itemId(item) {
    if (!item) return "";

    return textValue(
      item.paymentDocumentOcrImportId ||
      item.payment_document_ocr_import_id ||
      item.ocrImportId ||
      item.ocr_import_id ||
      item.id
    );
  }

  function getSelectedOcrImportIdSafe() {
    try {
      if (typeof selectedOcrImportId === "function") {
        var fromFn = textValue(selectedOcrImportId());
        if (fromFn) return fromFn;
      }
    } catch (error) {}

    return itemId(getSelectedItemSafe());
  }

  function itemName(item) {
    if (!item) return "";

    return textValue(
      item.originalFileName ||
      item.original_file_name ||
      item.savedFileName ||
      item.saved_file_name ||
      item.fileName ||
      item.file_name ||
      ""
    );
  }

  function itemOcrText(item) {
    if (!item) return "";

    return String(
      item.ocrRawText ||
      item.ocr_raw_text ||
      item.ocrText ||
      item.ocr_text ||
      ""
    );
  }

  function optionText(control) {
    if (!control) return "";

    if (control.tagName === "SELECT") {
      var opt = control.options && control.selectedIndex >= 0
        ? control.options[control.selectedIndex]
        : null;

      return opt ? textValue(opt.textContent || opt.innerText || opt.value) : "";
    }

    return textValue(control.value);
  }

  function controlLabel(control) {
    if (!control) return "";

    var label = control.closest("label");

    if (label) {
      var clone = label.cloneNode(true);

      clone.querySelectorAll("input, select, textarea, button").forEach(function (el) {
        el.remove();
      });

      var text = textValue(clone.textContent);

      if (text) return text;
    }

    return textValue(
      control.getAttribute("aria-label") ||
      control.getAttribute("placeholder") ||
      control.id ||
      control.name ||
      ""
    );
  }

  function isVisibleControl(control) {
    if (!control) return false;
    if (control.closest(".ai-field-hidden, .ai-section-hidden")) return false;
    if (control.hidden) return false;

    var style = window.getComputedStyle(control);

    if (!style || style.display === "none" || style.visibility === "hidden") return false;

    var parent = control.closest("label, .field, .form-field, .analysis-section");

    if (parent) {
      var pstyle = window.getComputedStyle(parent);

      if (pstyle && (pstyle.display === "none" || pstyle.visibility === "hidden")) return false;
    }

    return true;
  }

  function sectionForControl(control) {
    var section = control.closest(".analysis-section");

    if (!section) return "画面表示中項目";

    var title = section.querySelector(".analysis-section-title");

    return textValue(title ? title.textContent : "") || "画面表示中項目";
  }

  function collectScreenVisibleFields() {
    var fields = [];

    Array.from(document.querySelectorAll(".analysis-field, .master-select")).forEach(function (control) {
      if (!isVisibleControl(control)) return;

      fields.push({
        no: fields.length + 1,
        source: "screen_visible",
        section: sectionForControl(control),
        label: controlLabel(control),
        id: control.id || "",
        tagName: control.tagName || "",
        type: control.type || "",
        value: textValue(control.value),
        displayText: optionText(control),
        placeholder: control.getAttribute("placeholder") || "",
        masterType: control.dataset ? (control.dataset.masterType || "") : "",
        masterLabel: control.dataset ? (control.dataset.masterLabel || "") : ""
      });
    });

    return fields;
  }

  function pushField(fields, section, label, id, value, source) {
    fields.push({
      no: fields.length + 1,
      source: source || "database_latest_specialist_analysis",
      section: section,
      label: label,
      id: id || "",
      tagName: "",
      type: "",
      value: value === null || value === undefined ? "" : String(value),
      displayText: value === null || value === undefined ? "" : String(value),
      placeholder: "",
      masterType: "",
      masterLabel: ""
    });
  }

  function basicAnalysisResultOf(item, fetchedAnalysis) {
    var basicAnalysis = item && item.latestBasicAnalysis;
    return fetchedAnalysis || (basicAnalysis && basicAnalysis.sortResult) || null;
  }

  function addDbAnalysisFields(fields, item, draft, prefix) {
    var name = itemName(item);
    var id = itemId(item);
    var base = prefix || "DB正式基礎解析結果";

    if (!draft) {
      pushField(fields, base, "DB保存状態", "db_found", "DB正式基礎解析結果なし", "database_latest_specialist_analysis");
      return;
    }

    var sortResultObject = jsonObject(
      draft.sortResult || draft.sort_result
    );

    var visibleFieldsObject = jsonObject(
      draft.visibleFields || draft.visible_fields
    );

    var aiSummaryObject = jsonObject(
      draft.aiSummary || draft.ai_summary
    );

    pushField(fields, base, "OCR取込ID", "paymentDocumentOcrImportId", id || draft.paymentDocumentOcrImportId || "", "database_latest_specialist_analysis");
    pushField(fields, base, "ファイル名", "originalFileName", name, "database_latest_specialist_analysis");
    pushField(fields, base, "専門解析ID", "specialistAnalysisId", draft.specialistAnalysisId || draft.specialist_analysis_id || "", "database_latest_specialist_analysis");
    pushField(fields, base, "人間確認状態", "humanCheckStatus", draft.humanCheckStatus || draft.human_check_status || "", "database_latest_specialist_analysis");

    pushField(fields, base + " / AI仕分け", "書類区分", "documentTypeLabel", draft.documentTypeLabel || draft.document_type_label || masterName(masterRowForCode("document_types", draft.documentTypeCode || draft.document_type_code || sortResultObject.document_type_code || "")) || draft.documentTypeCode || draft.document_type_code || sortResultObject.document_type_code || "", "database_latest_specialist_analysis");
    pushField(fields, base + " / AI仕分け", "処理先", "paymentDestinationLabel", draft.paymentDestinationLabel || draft.payment_destination_label || "", "database_latest_specialist_analysis");
    pushField(fields, base + " / AI仕分け", "会計区分", "accountingCategoryLabel", draft.accountingCategoryLabel || draft.accounting_category_label || "", "database_latest_specialist_analysis");

    pushField(fields, base + " / 解析システム", "解析システムコード", "analysisSystemCode", draft.analysisSystemCode || draft.analysis_system_code || sortResultObject.analysis_system_code || visibleFieldsObject.analysis_system_code || aiSummaryObject.analysis_system_code || "", "database_latest_specialist_analysis");
    pushField(fields, base + " / 解析システム", "解析システム", "analysisSystemLabel", draft.analysisSystemLabel || draft.analysis_system_label || sortResultObject.analysis_system_label || visibleFieldsObject.analysis_system_label || aiSummaryObject.analysis_system_label || aiSummaryObject.analysis_system || "", "database_latest_specialist_analysis");
    pushField(fields, base + " / 解析システム", "解析システム信頼度", "analysisSystemConfidence", draft.analysisSystemConfidence || draft.analysis_system_confidence || sortResultObject.analysis_system_confidence || visibleFieldsObject.analysis_system_confidence || aiSummaryObject.analysis_system_confidence || "", "database_latest_specialist_analysis");
    pushField(fields, base + " / 解析システム", "解析システム判定理由", "analysisSystemReason", draft.analysisSystemReason || draft.analysis_system_reason || sortResultObject.analysis_system_reason || visibleFieldsObject.analysis_system_reason || aiSummaryObject.analysis_system_reason || "", "database_latest_specialist_analysis");

    pushField(fields, base + " / AI判断", "AI信頼度", "aiConfidenceLabel", draft.aiConfidenceLabel || draft.ai_confidence_label || draft.aiConfidence || draft.ai_confidence || "", "database_latest_specialist_analysis");
    pushField(fields, base + " / AI判断", "AI判定理由", "aiReason", draft.aiReason || draft.ai_reason || draft.reviewReason || draft.review_reason || aiSummaryObject.reason || sortResultObject.analysis_system_reason || visibleFieldsObject.analysis_system_reason || "", "database_latest_specialist_analysis");
    pushField(fields, base + " / AI判断", "要確認", "needsReview", draft.needsReview || draft.needs_review ? "true" : "false", "database_latest_specialist_analysis");

    pushField(fields, base + " / 保存JSON", "aiSummary", "aiSummary", jsonText(draft.aiSummary || draft.ai_summary || {}), "database_latest_specialist_analysis");
    pushField(fields, base + " / 保存JSON", "sortResult", "sortResult", jsonText(draft.sortResult || draft.sort_result || {}), "database_latest_specialist_analysis");
    pushField(fields, base + " / 保存JSON", "visibleFields", "visibleFields", jsonText(draft.visibleFields || draft.visible_fields || {}), "database_latest_specialist_analysis");
    pushField(fields, base + " / 保存JSON", "warnings", "warnings", jsonText(draft.warnings || []), "database_latest_specialist_analysis");

    pushField(fields, base, "作成日時", "createdAt", draft.createdAt || draft.created_at || "", "database_latest_specialist_analysis");
    pushField(fields, base, "更新日時", "updatedAt", draft.updatedAt || draft.updated_at || "", "database_latest_specialist_analysis");
  }

  async function postMemo(payload) {
    var res = await fetch("/api/payment-documents/review-visible-fields-memo", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload)
    });

    var text = await res.text();
    var data = {};

    try {
      data = JSON.parse(text || "{}");
    } catch (error) {
      throw new Error("API応答がJSONではありません: " + text.slice(0, 300));
    }

    if (!res.ok || !data.ok) {
      throw new Error(data.error || data.message || ("HTTP " + res.status));
    }

    return data;
  }

  async function exportVisibleWithDbLatest() {
    var button = document.getElementById("visibleFieldsMemoButton") || document.querySelector(".mini-memo-button");
    var oldText = button ? button.textContent : "";
    var item = getSelectedItemSafe();
    var id = getSelectedOcrImportIdSafe();

    if (button) {
      button.disabled = true;
      button.textContent = "DB表示中";
    }

    try {
      if (!id) {
        throw new Error("左リストから書類を選択してください。");
      }

      showResultLocal({
        ok: true,
        message: "表示中の項目とDB正式基礎解析結果をmemoへ出します。",
        selectedOcrImportId: id
      });

      var basicAnalysis = item && item.latestBasicAnalysis && typeof item.latestBasicAnalysis === "object" ? item.latestBasicAnalysis : {};
      var basicRawResult = basicAnalysis.rawResult && typeof basicAnalysis.rawResult === "object" ? basicAnalysis.rawResult : (basicAnalysis.raw_result && typeof basicAnalysis.raw_result === "object" ? basicAnalysis.raw_result : {});
      var dbAnalysis = basicRawResult.analysis && typeof basicRawResult.analysis === "object" ? basicRawResult.analysis : {};

      var screenFields = collectScreenVisibleFields();
      var fields = [];

      screenFields.forEach(function (field) {
        fields.push(field);
      });

      addDbAnalysisFields(fields, item, dbAnalysis, "DB正式基礎解析結果");

      var ocr = itemOcrText(item);

      var payload = {
        pageTitle: document.title || "",
        pagePath: location.pathname,
        displayMode: "visible_plus_db_latest",
        selectedIndex: getSelectedIndexSafe(),
        selectedOcrImportId: id,
        selectedItem: item ? {
          paymentDocumentOcrImportId: id,
          originalFileName: itemName(item),
          savedFileName: item.savedFileName || item.saved_file_name || item.fileName || "",
          mimeType: item.mimeType || item.mime_type || "",
          ocrStatus: item.ocrStatus || item.ocr_status || "",
          savedAt: item.savedAt || item.saved_at || "",
          updatedAt: item.updatedAt || item.updated_at || ""
        } : null,
        ocrRawText: ocr,
        ocrTextLength: ocr.length,
        dbLatestBasicAnalysisFound: !!dbAnalysis,
        screenVisibleFieldCount: screenFields.length,
        fields: fields
      };

      var data = await postMemo(payload);

      showResultLocal({
        ok: true,
        message: "表示中の項目 + DB正式基礎解析結果をmemoへ出しました。",
        count: data.count,
        memoPath: data.memoPath,
        openedNotepad: data.openedNotepad
      });
    } catch (error) {
      showResultLocal({
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

  async function exportAllWithDbLatest() {
    var button = document.getElementById("visibleAllFieldsMemoButton");
    var oldText = button ? button.textContent : "";

    if (button) {
      button.disabled = true;
      button.textContent = "DB全件表示中";
    }

    try {
      showResultLocal({
        ok: true,
        message: "一覧内の全件正式基礎解析結果をmemoへ出します。"
      });

      var data = await fetchJson("/api/payment-documents/review-items");
      var list = Array.isArray(data.items) ? data.items : [];

      if (!list.length) {
        throw new Error("全件表示するDB保存済みOCRがありません。");
      }

      var fields = [];
      var allOcrParts = [];
      var dbAnalysisCount = 0;
      var ocrCount = 0;

      list.forEach(function (item, index) {
        var no = index + 1;
        var id = itemId(item);
        var name = itemName(item) || ("ID " + id);
        var draft = basicAnalysisResultOf(item, null);
        var ocr = itemOcrText(item);

        if (draft) dbAnalysisCount++;
        if (ocr) ocrCount++;

        var section = "全件DB正式基礎解析結果 / " + no + " / " + name;

        addDbAnalysisFields(fields, item, draft, section);

        allOcrParts.push(
          "==============================\n" +
          no + " " + name + "\n" +
          "OCR取込ID: " + id + "\n" +
          "DB正式基礎解析結果: " + (draft ? "あり" : "なし") + "\n" +
          "==============================\n" +
          (ocr || "[OCR本文なし]")
        );
      });

      var allOcrText = allOcrParts.join("\n\n");

      var payload = {
        pageTitle: document.title || "",
        pagePath: location.pathname,
        displayMode: "all_db_latest",
        selectedIndex: -1,
        selectedOcrImportId: "ALL_DB_LATEST",
        selectedItem: {
          paymentDocumentOcrImportId: "ALL_DB_LATEST",
          originalFileName: "DB全件表示: " + list.length + "件",
          savedFileName: "",
          mimeType: "",
          ocrStatus: "全件",
          savedAt: "",
          updatedAt: ""
        },
        ocrRawText: allOcrText,
        ocrTextLength: allOcrText.length,
        allItemCount: list.length,
        allDbLatestBasicAnalysisCount: dbAnalysisCount,
        allOcrCount: ocrCount,
        fields: fields
      };

      var memo = await postMemo(payload);

      showResultLocal({
        ok: true,
        message: "DB全件正式基礎解析結果をmemoへ出しました。",
        itemCount: list.length,
        dbAnalysisCount: dbAnalysisCount,
        ocrCount: ocrCount,
        fieldCount: fields.length,
        memoPath: memo.memoPath,
        openedNotepad: memo.openedNotepad
      });
    } catch (error) {
      showResultLocal({
        ok: false,
        error: error.message || String(error)
      });
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = oldText || "全件表示";
      }
    }
  }

  function isVisibleButton(button) {
    if (!button) return false;
    if (button.id === "visibleFieldsMemoButton") return true;

    return String(button.textContent || "").trim() === "表示";
  }

  function isAllButton(button) {
    if (!button) return false;
    if (button.id === "visibleAllFieldsMemoButton") return true;

    return String(button.textContent || "").trim() === "全件表示";
  }

  document.addEventListener("click", function (event) {
    var button = event.target && event.target.closest
      ? event.target.closest("button, input[type='button'], input[type='submit'], a")
      : null;

    if (isVisibleButton(button)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      exportVisibleWithDbLatest();
      return;
    }

    if (isAllButton(button)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      exportAllWithDbLatest();
      return;
    }
  }, true);

  window.exportVisibleFieldsMemoVisibleOnlyWithDbLatest = exportVisibleWithDbLatest;
  window.exportAllItemsMemoWithDbLatest = exportAllWithDbLatest;
})();
