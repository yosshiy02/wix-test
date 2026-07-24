"use strict";

const RECEIPT_LEDGER_ENDPOINT =
  "/api/receipts/saved?limit=1000&offset=0";

const receiptLedgerState = {
  rows: [],
  filteredRows: []
};

function byId(id) {
  return document.getElementById(id);
}

function numberValue(value) {
  const number = Number(
    String(value === null || value === undefined ? "" : value)
      .replace(/,/g, "")
  );

  return Number.isFinite(number) ? number : 0;
}

function textValue(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function dateValue(value) {
  const text = textValue(value);

  if (!text) {
    return "";
  }

  return text.slice(0, 10);
}

function dateTimeValue(value) {
  const text = textValue(value);

  if (!text) {
    return "-";
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return text;
  }

  return date.toLocaleString("ja-JP");
}

function yen(value) {
  return Math.round(numberValue(value))
    .toLocaleString("ja-JP") + "円";
}

function isSettled(row) {
  return (
    row.is_settled === true ||
    row.is_settled === 1 ||
    row.is_settled === "1" ||
    row.is_settled === "true"
  );
}

function receiptOcrId(row) {
  const direct = Number(
    row.payment_document_ocr_import_id || 0
  );

  if (Number.isFinite(direct) && direct > 0) {
    return direct;
  }

  const uploadId = textValue(
    row.receipt_upload_id
  );

  const match = uploadId.match(
    /^payment-document-(\d+)$/
  );

  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);

  return Number.isFinite(parsed) && parsed > 0
    ? parsed
    : null;
}

function appendTextCell(
  tr,
  value,
  className
) {
  const td = document.createElement("td");

  if (className) {
    td.className = className;
  }

  td.textContent = textValue(value);

  tr.appendChild(td);

  return td;
}

function fillSelect(
  select,
  values
) {
  const current = select.value;

  while (select.options.length > 1) {
    select.remove(1);
  }

  values.forEach(function (value) {
    const option = document.createElement("option");

    option.value = value;
    option.textContent = value;

    select.appendChild(option);
  });

  if (
    Array.from(select.options)
      .some(function (option) {
        return option.value === current;
      })
  ) {
    select.value = current;
  }
}

function buildMasterFilters(rows) {
  const accounts = Array.from(
    new Set(
      rows
        .map(function (row) {
          return textValue(
            row.account_title_name
          );
        })
        .filter(Boolean)
    )
  ).sort(function (a, b) {
    return a.localeCompare(
      b,
      "ja"
    );
  });

  const paymentMethods = Array.from(
    new Set(
      rows
        .map(function (row) {
          return textValue(
            row.payment_method_name
          );
        })
        .filter(Boolean)
    )
  ).sort(function (a, b) {
    return a.localeCompare(
      b,
      "ja"
    );
  });

  fillSelect(
    byId("filterAccount"),
    accounts
  );

  fillSelect(
    byId("filterPayment"),
    paymentMethods
  );
}

function filterDescription() {
  const descriptions = [];

  const from = byId("filterDateFrom").value;
  const to = byId("filterDateTo").value;
  const vendor = byId("filterVendor").value.trim();
  const account = byId("filterAccount").value;
  const payment = byId("filterPayment").value;
  const settled = byId("filterSettled").value;
  const keyword = byId("filterKeyword").value.trim();

  if (from) {
    descriptions.push("開始日=" + from);
  }

  if (to) {
    descriptions.push("終了日=" + to);
  }

  if (vendor) {
    descriptions.push("支払先=" + vendor);
  }

  if (account) {
    descriptions.push("勘定科目=" + account);
  }

  if (payment) {
    descriptions.push("支払方法=" + payment);
  }

  if (settled === "settled") {
    descriptions.push("精算済み");
  }

  if (settled === "unsettled") {
    descriptions.push("未精算");
  }

  if (keyword) {
    descriptions.push("全文=" + keyword);
  }

  return descriptions.length
    ? descriptions.join(" / ")
    : "指定なし";
}

