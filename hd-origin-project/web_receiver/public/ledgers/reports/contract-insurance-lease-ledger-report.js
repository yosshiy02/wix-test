"use strict";

const ENDPOINT =
  "/api/payment-documents/contract-insurance-lease/list";

function text(value) {
  return value === null || value === undefined
    ? ""
    : String(value);
}

function escapeHtml(value) {
  return text(value).replace(/[&<>"']/g, function (ch) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[ch];
  });
}

function first() {
  for (const value of arguments) {
    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }
  return "";
}

function field(row, names) {
  const sources=[
    row.visible_fields_json,
    row.specialist_fields_json
  ];

  for (const source of sources) {
    if (!source) continue;

    for (const name of names) {
      if (source[name] !== null &&
          source[name] !== undefined &&
          source[name] !== "") {
        return source[name];
      }
    }
  }

  return "";
}

function date(value) {
  const source=text(value).slice(0,10);
  return source ? source.replace(/-/g,"/") : "";
}

function money(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  const number=Number(String(value).replace(/[^\d.-]/g,""));
  return Number.isFinite(number)
    ? number.toLocaleString("ja-JP")+"円"
    : text(value);
}

function kind(row) {
  return first(
    row.contract_insurance_lease_kind_label,
    field(row,["契約・保険・リース"])
  );
}

function renderDetailTree(row, lines) {
  const warnings=Array.isArray(row.warnings_json)
    ? row.warnings_json
    : [];


  const itemHtml=lines.length
    ? (
        "<li><strong>物件明細</strong><ul>"+
        lines.map(function(line) {
          return "<li>"+
            [
              line.lease_item_category_name,
              line.item_name,
              line.manufacturer_name,
              line.model_number,
              line.quantity
                ? "数量 "+text(line.quantity)+text(line.unit_name)
                : "",
              line.lease_start_date || line.lease_end_date
                ? date(line.lease_start_date)+" ～ "+date(line.lease_end_date)
                : "",
              line.monthly_lease_amount
                ? "月額 "+money(line.monthly_lease_amount)
                : ""
            ].filter(Boolean).map(escapeHtml).join(" ／ ")+
          "</li>";
        }).join("")+
        "</ul></li>"
      )
    : "<li><strong>物件明細</strong><span>登録なし</span></li>";


  const warningsHtml=warnings.length
    ? (
        "<li><strong>要確認</strong><ul>"+
        warnings.map(function(warning) {
          return "<li>"+escapeHtml(warning)+"</li>";
        }).join("")+
        "</ul></li>"
      )
    : "";

  return (
    '<div class="detail-tree">'+
      "<ul>"+
        itemHtml+
        warningsHtml+
      "</ul>"+
    "</div>"
  );
}

