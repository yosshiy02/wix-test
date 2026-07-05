const fs = require("fs");
const path = require("path");
const pool = require("../db");

function readDotEnv() {
  const map = {};
  const candidates = [];
  const projectRoot = path.resolve(__dirname, "../../..");

  if (process.env.HD_ORIGIN_ENV_PATH) {
    candidates.push(process.env.HD_ORIGIN_ENV_PATH);
  }

  const envPathFile = path.join(projectRoot, ".env_path.txt");
  if (fs.existsSync(envPathFile)) {
    const p = fs.readFileSync(envPathFile, "utf8").trim();
    if (p) candidates.push(p);
  }

  candidates.push(path.join(projectRoot, ".env"));

  for (const envPath of candidates) {
    if (!envPath || !fs.existsSync(envPath)) continue;

    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

    for (const line of lines) {
      if (!line || /^\s*#/.test(line)) continue;

      const index = line.indexOf("=");
      if (index < 0) continue;

      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");

      if (key && map[key] === undefined) {
        map[key] = value;
      }
    }
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && value !== "") {
      map[key] = value;
    }
  }

  return map;
}
function extractOutputText(responseJson) {
  const output = Array.isArray(responseJson.output) ? responseJson.output : [];

  for (const part of output) {
    const content = Array.isArray(part.content) ? part.content : [];

    for (const c of content) {
      if (c && c.type === "output_text" && typeof c.text === "string") {
        return c.text;
      }
    }
  }

  return "";
}

function parseJsonLoose(text) {
  const raw = String(text || "").trim();

  try {
    return JSON.parse(raw);
  } catch (_) {}

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error("AI result JSON was not found: " + raw);
  }

  return JSON.parse(match[0]);
}

function normalizeInteger(value) {
  if (value === null || value === undefined || value === "") return null;

  const n = Number(String(value).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) return null;

  return Math.round(n);
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return null;

  const n = Number(String(value).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) return null;

  return n;
}

function normalizeConfidence(value) {
  if (value === null || value === undefined || value === "") return null;

  let n = Number(String(value).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) return null;

  // DBは 0.0000 ～ 1.0000 の小数で保存する。
  // AIが 85 や 85% と返した場合は 0.85 に直す。
  if (n > 1) {
    n = n / 100;
  }

  if (n < 0) n = 0;
  if (n > 1) n = 1;

  return Math.round(n * 10000) / 10000;
}

function normalizeLineItems(value) {
  if (!Array.isArray(value)) return [];

  return value.map((line) => ({
    name: String(line.name || line.itemName || ""),
    quantity: normalizeNumber(line.quantity),
    unitPrice: normalizeInteger(line.unitPrice),
    amount: normalizeInteger(line.amount),
    taxRate: String(line.taxRate || ""),
    memo: String(line.memo || "")
  })).filter((line) => {
    return line.name ||
      line.quantity !== null ||
      line.unitPrice !== null ||
      line.amount !== null ||
      line.taxRate ||
      line.memo;
  });
}

