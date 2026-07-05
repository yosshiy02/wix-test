const fs = require("fs");

const [srcPath, afterPath, memoPath] = process.argv.slice(2);

if (!srcPath || !afterPath || !memoPath) {
  throw new Error("引数不足");
}

let text = fs.readFileSync(srcPath, "utf8");

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

  throw new Error("renderForm の候補保存側 formArea.innerHTML が見つかりません。");
}

function findDivBlockAt(s, start) {
  const openEnd = s.indexOf(">", start);

  if (openEnd < 0) {
    throw new Error("div 開始タグが壊れています。");
  }

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

  throw new Error("div 閉じタグが見つかりません。start=" + start);
}

function findDivBlockByClass(s, className) {
  const openRe = /<div\b[^>]*class="[^"]*"/gi;
  let m;

  while ((m = openRe.exec(s))) {
    const openEnd = s.indexOf(">", m.index);
    const startTag = s.slice(m.index, openEnd + 1);

    if (!startTag.includes(className)) {
      continue;
    }

    return findDivBlockAt(s, m.index);
  }

  throw new Error("div class が見つかりません: " + className);
}

function findSmallestDivContaining(s, marker) {
  const pos = s.indexOf(marker);

  if (pos < 0) {
    throw new Error("marker が見つかりません: " + marker);
  }

  const divRe = /<div\b[^>]*>/gi;
  let m;
  let best = null;

  while ((m = divRe.exec(s))) {
    if (m.index > pos) {
      break;
    }

    const block = findDivBlockAt(s, m.index);

    if (block.start <= pos && pos < block.end) {
      if (!best || (block.end - block.start) < (best.end - best.start)) {
        best = block;
      }
    }
  }

  if (!best) {
    throw new Error("marker を含む div が見つかりません: " + marker);
  }

  return best;
}

function replaceRange(s, start, end, value) {
  return s.slice(0, start) + value + s.slice(end);
}

let hit = findDraftHtmlAssignment(text);
let html = hit.html;

/*
  1. 支払方法を .receipt-date-payment-row から抜く
*/
let payment = findSmallestDivContaining(html, 'id="paymentMethodName"');
let paymentBlock = payment.block.trim();
paymentBlock = paymentBlock.replace(/<div>/, '<div class="receipt-payment-field">');
html = replaceRange(html, payment.start, payment.end, "");

/*
  2. 支払方法を .receipt-amount-direct-row の先頭へ入れる
*/
let amountRow = findDivBlockByClass(html, "receipt-amount-direct-row");
html = replaceRange(
  html,
  amountRow.openEnd,
  amountRow.openEnd,
  "\n                  " + paymentBlock.replace(/\n/g, "\n                  ")
);

/*
  3. 取引日・時刻を取り出して .receipt-date-payment-row を消す
*/
let dateRow = findDivBlockByClass(html, "receipt-date-payment-row");
let dateInner = dateRow.inner.trim();
html = replaceRange(html, dateRow.start, dateRow.end, "");

/*
  4. .receipt-master-select-row ラッパーだけ消す
*/
let selectRow = findDivBlockByClass(html, "receipt-master-select-row");
html = replaceRange(html, selectRow.start, selectRow.end, selectRow.inner);

/*
  5. .receipt-basic-left-stack ラッパーだけ消す
*/
let leftStack = findDivBlockByClass(html, "receipt-basic-left-stack");
html = replaceRange(html, leftStack.start, leftStack.end, leftStack.inner);

/*
  6. 対象者と目的・案件・部門をいったん抜く
*/
let targetRow = findDivBlockByClass(html, "receipt-target-person-row");
let targetBlock = targetRow.block;
html = replaceRange(html, targetRow.start, targetRow.end, "");

let comboRow = findDivBlockByClass(html, "receipt-master-combo-row");
let comboBlock = comboRow.block;
html = replaceRange(html, comboRow.start, comboRow.end, "");

/*
  7. 取引日・時刻を .receipt-vendor-direct-stack の一番上へ入れる
*/
let vendorStack = findDivBlockByClass(html, "receipt-vendor-direct-stack");
let dateInsert = "\n                " + dateInner.replace(/\n/g, "\n                ") + "\n";
html = replaceRange(html, vendorStack.openEnd, vendorStack.openEnd, dateInsert);

/*
  8. .receipt-vendor-direct-stack の下に .receipt-master-combo-row、その下に .receipt-target-person-row
*/
vendorStack = findDivBlockByClass(html, "receipt-vendor-direct-stack");
html = replaceRange(html, vendorStack.end, vendorStack.end, "\n\n" + comboBlock + "\n\n" + targetBlock);

/*
  9. 表示後DOM移動JSを削除
*/
let out =
  text.slice(0, hit.start) +
  'document.getElementById("formArea").innerHTML = `' +
  html +
  '`;' +
  text.slice(hit.end);

out = out.replace(
  /\s*<script>\s*\n\s*\/\* RECEIPT_DATE_TIME_IN_VENDOR_CONTAINER_20260704_SCRIPT_START \*\/[\s\S]*?\/\* RECEIPT_DATE_TIME_IN_VENDOR_CONTAINER_20260704_SCRIPT_END \*\/\s*\n\s*<\/script>/g,
  ""
);

out = out.replace(
  /\s*<script>\s*\n\s*\/\* RECEIPT_PAYMENT_AMOUNT_CONTAINER_20260704_SCRIPT_START \*\/[\s\S]*?\/\* RECEIPT_PAYMENT_AMOUNT_CONTAINER_20260704_SCRIPT_END \*\/\s*\n\s*<\/script>/g,
  ""
);

/*
  10. 検査
*/
const afterHit = findDraftHtmlAssignment(out);
const afterHtml = afterHit.html;

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

fs.writeFileSync(afterPath, out, "utf8");
fs.writeFileSync(
  memoPath,
  checks.map((x) => (x[1] ? "OK: " : "NG: ") + x[0]).join("\n") + "\n\n" + tree,
  "utf8"
);
