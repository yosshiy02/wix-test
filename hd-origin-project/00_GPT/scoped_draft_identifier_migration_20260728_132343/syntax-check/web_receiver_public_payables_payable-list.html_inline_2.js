
let masters = {};
let currentItems = [];
let selectedPayableId = null;
function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function money(value) {
  if (value === null || value === undefined || value === "") {
    return "0";
  }
  const original = String(value).trim();
  if (original === "") {
    return "0";
  }
  const raw = original.replace(/,/g, "");
  const match = raw.match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!match) {
    const n = Number(raw);
    return Number.isFinite(n)
      ? n.toLocaleString("ja-JP", { maximumFractionDigits: 20 })
      : original;
  }
  const sign = match[1] || "";
  const integerPart = match[2] || "0";
  const decimalPart = match[3];
  const integerText = Number(sign + integerPart).toLocaleString("ja-JP");
  if (!decimalPart || /^0+$/.test(decimalPart)) {
    return integerText;
  }
  return integerText + "." + decimalPart;
}function num(value) {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function showResult(data) {
  document.getElementById("result").textContent =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);
}
async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error("JSON解析失敗: " + text.slice(0, 300));
  }
  if (!res.ok || !data.ok) {
    throw new Error(data.error || ("HTTP " + res.status));
  }
  return data;
}
function todayIso() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function dateOnly(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}
function statusLabel(value) {
  const map = {
    analysis: "下書き",
    confirmed: "未払確定",
    partially_paid: "一部支払",
    paid: "支払済み",
    void: "無効"
  };
  return map[value] || value || "";
}
function documentTypeLabel(value) {
  const map = {
    invoice: "請求書",
    delivery_note: "納品書",
    statement: "明細書",
    credit_note: "値引・返品",
    other: "その他"
  };

  return map[value] || value || "";
}
function fillSelect(id, items, idKey, nameKey) {
  const select = document.getElementById(id);
  if (!select) return;
  let html = '<option value="">選択</option>';
  for (const item of items || []) {
    html += `<option value="${esc(item[idKey])}">${esc(item[nameKey])}</option>`;
  }
  select.innerHTML = html;
}
function accountOptions(selectedValue = "") {
  let html = '<option value="">選択</option>';
  for (const item of masters.account_titles || []) {
    const selected = String(item.account_title_id) === String(selectedValue) ? "selected" : "";
    html += `<option value="${esc(item.account_title_id)}" ${selected}>${esc(item.account_name)}</option>`;
  }
  return html;
}
function taxOptions(selectedValue = "") {
  let html = '<option value="">選択</option>';
  for (const item of masters.tax_categories || []) {
    const selected = String(item.tax_category_id) === String(selectedValue) ? "selected" : "";
    html += `<option value="${esc(item.tax_category_id)}" ${selected}>${esc(item.tax_name)}</option>`;
  }
  return html;
}
async function loadMasters() {
  const data = await fetchJson("/api/expenses/masters");
  masters = data.masters || {};
  fillSelect("targetPersonId", masters.target_people, "target_person_id", "target_person_name");
  fillSelect("purposeId", masters.purposes, "purpose_id", "purpose_name");
  fillSelect("projectId", masters.projects, "project_id", "project_name");
  fillSelect("departmentId", masters.departments, "department_id", "department_name");
  fillSelect("paymentMethodId", masters.payment_methods, "payment_method_id", "method_name");
  const vendorList = document.getElementById("vendorList");
  vendorList.innerHTML = "";
  for (const item of masters.vendors || []) {
    const opt = document.createElement("option");
    opt.value = item.vendor_name || "";
    vendorList.appendChild(opt);
  }
}
async function loadPayables() {
  const params = new URLSearchParams();

  const status =
    document.getElementById("filterStatus").value;

  const vendor =
    document.getElementById("filterVendor").value;

  const from =
    document.getElementById("filterFrom").value;

  const to =
    document.getElementById("filterTo").value;

  const company =
    document.getElementById("filterCompany").value;

  const evidenceStatus =
    document.getElementById("filterEvidenceStatus").value;

  const reviewStatus =
    document.getElementById("filterReviewStatus").value;

  const professionalReviewStatus =
    document.getElementById(
      "filterProfessionalReviewStatus"
    ).value;

  if (status) params.set("status", status);
  if (vendor) params.set("vendor", vendor);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (company) params.set("company", company);

  if (evidenceStatus) {
    params.set("evidenceStatus", evidenceStatus);
  }

  if (reviewStatus) {
    params.set("reviewStatus", reviewStatus);
  }

  if (professionalReviewStatus) {
    params.set(
      "professionalReviewStatus",
      professionalReviewStatus
    );
  }

  const data = await fetchJson(
    "/api/payables?" + params.toString()
  );

  currentItems = data.items || [];

  renderSummary(data.summary || {});
  renderList();
}

function renderSummary(summary) {
  document.getElementById(
    "summaryOpenBalance"
  ).textContent = money(summary.open_balance);

  document.getElementById(
    "summaryOverdue"
  ).textContent =
    money(summary.overdue_balance) +
    " / " +
    (summary.overdue_count || 0) +
    "件";

  document.getElementById(
    "summaryDue7"
  ).textContent =
    money(summary.due_7_balance) +
    " / " +
    (summary.due_7_count || 0) +
    "件";

  document.getElementById(
    "summaryEvidenceAttention"
  ).textContent =
    (summary.evidence_attention_count || 0) +
    "件 / 期限超過 " +
    (summary.evidence_overdue_count || 0) +
    "件";

  document.getElementById(
    "summaryNeedsReview"
  ).textContent =
    (summary.needs_review_count || 0) +
    "件";

  document.getElementById(
    "summaryProfessionalReview"
  ).textContent =
    (summary.professional_review_pending_count || 0) +
    "件";
}

