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

function normalizeReceiptTimeText(value) {
  if (value === null || value === undefined || value === "") return null;

  let s = String(value).trim();
  if (!s) return null;

  s = s.replace("：", ":");

  const match = s.match(/^([0-2]?\d):([0-5]\d)$/);
  if (!match) return s;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return s;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return s;

  return String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0");
}

function extractReceiptTimeTextFromOcr(ocrText) {
  const text = String(ocrText || "")
    .replace(/：/g, ":")
    .replace(/．/g, ".");

  if (!text.trim()) return null;

  const lines = text.split(/\r?\n/);
  const candidates = [];

  function addCandidate(hourValue, minuteValue, line, lineIndex, indexInLine, source) {
    const hour = Number(hourValue);
    const minute = Number(minuteValue);

    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return;
    if (hour < 0 || hour > 23) return;
    if (minute < 0 || minute > 59) return;

    const lineText = String(line || "");
    const compactLine = lineText.replace(/\s+/g, "");

    // 金額・税率・電話番号っぽい行は弱める。ただし除外はしない。
    let score = 100;

    if (/時刻|時間|日時|日付|発行|取引|会計|精算|受付|注文|伝票|レジ|来店|入店|退店|担当|領収/i.test(lineText)) {
      score += 50;
    }

    if (/\d{4}[\/.\-年]\d{1,2}[\/.\-月]\d{1,2}/.test(lineText) || /\d{1,2}[\/.\-月]\d{1,2}/.test(lineText)) {
      score += 25;
    }

    if (/小計|合計|税込|税抜|消費税|対象|単価|金額|現計|預り|お預り|釣|お釣|円|￥|¥/.test(lineText)) {
      score -= 35;
    }

    if (/TEL|電話|FAX/i.test(lineText)) {
      score -= 60;
    }

    // 24時間として自然な範囲を少し優先
    if (hour >= 6 && hour <= 23) {
      score += 10;
    }

    candidates.push({
      value: String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0"),
      score,
      lineIndex,
      indexInLine,
      source,
      line: compactLine
    });
  }

  lines.forEach((line, lineIndex) => {
    const s = String(line || "");

    // 18:03 / 9:05
    let m;
    const colonRegex = /(^|[^\d])([01]?\d|2[0-3])\s*:\s*([0-5]\d)(?!\d)/g;
    while ((m = colonRegex.exec(s)) !== null) {
      addCandidate(m[2], m[3], s, lineIndex, m.index, "colon");
    }

    // 18時03分 / 9時5分 / 18時03
    const jpRegex = /(^|[^\d])([01]?\d|2[0-3])\s*時\s*([0-5]?\d)\s*分?/g;
    while ((m = jpRegex.exec(s)) !== null) {
      addCandidate(m[2], m[3], s, lineIndex, m.index, "jp");
    }

    // 18.03 / 18．03
    // 金額の小数と紛れやすいので、候補には入れるがスコアで後ろに回す。
    const dotRegex = /(^|[^\d])([01]?\d|2[0-3])\s*[.]\s*([0-5]\d)(?!\d)/g;
    while ((m = dotRegex.exec(s)) !== null) {
      addCandidate(m[2], m[3], s, lineIndex, m.index, "dot");
    }
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.lineIndex !== b.lineIndex) return a.lineIndex - b.lineIndex;
    return a.indexInLine - b.indexInLine;
  });

  return candidates[0].value || null;
}

