const fs = require("fs");

const target = process.argv[2];
const after = process.argv[3];

let text = fs.readFileSync(target, "utf8");
const original = text;

function findFunctionRange(source, functionName) {
  const marker = "function " + functionName + "(";
  let start = source.indexOf(marker);

  if (start < 0) {
    const asyncMarker = "async function " + functionName + "(";
    start = source.indexOf(asyncMarker);
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
    .replace(/\\s+/g, "")
    .replace(/[　]/g, "")
    .replace(/[‐-‒–—―ー－]/g, "-")
    .toLowerCase();
}

function getReceiptMasterDuplicateConfig(kind) {
  const map = {
    purpose: {
      listKeys: ["purposes", "purposeOptions"],
      idKeys: ["purpose_id", "id"],
      nameKeys: ["purpose_name", "name"],
      selectSelectors: ["#purposeId", "#receiptPurposeId", "[name='purposeId']", "[name='purpose_id']"],
      tempSelectors: ["#purposeTempName", "#purposeCandidateName", "[name='purposeTempName']", "[name='purposeCandidateName']", "[name='purpose_temp_name']", "[name='purpose_candidate_name']"]
    },
    project: {
      listKeys: ["projects", "projectOptions"],
      idKeys: ["project_id", "id"],
      nameKeys: ["project_name", "name"],
      selectSelectors: ["#projectId", "#receiptProjectId", "[name='projectId']", "[name='project_id']"],
      tempSelectors: ["#projectTempName", "#projectCandidateName", "[name='projectTempName']", "[name='projectCandidateName']", "[name='project_temp_name']", "[name='project_candidate_name']"]
    },
    department: {
      listKeys: ["departments", "departmentOptions"],
      idKeys: ["department_id", "id"],
      nameKeys: ["department_name", "name"],
      selectSelectors: ["#departmentId", "#receiptDepartmentId", "[name='departmentId']", "[name='department_id']"],
      tempSelectors: ["#departmentTempName", "#departmentCandidateName", "[name='departmentTempName']", "[name='departmentCandidateName']", "[name='department_temp_name']", "[name='department_candidate_name']"]
    },
    vendor: {
      listKeys: ["vendors", "vendorOptions"],
      idKeys: ["vendor_id", "id"],
      nameKeys: ["vendor_name", "name"],
      selectSelectors: ["#vendorId", "#receiptVendorId", "[name='vendorId']", "[name='vendor_id']"],
      tempSelectors: ["#vendorTempName", "#vendorCandidateName", "[name='vendorTempName']", "[name='vendorCandidateName']", "[name='vendor_temp_name']", "[name='vendor_candidate_name']"]
    }
  };

  return map[kind] || null;
}

function getReceiptMasterDuplicateRoots() {
  const roots = [];

  try {
    if (typeof receiptMasterOptions !== "undefined" && receiptMasterOptions) roots.push(receiptMasterOptions);
  } catch (_) {}

  try {
    if (typeof masterOptions !== "undefined" && masterOptions) roots.push(masterOptions);
  } catch (_) {}

  try {
    if (typeof receiptMasters !== "undefined" && receiptMasters) roots.push(receiptMasters);
  } catch (_) {}

  try {
    if (window.receiptMasterOptions) roots.push(window.receiptMasterOptions);
  } catch (_) {}

  try {
    if (window.masterOptions) roots.push(window.masterOptions);
  } catch (_) {}

  return roots;
}

function getReceiptMasterDuplicateList(kind) {
  const config = getReceiptMasterDuplicateConfig(kind);
  if (!config) return [];

  const roots = getReceiptMasterDuplicateRoots();
  const list = [];

  for (const root of roots) {
    if (!root) continue;

    if (Array.isArray(root)) {
      list.push(...root);
      continue;
    }

    for (const key of config.listKeys) {
      if (Array.isArray(root[key])) {
        list.push(...root[key]);
      }
    }
  }

  return list;
}

function getReceiptMasterDuplicateValue(row, keys) {
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      return row[key];
    }
  }

  return "";
}