function renderList() {
  const list = document.getElementById("list");

  if (!currentItems.length) {
    list.innerHTML =
      '<div class="list-item">データがありません。</div>';
    return;
  }

  list.innerHTML = currentItems.map(item => {
    const active =
      Number(item.payable_id) ===
      Number(selectedPayableId)
        ? " active"
        : "";

    const status =
      item.effective_status || item.status;

    const alerts = [];

    if (item.is_overdue) {
      alerts.push(
        '<span class="payable-alert critical">支払期限超過</span>'
      );
    }

    if (
      ["missing", "pending", "mismatch"].includes(
        item.evidence_status
      )
    ) {
      alerts.push(
        '<span class="payable-alert warning">証憑要対応</span>'
      );
    }

    if (item.review_status === "needs_review") {
      alerts.push(
        '<span class="payable-alert warning">要確認</span>'
      );
    }

    if (
      item.professional_review_required &&
      [
        "pending",
        "requested",
        "recheck_required"
      ].includes(item.professional_review_status)
    ) {
      alerts.push(
        '<span class="payable-alert info">専門家確認</span>'
      );
    }

    return `
      <div
        class="list-item${active}"
        onclick="loadDetail(${esc(item.payable_id)})"
      >
        <div class="list-main">
          <span>
            ${esc(item.payable_no)}
            /
            ${esc(documentTypeLabel(item.document_type))}
            /
            ${esc(item.vendor_name)}
          </span>

          <span class="status status-${esc(status)}">
            ${esc(statusLabel(status))}
          </span>
        </div>

        <div class="list-sub list-sub-compact">
          会社:
          ${esc(item.company_name || item.company_code || "未設定")}
          /
          期限:
          ${esc(dateOnly(item.due_date))}
          ${alerts.join(" ")}
          /
          残:
          ${money(item.calculated_balance_amount)}
          /
          合計:
          ${money(item.calculated_total_amount)}
        </div>
      </div>
    `;
  }).join("");
}

