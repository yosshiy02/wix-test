"use strict";

/* GPT3_UTILITY_LEDGER_FULL_REBUILD_START */
const ENDPOINT =
  "/api/payment-documents/utility-communication/list";

function text(value) {
  return value === null ||
    value === undefined
      ? ""
      : String(value);
}

function escapeHtml(value) {
  return text(value).replace(
    /[&<>"']/g,
    function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[character];
    }
  );
}

function first() {
  for (const value of arguments) {
    if (
      value !== null &&
      value !== undefined &&
      value !== ""
    ) {
      return value;
    }
  }

  return "";
}

function field(row, name) {
  const sources = [
    row.visible_fields_json,
    row.specialist_fields_json,
    row.fields,
    row.draft_json &&
      row.draft_json.fields
  ];

  for (const source of sources) {
    if (
      source &&
      typeof source === "object" &&
      !Array.isArray(source) &&
      Object.prototype.hasOwnProperty.call(
        source,
        name
      )
    ) {
      return source[name];
    }
  }

  return "";
}

function lineItems(row) {
  const candidates = [
    row.line_items,
    field(row, "line_items")
  ];

  return (
    candidates.find(Array.isArray) ||
    []
  );
}

function numeric(value) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

function money(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "";
  }

  return numeric(value).toLocaleString(
    "ja-JP"
  ) + "円";
}

function date(value) {
  const source =
    text(value);

  return source
    ? source.slice(0, 10)
    : "";
}

function period(row) {
  const start =
    date(
      field(
        row,
        "usage_period_start"
      )
    );

  const end =
    date(
      field(
        row,
        "usage_period_end"
      )
    );

  if (start && end) {
    return start + " ～ " + end;
  }

  return first(
    start,
    end
  );
}

function usage(row) {
  const quantity =
    first(
      row.usage_quantity,
      field(
        row,
        "usage_quantity"
      )
    );

  const unit =
    first(
      row.usage_unit,
      field(
        row,
        "usage_unit"
      )
    );

  if (
    quantity === "" &&
    unit === ""
  ) {
    return "";
  }

  return [
    quantity,
    unit
  ].filter(function (value) {
    return value !== "";
  }).join(" ");
}

function sumLines(lines, key) {
  return lines.reduce(
    function (sum, line) {
      return sum +
        numeric(line[key]);
    },
    0
  );
}

function setText(ids, value) {
  for (const id of ids) {
    const element =
      document.getElementById(id);

    if (element) {
      element.textContent =
        value;

      return;
    }
  }
}

function updateSummary(rows) {
  const lines =
    rows.reduce(
      function (all, row) {
        return all.concat(
          lineItems(row)
        );
      },
      []
    );

  const subtotal =
    lines.reduce(
      function (sum, line) {
        return sum +
          numeric(
            line.subtotal_amount
          );
      },
      0
    );

  const total =
    rows.reduce(
      function (sum, row) {
        const rowLines =
          lineItems(row);

        const value =
          first(
            field(
              row,
              "total_amount"
            ),
            rowLines.length
              ? sumLines(
                  rowLines,
                  "total_amount"
                )
              : ""
          );

        return sum +
          numeric(value);
      },
      0
    );

  setText(
    [
      "recordCount",
      "registeredCount"
    ],
    rows.length.toLocaleString("ja-JP")
  );

  setText(
    [
      "lineItemCount",
      "detailCount"
    ],
    lines.length.toLocaleString("ja-JP")
  );

  setText(
    [
      "subtotalAmount",
      "subtotalTotal"
    ],
    money(subtotal)
  );

  setText(
    [
      "totalAmount",
      "totalTotal"
    ],
    money(total)
  );
}

function renderDetails(lines) {
  if (!lines.length) {
    return (
      '<p class="utility-ledger-empty-detail">' +
      "料金明細は登録されていません。" +
      "</p>"
    );
  }

  return (
    '<div class="utility-ledger-detail-wrap">' +
      '<table class="utility-ledger-detail-table">' +
        "<thead>" +
          "<tr>" +
            "<th>No.</th>" +
            "<th>料金項目</th>" +
            "<th>説明</th>" +
            "<th>使用量</th>" +
            "<th>単価</th>" +
            "<th>小計</th>" +
            "<th>税区分</th>" +
            "<th>税率</th>" +
            "<th>記載税額</th>" +
            "<th>合計</th>" +
            "<th>OCR根拠</th>" +
          "</tr>" +
        "</thead>" +
        "<tbody>" +
          lines.map(function (line, index) {
            const usageText = [
              first(
                line.usage_quantity,
                ""
              ),
              first(
                line.usage_unit,
                ""
              )
            ].filter(function (value) {
              return value !== "";
            }).join(" ");

            const taxRate =
              line.tax_rate === null ||
              line.tax_rate === undefined ||
              line.tax_rate === ""
                ? ""
                : (
                    numeric(
                      line.tax_rate
                    ) *
                    100
                  ).toLocaleString(
                    "ja-JP"
                  ) + "%";

            return (
              "<tr>" +
                "<td>" +
                  escapeHtml(
                    first(
                      line.line_no,
                      index + 1
                    )
                  ) +
                "</td>" +
                "<td>" +
                  escapeHtml(
                    line.item_name
                  ) +
                "</td>" +
                "<td>" +
                  escapeHtml(
                    line.description
                  ) +
                "</td>" +
                "<td>" +
                  escapeHtml(
                    usageText
                  ) +
                "</td>" +
                '<td class="money">' +
                  escapeHtml(
                    money(
                      line.unit_price
                    )
                  ) +
                "</td>" +
                '<td class="money">' +
                  escapeHtml(
                    money(
                      line.subtotal_amount
                    )
                  ) +
                "</td>" +
                "<td>" +
                  escapeHtml(
                    first(
                      line.tax_category_label,
                      line.raw_item_json &&
                        line.raw_item_json.tax_category_label
                    )
                  ) +
                "</td>" +
                "<td>" +
                  escapeHtml(
                    taxRate
                  ) +
                "</td>" +
                '<td class="money">' +
                  escapeHtml(
                    money(
                      line.tax_amount
                    )
                  ) +
                "</td>" +
                '<td class="money">' +
                  escapeHtml(
                    money(
                      line.total_amount
                    )
                  ) +
                "</td>" +
                '<td class="source-text">' +
                  escapeHtml(
                    line.source_text
                  ) +
                "</td>" +
              "</tr>"
            );
          }).join("") +
        "</tbody>" +
      "</table>" +
    "</div>"
  );
}