async function analyzeReceiptImport(receiptImport) {
  const env = readDotEnv();

  const apiKey = env.OPENAI_API_KEY;
  const model = env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing in .env");
  }

  const ocrText = String(receiptImport.ocr_raw_text || "").trim();

  if (!ocrText) {
    throw new Error("OCR text is empty. Image AI is disabled. Import OCR text first.");
  }

  const instruction = [
    "あなたは日本のレシートOCRテキスト解析AIです。",
    "画像は見ません。与えられたOCR本文だけから判断してください。",
    "目的は会計確定ではなく、人間が画像を見ながら修正するための読取候補作成です。",
    "店名、日付、合計、税額、消費税内訳、税率、税処理、支払方法、インボイス番号、明細行をJSONだけで返してください。",
    "推測できない項目は null または空文字にしてください。",
    "インボイス番号は T + 13桁 の登録番号だけを入れてください。",
    "",
    "【店舗情報ルール】",
    "vendorName には、レシートに印字されている店名・支払先名を入れてください。",
    "vendorAddress には、レシートに印字されている住所を入れてください。読めない場合は空文字にしてください。",
    "vendorPhone には、レシートに印字されている電話番号を入れてください。読めない場合は空文字にしてください。",
    "receiptTimeText には、レシートに印字されている時刻を HH:mm 形式で入れてください。読めない場合は空文字にしてください。",
    "伝票番号、注文番号、レジ番号、会員番号、承認番号、カード番号は invoiceNumber に入れず、memo に入れてください。",
    "",
    "【消費税内訳ルール】",
    "taxBreakdowns は、レシート本文に明記されている税率別内訳から作ってください。",
    "例：(10%内税対象 2900)(10%内消費税額 263) のような記載がある場合だけ、課税10%の内訳行を作ってください。",
    "例：(8%内税対象 648)(8%内消費税額 48)(10%内税対象 548)(10%内消費税額 49) のように複数ある場合は、必要な行だけ複数作ってください。",
    "非課税対象、不課税対象、対象外がOCR本文に明記されている場合は、それぞれ taxBreakdowns に行を作り、taxAmount は0にしてください。",
    "合計金額 totalAmount と消費税合計 taxAmount だけから、消費税内訳を勝手に1行生成してはいけません。",
    "税率別内訳がOCR本文から読めない場合、taxBreakdowns は空配列 [] にしてください。",
    "taxCategoryName は必ず 課税10% / 軽減8% / 非課税 / 不課税 / 対象外 のいずれかに寄せてください。",
    "taxTreatmentName は必ず 税込・内税 / 税抜・外税 / 非課税 / 不課税 / 対象外 / 不明 のいずれかに寄せてください。",

    "【明細強化ルール】",
    "明細行は最重要です。OCR本文から読める商品名・料理名・サービス名・品名は必ず lineItems に入れてください。",
    "summary に品名を書く場合、その品名は必ず lineItems にも入れてください。",
    "数量、単価、金額がOCR本文から読める場合は必ず入れてください。",
    "OCR本文に「品名 数量 単価 金額」「品名 数量 金額」「品名 単価 数量」「品名 金額」のような並びがある場合、lineItems に分解してください。",
    "単価と数量から金額が計算できる場合は amount に計算結果を入れてください。",
    "合計金額・税額・小計・クレジット計・預り金・釣銭だけを明細として扱わないでください。",
    "読める品名が1つでもある場合、lineItems を空配列にしてはいけません。",
    "伝票No、テーブルNo、レジNo、注文番号、承認番号、カード番号は明細ではなく memo に入れてください。",

    "勘定科目は控えめな候補でよいです。迷う場合は空文字にしてください。",

    "返すJSON形式:",
    "{",
    "  \"transactionDate\": \"YYYY-MM-DD または null\",",
    "  \"vendorName\": \"店名・支払先名\",",
    "  \"vendorAddress\": \"住所または空文字\",",
    "  \"vendorPhone\": \"電話番号または空文字\",",
    "  \"receiptTimeText\": \"HH:mm または空文字\",",
    "  \"totalAmount\": 0,",
    "  \"taxAmount\": 0,",
    "  \"taxRate\": \"10%/8%/混在/不明\",",
    "  \"taxTreatmentName\": \"税込・内税/税抜・外税/非課税/不課税/免税/対象外/不明\",",
    "  \"taxBreakdowns\": [",
    "    {",
    "      \"taxCategoryName\": \"課税10%/軽減8%/非課税/不課税/対象外\",",
    "      \"taxTreatmentName\": \"税込・内税/税抜・外税/非課税/不課税/対象外/不明\",",
    "      \"targetAmount\": 0,",
    "      \"taxAmount\": 0",
    "    }",
    "  ],",
    "  \"paymentMethodName\": \"現金/クレジットカード/電子マネー/不明\",",
    "  \"invoiceNumber\": \"Tから始まる13桁番号または空文字\",",
    "  \"summary\": \"摘要候補\",",
    "  \"memo\": \"注意点・伝票番号・注文番号など\",",
    "  \"accountTitleName\": \"控えめな会計候補\",",
    "  \"confidence\": 0,",
    "  \"lineItems\": [",
    "    {",
    "      \"name\": \"品名\",",
    "      \"quantity\": 1,",
    "      \"unitPrice\": 0,",
    "      \"amount\": 0,",
    "      \"taxRate\": \"10%/8%/不明\",",
    "      \"memo\": \"\"",
    "    }",
    "  ]",
    "}"
  ].join("\n");

  const body = {
    model,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: instruction
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "OCR本文:\n" + ocrText
          }
        ]
      }
    ],
    max_output_tokens: 1800,
    store: false
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(body)
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error("OpenAI API error status=" + response.status + ": " + responseText);
  }

  const responseJson = JSON.parse(responseText);
  const outputText = extractOutputText(responseJson);
  const parsed = parseJsonLoose(outputText);

  return {
    transactionDate: parsed.transactionDate || null,
    vendorName: parsed.vendorName || "",
    vendorAddress: parsed.vendorAddress || parsed.vendor_address || "",
    vendorPhone: parsed.vendorPhone || parsed.vendor_phone || "",
    receiptTimeText: parsed.receiptTimeText || parsed.receipt_time_text || "",
    totalAmount: normalizeInteger(parsed.totalAmount),
    taxAmount: normalizeInteger(parsed.taxAmount),
    taxRate: parsed.taxRate || "",
    taxTreatmentName: parsed.taxTreatmentName || "",
    taxBreakdowns: Array.isArray(parsed.taxBreakdowns) ? parsed.taxBreakdowns : [],
    paymentMethodName: parsed.paymentMethodName || "",
    accountTitleName: parsed.accountTitleName || "",
    invoiceNumber: parsed.invoiceNumber || "",
    summary: parsed.summary || "",
    memo: parsed.memo || "",
    confidence: normalizeConfidence(parsed.confidence),
    lineItems: normalizeLineItems(parsed.lineItems),
    aiModel: model,
    aiRawJson: parsed
  };
}