function clearFilters() {
  [
    "filterStatus",
    "filterVendor",
    "filterFrom",
    "filterTo",
    "filterCompany",
    "filterEvidenceStatus",
    "filterReviewStatus",
    "filterProfessionalReviewStatus"
  ].forEach(id => {
    document.getElementById(id).value = "";
  });
  loadPayables().catch(error => showResult(error.message));
}
function newPayable() {
  selectedPayableId = null;
  document.getElementById("payableId").value = "";
  document.getElementById("payableNo").value = "";
  document.getElementById("status").value = "draft";
  document.getElementById("documentType").value = "invoice";
  document.getElementById("payableKind").value = "unpaid";
  document.getElementById("vendorName").value = "";
  document.getElementById("invoiceNumber").value = "";
  document.getElementById("supplierDocumentNo").value = "";
  document.getElementById("currencyCode").value = "JPY";
  document.getElementById("documentDate").value = todayIso();
  document.getElementById("postingDate").value = todayIso();
  document.getElementById("dueDate").value = "";
  document.getElementById("paymentPlanDate").value = "";
  document.getElementById("targetPersonId").value = "";
  document.getElementById("purposeId").value = "";
  document.getElementById("projectId").value = "";
  document.getElementById("departmentId").value = "";
  document.getElementById("evidenceType").value = "";
  document.getElementById("evidenceFileName").value = "";
  document.getElementById("sourceMemo").value = "";

  document.getElementById("companyCode").value = "";
  document.getElementById("companyName").value = "";
document.getElementById("evidenceStatus").value =
    "pending";

  document.getElementById("evidenceDueDate").value = "";
  document.getElementById("evidenceReceivedDate").value = "";

  document.getElementById("reviewStatus").value =
    "unreviewed";

  document.getElementById("reviewReason").value = "";

  document.getElementById("warningLevel").value =
    "none";

  document.getElementById(
    "professionalReviewRequired"
  ).value = "false";

  document.getElementById(
    "professionalReviewStatus"
  ).value = "not_required";

  document.getElementById(
    "professionalReviewer"
  ).value = "";

  document.getElementById(
    "professionalReviewedAt"
  ).value = "";

  document.getElementById(
    "professionalReviewResult"
  ).value = "";
  document.getElementById("summary").value = "";
  document.getElementById("memo").value = "";
  document.getElementById("lineBody").innerHTML = "";
  document.getElementById("paymentBody").innerHTML = "";
  document.getElementById("paymentDate").value = todayIso();
  document.getElementById("paymentMethodId").value = "";
  document.getElementById("paymentAmount").value = "";
  document.getElementById(
    "paymentWithholdingTaxAmount"
  ).value = "0";
  document.getElementById("bankFeeAmount").value = "0";
  document.getElementById("paymentMemo").value = "";
  addLine();
  renderList();
  showResult("新規入力です。");
}
/* PAYABLES_DELIVERY_NOTE_NEW_FUNCTION_20260706_START */
function newDeliveryNote() {
  newPayable();
  document.getElementById("documentType").value = "delivery_note";
  document.getElementById("payableKind").value = "accounts_payable";
  document.getElementById("supplierDocumentNo").placeholder = "納品書番号";
  document.getElementById("evidenceType").value = "納品書";
  document.getElementById("sourceMemo").value = "納品書登録";
  document.getElementById("summary").value = "納品書";
  showResult("納品書の新規入力です。請求書が届いたら、同じ請求書・未払管理内で照合します。");
}
/* PAYABLES_DELIVERY_NOTE_NEW_FUNCTION_20260706_END */
function addLine(data = {}) {
  const tbody = document.getElementById("lineBody");
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><select class="lineAccount">${accountOptions(data.account_title_id || "")}</select></td>
    <td><input class="lineItem" value="${esc(data.item_name || "")}"></td>
    <td><input class="lineDescription" value="${esc(data.description || "")}"></td>
    <td><input class="lineQty money" type="text" inputmode="decimal" value="${esc(money(data.quantity || 1))}" oninput="recalcLine(this)"></td>
    <td><input class="lineUnit money" type="text" inputmode="decimal" value="${esc(money(data.unit_price || 0))}" oninput="recalcLine(this)"></td>
    <td><input class="lineEx money" type="text" inputmode="decimal" value="${esc(money(data.amount_ex_tax || 0))}" oninput="recalcTaxFromEx(this)"></td>
    <td><input class="lineRate money" type="text" inputmode="decimal" value="${esc(money(data.tax_rate ?? 10))}" oninput="recalcTaxFromEx(this)"></td>
    <td><input class="lineTax money" type="text" inputmode="decimal" value="${esc(money(data.tax_amount || 0))}" oninput="recalcInTax(this)"></td>
    <td><input class="lineIn money" type="text" inputmode="decimal" value="${esc(money(data.amount_in_tax || 0))}"></td>
    <td><select class="lineTaxCategory">${taxOptions(data.tax_category_id || "")}</select></td>
    <td><input class="lineMemo" value="${esc(data.memo || "")}"></td>
    <td><button type="button" class="danger small" onclick="this.closest('tr').remove()">削除</button></td>
  `;
  tbody.appendChild(tr);
  if (!data.amount_ex_tax && !data.amount_in_tax) {
    recalcLine(tr.querySelector(".lineQty"));
  }
}
function recalcLine(el) {
  const tr = el.closest("tr");
  const qty = num(tr.querySelector(".lineQty").value) || 1;
  const unit = num(tr.querySelector(".lineUnit").value);
  tr.querySelector(".lineEx").value = money(Math.round(qty * unit));
  recalcTaxFromEx(tr.querySelector(".lineEx"));
}
function recalcTaxFromEx(el) {
  const tr = el.closest("tr");
  const ex = num(tr.querySelector(".lineEx").value);
  const rate = num(tr.querySelector(".lineRate").value);
  const tax = Math.floor(ex * rate / 100);
  tr.querySelector(".lineTax").value = money(tax);
  tr.querySelector(".lineIn").value = money(ex + tax);
}
function recalcInTax(el) {
  const tr = el.closest("tr");
  const ex = num(tr.querySelector(".lineEx").value);
  const tax = num(tr.querySelector(".lineTax").value);
  tr.querySelector(".lineIn").value = money(ex + tax);
}
function collectPayload() {
  const lines = [];
  document.querySelectorAll("#lineBody tr").forEach(tr => {
    const amountExTax = num(tr.querySelector(".lineEx").value);
    const taxAmount = num(tr.querySelector(".lineTax").value);
    const amountInTax = num(tr.querySelector(".lineIn").value) || amountExTax + taxAmount;
    if (amountExTax <= 0 && amountInTax <= 0 && !tr.querySelector(".lineDescription").value.trim()) {
      return;
    }
    lines.push({
      account_title_id: tr.querySelector(".lineAccount").value,
      tax_category_id: tr.querySelector(".lineTaxCategory").value,
      item_name: tr.querySelector(".lineItem").value,
      description: tr.querySelector(".lineDescription").value,
      quantity: tr.querySelector(".lineQty").value,
      unit_price: tr.querySelector(".lineUnit").value,
      amount_ex_tax: amountExTax,
      tax_rate: tr.querySelector(".lineRate").value,
      tax_amount: taxAmount,
      amount_in_tax: amountInTax,
      target_person_id: document.getElementById("targetPersonId").value,
      purpose_id: document.getElementById("purposeId").value,
      project_id: document.getElementById("projectId").value,
      department_id: document.getElementById("departmentId").value,
      memo: tr.querySelector(".lineMemo").value
    });
  });
  return {
    document: {
      payable_id: document.getElementById("payableId").value,
      payable_no: document.getElementById("payableNo").value,
      status: document.getElementById("status").value,
      document_type: document.getElementById("documentType").value,
      payable_kind: document.getElementById("payableKind").value,
      vendor_name: document.getElementById("vendorName").value,
      invoice_number: document.getElementById("invoiceNumber").value,
      supplier_document_no: document.getElementById("supplierDocumentNo").value,
      currency_code: document.getElementById("currencyCode").value,
      document_date: document.getElementById("documentDate").value,
      posting_date: document.getElementById("postingDate").value,
      due_date: document.getElementById("dueDate").value,
      payment_plan_date: document.getElementById("paymentPlanDate").value,
      target_person_id: document.getElementById("targetPersonId").value,
      purpose_id: document.getElementById("purposeId").value,
      project_id: document.getElementById("projectId").value,
      department_id: document.getElementById("departmentId").value,
      evidence_type: document.getElementById("evidenceType").value,
      evidence_file_name: document.getElementById("evidenceFileName").value,
      source_memo:
        document.getElementById("sourceMemo").value,

      company_code:
        document.getElementById("companyCode").value,

      company_name:
        document.getElementById("companyName").value,

      evidence_status:
        document.getElementById("evidenceStatus").value,

      evidence_due_date:
        document.getElementById("evidenceDueDate").value,

      evidence_received_date:
        document.getElementById(
          "evidenceReceivedDate"
        ).value,

      review_status:
        document.getElementById("reviewStatus").value,

      review_reason:
        document.getElementById("reviewReason").value,

      warning_level:
        document.getElementById("warningLevel").value,

      professional_review_required:
        document.getElementById(
          "professionalReviewRequired"
        ).value === "true",

      professional_review_status:
        document.getElementById(
          "professionalReviewStatus"
        ).value,

      professional_reviewer:
        document.getElementById(
          "professionalReviewer"
        ).value,

      professional_reviewed_at:
        document.getElementById(
          "professionalReviewedAt"
        ).value,

      professional_review_result:
        document.getElementById(
          "professionalReviewResult"
        ).value,
      summary: document.getElementById("summary").value,
      memo: document.getElementById("memo").value,
      journal_status: "not_created"
    },
    lines
  };
}
async function savePayable() {
  const payload = collectPayload();
  if (!payload.document.vendor_name.trim()) {
    alert("支払先を入力してください。");
    return;
  }
  if (!payload.lines.length) {
    alert("明細を1行以上入力してください。");
    return;
  }

  if (
    !payload.document.company_code.trim() ||
    !payload.document.company_name.trim()
  ) {
    alert(
      "この未払には会社情報がありません。\n\n" +
      "会社は支払書類の取込時点で確定するため、" +
      "取込元データまたは専門解析からの未払登録を確認してください。"
    );

    return;
  }
  const id = payload.document.payable_id;
  const url = id ? "/api/payables/" + encodeURIComponent(id) : "/api/payables";
  const method = id ? "PUT" : "POST";
  showResult("保存中...");
  const data = await fetchJson(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  showResult(data);
  selectedPayableId = data.result.payable_id;
  await loadPayables();
  await loadDetail(selectedPayableId);
}
async function loadDetail(id) {
  selectedPayableId = id;
  renderList();
  const data = await fetchJson("/api/payables/" + encodeURIComponent(id));
  const h = data.payable.header;
  document.getElementById("payableId").value = h.payable_id || "";
  document.getElementById("payableNo").value = h.payable_no || "";
  document.getElementById("status").value = h.effective_status || h.status || "draft";
  document.getElementById("documentType").value = h.document_type || "invoice";
  document.getElementById("payableKind").value = h.payable_kind || "unpaid";
  document.getElementById("vendorName").value = h.vendor_name || "";
  document.getElementById("invoiceNumber").value = h.invoice_number || "";
  document.getElementById("supplierDocumentNo").value = h.supplier_document_no || "";
  document.getElementById("currencyCode").value = h.currency_code || "JPY";
  document.getElementById("documentDate").value = dateOnly(h.document_date);
  document.getElementById("postingDate").value = dateOnly(h.posting_date);
  document.getElementById("dueDate").value = dateOnly(h.due_date);
  document.getElementById("paymentPlanDate").value = dateOnly(h.payment_plan_date);
  document.getElementById("targetPersonId").value = h.target_person_id || "";
  document.getElementById("purposeId").value = h.purpose_id || "";
  document.getElementById("projectId").value = h.project_id || "";
  document.getElementById("departmentId").value = h.department_id || "";
  document.getElementById("evidenceType").value = h.evidence_type || "";
  document.getElementById("evidenceFileName").value = h.evidence_file_name || "";
  document.getElementById("sourceMemo").value =
    h.source_memo || "";

  document.getElementById("companyCode").value =
    h.company_code || "";

  document.getElementById("companyName").value =
    h.company_name || "";

  renderPayableCompanyDisplay();

  document.getElementById("evidenceStatus").value =
    h.evidence_status || "pending";

  document.getElementById("evidenceDueDate").value =
    dateOnly(h.evidence_due_date);

  document.getElementById(
    "evidenceReceivedDate"
  ).value = dateOnly(h.evidence_received_date);

  document.getElementById("reviewStatus").value =
    h.review_status || "unreviewed";

  document.getElementById("reviewReason").value =
    h.review_reason || "";

  document.getElementById("warningLevel").value =
    h.warning_level || "none";

  document.getElementById(
    "professionalReviewRequired"
  ).value =
    h.professional_review_required
      ? "true"
      : "false";

  document.getElementById(
    "professionalReviewStatus"
  ).value =
    h.professional_review_status ||
    "not_required";

  document.getElementById(
    "professionalReviewer"
  ).value =
    h.professional_reviewer || "";

  document.getElementById(
    "professionalReviewedAt"
  ).value =
    h.professional_reviewed_at
      ? String(
          h.professional_reviewed_at
        ).slice(0, 16)
      : "";

  document.getElementById(
    "professionalReviewResult"
  ).value =
    h.professional_review_result || "";
  document.getElementById("summary").value = h.summary || "";
  document.getElementById("memo").value = h.memo || "";
  const lineBody = document.getElementById("lineBody");
  lineBody.innerHTML = "";
  for (const line of data.payable.lines || []) {
    addLine(line);
  }
  if (!(data.payable.lines || []).length) addLine();
  renderPayments(data.payable.payments || []);
  await loadPaymentBankAccounts();

  document.getElementById(
    "paymentAmount"
  ).value = money(
    h.calculated_balance_amount ||
    h.balance_amount ||
    0
  );

  updatePaymentBankWithdrawalPreview();
  showResult(`読込完了: ${h.payable_no} / 残高 ${money(h.calculated_balance_amount)}`);
}
function renderPayments(payments) {
  const tbody =
    document.getElementById("paymentBody");

  if (!payments.length) {
    tbody.innerHTML =
      '<tr><td colspan="7">支払記録はありません。</td></tr>';
    return;
  }

  tbody.innerHTML = payments.map(p => `
    <tr>
      <td>${esc(dateOnly(p.payment_date))}</td>
      <td>${esc(
        p.bank_name
          ? [
              p.bank_name,
              p.branch_name,
              p.account_number
            ].filter(Boolean).join(" ")
          : ""
      )}</td>
      <td class="money">${money(p.payment_amount)}</td>
      <td class="money">${money(p.withholding_tax_amount)}</td>
      <td class="money">${money(p.bank_fee_amount)}</td>
      <td>${esc(p.memo || "")}</td>
      <td>
        <button
          type="button"
          class="danger small"
          onclick="deletePayment(${esc(p.payable_payment_id)})"
        >削除</button>
      </td>
    </tr>
  `).join("");
}
function updatePaymentBankWithdrawalPreview() {
  const paymentAmount = num(
    document.getElementById(
      "paymentAmount"
    ).value
  );

  const withholdingTaxAmount = num(
    document.getElementById(
      "paymentWithholdingTaxAmount"
    ).value
  );

  const bankFeeAmount = num(
    document.getElementById(
      "bankFeeAmount"
    ).value
  );

  document.getElementById(
    "paymentSettlementPreview"
  ).value = money(
    paymentAmount + withholdingTaxAmount
  );

  document.getElementById(
    "paymentBankWithdrawalPreview"
  ).value = money(
    paymentAmount + bankFeeAmount
  );
}

async function loadPaymentBankAccounts() {
  const select =
    document.getElementById(
      "paymentBankAccountId"
    );

  const companyId = Number(
    localStorage.getItem(
      "current_company_id"
    ) || 0
  );

  select.innerHTML =
    '<option value="">銀行口座を選択</option>';

  if (
    !Number.isInteger(companyId) ||
    companyId <= 0
  ) {
    select.innerHTML =
      '<option value="">メイン画面で会社を選択してください</option>';
    return;
  }

  const data = await fetchJson(
    "/api/bank/accounts?company_id=" +
    encodeURIComponent(companyId)
  );

  for (const account of data.accounts || []) {
    const option =
      document.createElement("option");

    option.value =
      account.bank_account_id;

    option.textContent =
      [
        account.bank_name,
        account.branch_name,
        account.account_type_name,
        account.account_number,
        "残高 " +
          money(account.current_balance) +
          "円"
      ].filter(Boolean).join(" / ");

    select.appendChild(option);
  }

  if ((data.accounts || []).length === 1) {
    select.value =
      data.accounts[0].bank_account_id;
  }
}

async function addPayment() {
  const id =
    document.getElementById(
      "payableId"
    ).value;

  if (!id) {
    alert(
      "先に請求書・未払データを保存してください。"
    );
    return;
  }

  const bankAccountId =
    document.getElementById(
      "paymentBankAccountId"
    ).value;

  if (!bankAccountId) {
    alert(
      "支払元の銀行口座を選択してください。"
    );
    return;
  }

  const paymentAmount = num(
    document.getElementById(
      "paymentAmount"
    ).value
  );

  const withholdingTaxAmount = num(
    document.getElementById(
      "paymentWithholdingTaxAmount"
    ).value
  );

  const bankFeeAmount = num(
    document.getElementById(
      "bankFeeAmount"
    ).value
  );

  if (paymentAmount <= 0) {
    alert(
      "銀行振込額は1円以上で入力してください。"
    );
    return;
  }

  if (withholdingTaxAmount < 0) {
    alert(
      "源泉徴収額は0円以上で入力してください。"
    );
    return;
  }

  const settlementAmount =
    paymentAmount + withholdingTaxAmount;

  const withdrawalAmount =
    paymentAmount + bankFeeAmount;

  if (!confirm(
    "支払登録と銀行出金明細を作成します。\n\n" +
    "銀行振込額: " +
    money(paymentAmount) +
    "円\n" +
    "源泉徴収額: " +
    money(withholdingTaxAmount) +
    "円\n" +
    "未払消込額: " +
    money(settlementAmount) +
    "円\n" +
    "振込手数料: " +
    money(bankFeeAmount) +
    "円\n" +
    "銀行出金額: " +
    money(withdrawalAmount) +
    "円"
  )) {
    return;
  }

  const payload = {
    payment_date:
      document.getElementById(
        "paymentDate"
      ).value || todayIso(),

    payment_method_id:
      document.getElementById(
        "paymentMethodId"
      ).value,

    payment_amount:
      document.getElementById(
        "paymentAmount"
      ).value,

    bank_fee_amount:
      document.getElementById(
        "bankFeeAmount"
      ).value,

    withholding_tax_amount:
      document.getElementById(
        "paymentWithholdingTaxAmount"
      ).value,

    bank_account_id:
      bankAccountId,

    memo:
      document.getElementById(
        "paymentMemo"
      ).value
  };

  const data = await fetchJson(
    `/api/payables/${encodeURIComponent(id)}/payments`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify(payload)
    }
  );

  showResult(data);

  await loadPayables();
  await loadDetail(id);
}
document.addEventListener("input", event => {
  if (
    event.target &&
    (
      event.target.id === "paymentAmount" ||
      event.target.id ===
        "paymentWithholdingTaxAmount" ||
      event.target.id === "bankFeeAmount"
    )
  ) {
    updatePaymentBankWithdrawalPreview();
  }
});

async function deletePayment(paymentId) {
  const id =
    document.getElementById(
      "payableId"
    ).value;

  if (!id || !paymentId) {
    return;
  }

  if (!confirm(
    "この支払記録を削除し、連携済み銀行明細と源泉預り金を取消扱いにしますか？"
  )) {
    return;
  }

  const data = await fetchJson(
    `/api/payables/${encodeURIComponent(id)}/payments/${encodeURIComponent(paymentId)}`,
    {
      method: "DELETE"
    }
  );

  showResult(data);

  await loadPayables();
  await loadDetail(id);
}
async function deletePayable() {
  const id = document.getElementById("payableId").value;
  if (!id) return;
  if (!confirm("この請求書・未払データを削除しますか？\nDBから完全削除ではなく、無効扱いにします。")) {
    return;
  }
  const data = await fetchJson("/api/payables/" + encodeURIComponent(id), {
    method: "DELETE"
  });
  showResult(data);
  selectedPayableId = null;
  await loadPayables();
  newPayable();
}
/* PAYABLES_MEMO_VIEW_JS_20260710_START */
function payableMemoText(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return String(value);
}

function payableKindLabel(value) {
  const map = {
    accounts_payable: "買掛金",
    unpaid: "未払金",
    accrued_expense: "未払費用",
    card_payable: "カード未払",
    other: "その他"
  };

  return map[value] || value || "";
}

function evidenceStatusLabel(value) {
  const map = {
    not_required: "不要",
    received: "回収済み",
    missing: "未回収",
    pending: "後日回収",
    mismatch: "内容不一致"
  };

  return map[value] || value || "";
}

function reviewStatusLabel(value) {
  const map = {
    unreviewed: "未確認",
    needs_review: "要確認",
    confirmed: "確認済み",
    rejected: "差戻し"
  };

  return map[value] || value || "";
}

function professionalReviewStatusLabel(value) {
  const map = {
    not_required: "不要",
    pending: "確認待ち",
    requested: "確認依頼済み",
    confirmed: "確認済み",
    recheck_required: "再確認必要"
  };

  return map[value] || value || "";
}

function warningLevelLabel(value) {
  const map = {
    none: "なし",
    info: "情報",
    warning: "警告",
    critical: "重大"
  };

  return map[value] || value || "";
}

function formatPayableMemo(detail, index, total) {
  const payable = detail && detail.payable
    ? detail.payable
    : {};

  const h = payable.header || {};
  const lines = payable.lines || [];
  const payments = payable.payments || [];

  const output = [];

  output.push("==========================================");

  if (total > 1) {
    output.push(
      "請求書・未払 " +
      index +
      " / " +
      total
    );
  } else {
    output.push("請求書・未払 単品表示");
  }

  output.push("==========================================");
  output.push("");

  output.push("[基本情報]");
  output.push("管理番号: " + payableMemoText(h.payable_no));
  output.push("状態: " + statusLabel(h.effective_status || h.status));
  output.push("書類区分: " + documentTypeLabel(h.document_type));
  output.push("会計区分: " + payableKindLabel(h.payable_kind));
  output.push("支払先: " + payableMemoText(h.vendor_name));
  output.push("請求書番号: " + payableMemoText(h.invoice_number));
  output.push("先方書類番号: " + payableMemoText(h.supplier_document_no));
  output.push("請求日: " + dateOnly(h.document_date));
  output.push("計上日: " + dateOnly(h.posting_date));
  output.push("支払期限: " + dateOnly(h.due_date));
  output.push("支払予定日: " + dateOnly(h.payment_plan_date));
  output.push("通貨: " + payableMemoText(h.currency_code));
  output.push("");

  output.push("[金額]");
  output.push("税抜合計: " + money(h.calculated_subtotal_amount));
  output.push("消費税: " + money(h.calculated_tax_amount));
  output.push("税込合計: " + money(h.calculated_total_amount));
  output.push("支払済額: " + money(h.calculated_paid_amount));
  output.push("未払残高: " + money(h.calculated_balance_amount));
  output.push("");

  output.push("[会社・証憑・確認管理]");
  output.push("会社コード: " + payableMemoText(h.company_code));
  output.push("会社名: " + payableMemoText(h.company_name));
  output.push(
    "証憑状態: " +
    evidenceStatusLabel(h.evidence_status)
  );
  output.push(
    "証憑回収期限: " +
    dateOnly(h.evidence_due_date)
  );
  output.push(
    "証憑回収日: " +
    dateOnly(h.evidence_received_date)
  );
  output.push(
    "確認状態: " +
    reviewStatusLabel(h.review_status)
  );
  output.push(
    "要確認理由: " +
    payableMemoText(h.review_reason)
  );
  output.push(
    "警告レベル: " +
    warningLevelLabel(h.warning_level)
  );
  output.push(
    "専門家確認要否: " +
    (h.professional_review_required ? "必要" : "不要")
  );
  output.push(
    "専門家確認状態: " +
    professionalReviewStatusLabel(
      h.professional_review_status
    )
  );
  output.push(
    "確認者: " +
    payableMemoText(h.professional_reviewer)
  );
  output.push(
    "確認日時: " +
    payableMemoText(h.professional_reviewed_at)
  );
  output.push(
    "専門家確認結果: " +
    payableMemoText(h.professional_review_result)
  );
  output.push("");

  output.push("[証憑]");
  output.push("証憑区分: " + payableMemoText(h.evidence_type));
  output.push(
    "証憑ファイル名: " +
    payableMemoText(h.evidence_file_name)
  );
  output.push(
    "証憑保存メモ: " +
    payableMemoText(h.source_memo)
  );
  output.push("");

  output.push("[概要・社内メモ]");
  output.push("概要: " + payableMemoText(h.summary));
  output.push("社内メモ: " + payableMemoText(h.memo));
  output.push("");

  output.push("[明細]");

  if (!lines.length) {
    output.push("明細なし");
  } else {
    lines.forEach(function (line, lineIndex) {
      output.push(
        (lineIndex + 1) +
        ". " +
        payableMemoText(line.item_name) +
        " / " +
        payableMemoText(line.description)
      );

      output.push(
        "   数量: " +
        money(line.quantity) +
        "　単価: " +
        money(line.unit_price) +
        "　税抜: " +
        money(line.amount_ex_tax) +
        "　税率: " +
        money(line.tax_rate) +
        "%　税額: " +
        money(line.tax_amount) +
        "　税込: " +
        money(line.amount_in_tax)
      );

      if (line.memo) {
        output.push(
          "   メモ: " +
          payableMemoText(line.memo)
        );
      }
    });
  }

  output.push("");
  output.push("[支払記録]");

  if (!payments.length) {
    output.push("支払記録なし");
  } else {
    payments.forEach(function (payment, paymentIndex) {
      output.push(
        (paymentIndex + 1) +
        ". 支払日: " +
        dateOnly(payment.payment_date) +
        "　支払額: " +
        money(payment.payment_amount) +
        "　手数料: " +
        money(payment.bank_fee_amount) +
        "　メモ: " +
        payableMemoText(payment.memo)
      );
    });
  }

  output.push("");

  return output.join("\n");
}

function escapePayableMemoHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function showPayableMemoWindow(title, text) {
  const popup = window.open(
    "",
    "hd_origin_payable_memo",
    "width=920,height=760,resizable=yes,scrollbars=yes"
  );

  if (!popup) {
    window.alert(
      "メモ画面を開けませんでした。ポップアップを許可してください。"
    );
    return;
  }

  const safeTitle = escapePayableMemoHtml(title);
  const safeText = escapePayableMemoHtml(text);

  popup.document.open();

  popup.document.write(`
    <!doctype html>
    <html lang="ja">
    <head>
      <meta charset="utf-8">
      <title>${safeTitle}</title>

      <style>
        body {
          margin: 0;
          padding: 16px;
          background: #f5f5f5;
          color: #222;
          font-family: system-ui, sans-serif;
        }

        .memo-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
        }

        h1 {
          margin: 0;
          font-size: 18px;
        }

        .memo-buttons {
          display: flex;
          gap: 6px;
        }

        button {
          border: 1px solid #999;
          border-radius: 7px;
          background: #fff;
          padding: 6px 10px;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }

        textarea {
          box-sizing: border-box;
          width: 100%;
          height: calc(100vh - 82px);
          resize: none;
          border: 1px solid #aaa;
          border-radius: 8px;
          background: #fff;
          padding: 12px;
          font-family: Consolas, "Yu Gothic UI", monospace;
          font-size: 14px;
          line-height: 1.55;
          white-space: pre;
        }
      </style>
    <!-- GPT00_LEDGER_PAGE_VIEW_SWITCH_STYLE_START -->
