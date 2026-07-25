"use strict";

const ENDPOINT = "/api/payables";

function text(value) {
  return value === null || value === undefined
    ? ""
    : String(value);
}

function first() {
  for (const value of arguments) {
    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }

  return "";
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

function numberValue(value) {
  const number = Number(
    text(value).replace(/[^\d.-]/g, "")
  );

  return Number.isFinite(number)
    ? number
    : 0;
}

function money(value) {
  return numberValue(value).toLocaleString("ja-JP") + "円";
}

function date(value) {
  const source = text(value).slice(0, 10);

  return source
    ? source.replace(/-/g, "/")
    : "";
}

function payableId(row) {
  return first(
    row.payable_id,
    row.payableId,
    row.id
  );
}

function statusValue(row) {
  return first(
    row.status,
    row.payable_status,
    row.payableStatus,
    row.document_status,
    row.documentStatus
  );
}

function lineItems(row) {
  const candidates = [
    row.lines,
    row.line_items,
    row.lineItems,
    row.details,
    row.items
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function detailHtml(row) {
  const lines = lineItems(row);

  const linesHtml = lines.length
    ? (
        "<ul>" +
        lines.map(function (line) {
          return (
            "<li>" +
            [
              first(
                line.item_name,
                line.itemName,
                line.description
              ),
              first(
                line.amount_in_tax,
                line.amountInTax
              ) !== ""
                ? money(
                    first(
                      line.amount_in_tax,
                      line.amountInTax
                    )
                  )
                : "",
              first(
                line.tax_rate,
                line.taxRate
              ) !== ""
                ? "税率 " +
                  escapeHtml(
                    first(
                      line.tax_rate,
                      line.taxRate
                    )
                  ) +
                  "%"
                : ""
            ]
              .filter(Boolean)
              .map(escapeHtml)
              .join(" ／ ") +
            "</li>"
          );
        }).join("") +
        "</ul>"
      )
    : "明細は登録されていません。";

  return (
    '<div class="detail-panel">' +
      '<div class="detail-block">' +
        "<strong>摘要</strong>" +
        escapeHtml(
          first(
            row.summary,
            row.memo,
            row.internal_note,
            row.internalNote
          )
        ) +
      "</div>" +

      '<div class="detail-block">' +
        "<strong>会社</strong>" +
        escapeHtml(
          first(
            row.company_name,
            row.companyName
          )
        ) +
      "</div>" +

      '<div class="detail-block">' +
        "<strong>証憑状態</strong>" +
        escapeHtml(
          first(
            row.evidence_status,
            row.evidenceStatus
          )
        ) +
      "</div>" +

      '<div class="detail-block detail-lines">' +
        "<strong>明細</strong>" +
        linesHtml +
      "</div>" +
    "</div>"
  );
}

function renderSummary(rows) {
  const draftCount = rows.filter(function (row) {
    return statusValue(row) === "draft";
  }).length;

  const confirmedCount = rows.filter(function (row) {
    return statusValue(row) === "confirmed";
  }).length;

  const unpaidTotal = rows.reduce(function (total, row) {
    return total + numberValue(
      first(
        row.remaining_amount,
        row.remainingAmount,
        row.unpaid_amount,
        row.unpaidAmount,
        row.amount_in_tax,
        row.amountInTax,
        row.total_amount,
        row.totalAmount
      )
    );
  }, 0);

  document.getElementById("recordCount").textContent =
    rows.length.toLocaleString("ja-JP");

  document.getElementById("draftCount").textContent =
    draftCount.toLocaleString("ja-JP");

  document.getElementById("confirmedCount").textContent =
    confirmedCount.toLocaleString("ja-JP");

  document.getElementById("unpaidTotal").textContent =
    money(unpaidTotal);
}

function render(rows) {
  const body = document.getElementById("ledgerBody");

  renderSummary(rows);

  if (!rows.length) {
    body.innerHTML =
      '<tr class="empty"><td colspan="15">登録済みデータはありません。</td></tr>';

    return;
  }

  body.innerHTML = rows.map(function (row, index) {
    const id = payableId(row);
    const detailId = "invoice-payable-detail-" + text(id || index);
    const otherMenuId = "invoice-payable-other-" + text(id || index);

    const totalAmount = first(
      row.amount_in_tax,
      row.amountInTax,
      row.total_amount,
      row.totalAmount
    );

    const paidAmount = first(
      row.paid_amount,
      row.paidAmount,
      0
    );

    const remainingAmount = first(
      row.remaining_amount,
      row.remainingAmount,
      row.unpaid_amount,
      row.unpaidAmount,
      numberValue(totalAmount) - numberValue(paidAmount)
    );

    const mainRow =
      "<tr>" +
        "<td>" + escapeHtml(index + 1) + "</td>" +
        "<td>" +
          escapeHtml(
            first(
              row.payable_no,
              row.payableNo,
              id
            )
          ) +
        "</td>" +
        "<td>" + escapeHtml(statusValue(row)) + "</td>" +
        "<td>" +
          escapeHtml(
            first(
              row.document_type,
              row.documentType,
              row.evidence_type,
              row.evidenceType
            )
          ) +
        "</td>" +
        "<td>" +
          escapeHtml(
            first(
              row.vendor_name,
              row.vendorName,
              row.issuer_name,
              row.issuerName
            )
          ) +
        "</td>" +
        "<td>" +
          escapeHtml(
            first(
              row.invoice_number,
              row.invoiceNumber,
              row.document_number,
              row.documentNumber
            )
          ) +
        "</td>" +
        "<td>" +
          escapeHtml(
            date(
              first(
                row.invoice_date,
                row.invoiceDate,
                row.document_date,
                row.documentDate
              )
            )
          ) +
        "</td>" +
        "<td>" +
          escapeHtml(
            date(
              first(
                row.payment_due_date,
                row.paymentDueDate,
                row.due_date,
                row.dueDate
              )
            )
          ) +
        "</td>" +
        '<td class="money">' +
          escapeHtml(money(totalAmount)) +
        "</td>" +
        '<td class="money">' +
          escapeHtml(money(paidAmount)) +
        "</td>" +
        '<td class="money">' +
          escapeHtml(money(remainingAmount)) +
        "</td>" +
        "<td>" +
          escapeHtml(
            first(
              row.evidence_file_name,
              row.evidenceFileName,
              row.original_file_name,
              row.originalFileName
            )
          ) +
        "</td>" +

        '<td><button type="button" class="ledger-button edit-button" ' +
          'data-payable-id="' + escapeHtml(id) + '">' +
          "編集</button></td>" +

        '<td><button type="button" class="ledger-button detail-button" ' +
          'data-detail-target="' + escapeHtml(detailId) + '" ' +
          'aria-expanded="false">明細</button></td>' +

        '<td class="other-menu-cell">' +
          '<button type="button" class="ledger-button other-button" ' +
            'data-menu-target="' + escapeHtml(otherMenuId) + '" ' +
            'aria-expanded="false">その他</button>' +

          '<div id="' + escapeHtml(otherMenuId) + '" class="other-menu" hidden>' +
            '<button type="button" class="open-payable-button" ' +
              'data-payable-id="' + escapeHtml(id) + '">' +
              "未払管理で開く" +
            "</button>" +

            '<button type="button" class="copy-number-button" ' +
              'data-payable-number="' +
              escapeHtml(
                first(
                  row.payable_no,
                  row.payableNo,
                  id
                )
              ) +
              '">' +
              "管理番号をコピー" +
            "</button>" +
          "</div>" +
        "</td>" +
      "</tr>";

    const detailRow =
      '<tr id="' + escapeHtml(detailId) + '" class="detail-row" hidden>' +
        '<td colspan="15">' +
          detailHtml(row) +
        "</td>" +
      "</tr>";

    return mainRow + detailRow;
  }).join("");

  body.querySelectorAll(".detail-button").forEach(function (button) {
    button.addEventListener("click", function () {
      const target = document.getElementById(
        button.dataset.detailTarget
      );

      if (!target) {
        return;
      }

      const opening = target.hidden;

      target.hidden = !opening;

      button.setAttribute(
        "aria-expanded",
        opening ? "true" : "false"
      );

      button.textContent =
        opening ? "閉じる" : "明細";
    });
  });

  body.querySelectorAll(".other-button").forEach(function (button) {
    button.addEventListener("click", function () {
      const target = document.getElementById(
        button.dataset.menuTarget
      );

      if (!target) {
        return;
      }

      const opening = target.hidden;

      document.querySelectorAll(".other-menu").forEach(function (menu) {
        menu.hidden = true;
      });

      document.querySelectorAll(".other-button").forEach(function (otherButton) {
        otherButton.setAttribute("aria-expanded", "false");
      });

      target.hidden = !opening;

      button.setAttribute(
        "aria-expanded",
        opening ? "true" : "false"
      );
    });
  });

  body.querySelectorAll(".edit-button").forEach(function (button) {
    button.addEventListener("click", function () {
      const id = button.dataset.payableId;

      location.href =
        "/payables/payable-list.html?id=" +
        encodeURIComponent(id);
    });
  });

  body.querySelectorAll(".open-payable-button").forEach(function (button) {
    button.addEventListener("click", function () {
      const id = button.dataset.payableId;

      location.href =
        "/payables/payable-list.html?id=" +
        encodeURIComponent(id);
    });
  });

  body.querySelectorAll(".copy-number-button").forEach(function (button) {
    button.addEventListener("click", async function () {
      const value = button.dataset.payableNumber || "";

      try {
        await navigator.clipboard.writeText(value);
        window.alert("管理番号をコピーしました。");
      }
      catch (error) {
        window.alert(
          "管理番号をコピーできませんでした。\n" +
          (
            error && error.message
              ? error.message
              : String(error)
          )
        );
      }
    });
  });
}

async function main() {
  const status = document.getElementById("loadStatus");

  try {
    const response = await fetch(
      ENDPOINT,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json"
        },
        credentials: "same-origin"
      }
    );

    const payload = await response.json();

    if (
      !response.ok ||
      !payload.ok ||
      !Array.isArray(payload.items)
    ) {
      throw new Error(
        payload.error ||
        payload.message ||
        "請求・未払台帳を取得できませんでした。"
      );
    }

    render(payload.items);

    status.textContent =
      "登録件数: " +
      payload.items.length.toLocaleString("ja-JP") +
      "件";
  }
  catch (error) {
    status.classList.add("error");

    status.textContent =
      "請求・未払台帳の読込に失敗しました: " +
      (
        error && error.message
          ? error.message
          : String(error)
      );

    document.getElementById("ledgerBody").innerHTML =
      '<tr class="empty"><td colspan="15">台帳データを表示できません。</td></tr>';
  }
}

main();