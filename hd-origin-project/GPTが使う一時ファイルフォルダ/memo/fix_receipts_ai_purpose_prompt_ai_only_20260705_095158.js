const fs = require("fs");

const target = process.argv[2];
const after = process.argv[3];

let text = fs.readFileSync(target, "utf8");
const original = text;

function removeFunctionByName(source, name) {
  const marker = "function " + name + "(";
  let index = source.indexOf(marker);

  while (index >= 0) {
    const braceStart = source.indexOf("{", index);
    if (braceStart < 0) break;

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

    if (end < 0) break;

    let removeStart = index;
    while (removeStart > 0 && /\s/.test(source[removeStart - 1])) {
      removeStart--;
    }

    let removeEnd = end;
    while (removeEnd < source.length && /[\r\n]/.test(source[removeEnd])) {
      removeEnd++;
    }

    source = source.slice(0, removeStart) + source.slice(removeEnd);
    index = source.indexOf(marker);
  }

  return source;
}

function removePurposeFallbackRuntime(source) {
  const lines = source.split(/\r?\n/);
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes("const resolvedPurposeFallback = resolveReceiptAiPurposeFallback(parsed, masterHints, ocrText);")) {
      let depth = 0;
      let startedIf = false;

      // skip const line
      i++;

      for (; i < lines.length; i++) {
        const current = lines[i];

        if (current.includes("if (")) startedIf = true;

        for (const ch of current) {
          if (ch === "{") depth++;
          if (ch === "}") depth--;
        }

        if (startedIf && depth <= 0 && current.trim() === "}") {
          break;
        }
      }

      continue;
    }

    if (
      line.includes("purposeFallbackId:") ||
      line.includes("purposeFallbackName:")
    ) {
      continue;
    }

    out.push(line);
  }

  return out.join("\n");
}

// 前回の「コード側で目的を補完する」系が入っていた場合は外す。
// 今回はAIプロンプトだけでやる。
[
  "normalizeReceiptAiPurposeText",
  "findReceiptAiPurposeByNames",
  "receiptAiTextHasOsaka",
  "receiptAiTextHasOutsideOsaka",
  "resolveReceiptAiPurposeFallback"
].forEach((name) => {
  text = removeFunctionByName(text, name);
});

text = removePurposeFallbackRuntime(text);

// マスタ候補の共通説明を強める。
// ここが弱いと、AIが目的だけ空に逃げやすい。
text = text.replace(
  'lines.push("候補から判断できない場合は、IDは null、名称は空文字または控えめな候補にしてください。");',
  'lines.push("目的・勘定科目・支払方法などは、人間が確認・修正するための候補です。完全に判断不能な場合を除き、最も近い候補のIDと名称を返してください。");'
);

// instruction配列すべてに、AI向けの目的ルールを追加。
// 旧 analyzeReceiptImport と masterHints版の両方に効かせる。
const purposePromptBlock = [
  '    "【目的候補 purposeId / purposeName の必須ルール】",',
  '    "目的はコード側で補完しません。あなたがOCR本文全体と目的候補一覧から選んでください。",',
  '    "目的は会計確定ではなく、人間が画面で確認・修正するための候補です。完全に判断不能な場合以外は空にしないでください。",',
  '    "purposeId は目的候補一覧にあるIDを数値で返してください。",',
  '    "purposeName は目的候補一覧の名称を一字一句そのまま返してください。",',
  '    "purposeId を返す場合は、purposeName も必ず返してください。IDだけ、名称だけ、空文字は禁止です。",',
  '    "レシート単体で厳密な目的が分からない場合でも、OCR本文・店名・住所・明細・摘要・勘定科目候補から最も近い一般的な目的を1つ選んでください。",',
  '    "会社所在地は大阪府です。大阪府内の店舗・住所・地域名がOCR本文から読み取れる場合は、「出張」「出張先会議」「出張先打合せ」を選ばないでください。",',
  '    "大阪府外の店舗・住所・地域名がOCR本文から明確に読み取れる場合のみ、「出張」「出張先会議」「出張先打合せ」を検討してください。",',
  '    "大阪府外であっても、飲食代だけで自動的に出張先打合せとは決めないでください。会議・打合せ・訪問・交通・宿泊などの文脈がある場合だけ出張関連を優先してください。",',
  '    "飲食店・喫茶店・レストラン・弁当などで、勘定科目候補が会議費になる場合は、目的候補から「会議」「打合せ」「商談」「社内会議」「社内打合せ」など最も近いものを選んでください。",',
  '    "交通・電車・バス・タクシー・高速道路・駐車場・宿泊・ホテルの場合は、目的候補から「出張」「交通・移動」「宿泊」「取引先訪問」など最も近いものを選んでください。",',
  '    "目的候補一覧に存在しない名称を自作しないでください。必ず候補一覧の表記をそのまま使ってください。",'
].join("\n");

if (!text.includes("【目的候補 purposeId / purposeName の必須ルール】")) {
  text = text.replace(/const instruction = \[\r?\n/g, (m) => m + purposePromptBlock + "\n");
}

// 既存の弱い目的指示が残っていれば、強い指示へ置換。
text = text.replace(
  '    "目的は目的候補一覧から近いものを控えめに選び、迷う場合は purposeId を null、purposeName を空文字にしてください。",',
  [
    '    "目的は目的候補一覧から最も近いものを1つ選び、完全に判断不能な場合を除き purposeId と purposeName を返してください。",',
    '    "purposeName は目的候補一覧の名称を一字一句そのまま返してください。",',
    '    "迷う場合でも、空にせず最も近い一般的な目的候補を選んでください。"'
  ].join("\n")
);

// JSON例の purposeName が「空文字でよい」に見える場合は修正。
text = text.replace(
  /"  \\"purposeName\\": \\"[^"]*\\"",/g,
  '"  \\"purposeName\\": \\"目的候補一覧の名称を一字一句そのまま。purposeIdを返す場合は必須\\"",'
);

// JSON例の confidence が 0 の場合、AIが真似しやすいので修正。
text = text.replace(
  /"  \\"confidence\\": 0,",/g,
  '"  \\"confidence\\": 0.70,",'
);

// 念のため、purposeId / purposeName の出力口は触らない。
// ここはAI返却をそのまま受ける。
if (!text.includes("purposeId: normalizeNullableInteger(parsed.purposeId || parsed.purpose_id)")) {
  // 既に別修正で形が変わっている可能性はあるので、ここでは止めない。
}

if (text === original) {
  throw new Error("変更が入りませんでした。既に反映済み、または想定外の形です。");
}

fs.writeFileSync(after, text, "utf8");