<style>
  .hd-ledger-page-view-switch {
    width: min(1380px, calc(100% - 32px));
    margin: 18px auto 0;
    padding: 12px;
    border: 1px solid rgba(35,48,76,.12);
    border-radius: 22px;
    background:
      radial-gradient(circle at 8% 0%, rgba(50,100,255,.10), transparent 22rem),
      rgba(255,255,255,.92);
    box-shadow: 0 10px 28px rgba(32,44,72,.08);
    font-family: "Yu Gothic", "YuGothic", "Meiryo", system-ui, sans-serif;
    color: #172033;
  }

  .hd-ledger-page-view-switch-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
  }

  .hd-ledger-page-view-title {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .hd-ledger-page-view-title strong {
    font-size: 14px;
    letter-spacing: -.02em;
  }

  .hd-ledger-page-view-title span {
    color: #667085;
    font-size: 12px;
    line-height: 1.45;
  }

  .hd-ledger-page-view-buttons {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    min-width: 230px;
    padding: 4px;
    border-radius: 16px;
    background: #eef2f7;
    border: 1px solid rgba(35,48,76,.08);
  }

  .hd-ledger-page-view-button {
    min-height: 36px;
    border: 0;
    border-radius: 12px;
    background: transparent;
    color: #596579;
    font-size: 12px;
    font-weight: 900;
    cursor: pointer;
  }

  .hd-ledger-page-view-button.is-active {
    background: #ffffff;
    color: #2348c7;
    box-shadow: 0 8px 16px rgba(32,44,72,.10);
  }

  .hd-ledger-page-view-button:hover {
    transform: translateY(-1px);
    filter: brightness(1.03);
  }

  html[data-ledger-view="report"] .hd-ledger-page-view-current::after {
    content: "帳票形式";
  }

  html[data-ledger-view="single"] .hd-ledger-page-view-current::after {
    content: "単票形式";
  }

  body[data-ledger-view="report"] .ledger-single-only,
  body[data-ledger-view="single"] .ledger-report-only {
    display: none !important;
  }

  @media (max-width: 720px) {
    .hd-ledger-page-view-switch {
      width: calc(100% - 20px);
      margin-top: 12px;
    }

    .hd-ledger-page-view-switch-inner {
      flex-direction: column;
      align-items: stretch;
    }

    .hd-ledger-page-view-buttons {
      min-width: 0;
      width: 100%;
    }
  }
</style>
<!-- GPT00_LEDGER_PAGE_VIEW_SWITCH_STYLE_END -->
<!-- GPT00_PAYABLES_FORMAL_REPORT_BUTTON_STYLE_START -->
<style>
  .hd-payables-view-menu {
    width: min(1380px, calc(100% - 32px));
    margin: 16px auto 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 12px;
    border-radius: 22px;
    border: 1px solid rgba(35,48,76,.12);
    background: rgba(255,255,255,.92);
    box-shadow: 0 10px 28px rgba(32,44,72,.08);
    font-family: "Yu Gothic", "YuGothic", "Meiryo", system-ui, sans-serif;
  }

  .hd-payables-view-menu-title {
    display: flex;
    flex-direction: column;
    gap: 3px;
    color: #172033;
  }

  .hd-payables-view-menu-title strong {
    font-size: 14px;
  }

  .hd-payables-view-menu-title span {
    color: #667085;
    font-size: 12px;
  }

  .hd-payables-view-menu-buttons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .hd-payables-view-menu-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 36px;
    padding: 8px 13px;
    border-radius: 12px;
    text-decoration: none !important;
    font-size: 12px;
    font-weight: 900;
    border: 1px solid transparent;
  }

  .hd-payables-view-menu-button.single {
    background: #172033;
    color: #fff !important;
  }

  .hd-payables-view-menu-button.report {
    background: #eef3ff;
    color: #2348c7 !important;
    border-color: rgba(50,100,255,.18);
  }

  .hd-payables-view-menu-button:hover {
    transform: translateY(-1px);
    filter: brightness(1.03);
  }

  @media (max-width: 720px) {
    .hd-payables-view-menu {
      width: calc(100% - 20px);
      align-items: stretch;
      flex-direction: column;
    }

    .hd-payables-view-menu-buttons {
      justify-content: stretch;
    }

    .hd-payables-view-menu-button {
      flex: 1 1 auto;
    }
  }
