
/* HD_ORIGIN_PAYMENT_DOCUMENT_BULK_SPECIALIST_ANALYSIS_SAVE_UI_20260707_START */
(function () {
  "use strict";

  if (window.__hdOriginBulkSpecialistAnalysisSaveInstalled) {
    return;
  }

  window.__hdOriginBulkSpecialistAnalysisSaveInstalled = true;
  window.hdOriginSpecialistAnalysisBulkCache = window.hdOriginSpecialistAnalysisBulkCache || {};

  function textValue(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }

  function numberId(value) {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : 0;
  }

  function firstObject() {
    for (const item of arguments) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        return item;
      }
    }

    return {};
  }

  function aiSortIdFromUrl(url) {
    const path = String(url || "").split("?")[0];
    const match = path.match(/\/api\/payment-documents\/ai-sort\/([0-9]+)/);

    if (!match) return 0;

    return numberId(match[1]);
  }

  function cacheAiSortResult(id, json) {
    id = numberId(id);

    if (!id || !json || typeof json !== "object") {
      return;
    }

    window.hdOriginSpecialistAnalysisBulkCache[String(id)] = {
      paymentDocumentOcrImportId: id,
      result: json,
      cachedAt: new Date().toISOString()
    };
  }

  if (!window.__hdOriginBulkSpecialistAnalysisFetchPatched && window.fetch) {
    window.__hdOriginBulkSpecialistAnalysisFetchPatched = true;

    const originalFetch = window.fetch.bind(window);

    window.fetch = async function () {
      const requestUrl = arguments[0] && arguments[0].url ? arguments[0].url : arguments[0];
      const id = aiSortIdFromUrl(requestUrl);

      const response = await originalFetch.apply(null, arguments);

      if (id && response && response.clone) {
        response.clone().json().then(function (json) {
          cacheAiSortResult(id, json);
        }).catch(function () {});
      }

      return response;
    };
  }

  function getSelectedOcrIds() {
    const ids = [];

    function pushId(value) {
      const id = numberId(value);

      if (id && !ids.includes(id)) {
        ids.push(id);
      }
    }

    document.querySelectorAll("input[type='checkbox']:checked").forEach(function (el) {
      pushId(
        el.dataset.paymentDocumentOcrImportId ||
        el.dataset.ocrImportId ||
        el.dataset.id ||
        el.value
      );

      const row = el.closest("[data-payment-document-ocr-import-id], [data-ocr-import-id], [data-id], tr, li, .item, .card");

      if (row) {
        pushId(
          row.dataset.paymentDocumentOcrImportId ||
          row.dataset.ocrImportId ||
          row.dataset.id
        );
      }
    });

    document.querySelectorAll(".selected[data-payment-document-ocr-import-id], .active[data-payment-document-ocr-import-id], .selected[data-ocr-import-id], .active[data-ocr-import-id]").forEach(function (el) {
      pushId(el.dataset.paymentDocumentOcrImportId || el.dataset.ocrImportId || el.dataset.id);
    });

    return ids;
  }

  function getIdsFromCache() {
    return Object.keys(window.hdOriginSpecialistAnalysisBulkCache || {})
      .map(numberId)
      .filter(Boolean);
  }

  function buildPayloadFromCachedResult(id, cached) {
    const result = cached && cached.result ? cached.result : cached;
    const root = firstObject(result.sortResult, result.sort_result, result.sorting, result.classification, result.analysis, result.analysisResult, result);
    const draft = firstObject(result.analysis, result.analysisResult, result.sorting, result.classification, root.analysis, root.sorting, root.classification, root);
    const aiSummary = firstObject(result.ai_summary, result.aiSummary, draft.ai_summary, draft.aiSummary, root.ai_summary, root.aiSummary);

    return {
      paymentDocumentOcrImportId: id,

      document_type_code: textValue(draft.document_type_code || root.document_type_code || aiSummary.document_kind),
      document_type_label: textValue(draft.document_type_label || root.document_type_label || aiSummary.document_kind_label),

      payment_destination_code: textValue(draft.payment_destination_code || root.payment_destination_code || aiSummary.destination),
      payment_destination_label: textValue(draft.payment_destination_label || root.payment_destination_label || aiSummary.destination_label),

      accounting_category_code: textValue(draft.accounting_category_code || root.accounting_category_code),
      accounting_category_label: textValue(draft.accounting_category_label || root.accounting_category_label),

      payable_kind_code: textValue(draft.payable_kind_code || root.payable_kind_code),
      payable_kind_label: textValue(draft.payable_kind_label || root.payable_kind_label),

      specialist_route_code: textValue(draft.specialist_route_code || root.specialist_route_code || root.document_group),
      specialist_route_label: textValue(draft.specialist_route_label || root.specialist_route_label),

      payment_target_label: textValue(aiSummary.payment_target),
      payable_target_label: textValue(aiSummary.payable_target),
      expense_target_label: textValue(aiSummary.expense_target),
      tax_public_label: textValue(aiSummary.tax_public),
      public_utility_label: textValue(aiSummary.public_utility),
      contract_insurance_lease_label: textValue(aiSummary.contract_insurance_lease),

      ai_confidence: textValue(draft.ai_confidence || draft.confidence || root.confidence),
      ai_confidence_label: textValue(draft.ai_confidence_label || draft.confidence_label || root.confidence_label || aiSummary.confidence_label),
      ai_reason: textValue(draft.ai_reason || draft.reason || root.review_reason || aiSummary.reason),
      review_reason: textValue(draft.review_reason || root.review_reason || aiSummary.reason),
      needs_review: !!(draft.needs_review || root.needs_review),

      ai_summary: aiSummary,
      sortResult: root,
      visibleFields: firstObject(result.visibleFields, result.visible_fields, draft.fields, root.fields),
      warnings: Array.isArray(result.warnings) ? result.warnings : Array.isArray(draft.warnings) ? draft.warnings : [],

      display_rotation: 0,
      memo: "まとめて保存ボタンから仕分け下書き保存"
    };
  }

  async function postSpecialistAnalysis(payload) {
    payload.analysisSystemCode =
      payload.analysisSystemCode ||
      payload.analysis_system_code ||
      textValue((payload.sortResult || {}).analysis_system_code || (payload.sortResult || {}).analysisSystemCode);
    payload.analysis_system_code = payload.analysisSystemCode;
    payload.analysisSystemLabel =
      payload.analysisSystemLabel ||
      payload.analysis_system_label ||
      textValue((payload.sortResult || {}).analysis_system_label || (payload.sortResult || {}).analysisSystemLabel);
    payload.analysis_system_label = payload.analysisSystemLabel;
    payload.rawResult =
      payload.rawResult ||
      payload.raw_result ||
      payload.sortResult ||
      {};
    payload.raw_result = payload.rawResult;
    payload.warnings = Array.isArray(payload.warnings)
      ? payload.warnings
      : [];
    const res = await fetch("/api/payment-documents/specialist-analysis-results/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    const json = await res.json().catch(function () {
      return {};
    });

    if (!res.ok || !json.ok) {
      throw new Error(json.error || "下書き保存に失敗しました。");
    }

    return json;
  }

  async function bulkSaveSpecialistAnalysisResults() {
    let ids = getSelectedOcrIds();

    if (ids.length === 0) {
      ids = getIdsFromCache();
    }

    if (ids.length === 0) {
      throw new Error("まとめて保存する対象が見つかりません。先にまとめて専門解析を実行してください。");
    }

    const ok = [];
    const ng = [];

    for (const id of ids) {
      const cached = window.hdOriginSpecialistAnalysisBulkCache[String(id)];

      if (!cached) {
        ng.push({
          id,
          error: "AI仕分け結果キャッシュがありません。先にこの書類を仕分けしてください。"
        });
        continue;
      }

      try {
        const payload = buildPayloadFromCachedResult(id, cached);
        const saved = await postSpecialistAnalysis(payload);

        ok.push({
          id,
          specialistAnalysisId: saved.specialistAnalysisId || ""
        });
      } catch (err) {
        ng.push({
          id,
          error: err && err.message ? err.message : String(err)
        });
      }
    }

    return { ok, ng };
  }

  function ensureBulkSaveButton() {
    if (document.getElementById("bulkSaveSpecialistAnalysisResultButton")) {
      return document.getElementById("bulkSaveSpecialistAnalysisResultButton");
    }

    const buttons = Array.from(document.querySelectorAll("button, input[type='button'], input[type='submit'], a"));
    const sortButton = buttons.find(function (button) {
      const text = textValue(button.textContent || button.value || button.getAttribute("aria-label") || button.title);
      return text.includes("まとめて専門解析");
    });

    if (!sortButton || !sortButton.parentNode) {
      return null;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.id = "bulkSaveSpecialistAnalysisResultButton";
    button.className = "btn btn-primary hd-origin-bulk-save-specialist-analysis";
    button.textContent = "まとめて保存";

    sortButton.insertAdjacentElement("afterend", button);

    return button;
  }

  document.addEventListener("click", async function (event) {
    const button = event.target.closest("#bulkSaveSpecialistAnalysisResultButton");

    if (!button) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (button.dataset.saving === "1") {
      return;
    }

    const originalText = button.textContent;

    try {
      button.dataset.saving = "1";
      button.textContent = "まとめて保存中...";

      const result = await bulkSaveSpecialistAnalysisResults();

      button.textContent = "まとめて保存";

      alert(
        "まとめて保存が完了しました。\n" +
        "成功: " + result.ok.length + "件\n" +
        "失敗: " + result.ng.length + "件"
      );

      if (result.ng.length > 0) {
        console.warn("HD Origin bulk save draft errors:", result.ng);
      }
    } catch (err) {
      button.textContent = originalText || "まとめて保存";

      alert("まとめて保存に失敗しました。\n" + (err && err.message ? err.message : String(err)));
    } finally {
      button.dataset.saving = "0";
    }
  }, true);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureBulkSaveButton);
  } else {
    ensureBulkSaveButton();
  }

  window.hdOriginBulkSaveSpecialistAnalysiss = bulkSaveSpecialistAnalysisResults;
})();
/* HD_ORIGIN_PAYMENT_DOCUMENT_BULK_SPECIALIST_ANALYSIS_SAVE_UI_20260707_END */
