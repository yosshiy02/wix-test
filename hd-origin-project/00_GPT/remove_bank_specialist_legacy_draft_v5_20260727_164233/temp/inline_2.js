
  let items = [];
  let selectedIndex = -1;
  let checkedOcrImportIds = new Set();

  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatJapanDateTime(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    const parts = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).formatToParts(date).reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
  }

  function showResult(message) {
    const result = document.getElementById("result");
    if (!result) return;

    if (message && typeof message === "object") {
      result.textContent = JSON.stringify(message, null, 2);
      return;
    }

    result.textContent = message || "";
  }

  function hasOcr(item) {
    return !!(item.ocrRawText || item.ocrTextPreview || item.ocrStatus === "ocr_done");
  }

/* PAYMENT_DOCUMENT_REVIEW_IMAGE_PREVIEW_20260707_START */
  function documentPreviewUrl(item) {
    if (!item) return "";

    if (item.imageUrl) {
      return item.imageUrl;
    }

    const id = item.paymentDocumentOcrImportId || item.payment_document_ocr_import_id || "";

    if (id) {
      return "/api/payment-documents/ocr-imports/file/" + encodeURIComponent(String(id));
    }

    const fileName = item.savedFileName || item.fileName || "";

    if (fileName) {
      return "/api/payment-documents/scan-inbox/file/" + encodeURIComponent(fileName);
    }

    return "";
  }

  function isPreviewImage(item, url) {
    const mime = String(item && item.mimeType || "").toLowerCase();

    if (mime.startsWith("image/")) {
      return true;
    }

    return /\.(png|jpg|jpeg|webp|gif)(\?|#|$)/i.test(String(url || ""));
  }

  function isPreviewPdf(item, url) {
    const mime = String(item && item.mimeType || "").toLowerCase();

    if (mime === "application/pdf") {
      return true;
    }

    return /\.pdf(\?|#|$)/i.test(String(url || ""));
  }

/* PAYMENT_DOCUMENT_REVIEW_PREVIEW_ROTATE_20260707_START */
  let documentPreviewRotation = 0;
/* PAYMENT_DOCUMENT_REVIEW_PREVIEW_REAL_FIT_20260707_START */
  function previewInnerSize() {
    const preview = document.getElementById("documentPreview");

    if (!preview) {
      return { width: 1, height: 1 };
    }

    const style = window.getComputedStyle(preview);
    const paddingX =
      parseFloat(style.paddingLeft || "0") +
      parseFloat(style.paddingRight || "0");
    const paddingY =
      parseFloat(style.paddingTop || "0") +
      parseFloat(style.paddingBottom || "0");

    return {
      width: Math.max(1, preview.clientWidth - paddingX),
      height: Math.max(1, preview.clientHeight - paddingY)
    };
  }

  function previewTargetNaturalSize(target) {
    if (!target) {
      return { width: 1, height: 1 };
    }

    if (target.tagName === "IMG") {
      return {
        width: Math.max(1, target.naturalWidth || target.width || 1),
        height: Math.max(1, target.naturalHeight || target.height || 1)
      };
    }

    return previewInnerSize();
  }

  function currentPreviewTarget() {
    const preview = document.getElementById("documentPreview");

    if (!preview) {
      return null;
    }

    return preview.querySelector(".document-preview-image, .document-preview-frame");
  }

  function applyDocumentPreviewRotation() {
    const target = currentPreviewTarget();

    if (!target) {
      scheduleDocumentPreviewFit();
      return;
    }

    const box = previewInnerSize();
    const natural = previewTargetNaturalSize(target);
    const rotation = ((documentPreviewRotation % 360) + 360) % 360;
    const sideways = rotation === 90 || rotation === 270;

    const logicalWidth = sideways ? natural.height : natural.width;
    const logicalHeight = sideways ? natural.width : natural.height;

    const scale = Math.min(
      box.width / logicalWidth,
      box.height / logicalHeight
    );

    const displayWidth = natural.width * scale;
    const displayHeight = natural.height * scale;
    const displayWidthPercent = box.width > 0 ? (displayWidth / box.width) * 100 : 100;
    const displayHeightPercent = box.height > 0 ? (displayHeight / box.height) * 100 : 100;

    target.style.width = Math.max(0, Math.min(100, displayWidthPercent)) + "%";
    target.style.height = Math.max(0, Math.min(100, displayHeightPercent)) + "%";
    target.style.maxWidth = "none";
    target.style.maxHeight = "none";
    target.style.transform = "rotate(" + rotation + "deg)";
    target.style.transformOrigin = "center center";
  }

  function scheduleDocumentPreviewFit() {
    window.setTimeout(() => {
      applyDocumentPreviewRotation();
    }, 0);

    window.setTimeout(() => {
      applyDocumentPreviewRotation();
    }, 80);
  }

  window.addEventListener("resize", () => {
    scheduleDocumentPreviewFit();
  });
/* PAYMENT_DOCUMENT_REVIEW_PREVIEW_REAL_FIT_20260707_END */

  function rotateDocumentPreview(degrees) {
    documentPreviewRotation = (documentPreviewRotation + Number(degrees || 0)) % 360;

    if (documentPreviewRotation < 0) {
      documentPreviewRotation += 360;
    }

    applyDocumentPreviewRotation();
  }

  function resetDocumentPreviewRotation(shouldApply = true) {
    documentPreviewRotation = 0;

    if (shouldApply) {
      applyDocumentPreviewRotation();
    }
  }
/* PAYMENT_DOCUMENT_REVIEW_PREVIEW_ROTATE_20260707_END */
function setDocumentPreview(item) {
    const preview = document.getElementById("documentPreview");

    if (!preview) {
      scheduleDocumentPreviewFit();
      return;
    }

    if (!item) {
      preview.innerHTML = '<div class="preview-empty">左からDB保存済みOCRを選択してください。</div>';
      scheduleDocumentPreviewFit();
      return;
    }

    const url = documentPreviewUrl(item);
    const name = item.originalFileName || item.savedFileName || item.fileName || "原本";

    if (!url) {
      preview.innerHTML =
        '<div class="preview-empty">原本ファイルの参照先がありません。</div>';
      scheduleDocumentPreviewFit();
      return;
    }

    if (isPreviewPdf(item, url)) {
      preview.innerHTML =
        '<iframe class="document-preview-frame" src="' + esc(url) + '" title="' + esc(name) + '"></iframe>';
      scheduleDocumentPreviewFit();
      return;
    }

    if (isPreviewImage(item, url)) {
      preview.innerHTML =
        '<img class="document-preview-image" onload="scheduleDocumentPreviewFit()" src="' + esc(url) + '" alt="' + esc(name) + '">';
      scheduleDocumentPreviewFit();
      return;
    }

    preview.innerHTML =
      '<div class="preview-empty">' +
      '<div>この形式は画面内プレビュー対象外です。</div>' +
      '<a href="' + esc(url) + '" target="_blank" rel="noopener">原本を開く</a>' +
      '</div>';
  }
/* PAYMENT_DOCUMENT_REVIEW_IMAGE_PREVIEW_20260707_END */
/* PAYMENT_DOCUMENT_OPENAI_OCR_DRAFT_CLIENT_20260707_START */
/* PAYMENT_DOCUMENT_SELECTED_ITEM_HELPER_20260707_START */
  function selectedItem() {
    if (!Array.isArray(items)) {
      return null;
    }

    const index = Number(selectedIndex);

    if (!Number.isInteger(index) || index < 0 || index >= items.length) {
      return null;
    }

    return items[index] || null;
  }
/* PAYMENT_DOCUMENT_SELECTED_ITEM_HELPER_20260707_END */
  function selectedOcrImportId() {
    if (!Array.isArray(items)) {
      return "";
    }

    const index = Number(selectedIndex);

    if (!Number.isInteger(index) || index < 0 || index >= items.length) {
      return "";
    }

    const item = items[index];

    if (!item) {
      return "";
    }

    return item.paymentDocumentOcrImportId || item.payment_document_ocr_import_id || "";
  }
  function setMasterSelectByCodeOrText(selector, value) {
    const select = document.querySelector(selector);

    if (!select) {
      return;
    }

    setDraftMasterSelectValue(select, value || "");
  }

  function setInputValue(selector, value) {
    const el = document.querySelector(selector);

    if (!el) {
      return;
    }

    el.value = value === null || value === undefined ? "" : String(value);
  }

  function applyAiDraftToForm(draft) {
    if (!draft) {
      return;
    }

    setMasterSelectByCodeOrText('[data-master-type="document_types"]', draft.document_type_code);
    setMasterSelectByCodeOrText('[data-master-type="payment_destinations"]', draft.payment_destination_code);
    setMasterSelectByCodeOrText('[data-master-type="accounting_categories"]', draft.accounting_category_code);
    setMasterSelectByCodeOrText('[data-master-type="payable_kinds"]', draft.payable_kind_code);
    setMasterSelectByCodeOrText('[data-master-type="payment_source_types"]', draft.source_type_code);

    setInputValue('[name="vendor_name"], #vendorName', draft.vendor_name);
    setInputValue('[name="issue_date"], #issueDate', draft.issue_date);
    setInputValue('[name="due_date"], #dueDate', draft.due_date);
    setInputValue('[name="invoice_number"], #invoiceNumber', draft.invoice_number);
    setInputValue('[name="total_amount"], #totalAmount', draft.total_amount);
    setInputValue('[name="tax_amount"], #taxAmount', draft.tax_amount);
    setInputValue('[name="summary"], #summary', draft.summary);
    setInputValue('[name="memo"], #memo', draft.memo);
  }

/* PAYMENT_DOCUMENT_AI_APPLY_BY_ID_20260707_START */
  function aiDraftField(draft, label) {
    if (!draft || !draft.fields || typeof draft.fields !== "object") {
      return "";
    }

    return draft.fields[label] || "";
  }

    function setById(id, value) {
    const el = document.getElementById(id);

    if (!el) {
      return false;
    }

    const text = value === null || value === undefined ? "" : String(value);

    if (!text) {
      return false;
    }

    if (el.tagName === "SELECT") {
      setAiSelectByMaster(el, id, text);
    } else {
      el.value = text;
    }

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));

    return true;
  }

    function setByIdAllowEmpty(id, value) {
    const el = document.getElementById(id);

    if (!el) {
      return false;
    }

    const text = value === null || value === undefined ? "" : String(value);

    if (el.tagName === "SELECT") {
      setAiSelectByMaster(el, id, text);
    } else {
      el.value = text;
    }

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));

    return true;
  }

  function labelTextOnly(label) {
    const clone = label.cloneNode(true);

    clone.querySelectorAll("input, select, textarea, option, button").forEach(node => node.remove());

    return normalizeLabelText(clone.textContent);
  }

  function findControlByLabelText(labelText) {
    const wanted = normalizeLabelText(labelText);

    if (!wanted) {
      return null;
    }

    const labels = Array.from(document.querySelectorAll("label"));

    for (const label of labels) {
      const text = labelTextOnly(label);

      if (!text) {
        continue;
      }

      if (text !== wanted && !text.startsWith(wanted) && !wanted.startsWith(text)) {
        continue;
      }

      if (label.htmlFor) {
        const byFor = document.getElementById(label.htmlFor);

        if (byFor) {
          return byFor;
        }
      }

      const control = label.querySelector("input, select, textarea");

      if (control) {
        return control;
      }
    }

    return null;
  }

  function setFieldByLabel(labelText, value) {
    if (value === null || value === undefined || value === "") {
      return false;
    }

    const control = findControlByLabelText(labelText);

    return setControlValue(control, value);
  }

  function applyAiDraftToForm(draft) {
    if (!draft) {
      return;
    }

    const fields = draft.fields || {};
    let appliedCount = 0;

    // マスタselect。コード優先。
    if (setById("draftPaymentDestination", draft.payment_destination_code || fields["処理先"])) appliedCount++;
    if (setById("draftAccountingCategory", draft.accounting_category_code || fields["会計区分"])) appliedCount++;
    if (setById("draftPayableKind", draft.payable_kind_code || fields["未払種別"])) appliedCount++;
    if (setById("draftPaymentSourceType", draft.source_type_code || fields["入手元区分"])) appliedCount++;

    // 要確認 解析サマリー
    if (draft.ai_summary) {
      if (setById("draftAiDocumentKind", draft.document_type_code || (draft.ai_summary && draft.ai_summary.document_kind) || fields["書類区分"] || fields["書類種別"])) appliedCount++;
      if (setById("draftAiDestination", draft.ai_summary.destination || fields["処理先"])) appliedCount++;
      if (setById("draftAiPaymentTarget", draft.ai_summary.payment_target || (fields.payment_target || fields["支払対象"]))) appliedCount++;
      if (setById("draftAiPayableTarget", draft.ai_summary.payable_target || (fields.payable_target || fields["未払登録対象"]))) appliedCount++;
      if (setById("draftAiExpenseTarget", draft.ai_summary.expense_target || (fields.expense_target || fields["経費登録対象"]))) appliedCount++;
      if (setById("draftAiTaxPublic", draft.ai_summary.tax_public || fields["税金・公的支払"])) appliedCount++;
      if (setById("draftAiContractInsuranceLease", draft.ai_summary.contract_insurance_lease || fields["契約・保険・リース"])) appliedCount++;
      if (setById("draftAiConfidence", draft.ai_summary.confidence_label || fields["AI信頼度"])) appliedCount++;
      if (setById("draftAiReason", draft.ai_summary.reason || fields["AI判定理由"])) appliedCount++;
    }

    // 基本情報
    if (setById("draftDocumentName", fields["書類名"] || draft.summary)) appliedCount++;
    if (setById("draftIssuer", fields["発行元"] || draft.vendor_name)) appliedCount++;
    if (setById("draftVendorName", fields["支払先"] || draft.vendor_name)) appliedCount++;
    if (setById("draftRecipient", fields["宛名"])) appliedCount++;
    if (setById("draftCompanyName", fields["会社名"])) appliedCount++;
    if (setById("draftPersonalName", fields["個人名"])) appliedCount++;
    if (setById("draftDepartmentName", fields["部署名"])) appliedCount++;
    if (setById("draftContactPerson", fields["担当者名"])) appliedCount++;
    if (setById("draftAddress", fields["住所"])) appliedCount++;
    if (setById("draftPhone", fields["電話番号"])) appliedCount++;
    if (setById("draftEmail", fields["メール"])) appliedCount++;
    if (setById("draftWebsite", fields["Webサイト"])) appliedCount++;

    // 番号・識別情報
    if (setById("draftInvoiceNumber", draft.invoice_number || fields["請求書番号"])) appliedCount++;
    if (setById("draftReceiptNumber", fields["領収書番号"])) appliedCount++;
    if (setById("draftPaymentNumber", fields["納付番号"])) appliedCount++;
    if (setById("draftNoticeNumber", fields["通知書番号"])) appliedCount++;
    if (setById("draftManagementNumber", fields["管理番号"])) appliedCount++;
    if (setById("draftCustomerNumber", fields["お客様番号"])) appliedCount++;
    if (setById("draftContractNumber", fields["契約番号"])) appliedCount++;
    if (setById("draftMemberNumber", fields["会員番号"])) appliedCount++;
    if (setById("draftOrderNumber", fields["注文番号"])) appliedCount++;
    if (setById("draftTransactionNumber", fields["取引番号"])) appliedCount++;
    if (setById("draftInvoiceRegistrationNumber", fields["登録番号"])) appliedCount++;
    if (setById("draftCorporateNumber", fields["法人番号"])) appliedCount++;
    if (setById("draftCardLast4", fields["カード番号下4桁"])) appliedCount++;

    // 日付・期限
    if (setById("draftDocumentDate", fields["書類日付"] || draft.issue_date)) appliedCount++;
    if (setById("draftIssueDate", fields["発行日"] || draft.issue_date)) appliedCount++;
    if (setById("draftBillingDate", fields["請求日"] || draft.issue_date)) appliedCount++;
    if (setById("draftTransactionDate", fields["取引日・利用日"])) appliedCount++;
    if (setById("draftDeliveryDate", fields["納品日"])) appliedCount++;
    if (setById("draftClosingDate", fields["締日"])) appliedCount++;
    if (setById("draftDueDate", fields["支払期限・納期限"] || draft.due_date)) appliedCount++;
    if (setById("draftPaymentPlanDate", fields["支払予定日"])) appliedCount++;
    if (setById("draftWithdrawalDate", fields["引落日"])) appliedCount++;
    if (setById("draftSettlementDate", fields["決済日"])) appliedCount++;
    if (setById("draftServicePeriodStart", fields["対象開始日"])) appliedCount++;
    if (setById("draftServicePeriodEnd", fields["対象終了日"])) appliedCount++;
    if (setById("draftContractStartDate", fields["契約開始日"])) appliedCount++;
    if (setById("draftContractEndDate", fields["契約終了日"])) appliedCount++;
    if (setById("draftRenewalDate", fields["更新日"])) appliedCount++;

    // 金額・税
    if (setById("draftAmount", fields["請求・支払金額"] || fields["合計金額"] || draft.total_amount)) appliedCount++;
    if (setById("draftTotalAmount", fields["合計金額"] || draft.total_amount)) appliedCount++;
    if (setById("draftTaxIncludedAmount", fields["税込金額"] || draft.total_amount)) appliedCount++;
    if (setById("draftTaxExcludedAmount", fields["税抜金額"])) appliedCount++;
    if (setById("draftTaxAmount", fields["消費税額"] || draft.tax_amount)) appliedCount++;
    if (setById("draftTaxable10Amount", fields["10%対象金額"])) appliedCount++;
    if (setById("draftTax10Amount", fields["10%消費税"])) appliedCount++;
    if (setById("draftTaxable8Amount", fields["8%対象金額"])) appliedCount++;
    if (setById("draftTax8Amount", fields["8%消費税"])) appliedCount++;
    if (setById("draftNonTaxableAmount", fields["非課税・不課税"])) appliedCount++;
    if (setById("draftWithholdingAmount", fields["源泉徴収額"])) appliedCount++;
    if (setById("draftFeeAmount", fields["手数料"])) appliedCount++;
    if (setById("draftLateFeeAmount", fields["延滞金"])) appliedCount++;
    if (setById("draftDiscountAmount", fields["値引・割引"])) appliedCount++;
    if (setById("draftPreviousBalance", fields["前回残高"])) appliedCount++;
    if (setById("draftCurrentUsageAmount", fields["今回利用額"])) appliedCount++;
    if (setById("draftPaidAmount", fields["入金額"])) appliedCount++;
    if (setById("draftUnpaidBalance", fields["未払残高"])) appliedCount++;

    // 支払情報
    if (setById("draftPaymentMethod", fields["支払方法"] || fields["支払方法マスタ"])) appliedCount++;
    if (setById("draftPaymentStatus", fields["支払状態"])) appliedCount++;
    if (setById("draftBankName", fields["振込先銀行"])) appliedCount++;
    if (setById("draftBankCode", fields["銀行コード"])) appliedCount++;
    if (setById("draftBankBranchName", fields["支店名"])) appliedCount++;
    if (setById("draftBranchCode", fields["支店コード"])) appliedCount++;
    if (setById("draftBankAccountType", fields["口座種別"])) appliedCount++;
    if (setById("draftBankAccountNo", fields["口座番号"])) appliedCount++;
    if (setById("draftBankAccountName", fields["口座名義"])) appliedCount++;
    if (setById("draftWithdrawalBank", fields["引落銀行"])) appliedCount++;
    if (setById("draftCardCompany", fields["カード会社"])) appliedCount++;
    if (setById("draftCardName", fields["カード名"])) appliedCount++;
    if (setById("draftSettlementService", fields["決済サービス"])) appliedCount++;
    if (setById("draftConveniencePaymentNumber", fields["コンビニ支払番号"])) appliedCount++;
    if (setById("draftBarcodeNumber", fields["バーコード番号"])) appliedCount++;
    if (setById("draftQrPaymentInfo", fields["QR決済情報"])) appliedCount++;

    // 会計・管理
    if (setById("draftSummary", fields["摘要"] || draft.summary)) appliedCount++;
    if (setById("draftCompanyBurden", fields["会社負担可否"])) appliedCount++;
    if (setById("draftMixedPersonalFlag", fields["個人負担混在"])) appliedCount++;
    if (setById("draftAdvancePaymentFlag", fields["立替"])) appliedCount++;
    if (setById("draftSettlementFlag", fields["精算"])) appliedCount++;
    if (setById("draftPayableRegistrationFlag", fields["未払登録"])) appliedCount++;
    if (setById("draftAccountsPayableFlag", fields["買掛登録"])) appliedCount++;
    if (setById("draftMemo", fields["社内メモ"] || draft.memo)) appliedCount++;
    if (setById("draftLinesRaw", fields["明細候補"])) appliedCount++;

    // 書類別追加情報
    if (setById("draftTaxItem", fields["税目"])) appliedCount++;
    if (setById("draftTaxPaymentDestination", fields["納付先"])) appliedCount++;
    if (setById("draftFiscalYear", fields["年度"])) appliedCount++;
    if (setById("draftPeriodName", fields["期別"])) appliedCount++;
    if (setById("draftUtilityCustomerNumber", fields["公共料金お客様番号"])) appliedCount++;
    if (setById("draftUsagePeriod", fields["使用期間"])) appliedCount++;
    if (setById("draftUsageAmount", fields["使用量"])) appliedCount++;
    if (setById("draftInsuranceType", fields["保険種類"])) appliedCount++;
    if (setById("draftLeaseItem", fields["リース物件"])) appliedCount++;
    if (setById("draftPaymentCount", fields["支払回数"])) appliedCount++;
    if (setById("draftMailSubject", fields["メール件名"])) appliedCount++;
    if (setById("draftMailFrom", fields["メール送信者"])) appliedCount++;
    if (setById("draftMailReceivedAt", fields["メール受信日時"])) appliedCount++;
    if (setById("draftAttachmentFileName", fields["添付ファイル名"])) appliedCount++;
    if (setById("draftDownloadedAt", fields["ダウンロード日"])) appliedCount++;

    // 要確認
    const warningText = [
      fields["要確認メモ"] || "",
      ...(Array.isArray(draft.warnings) ? draft.warnings : [])
    ].filter(Boolean).join("\n");

    if (setById("draftWarnings", warningText)) appliedCount++;

    // IDが違う/未追加の項目があっても、最後にラベル名でも拾う。
    if (draft.ai_summary) {
      for (const [key, value] of Object.entries(draft.ai_summary)) {
        if (value) {
          setFieldByLabel(key, value);
        }
      }
    }

    if (fields && typeof fields === "object") {
      for (const [label, value] of Object.entries(fields)) {
        if (setFieldByLabel(label, value)) {
          appliedCount++;
        }
      }
    }

    return appliedCount;
  }
