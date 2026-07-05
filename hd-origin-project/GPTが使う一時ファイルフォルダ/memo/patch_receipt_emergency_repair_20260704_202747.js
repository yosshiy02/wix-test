const fs = require("fs");

const [targetPath, memoPath] = process.argv.slice(2);

if (!targetPath || !memoPath) {
  throw new Error("引数不足");
}

let text = fs.readFileSync(targetPath, "utf8");

function removeMarkedCssBlock(source, startMarker, endMarker) {
  const re = new RegExp("\\s*\\/\\* " + startMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " \\*\\/[\\s\\S]*?\\/\\* " + endMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " \\*\\/\\s*", "g");
  return source.replace(re, "\n");
}

function findDraftHtmlAssignment(source) {
  const re = /document\.getElementById\("formArea"\)\.innerHTML\s*=\s*`([\s\S]*?)`;/g;
  let m;

  while ((m = re.exec(source))) {
    const html = m[1];
    if (html.includes("候補を保存") && html.includes("grid-basic-top-row")) {
      return {
        start: m.index,
        end: re.lastIndex,
        html
      };
    }
  }

  throw new Error("renderForm の formArea.innerHTML が見つかりません。");
}

function findDivBlockAt(s, start) {
  const openEnd = s.indexOf(">", start);
  if (openEnd < 0) throw new Error("div開始タグが壊れています。");

  const tagRe = /<div\b[^>]*>|<\/div>/gi;
  tagRe.lastIndex = start;

  let depth = 0;
  let m;

  while ((m = tagRe.exec(s))) {
    if (m[0].startsWith("</")) {
      depth--;
    } else {
      depth++;
    }

    if (depth === 0) {
      return {
        start,
        openEnd: openEnd + 1,
        closeStart: m.index,
        end: tagRe.lastIndex,
        block: s.slice(start, tagRe.lastIndex),
        inner: s.slice(openEnd + 1, m.index)
      };
    }
  }

  throw new Error("div閉じタグが見つかりません。start=" + start);
}

function findDivBlockByClass(s, className, required = true) {
  const openRe = /<div\b[^>]*class="[^"]*"/gi;
  let m;

  while ((m = openRe.exec(s))) {
    const openEnd = s.indexOf(">", m.index);
    const startTag = s.slice(m.index, openEnd + 1);

    if (startTag.includes(className)) {
      return findDivBlockAt(s, m.index);
    }
  }

  if (required) throw new Error("class が見つかりません: " + className);
  return null;
}

function findSmallestDivContaining(s, marker, required = true) {
  const pos = s.indexOf(marker);

  if (pos < 0) {
    if (required) throw new Error("marker が見つかりません: " + marker);
    return null;
  }

  const divRe = /<div\b[^>]*>/gi;
  let m;
  let best = null;

  while ((m = divRe.exec(s))) {
    if (m.index > pos) break;

    const block = findDivBlockAt(s, m.index);

    if (block.start <= pos && pos < block.end) {
      if (!best || (block.end - block.start) < (best.end - best.start)) {
        best = block;
      }
    }
  }

  if (!best && required) throw new Error("marker を含むdivが見つかりません: " + marker);
  return best;
}

function replaceRange(s, start, end, value) {
  return s.slice(0, start) + value + s.slice(end);
}

function normalizeIndent(block, spaces) {
  const pad = " ".repeat(spaces);
  return block.trim().replace(/\n/g, "\n" + pad);
}

/*
  事故CSSを削除
*/
text = removeMarkedCssBlock(text, "RECEIPT_DASHED_LINES_OFF_20260704_START", "RECEIPT_DASHED_LINES_OFF_20260704_END");
text = removeMarkedCssBlock(text, "RECEIPT_FORCE_DASHED_LINES_OFF_20260704_START", "RECEIPT_FORCE_DASHED_LINES_OFF_20260704_END");
text = removeMarkedCssBlock(text, "RECEIPT_LAYOUT_LINES_OFF_20260704_START", "RECEIPT_LAYOUT_LINES_OFF_20260704_END");

