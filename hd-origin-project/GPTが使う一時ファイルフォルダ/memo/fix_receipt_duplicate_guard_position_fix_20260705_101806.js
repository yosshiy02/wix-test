const fs = require("fs");

const target = process.argv[2];
const after = process.argv[3];

let text = fs.readFileSync(target, "utf8");
const original = text;

function findFunctionRange(source, functionName) {
  const asyncMarker = "async function " + functionName + "(";
  const normalMarker = "function " + functionName + "(";

  let start = source.indexOf(asyncMarker);
  if (start < 0) start = source.indexOf(normalMarker);
  if (start < 0) return null;

  const braceStart = source.indexOf("{", start);
  if (braceStart < 0) return null;

  let depth = 0;
  let end = -1;

  for (let i = braceStart; i < source.length; i++) {
    const ch = source[i];

    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  if (end < 0) return null;
  return { start, end, braceStart };
}

function endOfStatement(source, index) {
  const semi = source.indexOf(";", index);
  if (semi < 0) return -1;
  return semi + 1;
}

const range = findFunctionRange(text, "registerReceiptMasterFromCandidate");
if (!range) {
  throw new Error("registerReceiptMasterFromCandidate が見つかりません。");
}

let fn = text.slice(range.start, range.end);

// いったん前回の重複チェック差し込みを削除
fn = fn.replace(
  /\n\s*const existingSameNameMaster = findExistingReceiptMasterOptionByName\(select, name\);\s*if \(existingSameNameMaster\) \{[\s\S]*?await receiptAlert\([\s\S]*?\);\s*return;\s*\}\s*/m,
  "\n"
);

// 既に削除できているか確認
if (fn.includes("const existingSameNameMaster = findExistingReceiptMasterOptionByName(select, name);")) {
  throw new Error("古い重複チェックブロックを削除できませんでした。");
}

// select/input/name の初期化位置を探す
const inputIdx = fn.search(/\b(?:const|let)\s+input\b/);
const selectIdx = fn.search(/\b(?:const|let)\s+select\b/);
const nameIdx = fn.search(/\b(?:const|let)\s+name\b/);

if (inputIdx < 0 || selectIdx < 0 || nameIdx < 0) {
  throw new Error("input/select/name の宣言位置を見つけられません。");
}

const inputEnd = endOfStatement(fn, inputIdx);
const selectEnd = endOfStatement(fn, selectIdx);
const nameEnd = endOfStatement(fn, nameIdx);

if (inputEnd < 0 || selectEnd < 0 || nameEnd < 0) {
  throw new Error("input/select/name の宣言終了位置を見つけられません。");
}

const insertAt = Math.max(inputEnd, selectEnd, nameEnd);

const guard = `

  const existingSameNameMaster = findExistingReceiptMasterOptionByName(select, name);
  if (existingSameNameMaster) {
    select.value = String(existingSameNameMaster.id);
    select.dispatchEvent(new Event("change", { bubbles: true }));

    if (input) {
      input.value = existingSameNameMaster.name;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }

    await receiptAlert(
      "既に同じ名称のマスタがあります。\\n新規登録せず、既存の「" + existingSameNameMaster.name + "」を選択しました。",
      "マスタ登録"
    );

    return;
  }
`;

fn = fn.slice(0, insertAt) + guard + fn.slice(insertAt);

text = text.slice(0, range.start) + fn + text.slice(range.end);

if (text === original) {
  throw new Error("変更が入りませんでした。");
}

fs.writeFileSync(after, text, "utf8");