function render(rows) {
  const body =
    document.getElementById(
      "ledgerBody"
    );

  if (!body) {
    return;
  }

  if (!rows.length) {
    body.innerHTML =
      '<tr class="empty">' +
        '<td colspan="14">' +
          "登録済みデータはありません。" +
        "</td>" +
      "</tr>";

    return;
  }

  body.innerHTML =
    rows.map(function (row, index) {
      const lines =
        lineItems(row);

      const subtotal =
        first(
          field(
            row,
            "subtotal_amount"
          ),
          lines.length
            ? sumLines(
                lines,
                "subtotal_amount"
              )
            : ""
        );

      const taxAmount =
        first(
          field(
            row,
            "tax_amount"
          ),
          lines.length
            ? sumLines(
                lines,
                "tax_amount"
              )
            : ""
        );

      const total =
        first(
          field(
            row,
            "total_amount"
          ),
          lines.length
            ? sumLines(
                lines,
                "total_amount"
              )
            : ""
        );

      const detailId =
        "utility-detail-" +
        text(
          row.utility_communication_draft_id
        );

      const ocrImportId =
        first(
          row.payment_document_ocr_import_id,
          row.paymentDocumentOcrImportId
        );

      const service =
        first(
          field(
            row,
            "service_type_label"
          ),
          field(
            row,
            "document_type_label"
          )
        );

      const provider =
        first(
          field(
            row,
            "provider_name"
          ),
          row.provider_name
        );

      const account =
        field(
          row,
          "account_name"
        );

      const billingDate =
        date(
          first(
            field(
              row,
              "billing_date"
            ),
            field(
              row,
              "issue_date"
            )
          )
        );

      const fileName =
        first(
          row.original_file_name,
          row.saved_file_name
        );

      const mainRow =
        "<tr>" +
          "<td>" +
            escapeHtml(index + 1) +
          "</td>" +
          "<td>" +
            escapeHtml(service) +
          "</td>" +
          "<td>" +
            escapeHtml(provider) +
          "</td>" +
          "<td>" +
            escapeHtml(account) +
          "</td>" +
          "<td>" +
            escapeHtml(billingDate) +
          "</td>" +
          "<td>" +
            escapeHtml(
              period(row)
            ) +
          "</td>" +
          "<td>" +
            escapeHtml(
              usage(row)
            ) +
          "</td>" +
          '<td class="money">' +
            escapeHtml(
              lines.length
            ) +
          "</td>" +
          '<td class="money">' +
            escapeHtml(
              money(subtotal)
            ) +
          "</td>" +
          '<td class="money">' +
            escapeHtml(
              money(taxAmount)
            ) +
          "</td>" +
          '<td class="money">' +
            escapeHtml(
              money(total)
            ) +
          "</td>" +
          "<td>" +
            escapeHtml(fileName) +
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
          "</td>" +
          "<td>" +
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
          '<td colspan="14">' +
            renderDetails(lines) +
          "</td>" +
        "</tr>";

      return (
        mainRow +
        detailRow
      );
    }).join("");

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
          opening
            ? "true"
            : "false"
        );
      }
    );
  });

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
}

async function main() {
  const status =
    document.getElementById(
      "loadStatus"
    ) ||
    document.getElementById(
      "status"
    );

  try {
    const response =
      await fetch(
        ENDPOINT,
        {
          cache: "no-store",
          headers: {
            Accept: "application/json"
          }
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
        "公共料金・通信費帳面を読み込めません。"
      );
    }

    const rows =
      Array.isArray(payload.rows)
        ? payload.rows
        : [];

    updateSummary(rows);
    render(rows);

    if (status) {
      status.classList.remove(
        "error"
      );

      status.textContent =
        rows.length +
        "件を表示しています。";
    }
  }
  catch (error) {
    updateSummary([]);
    render([]);

    if (status) {
      status.classList.add(
        "error"
      );

      status.textContent =
        "読み込みエラー: " +
        error.message;
    }
  }
}

main();
/* GPT3_UTILITY_LEDGER_FULL_REBUILD_END */