</style>
<!-- GPT00_PAYABLES_FORMAL_REPORT_BUTTON_STYLE_END -->
<!-- GPT00_PAYABLES_VIEW_BUTTON_VISIBILITY_START -->
<style>
  /* GPT00: 請求書・未払 単票/帳票ボタン 視認性アップ */
  .hd-payables-view-menu {
    padding: 16px 18px !important;
    border-radius: 26px !important;
  }

  .hd-payables-view-menu-title strong {
    font-size: 18px !important;
  }

  .hd-payables-view-menu-title span {
    font-size: 14px !important;
    line-height: 1.7 !important;
  }

  .hd-payables-view-menu-buttons {
    gap: 10px !important;
  }

  .hd-payables-view-menu-button {
    min-height: 48px !important;
    padding: 12px 20px !important;
    border-radius: 15px !important;
    font-size: 16px !important;
    letter-spacing: .02em !important;
    box-shadow: 0 12px 22px rgba(32,44,72,.12);
  }

  .hd-payables-view-menu-button.report {
    border-width: 2px !important;
    background: #eaf0ff !important;
  }

  @media (max-width: 720px) {
    .hd-payables-view-menu-button {
      width: 100% !important;
      font-size: 15px !important;
    }
  }
</style>
<!-- GPT00_PAYABLES_VIEW_BUTTON_VISIBILITY_END -->
</head>

    <body>
      <div class="memo-toolbar">
        <h1>${safeTitle}</h1>

        <div class="memo-buttons">
          <button
            type="button"
            onclick="
              const box = document.getElementById('memoText');
              box.focus();
              box.select();
              navigator.clipboard.writeText(box.value)
                .then(() => alert('コピーしました。'))
                .catch(() => document.execCommand('copy'));
            "
          >コピー</button>

          <button
            type="button"
            onclick="window.print()"
          >印刷</button>

          <button
            type="button"
            onclick="window.close()"
          >閉じる</button>
        </div>
      </div>

      <textarea id="memoText" readonly>${safeText}</textarea>
    </body>
    </html>
  `);

  popup.document.close();
}

async function openSelectedPayableMemo() {
  if (!selectedPayableId) {
    window.alert(
      "一覧から未払案件を1件選択してください。"
    );
    return;
  }

  showResult("単品メモを作成しています...");

  try {
    const detail = await fetchJson(
      "/api/payables/" +
      encodeURIComponent(selectedPayableId)
    );

    const text = formatPayableMemo(
      detail,
      1,
      1
    );

    showPayableMemoWindow(
      "請求書・未払 単品メモ",
      text
    );

    showResult("単品メモを表示しました。");
  } catch (error) {
    showResult(
      "単品メモ作成失敗: " +
      (error && error.message
        ? error.message
        : String(error))
    );
  }
}

async function openAllPayablesMemo() {
  if (!currentItems.length) {
    window.alert(
      "現在の検索結果に未払案件がありません。"
    );
    return;
  }

  showResult(
    "全件メモを作成しています: " +
    currentItems.length +
    "件"
  );

  try {
    const sections = [];

    for (
      let index = 0;
      index < currentItems.length;
      index += 1
    ) {
      const item = currentItems[index];

      const detail = await fetchJson(
        "/api/payables/" +
        encodeURIComponent(item.payable_id)
      );

      sections.push(
        formatPayableMemo(
          detail,
          index + 1,
          currentItems.length
        )
      );
    }

    const header = [
      "==========================================",
      "請求書・未払 内容全件表示",
      "==========================================",
      "",
      "対象件数: " + currentItems.length + "件",
      "出力日時: " + new Date().toLocaleString("ja-JP"),
      "",
      "※現在の検索条件に表示されている案件が対象です。",
      ""
    ].join("\n");

    showPayableMemoWindow(
      "請求書・未払 全件メモ",
      header +
      sections.join("\n")
    );

    showResult(
      "全件メモを表示しました: " +
      currentItems.length +
      "件"
    );
  } catch (error) {
    showResult(
      "全件メモ作成失敗: " +
      (error && error.message
        ? error.message
        : String(error))
    );
  }
}
/* PAYABLES_MEMO_VIEW_JS_20260710_END */
/* GPT00_PAYABLE_SELECTION_MASTERS_20260711_START */
let payableSelectionMasters = {};
let payableSelectionLabels = {};

function rebuildPayableSelectionLabels() {
  payableSelectionLabels = {};

  for (
    const [masterType, rows] of
    Object.entries(payableSelectionMasters || {})
  ) {
    payableSelectionLabels[masterType] = {};

    for (const row of rows || []) {
      const code = String(
        row.option_code || ""
      );

      if (!code) continue;

      payableSelectionLabels[masterType][code] =
        row.display_name || code;
    }
  }
}

function payableMasterLabel(masterType, value) {
  const code = String(value || "");

  return (
    payableSelectionLabels[masterType] &&
    payableSelectionLabels[masterType][code]
  ) || code;
}

function statusLabel(value) {
  return payableMasterLabel(
    "payable_statuses",
    value
  );
}

function documentTypeLabel(value) {
  return payableMasterLabel(
    "document_types",
    value
  );
}

function payableKindLabel(value) {
  return payableMasterLabel(
    "payable_kinds",
    value
  );
}

function evidenceStatusLabel(value) {
  return payableMasterLabel(
    "evidence_statuses",
    value
  );
}

function reviewStatusLabel(value) {
  return payableMasterLabel(
    "review_statuses",
    value
  );
}

function professionalReviewStatusLabel(value) {
  return payableMasterLabel(
    "professional_review_statuses",
    value
  );
}

function warningLevelLabel(value) {
  return payableMasterLabel(
    "warning_levels",
    value
  );
}

function fillPayableMasterSelect(select) {
  if (!select) return;

  const masterType =
    select.dataset.payableMasterType || "";

  const rows =
    payableSelectionMasters[masterType] || [];

  const oldValue = select.value;

  const emptyLabel =
    select.dataset.emptyLabel || "選択";

  select.innerHTML =
    `<option value="">${esc(emptyLabel)}</option>`;

  for (const row of rows) {
    const option =
      document.createElement("option");

    option.value =
      row.option_code || "";

    option.textContent =
      row.display_name ||
      row.option_code ||
      "";

    select.appendChild(option);
  }

  const targetValue =
    oldValue ||
    select.dataset.defaultValue ||
    "";

  if (
    Array.from(select.options).some(
      option => option.value === targetValue
    )
  ) {
    select.value = targetValue;
  }
}

async function loadPayableSelectionMasters() {
  const definitions = {
    payable_statuses: {
      code: "payable_status_code",
      name: "payable_status_name"
    },
    document_types: {
      code: "document_type_code",
      name: "document_type_name"
    },
    payable_kinds: {
      code: "payable_kind_code",
      name: "payable_kind_name"
    },
    evidence_types: {
      code: "evidence_type_code",
      name: "evidence_type_name"
    },
    evidence_statuses: {
      code: "evidence_status_code",
      name: "evidence_status_name"
    },
    review_statuses: {
      code: "review_status_code",
      name: "review_status_name"
    },
    warning_levels: {
      code: "warning_level_code",
      name: "warning_level_name"
    },
    professional_review_statuses: {
      code:
        "professional_review_status_code",
      name:
        "professional_review_status_name"
    }
  };

  const results = await Promise.all(
    Object.keys(definitions).map(
      async masterType => {
        const data = await fetchJson(
          "/api/masters?type=" +
          encodeURIComponent(masterType)
        );

        const rows =
          data.items ||
          data.rows ||
          data.masters ||
          [];

        return [
          masterType,
          rows.filter(
            row => row.is_active !== false
          )
        ];
      }
    )
  );

  payableSelectionMasters = {};

  for (
    const [masterType, rows] of results
  ) {
    const definition =
      definitions[masterType];

    payableSelectionMasters[
      masterType
    ] = rows.map(row => ({
      option_code:
        row[definition.code] || "",
      display_name:
        row[definition.name] ||
        row.name ||
        row[definition.code] ||
        "",
      sort_order:
        Number(row.sort_order || 0)
    }));
  }

  rebuildPayableSelectionLabels();

  document
    .querySelectorAll(
      "select[data-payable-master-type]"
    )
    .forEach(fillPayableMasterSelect);
}
/* GPT00_PAYABLE_SELECTION_MASTERS_20260711_END */
async function loadAll() {
  const errors = [];

  try {
    await Promise.all([
      loadMasters(),
      loadPayableSelectionMasters()
    ]);
  } catch (error) {
    errors.push(
      "マスタ読込: " +
      (error && error.message ? error.message : String(error))
    );
  }

  try {
    await loadPayables();
  } catch (error) {
    errors.push(
      "未払一覧読込: " +
      (error && error.message ? error.message : String(error))
    );

    document.getElementById("list").innerHTML =
      '<div class="list-item warn">未払一覧を読み込めませんでした。</div>';
  }

  if (!selectedPayableId) {
    newPayable();
  }

  if (errors.length) {
    showResult(errors.join("\n"));
  }
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    function () {
      loadAll();
    },
    { once: true }
  );
} else {
  loadAll();
}
