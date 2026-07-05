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
  return { start, end };
}

const helper = `
function normalizeReceiptMasterDuplicateName(value) {
  return String(value || "")
    .trim()
    .replace(/[　\\s]+/g, "")
    .replace(/[‐-‒–—―ー－]/g, "-")
    .toLowerCase();
}

function findExistingReceiptMasterOptionByName(select, name) {
  if (!select || !select.options) return null;

  const normalized = normalizeReceiptMasterDuplicateName(name);
  if (!normalized) return null;

  for (const option of Array.from(select.options)) {
    const optionName = String(option.textContent || "").trim();

    if (!option.value) continue;

    if (normalizeReceiptMasterDuplicateName(optionName) === normalized) {
      return {
        id: option.value,
        name: optionName
      };
    }
  }

  return null;
}
`;

if (!text.includes("function normalizeReceiptMasterDuplicateName(value)")) {
  const rangeForHelper = findFunctionRange(text, "registerReceiptMasterFromCandidate");
  if (!rangeForHelper) {
    throw new Error("registerReceiptMasterFromCandidate が見つかりません。");
  }

  text = text.slice(0, rangeForHelper.start) + helper + "\n" + text.slice(rangeForHelper.start);
}

const range = findFunctionRange(text, "registerReceiptMasterFromCandidate");
if (!range) {
  throw new Error("registerReceiptMasterFromCandidate が見つかりません。");
}

let fn = text.slice(range.start, range.end);

// まず壊れた既存チェックブロックを削除
fn = fn.replace(
  /\n\s*const existingSameNameMaster = findExistingReceiptMasterOptionByName\(select, name\);\s*if \(existingSameNameMaster\) \{[\s\S]*?await receiptAlert\([\s\S]*?\);\s*return;\s*\}\s*/m,
  "\n"
);

if (fn.includes("const existingSameNameMaster = findExistingReceiptMasterOptionByName(select, name);")) {
  throw new Error("壊れた重複チェックブロックを削除できませんでした。");
}

const insertAnchor = `
      if (!name) {
        await receiptAlert(def.label + "の候補名が空です。", "マスタ登録");
        return;
      }
`;

const guardBlock = `
      const duplicateCheckSelect = document.getElementById(def.selectId);
      const existingSameNameMaster = findExistingReceiptMasterOptionByName(duplicateCheckSelect, name);

      if (existingSameNameMaster) {
        duplicateCheckSelect.value = String(existingSameNameMaster.id);
        duplicateCheckSelect.dispatchEvent(new Event("change", { bubbles: true }));

        syncReceiptMasterCandidateName(kind, true);

        await receiptAlert(
          "既に同じ名称のマスタがあります。\\n新規登録せず、既存の「" + existingSameNameMaster.name + "」を選択しました。",
          "マスタ登録"
        );

        return;
      }
`;

if (!fn.includes("const duplicateCheckSelect = document.getElementById(def.selectId);")) {
  if (!fn.includes(insertAnchor)) {
    throw new Error("候補名空チェックの直後位置が見つかりません。");
  }

  fn = fn.replace(insertAnchor, insertAnchor + guardBlock);
}

text = text.slice(0, range.start) + fn + text.slice(range.end);

if (text === original) {
  throw new Error("変更が入りませんでした。既に反映済みの可能性があります。");
}

fs.writeFileSync(after, text, "utf8");