function applyFilters() {
  const from = byId("filterDateFrom").value;
  const to = byId("filterDateTo").value;
  const vendor = byId("filterVendor")
    .value
    .trim()
    .toLowerCase();

  const account = byId("filterAccount").value;
  const payment = byId("filterPayment").value;
  const settled = byId("filterSettled").value;

  const keyword = byId("filterKeyword")
    .value
    .trim()
    .toLowerCase();

  receiptLedgerState.filteredRows =
    receiptLedgerState.rows.filter(
      function (row) {
        const transactionDate = dateValue(
          row.transaction_date
        );

        if (
          from &&
          transactionDate &&
          transactionDate < from
        ) {
          return false;
        }

        if (
          to &&
          transactionDate &&
          transactionDate > to
        ) {
          return false;
        }

        if (
          vendor &&
          !textValue(row.vendor_name)
            .toLowerCase()
            .includes(vendor)
        ) {
          return false;
        }

        if (
          account &&
          textValue(row.account_title_name) !==
            account
        ) {
          return false;
        }

        if (
          payment &&
          textValue(row.payment_method_name) !==
            payment
        ) {
          return false;
        }

        if (
          settled === "settled" &&
          !isSettled(row)
        ) {
          return false;
        }

        if (
          settled === "unsettled" &&
          isSettled(row)
        ) {
          return false;
        }

        if (keyword) {
          const searchText = [
            row.vendor_name,
            row.summary,
            row.account_title_name,
            row.purpose_name,
            row.target_person_name,
            row.payment_method_name,
            row.invoice_type_name,
            row.memo,
            row.original_file_name
          ]
            .map(textValue)
            .join(" ")
            .toLowerCase();

          if (!searchText.includes(keyword)) {
            return false;
          }
        }

        return true;
      }
    );

  renderLedger();
}

function renderSummary(rows) {
  const totalAmount = rows.reduce(
    function (sum, row) {
      return sum + numberValue(
        row.total_amount
      );
    },
    0
  );

  const taxAmount = rows.reduce(
    function (sum, row) {
      return sum + numberValue(
        row.tax_total_amount
      );
    },
    0
  );

  const unsettledCount = rows.filter(
    function (row) {
      return !isSettled(row);
    }
  ).length;

  byId("summaryCount").textContent =
    rows.length.toLocaleString("ja-JP") +
    "件";

  byId("summaryAmount").textContent =
    yen(totalAmount);

  byId("summaryTax").textContent =
    yen(taxAmount);

  byId("summaryUnsettled").textContent =
    unsettledCount.toLocaleString("ja-JP") +
    "件";

  byId("metaCount").textContent =
    rows.length.toLocaleString("ja-JP") +
    "件";
}

function openAnalysis(row) {
  const ocrId = receiptOcrId(row);

  if (!ocrId) {
    return;
  }

  window.location.href =
    "/receipts/receipt-list.html" +
    "?payment_document_ocr_import_id=" +
    encodeURIComponent(ocrId);
}

const receiptLedgerDetailCache = new Map();

function receiptDetailText(value) {
  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value);
}

function receiptDetailMoney(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return receiptDetailText(value);
  }

  return amount.toLocaleString("ja-JP") + " 円";
}

function receiptDetailQuantity(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  const quantity = Number(value);

  if (!Number.isFinite(quantity)) {
    return receiptDetailText(value);
  }

  if (Number.isInteger(quantity)) {
    return quantity.toLocaleString("ja-JP");
  }

  return quantity.toLocaleString(
    "ja-JP",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 8
    }
  );
}

function receiptDetailParentTax(fullReceipt) {
  const directCandidates = [
    fullReceipt &&
      fullReceipt.tax_total_amount,
    fullReceipt &&
      fullReceipt.taxTotalAmount,
    fullReceipt &&
      fullReceipt.tax_amount,
    fullReceipt &&
      fullReceipt.taxAmount
  ];

  for (const value of directCandidates) {
    if (
      value !== null &&
      value !== undefined &&
      value !== ""
    ) {
      return value;
    }
  }

  const details =
    fullReceipt &&
    Array.isArray(fullReceipt.details)
      ? fullReceipt.details
      : [];

  for (const detail of details) {
    const detailCandidates = [
      detail.tax_total_amount,
      detail.taxTotalAmount,
      detail.tax_amount,
      detail.taxAmount
    ];

    for (const value of detailCandidates) {
      if (
        value !== null &&
        value !== undefined &&
        value !== ""
      ) {
        return value;
      }
    }
  }

  return null;
}