/* PAYMENT_DOCUMENT_AI_APPLY_BY_ID_20260707_END */
/* PAYMENT_DOCUMENT_AI_FIELD_LINK_DEBUG_20260707_START */
  const PAYMENT_DOCUMENT_AI_LINK_DEBUG_MODE = true;

  function resetAiMasterSelectState(control) {
    if (!control || !control.classList) {
      return;
    }

    control.classList.remove("ai-master-unmatched");
    delete control.dataset.aiMasterUnmatched;
    delete control.dataset.aiUnmatchedValue;
    control.removeAttribute("title");

    Array.from(control.options || []).forEach(option => {
      if (option && option.dataset && option.dataset.aiDebugOption === "1") {
        option.remove();
      }
    });
  }

  function markAiMasterUnmatched(control, text) {
    if (!control || !control.classList) {
      return;
    }

    control.value = "";
    control.dataset.aiMasterUnmatched = "1";
    control.dataset.aiUnmatchedValue = text || "";
    control.classList.add("ai-master-unmatched");
    control.title = text
      ? "AI候補がマスタに一致しません: " + text
      : "AI候補がマスタに一致しません";
  }
  function aiDebugValue(label, value) {
    if (value === null || value === undefined || value === "") {
      return "";
    }

    if (Array.isArray(value)) {
      return value.length ? value.map(item => {
        if (item && typeof item === "object") {
          return JSON.stringify(item);
        }
        return String(item ?? "");
      }).filter(Boolean).join("\n") : "";
    }

    if (typeof value === "object") {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }

    return String(value);
  }

  function aiDebugIsEmptyValue(value) {
    if (value === null || value === undefined || value === "") {
      return true;
    }

    if (Array.isArray(value)) {
      return value.length === 0;
    }

    return false;
  }

  function aiDebugIsObjectValue(value) {
    return !!value && typeof value === "object";
  }

  function aiDebugMarkControl(control, value) {
    if (!control || !control.classList) {
      return;
    }

    control.classList.remove("ai-filled", "ai-null", "ai-object");

    if (!control.dataset.originalPlaceholder && control.placeholder) {
      control.dataset.originalPlaceholder = control.placeholder;
    }

    if (aiDebugIsEmptyValue(value)) {
      control.classList.add("ai-null");
      if ("placeholder" in control) {
        control.placeholder = "";
      }
      return;
    }

    if ("placeholder" in control && control.dataset.originalPlaceholder) {
      control.placeholder = control.dataset.originalPlaceholder;
    }

    if (aiDebugIsObjectValue(value)) {
      control.classList.add("ai-object");
      return;
    }

    control.classList.add("ai-filled");
  }

  function setDebugControlValue(control, label, value) {
    if (!control) {
      return false;
    }

    const text = aiDebugValue(label, value);

    if (control.tagName === "SELECT") {
      resetAiMasterSelectState(control);
      if (!text) {
        control.value = "";
      } else {
        let matched = false;

        for (const option of Array.from(control.options || [])) {
          const optionValue = String(option.value || "").trim();
          const optionText = String(option.textContent || "").trim();

          if (optionValue === text || optionText === text) {
            control.value = option.value;
            matched = true;
            break;
          }
        }

        if (!matched) {
          markAiMasterUnmatched(control, text);
        }
      }
    } else {
      control.value = text;
    }

    aiDebugMarkControl(control, value);

    control.dataset.aiLinked = "1";
    control.dataset.aiLinkedLabel = label;
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));

    return true;
  }

  function setDebugById(id, label, value) {
    const el = document.getElementById(id);

    if (!el) {
      return false;
    }

    return setDebugControlValue(el, label, value);
  }

  function labelTextOnly(label) {
    const clone = label.cloneNode(true);

    clone.querySelectorAll("input, select, textarea, option, button").forEach(node => node.remove());

    return normalizeLabelText(clone.textContent);
  }

  function findControlByLabelText(labelText) {
    const wanted = normalizeLabelText(labelText);

    if (!wanted) {
      return null;
    }

    const labels = Array.from(document.querySelectorAll("label"));

    for (const label of labels) {
      const text = labelTextOnly(label);

      if (!text) {
        continue;
      }

      if (text !== wanted && !text.startsWith(wanted) && !wanted.startsWith(text)) {
        continue;
      }

      if (label.htmlFor) {
        const byFor = document.getElementById(label.htmlFor);

        if (byFor) {
          return byFor;
        }
      }

      const control = label.querySelector("input, select, textarea");

      if (control) {
        return control;
      }
    }

    return null;
  }

  function setDebugByLabel(label, value) {
    const control = findControlByLabelText(label);

    if (!control) {
      return false;
    }

    return setDebugControlValue(control, label, value);
  }

  function applyAiDraftToForm(draft) {
    if (!draft) {
      return 0;
    }

    const fields = draft.fields && typeof draft.fields === "object" ? draft.fields : {};
    const summary = draft.ai_summary && typeof draft.ai_summary === "object" ? draft.ai_summary : {};
    let appliedCount = 0;
    const missingControls = [];

    function put(id, label, value) {
      if (setDebugById(id, label, value)) {
        appliedCount++;
      } else {
        missingControls.push(label + " / #" + id);
      }
    }

    // 要確認 解析サマリー
    put("draftAiDocumentKind", "書類区分", draft.document_type_code || summary.document_kind || fields["書類区分"] || fields["書類種別"]);
    put("draftAiDestination", "処理先", draft.payment_destination_code || fields["処理先"] || summary.destination);
    put("draftAiPayableFlag", "支払対象", summary.payment_target || (fields.payment_target || fields["支払対象"]));
    put("draftAiUnpaidFlag", "未払登録対象", summary.payable_target || (fields.payable_target || fields["未払登録対象"]));
    put("draftAiExpenseFlag", "経費登録対象", summary.expense_target || (fields.expense_target || fields["経費登録対象"]));
    put("draftAiTaxPublicFlag", "税金・公的支払", summary.tax_public || fields["税金・公的支払"]);
    put("draftAiContractFlag", "契約・保険・リース", summary.contract_insurance_lease || fields["契約・保険・リース"]);
    put("draftAiConfidence", "AI信頼度", summary.confidence_label || fields["AI信頼度"]);
    put("draftAiReason", "AI判定理由", summary.reason || fields["AI判定理由"]);

    // 基本情報
    put("draftEvidenceType", "証憑区分", fields["証憑区分"]);
    put("draftDocumentTitle", "書類名", fields["書類名"] || draft.summary);
    put("draftIssuer", "発行元", fields["発行元"] || draft.vendor_name);
    put("draftVendorName", "支払先", fields["支払先"] || draft.vendor_name);
    put("draftRecipient", "宛名", fields["宛名"]);
    put("draftCompanyName", "会社名", fields["会社名"]);
    put("draftPersonName", "個人名", fields["個人名"]);
    put("draftDepartmentName", "部署名", fields["部署名"]);
    put("draftContactName", "担当者名", fields["担当者名"]);
    put("draftAddress", "住所", fields["住所"]);
    put("draftPhone", "電話番号", fields["電話番号"]);
    put("draftEmail", "メール", fields["メール"]);
    put("draftWebsite", "Webサイト", fields["Webサイト"]);

    // 番号・識別情報
    put("draftInvoiceNo", "請求書番号", draft.invoice_number || fields["請求書番号"]);
    put("draftReceiptNo", "領収書番号", fields["領収書番号"]);
    put("draftPaymentNo", "納付番号", fields["納付番号"]);
    put("draftNoticeNo", "通知書番号", fields["通知書番号"]);
    put("draftManagementNo", "管理番号", fields["管理番号"]);
    put("draftCustomerNo", "お客様番号", fields["お客様番号"]);
    put("draftContractNo", "契約番号", fields["契約番号"]);
    put("draftMemberNo", "会員番号", fields["会員番号"]);
    put("draftOrderNo", "注文番号", fields["注文番号"]);
    put("draftTransactionNo", "取引番号", fields["取引番号"]);
    put("draftRegistrationNo", "登録番号", fields["登録番号"]);
    put("draftCorporateNo", "法人番号", fields["法人番号"]);
    put("draftCardLast4", "カード番号下4桁", fields["カード番号下4桁"]);

    // 日付・期限
    put("draftDocumentDate", "書類日付", fields["書類日付"] || draft.issue_date);
    put("draftIssueDate", "発行日", fields["発行日"] || draft.issue_date);
    put("draftBillingDate", "請求日", fields["請求日"] || draft.issue_date);
    put("draftTransactionDate", "取引日・利用日", fields["取引日・利用日"]);
    put("draftDeliveryDate", "納品日", fields["納品日"]);
    put("draftClosingDate", "締日", fields["締日"]);
    put("draftDueDate", "支払期限・納期限", fields["支払期限・納期限"] || draft.due_date);
    put("draftPaymentPlanDate", "支払予定日", fields["支払予定日"]);
    put("draftWithdrawalDate", "引落日", fields["引落日"]);
    put("draftSettlementDate", "決済日", fields["決済日"]);
    put("draftServicePeriodStart", "対象開始日", fields["対象開始日"]);
    put("draftServicePeriodEnd", "対象終了日", fields["対象終了日"]);
    put("draftContractStartDate", "契約開始日", fields["契約開始日"]);
    put("draftContractEndDate", "契約終了日", fields["契約終了日"]);
    put("draftRenewalDate", "更新日", fields["更新日"]);

    // 金額・税
    put("draftAmount", "請求・支払金額", fields["請求・支払金額"] || fields["合計金額"] || draft.total_amount);
    put("draftTotalAmount", "合計金額", fields["合計金額"] || draft.total_amount);
    put("draftAmountInTax", "税込金額", fields["税込金額"] || draft.total_amount);
    put("draftAmountExTax", "税抜金額", fields["税抜金額"]);
    put("draftTaxAmount", "消費税額", fields["消費税額"] || draft.tax_amount);
    put("draftAmount10", "10%対象金額", fields["10%対象金額"]);
    put("draftTax10", "10%消費税", fields["10%消費税"]);
    put("draftAmount8", "8%対象金額", fields["8%対象金額"]);
    put("draftTax8", "8%消費税", fields["8%消費税"]);
    put("draftNonTaxAmount", "非課税・不課税", fields["非課税・不課税"]);
    put("draftWithholdingAmount", "源泉徴収額", fields["源泉徴収額"]);
    put("draftFeeAmount", "手数料", fields["手数料"]);
    put("draftLateFeeAmount", "延滞金", fields["延滞金"]);
    put("draftDiscountAmount", "値引・割引", fields["値引・割引"]);
    put("draftPreviousBalance", "前回残高", fields["前回残高"]);
    put("draftCurrentChargeAmount", "今回利用額", fields["今回利用額"]);
    put("draftPaidAmount", "入金額", fields["入金額"]);
    put("draftBalanceAmount", "未払残高", fields["未払残高"]);

    // 支払情報
    put("draftPaymentMethod", "支払方法", fields["支払方法"] || fields["支払方法マスタ"]);
    put("draftPaymentStatus", "支払状態", fields["支払状態"]);
    put("draftBankName", "振込先銀行", fields["振込先銀行"]);
    put("draftBankCode", "銀行コード", fields["銀行コード"]);
    put("draftBankBranchName", "支店名", fields["支店名"]);
    put("draftBranchCode", "支店コード", fields["支店コード"]);
    put("draftBankAccountType", "口座種別", fields["口座種別"]);
    put("draftBankAccountNo", "口座番号", fields["口座番号"]);
    put("draftBankAccountName", "口座名義", fields["口座名義"]);
    put("draftDebitBankName", "引落銀行", fields["引落銀行"]);
    put("draftCreditCardCompany", "カード会社", fields["カード会社"]);
    put("draftCardName", "カード名", fields["カード名"]);
    put("draftSettlementService", "決済サービス", fields["決済サービス"]);
    put("draftConveniencePaymentNo", "コンビニ支払番号", fields["コンビニ支払番号"]);
    put("draftBarcodeNo", "バーコード番号", fields["バーコード番号"]);
    put("draftQrPaymentInfo", "QR決済情報", fields["QR決済情報"]);

    // 会計・管理
    put("draftAccountingCategory", "会計区分", draft.accounting_category_code || fields["会計区分"]);
    put("draftDestination", "処理先", draft.payment_destination_code || fields["処理先"] || summary.destination);
    put("draftPayableKind", "未払種別", draft.payable_kind_code || fields["未払種別"]);
    put("draftVendorMasterCandidate", "支払先マスタ候補", fields["支払先マスタ候補"]);
    put("draftAccountTitle", "勘定科目", fields["勘定科目"]);
    put("draftTaxCategory", "税区分", fields["税区分"]);
    put("draftInvoiceType", "インボイス区分", fields["インボイス区分"]);
    put("draftPaymentMethodMaster", "支払方法マスタ", fields["支払方法マスタ"] || fields["支払方法"]);
    put("draftTargetPerson", "対象者", fields["対象者"]);
    put("draftPurpose", "目的", fields["目的"]);
    put("draftProject", "案件", fields["案件"]);
    put("draftDepartment", "部門", fields["部門"]);
    put("draftSummary", "摘要", fields["摘要"] || draft.summary);
    put("draftCompanyBurden", "会社負担可否", fields["会社負担可否"]);
    put("draftMixedPersonalFlag", "個人負担混在", fields["個人負担混在"]);
    put("draftAdvancePaymentFlag", "立替", fields["立替"]);
    put("draftSettlementFlag", "精算", fields["精算"]);
    put("draftPayableRegistrationFlag", "未払登録", fields["未払登録"]);
    put("draftAccountsPayableFlag", "買掛登録", fields["買掛登録"]);
    put("draftMemo", "社内メモ", fields["社内メモ"] || draft.memo);

    // 明細
    put("draftLinesRaw", "明細候補", fields["明細候補"]);

    // 書類別追加情報
    put("draftTaxItem", "税目", fields["税目"]);
    put("draftTaxOffice", "納付先", fields["納付先"]);
    put("draftFiscalYear", "年度", fields["年度"]);
    put("draftTaxTerm", "期別", fields["期別"]);
    put("draftUtilityCustomerNo", "公共料金お客様番号", fields["公共料金お客様番号"]);
    put("draftUsagePeriod", "使用期間", fields["使用期間"]);
    put("draftUsageAmount", "使用量", fields["使用量"]);
    put("draftInsuranceType", "保険種類", fields["保険種類"]);
    put("draftLeaseItemName", "リース物件", fields["リース物件"]);
    put("draftPaymentCount", "支払回数", fields["支払回数"]);
    put("draftEmailSubject", "メール件名", fields["メール件名"]);
    put("draftEmailFrom", "メール送信者", fields["メール送信者"]);
    put("draftEmailReceivedAt", "メール受信日時", fields["メール受信日時"]);
    put("draftAttachmentFileName", "添付ファイル名", fields["添付ファイル名"]);
    put("draftDownloadDate", "ダウンロード日", fields["ダウンロード日"]);

    // 要確認
    const warningText = [
      fields["要確認メモ"] || "",
      ...(Array.isArray(draft.warnings) ? draft.warnings : [])
    ].filter(Boolean).join("\n");

    put("draftWarnings", "要確認メモ", warningText);

    // ID不一致の救済。ラベルで探せた項目にも印を入れる。
    for (const [label, value] of Object.entries(fields)) {
      setDebugByLabel(label, value);
    }

    if (missingControls.length) {
      console.warn("AI連動確認: 見つからない画面項目", missingControls);
    }

    window.__lastAiDraftAppliedCount = appliedCount;
    window.__lastAiDraftMissingControls = missingControls;

    return appliedCount;
  }
