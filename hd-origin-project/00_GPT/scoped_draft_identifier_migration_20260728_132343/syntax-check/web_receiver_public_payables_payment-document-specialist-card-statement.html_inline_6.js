
/* HD_ORIGIN_PAYMENT_DOCUMENT_SPECIALIST_ANALYSIS_SAVE_UI_20260707_START */
(function () {
  "use strict";

  if (window.__hdOriginSpecialistAnalysisSaveUiInstalled) {
    return;
  }

  window.__hdOriginSpecialistAnalysisSaveUiInstalled = true;

  function textValue(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function controlValue(id) {
    const el = byId(id);
    if (!el) return "";

    if (el.tagName === "SELECT") {
      return textValue(el.value);
    }

    return textValue(el.value || el.textContent);
  }

  function controlLabel(id) {
    const el = byId(id);
    if (!el) return "";

    if (el.tagName === "SELECT") {
      const opt = el.selectedOptions && el.selectedOptions[0];

      if (opt) {
        return textValue(opt.textContent);
      }

      return "";
    }

    return textValue(el.value || el.textContent);
  }

  function selectedOptionCode(id, fallbackLabel) {
    const el = byId(id);

    if (el && el.tagName === "SELECT") {
      const opt = el.selectedOptions && el.selectedOptions[0];

      if (opt) {
        const dataCode =
          opt.dataset.code ||
          opt.dataset.internalCode ||
          opt.dataset.programCode ||
          opt.getAttribute("data-code") ||
          opt.getAttribute("data-internal-code") ||
          opt.getAttribute("data-program-code") ||
          "";

        if (textValue(dataCode)) return textValue(dataCode);

        const optionValue = textValue(opt.value);

        if (
          optionValue &&
          !/^[0-9]+$/.test(optionValue) &&
          optionValue !== "0"
        ) {
          return optionValue;
        }
      }
    }

    return codeFromLabel(fallbackLabel || controlLabel(id));
  }

  function codeFromLabel(label) {
    const s = textValue(label).replace(/[　\s・･／\/（）()]/g, "");

    const map = [
      ["公共料金通知書", "card_statement_analysis"],
      ["水道料金通知書", "card_statement_analysis"],
      ["電気料金", "card_statement_analysis"],
      ["ガス料金", "card_statement_analysis"],
      ["通信費", "card_statement_analysis"],

      ["その他証憑", "other"],
      ["要確認", "needs_review"],

      ["請求書", "invoice"],
      ["領収書", "receipt"],
      ["納付書", "tax_payment_notice"],
      ["納税通知書", "tax_payment_notice"],
      ["カード利用明細", "card_statement"],
      ["保険料通知書", "insurance_notice"],
      ["リース契約書", "lease_contract"],
      ["契約書", "contract"],
      ["メール保存", "mail_saved"],
      ["Web明細", "web_statement"],

      ["経費管理", "expense"],
      ["経費", "expense"],
      ["買掛管理", "accounts_payable"],
      ["買掛", "accounts_payable"],
      ["未払", "unpaid"],
      ["税金公的支払い", "tax_public"],
      ["税金公的支払", "tax_public"],
      ["カード未払", "card_payable"],

      ["公共料金", "public_utility"],
      ["保険", "insurance"],
      ["リース", "lease"],
      ["税金", "tax"],
      ["通常", "normal"]
    ];

    for (const pair of map) {
      if (s.includes(pair[0])) {
        return pair[1];
      }
    }

    return "";
  }

  function numericOrNull(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function findSelectedOcrImportId() {
    const directNames = [
      "selectedOcrImportId",
      "currentOcrImportId",
      "paymentDocumentOcrImportId"
    ];

    for (const name of directNames) {
      if (window[name]) {
        const n = Number(window[name]);
        if (Number.isInteger(n) && n > 0) return n;
      }
    }

    const currentObjects = [
      window.selectedOcrImport,
      window.currentOcrImport,
      window.selectedPaymentDocument,
      window.currentPaymentDocument
    ];

    for (const obj of currentObjects) {
      if (!obj || typeof obj !== "object") continue;

      const n = Number(
        obj.paymentDocumentOcrImportId ||
        obj.payment_document_ocr_import_id ||
        obj.selectedOcrImportId ||
        obj.id
      );

      if (Number.isInteger(n) && n > 0) return n;
    }

    const hiddenSelectors = [
      "#selectedOcrImportId",
      "#paymentDocumentOcrImportId",
      "input[name='selectedOcrImportId']",
      "input[name='paymentDocumentOcrImportId']",
      "input[name='payment_document_ocr_import_id']"
    ];

    for (const selector of hiddenSelectors) {
      const el = document.querySelector(selector);
      if (!el) continue;

      const n = Number(el.value || el.textContent || el.dataset.value);
      if (Number.isInteger(n) && n > 0) return n;
    }

    const activeSelectors = [
      "[data-selected-ocr-import-id]",
      "[data-payment-document-ocr-import-id].selected",
      "[data-payment-document-ocr-import-id].active",
      "[data-ocr-import-id].selected",
      "[data-ocr-import-id].active",
      ".selected[data-id]",
      ".active[data-id]"
    ];

    for (const selector of activeSelectors) {
      const el = document.querySelector(selector);
      if (!el) continue;

      const n = Number(
        el.dataset.selectedOcrImportId ||
        el.dataset.paymentDocumentOcrImportId ||
        el.dataset.ocrImportId ||
        el.dataset.id
      );

      if (Number.isInteger(n) && n > 0) return n;
    }

    const params = new URLSearchParams(location.search);
    const fromUrl = Number(
      params.get("ocr_import_id") ||
      params.get("ocrImportId") ||
      params.get("selectedOcrImportId") ||
      params.get("id")
    );

    if (Number.isInteger(fromUrl) && fromUrl > 0) {
      return fromUrl;
    }

    return 0;
  }

  function getDisplayRotation() {
    const candidates = [
      window.paymentDocumentDisplayRotation,
      window.currentDisplayRotation,
      window.imageRotation,
      window.previewRotation
    ];

    for (const value of candidates) {
      const n = Number(value);
      if ([0, 90, 180, 270].includes(n)) return n;
    }

    const el = document.querySelector("[data-display-rotation]");

    if (el) {
      const n = Number(el.dataset.displayRotation);
      if ([0, 90, 180, 270].includes(n)) return n;
    }

    return 0;
  }

  function collectSpecialistAnalysisPayload(context) {
    const ocrId =
      Number(
        context && (
          context.ocrImportId ||
          context.paymentDocumentOcrImportId ||
          context.payment_document_ocr_import_id ||
          context.id
        )
      ) ||
      Number(window.__hdOriginSpecialistActiveOcrImportId || 0) ||
      findSelectedOcrImportId();

    if (!ocrId) {
      throw new Error("選択中OCR IDが取得できません。");
    }

    const documentTypeLabel = controlLabel("analysisAiDocumentKind");
    const destinationLabel = controlLabel("analysisAiDestination");
    const accountingCategoryLabel = controlLabel("analysisAccountingCategory");

    const payload = {
      paymentDocumentOcrImportId: ocrId,

      document_type_id: numericOrNull(controlValue("analysisAiDocumentKind")),
      document_type_code: selectedOptionCode("analysisAiDocumentKind", documentTypeLabel),
      document_type_label: documentTypeLabel,

      payment_destination_id: numericOrNull(controlValue("analysisAiDestination") || controlValue("analysisDestination")),
      payment_destination_code: selectedOptionCode("analysisAiDestination", destinationLabel) || selectedOptionCode("analysisDestination", controlLabel("analysisDestination")),
      payment_destination_label: destinationLabel || controlLabel("analysisDestination"),

      accounting_category_id: numericOrNull(controlValue("analysisAccountingCategory")),
      accounting_category_code: selectedOptionCode("analysisAccountingCategory", accountingCategoryLabel),
      accounting_category_label: accountingCategoryLabel,

      payment_target_label: controlValue("analysisAiPayableFlag"),
      payable_target_label: controlValue("analysisAiUnpaidFlag"),
      expense_target_label: controlValue("analysisAiExpenseFlag"),
      tax_public_label: controlValue("analysisAiTaxPublicFlag"),
      public_utility_label: controlValue("analysisAiPublicUtilityFlag"),
      contract_insurance_lease_label: controlValue("analysisAiContractFlag"),

      ai_confidence_label: controlValue("analysisAiConfidence"),
      ai_reason: controlValue("analysisAiReason"),
      review_reason: controlValue("analysisAiReason"),

      needs_review:
        controlLabel("analysisAiDestination").includes("要確認") ||
        controlLabel("analysisAccountingCategory").includes("要確認") ||
        controlValue("analysisAiConfidence").includes("低"),

      display_rotation: getDisplayRotation(),

      memo: "payment-document-review 画面から下書き保存",

      ai_summary: {
        document_kind: selectedOptionCode("analysisAiDocumentKind", documentTypeLabel),
        document_kind_label: documentTypeLabel,
        destination: selectedOptionCode("analysisAiDestination", destinationLabel),
        destination_label: destinationLabel,
        payment_target: controlValue("analysisAiPayableFlag"),
        payable_target: controlValue("analysisAiUnpaidFlag"),
        expense_target: controlValue("analysisAiExpenseFlag"),
        tax_public: controlValue("analysisAiTaxPublicFlag"),
        public_utility: controlValue("analysisAiPublicUtilityFlag"),
        contract_insurance_lease: controlValue("analysisAiContractFlag"),
        confidence_label: controlValue("analysisAiConfidence"),
        reason: controlValue("analysisAiReason")
      },

      visibleFields: {
        document_type: {
          id: "analysisAiDocumentKind",
          value: controlValue("analysisAiDocumentKind"),
          label: documentTypeLabel
        },
        destination: {
          id: "analysisAiDestination",
          value: controlValue("analysisAiDestination"),
          label: destinationLabel
        },
        accounting_category: {
          id: "analysisAccountingCategory",
          value: controlValue("analysisAccountingCategory"),
          label: accountingCategoryLabel
        },
        payment_target: controlValue("analysisAiPayableFlag"),
        payable_target: controlValue("analysisAiUnpaidFlag"),
        expense_target: controlValue("analysisAiExpenseFlag"),
        tax_public: controlValue("analysisAiTaxPublicFlag"),
        public_utility: controlValue("analysisAiPublicUtilityFlag"),
        contract_insurance_lease: controlValue("analysisAiContractFlag"),
        confidence: controlValue("analysisAiConfidence"),
        reason: controlValue("analysisAiReason")
      },

      sortResult: {
        document_type_code: selectedOptionCode("analysisAiDocumentKind", documentTypeLabel),
        document_type_label: documentTypeLabel,
        payment_destination_code: selectedOptionCode("analysisAiDestination", destinationLabel),
        payment_destination_label: destinationLabel,
        accounting_category_code: selectedOptionCode("analysisAccountingCategory", accountingCategoryLabel),
        accounting_category_label: accountingCategoryLabel,
        needs_review:
          controlLabel("analysisAiDestination").includes("要確認") ||
          controlLabel("analysisAccountingCategory").includes("要確認") ||
          controlValue("analysisAiConfidence").includes("低")
      }
    };

    return payload;
  }

  async function saveSpecialistAnalysisResultFromReviewPage(context) {
    const payload = collectSpecialistAnalysisPayload(context);

    const analysisResult =
      context && context.analysisResult && typeof context.analysisResult === "object"
        ? context.analysisResult
        : context && context.item && context.item.__aiRawResult
          ? context.item.__aiRawResult
          : {};

    const analysisAnalysis =
      analysisResult.analysis && typeof analysisResult.analysis === "object"
        ? analysisResult.analysis
        : context && context.item && context.item.__analysisResult
          ? context.item.__analysisResult
          : {};

    const analysisRoot =
      analysisResult.sortResult ||
      analysisResult.sort_result ||
      analysisResult.result ||
      analysisAnalysis.sortResult ||
      analysisAnalysis.sort_result ||
      analysisAnalysis;

    const analysisSummary =
      analysisResult.ai_summary ||
      analysisResult.aiSummary ||
      analysisAnalysis.ai_summary ||
      analysisAnalysis.aiSummary ||
      analysisRoot.ai_summary ||
      analysisRoot.aiSummary ||
      {};

    payload.analysis_system_code =
      payload.analysis_system_code ||
      payload.analysisSystemCode ||
      analysisResult.analysis_system_code ||
      analysisResult.analysisSystemCode ||
      analysisAnalysis.analysis_system_code ||
      analysisAnalysis.analysisSystemCode ||
      analysisRoot.analysis_system_code ||
      analysisRoot.analysisSystemCode ||
      analysisSummary.analysis_system_code ||
      window.__hdOriginSpecialistActiveAnalysisSystemCode ||
      "";

    if (payload.analysis_system_code) {
      window.__hdOriginSpecialistActiveAnalysisSystemCode =
        payload.analysis_system_code;
    }
    payload.analysis_system_label =
      payload.analysis_system_label ||
      payload.analysisSystemLabel ||
      analysisAnalysis.analysis_system_label ||
      analysisAnalysis.analysisSystemLabel ||
      analysisRoot.analysis_system_label ||
      analysisRoot.analysisSystemLabel ||
      analysisSummary.analysis_system_label ||
      analysisSummary.analysis_system ||
      "";

    payload.analysis_system_reason =
      payload.analysis_system_reason ||
      payload.analysisSystemReason ||
      analysisAnalysis.analysis_system_reason ||
      analysisAnalysis.analysisSystemReason ||
      analysisRoot.analysis_system_reason ||
      analysisRoot.analysisSystemReason ||
      analysisSummary.analysis_system_reason ||
      "";

    payload.analysis_system_confidence =
      payload.analysis_system_confidence ||
      payload.analysisSystemConfidence ||
      analysisAnalysis.analysis_system_confidence ||
      analysisAnalysis.analysisSystemConfidence ||
      analysisRoot.analysis_system_confidence ||
      analysisRoot.analysisSystemConfidence ||
      analysisSummary.analysis_system_confidence ||
      "";

    payload.specialist_route_code =
      payload.specialist_route_code ||
      payload.specialistRouteCode ||
      analysisAnalysis.specialist_route_code ||
      analysisRoot.specialist_route_code ||
      analysisResult.document_group ||
      analysisAnalysis.document_group ||
      "";

    payload.specialist_route_label =
      payload.specialist_route_label ||
      payload.specialistRouteLabel ||
      analysisAnalysis.specialist_route_label ||
      analysisRoot.specialist_route_label ||
      "";

    const specialistRawResult = Object.assign(
      {},
      analysisResult,
      {
        analysis: Object.assign(
          {},
          analysisAnalysis,
          payload.sortResult || {},
          {
            fields: Object.assign(
              {},
              analysisAnalysis.fields || {},
              payload.fields || payload.specialistFields || payload.visibleFields || {}
            )
          }
        )
      }
    );
    payload.analysisSystemCode =
      payload.analysis_system_code || payload.analysisSystemCode || "";
    payload.analysisSystemLabel =
      payload.analysis_system_label || payload.analysisSystemLabel || "";
    payload.rawResult = specialistRawResult;
    payload.raw_result = specialistRawResult;
    payload.warnings = Array.isArray(payload.warnings)
      ? payload.warnings
      : Array.isArray(analysisResult.warnings)
        ? analysisResult.warnings
        : Array.isArray(analysisAnalysis.warnings)
          ? analysisAnalysis.warnings
          : Array.isArray(analysisRoot.warnings)
            ? analysisRoot.warnings
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

  function looksLikeAnalysisSaveButton(el) {
    if (!el) return false;

    const button = el.closest("button, input[type='button'], input[type='submit'], a");

    if (!button) return false;

    const text = textValue(button.textContent || button.value || button.getAttribute("aria-label") || button.title);

    if (!text) return false;

    return text.includes("下書き保存") || text.includes("下書き");
  }

  document.addEventListener("click", async function (event) {
    const button = event.target.closest("button, input[type='button'], input[type='submit'], a");

    if (!looksLikeAnalysisSaveButton(button)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (button.dataset.hdOriginSpecialistAnalysisSaving === "1") {
      return;
    }

    button.dataset.hdOriginSpecialistAnalysisSaving = "1";

    const originalText = button.textContent;

    try {
      if (button.tagName === "BUTTON" || button.tagName === "A") {
        button.textContent = "下書き保存中...";
      }

      const result = await saveSpecialistAnalysisResultFromReviewPage();

      if (button.tagName === "BUTTON" || button.tagName === "A") {
        button.textContent = "下書き保存済み";
      }

      console.log("HD Origin specialist analysis saved:", result);

      alert("仕分け下書きを保存しました。\n下書きID: " + (result.specialistAnalysisId || ""));
    } catch (err) {
      console.error("HD Origin specialist analysis save failed:", err);

      if (button.tagName === "BUTTON" || button.tagName === "A") {
        button.textContent = originalText || "下書き保存";
      }

      alert("下書き保存に失敗しました。\n" + (err && err.message ? err.message : String(err)));
    } finally {
      setTimeout(function () {
        button.dataset.hdOriginSpecialistAnalysisSaving = "0";

        if ((button.textContent || "").includes("保存中")) {
          button.textContent = originalText || "下書き保存";
        }
      }, 800);
    }
  }, true);

  window.hdOriginSaveSpecialistAnalysisFromReviewPage = saveSpecialistAnalysisResultFromReviewPage;
})();
/* HD_ORIGIN_PAYMENT_DOCUMENT_SPECIALIST_ANALYSIS_SAVE_UI_20260707_END */