function normalizeLineItems(value) {
  if (!Array.isArray(value)) return [];

  return value.map((line) => ({
    name: String(line.name || line.itemName || ""),
    quantity: normalizeNumber(line.quantity),
    unitPrice: normalizeInteger(line.unitPrice),
    amount: normalizeInteger(line.amount),
    taxRate: String(line.taxRate || ""),
    taxTreatmentName: String(line.taxTreatmentName || line.tax_treatment_name || line.taxTreatment || line.tax_treatment || ""),
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
  const ocrReceiptTimeText = extractReceiptTimeTextFromOcr(ocrText);

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
    "receiptTimeText には、OCR本文に印字されている時刻がある場合だけ HH:mm 形式で入れてください。例: 18:03、9:05、18時03分、18.03 は時刻として認識し、HH:mmへ正規化してください。時刻が印字されていない場合、または読めない場合は null にしてください。推測で補完しないでください。",
    "伝票番号、注文番号、レジ番号、会員番号、承認番号、カード番号は invoiceNumber に入れず、memo に入れてください。",
    "レシート時刻は memo に書かないでください。時刻は receiptTimeText だけに入れてください。",
    "",
    "/* RECEIPT_AI_DINING_MEETING_RULE_START */",
    "",
    "【飲食代・会議費候補ルール】",
    "定食、食事、ランチ、弁当、飲食、レストラン、カフェ、喫茶、ラーメン、カレー、みそかつ、寿司、焼肉、居酒屋などの飲食レシートは、消耗品費にしないでください。",
    "飲食レシートの場合、summary は原則として「飲食代」としてください。これは帳簿上の短い摘要候補であり、但し書きそのものではありません。",
    "飲食レシートで、人数が複数、出張先、打合せ、商談、会議の可能性がある場合、accountTitleName の第一候補は「会議費」としてください。",
    "ただし、レシート本文だけでは会議・打合せ・出張・相手先・割り勘・自社負担額は確定できません。memo に必ず要確認事項を書いてください。",
    "memo には、明細品名を繰り返して長く書く必要はありません。代わりに、目的、出張か、相手先、参加者、参加人数、割り勘か、自社負担額、打合せ内容の確認が必要であることを書いてください。",
    "receiptTimeText が読める場合は、レシート時刻として receiptTimeText に返してください。読めない場合は null にしてください。memo にはレシート時刻を書かないでください。",
    "例: ロース定食2点、2名、18:03 の場合は、summary は「飲食代」、accountTitleName は「会議費」、memo は「飲食代。2名。出張・打合せ目的・相手先・割り勘・自社負担額の確認が必要。」のようにしてください。",
    "一人の通常食事、目的不明の飲食、日当内の食事の可能性がある場合は、会議費で確定せず、memo に確認事項を書いてください。",
    "/* RECEIPT_AI_DINING_MEETING_RULE_END */",
    "【消費税内訳ルール】",
    "taxBreakdowns は、レシート本文に明記されている税率別内訳から作ってください。",
    "例：(10%内税対象 2900)(10%内消費税額 263) のような記載がある場合だけ、課税10%の内訳行を作ってください。",
    "例：(8%内税対象 648)(8%内消費税額 48)(10%内税対象 548)(10%内消費税額 49) のように複数ある場合は、必要な行だけ複数作ってください。",
    "非課税対象、不課税対象、対象外がOCR本文に明記されている場合は、それぞれ taxBreakdowns に行を作り、taxAmount は0にしてください。",
    "合計金額 totalAmount と消費税合計 taxAmount だけから、消費税内訳を勝手に1行生成してはいけません。",
    "税率別内訳がOCR本文から読めない場合、taxBreakdowns は空配列 [] にしてください。",
    "明細行の taxTreatmentName には、OCR本文で明細ごとの税込・内税、税抜・外税、非課税、不課税、対象外、不明が読める場合だけ入れてください。迷う場合は不明または空文字にしてください。",
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
    "  \"receiptTimeText\": null,",
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
    "      \"taxTreatmentName\": \"税込・内税/税抜・外税/非課税/不課税/対象外/不明\",",
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
  const resolvedAccountTitle = resolveReceiptAiAccountTitle(parsed, masterHints);

  return {
    transactionDate: parsed.transactionDate || null,
    vendorName: parsed.vendorName || "",
    vendorAddress: parsed.vendorAddress || parsed.vendor_address || "",
    vendorPhone: parsed.vendorPhone || parsed.vendor_phone || "",
    receiptTimeText: normalizeReceiptTimeText(parsed.receiptTimeText || parsed.receipt_time_text) || ocrReceiptTimeText,
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
    confidence: normalizeReceiptAiConfidenceForDraft(parsed.confidence),
    lineItems: normalizeLineItems(parsed.lineItems),
    aiModel: model,
    aiRawJson: parsed
  };
}

/* RECEIPT_AI_MASTER_HINTS_START */
/*
  レシートAIへマスタ候補を渡す。
  画像は渡さず、OCR本文だけを解析する方針は維持する。

  2026-07-04 修正:
  - 目的マスタもAIへ渡す。
  - AIに purposeId / purposeName を返させる。
  - レシート時刻は receiptTimeText に返させ、memoへ混ぜない。
  - 飲食・会議費っぽい場合でも、目的は画面側の推測ではなくAIが目的マスタ候補から選ぶ。
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
    purposesResult,
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
      LIMIT 40
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
        purpose_id,
        purpose_name
      FROM expenses.purposes
      WHERE is_active = TRUE
      ORDER BY sort_order, purpose_id
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
    purposes: purposesResult.rows,
    invoiceTypes: invoiceTypesResult.rows,
    evidenceTypes: evidenceTypesResult.rows
  };
}

function formatReceiptAiMasterHints(masters) {
  const lines = [];

  lines.push("【マスタ候補】");
  lines.push("次の候補から選べる場合は、IDと名称をそのまま返してください。");
  lines.push("完全に判断不能な場合を除き、候補から一番近いものを1つ選び、IDと名称をそのまま返してください。");
  lines.push("");

  lines.push("【勘定科目候補 最大40件】");
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
  lines.push("【目的候補】");
  for (const item of masters.purposes || []) {
    lines.push(receiptAiMasterLine(item.purpose_id, item.purpose_name, ""));
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


function normalizeReceiptAiMasterName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[‐-‒–—―ー－]/g, "-");
}

function resolveReceiptAiAccountTitle(parsed, masterHints) {
  const accountTitles = masterHints && Array.isArray(masterHints.accountTitles)
    ? masterHints.accountTitles
    : [];

  const rawId = parsed.accountTitleId ?? parsed.account_title_id ?? parsed.accountId ?? parsed.account_id ?? null;
  const idNum = normalizeNullableInteger(rawId);

  if (idNum !== null) {
    const byId = accountTitles.find((row) => Number(row.account_title_id) === Number(idNum));
    if (byId) {
      return {
        id: Number(byId.account_title_id),
        name: String(byId.account_name || "").trim()
      };
    }
  }

  const rawName = String(parsed.accountTitleName || parsed.account_title_name || "").trim();

  if (rawName) {
    const exact = accountTitles.find((row) => String(row.account_name || "").trim() === rawName);
    if (exact) {
      return {
        id: Number(exact.account_title_id),
        name: String(exact.account_name || "").trim()
      };
    }

    const key = normalizeReceiptAiMasterName(rawName);
    const loose = accountTitles.find((row) => normalizeReceiptAiMasterName(row.account_name) === key);
    if (loose) {
      return {
        id: Number(loose.account_title_id),
        name: String(loose.account_name || "").trim()
      };
    }
  }

  return {
    id: null,
    name: rawName
  };
}

function normalizeReceiptAiConfidenceForDraft(value) {
  const n = normalizeConfidence(value);

  if (n === null || n <= 0) {
    return 0.5;
  }

  return n;
}
analyzeReceiptImport = async function analyzeReceiptImportWithMasterHints(receiptImport) {
  const env = readDotEnv();

  const apiKey = env.OPENAI_API_KEY;
  const model = env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing in .env");
  }

  const ocrText = String(receiptImport.ocr_raw_text || "").trim();
  const ocrReceiptTimeText = extractReceiptTimeTextFromOcr(ocrText);

  if (!ocrText) {
    throw new Error("OCR text is empty. Image AI is disabled. Import OCR text first.");
  }

  const masterHints = await getReceiptAiMasterHints();
  const masterText = formatReceiptAiMasterHints(masterHints);

  const instruction = [
    "あなたは日本のレシートOCRテキスト解析AIです。",
    "画像は見ません。与えられたOCR本文だけから判断してください。",
    "目的は会計確定ではなく、人間が画像を見ながら修正するための読取候補作成です。",
    "店名、日付、時刻、合計、税額、消費税内訳、税率、税処理、支払方法、目的、インボイス番号、インボイス区分、証憑区分、勘定科目候補、明細行をJSONだけで返してください。",
    "推測できない項目は null または空文字にしてください。",
    "支払方法、目的、インボイス区分、証憑区分は、候補一覧から選べる場合だけIDを返してください。",
    "勘定科目は会計確定ではなく、画面で人間が確認・修正するための候補です。",
    "勘定科目は、完全に判断不能な場合を除き、必ず【勘定科目候補】の中から一番近いものを1つ選んでください。",
    "accountTitleId には選んだ勘定科目候補のIDを数値で返してください。",
    "accountTitleName には選んだ勘定科目候補の名称を、候補一覧の表記と一字一句同じ文字で返してください。",
    "自分で新しい勘定科目名を作らないでください。候補一覧にない名称へ言い換えないでください。",
    "飲食店・喫茶店・レストラン・弁当・会食らしい場合は、候補内に会議費があれば会議費を優先候補にしてください。ただし接待・贈答・福利厚生が明確ならそちらを優先してください。",
    "文具・事務用品・日用品・ホームセンター・消耗する備品らしい場合は、候補内に消耗品費があれば優先してください。",
    "電車・バス・タクシー・駐車場・高速道路らしい場合は、候補内に旅費交通費または交通費があれば優先してください。",
    "郵便・宅配・送料らしい場合は、候補内に通信費または荷造運賃があれば優先してください。",
    "判断に迷う場合でも、OCR本文全体から最も近い候補を選び、memoに迷った理由を短く書いてください。",
    "目的は目的候補一覧から近いものを控えめに選び、迷う場合は purposeId を null、purposeName を空文字にしてください。",
    "【目的候補の判断ルール】",
    "会社所在地は大阪府です。",
    "大阪府内の店舗・住所・地域名がOCR本文から読み取れる場合は、目的候補として「出張」「出張先会議」「出張先打合せ」を選ばないでください。",
    "大阪府外の店舗・住所・地域名がOCR本文から明確に読み取れる場合のみ、目的候補として「出張」「出張先会議」「出張先打合せ」を検討してください。",
    "ただし、大阪府外であっても、飲食代だけで自動的に「出張先打合せ」と決めないでください。",
    "店名・住所・地域名・摘要・明細・支払内容から、会議・打合せ・訪問・宿泊・交通などの文脈がある場合に限り、出張関連の目的候補を優先してください。",
    "大阪府内の飲食代は、「出張先打合せ」ではなく、候補一覧にある場合は「打合せ」「会議」「社内会議」「取引先訪問」「営業活動」などを優先してください。",
    "大阪府外の飲食代で、会議・打合せ・訪問の文脈がある場合は、候補一覧にある「出張先打合せ」または「出張先会議」を優先してください。",
    "大阪府外の交通費・宿泊費・高速道路・駐車場・新幹線・電車・バス・タクシーの場合は、候補一覧にある「出張」または出張関連目的を優先してください。",
    "目的は確定ではなく、人間が確認・修正するための候補です。",
    "ただし、完全に判断不能な場合を除き、目的候補一覧から一番近い目的を1つ選び、purposeId と purposeName を返してください。",
    "purposeName は候補一覧の名称を一字一句そのまま返してください。",
    "confidence は 0 にしないでください。通常は 0.40〜0.95 の小数で返してください。",
    "店名・日付・金額がある程度読める場合は 0.60 以上を目安にしてください。",
    "かなり読みにくい場合でも 0.10〜0.30 を返してください。",
    "インボイス番号は T + 13桁 の登録番号だけを入れてください。",
    "",
    "【店舗情報ルール】",
    "vendorName には、レシートに印字されている店名・支払先名を入れてください。",
    "vendorAddress には、レシートに印字されている住所を入れてください。読めない場合は空文字にしてください。",
    "vendorPhone には、レシートに印字されている電話番号を入れてください。読めない場合は空文字にしてください。",
    "receiptTimeText には、OCR本文に印字されている時刻がある場合だけ HH:mm 形式で入れてください。例: 18:03、9:05、18時03分、18.03 は時刻として認識し、HH:mmへ正規化してください。時刻が印字されていない場合、または読めない場合は null にしてください。推測で補完しないでください。",
    "receiptTimeText に入れた時刻は、memo に書かないでください。時刻は receiptTimeText だけに入れてください。",
    "伝票番号、注文番号、レジ番号、会員番号、承認番号、カード番号は invoiceNumber に入れず、memo に入れてください。",
    "レシート時刻は memo に書かないでください。時刻は receiptTimeText だけに入れてください。",
    "",
    "【目的判定ルール】",
    "飲食、定食、弁当、ランチ、レストラン、カフェ、喫茶、ラーメン、カレー、寿司、焼肉、居酒屋などの飲食レシートは、目的候補から会議・打合せ・商談・接待など近いものを選べるか検討してください。",
    "ただし、レシート本文だけで目的が確定できない場合は無理に選ばず、purposeId は null にしてください。",
    "人数が複数、出張先、打合せ、商談、会議の可能性がある場合は、目的候補に「会議」があれば優先候補にしてください。",
    "通常の一人食事や目的不明の飲食の場合は、memo に確認事項を書き、purposeId は null でもかまいません。",
    "",
    "【飲食代・会議費候補ルール】",
    "飲食レシートの場合、summary は原則として「飲食代」としてください。",
    "飲食レシートで、人数が複数、出張先、打合せ、商談、会議の可能性がある場合、accountTitleName の第一候補は「会議費」としてください。",
    "ただし、会議費は確定ではありません。memo に、目的、出張か、相手先、参加者、参加人数、割り勘か、自社負担額、打合せ内容の確認が必要であることを書いてください。",
    "memo にはレシート時刻を書かないでください。時刻は receiptTimeText だけに入れてください。",
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
    "明細行の taxTreatmentName には、OCR本文で明細ごとの税込・内税、税抜・外税、非課税、不課税、対象外、不明が読める場合だけ入れてください。迷う場合は不明または空文字にしてください。",
    "taxCategoryName は必ず 課税10% / 軽減8% / 非課税 / 不課税 / 対象外 のいずれかに寄せてください。",
    "",
    "【明細強化ルール】",
    "明細行は最重要です。OCR本文から読める商品名・料理名・サービス名・品名は必ず lineItems に入れてください。",
    "summary に品名を書く場合、その品名は必ず lineItems にも入れてください。",
    "数量、単価、金額がOCR本文から読める場合は必ず入れてください。",
    "合計金額・税額・小計・クレジット計・預り金・釣銭だけを明細として扱わないでください。",
    "読める品名が1つでもある場合、lineItems を空配列にしてはいけません。",
    "",
    "返すJSON形式:",
    "{",
    "  \"transactionDate\": \"YYYY-MM-DD または null\",",
    "  \"vendorName\": \"店名\",",
    "  \"vendorAddress\": \"住所または空文字\",",
    "  \"vendorPhone\": \"電話番号または空文字\",",
    "  \"receiptTimeText\": null,",
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
    "  \"purposeId\": null,",
    "  \"purposeName\": \"目的候補名または空文字\",",
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
    "      \"taxTreatmentName\": \"税込・内税/税抜・外税/非課税/不課税/対象外/不明\",",
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
    max_output_tokens: 2600,
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
  const resolvedAccountTitle = resolveReceiptAiAccountTitle(parsed, masterHints);

  return {
    transactionDate: parsed.transactionDate || null,
    vendorName: parsed.vendorName || "",
    vendorAddress: parsed.vendorAddress || parsed.vendor_address || "",
    vendorPhone: parsed.vendorPhone || parsed.vendor_phone || "",
    receiptTimeText: normalizeReceiptTimeText(parsed.receiptTimeText || parsed.receipt_time_text) || ocrReceiptTimeText,
    totalAmount: normalizeInteger(parsed.totalAmount),
    taxAmount: normalizeInteger(parsed.taxAmount),
    taxRate: parsed.taxRate || "",
    taxTreatmentName: parsed.taxTreatmentName || "",
    taxBreakdowns: Array.isArray(parsed.taxBreakdowns) ? parsed.taxBreakdowns : [],
    paymentMethodId: normalizeNullableInteger(parsed.paymentMethodId || parsed.payment_method_id),
    paymentMethodName: parsed.paymentMethodName || parsed.payment_method_name || "",
    purposeId: normalizeNullableInteger(parsed.purposeId || parsed.purpose_id),
    purposeName: parsed.purposeName || parsed.purpose_name || "",
    accountTitleId: resolvedAccountTitle.id,
    accountTitleName: resolvedAccountTitle.name || parsed.accountTitleName || parsed.account_title_name || "",
    invoiceNumber: parsed.invoiceNumber || parsed.invoice_number || "",
    invoiceTypeId: normalizeNullableInteger(parsed.invoiceTypeId || parsed.invoice_type_id),
    invoiceTypeName: parsed.invoiceTypeName || parsed.invoice_type_name || "",
    evidenceTypeId: normalizeNullableInteger(parsed.evidenceTypeId || parsed.evidence_type_id),
    evidenceTypeName: parsed.evidenceTypeName || parsed.evidence_type_name || "",
    evidenceMemo: parsed.evidenceMemo || parsed.evidence_memo || "",
    summary: parsed.summary || "",
    memo: parsed.memo || "",
    confidence: normalizeReceiptAiConfidenceForDraft(parsed.confidence),
    lineItems: normalizeLineItems(parsed.lineItems),
    aiModel: model,
    aiRawJson: {
      ...parsed,
      masterHintsUsed: {
        accountTitleCount: (masterHints.accountTitles || []).length,
        resolvedAccountTitleId: resolvedAccountTitle.id,
        resolvedAccountTitleName: resolvedAccountTitle.name,
        paymentMethodCount: (masterHints.paymentMethods || []).length,
        purposeCount: (masterHints.purposes || []).length,
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










