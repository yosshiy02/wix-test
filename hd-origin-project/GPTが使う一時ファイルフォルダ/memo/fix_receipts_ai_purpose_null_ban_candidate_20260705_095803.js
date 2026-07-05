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

function removeRejectedPurposeFallback(source) {
  [
    "normalizeReceiptAiPurposeText",
    "findReceiptAiPurposeByNames",
    "receiptAiTextHasOsaka",
    "receiptAiTextHasOutsideOsaka",
    "resolveReceiptAiPurposeFallback"
  ].forEach((name) => {
    source = removeFunctionByName(source, name);
  });

  const lines = source.split(/\r?\n/);
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes("const resolvedPurposeFallback = resolveReceiptAiPurposeFallback(parsed, masterHints, ocrText);")) {
      i++;

      let seenIf = false;
      let depth = 0;

      for (; i < lines.length; i++) {
        const current = lines[i];

        if (current.includes("if (")) seenIf = true;

        for (const ch of current) {
          if (ch === "{") depth++;
          if (ch === "}") depth--;
        }

        if (seenIf && depth <= 0 && current.trim() === "}") {
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

text = removeRejectedPurposeFallback(text);

const promptBlock = [
  '    "【目的候補 purposeId / purposeName / purposeTempName のルール】",',
  '    "目的はAIが判断して返してください。コード側では目的を補完しません。",',
  '    "purposeId と purposeName は原則NULL禁止・空文字禁止です。",',
  '    "完全一致する目的がなくても、目的候補一覧から最も近いものを必ず1つ選んでください。",',
  '    "purposeId には選んだ目的候補のIDを数値で返してください。",',
  '    "purposeName には選んだ目的候補の名称を、目的候補一覧の表記と一字一句同じ文字で返してください。",',
  '    "purposeIdだけ、purposeNameだけ、null、空文字は禁止です。必ずIDと名称をセットで返してください。",',
  '    "既存の目的候補にぴったり合うものがない場合は、候補一覧にある「その他業務」「その他」「対象外」「不明」など最も近い逃げ先を選んでください。",',
  '    "そのうえで、AIがより適切だと考える新しい目的名を purposeTempName と purposeCandidateName に書いてください。",',
  '    "purposeTempName / purposeCandidateName はマスタ追加候補です。既存マスタを勝手に追加した扱いではありません。",',
  '    "既存マスタで十分に表現できる場合は、purposeTempName と purposeCandidateName は purposeName と同じでも、より具体的な候補名でも構いません。",',
  '    "会社所在地は大阪府です。大阪府内の店舗・住所・地域名がOCR本文から読み取れる場合は、「出張」「出張先会議」「出張先打合せ」を選ばないでください。",',
  '    "大阪府外の店舗・住所・地域名がOCR本文から明確に読み取れる場合は、通常の「会議」よりも「出張先打合せ」「出張先会議」「出張」などを優先して検討してください。",',
  '    "名古屋・東京・神戸・京都・奈良・和歌山など大阪府外の地名は、大阪府内扱いにしないでください。",',
  '    "大阪府外 + 飲食 + 会議費 または 打合せ/商談/会議の文脈がある場合は、目的候補に存在するなら「出張先打合せ」または「出張先会議」を通常の「会議」より優先してください。",',
  '    "大阪府内 + 飲食 + 会議費の場合は、「会議」「打合せ」「社内会議」「社内打合せ」「商談」などを優先してください。",',
  '    "交通・電車・バス・タクシー・高速道路・駐車場・宿泊・ホテルの場合は、目的候補から「出張」「交通・移動」「宿泊」「取引先訪問」など最も近いものを選んでください。",'
].join("\n");

// すべての instruction 配列へ、まだ入っていなければ追加
if (!text.includes("【目的候補 purposeId / purposeName / purposeTempName のルール】")) {
  text = text.replace(/const instruction = \[\r?\n/g, (m) => m + promptBlock + "\n");
}

// 既存の弱い目的指示を置換
text = text.replace(
  '    "目的は目的候補一覧から近いものを控えめに選び、迷う場合は purposeId を null、purposeName を空文字にしてください。",',
  [
    '    "目的は目的候補一覧から最も近いものを必ず1つ選び、purposeId と purposeName を返してください。",',
    '    "目的では null と空文字を原則禁止します。既存候補に完全一致がない場合は、その他業務などの逃げ先を選び、purposeTempName にAIが考えた新目的候補を書いてください。",',
    '    "purposeName は目的候補一覧の名称を一字一句そのまま返してください。"'
  ].join("\n")
);

// 候補説明の「nullでよい」寄り文言を強める
text = text.replace(
  'lines.push("候補から判断できない場合は、IDは null、名称は空文字または控えめな候補にしてください。");',
  'lines.push("候補から完全一致できない場合でも、最も近い候補のIDと名称を必ず返してください。候補にない具体案は TempName / CandidateName に書いてください。");'
);

// JSON例を強める
text = text.replace(
  /"  \\"purposeId\\": null,",/g,
  '"  \\"purposeId\\": 0,",'
);

text = text.replace(
  /"  \\"purposeName\\": \\"[^"]*\\"",/g,
  '"  \\"purposeName\\": \\"目的候補一覧から選んだ名称。NULL禁止・空文字禁止\\"",'
);

// purposeName の直後に purposeTempName / purposeCandidateName 例を追加
if (!text.includes('\\"purposeTempName\\"')) {
  text = text.replace(
    /("  \\"purposeName\\": \\"目的候補一覧から選んだ名称。NULL禁止・空文字禁止\\"",)/,
    '$1\n    "  \\"purposeTempName\\": \\"AIが考えた新目的候補。例: 名古屋出張先打合せ\\",",\n    "  \\"purposeCandidateName\\": \\"AIが考えた新目的候補。例: 名古屋出張先打合せ\\",",'
  );
}

// confidence 0 は真似されやすいので直す
text = text.replace(
  /"  \\"confidence\\": 0,",/g,
  '"  \\"confidence\\": 0.70,",'
);

// return に purposeTempName / purposeCandidateName を追加
if (!text.includes("purposeTempName: parsed.purposeTempName")) {
  text = text.replace(
    '    purposeName: parsed.purposeName || parsed.purpose_name || "",',
    [
      '    purposeName: parsed.purposeName || parsed.purpose_name || "",',
      '    purposeTempName: parsed.purposeTempName || parsed.purpose_temp_name || parsed.purposeCandidateName || parsed.purpose_candidate_name || "",',
      '    purposeCandidateName: parsed.purposeCandidateName || parsed.purpose_candidate_name || parsed.purposeTempName || parsed.purpose_temp_name || "",'
    ].join("\n")
  );
}

// aiRawJson は parsed を含むため、purposeCandidateNameも残る。
// parsedがスプレッドされる版でも、生parsed版でもそのまま残る。

if (text === original) {
  throw new Error("変更が入りませんでした。既に反映済み、または想定外の形です。");
}

fs.writeFileSync(after, text, "utf8");
