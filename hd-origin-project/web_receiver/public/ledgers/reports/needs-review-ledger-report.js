"use strict";

(function () {
  const ledgerBody = document.getElementById("ledgerBody");
  const ledgerStatus = document.getElementById("ledgerStatus");
  const recordCount = document.getElementById("recordCount");
  const confirmedCount = document.getElementById("confirmedCount");
  const pendingCount = document.getElementById("pendingCount");
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
    const specialistResult =
      row &&
      row.specialistResult &&
      typeof row.specialistResult === "object"
        ? row.specialistResult
        : {};

    const draft =
      specialistResult.draft &&
      typeof specialistResult.draft === "object"
        ? specialistResult.draft
        : {};

    const details = [
      ["要確認理由", rowValue(specialistResult, ["aiReason", "ai_reason"])],
      ["AI信頼度", rowValue(specialistResult, ["aiConfidence", "ai_confidence"])],
      ["ファイル名", rowValue(row, ["fileName", "originalFileName", "savedFileName"])],
      ["OCR取込ID", rowValue(row, ["paymentDocumentOcrImportId", "payment_document_ocr_import_id"])],
      ["現在状態", rowValue(row, ["analysisStatusName"])],
      ["解析コード", analysisSystemCodeOf(row)],
      ["解析結果", JSON.stringify(draft)]
    ];

    return (
      '<div class="detail-panel">' +
        '<div class="detail-grid">' +
          details.map(function (item) {
            return (
              '<div class="detail-item">' +
                "<span>" + escapeHtml(item[0]) + "</span>" +
                "<strong>" + escapeHtml(item[1] || "-") + "</strong>" +
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

    const matched = rows.filter(function (row) {
      const status = text(
        rowValue(row, [
          "matchingStatus",
          "matching_status",
          "確認状態"
        ])
      );

      return (
        status.includes("一致") ||
        status.includes("照合済")
      );
    }).length;

    const reviews = rows.filter(function (row) {
      const status = text(
        rowValue(row, [
          "matchingStatus",
          "matching_status",
          "確認状態"
        ])
      );

      return (
        status.includes("未照合") ||
        status.includes("要確認") ||
        status.includes("不一致")
      );
    }).length;

    recordCount.textContent = String(rows.length);
    confirmedCount.textContent = String(matched);
    pendingCount.textContent = String(reviews);

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
          ? "要確認台帳は作成済みです。現在、登録済みデータはありません。"
          : "検索結果は0件です。";

      return;
    }

    ledgerStatus.textContent =
      filteredRows.length + "件を表示しています。";

    ledgerBody.innerHTML = filteredRows.map(function (row, index) {
      const id = rowId(row, index);
      const detailId = "needs-review-detail-" + id;

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

      const documentType = rowValue(row, [
        "documentType",
        "document_type",
        "書類区分"
      ]);

      const issuer = rowValue(row, [
        "issuer",
        "vendorName",
        "vendor_name",
        "発行元",
        "取引先"
      ]);

      const targetDate = rowValue(row, [
        "documentDate",
        "document_date",
        "issueDate",
        "issue_date",
        "対象日"
      ]);

      const total = amount(
        rowValue(row, [
          "totalAmount",
          "total_amount",
          "amount",
          "金額"
        ])
      );

      const matchingStatus = rowValue(row, [
        "matchingStatus",
        "matching_status",
        "確認状態"
      ]);

      const matchingTarget = rowValue(row, [
        "matchingTarget",
        "matching_target",
        "確認内容"
      ]);

      return (
        "<tr>" +
          "<td>" + escapeHtml(managementNumber || "-") + "</td>" +
          "<td>" + escapeHtml(companyName || "-") + "</td>" +
          "<td>" + escapeHtml(documentType || "-") + "</td>" +
          "<td>" + escapeHtml(issuer || "-") + "</td>" +
          "<td>" + escapeHtml(targetDate || "-") + "</td>" +
          '<td class="amount-column">' + escapeHtml(total || "-") + "</td>" +
          '<td><span class="status-badge">' + escapeHtml(matchingStatus || "台帳") + "</span></td>" +
          "<td>" + escapeHtml(matchingTarget || "-") + "</td>" +
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

    if (action === "other") {
      renderOther(row);
      return;
    }

    if (action === "edit") {
      const ocrId = rowValue(row, [
        "paymentDocumentOcrImportId",
        "payment_document_ocr_import_id",
        "ocrImportId"
      ]);

      location.href =
        "/payables/payment-document-specialist-needs-review.html" +
        (
          ocrId
            ? "?ocrImportId=" + encodeURIComponent(String(ocrId))
            : ""
        );
    }
  });

  ledgerSearch.addEventListener("input", function () {
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

  function analysisSystemCodeOf(row) {
    const specialistResult =
      row &&
      row.specialistResult &&
      typeof row.specialistResult === "object"
        ? row.specialistResult
        : {};

    return text(
      rowValue(row || {}, [
        "analysisSystemCode",
        "analysis_system_code"
      ]) ||
      rowValue(specialistResult, [
        "analysisSystemCode",
        "analysis_system_code"
      ])
    );
  }

  function normalizeReviewItems(payload) {
    const sourceItems =
      payload && Array.isArray(payload.items)
        ? payload.items
        : payload && Array.isArray(payload.rows)
          ? payload.rows
          : Array.isArray(payload)
            ? payload
            : [];

    return sourceItems.filter(function (row) {
      const code = analysisSystemCodeOf(row);

      return code === "needs_review_analysis";
    });
  }

  async function loadLedger() {
    ledgerStatus.textContent =
      "要確認台帳を読み込んでいます。";

    reloadButton.disabled = true;

    try {
      const response = await fetch(
        "/api/payment-documents/review-items",
        {
          method: "GET",
          headers: {
            Accept: "application/json"
          },
          cache: "no-store"
        }
      );

      const payload = await response.json();

      if (!response.ok || payload.ok === false) {
        throw new Error(
          payload && payload.error
            ? payload.error
            : "要確認台帳を取得できませんでした。"
        );
      }

      render(normalizeReviewItems(payload));
    } catch (error) {
      rows = [];

      render([]);

      ledgerStatus.textContent =
        "要確認台帳の読込に失敗しました: " +
        (
          error && error.message
            ? error.message
            : String(error)
        );
    } finally {
      reloadButton.disabled = false;
    }
  }

  reloadButton.addEventListener(
    "click",
    function () {
      loadLedger();
    }
  );

  window.renderNeedsReviewLedger = render;

  loadLedger();
})();