function appendReceiptDetailQuantityCell(
  tr,
  value
) {
  const td = document.createElement("td");

  td.textContent =
    receiptDetailQuantity(value);

  td.className =
    "ledger-detail-quantity";

  tr.appendChild(td);
}
function closeLedgerDetailRows() {
  document
    .querySelectorAll(".ledger-detail-row")
    .forEach(function (detailRow) {
      detailRow.remove();
    });

  document
    .querySelectorAll(".ledger-detail-button")
    .forEach(function (button) {
      button.textContent = "明細";
      button.setAttribute(
        "aria-expanded",
        "false"
      );
    });
}

async function loadSavedReceiptDetail(receiptId) {
  const cacheKey = String(receiptId);

  if (receiptLedgerDetailCache.has(cacheKey)) {
    return receiptLedgerDetailCache.get(cacheKey);
  }

  const response = await fetch(
    "/api/receipts/saved/" +
    encodeURIComponent(receiptId)
  );

  const data = await response
    .json()
    .catch(function () {
      return {
        ok: false,
        error: "JSON読込失敗"
      };
    });

  if (
    !response.ok ||
    !data.ok ||
    !data.item
  ) {
    throw new Error(
      data.error ||
      "子明細を取得できませんでした。"
    );
  }

  receiptLedgerDetailCache.set(
    cacheKey,
    data.item
  );

  return data.item;
}

function appendReceiptDetailCell(
  tr,
  value,
  className
) {
  const td = document.createElement("td");

  td.textContent = receiptDetailText(value);

  if (className) {
    td.className = className;
  }

  tr.appendChild(td);
}

function appendReceiptDetailMoneyCell(
  tr,
  value
) {
  const td = document.createElement("td");

  td.textContent = receiptDetailMoney(value);
  td.className = "ledger-detail-money";

  tr.appendChild(td);
}

