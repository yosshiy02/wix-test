"use strict";

(function () {
  const ledgerBody = document.getElementById("ledgerBody");
  const ledgerStatus = document.getElementById("ledgerStatus");
  const recordCount = document.getElementById("recordCount");
  const totalAmount = document.getElementById("totalAmount");
  const reviewCount = document.getElementById("reviewCount");
  const ledgerSearch = document.getElementById("ledgerSearch");
  const reloadButton = document.getElementById("reloadButton");
  const otherModal = document.getElementById("otherModal");
  const otherModalBody = document.getElementById("otherModalBody");
  const otherModalClose = document.getElementById("otherModalClose");

  let rows = [];

  function text(value) {
    return value === null || value === undefined
      ? ""
      : String(value).trim();
  }

  function escapeHtml(value) {
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function amount(value) {
    const number = Number(
      text(value).replace(/[￥¥円,\s]/g, "")
    );

    if (!Number.isFinite(number)) {
      return "";
    }

    return number.toLocaleString("ja-JP") + "円";
  }

  function rowValue(row, names) {
    for (const name of names) {
      if (
        Object.prototype.hasOwnProperty.call(row, name) &&
        text(row[name])
      ) {
        return row[name];
      }
    }

    return "";
  }

  function rowId(row, index) {
    return text(
      rowValue(row, [
        "paymentDocumentOcrImportId",
        "payment_document_ocr_import_id",
        "ocrImportId",
        "id"
      ])
    ) || String(index + 1);
  }

  function detailHtml(row) {
    const details = [
      ["証憑区分", rowValue(row, ["documentType", "document_type", "証憑区分"])],
      ["納付番号", rowValue(row, ["paymentNumber", "payment_number", "納付番号"])],
      ["通知書番号", rowValue(row, ["noticeNumber", "notice_number", "通知書番号"])],
      ["本税", amount(rowValue(row, ["baseTaxAmount", "base_tax_amount", "本税"]))],
      ["附帯税・延滞金", amount(rowValue(row, ["additionalTaxAmount", "lateFeeAmount", "附帯税", "延滞金"]))],
      ["支払方法", rowValue(row, ["paymentMethod", "payment_method", "支払方法"])],
      ["摘要", rowValue(row, ["summary", "摘要"])],
      ["人間メモ", rowValue(row, ["humanMemo", "human_memo", "人間メモ"])]
    ];

    return (
      '<div class="detail-panel">' +
        '<div class="detail-grid">' +
          details.map(function (item) {
            return (
              '<div class="detail-item">' +
                "<span>" + escapeHtml(item[0]) + "</span>" +
                "<strong>" + escapeHtml(item[1] || "登録なし") + "</strong>" +
              "</div>"
            );
          }).join("") +
        "</div>" +
      "</div>"
    );
  }

  function renderOther(row) {
    const entries = [
      ["OCR取込ID", rowValue(row, ["paymentDocumentOcrImportId", "payment_document_ocr_import_id"])],
      ["専門解析ID", rowValue(row, ["specialistAnalysisResultId", "specialist_analysis_result_id"])],
      ["元ファイル名", rowValue(row, ["originalFileName", "original_file_name"])],
      ["AI信頼度", rowValue(row, ["aiConfidence", "ai_confidence"])],
      ["AI判定理由", rowValue(row, ["aiReason", "ai_reason"])],
      ["警告", rowValue(row, ["warnings", "warnings_json"])],
      ["登録日時", rowValue(row, ["createdAt", "created_at"])],
      ["更新日時", rowValue(row, ["updatedAt", "updated_at"])]
    ];

    otherModalBody.innerHTML =
      '<dl class="other-list">' +
      entries.map(function (item) {
        let value = item[1];

        if (typeof value === "object" && value !== null) {
          try {
            value = JSON.stringify(value, null, 2);
          } catch (error) {
            value = String(value);
          }
        }

        return (
          "<dt>" + escapeHtml(item[0]) + "</dt>" +
          "<dd>" + escapeHtml(value || "登録なし") + "</dd>"
        );
      }).join("") +
      "</dl>";

    otherModal.hidden = false;
  }

  function closeOtherModal() {
    otherModal.hidden = true;
    otherModalBody.innerHTML = "";
  }

  function render(inputRows) {
    rows = Array.isArray(inputRows)
      ? inputRows.slice()
      : [];

    const query = text(ledgerSearch.value).toLowerCase();

    const filteredRows = rows.filter(function (row) {
      if (!query) {
        return true;
      }

      return JSON.stringify(row)
        .toLowerCase()
        .includes(query);
    });

    const total = rows.reduce(function (sum, row) {
      const value = Number(
        text(
          rowValue(row, [
            "totalAmount",
            "total_amount",
            "paymentAmount",
            "納付額"
          ])
        ).replace(/[￥¥円,\s]/g, "")
      );

      return sum + (
        Number.isFinite(value)
          ? value
          : 0
      );
    }, 0);

    const reviews = rows.filter(function (row) {
      return (
        rowValue(row, ["needsReview", "needs_review"]) === true ||
        text(rowValue(row, ["currentStatus", "current_status", "状態"]))
          .includes("要確認")
      );
    }).length;

    recordCount.textContent = String(rows.length);
    totalAmount.textContent = total.toLocaleString("ja-JP") + "円";
    reviewCount.textContent = String(reviews);

    if (filteredRows.length === 0) {
      ledgerBody.innerHTML =
        '<tr class="empty-row">' +
          '<td colspan="11">' +
            (
              rows.length === 0
                ? "登録済みデータはありません。"
                : "検索条件に一致するデータはありません。"
            ) +
          "</td>" +
        "</tr>";

      ledgerStatus.textContent =
        rows.length === 0
          ? "税金・公的支払台帳は作成済みです。現在、登録済みデータはありません。"
          : "検索結果は0件です。";

      return;
    }

    ledgerStatus.textContent =
      filteredRows.length + "件を表示しています。";

    ledgerBody.innerHTML = filteredRows.map(function (row, index) {
      const id = rowId(row, index);
      const detailId = "tax-public-detail-" + id;

      const managementNumber = rowValue(row, [
        "managementNumber",
        "management_number",
        "管理番号"
      ]);

      const companyName = rowValue(row, [
        "companyName",
        "company_name",
        "会社名",
        "宛名"
      ]);

      const taxItem = rowValue(row, [
        "taxItem",
        "tax_item",
        "税目",
        "documentName"
      ]);

      const paymentDestination = rowValue(row, [
        "paymentDestination",
        "payment_destination",
        "納付先"
      ]);

      const yearTerm = [
        rowValue(row, ["fiscalYear", "fiscal_year", "年度"]),
        rowValue(row, ["taxTerm", "tax_term", "期別"])
      ].filter(Boolean).join(" / ");

      const dueDate = rowValue(row, [
        "dueDate",
        "due_date",
        "納期限"
      ]);

      const paymentAmount = amount(
        rowValue(row, [
          "totalAmount",
          "total_amount",
          "paymentAmount",
          "納付額"
        ])
      );

      const status = rowValue(row, [
        "currentStatus",
        "current_status",
        "humanConfirmStatus",
        "状態"
      ]);

      return (
        "<tr>" +
          "<td>" + escapeHtml(managementNumber || "-") + "</td>" +
          "<td>" + escapeHtml(companyName || "-") + "</td>" +
          "<td>" + escapeHtml(taxItem || "-") + "</td>" +
          "<td>" + escapeHtml(paymentDestination || "-") + "</td>" +
          "<td>" + escapeHtml(yearTerm || "-") + "</td>" +
          "<td>" + escapeHtml(dueDate || "-") + "</td>" +
          '<td class="amount-column">' + escapeHtml(paymentAmount || "-") + "</td>" +
          '<td><span class="status-badge">' + escapeHtml(status || "台帳") + "</span></td>" +
          '<td class="action-column">' +
            '<button type="button" class="row-button detail" ' +
              'data-action="detail" data-detail-target="' + escapeHtml(detailId) + '">' +
              "明細" +
            "</button>" +
          "</td>" +
          '<td class="action-column">' +
            '<button type="button" class="row-button other" ' +
              'data-action="other" data-row-index="' + index + '">' +
              "その他" +
            "</button>" +
          "</td>" +
          '<td class="action-column">' +
            '<button type="button" class="row-button edit" ' +
              'data-action="edit" data-row-index="' + index + '">' +
              "編集" +
            "</button>" +
          "</td>" +
        "</tr>" +
        '<tr id="' + escapeHtml(detailId) + '" class="detail-row" hidden>' +
          '<td colspan="11">' + detailHtml(row) + "</td>" +
        "</tr>"
      );
    }).join("");
  }

  ledgerBody.addEventListener("click", function (event) {
    const button = event.target.closest("button[data-action]");

    if (!button) {
      return;
    }

    const action = button.dataset.action;

    if (action === "detail") {
      const detailRow = document.getElementById(
        button.dataset.detailTarget
      );

      if (!detailRow) {
        return;
      }

      const opening = detailRow.hidden;
      detailRow.hidden = !opening;
      button.textContent = opening ? "閉じる" : "明細";
      return;
    }

    const index = Number(button.dataset.rowIndex);
    const row = rows[index];

    if (!row) {
      return;
    }

    if (action === "edit") {
      const ocrId = rowValue(row, [
        "paymentDocumentOcrImportId",
        "payment_document_ocr_import_id",
        "ocrImportId"
      ]);

      const target =
        "/payables/payment-document-specialist-tax-public.html" +
        (
          ocrId
            ? "?ocrImportId=" + encodeURIComponent(String(ocrId))
            : ""
        );

      location.href = target;
      return;
    }

    if (action === "other") {
      renderOther(row);
    }
  });

  ledgerSearch.addEventListener("input", function () {
    render(rows);
  });

  reloadButton.addEventListener("click", function () {
    render(rows);
  });

  otherModalClose.addEventListener("click", closeOtherModal);

  otherModal.addEventListener("click", function (event) {
    if (event.target === otherModal) {
      closeOtherModal();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !otherModal.hidden) {
      closeOtherModal();
    }
  });

  window.renderTaxPublicLedger = render;

  render([]);
})();