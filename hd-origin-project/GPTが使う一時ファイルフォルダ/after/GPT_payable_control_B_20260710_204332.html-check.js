
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
    draft: "下書き",
    confirmed: "未払確定",
    partially_paid: "一部支払",
    paid: "支払済み",
    void: "無効"
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
  document.getElementById("paymentAmount").value = money(h.calculated_balance_amount || h.balance_amount || 0);
  showResult(`読込完了: ${h.payable_no} / 残高 ${money(h.calculated_balance_amount)}`);
}
function renderPayments(payments) {
  const tbody = document.getElementById("paymentBody");
  if (!payments.length) {
    tbody.innerHTML = '<tr><td colspan="5">支払記録はありません。</td></tr>';
    return;
  }
  tbody.innerHTML = payments.map(p => `
    <tr>
      <td>${esc(dateOnly(p.payment_date))}</td>
      <td class="money">${money(p.payment_amount)}</td>
      <td class="money">${money(p.bank_fee_amount)}</td>
      <td>${esc(p.memo || "")}</td>
      <td><button type="button" class="danger small" onclick="deletePayment(${esc(p.payable_payment_id)})">削除</button></td>
    </tr>
  `).join("");
}
async function addPayment() {
  const id = document.getElementById("payableId").value;
  if (!id) {
    alert("先に請求書・未払データを保存してください。");
    return;
  }
  const payload = {
    payment_date: document.getElementById("paymentDate").value || todayIso(),
    payment_method_id: document.getElementById("paymentMethodId").value,
    payment_amount: document.getElementById("paymentAmount").value,
    bank_fee_amount: document.getElementById("bankFeeAmount").value,
    memo: document.getElementById("paymentMemo").value
  };
  const data = await fetchJson(`/api/payables/${encodeURIComponent(id)}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  showResult(data);
  await loadPayables();
  await loadDetail(id);
}
async function deletePayment(paymentId) {
  const id = document.getElementById("payableId").value;
  if (!id || !paymentId) return;
  if (!confirm("この支払記録を削除しますか？")) return;
  const data = await fetchJson(`/api/payables/${encodeURIComponent(id)}/payments/${encodeURIComponent(paymentId)}`, {
    method: "DELETE"
  });
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
async function loadAll() {
  try {
    await loadMasters();
    await loadPayables();
    if (!selectedPayableId) {
      newPayable();
    }
  } catch (error) {
    showResult(error.message);
  }
}
loadAll();