/* PAYMENT_DOCUMENT_AI_FIELD_LINK_DEBUG_20260707_END */
/* PAYMENT_DOCUMENT_AI_HARD_LINK_DEBUG_20260707_START */
  function aiHardDebugNormalizeText(value) {
    return String(value || "")
      .replace(/\s+/g, "")
      .replace(/：/g, ":")
      .trim();
  }

  function aiHardDebugText(label, value) {
    if (value === null || value === undefined || value === "") {
      return "";
    }

    if (Array.isArray(value)) {
      return value.length ? value.map(item => {
        if (item && typeof item === "object") {
          return JSON.stringify(item);
        }
        return String(item ?? "");
      }).filter(Boolean).join("\n") : "";
    }

    if (typeof value === "object") {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }

    return String(value);
  }

  function aiHardDebugIsEmptyValue(value) {
    if (value === null || value === undefined || value === "") {
      return true;
    }

    if (Array.isArray(value)) {
      return value.length === 0;
    }

    return false;
  }

  function aiHardDebugIsObjectValue(value) {
    return !!value && typeof value === "object";
  }

  function aiHardDebugMarkControl(control, value) {
    if (!control || !control.classList) {
      return;
    }

    control.classList.remove("ai-filled", "ai-null", "ai-object");

    if (!control.dataset.originalPlaceholder && control.placeholder) {
      control.dataset.originalPlaceholder = control.placeholder;
    }

    if (aiHardDebugIsEmptyValue(value)) {
      control.classList.add("ai-null");
      if ("placeholder" in control) {
        control.placeholder = "";
      }
      return;
    }

    if ("placeholder" in control && control.dataset.originalPlaceholder) {
      control.placeholder = control.dataset.originalPlaceholder;
    }

    if (aiHardDebugIsObjectValue(value)) {
      control.classList.add("ai-object");
      return;
    }

    control.classList.add("ai-filled");
  }

  function aiHardDebugLabelTextOnly(label) {
    const clone = label.cloneNode(true);

    clone.querySelectorAll("input, select, textarea, option, button").forEach(node => node.remove());

    return aiHardDebugNormalizeText(clone.textContent);
  }

  function aiHardDebugFindControlByLabel(labelText) {
    const wanted = aiHardDebugNormalizeText(labelText);

    if (!wanted) {
      return null;
    }

    const labels = Array.from(document.querySelectorAll("label"));

    for (const label of labels) {
      const text = aiHardDebugLabelTextOnly(label);

      if (!text) {
        continue;
      }

      if (text !== wanted && !text.startsWith(wanted) && !wanted.startsWith(text)) {
        continue;
      }

      if (label.htmlFor) {
        const byFor = document.getElementById(label.htmlFor);

        if (byFor) {
          return byFor;
        }
      }

      const innerControl = label.querySelector("input, select, textarea");

      if (innerControl) {
        return innerControl;
      }

      const parent = label.closest(".field, .form-field, .form-row, .input-row, div");

      if (parent) {
        const parentControl = parent.querySelector("input, select, textarea");

        if (parentControl) {
          return parentControl;
        }
      }
    }

    return null;
  }

  function aiHardDebugPrepareInput(control) {
    if (!control || control.tagName === "SELECT") {
      return;
    }

    const type = String(control.type || "").toLowerCase();

    if (type === "date" || type === "number" || type === "month") {
      if (!control.dataset.aiOriginalType) {
        control.dataset.aiOriginalType = control.type;
      }

      control.type = "text";
    }
  }


