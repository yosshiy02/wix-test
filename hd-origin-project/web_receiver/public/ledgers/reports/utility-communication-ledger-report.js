"use strict";

const ENDPOINT =
  "/api/payment-documents/utility-communication/list";

function text(value) {
  return value === null || value === undefined
    ? ""
    : String(value);
}

function escapeHtml(value) {
  return text(value).replace(/[&<>"']/g, function (character) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character];
  });
}

function number(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsed = Number(
    String(value).replace(/[^\d.-]/g, "")
  );

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function money(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const parsed = number(value);

  return parsed.toLocaleString("ja-JP") + "円";
}

function date(value) {
  const source = text(value).slice(0, 10);

  return source
    ? source.replace(/-/g, "/")
    : "";
}

function field(row, code) {
  const sources = [
    row.visible_fields_json,
    row.specialist_fields_json
  ];

  for (const source of sources) {
    if (
      source &&
      source[code] !== null &&
      source[code] !== undefined &&
      source[code] !== ""
    ) {
      return source[code];
    }
  }

  return "";
}

function lineItems(row) {
  return Array.isArray(row.line_items)
    ? row.line_items
    : [];
}

function sumLines(lines, propertyName) {
  return lines.reduce(function (sum, line) {
    return sum + number(line[propertyName]);
  }, 0);
}

function usageText(row) {
  const quantity =
    row.usage_quantity ||
    field(row, "usage_quantity");

  const unit =
    row.usage_unit ||
    field(row, "usage_unit");

  if (
    quantity === null ||
    quantity === undefined ||
    quantity === ""
  ) {
    return "";
  }

  return text(quantity) + text(unit);
}

function taxRate(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const parsed = number(value);

  if (!Number.isFinite(parsed)) {
    return text(value);
  }

  return (
    parsed <= 1
      ? parsed * 100
      : parsed
  ).toLocaleString("ja-JP") + "%";
}

function detailField(label, value, className) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return (
    '<div class="detail-field ' +
    escapeHtml(className || "") +
    '">' +
      "<strong>" +
        escapeHtml(label) +
      "</strong>" +
      "<span>" +
        escapeHtml(value) +
      "</span>" +
    "</div>"
  );
}

function renderDetails(lines) {
  if (!lines.length) {
    return '<p>料金明細は登録されていません。</p>';
  }

  return (
    '<div class="detail-list">' +
    lines.map(function (line, index) {
      const usage =
        line.usage_quantity !== null &&
        line.usage_quantity !== undefined &&
        line.usage_quantity !== ""
          ? text(line.usage_quantity) +
            text(line.usage_unit)
          : "";

      const title =
        line.item_name ||
        "明細 " + text(index + 1);

      return (
        '<article class="detail-item">' +
          "<h3>" +
            escapeHtml(title) +
          "</h3>" +

          '<div class="detail-grid">' +
            detailField(
              "説明",
              line.description
            ) +

            detailField(
              "使用量",
              usage
            ) +

            detailField(
              "単価",
              money(line.unit_price)
            ) +

            detailField(
              "税抜金額",
              money(line.subtotal_amount)
            ) +

            detailField(
              "税区分",
              line.tax_category_label
            ) +

            detailField(
              "税率",
              taxRate(line.tax_rate)
            ) +

            detailField(
              "消費税額",
              money(line.tax_amount)
            ) +

            detailField(
              "合計金額",
              money(line.total_amount)
            ) +

            detailField(
              "OCR根拠",
              line.source_text,
              "source-text"
            ) +
          "</div>" +
        "</article>"
      );
    }).join("") +
    "</div>"
  );
}