/*
  念のため、表示後DOM移動JSも削除
*/
text = text.replace(
  /\s*<script>\s*\n\s*\/\* RECEIPT_DATE_TIME_IN_VENDOR_CONTAINER_20260704_SCRIPT_START \*\/[\s\S]*?\/\* RECEIPT_DATE_TIME_IN_VENDOR_CONTAINER_20260704_SCRIPT_END \*\/\s*\n\s*<\/script>/g,
  ""
);

text = text.replace(
  /\s*<script>\s*\n\s*\/\* RECEIPT_PAYMENT_AMOUNT_CONTAINER_20260704_SCRIPT_START \*\/[\s\S]*?\/\* RECEIPT_PAYMENT_AMOUNT_CONTAINER_20260704_SCRIPT_END \*\/\s*\n\s*<\/script>/g,
  ""
);

let hit = findDraftHtmlAssignment(text);
let html = hit.html;

/*
  支払方法を抜く
*/
let payment = findSmallestDivContaining(html, 'id="paymentMethodName"');
let paymentBlock = payment.block.trim();

if (!paymentBlock.includes("receipt-payment-field")) {
  paymentBlock = paymentBlock.replace(/<div\b([^>]*)>/, '<div class="receipt-payment-field"$1>');
}

html = replaceRange(html, payment.start, payment.end, "");

/*
  取引日・時刻を抜く
*/
let transactionDateBlockObj = findSmallestDivContaining(html, 'id="transactionDate"');
let transactionDateBlock = transactionDateBlockObj.block.trim();
html = replaceRange(html, transactionDateBlockObj.start, transactionDateBlockObj.end, "");

let receiptTimeBlockObj = findSmallestDivContaining(html, 'id="receiptTimeText"');
let receiptTimeBlock = receiptTimeBlockObj.block.trim();
html = replaceRange(html, receiptTimeBlockObj.start, receiptTimeBlockObj.end, "");

/*
  .receipt-date-payment-row が残っていたら消す
*/
let dateRow = findDivBlockByClass(html, "receipt-date-payment-row", false);
if (dateRow) {
  html = replaceRange(html, dateRow.start, dateRow.end, "");
}

/*
  .receipt-master-select-row はラッパーだけ外す
*/
let selectRow = findDivBlockByClass(html, "receipt-master-select-row", false);
if (selectRow) {
  html = replaceRange(html, selectRow.start, selectRow.end, selectRow.inner);
}

/*
  .receipt-basic-left-stack はラッパーだけ外す
*/
let leftStack = findDivBlockByClass(html, "receipt-basic-left-stack", false);
if (leftStack) {
  html = replaceRange(html, leftStack.start, leftStack.end, leftStack.inner);
}

/*
  対象者・目的案件部門を抜く
*/
let targetRow = findDivBlockByClass(html, "receipt-target-person-row");
let targetBlock = targetRow.block.trim();
html = replaceRange(html, targetRow.start, targetRow.end, "");

let comboRow = findDivBlockByClass(html, "receipt-master-combo-row");
let comboBlock = comboRow.block.trim();
html = replaceRange(html, comboRow.start, comboRow.end, "");

/*
  支払方法を .receipt-amount-direct-row 先頭へ
*/
let amountRow = findDivBlockByClass(html, "receipt-amount-direct-row");
html = replaceRange(
  html,
  amountRow.openEnd,
  amountRow.openEnd,
  "\n                " + normalizeIndent(paymentBlock, 16)
);

/*
  取引日・時刻を .receipt-vendor-direct-stack 先頭へ
*/
let vendorStack = findDivBlockByClass(html, "receipt-vendor-direct-stack");
let dateTimeInsert =
  "\n                " + normalizeIndent(transactionDateBlock, 16) +
  "\n                " + normalizeIndent(receiptTimeBlock, 16) +
  "\n";

html = replaceRange(html, vendorStack.openEnd, vendorStack.openEnd, dateTimeInsert);