function render(rows) {
  const body=document.getElementById("ledgerBody");

  if (!rows.length) {
    body.innerHTML=
      '<tr class="empty"><td colspan="13">登録済みデータはありません。</td></tr>';
    return;
  }

  body.innerHTML=rows.map(function(row,index) {
    const kindName=kind(row);

    const company=first(
      row.lease_company_name,
      field(row,[
        "リース会社",
        "保険会社",
        "契約相手先",
        "発行元",
        "支払先"
      ])
    );

    const contractor=first(
      row.contractor_name,
      field(row,["契約者","被保険者","宛名"])
    );

    const start=first(
      row.contract_start_date,
      field(row,[
        "契約開始日",
        "保険期間開始日",
        "リース開始日"
      ])
    );

    const end=first(
      row.contract_end_date,
      field(row,[
        "契約終了日",
        "保険期間終了日",
        "リース終了日",
        "満了日"
      ])
    );

    const item=first(
      row.lease_item_name,
      field(row,[
        "リース物件",
        "保険対象",
        "被保険者・被保険物件",
        "契約対象"
      ])
    );

    const amount=first(
      row.monthly_lease_amount,
      row.monthly_amount,
      field(row,[
        "月額リース料",
        "保険料",
        "月額契約料",
        "支払金額"
      ])
    );

    const paymentDay=field(row,[
      "支払日",
      "引落日",
      "支払予定日",
      "支払期限"
    ]);

    const documentType=first(
      row.document_type_label,
      field(row,["書類区分","書類名"])
    );

    const lines=Array.isArray(row.lease_item_lines)
      ? row.lease_item_lines
      : [];

    const detailId=
      "cil-detail-"+text(row.contract_insurance_lease_draft_id);

    const main=
      "<tr>"+
      "<td>"+escapeHtml(index+1)+"</td>"+
      "<td>"+escapeHtml(kindName)+"</td>"+
      "<td>"+escapeHtml(documentType)+"</td>"+
      "<td>"+escapeHtml(company)+"</td>"+
      "<td>"+escapeHtml(contractor)+"</td>"+
      "<td>"+escapeHtml(date(start))+"</td>"+
      "<td>"+escapeHtml(date(end))+"</td>"+
      "<td>"+escapeHtml(item)+"</td>"+
      '<td class="money">'+escapeHtml(money(amount))+"</td>"+
      "<td>"+escapeHtml(paymentDay)+"</td>"+
            '<td><button type="button" class="detail-toggle" '+
        'data-detail-target="'+escapeHtml(detailId)+'" '+
        'aria-expanded="false">明細</button></td>'+
            "<td>"+escapeHtml(row.original_file_name)+"</td>"+
      '<td><button type="button" class="edit-link ledger-edit-button" data-ocr-import-id="'+
        escapeHtml(text(row.payment_document_ocr_import_id))+
        '">修正</button></td>'+
      "</tr>";

    const detail=
      '<tr id="'+escapeHtml(detailId)+'" class="detail-row" hidden>'+
        '<td colspan="13">'+
          renderDetailTree(row,lines)+
        "</td>"+
      "</tr>";

    return main+detail;
  }).join("");

  body.querySelectorAll(".detail-toggle").forEach(function(button) {
    button.addEventListener("click",function() {
      const target=document.getElementById(
        button.dataset.detailTarget
      );

      if (!target) return;

      const opening=target.hidden;
      target.hidden=!opening;
      button.setAttribute(
        "aria-expanded",
        opening ? "true" : "false"
      );
      button.textContent=opening ? "閉じる" : "明細";
    });
  });
}
/* HD_ORIGIN_CIL_RETURN_TO_ANALYSIS_CLIENT_20260723_START */
/* HD_ORIGIN_CIL_LEDGER_SAFE_EDIT_LINK_20260724_START */
function openLedgerItemForEdit(ocrImportId, button) {
  const id = Number(ocrImportId);

  if (!Number.isInteger(id) || id < 1) {
    throw new Error("OCR取込IDを確認できません。");
  }

  if (button) {
    button.disabled = true;
  }

  location.href =
    "/payables/payment-document-specialist-contract-insurance-lease.html" +
    "?ocr_import_id=" +
    encodeURIComponent(String(id));
}

document.addEventListener("click", function (event) {
  const button =
    event.target.closest(".ledger-edit-button");

  if (!button) {
    return;
  }

  try {
    openLedgerItemForEdit(
      button.dataset.ocrImportId,
      button
    );
  }
  catch (error) {
    button.disabled = false;
    window.alert(error.message);
  }
});
/* HD_ORIGIN_CIL_LEDGER_SAFE_EDIT_LINK_20260724_END */
/* HD_ORIGIN_CIL_RETURN_TO_ANALYSIS_CLIENT_20260723_END */
async function main() {
  const status=document.getElementById("loadStatus");

  try {
    const response=await fetch(ENDPOINT,{
      headers:{Accept:"application/json"},
      credentials:"same-origin"
    });

    const payload=await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || response.statusText);
    }

    const rows=Array.isArray(payload.rows)
      ? payload.rows
      : [];

    document.getElementById("recordCount").textContent=rows.length;
    document.getElementById("contractCount").textContent=
      rows.filter(row=>kind(row)==="契約").length;
    document.getElementById("insuranceCount").textContent=
      rows.filter(row=>kind(row)==="保険").length;
    document.getElementById("leaseCount").textContent=
      rows.filter(row=>kind(row)==="リース").length;

    render(rows);
    status.textContent=rows.length+"件を表示しています。";
  } catch(error) {
    status.classList.add("error");
    status.textContent="読み込みエラー: "+error.message;
    render([]);
  }
}

main();