function findExistingReceiptMasterByName(kind, name) {
  const config = getReceiptMasterDuplicateConfig(kind);
  if (!config) return null;

  const normalized = normalizeReceiptMasterDuplicateName(name);
  if (!normalized) return null;

  const list = getReceiptMasterDuplicateList(kind);

  for (const row of list) {
    const rowName = getReceiptMasterDuplicateValue(row, config.nameKeys);
    if (normalizeReceiptMasterDuplicateName(rowName) === normalized) {
      return {
        id: getReceiptMasterDuplicateValue(row, config.idKeys),
        name: String(rowName || "").trim(),
        source: "list"
      };
    }
  }

  for (const selector of config.selectSelectors) {
    const select = document.querySelector(selector);
    if (!select || !select.options) continue;

    for (const option of Array.from(select.options)) {
      const optionName = String(option.textContent || "").trim();
      if (normalizeReceiptMasterDuplicateName(optionName) === normalized) {
        return {
          id: option.value,
          name: optionName,
          source: "select"
        };
      }
    }
  }

  return null;
}

function getReceiptMasterDuplicateCandidateInput(kind) {
  const config = getReceiptMasterDuplicateConfig(kind);
  if (!config) return null;

  for (const selector of config.tempSelectors) {
    const input = document.querySelector(selector);
    if (input) return input;
  }

  return null;
}

function selectExistingReceiptMasterDuplicate(kind, existing) {
  const config = getReceiptMasterDuplicateConfig(kind);
  if (!config || !existing) return false;

  let selected = false;

  for (const selector of config.selectSelectors) {
    const select = document.querySelector(selector);
    if (!select) continue;

    if (existing.id !== undefined && existing.id !== null && String(existing.id) !== "") {
      select.value = String(existing.id);
      select.dispatchEvent(new Event("change", { bubbles: true }));
      selected = true;
      break;
    }
  }

  const input = getReceiptMasterDuplicateCandidateInput(kind);
  if (input && existing.name) {
    input.value = existing.name;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  return selected;
}

function guardReceiptMasterDuplicateBeforeCreate(kind, candidateName) {
  const name = String(candidateName || "").trim();
  if (!name) return false;

  const existing = findExistingReceiptMasterByName(kind, name);
  if (!existing) return false;

  selectExistingReceiptMasterDuplicate(kind, existing);

  alert("既に同じ名称のマスタがあります。\\n新規登録せず、既存の「" + existing.name + "」を選択しました。");

  return true;
}

`;

if (!text.includes("function guardReceiptMasterDuplicateBeforeCreate(kind, candidateName)")) {
  const range = findFunctionRange(text, "registerReceiptMasterFromCandidate");
  if (!range) {
    throw new Error("registerReceiptMasterFromCandidate 関数が見つかりません。");
  }

  text = text.slice(0, range.start) + helper + "\n" + text.slice(range.start);
}

const range2 = findFunctionRange(text, "registerReceiptMasterFromCandidate");
if (!range2) {
  throw new Error("registerReceiptMasterFromCandidate 関数が見つかりません。");
}

let fn = text.slice(range2.start, range2.end);

if (!fn.includes("guardReceiptMasterDuplicateBeforeCreate(kind")) {
  const fetchPatterns = [
    /(\n\s*)(const\s+\w+\s*=\s*await\s+fetch\s*\(\s*[`"']\/api\/masters\/)/,
    /(\n\s*)(await\s+fetch\s*\(\s*[`"']\/api\/masters\/)/,
    /(\n\s*)(fetch\s*\(\s*[`"']\/api\/masters\/)/
  ];

  let inserted = false;

  const guardBlock = `
  const __receiptMasterCandidateNameForDuplicate =
    (typeof candidateName !== "undefined" && candidateName)
      ? candidateName
      : ((typeof name !== "undefined" && name)
        ? name
        : ((typeof masterName !== "undefined" && masterName)
          ? masterName
          : ""));

  if (guardReceiptMasterDuplicateBeforeCreate(kind, __receiptMasterCandidateNameForDuplicate)) {
    return;
  }

`;

  for (const pattern of fetchPatterns) {
    if (pattern.test(fn)) {
      fn = fn.replace(pattern, "$1" + guardBlock + "$1$2");
      inserted = true;
      break;
    }
  }

  if (!inserted) {
    throw new Error("registerReceiptMasterFromCandidate 内の /api/masters/ fetch が見つかりません。");
  }

  text = text.slice(0, range2.start) + fn + text.slice(range2.end);
}

if (text === original) {
  throw new Error("変更が入りませんでした。既に反映済みの可能性があります。");
}

fs.writeFileSync(after, text, "utf8");