/*
  .receipt-vendor-direct-stack の下に .receipt-master-combo-row、その下に .receipt-target-person-row
*/
vendorStack = findDivBlockByClass(html, "receipt-vendor-direct-stack");
let afterVendorInsert =
  "\n\n              " + normalizeIndent(comboBlock, 14) +
  "\n\n              " + normalizeIndent(targetBlock, 14);

html = replaceRange(html, vendorStack.end, vendorStack.end, afterVendorInsert);

/*
  組み戻し
*/
let out =
  text.slice(0, hit.start) +
  'document.getElementById("formArea").innerHTML = `' +
  html +
  '`;' +
  text.slice(hit.end);

/*
  検査
*/
let afterHit = findDraftHtmlAssignment(out);
let afterHtml = afterHit.html;

const checks = [
  ["初期HTML内 .receipt-basic-left-stack なし", !afterHtml.includes("receipt-basic-left-stack")],
  ["初期HTML内 .receipt-date-payment-row なし", !afterHtml.includes("receipt-date-payment-row")],
  ["初期HTML内 .receipt-master-select-row なし", !afterHtml.includes("receipt-master-select-row")],
  ["支払方法あり", afterHtml.includes('id="paymentMethodName"')],
  ["取引日あり", afterHtml.includes('id="transactionDate"')],
  ["時刻あり", afterHtml.includes('id="receiptTimeText"')],
  ["対象者あり", afterHtml.includes('id="targetPersonId"')],
  ["目的あり", afterHtml.includes('id="purposeId"')],
  ["案件あり", afterHtml.includes('id="projectId"')],
  ["部門あり", afterHtml.includes('id="departmentId"')],
  ["インボイス区分あり", afterHtml.includes('id="invoiceTypeId"')],
  ["証憑区分あり", afterHtml.includes('id="evidenceTypeId"')],
  ["証憑メモあり", afterHtml.includes('id="evidenceMemo"')],
  ["事故CSS 削除 dashed", !out.includes("RECEIPT_DASHED_LINES_OFF_20260704_START")],
  ["事故CSS 削除 force", !out.includes("RECEIPT_FORCE_DASHED_LINES_OFF_20260704_START")],
  ["事故CSS 削除 layout lines", !out.includes("RECEIPT_LAYOUT_LINES_OFF_20260704_START")],
  ["表示後DOM移動JS 削除1", !out.includes("RECEIPT_DATE_TIME_IN_VENDOR_CONTAINER_20260704_SCRIPT_START")],
  ["表示後DOM移動JS 削除2", !out.includes("RECEIPT_PAYMENT_AMOUNT_CONTAINER_20260704_SCRIPT_START")]
];

const ng = checks.filter((x) => !x[1]);

if (ng.length) {
  throw new Error("検査NG: " + ng.map((x) => x[0]).join(", "));
}

const tree =
`修正後 初期HTMLツリー

.grid-basic-top-row
├─ .receipt-amount-direct-row
│  ├─ 支払方法
│  ├─ 合計金額
│  ├─ 消費税合計
│  └─ 消費税内訳ボタン
│
├─ .receipt-vendor-direct-stack
│  ├─ 取引日
│  ├─ 時刻
│  ├─ 店名・支払先
│  ├─ 住所
│  ├─ 電話番号
│  ├─ インボイス番号
│  ├─ .invoice-note-wrap
│  ├─ インボイス区分
│  ├─ 証憑区分
│  └─ 証憑メモ
│
├─ .receipt-master-combo-row
│  ├─ 目的
│  ├─ 案件
│  └─ 部門
│
└─ .receipt-target-person-row
   └─ 対象者
`;

fs.writeFileSync(targetPath, out, "utf8");

fs.writeFileSync(
  memoPath,
  [
    "==============================",
    "レシート読取確認ページ 緊急修正結果",
    "==============================",
    "",
    ...checks.map((x) => (x[1] ? "OK: " : "NG: ") + x[0]),
    "",
    tree
  ].join("\n"),
  "utf8"
);
