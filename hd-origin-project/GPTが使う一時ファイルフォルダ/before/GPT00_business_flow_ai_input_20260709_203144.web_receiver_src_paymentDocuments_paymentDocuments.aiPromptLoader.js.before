const fs = require("fs");
const path = require("path");

function paymentDocumentPromptDir() {
  return path.join(__dirname, "prompts");
}

function safePromptFileName(fileName) {
  const raw = String(fileName || "").trim();

  if (!raw) return "";
  if (raw.includes("\0")) return "";
  if (raw.includes("..")) return "";

  const normalized = raw.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);

  if (parts.length < 1) return "";

  for (const part of parts) {
    if (!/^[A-Za-z0-9_.-]+$/.test(part)) return "";
  }

  if (!parts[parts.length - 1].endsWith(".txt")) return "";

  return parts.join(path.sep);
}

function loadPaymentDocumentPromptText(fileName, fallbackText = "") {
  const safeName = safePromptFileName(fileName);

  if (!safeName) {
    return String(fallbackText || "");
  }

  const root = paymentDocumentPromptDir();
  const filePath = path.join(root, safeName);

  try {
    const resolvedRoot = path.resolve(root);
    const resolvedFile = path.resolve(filePath);

    if (!resolvedFile.startsWith(resolvedRoot + path.sep) && resolvedFile !== resolvedRoot) {
      return String(fallbackText || "");
    }

    if (!fs.existsSync(resolvedFile)) {
      return String(fallbackText || "");
    }

    const text = fs.readFileSync(resolvedFile, "utf8");

    if (!String(text || "").trim()) {
      return String(fallbackText || "");
    }

    return text;
  } catch {
    return String(fallbackText || "");
  }
}

function normalizeForPromptRule(value) {
  return String(value || "")
    .replace(/[　\s]+/g, "")
    .replace(/[・･·]/g, "")
    .replace(/[：:]/g, "")
    .replace(/[／\/]/g, "")
    .replace(/[_\-.]+/g, "")
    .replace(/[（）()]/g, "")
    .toLowerCase();
}

function includesAny(text, words) {
  const s = normalizeForPromptRule(text);

  return words.some(word => s.includes(normalizeForPromptRule(word)));
}

function pushUnique(list, name) {
  if (!name) return;
  if (!list.includes(name)) list.push(name);
}


function promptFilesGeneralAffairs() {
  return [
    "common/general-affairs-ai.txt"
  ];
}
function promptFilesStage1() {
  return [
    "stage1-classification/system.txt",
    ...promptFilesGeneralAffairs(),
    "stage1-classification/extra-rules.txt"
  ];
}

function promptFilesStage2() {
  return [
    "stage2-common-draft/system.txt",
    "stage2-common-draft/common-fields.txt",
    "stage2-common-draft/save-rules.txt"
  ];
}

function specialistCodeFromContext(context = {}) {
  const draft = context.draft && typeof context.draft === "object" ? context.draft : {};
  const raw = [
    context.analysis_system_code,
    context.specialist_route_code,
    context.group,
    draft.analysis_system_code,
    draft.specialist_route_code,
    draft.document_group,
    draft.payment_destination_code,
    draft.document_type_code
  ].join(" ");

  const text = normalizeForPromptRule(raw);

  if (text.includes("taxpublic") || text.includes("taxpayment") || text.includes("税金") || text.includes("公的支払")) {
    return "tax-public";
  }

  if (text.includes("invoicepayable") || text.includes("accountspayable") || text.includes("invoice") || text.includes("請求") || text.includes("買掛") || text.includes("未払")) {
    return "invoice-payable";
  }

  if (text.includes("receiptevidence") || text.includes("paidevidence") || text.includes("receipt") || text.includes("領収") || text.includes("レシート")) {
    return "receipt-evidence";
  }

  if (text.includes("cardstatement") || text.includes("card") || text.includes("カード")) {
    return "card-statement";
  }

  if (text.includes("contractinsurancelease") || text.includes("contract") || text.includes("insurance") || text.includes("lease") || text.includes("契約") || text.includes("保険") || text.includes("リース")) {
    return "contract-insurance-lease";
  }

  if (text.includes("utilitycommunication") || text.includes("utility") || text.includes("communication") || text.includes("公共料金") || text.includes("通信")) {
    return "utility-communication";
  }

  return "";
}

function promptFilesStage3(context = {}) {
  const files = [
    "stage3-specialist/common/system.txt",
    "stage3-specialist/common/output-schema.txt",
    "stage3-specialist/common/human-confirm-rules.txt"
  ];

  const specialist = specialistCodeFromContext(context);

  if (specialist === "invoice-payable" || specialist === "tax-public") {
    for (const file of promptFilesGeneralAffairs()) {
      pushUnique(files, file);
    }
  }
if (specialist) {
    pushUnique(files, "stage3-specialist/" + specialist + "/system.txt");
    pushUnique(files, "stage3-specialist/" + specialist + "/fields.txt");
    pushUnique(files, "stage3-specialist/" + specialist + "/rules.txt");
    pushUnique(files, "stage3-specialist/" + specialist + "/examples.txt");
  }

  return files;
}

function selectPaymentDocumentPromptFiles(context = {}) {
  const phase = String(context.phase || "").trim().toLowerCase();

  /*
    1回目AI:
    共通仕分け。専門システムを決めるだけ。
  */
  if (
    phase === "stage1" ||
    phase === "classification" ||
    phase === "sorting"
  ) {
    return promptFilesStage1();
  }

  /*
    2回目AI:
    共通下書きDB化。ここでは専門解析をしない。
    旧 phase=detail 呼び出しは、3段階設計では stage2 として扱う。
  */
  if (
    phase === "stage2" ||
    phase === "common_draft" ||
    phase === "common-draft" ||
    phase === "detail"
  ) {
    return promptFilesStage2();
  }

  /*
    3回目AI:
    専門解析。analysis_system_code / specialist_route_code に応じて
    専門プロンプトだけ読む。
  */
  if (
    phase === "stage3" ||
    phase === "specialist" ||
    phase === "specialist_analysis" ||
    phase === "specialist-analysis"
  ) {
    return promptFilesStage3(context);
  }

  /*
    phase未指定は安全側で1回目扱い。
    旧互換のため、全専門ルールを混ぜない。
  */
  return promptFilesStage1();
}

function appendPaymentDocumentExternalPrompt(basePrompt, fileNames) {
  const parts = [String(basePrompt || "")];

  for (const name of Array.isArray(fileNames) ? fileNames : []) {
    const text = loadPaymentDocumentPromptText(name, "");

    if (String(text || "").trim()) {
      parts.push(
        [
          "==============================",
          "外部プロンプト: " + name,
          "==============================",
          text
        ].join("\n")
      );
    }
  }

  return parts.join("\n\n");
}

module.exports = {
  loadPaymentDocumentPromptText,
  appendPaymentDocumentExternalPrompt,
  selectPaymentDocumentPromptFiles
};