/* RECEIPT_AI_MASTER_HINTS_START */
/*
  レシートAIへマスタ候補を渡す。
  トークン節約のため、勘定科目は最大30件、支払方法・インボイス区分・証憑区分は有効分だけ渡す。
  画像は渡さず、OCR本文だけを解析する方針は維持する。
*/

function receiptAiMasterLine(id, name, note) {
  const cleanId = id === null || id === undefined ? "" : String(id);
  const cleanName = String(name || "").trim();
  const cleanNote = String(note || "").trim();

  if (!cleanId && !cleanName) return "";

  return cleanId + ": " + cleanName + (cleanNote ? " - " + cleanNote : "");
}

async function getReceiptAiMasterHints() {
  const [
    accountTitlesResult,
    paymentMethodsResult,
    invoiceTypesResult,
    evidenceTypesResult
  ] = await Promise.all([
    pool.query(`
      SELECT
        account_title_id,
        account_name,
        account_code,
        sort_order
      FROM expenses.account_titles
      WHERE is_active = TRUE
      ORDER BY sort_order, account_title_id
      LIMIT 30
    `),
    pool.query(`
      SELECT
        payment_method_id,
        method_name
      FROM expenses.payment_methods
      WHERE is_active = TRUE
      ORDER BY sort_order, payment_method_id
    `),
    pool.query(`
      SELECT
        invoice_type_id,
        invoice_type_name
      FROM expenses.invoice_types
      WHERE is_active = TRUE
      ORDER BY sort_order, invoice_type_id
    `),
    pool.query(`
      SELECT
        evidence_type_id,
        evidence_type_name
      FROM expenses.evidence_types
      WHERE is_active = TRUE
      ORDER BY sort_order, evidence_type_id
    `)
  ]);

  return {
    accountTitles: accountTitlesResult.rows,
    paymentMethods: paymentMethodsResult.rows,
    invoiceTypes: invoiceTypesResult.rows,
    evidenceTypes: evidenceTypesResult.rows
  };
}

function formatReceiptAiMasterHints(masters) {
  const lines = [];

  lines.push("【マスタ候補】");
  lines.push("次の候補から選べる場合は、IDと名称をそのまま返してください。");
  lines.push("候補から判断できない場合は、IDは null、名称は空文字または控えめな候補にしてください。");
  lines.push("");

  lines.push("【勘定科目候補 最大30件】");
  for (const item of masters.accountTitles || []) {
    lines.push(receiptAiMasterLine(
      item.account_title_id,
      item.account_name,
      item.account_code ? "code=" + item.account_code : ""
    ));
  }

  lines.push("");
  lines.push("【支払方法候補】");
  for (const item of masters.paymentMethods || []) {
    lines.push(receiptAiMasterLine(item.payment_method_id, item.method_name, ""));
  }

  lines.push("");
  lines.push("【インボイス区分候補】");
  for (const item of masters.invoiceTypes || []) {
    lines.push(receiptAiMasterLine(item.invoice_type_id, item.invoice_type_name, ""));
  }

  lines.push("");
  lines.push("【証憑区分候補】");
  for (const item of masters.evidenceTypes || []) {
    lines.push(receiptAiMasterLine(item.evidence_type_id, item.evidence_type_name, ""));
  }

  return lines.join("\n");
}