function createReceiptDetailContent(fullReceipt) {
  const detailBox = document.createElement("div");
  const detailTable = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  const tbody = document.createElement("tbody");

  detailBox.className = "ledger-detail-box";
  detailTable.className = "ledger-detail-table";

  const parentTaxSummary =
    document.createElement("div");

  const parentTaxLabel =
    document.createElement("span");

  const parentTaxAmount =
    document.createElement("strong");

  parentTaxSummary.className =
    "ledger-detail-tax-summary";

  parentTaxLabel.textContent =
    "レシート全体消費税";

  const parentTaxValue =
    receiptDetailParentTax(fullReceipt);

  parentTaxAmount.textContent =
    receiptDetailMoney(parentTaxValue) ||
    "0 円";

  parentTaxSummary.appendChild(
    parentTaxLabel
  );

  parentTaxSummary.appendChild(
    parentTaxAmount
  );

  detailBox.appendChild(
    parentTaxSummary
  );

  [
    "品名",
    "数量",
    "単価",
    "金額",
    "税額",
    "税区分",
    "税処理",
    "メモ"
  ].forEach(function (label) {
    const th = document.createElement("th");

    th.textContent = label;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);

  const details = Array.isArray(
    fullReceipt.details
  )
    ? fullReceipt.details
    : [];

  const childRows = [];

  details.forEach(function (detail) {
    const breakdowns = Array.isArray(
      detail.breakdowns
    )
      ? detail.breakdowns
      : [];

    breakdowns.forEach(function (breakdown) {
      childRows.push(breakdown);
    });
  });

  if (!childRows.length) {
    const emptyMessage =
      document.createElement("div");

    emptyMessage.className =
      "ledger-detail-empty";

    emptyMessage.textContent =
      "このレシートには子明細がありません。";

    detailBox.appendChild(emptyMessage);
    return detailBox;
  }

  childRows.forEach(function (row) {
    const tr = document.createElement("tr");

    appendReceiptDetailCell(
      tr,
      row.item_name ||
      row.itemName ||
      ""
    );

    appendReceiptDetailQuantityCell(
      tr,
      row.quantity !== undefined
        ? row.quantity
        : row.qty
    );

    appendReceiptDetailMoneyCell(
      tr,
      row.unit_price !== undefined
        ? row.unit_price
        : row.unitPrice
    );

    appendReceiptDetailMoneyCell(
      tr,
      row.amount
    );

    appendReceiptDetailMoneyCell(
      tr,
      row.tax_amount !== undefined
        ? row.tax_amount
        : row.taxAmount
    );

    appendReceiptDetailCell(
      tr,
      row.tax_category_name ||
      row.taxCategoryName ||
      ""
    );

    appendReceiptDetailCell(
      tr,
      row.tax_treatment_name ||
      row.taxTreatmentName ||
      ""
    );

    appendReceiptDetailCell(
      tr,
      row.note ||
      row.memo ||
      ""
    );

    tbody.appendChild(tr);
  });

  detailTable.appendChild(thead);
  detailTable.appendChild(tbody);
  detailBox.appendChild(detailTable);

  return detailBox;
}

function insertReceiptDetailRow(
  sourceRow,
  fullReceipt
) {
  const detailRow = document.createElement("tr");
  const detailCell = document.createElement("td");

  detailRow.className = "ledger-detail-row";
  detailCell.colSpan = 13;

  detailCell.appendChild(
    createReceiptDetailContent(fullReceipt)
  );

  detailRow.appendChild(detailCell);

  sourceRow.insertAdjacentElement(
    "afterend",
    detailRow
  );
}

function insertReceiptDetailError(
  sourceRow,
  message
) {
  const detailRow = document.createElement("tr");
  const detailCell = document.createElement("td");

  detailRow.className =
    "ledger-detail-row ledger-detail-error-row";

  detailCell.colSpan = 13;
  detailCell.className = "ledger-detail-error";
  detailCell.textContent = message;

  detailRow.appendChild(detailCell);

  sourceRow.insertAdjacentElement(
    "afterend",
    detailRow
  );
}

async function toggleLedgerDetail(
  button,
  sourceRow,
  row
) {
  const nextRow = sourceRow.nextElementSibling;

  if (
    nextRow &&
    nextRow.classList.contains(
      "ledger-detail-row"
    )
  ) {
    closeLedgerDetailRows();
    return;
  }

  closeLedgerDetailRows();

  button.disabled = true;
  button.textContent = "読込中";

  try {
    const receiptId = Number(
      row.receipt_id || 0
    );

    if (
      !Number.isFinite(receiptId) ||
      receiptId <= 0
    ) {
      throw new Error(
        "親レシートIDを取得できません。"
      );
    }

    const fullReceipt =
      await loadSavedReceiptDetail(
        receiptId
      );

    insertReceiptDetailRow(
      sourceRow,
      fullReceipt
    );

    button.textContent = "閉じる";
    button.setAttribute(
      "aria-expanded",
      "true"
    );
  }
  catch (error) {
    const message =
      error &&
      error.message
        ? error.message
        : String(error || "");

    insertReceiptDetailError(
      sourceRow,
      "子明細の読込に失敗しました。 " +
      message
    );

    button.textContent = "閉じる";
    button.setAttribute(
      "aria-expanded",
      "true"
    );

    console.error(
      "receipt ledger child detail load failed",
      error
    );
  }
  finally {
    button.disabled = false;
  }
}

function appendActionCell(tr, row) {
  const td = document.createElement("td");
  const buttonBox = document.createElement("div");
  const detailButton = document.createElement("button");
  const editButton = document.createElement("button");

  td.className = "ledger-actions";
  buttonBox.className = "ledger-action-buttons";

  detailButton.type = "button";
  detailButton.className =
    "ledger-action-button ledger-detail-button";
  detailButton.textContent = "明細";
  detailButton.setAttribute(
    "aria-expanded",
    "false"
  );

  detailButton.addEventListener(
    "click",
    function (event) {
      event.stopPropagation();

      toggleLedgerDetail(
        detailButton,
        tr,
        row
      );
    }
  );

  editButton.type = "button";
  editButton.className =
    "ledger-action-button ledger-edit-button";
  editButton.textContent = "編集";

  editButton.addEventListener(
    "click",
    function (event) {
      event.stopPropagation();
      openAnalysis(row);
    }
  );

  buttonBox.appendChild(detailButton);
  buttonBox.appendChild(editButton);
  td.appendChild(buttonBox);
  tr.appendChild(td);
}

function renderRows(rows) {
  const tbody = byId("detailBody");

  tbody.textContent = "";

  rows.forEach(function (row) {
    const tr = document.createElement("tr");
    const ocrId = receiptOcrId(row);

    if (ocrId) {
      tr.className = "is-clickable";
      tr.tabIndex = 0;
      tr.title =
        "解析画面で対象レシートを開く";

      tr.addEventListener(
        "click",
        function () {
          openAnalysis(row);
        }
      );

      tr.addEventListener(
        "keydown",
        function (event) {
          if (
            event.key === "Enter" ||
            event.key === " "
          ) {
            event.preventDefault();
            openAnalysis(row);
          }
        }
      );
    }
appendTextCell(
      tr,
      dateValue(row.transaction_date),
      "cell-center"
    );

    appendTextCell(
      tr,
      row.vendor_name
    );

    appendTextCell(
      tr,
      row.summary
    );

    appendTextCell(
      tr,
      row.account_title_name
    );

    appendTextCell(
      tr,
      row.purpose_name
    );

    appendTextCell(
      tr,
      row.target_person_name
    );

    appendTextCell(
      tr,
      row.payment_method_name
    );

    appendTextCell(
      tr,
      row.invoice_type_name
    );

    appendTextCell(
      tr,
      yen(row.total_amount),
      "cell-money"
    );

    appendTextCell(
      tr,
      yen(row.tax_total_amount),
      "cell-money"
    );

    const statusCell = document.createElement("td");
    statusCell.className = "cell-center";

    const badge = document.createElement("span");

    if (isSettled(row)) {
      badge.className =
        "status-badge is-settled";
      badge.textContent = "精算済み";
    }
    else {
      badge.className =
        "status-badge is-unsettled";
      badge.textContent = "未精算";
    }

    statusCell.appendChild(badge);
    tr.appendChild(statusCell);

    appendTextCell(
      tr,
      row.memo
    );

    appendActionCell(tr, row);

    tbody.appendChild(tr);
  });
}

function renderMessage(rows) {
  const message = byId("message");

  message.textContent = "";
  message.className = "";

  if (rows.length) {
    return;
  }

  message.className = "message is-empty";
  message.textContent =
    "条件に一致するレシートがありません。";
}

function renderLedger() {
  const rows = receiptLedgerState.filteredRows;

  renderSummary(rows);
  renderRows(rows);
  renderMessage(rows);

  byId("filterBox").textContent =
    "検索条件：" + filterDescription();

  byId("metaPrintedAt").textContent =
    new Date().toLocaleString("ja-JP");
}

async function loadReceiptLedger() {
  const message = byId("message");

  message.className = "message";
  message.textContent =
    "レシート台帳を読み込んでいます。";

  const response = await fetch(
    RECEIPT_LEDGER_ENDPOINT,
    {
      headers: {
        Accept: "application/json"
      },
      credentials: "same-origin"
    }
  );

  const data = await response
    .json()
    .catch(function () {
      return {};
    });

  if (!response.ok || data.ok === false) {
    throw new Error(
      data.error ||
      "保存済みレシートを取得できません。"
    );
  }

  const rows = Array.isArray(data.items)
    ? data.items
    : [];

  receiptLedgerState.rows = rows;
  receiptLedgerState.filteredRows =
    rows.slice();

  buildMasterFilters(rows);
  renderLedger();
}

function resetFilters() {
  byId("filterDateFrom").value = "";
  byId("filterDateTo").value = "";
  byId("filterVendor").value = "";
  byId("filterAccount").value = "";
  byId("filterPayment").value = "";
  byId("filterSettled").value = "";
  byId("filterKeyword").value = "";

  receiptLedgerState.filteredRows =
    receiptLedgerState.rows.slice();

  renderLedger();
}

function showLoadError(error) {
  const message = byId("message");

  message.className =
    "message is-error";

  message.textContent =
    "台帳を取得できませんでした。" +
    " " +
    (
      error && error.message
        ? error.message
        : String(error)
    );
}

byId("applyFilterBtn").addEventListener(
  "click",
  applyFilters
);

byId("resetFilterBtn").addEventListener(
  "click",
  resetFilters
);

byId("reloadBtn").addEventListener(
  "click",
  function () {
    window.location.reload();
  }
);

byId("printBtn").addEventListener(
  "click",
  function () {
    window.print();
  }
);

byId("filterVendor").addEventListener(
  "keydown",
  function (event) {
    if (event.key === "Enter") {
      applyFilters();
    }
  }
);

byId("filterKeyword").addEventListener(
  "keydown",
  function (event) {
    if (event.key === "Enter") {
      applyFilters();
    }
  }
);

loadReceiptLedger().catch(
  showLoadError
);