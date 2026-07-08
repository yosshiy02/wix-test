const fs = require("fs");
const path = require("path");

function paymentDocumentPromptDir() {
  return path.join(__dirname, "prompts");
}

function safePromptFileName(fileName) {
  const name = String(fileName || "").trim();

  if (!name) return "";
  if (name.includes("/") || name.includes("\\") || name.includes("\0")) return "";
  if (name.includes("..")) return "";
  if (!/^[A-Za-z0-9_.-]+$/.test(name)) return "";
  if (!name.endsWith(".txt")) return "";

  return name;
}

function loadPaymentDocumentPromptText(fileName, fallbackText = "") {
  const safeName = safePromptFileName(fileName);

  if (!safeName) {
    return String(fallbackText || "");
  }

  const filePath = path.join(paymentDocumentPromptDir(), safeName);

  try {
    if (!fs.existsSync(filePath)) {
      return String(fallbackText || "");
    }

    const text = fs.readFileSync(filePath, "utf8");

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
    .replace(/[（）()]/g, "")
    .toLowerCase();
}

function includesAny(text, words) {
  const s = normalizeForPromptRule(text);

  return words.some(word => s.includes(normalizeForPromptRule(word)));
}

function includesAll(text, words) {
  const s = normalizeForPromptRule(text);

  return words.every(word => s.includes(normalizeForPromptRule(word)));
}

function pushUnique(list, name) {
  if (!name) return;
  if (!list.includes(name)) list.push(name);
}

function selectPaymentDocumentPromptFiles(context = {}) {
  const phase = String(context.phase || "").trim().toLowerCase();
  const ocrText = String(context.ocrText || "");
  const draft = context.draft && typeof context.draft === "object" ? context.draft : {};
  const group = String(context.group || "");

  const routeText = [
    draft.specialist_route_code,
    group
  ].join(" ");

  const codeText = [
    draft.document_type_code,
    draft.payment_destination_code,
    draft.accounting_category_code,
    draft.payable_kind_code,
    draft.source_type_code,
    draft.specialist_route_code,
    group
  ].join(" ");

  /*
    1回目 classification / sorting は分類専用。
    詳細抽出ルールは読ませない。
  */
  if (phase === "classification" || phase === "sorting") {
    return [
      "common-rules.txt",
      "sorting.extra-rules.txt"
    ];
  }

  /*
    2回目 detail は route 優先。
    1回目で選んだ specialist_route_code を前提に、専門ルールだけ読む。
    OCR本文の「請求合計」などで別系統を混ぜない。
  */
  if (phase === "detail") {
    const files = [];

    if (includesAny(routeText, ["invoice_payable"])) {
      pushUnique(files, "rules-invoice.txt");
      return files;
    }

    if (includesAny(routeText, ["tax_public"])) {
      pushUnique(files, "rules-tax.txt");
      return files;
    }

    if (includesAny(routeText, ["card_statement"])) {
      pushUnique(files, "rules-card.txt");
      return files;
    }

    if (includesAny(routeText, ["mail_saved"])) {
      pushUnique(files, "rules-mail-saved.txt");

      if (includesAny(codeText + " " + ocrText, ["utility", "public_utility", "communication", "電気料金", "ガス料金", "水道料金", "通信費", "電話料金", "インターネット料金"])) {
        pushUnique(files, "rules-utility.txt");
      }

      return files.slice(0, 2);
    }

    if (includesAny(routeText, ["utility_notice", "public_utility", "communication"])) {
      pushUnique(files, "rules-utility.txt");
      return files;
    }

    if (includesAny(routeText, ["contract_insurance_lease"])) {
      const isInsurance =
        includesAny(codeText, ["insurance_notice", "insurance"]) ||
        includesAny(ocrText, ["保険料通知書", "保険料", "保険契約", "契約番号:ins"]);

      const isLease =
        includesAny(codeText, ["lease_contract", "lease"]) ||
        includesAny(ocrText, ["リース料", "リース契約", "リース物件"]);

      if (isInsurance) pushUnique(files, "rules-insurance.txt");
      if (isLease) pushUnique(files, "rules-lease.txt");

      if (files.length === 0) {
        pushUnique(files, "rules-insurance.txt");
        pushUnique(files, "rules-lease.txt");
      }

      return files.slice(0, 2);
    }

    if (includesAny(routeText, ["paid_evidence"])) {
      pushUnique(files, "rules-receipt.txt");
      return files;
    }

    /*
      route が空・未対応の場合だけ、旧来のOCR補助判定を使う。
      ここは互換性のための逃げ道。
    */
    if (includesAny(codeText, ["invoice", "accounts_payable"]) || includesAny(ocrText, ["請求書", "請求番号", "invoice"])) {
      pushUnique(files, "rules-invoice.txt");
    }

    if (includesAny(codeText, ["tax_payment", "public_payment"]) || includesAny(ocrText, ["納付書", "納税通知書", "税務署", "市税事務所", "合計納付額"])) {
      pushUnique(files, "rules-tax.txt");
    }

    if (includesAny(codeText, ["card_statement", "card_payable"]) || includesAny(ocrText, ["カード明細", "クレジットカード", "カード会社", "ご利用明細"])) {
      pushUnique(files, "rules-card.txt");
    }

    if (includesAny(codeText, ["mail_saved"]) || includesAny(ocrText, ["メール保存ファイル", "from", "subject", "received"])) {
      pushUnique(files, "rules-mail-saved.txt");
    }

    if (includesAny(codeText, ["utility_notice", "public_utility", "communication"]) || includesAny(ocrText, ["電気料金", "ガス料金", "水道料金", "通信費", "電話料金", "インターネット料金"])) {
      pushUnique(files, "rules-utility.txt");
    }

    if (includesAny(codeText, ["insurance_notice", "insurance"]) || includesAny(ocrText, ["保険料通知書", "保険料", "保険契約", "契約番号:ins"])) {
      pushUnique(files, "rules-insurance.txt");
    }

    if (includesAny(codeText, ["lease_contract", "lease"]) || includesAny(ocrText, ["リース料", "リース契約", "リース物件"])) {
      pushUnique(files, "rules-lease.txt");
    }

    if (includesAny(codeText, ["receipt"]) || includesAny(ocrText, ["領収書", "領収済", "受領印", "支払済"])) {
      pushUnique(files, "rules-receipt.txt");
    }

    return files.slice(0, 3);
  }

  /*
    phase 未指定の既存呼び出しは旧挙動を維持。
  */
  const files = ["common-rules.txt"];

  const strongInvoice =
    includesAny(ocrText, ["請求書", "請求番号", "請求合計", "invoice"]) ||
    includesAll(ocrText, ["請求日", "支払期限"]) ||
    includesAll(ocrText, ["品名", "数量", "税抜金額", "消費税", "請求合計"]);

  const strongTax =
    includesAny(ocrText, ["納付書", "納税通知書", "税務署", "市税事務所", "合計納付額"]) ||
    includesAll(ocrText, ["税目", "納付期限"]) ||
    includesAll(ocrText, ["税目", "納付先"]);

  const insurance =
    includesAny(ocrText, ["保険料通知書", "保険料", "保険契約", "契約番号:ins"]) ||
    includesAny(codeText, ["insurance_notice", "insurance"]);

  const mailSaved =
    includesAny(ocrText, ["メール保存ファイル", "from", "subject", "received"]) ||
    includesAny(codeText, ["mail_saved"]);

  const card =
    includesAny(ocrText, ["カード明細", "クレジットカード", "カード会社", "ご利用明細"]) ||
    includesAny(codeText, ["card_statement", "card_payable"]);

  const utility =
    includesAny(ocrText, ["電気料金", "ガス料金", "水道料金", "通信費", "電話料金", "インターネット料金"]) ||
    includesAny(codeText, ["utility_notice", "public_utility"]);

  const lease =
    includesAny(ocrText, ["リース料", "リース契約", "リース物件"]) ||
    includesAny(codeText, ["lease_contract", "lease"]);

  const receipt =
    includesAny(ocrText, ["領収書", "領収済", "受領印", "支払済"]) ||
    includesAny(codeText, ["receipt"]);

  if (strongInvoice || includesAny(codeText, ["invoice", "accounts_payable"])) {
    pushUnique(files, "rules-invoice.txt");
  }

  if (insurance) pushUnique(files, "rules-insurance.txt");
  if (mailSaved) pushUnique(files, "rules-mail-saved.txt");
  if (card) pushUnique(files, "rules-card.txt");
  if (utility) pushUnique(files, "rules-utility.txt");
  if (lease) pushUnique(files, "rules-lease.txt");
  if (receipt) pushUnique(files, "rules-receipt.txt");

  if (strongTax && (!strongInvoice || includesAny(ocrText, ["納付書", "納税通知書", "税務署", "市税事務所", "合計納付額"]))) {
    pushUnique(files, "rules-tax.txt");
  }

  return files.slice(0, 3);
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