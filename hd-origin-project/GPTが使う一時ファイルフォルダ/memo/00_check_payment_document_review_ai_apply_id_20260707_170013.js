
let items = [];
  let selectedIndex = -1;

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
    document.getElementById("result").textContent = message || "";
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

    target.style.width = displayWidth + "px";
    target.style.height = displayHeight + "px";
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
      setDraftMasterSelectValue(el, text);
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
      setDraftMasterSelectValue(el, text);
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
    if (setById("draftDocumentType", draft.document_type_code || fields["書類区分"] || fields["書類種別"])) appliedCount++;
    if (setById("draftPaymentDestination", draft.payment_destination_code || fields["処理先"])) appliedCount++;
    if (setById("draftAccountingCategory", draft.accounting_category_code || fields["会計区分"])) appliedCount++;
    if (setById("draftPayableKind", draft.payable_kind_code || fields["未払種別"])) appliedCount++;
    if (setById("draftPaymentSourceType", draft.source_type_code || fields["入手元区分"])) appliedCount++;

    // AI判定サマリー
    if (draft.ai_summary) {
      if (setById("draftAiDocumentKind", draft.ai_summary.document_kind || fields["書類種別"])) appliedCount++;
      if (setById("draftAiDestination", draft.ai_summary.destination || fields["処理先"])) appliedCount++;
      if (setById("draftAiPaymentTarget", draft.ai_summary.payment_target || fields["支払対象"])) appliedCount++;
      if (setById("draftAiPayableTarget", draft.ai_summary.payable_target || fields["未払登録対象"])) appliedCount++;
      if (setById("draftAiExpenseTarget", draft.ai_summary.expense_target || fields["経費登録対象"])) appliedCount++;
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
  async function runAiDraftFromSelectedOcr() {
    const id = selectedOcrImportId();

    if (!id) {
      showResult("左リストからDB保存済みOCRを選択してください。");
      return;
    }

    showResult("OCR本文だけをOpenAIへ送信してAI候補を作成しています。画像は送信しません。");

    try {
      const res = await fetch("/api/payment-documents/ai-draft/" + encodeURIComponent(String(id)), {
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

      const appliedCount = applyAiDraftToForm(data.draft);

      showResult({
        ok: true,
        message: "AI候補を右側の下書き欄へ反映しました。画像はOpenAIへ送信していません。反映件数: " + appliedCount + "件",
        image_used: data.image_used,
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

    for (const [label, value] of Object.entries(fields)) {
      if (setFieldByLabel(label, value)) {
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
  async function loadItems() {
    const summary = document.getElementById("summary");
    const list = document.getElementById("list");

    summary.textContent = "読込中...";
    list.innerHTML = "";
    selectedIndex = -1;

    document.getElementById("ocrText").value = "";
    clearDraftFields();

    try {
      const res = await fetch("/api/payment-documents/ocr-imports");
      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || "読込失敗");
      }

      const allItems = data.items || [];
      items = allItems.filter(hasOcr);

      summary.textContent =
        "OCR済み: " + items.length + "件 / 全体: " + allItems.length + "件";

      if (!items.length) {
        list.innerHTML = '<div class="empty">DB保存済みOCRがありません。OCR取込画面でOCR後、保存してください。</div>';
        scheduleDocumentPreviewFit();
      return;
      }

      list.innerHTML = items.map((item, index) => {
        const active = index === selectedIndex ? " active" : "";
        const name = item.originalFileName || item.fileName;
        const time = item.ocrAt ? formatJapanDateTime(item.ocrAt) : "";

        return `
          <button class="item${active}" onclick="selectItem(${index})">
            <span class="no">${index + 1}</span>
            <span class="name">${esc(name)}</span>
            <span class="time">${esc(time)}</span>
          </button>
        `;
      }).join("");
    } catch (error) {
      summary.textContent = "読込エラー: " + (error.message || String(error));
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
      item.saveStatus ||
      item.savedStatus ||
      (item.evidenceSaved || item.ocrSaved ? "保存済み" : "未保存");

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

    setDraftValue("draftDocumentType", item.documentType || "");
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
    setDraftValue("draftSavedStatus", item.saveStatus || item.savedStatus || "");
    setDraftValue("draftSavedAt", item.savedAt ? formatJapanDateTime(item.savedAt) : "");
    setDraftValue("draftDuplicateStatus", item.duplicateOfFileName ? ("重複元: " + item.duplicateOfFileName) : "");
  }

  function selectItem(index) {
    selectedIndex = index;
    const item = items[index];

    document.querySelectorAll(".item").forEach((el, i) => {
      el.classList.toggle("active", i === index);
    });

    document.getElementById("ocrText").value = item.ocrRawText || item.ocrTextPreview || "";
    resetDocumentPreviewRotation(false);
    setDocumentPreview(item);
    clearDraftFields();
    fillDraftFromItem(item);

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
    { id: "draftDocumentType", type: "document_types", label: "書類区分" },
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