/* PAYMENT_DOCUMENT_AI_SELECT_CODE_MATCH_20260707_START */
  function aiSelectNormalizeText(value) {
    return String(value || "")
      .replace(/\s+/g, "")
      .replace(/[　]/g, "")
      .replace(/[・･]/g, "")
      .replace(/[／\/]/g, "")
      .replace(/[（）()]/g, "")
      .replace(/[：:]/g, "")
      .trim()
      .toLowerCase();
  }

  function aiSelectAliasCode(label, value) {
    const labelNorm = aiSelectNormalizeText(label);
    const valueText = String(value || "").trim();
    const valueNorm = aiSelectNormalizeText(valueText);

    if (!valueNorm) return "";

    const alreadyCode = [
      "invoice",
      "receipt",
      "tax_payment_notice",
      "card_statement",
      "needs_review_analysis",
      "insurance_notice",
      "lease_contract",
      "contract",
      "web_statement",
      "mail_saved",
      "other",
      "payable",
      "accounts_payable",
      "expense",
      "tax_public",
      "card_payable",
      "contract_insurance_lease",
      "no_process",
      "needs_review",
      "normal",
      "tax",
      "public_utility",
      "insurance",
      "lease",
      "asset",
      "mixed_personal",
      "unpaid",
      "accrued_expense"
    ];

    if (alreadyCode.includes(valueText)) {
      return valueText;
    }

    if (
      labelNorm.includes("書類種別") ||
      labelNorm.includes("書類区分")
    ) {
      if (valueNorm.includes("リース")) return "lease_contract";
      if (valueNorm.includes("納付") || valueNorm.includes("納税") || valueNorm.includes("税金")) return "tax_payment_notice";
      if (valueNorm.includes("カード")) return "card_statement";
      if (valueNorm.includes("公共") || valueNorm.includes("電気") || valueNorm.includes("ガス") || valueNorm.includes("水道")) return "needs_review_analysis";
      if (valueNorm.includes("保険")) return "insurance_notice";
      if (valueNorm.includes("請求")) return "invoice";
      if (valueNorm.includes("領収")) return "receipt";
      if (valueNorm.includes("契約")) return "contract";
      if (valueNorm.includes("メール")) return "mail_saved";
      if (valueNorm.includes("web") || valueNorm.includes("ウェブ")) return "web_statement";
    }

    if (labelNorm.includes("処理先")) {
      if (valueNorm.includes("税") || valueNorm.includes("公的") || valueNorm.includes("納付")) return "tax_public";
      if (valueNorm.includes("リース") || valueNorm.includes("保険") || valueNorm.includes("契約")) return "contract_insurance_lease";
      if (valueNorm.includes("カード")) return "card_payable";
      if (valueNorm.includes("買掛") || valueNorm.includes("仕入債務")) return "accounts_payable";
      if (valueNorm.includes("経費")) return "expense";
      if (valueNorm.includes("支払")) return "payable";
      if (valueNorm.includes("対象外")) return "no_process";
      if (valueNorm.includes("確認")) return "needs_review";
    }

    if (labelNorm.includes("会計区分")) {
      if (valueNorm.includes("リース")) return "lease";
      if (valueNorm.includes("税")) return "tax";
      if (valueNorm.includes("公共")) return "public_utility";
      if (valueNorm.includes("保険")) return "insurance";
      if (valueNorm.includes("資産")) return "asset";
      if (valueNorm.includes("個人") || valueNorm.includes("混在")) return "mixed_personal";
      if (valueNorm.includes("確認")) return "needs_review";
      if (valueNorm.includes("通常")) return "normal";
    }

    if (labelNorm.includes("未払種別")) {
      if (valueNorm.includes("買掛")) return "accounts_payable";
      if (valueNorm.includes("カード")) return "card_payable";
      if (valueNorm.includes("未払費用")) return "accrued_expense";
      if (valueNorm.includes("未払")) return "unpaid";
      if (valueNorm.includes("その他")) return "other";
    }

    if (labelNorm.includes("税金公的支払")) {
      if (valueNorm === "true" || valueNorm.includes("税") || valueNorm.includes("公的") || valueNorm.includes("納付")) return "tax_public";
      if (valueNorm === "false" || valueNorm.includes("対象外")) return "false";
    }

    if (labelNorm.includes("契約保険リース")) {
      if (valueNorm.includes("リース")) return "lease";
      if (valueNorm.includes("保険")) return "insurance";
      if (valueNorm.includes("契約")) return "contract";
      if (valueNorm === "false" || valueNorm.includes("対象外")) return "false";
    }

    return "";
  }

  function aiSelectClearOldDebugOptions(control) {
    Array.from(control.options || []).forEach(option => {
      if (option && option.dataset && option.dataset.aiDebugOption === "1") {
        option.remove();
      }
    });
  }

  function aiSelectMarkUnmatched(control, text) {
    if (!control) return;

    control.value = "";
    control.classList.add("ai-master-unmatched");
    control.dataset.aiMasterUnmatched = "1";
    control.dataset.aiUnmatchedValue = String(text || "");
    control.title = text
      ? "AI候補がマスタ候補に一致しません: " + text
      : "AI候補がマスタ候補に一致しません";
  }

  function aiSelectClearUnmatched(control) {
    if (!control) return;

    control.classList.remove("ai-master-unmatched");
    delete control.dataset.aiMasterUnmatched;
    delete control.dataset.aiUnmatchedValue;
    control.removeAttribute("title");
  }

  function aiSetSelectByMasterCode(control, label, value) {
    if (!control) return false;

    const raw = String(value === null || value === undefined ? "" : value).trim();

    aiSelectClearOldDebugOptions(control);
    aiSelectClearUnmatched(control);

    if (!raw) {
      control.value = "";
      return true;
    }

    const candidates = [raw];

    const options = Array.from(control.options || []);

    for (const candidate of candidates) {
      const candidateNorm = aiSelectNormalizeText(candidate);

      const match = options.find(option => {
        const optionValue = String(option.value || "").trim();
        const optionText = String(option.textContent || "").trim();
        const optionName = String(option.dataset && option.dataset.name || "").trim();

        return (
          optionValue === candidate ||
          aiSelectNormalizeText(optionValue) === candidateNorm ||
          aiSelectNormalizeText(optionText) === candidateNorm ||
          aiSelectNormalizeText(optionName) === candidateNorm
        );
      });

      if (match) {
        control.value = match.value;
        return true;
      }

      if (typeof setDraftMasterSelectValue === "function") {
        setDraftMasterSelectValue(control, candidate);

        if (String(control.value || "").trim()) {
          return true;
        }
      }
    }

    aiSelectMarkUnmatched(control, raw);
    return true;
  }
/* PAYMENT_DOCUMENT_AI_SELECT_CODE_MATCH_20260707_END */

/* PAYMENT_DOCUMENT_AI_SELECT_MASTER_APPLY_FIX_20260707_START */
  function aiNormalizeForMasterMatch(value) {
    return String(value || "")
      .replace(/\s+/g, "")
      .replace(/[　]/g, "")
      .replace(/[・･]/g, "")
      .replace(/[／\/]/g, "")
      .replace(/[（）()]/g, "")
      .replace(/[：:]/g, "")
      .trim()
      .toLowerCase();
  }

  function aiMasterAliasForSelect(select, label, value) {
    const raw = String(value || "").trim();
    const norm = aiNormalizeForMasterMatch(raw);
    const type = String(select && select.dataset && select.dataset.masterType || "");
    const id = String(select && select.id || "");
    const labelNorm = aiNormalizeForMasterMatch(label);

    if (!raw) return "";

    const knownCodes = [
      "invoice", "receipt", "tax_payment_notice", "card_statement", "needs_review_analysis",
      "insurance_notice", "lease_contract", "contract", "web_statement", "mail_saved", "other",
      "payable", "accounts_payable", "expense", "tax_public", "card_payable",
      "contract_insurance_lease", "no_process", "needs_review",
      "normal", "tax", "public_utility", "insurance", "lease", "asset", "mixed_personal",
      "unpaid", "accrued_expense"
    ];

    if (knownCodes.includes(raw)) return raw;

    if (type === "document_types" || id === "draftAiDocumentKind" || labelNorm.includes("書類区分") || labelNorm.includes("書類種別")) {
      if (norm.includes("リース")) return "lease_contract";
      if (norm.includes("納付") || norm.includes("納税") || norm.includes("税金") || norm.includes("税務署")) return "tax_payment_notice";
      if (norm.includes("カード")) return "card_statement";
      if (norm.includes("公共") || norm.includes("電気") || norm.includes("ガス") || norm.includes("水道")) return "needs_review_analysis";
      if (norm.includes("保険")) return "insurance_notice";
      if (norm.includes("請求")) return "invoice";
      if (norm.includes("領収")) return "receipt";
      if (norm.includes("契約")) return "contract";
      if (norm.includes("メール")) return "mail_saved";
      if (norm.includes("web") || norm.includes("ウェブ")) return "web_statement";
    }

    if (type === "payment_destinations" || id === "draftAiDestination" || id === "draftDestination" || labelNorm.includes("処理先")) {
      if (norm.includes("税") || norm.includes("公的") || norm.includes("納付")) return "tax_public";
      if (norm.includes("リース") || norm.includes("保険") || norm.includes("契約")) return "contract_insurance_lease";
      if (norm.includes("カード")) return "card_payable";
      if (norm.includes("買掛") || norm.includes("仕入債務")) return "accounts_payable";
      if (norm.includes("経費")) return "expense";
      if (norm.includes("支払")) return "payable";
      if (norm.includes("対象外")) return "no_process";
      if (norm.includes("確認")) return "needs_review";
    }

    if (type === "accounting_categories" || id === "draftAccountingCategory" || labelNorm.includes("会計区分")) {
      if (norm.includes("リース")) return "lease";
      if (norm.includes("税")) return "tax";
      if (norm.includes("公共")) return "public_utility";
      if (norm.includes("保険")) return "insurance";
      if (norm.includes("資産")) return "asset";
      if (norm.includes("個人") || norm.includes("混在")) return "mixed_personal";
      if (norm.includes("確認")) return "needs_review";
      if (norm.includes("通常")) return "normal";
    }

    if (type === "payable_kinds" || id === "draftPayableKind" || labelNorm.includes("未払種別")) {
      if (norm.includes("買掛")) return "accounts_payable";
      if (norm.includes("カード")) return "card_payable";
      if (norm.includes("未払費用")) return "accrued_expense";
      if (norm.includes("未払")) return "unpaid";
      if (norm.includes("その他")) return "other";
    }

    return "";
  }

  function setAiSelectByMaster(select, label, value) {
    if (!select) return false;

    const raw = String(value === null || value === undefined ? "" : value).trim();

    Array.from(select.options || []).forEach(option => {
      if (option && option.dataset && option.dataset.aiDebugOption === "1") {
        option.remove();
      }
    });

    select.classList.remove("ai-master-unmatched");
    delete select.dataset.aiMasterUnmatched;
    delete select.dataset.aiUnmatchedValue;
    select.removeAttribute("title");

    if (!raw) {
      select.value = "";
      return true;
    }

    const candidates = [raw];

    for (const candidate of candidates) {
      if (typeof setDraftMasterSelectValue === "function") {
        setDraftMasterSelectValue(select, candidate);
        if (String(select.value || "").trim()) {
          return true;
        }
      }

      const candidateNorm = aiNormalizeForMasterMatch(candidate);
      const match = Array.from(select.options || []).find(option => {
        return (
          String(option.value || "").trim() === candidate ||
          aiNormalizeForMasterMatch(option.textContent) === candidateNorm ||
          aiNormalizeForMasterMatch(option.dataset && option.dataset.name) === candidateNorm ||
          aiNormalizeForMasterMatch(option.dataset && option.dataset.code) === candidateNorm
        );
      });

      if (match) {
        select.value = match.value;
        return true;
      }
    }

    select.value = "";
    select.classList.add("ai-master-unmatched");
    select.dataset.aiMasterUnmatched = "1";
    select.dataset.aiUnmatchedValue = raw;
    select.title = "AI候補がマスタに一致しません: " + raw;
    return true;
  }