function render(rows) {
  const body =
    document.getElementById("ledgerBody");

  if (!rows.length) {
    body.innerHTML =
      '<tr class="empty">' +
        '<td colspan="11">' +
          "登録済みデータはありません。" +
        "</td>" +
      "</tr>";

    return;
  }

  body.innerHTML = rows.map(function (row, index) {
    const lines = lineItems(row);
    /* GPT3_UTILITY_LEDGER_EDIT_BUTTON_START */
    const ocrImportId =
      Number(
        row.payment_document_ocr_import_id ||
        row.paymentDocumentOcrImportId ||
        row.ocr_import_id ||
        row.ocrImportId ||
        0
      ) || 0;
    /* GPT3_UTILITY_LEDGER_EDIT_BUTTON_END */

    const subtotal =
      sumLines(lines, "subtotal_amount");

    const taxAmount =
      sumLines(lines, "tax_amount");

    const total =
      sumLines(lines, "total_amount");

    const detailId =
      "utility-detail-" +
      text(row.utility_communication_draft_id);

    const mainRow =
      "<tr>" +
        "<td>" +
          escapeHtml(index + 1) +
        "</td>" +

        "<td>" +
          escapeHtml(
            row.original_file_name ||
            row.saved_file_name
          ) +
        "</td>" +

        "<td>" +
          escapeHtml(
            row.customer_number ||
            field(row, "customer_number")
          ) +
        "</td>" +

        "<td>" +
          escapeHtml(
            row.supply_point_number ||
            field(row, "supply_point_number")
          ) +
        "</td>" +

        "<td>" +
          escapeHtml(
            date(
              row.meter_reading_date ||
              field(row, "meter_reading_date")
            )
          ) +
        "</td>" +

        "<td>" +
          escapeHtml(usageText(row)) +
        "</td>" +

        '<td class="money">' +
          escapeHtml(lines.length) +
        "</td>" +

        '<td class="money">' +
          escapeHtml(money(subtotal)) +
        "</td>" +

        '<td class="money">' +
          escapeHtml(money(taxAmount)) +
        "</td>" +

        '<td class="money">' +
          escapeHtml(money(total)) +
        "</td>" +

        "<td>" +
          '<button type="button" ' +
            'class="detail-toggle" ' +
            'data-detail-target="' +
            escapeHtml(detailId) +
            '" ' +
            'aria-expanded="false">' +
            "明細" +
          "</button>" +
          '<button type="button" ' +
            'class="utility-edit-open" ' +
            'data-ocr-import-id="' +
            escapeHtml(ocrImportId) +
            '">' +
            "修正" +
          "</button>" +
        "</td>" +
      "</tr>";

    const detailRow =
      '<tr id="' +
        escapeHtml(detailId) +
        '" class="detail-row" hidden>' +

        '<td colspan="11">' +
          renderDetails(lines) +
        "</td>" +
      "</tr>";

    return mainRow + detailRow;
  }).join("");

    /* GPT3_UTILITY_LEDGER_EDIT_LISTENER_START */
  body.querySelectorAll(
    ".utility-edit-open"
  ).forEach(function (button) {
    button.addEventListener(
      "click",
      function () {
        const ocrImportId =
          Number(
            button.dataset.ocrImportId ||
            0
          );

        if (!ocrImportId) {
          return;
        }

        location.href =
          "/payables/payment-document-specialist-utility-communication.html" +
          "?ocr_import_id=" +
          encodeURIComponent(
            String(ocrImportId)
          );
      }
    );
  });
  /* GPT3_UTILITY_LEDGER_EDIT_LISTENER_END */

  body.querySelectorAll(
    ".detail-toggle"
  ).forEach(function (button) {
    button.addEventListener(
      "click",
      function () {
        const target =
          document.getElementById(
            button.dataset.detailTarget
          );

        if (!target) {
          return;
        }

        const opening =
          target.hidden;

        target.hidden =
          !opening;

        button.setAttribute(
          "aria-expanded",
          opening ? "true" : "false"
        );

        button.textContent =
          opening ? "閉じる" : "明細";
      }
    );
  });
}

function updateSummary(rows) {
  const allLines =
    rows.flatMap(lineItems);

  const subtotal =
    sumLines(
      allLines,
      "subtotal_amount"
    );

  const total =
    sumLines(
      allLines,
      "total_amount"
    );

  document.getElementById(
    "recordCount"
  ).textContent =
    rows.length.toLocaleString("ja-JP");

  document.getElementById(
    "lineItemCount"
  ).textContent =
    allLines.length.toLocaleString("ja-JP");

  document.getElementById(
    "subtotalAmount"
  ).textContent =
    money(subtotal) || "0円";

  document.getElementById(
    "totalAmount"
  ).textContent =
    money(total) || "0円";
}

async function main() {
  const status =
    document.getElementById("loadStatus");

  try {
    const response =
      await fetch(
        ENDPOINT,
        {
          headers: {
            Accept: "application/json"
          },
          credentials: "same-origin",
          cache: "no-store"
        }
      );

    const payload =
      await response.json();

    if (
      !response.ok ||
      !payload.ok
    ) {
      throw new Error(
        payload.error ||
        response.statusText
      );
    }

    const rows =
      Array.isArray(payload.rows)
        ? payload.rows
        : [];

    updateSummary(rows);
    render(rows);

    status.textContent =
      rows.length +
      "件を表示しています。";
  }
  catch (error) {
    status.classList.add("error");

    status.textContent =
      "読み込みエラー: " +
      error.message;

    updateSummary([]);
    render([]);
  }
}

main();