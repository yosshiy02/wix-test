
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
    const item = selectedItem();

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

      applyAiDraftToForm(data.draft);

      showResult({
        ok: true,
        message: "AI候補を右側の下書き欄へ反映しました。画像はOpenAIへ送信していません。",
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