/* PAYMENT_DOCUMENT_AI_SELECT_MASTER_APPLY_FIX_20260707_END */
    function aiHardDebugSetControl(control, label, value) {
    if (!control) {
      return false;
    }

    const text = aiHardDebugText(label, value);

    if (control.tagName === "SELECT") {
      setAiSelectByMaster(control, label, text);
    } else {
      aiHardDebugPrepareInput(control);
      control.value = text;
    }

    control.dataset.aiLinked = "1";
    control.dataset.aiLinkedLabel = label;
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));

    return true;
  }

  function aiHardDebugPut(id, label, value, missingControls) {
    const byId = document.getElementById(id);
    const byLabel = byId || aiHardDebugFindControlByLabel(label);

    if (aiHardDebugSetControl(byLabel, label, value)) {
      return 1;
    }

    missingControls.push(label + " / #" + id);
    return 0;
  }

  function applyAiDraftToFormHardDebug(draft) {
    const fields = draft && draft.fields && typeof draft.fields === "object" ? draft.fields : {};
    const summary = draft && draft.ai_summary && typeof draft.ai_summary === "object" ? draft.ai_summary : {};
    const missingControls = [];
    let appliedCount = 0;

    function put(id, label, value) {
      appliedCount += aiHardDebugPut(id, label, value, missingControls);
    }

    /* HD_ORIGIN_BANK_TRANSACTION_CODE_MAPPING_START */
    for (const [fieldCode, value] of Object.entries(fields)) {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        continue;
      }

      const escapedFieldCode =
        window.CSS &&
        typeof window.CSS.escape === "function"
          ? window.CSS.escape(String(fieldCode))
          : String(fieldCode)
              .replace(/\\/g, "\\\\")
              .replace(/"/g, '\\"');

      const control = document.querySelector(
        '[data-analysis-item-code="' +
        escapedFieldCode +
        '"]'
      );

      if (!control) {
        continue;
      }

      if (
        typeof aiHardDebugSetControl ===
        "function"
      ) {
        if (
          aiHardDebugSetControl(
            control,
            fieldCode,
            value
          )
        ) {
          appliedCount++;
        }
      } else {
        control.value = String(value);
        appliedCount++;
      }
    }
    /* HD_ORIGIN_BANK_TRANSACTION_CODE_MAPPING_END */

    put("draftAiDocumentKind", "書類区分", draft.document_type_code || summary.document_kind || fields["書類区分"] || fields["書類種別"]);
    put("draftAiDestination", "処理先", draft.payment_destination_code || fields["処理先"] || summary.destination);
    put("draftAiPayableFlag", "支払対象", summary.payment_target || (fields.payment_target || fields["支払対象"]));
    put("draftAiUnpaidFlag", "未払登録対象", summary.payable_target || (fields.payable_target || fields["未払登録対象"]));
    put("draftAiExpenseFlag", "経費登録対象", summary.expense_target || (fields.expense_target || fields["経費登録対象"]));
    put("draftAiTaxPublicFlag", "税金・公的支払", summary.tax_public || fields["税金・公的支払"]);
    put("draftAiContractFlag", "契約・保険・リース", summary.contract_insurance_lease || fields["契約・保険・リース"]);
    put("draftAiConfidence", "AI信頼度", summary.confidence_label || fields["AI信頼度"]);
    put("draftAiReason", "AI判定理由", summary.reason || fields["AI判定理由"]);

    put("draftEvidenceType", "証憑区分", fields["証憑区分"]);
    put("draftDocumentTitle", "書類名", fields["書類名"] || draft.summary);
    put("draftIssuer", "発行元", fields["発行元"] || draft.vendor_name);
    put("draftVendorName", "支払先", fields["支払先"] || draft.vendor_name);
    put("draftRecipient", "宛名", fields["宛名"]);
    put("draftCompanyName", "会社名", fields["会社名"]);
    put("draftPersonName", "個人名", fields["個人名"]);
    put("draftDepartmentName", "部署名", fields["部署名"]);
    put("draftContactName", "担当者名", fields["担当者名"]);
    put("draftAddress", "住所", fields["住所"]);
    put("draftPhone", "電話番号", fields["電話番号"]);
    put("draftEmail", "メール", fields["メール"]);
    put("draftWebsite", "Webサイト", fields["Webサイト"]);

    put("draftInvoiceNo", "請求書番号", draft.invoice_number || fields["請求書番号"]);
    put("draftReceiptNo", "領収書番号", fields["領収書番号"]);
    put("draftPaymentNo", "納付番号", fields["納付番号"]);
    put("draftNoticeNo", "通知書番号", fields["通知書番号"]);
    put("draftManagementNo", "管理番号", fields["管理番号"]);
    put("draftCustomerNo", "お客様番号", fields["お客様番号"]);
    put("draftContractNo", "契約番号", fields["契約番号"]);
    put("draftMemberNo", "会員番号", fields["会員番号"]);
    put("draftOrderNo", "注文番号", fields["注文番号"]);
    put("draftTransactionNo", "取引番号", fields["取引番号"]);
    put("draftRegistrationNo", "登録番号", fields["登録番号"]);
    put("draftCorporateNo", "法人番号", fields["法人番号"]);
    put("draftCardLast4", "カード番号下4桁", fields["カード番号下4桁"]);

    put("draftDocumentDate", "書類日付", fields["書類日付"] || draft.issue_date);
    put("draftIssueDate", "発行日", fields["発行日"] || draft.issue_date);
    put("draftBillingDate", "請求日", fields["請求日"] || draft.issue_date);
    put("draftTransactionDate", "取引日・利用日", fields["取引日・利用日"]);
    put("draftDeliveryDate", "納品日", fields["納品日"]);
    put("draftClosingDate", "締日", fields["締日"]);
    put("draftDueDate", "支払期限・納期限", fields["支払期限・納期限"] || draft.due_date);
    put("draftPaymentPlanDate", "支払予定日", fields["支払予定日"]);
    put("draftWithdrawalDate", "引落日", fields["引落日"]);
    put("draftSettlementDate", "決済日", fields["決済日"]);
    put("draftServicePeriodStart", "対象開始日", fields["対象開始日"]);
    put("draftServicePeriodEnd", "対象終了日", fields["対象終了日"]);
    put("draftContractStartDate", "契約開始日", fields["契約開始日"]);
    put("draftContractEndDate", "契約終了日", fields["契約終了日"]);
    put("draftRenewalDate", "更新日", fields["更新日"]);

    put("draftAmount", "請求・支払金額", fields["請求・支払金額"] || fields["合計金額"] || draft.total_amount);
    put("draftTotalAmount", "合計金額", fields["合計金額"] || draft.total_amount);
    put("draftAmountInTax", "税込金額", fields["税込金額"] || draft.total_amount);
    put("draftAmountExTax", "税抜金額", fields["税抜金額"]);
    put("draftTaxAmount", "消費税額", fields["消費税額"] || draft.tax_amount);
    put("draftAmount10", "10%対象金額", fields["10%対象金額"]);
    put("draftTax10", "10%消費税", fields["10%消費税"]);
    put("draftAmount8", "8%対象金額", fields["8%対象金額"]);
    put("draftTax8", "8%消費税", fields["8%消費税"]);
    put("draftNonTaxAmount", "非課税・不課税", fields["非課税・不課税"]);
    put("draftWithholdingAmount", "源泉徴収額", fields["源泉徴収額"]);
    put("draftFeeAmount", "手数料", fields["手数料"]);
    put("draftLateFeeAmount", "延滞金", fields["延滞金"]);
    put("draftDiscountAmount", "値引・割引", fields["値引・割引"]);
    put("draftPreviousBalance", "前回残高", fields["前回残高"]);
    put("draftCurrentChargeAmount", "今回利用額", fields["今回利用額"]);
    put("draftPaidAmount", "入金額", fields["入金額"]);
    put("draftBalanceAmount", "未払残高", fields["未払残高"]);

    put("draftPaymentMethod", "支払方法", fields["支払方法"] || fields["支払方法マスタ"]);
    put("draftPaymentStatus", "支払状態", fields["支払状態"]);
    put("draftBankName", "振込先銀行", fields["振込先銀行"]);
    put("draftBankCode", "銀行コード", fields["銀行コード"]);
    put("draftBankBranchName", "支店名", fields["支店名"]);
    put("draftBranchCode", "支店コード", fields["支店コード"]);
    put("draftBankAccountType", "口座種別", fields["口座種別"]);
    put("draftBankAccountNo", "口座番号", fields["口座番号"]);
    put("draftBankAccountName", "口座名義", fields["口座名義"]);
    put("draftDebitBankName", "引落銀行", fields["引落銀行"]);
    put("draftCreditCardCompany", "カード会社", fields["カード会社"]);
    put("draftCardName", "カード名", fields["カード名"]);
    put("draftSettlementService", "決済サービス", fields["決済サービス"]);
    put("draftConveniencePaymentNo", "コンビニ支払番号", fields["コンビニ支払番号"]);
    put("draftBarcodeNo", "バーコード番号", fields["バーコード番号"]);
    put("draftQrPaymentInfo", "QR決済情報", fields["QR決済情報"]);

    put("draftAccountingCategory", "会計区分", draft.accounting_category_code || fields["会計区分"]);
    put("draftDestination", "処理先", draft.payment_destination_code || fields["処理先"] || summary.destination);
    put("draftPayableKind", "未払種別", draft.payable_kind_code || fields["未払種別"]);
    put("draftVendorMasterCandidate", "支払先マスタ候補", fields["支払先マスタ候補"]);
    put("draftAccountTitle", "勘定科目", fields["勘定科目"]);
    put("draftTaxCategory", "税区分", fields["税区分"]);
    put("draftInvoiceType", "インボイス区分", fields["インボイス区分"]);
    put("draftPaymentMethodMaster", "支払方法マスタ", fields["支払方法マスタ"] || fields["支払方法"]);
    put("draftTargetPerson", "対象者", fields["対象者"]);
    put("draftPurpose", "目的", fields["目的"]);
    put("draftProject", "案件", fields["案件"]);
    put("draftDepartment", "部門", fields["部門"]);
    put("draftSummary", "摘要", fields["摘要"] || draft.summary);
    put("draftCompanyBurden", "会社負担可否", fields["会社負担可否"]);
    put("draftMixedPersonalFlag", "個人負担混在", fields["個人負担混在"]);
    put("draftAdvancePaymentFlag", "立替", fields["立替"]);
    put("draftSettlementFlag", "精算", fields["精算"]);
    put("draftPayableRegistrationFlag", "未払登録", fields["未払登録"]);
    put("draftAccountsPayableFlag", "買掛登録", fields["買掛登録"]);
    put("draftMemo", "社内メモ", fields["社内メモ"] || draft.memo);

    put("draftLinesRaw", "明細候補", fields["明細候補"]);

    put("draftTaxItem", "税目", fields["税目"]);
    put("draftTaxOffice", "納付先", fields["納付先"]);
    put("draftFiscalYear", "年度", fields["年度"]);
    put("draftTaxTerm", "期別", fields["期別"]);
    put("draftUtilityCustomerNo", "公共料金お客様番号", fields["公共料金お客様番号"]);
    put("draftUsagePeriod", "使用期間", fields["使用期間"]);
    put("draftUsageAmount", "使用量", fields["使用量"]);
    put("draftInsuranceType", "保険種類", fields["保険種類"]);
    put("draftLeaseItemName", "リース物件", fields["リース物件"]);
    put("draftPaymentCount", "支払回数", fields["支払回数"]);
    put("draftEmailSubject", "メール件名", fields["メール件名"]);
    put("draftEmailFrom", "メール送信者", fields["メール送信者"]);
    put("draftEmailReceivedAt", "メール受信日時", fields["メール受信日時"]);
    put("draftAttachmentFileName", "添付ファイル名", fields["添付ファイル名"]);
    put("draftDownloadDate", "ダウンロード日", fields["ダウンロード日"]);

    const warningText = [
      fields["要確認メモ"] || "",
      ...(Array.isArray(draft.warnings) ? draft.warnings : [])
    ].filter(Boolean).join("\n");

    put("draftWarnings", "要確認メモ", warningText);

    window.__lastAiDraftAppliedCount = appliedCount;
    window.__lastAiDraftMissingControls = missingControls;

    if (missingControls.length) {
      console.warn("AI連動確認 見つからない項目", missingControls);
    }

    return appliedCount;
  }
/* PAYMENT_DOCUMENT_AI_HARD_LINK_DEBUG_20260707_END */

/* PAYMENT_DOCUMENT_REVIEW_VISIBLE_FIELDS_ONLY_20260707_START */
  function getFieldLabelText(control) {
    if (!control) return "";

    const label = control.closest("label");

    if (!label) return "";

    const parts = [];

    for (const node of Array.from(label.childNodes || [])) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = String(node.textContent || "").trim();
        if (text) parts.push(text);
      }
    }

    return parts.join("").replace(/\s+/g, "").trim();
  }

  function getFieldValue(control) {
    if (!control) return "";

    if (control.tagName === "SELECT") {
      resetAiMasterSelectState(control);
      const option = control.options && control.selectedIndex >= 0
        ? control.options[control.selectedIndex]
        : null;

      const value = String(control.value || "").trim();
      const text = option ? String(option.textContent || "").trim() : "";

      if (!value) return "";
      if (text === "マスタ読込中..." || text === "マスタ読込中.") return "";
      return text || value;
    }

    return String(control.value || "").trim();
  }

  function setInitialAiOnlyView() {
    document.body.classList.remove("ai-analysis-done");
    document.body.classList.add("ai-analysis-initial");

    document.querySelectorAll(".post-ai-action").forEach(button => {
      button.style.display = "none";
    });

    document.querySelectorAll(".draft-form-scroll .draft-section").forEach(section => {
      section.classList.add("ai-section-hidden");
    });

    showResult("");
  }

  function showVisibleFieldsOnly(visibleLabels) {
    const visibleSet = new Set((Array.isArray(visibleLabels) ? visibleLabels : []).map(item => normalizeLabelText(item)));

    document.body.classList.remove("ai-analysis-initial");
    document.body.classList.add("ai-analysis-done");

    document.querySelectorAll(".post-ai-action").forEach(button => {
      button.style.display = "";
    });

    document.querySelectorAll(".draft-form-scroll .draft-section").forEach(section => {
      let sectionHasVisibleField = false;
      const title = section.querySelector(".draft-section-title");
      const titleText = normalizeLabelText(title ? title.textContent : "");

      if (titleText === normalizeLabelText("要確認 解析サマリー")) {
        section.classList.remove("ai-section-hidden");
        section.querySelectorAll("label").forEach(label => {
          label.classList.remove("ai-field-hidden");
        });
        return;
      }

      section.querySelectorAll("label").forEach(label => {
        const control = label.querySelector("input, select, textarea");
        const labelText = normalizeLabelText(getFieldLabelText(control));
        const hasValue = !!getFieldValue(control);
        const shouldShow = hasValue || visibleSet.has(labelText);

        if (shouldShow) {
          label.classList.remove("ai-field-hidden");
          sectionHasVisibleField = true;
        } else {
          label.classList.add("ai-field-hidden");
        }
      });

      if (sectionHasVisibleField) {
        section.classList.remove("ai-section-hidden");
      } else {
        section.classList.add("ai-section-hidden");
      }
    });
  }
/* PAYMENT_DOCUMENT_REVIEW_VISIBLE_FIELDS_ONLY_20260707_END */
  async function runAiDraftFromSelectedOcr() {
    const id = selectedOcrImportId();

    if (!id) {
      showResult("左リストからDB保存済みOCRを選択してください。");
      return;
    }

    showResult("要確認の専門解析を実行しています。画像は送信しません。");

    try {
      const res = await fetch("/api/payment-documents/ai-specialist/" + encodeURIComponent(String(id)), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });

      const data = await res.json();

      if (!data.ok) {
        showResult(data);
        return;
      }
      const appliedCount = applyAiDraftToFormHardDebug(data.draft);
      showVisibleFieldsOnly(data.visible_field_labels || (data.draft && data.draft.visible_field_labels) || []);
      showResult({
        ok: true,
        message: "要確認の専門解析が完了しました。画像はOpenAIへ送信していません。AIサマリー反映件数: " + appliedCount + "件",
        image_used: data.image_used,
        document_group: data.document_group || (data.draft && data.draft.document_group) || "",
        visible_field_labels: data.visible_field_labels || (data.draft && data.draft.visible_field_labels) || [],
        ai_steps: data.ai_steps || [],
        draft: data.draft
      });
    } catch (error) {
      showResult({
        ok: false,
        error: error.message || String(error)
      });
    }
  }
