const fs = require("fs");
const path = require("path");

function paymentDocumentPromptDir() {
  return path.join(__dirname, "prompts");
}

function safePromptFileName(fileName) {
  const name = String(fileName || "").trim();

  if (!name) {
    return "";
  }

  if (name.includes("/") || name.includes("\\") || name.includes("..") || name.includes("\0")) {
    return "";
  }

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
  } catch (err) {
    if (fallbackText) {
      return String(fallbackText || "");
    }

    return "";
  }
}

function appendPaymentDocumentExternalPrompt(basePrompt, fileNames) {
  const parts = [String(basePrompt || "")];

  const names = Array.isArray(fileNames) ? fileNames : [];

  for (const name of names) {
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
  paymentDocumentPromptDir,
  loadPaymentDocumentPromptText,
  appendPaymentDocumentExternalPrompt
};