const fs = require("fs");

const beforeHtml = "C:\\Users\\yossh.2FLABO\\Desktop\\新しいフォルダー\\wix-test\\hd-origin-project\\GPTが使う一時ファイルフォルダ\\before\\GPT_payable_control_B_20260710_204332.before.payable-list.html";
const beforeCss = "C:\\Users\\yossh.2FLABO\\Desktop\\新しいフォルダー\\wix-test\\hd-origin-project\\GPTが使う一時ファイルフォルダ\\before\\GPT_payable_control_B_20260710_204332.before.payable-list.css";
const afterHtml = "C:\\Users\\yossh.2FLABO\\Desktop\\新しいフォルダー\\wix-test\\hd-origin-project\\GPTが使う一時ファイルフォルダ\\after\\GPT_payable_control_B_20260710_204332.after.payable-list.html";
const afterCss = "C:\\Users\\yossh.2FLABO\\Desktop\\新しいフォルダー\\wix-test\\hd-origin-project\\GPTが使う一時ファイルフォルダ\\after\\GPT_payable_control_B_20260710_204332.after.payable-list.css";

function normalize(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

function replaceOnce(text, search, replacement, label) {
  const count = text.split(search).length - 1;

  if (count !== 1) {
    throw new Error(
      label + " の検出数が不正です: " + count
    );
  }

  return text.replace(search, replacement);
}

function replaceRegexOnce(text, pattern, replacement, label) {
  const matches = text.match(pattern);

  if (!matches) {
    throw new Error(label + " を検出できません。");
  }

  return text.replace(pattern, replacement);
}

let html = normalize(fs.readFileSync(beforeHtml, "utf8"));
let css = normalize(fs.readFileSync(beforeCss, "utf8"));

if (html.includes("PAYABLE_CONTROL_UI_20260710_START")) {
  throw new Error("画面側には既に今回の修正があります。");
}

/* =========================================================
   1. サマリー追加
========================================================= */
html = replaceOnce(
  html,
`        <div class="summary-box">
          <div class="summary-label">7日以内</div>
          <div class="summary-value" id="summaryDue7">0</div>
        </div>`,
`        <div class="summary-box">
          <div class="summary-label">7日以内</div>
          <div class="summary-value" id="summaryDue7">0</div>
        </div>

        <!-- PAYABLE_CONTROL_UI_20260710_START -->
        <div class="summary-box">
          <div class="summary-label">証憑要対応</div>
          <div class="summary-value warn" id="summaryEvidenceAttention">0</div>
        </div>

        <div class="summary-box">
          <div class="summary-label">人間確認待ち</div>
          <div class="summary-value warn" id="summaryNeedsReview">0</div>
        </div>

        <div class="summary-box">
          <div class="summary-label">専門家確認待ち</div>
          <div class="summary-value warn" id="summaryProfessionalReview">0</div>
        </div>
        <!-- PAYABLE_CONTROL_UI_20260710_END -->`,
  "サマリー"
);

/* =========================================================
   2. 検索条件追加
========================================================= */
html = replaceOnce(
  html,
`      <div class="button-row" style="margin-top:10px;">
        <button type="button" onclick="loadPayables()">検索</button>`,
`      <div class="grid2 payable-control-filter-grid" style="margin-top:8px;">
        <div>
          <label>会社</label>
          <input id="filterCompany" placeholder="会社名・会社コード">
        </div>

        <div>
          <label>証憑状態</label>
          <select id="filterEvidenceStatus">
            <option value="">すべて</option>
            <option value="not_required">不要</option>
            <option value="received">回収済み</option>
            <option value="missing">未回収</option>
            <option value="pending">後日回収</option>
            <option value="mismatch">内容不一致</option>
          </select>
        </div>

        <div>
          <label>確認状態</label>
          <select id="filterReviewStatus">
            <option value="">すべて</option>
            <option value="unreviewed">未確認</option>
            <option value="needs_review">要確認</option>
            <option value="confirmed">確認済み</option>
            <option value="rejected">差戻し</option>
          </select>
        </div>

        <div>
          <label>専門家確認</label>
          <select id="filterProfessionalReviewStatus">
            <option value="">すべて</option>
            <option value="not_required">不要</option>
            <option value="pending">確認待ち</option>
            <option value="requested">確認依頼済み</option>
            <option value="confirmed">確認済み</option>
            <option value="recheck_required">再確認必要</option>
          </select>
        </div>
      </div>

      <div class="button-row" style="margin-top:10px;">
        <button type="button" onclick="loadPayables()">検索</button>`,
  "検索欄"
);

/* =========================================================
   3. 基本情報へ管理欄追加
========================================================= */
html = replaceOnce(
  html,
`      <div style="margin-top:8px;">
        <label>概要</label>`,
`      <section class="payable-control-section">
        <h3>会社・証憑・確認管理</h3>

        <div class="grid4">
          <div>
            <label>会社コード</label>
            <input id="companyCode" placeholder="例：hd_origin_style">
          </div>

          <div>
            <label>会社名</label>
            <input id="companyName" placeholder="例：株式会社HDオリジンスタイル">
          </div>

          <div>
            <label>証憑状態</label>
            <select id="evidenceStatus">
              <option value="pending">後日回収</option>
              <option value="received">回収済み</option>
              <option value="missing">未回収</option>
              <option value="mismatch">内容不一致</option>
              <option value="not_required">不要</option>
            </select>
          </div>

          <div>
            <label>警告レベル</label>
            <select id="warningLevel">
              <option value="none">なし</option>
              <option value="info">情報</option>
              <option value="warning">警告</option>
              <option value="critical">重大</option>
            </select>
          </div>
        </div>

        <div class="grid4" style="margin-top:8px;">
          <div>
            <label>証憑回収期限</label>
            <input id="evidenceDueDate" type="date">
          </div>

          <div>
            <label>証憑回収日</label>
            <input id="evidenceReceivedDate" type="date">
          </div>

          <div>
            <label>確認状態</label>
            <select id="reviewStatus">
              <option value="unreviewed">未確認</option>
              <option value="needs_review">要確認</option>
              <option value="confirmed">確認済み</option>
              <option value="rejected">差戻し</option>
            </select>
          </div>

          <div>
            <label>専門家確認要否</label>
            <select id="professionalReviewRequired">
              <option value="false">不要</option>
              <option value="true">必要</option>
            </select>
          </div>
        </div>

        <div class="grid3" style="margin-top:8px;">
          <div>
            <label>専門家確認状態</label>
            <select id="professionalReviewStatus">
              <option value="not_required">不要</option>
              <option value="pending">確認待ち</option>
              <option value="requested">確認依頼済み</option>
              <option value="confirmed">確認済み</option>
              <option value="recheck_required">再確認必要</option>
            </select>
          </div>

          <div>
            <label>確認者</label>
            <input id="professionalReviewer" placeholder="例：秦先生">
          </div>

          <div>
            <label>確認日時</label>
            <input id="professionalReviewedAt" type="datetime-local">
          </div>
        </div>

        <div style="margin-top:8px;">
          <label>要確認理由</label>
          <textarea id="reviewReason"></textarea>
        </div>

        <div style="margin-top:8px;">
          <label>専門家確認結果</label>
          <textarea id="professionalReviewResult"></textarea>
        </div>
      </section>

      <div style="margin-top:8px;">
        <label>概要</label>`,
  "管理入力欄"
);

/* =========================================================
   4. loadPayables差し替え
========================================================= */
html = replaceRegexOnce(
  html,
  /async function loadPayables\(\) \{[\s\S]*?\n\}\nfunction renderSummary/,
`async function loadPayables() {
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

function renderSummary`,
  "loadPayables"
);

/* =========================================================
   5. renderSummary差し替え
========================================================= */
html = replaceRegexOnce(
  html,
  /function renderSummary\(summary\) \{[\s\S]*?\n\}\nfunction renderList/,
`function renderSummary(summary) {
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

function renderList`,
  "renderSummary"
);

/* =========================================================
   6. renderList差し替え
========================================================= */
html = replaceRegexOnce(
  html,
  /function renderList\(\) \{[\s\S]*?\n\}\nfunction clearFilters/,
`function renderList() {
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

    return \`
      <div
        class="list-item\${active}"
        onclick="loadDetail(\${esc(item.payable_id)})"
      >
        <div class="list-main">
          <span>
            \${esc(item.payable_no)}
            /
            \${esc(documentTypeLabel(item.document_type))}
            /
            \${esc(item.vendor_name)}
          </span>

          <span class="status status-\${esc(status)}">
            \${esc(statusLabel(status))}
          </span>
        </div>

        <div class="list-sub list-sub-compact">
          会社:
          \${esc(item.company_name || item.company_code || "未設定")}
          /
          期限:
          \${esc(dateOnly(item.due_date))}
          \${alerts.join(" ")}
          /
          残:
          \${money(item.calculated_balance_amount)}
          /
          合計:
          \${money(item.calculated_total_amount)}
        </div>
      </div>
    \`;
  }).join("");
}

function clearFilters`,
  "renderList"
);

/* =========================================================
   7. 検索クリア
========================================================= */
html = replaceOnce(
  html,
`  ["filterStatus", "filterVendor", "filterFrom", "filterTo"].forEach(id => {`,
`  [
    "filterStatus",
    "filterVendor",
    "filterFrom",
    "filterTo",
    "filterCompany",
    "filterEvidenceStatus",
    "filterReviewStatus",
    "filterProfessionalReviewStatus"
  ].forEach(id => {`,
  "clearFilters"
);

/* =========================================================
   8. 新規初期化
========================================================= */
html = replaceOnce(
  html,
`  document.getElementById("sourceMemo").value = "";`,
`  document.getElementById("sourceMemo").value = "";

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
  ).value = "";`,
  "newPayable初期化"
);

/* =========================================================
   9. 保存payload
========================================================= */
html = replaceOnce(
  html,
`      source_memo: document.getElementById("sourceMemo").value,`,
`      source_memo:
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
        ).value,`,
  "collectPayload"
);

/* =========================================================
   10. 詳細読込
========================================================= */
html = replaceOnce(
  html,
`  document.getElementById("sourceMemo").value = h.source_memo || "";`,
`  document.getElementById("sourceMemo").value =
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
    h.professional_review_result || "";`,
  "loadDetail"
);

/* =========================================================
   11. CSS
========================================================= */
if (css.includes("PAYABLE_CONTROL_UI_CSS_20260710_START")) {
  throw new Error("CSSには既に今回の修正があります。");
}

css += `

/* PAYABLE_CONTROL_UI_CSS_20260710_START */
.payable-control-section {
  margin-top: 12px;
  padding: 12px;
  border: 2px solid #cbd5e1;
  border-radius: 10px;
  background: #f8fafc;
}

.payable-control-section h3 {
  margin: 0 0 10px;
  font-size: 15px;
}

.payable-alert {
  display: inline-block;
  margin-left: 4px;
  padding: 1px 5px;
  border-radius: 999px;
  font-size: 0.62rem;
  font-weight: 800;
  white-space: nowrap;
}

.payable-alert.info {
  background: #dbeafe;
  color: #1e40af;
}

.payable-alert.warning {
  background: #fef3c7;
  color: #92400e;
}

.payable-alert.critical {
  background: #fee2e2;
  color: #991b1b;
}

@media (max-width: 1200px) {
  .payable-control-filter-grid {
    grid-template-columns: 1fr;
  }

  .payable-control-section .grid4,
  .payable-control-section .grid3 {
    grid-template-columns: 1fr 1fr;
  }
}
/* PAYABLE_CONTROL_UI_CSS_20260710_END */
`;

const requiredIds = [
  "summaryEvidenceAttention",
  "summaryNeedsReview",
  "summaryProfessionalReview",
  "filterCompany",
  "filterEvidenceStatus",
  "filterReviewStatus",
  "filterProfessionalReviewStatus",
  "companyCode",
  "companyName",
  "evidenceStatus",
  "evidenceDueDate",
  "evidenceReceivedDate",
  "reviewStatus",
  "reviewReason",
  "warningLevel",
  "professionalReviewRequired",
  "professionalReviewStatus",
  "professionalReviewer",
  "professionalReviewedAt",
  "professionalReviewResult"
];

for (const id of requiredIds) {
  if (!html.includes('id="' + id + '"')) {
    throw new Error("必須ID不足: " + id);
  }
}

fs.writeFileSync(afterHtml, html, "utf8");
fs.writeFileSync(afterCss, css, "utf8");

console.log("HTML/CSS after作成OK");