function normalizeNullableInteger(value) {
  if (value === null || value === undefined || value === "") return null;

  const n = Number(String(value).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) return null;

  return Math.trunc(n);
}

analyzeReceiptImport = async function analyzeReceiptImportWithMasterHints(receiptImport) {
  const env = readDotEnv();

  const apiKey = env.OPENAI_API_KEY;
  const model = env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing in .env");
  }

  const ocrText = String(receiptImport.ocr_raw_text || "").trim();

  if (!ocrText) {
    throw new Error("OCR text is empty. Image AI is disabled. Import OCR text first.");
  }

  const masterHints = await getReceiptAiMasterHints();
  const masterText = formatReceiptAiMasterHints(masterHints);

  const instruction = [
    "あなたは日本のレシートOCRテキスト解析AIです。",
    "画像は見ません。与えられたOCR本文だけから判断してください。",
    "目的は会計確定ではなく、人間が画像を見ながら修正するための読取候補作成です。",
    "店名、日付、合計、税額、消費税内訳、税率、税処理、支払方法、インボイス番号、インボイス区分、証憑区分、勘定科目候補、明細行をJSONだけで返してください。",
    "推測できない項目は null または空文字にしてください。",
    "支払方法、インボイス区分、証憑区分は、候補一覧から選べる場合だけIDを返してください。",
    "勘定科目は候補一覧から近いものを控えめに選び、迷う場合は accountTitleName を空文字にしてください。",
    "インボイス番号は T + 13桁 の登録番号だけを入れてください。",
    "",
    "【店舗情報ルール】",
    "vendorName には、レシートに印字されている店名・支払先名を入れてください。",
    "vendorAddress には、レシートに印字されている住所を入れてください。読めない場合は空文字にしてください。",
    "vendorPhone には、レシートに印字されている電話番号を入れてください。読めない場合は空文字にしてください。",
    "receiptTimeText には、レシートに印字されている時刻を HH:mm 形式で入れてください。読めない場合は空文字にしてください。",
    "伝票番号、注文番号、レジ番号、会員番号、承認番号、カード番号は invoiceNumber に入れず、memo に入れてください。",
    "",
    "【インボイス区分ルール】",
    "Tから始まる13桁の登録番号が読める場合は、インボイス区分候補から最も合うものを選んでください。",
    "登録番号が読めない場合や判断不能の場合は、IDは null にしてください。",
    "",
    "【証憑区分ルール】",
    "通常のレシート画像であれば、証憑区分候補からレシートに該当するものを選んでください。",
    "領収書・請求書など明確に別の証憑の場合は、その候補を選んでください。",
    "",
    "【消費税内訳ルール】",
    "taxBreakdowns は、レシート本文に明記されている税率別内訳から作ってください。",
    "合計金額 totalAmount と消費税合計 taxAmount だけから、消費税内訳を勝手に1行生成してはいけません。",
    "税率別内訳がOCR本文から読めない場合、taxBreakdowns は空配列 [] にしてください。",
    "taxCategoryName は必ず 課税10% / 軽減8% / 非課税 / 不課税 / 対象外 のいずれかに寄せてください。",
    "",
    "返すJSON形式:",
    "{",
    "  \"transactionDate\": \"YYYY-MM-DD または null\",",
    "  \"vendorName\": \"店名\",",
    "  \"vendorAddress\": \"住所または空文字\",",
    "  \"vendorPhone\": \"電話番号または空文字\",",
    "  \"receiptTimeText\": \"HH:mm または空文字\",",
    "  \"totalAmount\": 0,",
    "  \"taxAmount\": 0,",
    "  \"taxRate\": \"10%/8%/複数/不明\",",
    "  \"taxTreatmentName\": \"税込・内税/税抜・外税/非課税/不課税/免税/対象外/不明\",",
    "  \"taxBreakdowns\": [",
    "    {",
    "      \"taxCategoryName\": \"課税10%/軽減8%/非課税/不課税/対象外\",",
    "      \"taxTreatmentName\": \"税込・内税/税抜・外税/非課税/不課税/免税/対象外/不明\",",
    "      \"targetAmount\": 0,",
    "      \"taxAmount\": 0,",
    "      \"memo\": \"\"",
    "    }",
    "  ],",
    "  \"paymentMethodId\": null,",
    "  \"paymentMethodName\": \"支払方法候補名または空文字\",",
    "  \"invoiceNumber\": \"Tから始まる13桁番号または空文字\",",
    "  \"invoiceTypeId\": null,",
    "  \"invoiceTypeName\": \"インボイス区分候補名または空文字\",",
    "  \"evidenceTypeId\": null,",
    "  \"evidenceTypeName\": \"証憑区分候補名または空文字\",",
    "  \"evidenceMemo\": \"証憑に関する注意があれば短く\",",
    "  \"summary\": \"摘要候補\",",
    "  \"memo\": \"注意点・伝票番号・注文番号など\",",
    "  \"accountTitleName\": \"勘定科目候補名または空文字\",",
    "  \"confidence\": 0,",
    "  \"lineItems\": [",
    "    {",
    "      \"name\": \"品名\",",
    "      \"quantity\": 1,",
    "      \"unitPrice\": 0,",
    "      \"amount\": 0,",
    "      \"taxRate\": \"10%/8%/不明\",",
    "      \"memo\": \"\"",
    "    }",
    "  ]",
    "}"
  ].join("\n");

  const body = {
    model,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: instruction
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: masterText + "\n\nOCR本文:\n" + ocrText
          }
        ]
      }
    ],
    max_output_tokens: 2400,
    store: false
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + apiKey,
      "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(body)
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error("OpenAI API error status=" + response.status + ": " + responseText);
  }

  const responseJson = JSON.parse(responseText);
  const outputText = extractOutputText(responseJson);
  const parsed = parseJsonLoose(outputText);

  return {
    transactionDate: parsed.transactionDate || null,
    vendorName: parsed.vendorName || "",
    vendorAddress: parsed.vendorAddress || parsed.vendor_address || "",
    vendorPhone: parsed.vendorPhone || parsed.vendor_phone || "",
    receiptTimeText: parsed.receiptTimeText || parsed.receipt_time_text || "",
    totalAmount: normalizeInteger(parsed.totalAmount),
    taxAmount: normalizeInteger(parsed.taxAmount),
    taxRate: parsed.taxRate || "",
    taxTreatmentName: parsed.taxTreatmentName || "",
    taxBreakdowns: Array.isArray(parsed.taxBreakdowns) ? parsed.taxBreakdowns : [],
    paymentMethodId: normalizeNullableInteger(parsed.paymentMethodId || parsed.payment_method_id),
    paymentMethodName: parsed.paymentMethodName || parsed.payment_method_name || "",
    accountTitleName: parsed.accountTitleName || parsed.account_title_name || "",
    invoiceNumber: parsed.invoiceNumber || parsed.invoice_number || "",
    invoiceTypeId: normalizeNullableInteger(parsed.invoiceTypeId || parsed.invoice_type_id),
    invoiceTypeName: parsed.invoiceTypeName || parsed.invoice_type_name || "",
    evidenceTypeId: normalizeNullableInteger(parsed.evidenceTypeId || parsed.evidence_type_id),
    evidenceTypeName: parsed.evidenceTypeName || parsed.evidence_type_name || "",
    evidenceMemo: parsed.evidenceMemo || parsed.evidence_memo || "",
    summary: parsed.summary || "",
    memo: parsed.memo || "",
    confidence: normalizeConfidence(parsed.confidence),
    lineItems: normalizeLineItems(parsed.lineItems),
    aiModel: model,
    aiRawJson: {
      ...parsed,
      masterHintsUsed: {
        accountTitleCount: (masterHints.accountTitles || []).length,
        paymentMethodCount: (masterHints.paymentMethods || []).length,
        invoiceTypeCount: (masterHints.invoiceTypes || []).length,
        evidenceTypeCount: (masterHints.evidenceTypes || []).length
      }
    }
  };
};
/* RECEIPT_AI_MASTER_HINTS_END */
module.exports = {
  analyzeReceiptImport,
};
