
(function () {
  "use strict";

  if (window.__hdOriginReviewAllItemsMemoInstalled) return;
  window.__hdOriginReviewAllItemsMemoInstalled = true;

  function getItemsForAllMemo() {
    try {
      if (Array.isArray(window.items)) return window.items;
      if (typeof items !== "undefined" && Array.isArray(items)) return items;
    } catch (error) {
      return [];
    }
    return [];
  }

  function textOf(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      return String(value);
    }
  }

  function fileNameOf(item, index) {
    if (!item) return "No." + (index + 1);

    return item.originalFileName ||
      item.original_file_name ||
      item.savedFileName ||
      item.saved_file_name ||
      item.fileName ||
      item.file_name ||
      ("No." + (index + 1));
  }

  function ocrIdOf(item) {
    if (!item) return "";

    try {
      if (typeof window.ocrImportIdOf === "function") {
        return window.ocrImportIdOf(item) || "";
      }
    } catch (error) {}

    return item.paymentDocumentOcrImportId ||
      item.payment_document_ocr_import_id ||
      item.ocrImportId ||
      item.ocr_import_id ||
      item.id ||
      "";
  }

  function ocrTextOf(item) {
    if (!item) return "";

    return String(
      item.ocrRawText ||
      item.ocr_raw_text ||
      item.ocrText ||
      item.ocr_text ||
      item.rawText ||
      item.raw_text ||
      ""
    );
  }

  function analysisResultOf(item) {
    if (!item) return {};

    var basicAnalysis = item.latestBasicAnalysis || item.latest_basic_analysis || {};
    var basicRawResult = basicAnalysis.rawResult || basicAnalysis.raw_result || {};

    return item.analysisResult ||
      item.analysis_result ||
      basicRawResult.analysis ||
      item.analysis ||
      {};
  }

  function aiRawOf(item) {
    if (!item) return {};

    return item.__aiRawResult ||
      item.aiRawResult ||
      item.ai_raw_result ||
      item.sortResult ||
      item.sort_result ||
      item.sorting ||
      {};
  }

  function aiStepsOf(item) {
    if (!item) return [];

    return item.__aiSteps ||
      item.aiSteps ||
      item.ai_steps ||
      [];
  }

  function visibleLabelsOf(item) {
    return ["会計区分", "専門解析先", "発行日", "信頼度", "理由"];
  }

  function pushField(fields, section, label, id, value) {
    fields.push({
      no: fields.length + 1,
      section: section,
      label: label,
      id: id || "",
      value: textOf(value),
      displayText: "",
      masterType: "",
      placeholder: ""
    });
  }

  function pushAiSummary(fields, section, draft, raw) {
    var summary = draft.ai_summary || raw.ai_summary || raw.summary || {};

    pushField(fields, section, "書類区分", "document_type", draft.document_type_label || draft.document_type_code || raw.document_type_label || raw.document_type_code || "");
    pushField(fields, section, "処理先", "payment_destination", draft.payment_destination_label || draft.payment_destination_code || raw.payment_destination_label || raw.payment_destination_code || "");
    pushField(fields, section, "専門ルート", "specialist_route", draft.specialist_route_label || draft.specialist_route_code || raw.specialist_route_label || raw.specialist_route_code || raw.document_group || "");
    pushField(fields, section, "会計候補", "accounting_category", draft.accounting_category_label || draft.accounting_category_code || raw.accounting_category_label || raw.accounting_category_code || "");
    pushField(fields, section, "未払種別", "payable_kind", draft.payable_kind_label || draft.payable_kind_code || raw.payable_kind_label || raw.payable_kind_code || "");
    pushField(fields, section, "支払対象", "payment_target", draft.payment_target_label || summary.payment_target || "");
    pushField(fields, section, "未払登録対象", "payable_target", draft.payable_target_label || summary.payable_target || "");
    pushField(fields, section, "経費登録対象", "expense_target", draft.expense_target_label || summary.expense_target || "");
    pushField(fields, section, "税金・公的支払", "tax_public", draft.tax_public_label || summary.tax_public || "");
    pushField(fields, section, "公共料金・通信費", "public_utility", draft.public_utility_label || summary.public_utility || "");
    pushField(fields, section, "契約・保険・リース", "contract_insurance_lease", draft.contract_insurance_lease_label || summary.contract_insurance_lease || "");
    pushField(fields, section, "AI信頼度", "confidence", draft.confidence_label || draft.ai_confidence_label || draft.ai_confidence || draft.confidence || raw.confidence_label || raw.confidence || "");
    pushField(fields, section, "要確認", "needs_review", draft.needs_review === true ? "あり" : (draft.needs_review === false ? "なし" : ""));
    pushField(fields, section, "AI判定理由", "review_reason", draft.review_reason || draft.ai_reason || draft.reason || raw.review_reason || raw.ai_reason || raw.reason || "");
  }

  function pushObject(fields, section, obj) {
    obj = obj && typeof obj === "object" ? obj : {};

    var keys = Object.keys(obj);

    if (!keys.length) {
      pushField(fields, section, "内容", "", "[なし]");
      return;
    }

    keys.forEach(function (key) {
      pushField(fields, section, key, key, obj[key]);
    });
  }

  function buildPayload() {
    var list = getItemsForAllMemo();
    var fields = [];
    var allOcrParts = [];
    var analyzedCount = 0;
    var ocrCount = 0;

    list.forEach(function (item, index) {
      var no = String(index + 1).padStart(3, "0");
      var name = fileNameOf(item, index);
      var id = ocrIdOf(item);
      var ocr = ocrTextOf(item);
      var draft = analysisResultOf(item);
      var raw = aiRawOf(item);
      var steps = aiStepsOf(item);
      var labels = visibleLabelsOf(item);

      var hasAi =
        !!(draft && typeof draft === "object" && Object.keys(draft).length) ||
        !!(raw && typeof raw === "object" && Object.keys(raw).length);

      if (hasAi) analyzedCount++;
      if (ocr.trim()) ocrCount++;

      var baseSection = no + " " + name + " / 基本";
      var aiSection = no + " " + name + " / 現在のAI解析結果";
      var rawSection = no + " " + name + " / AI生データ";
      var ocrSection = no + " " + name + " / OCR本文";

      pushField(fields, baseSection, "No", "no", index + 1);
      pushField(fields, baseSection, "OCR取込ID", "payment_document_ocr_import_id", id);
      pushField(fields, baseSection, "ファイル名", "original_file_name", name);
      pushField(fields, baseSection, "AI解析状態", "ai_status", hasAi ? "解析結果あり" : "未解析または画面上にAI結果なし");

      pushAiSummary(fields, aiSection, draft, raw);

      pushField(fields, rawSection, "表示対象ラベル", "visible_field_labels", labels.length ? labels.join(", ") : "");
      pushField(fields, rawSection, "AIステップ", "ai_steps", steps.length ? JSON.stringify(steps, null, 2) : "");
      pushObject(fields, rawSection + " / draft", draft);
      pushObject(fields, rawSection + " / rawResult", raw);

      pushField(fields, ocrSection, "OCR本文", "ocr_raw_text", ocr || "[OCR本文なし]");

      allOcrParts.push(
        "==============================\n" +
        no + " " + name + "\n" +
        "OCR取込ID: " + id + "\n" +
        "AI解析状態: " + (hasAi ? "解析結果あり" : "未解析または画面上にAI結果なし") + "\n" +
        "==============================\n" +
        (ocr || "[OCR本文なし]")
      );
    });

    return {
      pageTitle: document.title || "",
      pagePath: location.pathname,
      selectedIndex: -1,
      selectedOcrImportId: "ALL",
      selectedItem: {
        paymentDocumentOcrImportId: "ALL",
        originalFileName: "全件表示: " + list.length + "件",
        savedFileName: "",
        mimeType: "",
        ocrStatus: "全件",
        savedAt: "",
        updatedAt: ""
      },
      ocrRawText: allOcrParts.join("\n\n"),
      ocrTextLength: allOcrParts.join("\n\n").length,
      aiAppliedCount: analyzedCount,
      sortingAppliedCount: analyzedCount,
      aiMissingControls: [],
      fields: fields,
      allItemCount: list.length,
      allAnalyzedCount: analyzedCount,
      allOcrCount: ocrCount
    };
  }

  function showResult(value) {
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

  async function exportAllItemsMemo() {
    var button = document.getElementById("visibleAllFieldsMemoButton");
    var oldText = button ? button.textContent : "";

    if (button) {
      button.disabled = true;
      button.textContent = "全件出力中";
    }

    try {
      var list = getItemsForAllMemo();

      if (!list.length) {
        showResult({ ok: false, error: "全件表示する書類がありません。先に一覧を更新してください。" });
        return;
      }

      var payload = buildPayload();

      var res = await fetch("/api/payment-documents/review-visible-fields-memo", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
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

      showResult({
        ok: true,
        message: "全件の現在AI解析結果とOCR本文をmemoへ出しました。",
        itemCount: payload.allItemCount,
        analyzedCount: payload.allAnalyzedCount,
        ocrCount: payload.allOcrCount,
        fieldCount: payload.fields.length,
        memoPath: data.memoPath,
        openedNotepad: data.openedNotepad
      });
    } catch (error) {
      showResult({ ok: false, error: error.message || String(error) });
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = oldText || "全件表示";
      }
    }
  }

  function installButton() {
    var existing = document.getElementById("visibleAllFieldsMemoButton");

    if (existing) {
      existing.onclick = function (event) {
        event.preventDefault();
        exportAllItemsMemo();
      };
      return true;
    }

    var baseButton =
      document.getElementById("visibleFieldsMemoButton") ||
      document.querySelector("[data-visible-fields-memo-button]") ||
      Array.prototype.find.call(document.querySelectorAll("button"), function (button) {
        return String(button.textContent || "").trim() === "表示";
      });

    if (!baseButton || !baseButton.parentNode) {
      return false;
    }

    var button = document.createElement("button");
    button.type = "button";
    button.id = "visibleAllFieldsMemoButton";
    button.className = baseButton.className || "";
    button.textContent = "全件表示";
    button.title = "画面上の全件について、現在のAI解析結果とOCR本文をmemoへ出します。AI再解析はしません。";

    button.addEventListener("click", function (event) {
      event.preventDefault();
      exportAllItemsMemo();
    });

    baseButton.insertAdjacentElement("afterend", button);
    return true;
  }

  function installWithRetry() {
    if (installButton()) return;

    var retry = 0;
    var timer = setInterval(function () {
      retry++;
      if (installButton() || retry >= 20) {
        clearInterval(timer);
      }
    }, 300);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installWithRetry);
  } else {
    installWithRetry();
  }

  window.exportAllItemsMemo = exportAllItemsMemo;
})();
