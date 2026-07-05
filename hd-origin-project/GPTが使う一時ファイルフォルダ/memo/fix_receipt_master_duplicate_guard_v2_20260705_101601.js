const fs = require("fs");

const target = process.argv[2];
const after = process.argv[3];

let text = fs.readFileSync(target, "utf8");
const original = text;

function findFunctionRange(source, functionName) {
  const asyncMarker = "async function " + functionName + "(";
  const normalMarker = "function " + functionName + "(";

  let start = source.indexOf(asyncMarker);
  if (start < 0) {
    start = source.indexOf(normalMarker);
  }

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
  const range = findFunctionRange(text, "registerReceiptMasterFromCandidate");
  if (!range) {
    throw new Error("registerReceiptMasterFromCandidate 関数が見つかりません。");
  }

  text = text.slice(0, range.start) + helper + "\n" + text.slice(range.start);
}

let range = findFunctionRange(text, "registerReceiptMasterFromCandidate");
if (!range) {
  throw new Error("registerReceiptMasterFromCandidate 関数が見つかりません。");
}

let fn = text.slice(range.start, range.end);

if (!/^async function registerReceiptMasterFromCandidate/.test(fn.trim())) {
  throw new Error("registerReceiptMasterFromCandidate が async function として検出できません。安全のため停止します。");
}

if (!fn.includes("findExistingReceiptMasterOptionByName")) {
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

  const patterns = [
    /(\n\s*)const\s+res\s*=\s*await\s+fetch\s*\(/,
    /(\n\s*)const\s+response\s*=\s*await\s+fetch\s*\(/,
    /(\n\s*)let\s+res\s*=\s*await\s+fetch\s*\(/,
    /(\n\s*)let\s+response\s*=\s*await\s+fetch\s*\(/
  ];

  let inserted = false;

  for (const pattern of patterns) {
    if (pattern.test(fn)) {
      fn = fn.replace(pattern, "$1" + guard + "$1" + fn.match(pattern)[0].trimStart());
      inserted = true;
      break;
    }
  }

  if (!inserted) {
    throw new Error("registerReceiptMasterFromCandidate 内の await fetch 位置が見つかりません。");
  }

  text = text.slice(0, range.start) + fn + text.slice(range.end);
}

if (text === original) {
  throw new Error("変更が入りませんでした。既に反映済みの可能性があります。");
}

fs.writeFileSync(after, text, "utf8");