/* PAYMENT_DOCUMENT_OPENAI_OCR_DRAFT_CLIENT_20260707_END */
/* PAYMENT_DOCUMENT_OPENAI_WIDE_DRAFT_CLIENT_20260707_START */
  function normalizeLabelText(value) {
    return String(value || "")
      .replace(/\s+/g, "")
      .replace(/：/g, ":")
      .trim();
  }

  function findControlByLabelText(labelText) {
    const wanted = normalizeLabelText(labelText);

    if (!wanted) {
      return null;
    }

    const labels = Array.from(document.querySelectorAll("label, .field-label, .form-label, .label"));

    for (const label of labels) {
      const text = normalizeLabelText(label.textContent);

      if (!text || text !== wanted) {
        continue;
      }

      if (label.htmlFor) {
        const byFor = document.getElementById(label.htmlFor);

        if (byFor) {
          return byFor;
        }
      }

      const parent = label.closest(".field, .form-field, .input-row, .form-row, div") || label.parentElement;

      if (parent) {
        const control = parent.querySelector("input, select, textarea");

        if (control) {
          return control;
        }
      }

      const next = label.nextElementSibling;

      if (next && next.matches && next.matches("input, select, textarea")) {
        return next;
      }
    }

    return null;
  }

  function setControlValue(control, value) {
    if (!control) {
      return false;
    }

    const text = value === null || value === undefined ? "" : String(value);

    if (control.tagName === "SELECT") {
      resetAiMasterSelectState(control);
      setDraftMasterSelectValue(control, text);
    } else {
      control.value = text;
    }

    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));

    return true;
  }

  function setFieldByLabel(labelText, value) {
    if (value === null || value === undefined || value === "") {
      return false;
    }

    const control = findControlByLabelText(labelText);

    return setControlValue(control, value);
  }

  function applyAiSummaryFields(summary) {
    if (!summary) {
      return;
    }

    setFieldByLabel("書類種別", summary.document_kind);
    setFieldByLabel("処理先", summary.destination);
    setFieldByLabel("支払対象", summary.payment_target);
    setFieldByLabel("未払登録対象", summary.payable_target);
    setFieldByLabel("経費登録対象", summary.expense_target);
    setFieldByLabel("税金・公的支払", summary.tax_public);
    setFieldByLabel("契約・保険・リース", summary.contract_insurance_lease);
    setFieldByLabel("AI信頼度", summary.confidence_label);
    setFieldByLabel("AI判定理由", summary.reason);
  }

  function applyAiFieldMap(fields) {
    if (!fields || typeof fields !== "object") {
      return 0;
    }

    let count = 0;

    for (const [fieldKey, value] of Object.entries(fields)) {
      const escapedFieldKey =
        window.CSS && typeof window.CSS.escape === "function"
          ? window.CSS.escape(String(fieldKey))
          : String(fieldKey)
              .replace(/\\/g, "\\\\")
              .replace(/"/g, '\\"');

      const controlByCode = document.querySelector(
        '[data-analysis-item-code="' + escapedFieldKey + '"]'
      );

      if (controlByCode) {
        if (setControlValue(controlByCode, value)) {
          count++;
        }

        continue;
      }

      if (setFieldByLabel(fieldKey, value)) {
        count++;
      }
    }

    return count;
  }

  function applyAiDraftToForm(draft) {
    if (!draft) {
      return;
    }

    setMasterSelectByCodeOrText('[data-master-type="document_types"]', draft.document_type_code);
    setMasterSelectByCodeOrText('[data-master-type="payment_destinations"]', draft.payment_destination_code);
    setMasterSelectByCodeOrText('[data-master-type="accounting_categories"]', draft.accounting_category_code);
    setMasterSelectByCodeOrText('[data-master-type="payable_kinds"]', draft.payable_kind_code);
    setMasterSelectByCodeOrText('[data-master-type="payment_source_types"]', draft.source_type_code);

    setInputValue('[name="vendor_name"], #vendorName', draft.vendor_name);
    setInputValue('[name="issue_date"], #issueDate', draft.issue_date);
    setInputValue('[name="due_date"], #dueDate', draft.due_date);
    setInputValue('[name="invoice_number"], #invoiceNumber', draft.invoice_number);
    setInputValue('[name="total_amount"], #totalAmount', draft.total_amount);
    setInputValue('[name="tax_amount"], #taxAmount', draft.tax_amount);
    setInputValue('[name="summary"], #summary', draft.summary);
    setInputValue('[name="memo"], #memo', draft.memo);

    applyAiSummaryFields(draft.ai_summary);
    applyAiFieldMap(draft.fields);
  }
/* PAYMENT_DOCUMENT_OPENAI_WIDE_DRAFT_CLIENT_20260707_END */

  function ocrImportIdOf(item) {
    if (!item) return "";
    return item.paymentDocumentOcrImportId || item.payment_document_ocr_import_id || "";
  }

  function updateSelectedSortingSummary() {
    const summary = document.getElementById("selectedSortingSummary");
    if (!summary) return;

    const validIds = new Set(items.map(item => String(ocrImportIdOf(item) || "")).filter(Boolean));
    checkedOcrImportIds = new Set(Array.from(checkedOcrImportIds).filter(id => validIds.has(String(id))));

    summary.textContent = "選択: " + checkedOcrImportIds.size + "件";
  }

  function toggleSortingChecked(index, checked) {
    const item = items[index];
    const id = String(ocrImportIdOf(item) || "");

    if (!id) {
      updateSelectedSortingSummary();
      return;
    }

    if (checked) {
      checkedOcrImportIds.add(id);
    } else {
      checkedOcrImportIds.delete(id);
    }

    updateSelectedSortingSummary();
  }

  function selectAllSortingItems() {
    items.forEach(item => {
      const id = String(ocrImportIdOf(item) || "");
      if (id) checkedOcrImportIds.add(id);
    });

    renderSortingList();
    updateSelectedSortingSummary();
  }

  function clearSortingSelection() {
    checkedOcrImportIds.clear();
    renderSortingList();
    updateSelectedSortingSummary();
  }

  function selectedSortingIndexes() {
    return items
      .map((item, index) => ({ item, index, id: String(ocrImportIdOf(item) || "") }))
      .filter(row => row.id && checkedOcrImportIds.has(row.id))
      .map(row => row.index);
  }

  function renderSortingList() {
    const list = document.getElementById("list");

    if (!list) return;

    if (
      typeof window.renderSortingList === "function"
    ) {
      window.renderSortingList();
      return;
    }

    updateSelectedSortingSummary();
  }
  async function runAiDraftForItemIndex(index, options = {}) {
    if (!Array.isArray(items) || index < 0 || index >= items.length) {
      showResult("解析する書類が見つかりません。");
      return { ok: false, error: "解析する書類が見つかりません。" };
    }

    selectedIndex = index;
    selectItem(index);

    const item = items[index];
    const id = String(ocrImportIdOf(item) || "");
    const name = item.originalFileName || item.fileName || ("No." + (index + 1));

    if (!id) {
      const error = "OCR保存IDがないため解析できません。";
      showResult(error);
      return { ok: false, name, error };
    }

    if (!options.silent) {
      showResult("単品専門解析中: " + name + "\n要確認の専門解析を実行しています。画像は送信しません。");
    }

    try {
      const res = await fetch("/api/payment-documents/ai-specialist/" + encodeURIComponent(id), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });

      const data = await res.json();

      if (!data.ok) {
        const error = data.error || data.message || "専門解析失敗";
        showResult({ ok: false, name, error, data });
        return { ok: false, name, error };
      }

      item.__aiDraft = data.draft || {};
      item.__visibleFieldLabels = data.visible_field_labels || (data.draft && data.draft.visible_field_labels) || [];
      item.__documentGroup = data.document_group || (data.draft && data.draft.document_group) || "";
      item.__aiSteps = data.ai_steps || [];

      const appliedCount = applySortingOnlyDraftToForm(item.__aiDraft);
      showVisibleFieldsOnly(item.__visibleFieldLabels);
      window.__lastAiDraftAppliedCount = appliedCount;

      renderSortingList();

      if (!options.silent) {
        showResult({
          ok: true,
          message: "単品専門解析が完了しました。画像はOpenAIへ送信していません。",
          fileName: name,
          document_group: item.__documentGroup,
          visible_field_labels: item.__visibleFieldLabels,
          appliedCount
        });
      }

      return {
        ok: true,
        name,
        document_group: item.__documentGroup,
        visible_field_labels: item.__visibleFieldLabels,
        appliedCount
      };
    } catch (error) {
      const message = error.message || String(error);
      showResult({ ok: false, name, error: message });
      return { ok: false, name, error: message };
    }
  }

  async function runSelectedAiDrafts() {
    const indexes = selectedSortingIndexes();

    if (!indexes.length) {
      showResult("まとめて専門解析する書類にチェックを入れてください。");
      return;
    }

    const results = [];
    let success = 0;
    let failed = 0;

    for (let i = 0; i < indexes.length; i++) {
      const index = indexes[i];
      const item = items[index];
      const name = item ? (item.originalFileName || item.fileName || ("No." + (index + 1))) : ("No." + (index + 1));

      showResult("まとめて専門解析中: " + (i + 1) + " / " + indexes.length + "\n" + name);

      const result = await runAiDraftForItemIndex(index, { silent: true });

      results.push(result);

      if (result && result.ok) {
        success++;
      } else {
        failed++;
      }
    }

    renderSortingList();

    showResult({
      ok: failed === 0,
      message: "まとめて専門解析が完了しました。最後に解析した書類を画面へ表示しています。",
      total: indexes.length,
      success,
      failed,
      results
    });
  }
/* HD_ORIGIN_PAYMENT_SORTING_LIST_FUNCTIONS_20260707_START */
  window.__checkedOcrImportIds = window.__checkedOcrImportIds || new Set();
  window.__expandedOcrImportIds = window.__expandedOcrImportIds || new Set();

  window.ocrImportIdOf = function(item) {
    if (!item) return "";
    return item.paymentDocumentOcrImportId || item.payment_document_ocr_import_id || item.ocrImportId || item.id || "";
  };

  window.firstText = function() {
    for (const value of arguments) {
      const text = String(value === null || value === undefined ? "" : value).trim();
      if (text) return text;
    }
    return "";
  };

  window.sortingLabelMap = {
    invoice: "請求書",
    bill: "請求書",
    purchase_invoice: "仕入請求",
    material_invoice: "材料仕入",
    subcontract_invoice: "外注請求",
    receipt: "領収書",
    store_receipt: "レシート",
    tax_payment: "税金",
    tax_notice: "納付書",
    public_payment: "公的支払",
    insurance_notice: "保険",
    lease_contract: "リース",
    contract: "契約",
    utility_bill: "公共料金",
    card_statement: "カード明細",
    credit_card_statement: "カード明細",
    delivery_note: "納品書",
    order: "注文書",
    purchase_order: "発注書",
    quotation: "見積書",
    estimate: "見積書",
    inspection: "検収書",
    mail_saved: "メール保存",
    payable: "買掛",
    accounts_payable: "買掛",
    unpaid: "未払",
    accrued_expense: "未払費用",
    expense: "経費",
    tax_public: "税金公的",
    card_payable: "カード未払",
    evidence_only: "照合用",
    reference: "照合用",
    needs_review: "要確認",
    other: "その他",
    high: "高",
    medium: "中",
    mid: "中",
    low: "低"
  };

  window.jpSortingLabel = function(value, fallback) {
    const raw = String(value || "").trim();
    if (!raw) return fallback || "未判定";

    const key = raw
      .replace(/[　\s]+/g, "_")
      .replace(/-+/g, "_")
      .toLowerCase();

    return window.sortingLabelMap[key] || raw;
  };

  window.detectSortingTheme = function(text) {
    const s = String(text || "").toLowerCase();

    if (!s) return "unknown";
    if (s.includes("要確認") || s.includes("needs_review") || s.includes("確認")) return "review";
    if (s.includes("税") || s.includes("公的") || s.includes("納付") || s.includes("tax")) return "tax";
    if (s.includes("カード") || s.includes("決済") || s.includes("card") || s.includes("square") || s.includes("paypay") || s.includes("stripe")) return "card";
    if (s.includes("保険") || s.includes("リース") || s.includes("契約") || s.includes("insurance") || s.includes("lease") || s.includes("contract")) return "contract";
    if (s.includes("買掛") || s.includes("仕入") || s.includes("材料") || s.includes("外注") || s.includes("purchase") || s.includes("payable")) return "invoice";
    if (s.includes("未払") || s.includes("accrued") || s.includes("unpaid")) return "unpaid";
    if (s.includes("経費") || s.includes("expense")) return "expense";
    if (s.includes("納品") || s.includes("注文") || s.includes("発注") || s.includes("見積") || s.includes("検収") || s.includes("delivery") || s.includes("quote") || s.includes("order")) return "reference";
    if (s.includes("領収") || s.includes("レシート") || s.includes("receipt")) return "expense";

    return "other";
  };

  window.pickDraftValue = function(draft, keys) {
    if (!draft || typeof draft !== "object") return "";

    for (const key of keys) {
      if (draft[key] !== undefined && draft[key] !== null && String(draft[key]).trim() !== "") {
        return draft[key];
      }
    }

    if (draft.fields && typeof draft.fields === "object") {
      for (const key of keys) {
        if (draft.fields[key] !== undefined && draft.fields[key] !== null && String(draft.fields[key]).trim() !== "") {
          return draft.fields[key];
        }
      }
    }

    return "";
  };

  window.buildSortingVisual = function(item) {
    const draft = item && item.__aiDraft ? item.__aiDraft : {};
    const group = window.firstText(item && item.__documentGroup, draft.document_group, draft.documentGroup);

    const kindRaw = window.pickDraftValue(draft, [
      "document_type_label",
      "document_type_name",
      "document_type_code",
      "documentType",
      "documentKind",
      "document_kind",
      "ai_document_kind",
      "draftAiDocumentKind"
    ]);

    const destinationRaw = window.pickDraftValue(draft, [
      "payment_destination_label",
      "payment_destination_name",
      "payment_destination_code",
      "destination",
      "destination_code",
      "paymentDestination",
      "ai_destination",
      "draftAiDestination"
    ]);

    const accountingRaw = window.pickDraftValue(draft, [
      "accounting_category_label",
      "accounting_category_name",
      "accounting_category_code",
      "payable_kind_label",
      "payable_kind_name",
      "payable_kind_code",
      "category",
      "accountingCategory"
    ]);

    const confidenceRaw = window.pickDraftValue(draft, [
      "ai_confidence",
      "confidence",
      "confidence_level",
      "draftAiConfidence"
    ]);

    const reasonRaw = window.pickDraftValue(draft, [
      "review_reason",
      "needs_review_reason",
      "confirmation_notes",
      "confirm_notes",
      "required_confirmation",
      "internal_memo",
      "ai_reason",
      "reason"
    ]);

    const kindLabel = window.jpSortingLabel(kindRaw || group, "未判定");
    const destinationLabel = window.jpSortingLabel(destinationRaw, "未判定");
    const accountingLabel = window.jpSortingLabel(accountingRaw, "");
    const confidenceLabel = window.jpSortingLabel(confidenceRaw, "");

    let theme = window.detectSortingTheme(destinationRaw || accountingRaw || kindRaw || group);

    const lowConfidence =
      String(confidenceRaw || "").toLowerCase().includes("low") ||
      String(confidenceRaw || "").includes("低");

    const needsReview =
      theme === "review" ||
      lowConfidence ||
      String(reasonRaw || "").includes("要確認") ||
      String(kindLabel || "").includes("要確認") ||
      String(destinationLabel || "").includes("要確認");

    if (needsReview) {
      theme = "review";
    }

    return {
      analyzed: !!(item && item.__aiDraft),
      theme,
      rowClass: "visual-row-" + theme,
      kindClass: "visual-chip visual-kind visual-chip-" + window.detectSortingTheme(kindRaw || group),
      destClass: "visual-chip visual-dest visual-chip-" + window.detectSortingTheme(destinationRaw || accountingRaw),
      categoryClass: "visual-chip visual-category visual-chip-" + window.detectSortingTheme(accountingRaw),
      confidenceClass: "visual-chip visual-confidence " + (lowConfidence ? "visual-chip-review" : "visual-chip-confidence"),
      kindLabel,
      destinationLabel,
      accountingLabel,
      confidenceLabel,
      needsReview,
      reasonRaw
    };
  };

  window.updateSelectedSortingSummary = function() {
    const summary = document.getElementById("selectedSortingSummary");
    if (!summary) return;

    const validIds = new Set((items || []).map(item => String(window.ocrImportIdOf(item) || "")).filter(Boolean));
    window.__checkedOcrImportIds = new Set(Array.from(window.__checkedOcrImportIds).filter(id => validIds.has(String(id))));
    window.__expandedOcrImportIds = new Set(Array.from(window.__expandedOcrImportIds).filter(id => validIds.has(String(id))));

    const analyzedCount = (items || []).filter(item => item && item.__aiDraft).length;
    const reviewCount = (items || []).filter(item => item && item.__aiDraft && window.buildSortingVisual(item).needsReview).length;

    summary.textContent =
      "選択: " + window.__checkedOcrImportIds.size + "件" +
      " / 解析済: " + analyzedCount + "件" +
      (reviewCount ? " / 要確認: " + reviewCount + "件" : "");
  };

  window.toggleSortingChecked = function(index, checked) {
    const item = items[index];
    const id = String(window.ocrImportIdOf(item) || "");

    if (!id) {
      window.updateSelectedSortingSummary();
      return;
    }

    if (checked) {
      window.__checkedOcrImportIds.add(id);
    } else {
      window.__checkedOcrImportIds.delete(id);
    }

    window.updateSelectedSortingSummary();
  };

  window.toggleSortingAccordion = function(index, event) {
    if (event) {
      event.stopPropagation();
    }

    const item = items[index];
    const id = String(window.ocrImportIdOf(item) || "");

    if (!id) return;

    const alreadyOpen = window.__expandedOcrImportIds.has(id);

    window.__expandedOcrImportIds.clear();

    if (!alreadyOpen) {
      window.__expandedOcrImportIds.add(id);
    }

    window.renderSortingList();
  };

  window.selectSortingSummary = function(index, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    selectedIndex = index;

    if (typeof selectItem === "function") {
      selectItem(index);
    }

    window.toggleSortingAccordion(index);
  };

  window.selectAllSortingItems = function() {
    (items || []).forEach(item => {
      const id = String(window.ocrImportIdOf(item) || "");
      if (id) window.__checkedOcrImportIds.add(id);
    });

    window.renderSortingList();
    window.updateSelectedSortingSummary();
  };

  window.clearSortingSelection = function() {
    window.__checkedOcrImportIds.clear();
    window.renderSortingList();
    window.updateSelectedSortingSummary();
  };

  window.selectedSortingIndexes = function() {
    return (items || [])
      .map((item, index) => ({ item, index, id: String(window.ocrImportIdOf(item) || "") }))
      .filter(row => row.id && window.__checkedOcrImportIds.has(row.id))
      .map(row => row.index);
  };

  window.renderSortingList = function() {
    const list = document.getElementById("list");

    if (!list) return;

    list.innerHTML = (items || []).map((item, index) => {
      const active = index === selectedIndex ? " active" : "";
      const name = item.originalFileName || item.fileName || "";
      const time = item.ocrAt ? formatJapanDateTime(item.ocrAt) : "";
      const id = String(window.ocrImportIdOf(item) || "");
      const checked = id && window.__checkedOcrImportIds.has(id) ? " checked" : "";
      const disabled = id ? "" : " disabled";
      const expanded = id && window.__expandedOcrImportIds.has(id);
      const visual = window.buildSortingVisual(item);
      const analyzedText = visual.analyzed ? "解析済" : "未解析";
      const reviewBadge = visual.needsReview ? `<span class="visual-chip visual-chip-review">要確認</span>` : "";
      const categoryBadge = visual.accountingLabel ? `<span class="${visual.categoryClass}">会計:${esc(visual.accountingLabel)}</span>` : "";
      const confidenceBadge = visual.confidenceLabel ? `<span class="${visual.confidenceClass}">信頼度:${esc(visual.confidenceLabel)}</span>` : "";
      const detailClass = expanded ? " sorting-accordion-detail open" : " sorting-accordion-detail";
      const toggleText = expanded ? "閉じる ▲" : "詳細 ▼";
      const reasonText = visual.reasonRaw ? esc(visual.reasonRaw) : "なし";

      return `
        <div class="sorting-item-card ${visual.rowClass}${active}${expanded ? " expanded" : ""}">
          <div class="sorting-accordion-head">
            <input
              type="checkbox"
              class="sorting-check"
              aria-label="仕分け対象に選択"
              data-index="${index}"
              ${checked}
              ${disabled}
              onclick="event.stopPropagation()"
              onchange="toggleSortingChecked(${index}, this.checked)"
            >
            <button type="button" class="sorting-summary-button item${active}" onclick="selectSortingSummary(${index}, event)">
              <span class="sorting-summary-main">
                <span class="no">${index + 1}</span>
                <span class="name">${esc(name)}</span>
              </span>
              <span class="sorting-summary-chips">
                <span class="${visual.kindClass}">種類:${esc(visual.kindLabel)}</span>
                
                ${reviewBadge}
                <span class="visual-chip visual-chip-status">${esc(analyzedText)}</span>
              </span>
            </button>
            <button type="button" class="sorting-accordion-toggle" onclick="toggleSortingAccordion(${index}, event)">${toggleText}</button>
          </div>

          <div class="${detailClass}">
            <div class="sorting-detail-grid">
              <div><span class="detail-label">OCR日時</span><span class="detail-value">${esc(time || "不明")}</span></div>
              <div><span class="detail-label">種類</span><span class="${visual.kindClass}">${esc(visual.kindLabel)}</span></div>
              
              <div><span class="detail-label">会計候補</span>${categoryBadge || `<span class="detail-value">未判定</span>`}</div>
              <div><span class="detail-label">AI信頼度</span>${confidenceBadge || `<span class="detail-value">未判定</span>`}</div>
              <div><span class="detail-label">要確認理由</span><span class="detail-value">${reasonText}</span></div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    window.updateSelectedSortingSummary();
  };

  window.applySortingAiResultToItem = function(item, data) {
    if (!item || !data) return;

    item.__aiDraft = data.draft || {};
    item.__visibleFieldLabels = data.visible_field_labels || (data.draft && data.draft.visible_field_labels) || [];
    item.__documentGroup = data.document_group || (data.draft && data.draft.document_group) || "";
    item.__aiSteps = data.ai_steps || [];
    item.__aiRawResult = data;
  };

  window.runAiDraftForItemIndex = async function(index, options = {}) {
    if (!Array.isArray(items) || index < 0 || index >= items.length) {
      showResult("解析する書類が見つかりません。");
      return { ok: false, error: "解析する書類が見つかりません。" };
    }

    selectedIndex = index;
    selectItem(index);

    const item = items[index];
    const id = String(window.ocrImportIdOf(item) || "");
    const name = item.originalFileName || item.fileName || ("No." + (index + 1));

    if (!id) {
      const error = "OCR保存IDがないため解析できません。";
      showResult(error);
      return { ok: false, name, error };
    }

    if (!options.silent) {
      showResult("単品専門解析中: " + name + "\nOCR本文と1回目仕分け結果を元に、要確認の専門解析をしています。");
    }

    try {
      const res = await fetch("/api/payment-documents/ai-specialist/" + encodeURIComponent(id), {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        }
      });

      const data = await res.json();

      if (!data.ok) {
        const error = data.error || data.message || "専門解析失敗";
        showResult({ ok: false, name, error, data });
        return { ok: false, name, error };
      }

      window.applySortingAiResultToItem(item, data);

      if (typeof applySortingOnlyDraftToForm === "function") { const appliedCount = applySortingOnlyDraftToForm(item.__aiDraft); window.__lastAiDraftAppliedCount = appliedCount; }

      if (typeof window.hdOriginSpecialistAutoSaveNow === "function") {
        try {
          await window.hdOriginSpecialistAutoSaveNow("analysis", { ocrImportId: id, item: item, analysisResult: data });
        } catch (saveError) {
          const saveMessage =
            saveError && saveError.message
              ? saveError.message
              : String(saveError);

          showResult(
            "専門解析には成功しましたが、DB自動保存に失敗しました。\n" +
            saveMessage
          );

          return {
            ok: false,
            analysisOk: true,
            saveOk: false,
            name,
            error: saveMessage
          };
        }
      }

      if (typeof showVisibleFieldsOnly === "function") {
        showVisibleFieldsOnly(item.__visibleFieldLabels || []);
      }

      window.__expandedOcrImportIds.clear();
      window.__expandedOcrImportIds.add(id);

      window.renderSortingList();

      const visual = window.buildSortingVisual(item);

      if (!options.silent) {
        showResult(
          "単品専門解析が完了しました。\n" +
          "種類: " + visual.kindLabel + "\n" +
          "行き先: " + visual.destinationLabel + "\n" +
          (visual.accountingLabel ? "会計候補: " + visual.accountingLabel + "\n" : "") +
          (visual.confidenceLabel ? "AI信頼度: " + visual.confidenceLabel + "\n" : "") +
          (visual.needsReview ? "要確認: あり\n" : "要確認: なし\n")
        );
      }

      return {
        ok: true,
        name,
        kind: visual.kindLabel,
        destination: visual.destinationLabel,
        accounting: visual.accountingLabel,
        confidence: visual.confidenceLabel,
        needsReview: visual.needsReview
      };
    } catch (error) {
      const message = error.message || String(error);
      showResult({ ok: false, name, error: message });
      return { ok: false, name, error: message };
    }
  };

  window.runSelectedAiDrafts = async function() {
    const indexes = window.selectedSortingIndexes();

    if (!indexes.length) {
      showResult("まとめて専門解析する書類にチェックを入れてください。");
      return;
    }

    const results = [];
    let success = 0;
    let failed = 0;
    let review = 0;

    for (let i = 0; i < indexes.length; i++) {
      const index = indexes[i];
      const item = items[index] || {};
      const name = item.originalFileName || item.fileName || ("No." + (index + 1));

      showResult("まとめて専門解析中: " + (i + 1) + " / " + indexes.length + "\n" + name);

      const result = await window.runAiDraftForItemIndex(index, { silent: true });

      results.push(result);

      if (result && result.ok) {
        success++;
        if (result.needsReview) review++;
      } else {
        failed++;
      }

      window.renderSortingList();
    }

    window.__expandedOcrImportIds.clear();
    window.renderSortingList();

    const grouped = results
      .filter(row => row && row.ok)
      .reduce((acc, row) => {
        const key = row.destination || "未判定";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

    const groupedText = Object.keys(grouped)
      .map(key => key + ": " + grouped[key] + "件")
      .join("\n");

    showResult(
      "まとめて専門解析が完了しました。\n" +
      "対象: " + indexes.length + "件\n" +
      "成功: " + success + "件\n" +
      "失敗: " + failed + "件\n" +
      "要確認: " + review + "件\n\n" +
      "行き先別:\n" +
      (groupedText || "なし")
    );
  };
/* HD_ORIGIN_PAYMENT_SORTING_LIST_FUNCTIONS_20260707_END */
/* HD_ORIGIN_SPECIALIST_UTILITY_COMMUNICATION_FILTER_GPT2_AFTER_20260708_START */
  window.hdOriginUtilityCommunicationSpecialistFilter = function(allItems) {
    const expectedAnalysisSystemCode = "bank_transaction_analysis";

    function textValue(value) {
      return String(value || "").trim();
    }

    function objectValue(value) {
      return (
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
      )
        ? value
        : {};
    }

    function analysisSystemCodeOf(item) {
      const source = objectValue(item);

      const latest = objectValue(
        source.latestSortingDraft ||
        source.latest_sorting_draft
      );

      const saved = objectValue(
        source.__savedSortingDraft ||
        source.savedSortingDraft ||
        source.sortingDraft ||
        source.sorting_draft
      );

      const draft = objectValue(
        source.__aiDraft ||
        source.aiDraft ||
        source.draft
      );

      const sortResult = objectValue(
        source.sortResult ||
        source.sort_result
      );

      const candidates = [
        latest.analysisSystemCode,
        latest.analysis_system_code,

        saved.analysisSystemCode,
        saved.analysis_system_code,

        draft.analysisSystemCode,
        draft.analysis_system_code,

        sortResult.analysisSystemCode,
        sortResult.analysis_system_code,

        source.analysisSystemCode,
        source.analysis_system_code
      ];

      for (const candidate of candidates) {
        const code = textValue(candidate);

        if (code) {
          return code;
        }
      }

      return "";
    }

    return (
      Array.isArray(allItems)
        ? allItems
        : []
    ).filter(function(item) {
      return (
        analysisSystemCodeOf(item) ===
        expectedAnalysisSystemCode
      );
    });
  };
  async function loadItems() {
    const summary = document.getElementById("summary");
    const list = document.getElementById("list");

    summary.textContent = "読込中...";
    list.innerHTML = "";
    selectedIndex = -1;

    document.getElementById("ocrText").value = "";
    setBottomOcrText("");
    clearDraftFields();
    setInitialAiOnlyView();

    try {
      const res = await fetch("/api/payment-documents/review-items");
      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || "読込失敗");
      }

      const allItems = data.items || [];
      items = window.hdOriginUtilityCommunicationSpecialistFilter(allItems);

      summary.textContent =
        "要確認専門解析対象: " + items.length + "件 / 全体: " + allItems.length + "件";

      if (!items.length) {
        list.innerHTML = '<div class="empty">要確認の対象書類がありません。仕分けページで1回目仕分けを保存してください。</div>';
        scheduleDocumentPreviewFit();
      return;
      }

      window.renderSortingList();
      window.updateSelectedSortingSummary();
    } catch (error) {
      summary.textContent = "読込エラー: " + (error.message || String(error));
    }
  }

  function setBottomOcrText(value) {
    const bottom = document.getElementById("bottomOcrText");
    if (bottom) {
      bottom.value = value || "";
    }
  }
  function clearDraftFields() {
    document.querySelectorAll(".draft-field").forEach(field => {
      field.value = "";
    });
    resetCompactEvidenceInfo();
    showResult("");
  }

  function setDraftValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;

    if (value === null || value === undefined) {
      el.value = "";
      scheduleDocumentPreviewFit();
      return;
    }

    el.value = String(value);
  }

  function formatDraftBytes(bytes) {
    const n = Number(bytes) || 0;

    if (n >= 1024 * 1024) {
      return (n / 1024 / 1024).toFixed(1) + " MB";
    }

    if (n >= 1024) {
      return Math.round(n / 1024) + " KB";
    }

    return n ? n + " B" : "";
  }

  function setCompactEvidenceText(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    const text = value === null || value === undefined || value === "" ? "-" : String(value);
    el.textContent = text;
  }

  function resetCompactEvidenceInfo() {
    setCompactEvidenceText("compactEvidenceFileName", "未選択");
    setCompactEvidenceText("compactEvidenceOcrStatus", "-");
    setCompactEvidenceText("compactEvidenceSavedStatus", "-");
    setCompactEvidenceText("compactEvidenceDuplicateStatus", "-");
  }

  function updateCompactEvidenceInfo(item) {
    if (!item) {
      resetCompactEvidenceInfo();
      scheduleDocumentPreviewFit();
      return;
    }

    const savedStatus =
      String(item.processStatus || item.saveStatus || item.savedStatus || "")
        .toLowerCase() === "saved"
        ? "保存済み"
        : "未保存";

    const duplicateStatus = item.duplicateOfFileName
      ? "重複元: " + item.duplicateOfFileName
      : "なし";

    setCompactEvidenceText("compactEvidenceFileName", item.originalFileName || item.fileName || "未選択");
    setCompactEvidenceText("compactEvidenceOcrStatus", item.ocrStatus || "-");
    setCompactEvidenceText("compactEvidenceSavedStatus", savedStatus);
    setCompactEvidenceText("compactEvidenceDuplicateStatus", duplicateStatus);
  }
  function fillDraftFromItem(item) {
    if (!item) return;

    updateCompactEvidenceInfo(item);

    setDraftValue("draftAiDocumentKind", item.documentType || "");
    setDraftValue("draftDestination", item.destination || "");
    setDraftValue("draftAiDestination", item.destination || "");
    setDraftValue("draftIssuer", item.vendorName || "");
    setDraftValue("draftVendorName", item.vendorName || "");
    setDraftValue("draftVendorMasterCandidate", item.vendorName || "");
    setDraftValue("draftMemo", item.note || "");
    setDraftValue("draftEmailSubject", item.emailSubject || "");
    setDraftValue("draftEmailFrom", item.emailFrom || "");

    setDraftValue("draftOriginalFileName", item.originalFileName || "");
    setDraftValue("draftSavedFileName", item.fileName || "");
    setDraftValue("draftMimeType", item.mimeType || "");
    setDraftValue("draftFileSize", formatDraftBytes(item.sizeBytes));
    setDraftValue("draftSha256", item.sha256 || "");
    setDraftValue("draftOcrStatus", item.ocrStatus || "");
    setDraftValue("draftOcrAt", item.ocrAt ? formatJapanDateTime(item.ocrAt) : "");
    setDraftValue("draftSavedStatus", item.processStatus || item.saveStatus || item.savedStatus || "");
    setDraftValue("draftSavedAt", item.savedAt ? formatJapanDateTime(item.savedAt) : "");
    setDraftValue("draftDuplicateStatus", item.duplicateOfFileName ? ("重複元: " + item.duplicateOfFileName) : "");
  }

  function selectItem(index) {
    selectedIndex = index;
    const item = items[index];

    document.querySelectorAll(".item").forEach((el, i) => {
      el.classList.toggle("active", i === index);
    });

    const ocrValue = item.ocrRawText || item.ocrTextPreview || "";
    document.getElementById("ocrText").value = ocrValue;
    resetDocumentPreviewRotation(false);
    setDocumentPreview(item);
    clearDraftFields();
    setInitialAiOnlyView();
    fillDraftFromItem(item);
    // DB専用review-itemsの保存済み下書きがあれば、単品専門解析と同じ項目表示へ戻す
    if (item && item.__aiDraft) {
      if (typeof applySortingOnlyDraftToForm === "function") {
        applySortingOnlyDraftToForm(item.__aiDraft);
      } else if (typeof applyAiDraftToFormHardDebug === "function") {
        applyAiDraftToFormHardDebug(item.__aiDraft);
      }

      if (typeof showVisibleFieldsOnly === "function") {
        showVisibleFieldsOnly(item.__visibleFieldLabels || []);
      }
    }

    setBottomOcrText(ocrValue);

    showResult("原本画像とOCR本文を読み込みました。");
  }

  function showPlanned(name) {
    const item = selectedIndex >= 0 ? items[selectedIndex] : null;

    if (!item) {
      showResult("先にOCR済み書類を選択してください。");
      scheduleDocumentPreviewFit();
      return;
    }

    showResult(
      name + "は後工程です。\n" +
      "このページでは画面骨格のみ作成済みです。\n" +
      "次にDBを作って、AI候補と人間修正下書きを保存できるようにします。"
    );
  }

  async function restartServer() {
    const ok = confirm("サーバーを再起動しますか？\n終了前バックアップありの再起動APIを呼びます。");

    if (!ok) return;

    showResult("サーバー再起動を要求中です。");

    try {
      const res = await fetch("/api/system/restart-with-backup", {
        method: "POST"
      });

      const data = await res.json();
      showResult(JSON.stringify(data, null, 2));
    } catch (error) {
      showResult("再起動要求後に接続が切れた可能性があります。\n" + (error.message || String(error)));
    }
  }
/* PAYMENT_DOCUMENT_REVIEW_MASTER_SELECTS_20260707_START */
  let draftMasters = {};

  const DRAFT_MASTER_FIELDS = [
    { id: "draftAiDocumentKind", type: "document_types", label: "書類区分" },
    { id: "draftAiDestination", type: "payment_destinations", label: "処理先" },
    { id: "draftDestination", type: "payment_destinations", label: "処理先" },
    { id: "draftAccountingCategory", type: "accounting_categories", label: "会計区分" },
    { id: "draftPayableKind", type: "payable_kinds", label: "未払種別" },

    { id: "draftEvidenceType", type: "evidence_types", label: "証憑区分" },
    { id: "draftVendorMasterCandidate", type: "vendors", label: "支払先" },
    { id: "draftPaymentMethod", type: "payment_methods", label: "支払方法" },
    { id: "draftPaymentMethodMaster", type: "payment_methods", label: "支払方法" },
    { id: "draftAccountTitle", type: "account_titles", label: "勘定科目" },
    { id: "draftTaxCategory", type: "tax_categories", label: "税区分" },
    { id: "draftInvoiceType", type: "invoice_types", label: "インボイス区分" },
    { id: "draftTargetPerson", type: "target_people", label: "対象者" },
    { id: "draftPurpose", type: "purposes", label: "目的" },
    { id: "draftProject", type: "projects", label: "案件" },
    { id: "draftDepartment", type: "departments", label: "部門" }
  ];

  function normalizeMasterText(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function getDraftMasterRows(type) {
    const source = draftMasters || {};

    if (Array.isArray(source[type])) {
      return source[type];
    }

    if (source.masters && Array.isArray(source.masters[type])) {
      return source.masters[type];
    }

    if (Array.isArray(source.items)) {
      return source.items.filter(row => row && row.type === type);
    }

    if (Array.isArray(source)) {
      return source.filter(row => row && row.type === type);
    }

    return [];
  }

  function masterRowName(row) {
    if (!row) return "";

    return String(
      row.name ||
      row.master_name ||
      row.account_name ||
      row.method_name ||
      row.tax_name ||
      row.vendor_name ||
      row.target_person_name ||
      row.purpose_name ||
      row.project_name ||
      row.department_name ||
      row.invoice_type_name ||
      row.evidence_type_name ||
      ""
    ).trim();
  }

  function masterRowValue(row) {
    if (!row) return "";

    const id =
      row.id ??
      row.account_title_id ??
      row.payment_method_id ??
      row.tax_category_id ??
      row.vendor_id ??
      row.target_person_id ??
      row.purpose_id ??
      row.project_id ??
      row.department_id ??
      row.invoice_type_id ??
      row.evidence_type_id ??
      "";

    return String(id || masterRowName(row) || "");
  }

  function masterRowLabel(row) {
    const name = masterRowName(row);

    if (!name) {
      return "";
    }

    if (row.account_code) {
      return String(row.account_code) + " " + name;
    }

    if (row.tax_rate !== undefined && row.tax_rate !== null && row.tax_rate !== "") {
      return name + "（" + row.tax_rate + "%）";
    }

    return name;
  }

  function populateOneMasterSelect(select) {
    if (!select) return;

    const type = select.dataset.masterType || "";
    const label = select.dataset.masterLabel || type || "マスタ";
    const rows = getDraftMasterRows(type).filter(row => row && row.is_active !== false);

    const previousValue = select.value;
    select.innerHTML = "";

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = label + "を選択";
    select.appendChild(empty);

    if (!rows.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = label + "マスタ未接続または未登録";
      option.disabled = false;
      select.appendChild(option);
      select.classList.add("master-missing");
      select.disabled = false;
      scheduleDocumentPreviewFit();
      return;
    }

    select.disabled = false;
    select.classList.remove("master-missing");

    for (const row of rows) {
      const name = masterRowName(row);
      const value = masterRowValue(row);
      const labelText = masterRowLabel(row);

      if (!name || !value) {
        continue;
      }

      const option = document.createElement("option");
      option.value = value;
      option.dataset.name = name;
      option.textContent = labelText;
      select.appendChild(option);
    }

    if (previousValue) {
      setDraftMasterSelectValue(select, previousValue);
    }
  }

  function populateDraftMasterSelects() {
    document.querySelectorAll("select[data-master-type]").forEach(populateOneMasterSelect);
  }

  function setDraftMasterSelectValue(select, value) {
    const raw = String(value || "").trim();

    if (!raw) {
      select.value = "";
      scheduleDocumentPreviewFit();
      return;
    }

    const rawNorm = normalizeMasterText(raw);
    const options = Array.from(select.options || []);

    const match = options.find(option => {
      return (
        String(option.value || "") === raw ||
        normalizeMasterText(option.textContent) === rawNorm ||
        normalizeMasterText(option.dataset.name) === rawNorm
      );
    });

    select.value = match ? match.value : "";
  }

  function setDraftValue(id, value) {
    const el = document.getElementById(id);

    if (!el) {
      scheduleDocumentPreviewFit();
      return;
    }

    if (el.tagName === "SELECT") {
      setDraftMasterSelectValue(el, value);
      scheduleDocumentPreviewFit();
      return;
    }

    if (value === null || value === undefined) {
      el.value = "";
      scheduleDocumentPreviewFit();
      return;
    }

    el.value = String(value);
  }

  async function loadDraftMasters() {
    try {
      const res = await fetch("/api/expenses/masters");
      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || "マスタ読込失敗");
      }

      draftMasters = data.masters || data.items || data;
      populateDraftMasterSelects();
    } catch (error) {
      draftMasters = {};
      populateDraftMasterSelects();

      const message =
        "マスタ読込に失敗しました。\n" +
        "区分系は固定値にせず、マスタ接続後に選択できるようにしています。\n" +
        (error.message || String(error));

      showResult(message);
    }
  }

/* PAYMENT_DOCUMENT_REVIEW_MASTER_API_20260707_START */
  function masterRowName(row) {
    if (!row) return "";

    return String(
      row.name ||
      row.master_name ||
      row.account_name ||
      row.method_name ||
      row.tax_name ||
      row.vendor_name ||
      row.target_person_name ||
      row.purpose_name ||
      row.project_name ||
      row.department_name ||
      row.invoice_type_name ||
      row.evidence_type_name ||
      row.document_type_name ||
      row.payment_destination_name ||
      row.accounting_category_name ||
      row.payable_kind_name ||
      row.payment_source_type_name ||
      ""
    ).trim();
  }

  function masterRowCode(row) {
    if (!row) return "";

    return String(
      row.account_code ||
      row.payment_method_code ||
      row.tax_category_code ||
      row.invoice_type_code ||
      row.evidence_type_code ||
      row.document_type_code ||
      row.payment_destination_code ||
      row.accounting_category_code ||
      row.payable_kind_code ||
      row.payment_source_type_code ||
      ""
    ).trim();
  }

  function masterRowValue(row) {
    if (!row) return "";

    const id =
      row.id ??
      row.account_title_id ??
      row.payment_method_id ??
      row.tax_category_id ??
      row.vendor_id ??
      row.target_person_id ??
      row.purpose_id ??
      row.project_id ??
      row.department_id ??
      row.invoice_type_id ??
      row.evidence_type_id ??
      row.document_type_id ??
      row.payment_destination_id ??
      row.accounting_category_id ??
      row.payable_kind_id ??
      row.payment_source_type_id ??
      "";

    return String(id || masterRowName(row) || "");
  }

  function masterRowLabel(row) {
    const name = masterRowName(row);

    if (!name) {
      return "";
    }

    if (row.account_code) {
      return String(row.account_code) + " " + name;
    }

    if (row.tax_rate !== undefined && row.tax_rate !== null && row.tax_rate !== "") {
      return name + "（" + row.tax_rate + "%）";
    }

    return name;
  }

  function populateOneMasterSelect(select) {
    if (!select) return;

    const type = select.dataset.masterType || "";
    const label = select.dataset.masterLabel || type || "マスタ";
    const rows = getDraftMasterRows(type).filter(row => row && row.is_active !== false);

    const previousValue = select.value;
    select.innerHTML = "";

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = label + "を選択";
    select.appendChild(empty);

    if (!rows.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = label + "マスタ未接続または未登録";
      option.disabled = false;
      select.appendChild(option);

      select.classList.add("master-missing");
      select.disabled = false;
      scheduleDocumentPreviewFit();
      return;
    }

    select.disabled = false;
    select.classList.remove("master-missing");

    for (const row of rows) {
      const name = masterRowName(row);
      const value = masterRowValue(row);
      const labelText = masterRowLabel(row);
      const code = masterRowCode(row);

      if (!name || !value) {
        continue;
      }

      const option = document.createElement("option");
      option.value = value;
      option.dataset.name = name;

      if (code) {
        option.dataset.code = code;
      }

      option.textContent = labelText;
      select.appendChild(option);
    }

    if (previousValue) {
      setDraftMasterSelectValue(select, previousValue);
    }
  }

  function setDraftMasterSelectValue(select, value) {
    const raw = String(value || "").trim();

    if (!raw) {
      select.value = "";
      scheduleDocumentPreviewFit();
      return;
    }

    const rawNorm = normalizeMasterText(raw);
    const options = Array.from(select.options || []);

    const match = options.find(option => {
      return (
        String(option.value || "") === raw ||
        normalizeMasterText(option.textContent) === rawNorm ||
        normalizeMasterText(option.dataset.name) === rawNorm ||
        normalizeMasterText(option.dataset.code) === rawNorm
      );
    });

    select.value = match ? match.value : "";
  }

  async function fetchDraftMasterRows(type) {
    const res = await fetch("/api/masters?type=" + encodeURIComponent(type), {
      cache: "no-store"
    });

    const data = await res.json();

    if (!data.ok) {
      throw new Error(type + ": " + (data.error || "マスタ読込失敗"));
    }

    return data.rows || data.items || data.masters || [];
  }

  async function loadDraftMasters() {
    const types = Array.from(new Set(
      DRAFT_MASTER_FIELDS
        .map(field => field.type)
        .filter(Boolean)
    ));

    const nextMasters = {};
    const errors = [];

    for (const type of types) {
      try {
        nextMasters[type] = await fetchDraftMasterRows(type);
      } catch (error) {
        nextMasters[type] = [];
        errors.push(error.message || String(error));
      }
    }

    draftMasters = nextMasters;
    populateDraftMasterSelects();

    if (errors.length) {
      showResult(
        "一部のマスタを読み込めませんでした。\n" +
        "固定optionにはせず、マスタ接続後に選択できる形を維持しています。\n\n" +
        errors.join("\n")
      );
    }
  }
/* PAYMENT_DOCUMENT_REVIEW_MASTER_API_20260707_END */
/* PAYMENT_DOCUMENT_REVIEW_MASTER_EMPTY_STATUS_20260707_START */
  let draftMasterLoadStatus = {};

  function populateOneMasterSelect(select) {
    if (!select) return;

    const type = select.dataset.masterType || "";
    const label = select.dataset.masterLabel || type || "マスタ";
    const rows = getDraftMasterRows(type).filter(row => row && row.is_active !== false);
    const previousValue = select.value;

    select.innerHTML = "";

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = label + "を選択";
    select.appendChild(empty);

    select.disabled = false;
    select.classList.remove("master-missing");
    select.classList.remove("master-empty");

    if (!rows.length) {
      const option = document.createElement("option");
      option.value = "";

      if (draftMasterLoadStatus[type] === false) {
        option.textContent = label + "マスタ接続エラー";
        select.classList.add("master-missing");
      } else {
        option.textContent = label + "マスタ未登録（接続済み）";
        select.classList.add("master-empty");
      }

      option.disabled = false;
      select.appendChild(option);
      select.value = "";
      scheduleDocumentPreviewFit();
      return;
    }

    for (const row of rows) {
      const name = masterRowName(row);
      const value = masterRowValue(row);
      const labelText = masterRowLabel(row);
      const code = masterRowCode(row);

      if (!name || !value) {
        continue;
      }

      const option = document.createElement("option");
      option.value = value;
      option.dataset.name = name;

      if (code) {
        option.dataset.code = code;
      }

      option.textContent = labelText;
      select.appendChild(option);
    }

    if (previousValue) {
      setDraftMasterSelectValue(select, previousValue);
    }
  }

  async function loadDraftMasters() {
    const types = Array.from(new Set(
      DRAFT_MASTER_FIELDS
        .map(field => field.type)
        .filter(Boolean)
    ));

    const nextMasters = {};
    const nextStatus = {};
    const errors = [];

    for (const type of types) {
      try {
        nextMasters[type] = await fetchDraftMasterRows(type);
        nextStatus[type] = true;
      } catch (error) {
        nextMasters[type] = [];
        nextStatus[type] = false;
        errors.push(type + ": " + (error.message || String(error)));
      }
    }

    draftMasters = nextMasters;
    draftMasterLoadStatus = nextStatus;

    populateDraftMasterSelects();

    if (errors.length) {
      showResult(
        "一部のマスタを読み込めませんでした。\n" +
        "接続できたが未登録のマスタは、未接続ではなく未登録として表示します。\n\n" +
        errors.join("\n")
      );
    }
  }
/* PAYMENT_DOCUMENT_REVIEW_MASTER_EMPTY_STATUS_20260707_END */
  async function initPaymentDocumentReview() {
    await loadDraftMasters();
    await loadItems();
  }
/* PAYMENT_DOCUMENT_REVIEW_MASTER_SELECTS_20260707_END */
  initPaymentDocumentReview();
