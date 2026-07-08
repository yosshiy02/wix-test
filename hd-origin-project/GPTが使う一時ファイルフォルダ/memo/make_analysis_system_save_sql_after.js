const fs = require("fs");
const path = require("path");
const cp = require("child_process");

const projectRoot = process.cwd();

if (projectRoot.includes("GPT2が使う一時ファイルフォルダ")) {
  throw new Error("GPT2側なので中止します。");
}

const rel = path.join("web_receiver", "src", "paymentDocuments", "paymentDocuments.routes.js");
const routesPath = path.join(projectRoot, rel);
const workRoot = path.join(projectRoot, "GPTが使う一時ファイルフォルダ");
const stamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);

const beforeRoutes = path.join(workRoot, "before", rel + `.before_analysis_system_save_sql_node_${stamp}`);
const afterRoutes = path.join(workRoot, "after", rel);
const memoPath = path.join(workRoot, "memo", `routes_analysis_system保存SQL_Node作成結果_${stamp}.txt`);

fs.mkdirSync(path.dirname(beforeRoutes), { recursive: true });
fs.mkdirSync(path.dirname(afterRoutes), { recursive: true });
fs.mkdirSync(path.dirname(memoPath), { recursive: true });

fs.copyFileSync(routesPath, beforeRoutes);
fs.copyFileSync(routesPath, afterRoutes);

let lines = fs.readFileSync(afterRoutes, "utf8").split(/\r?\n/);
const changes = [];

function findLine(re, from = 0, to = lines.length - 1) {
  for (let i = from; i <= to; i++) {
    if (re.test(lines[i])) return i;
  }
  return -1;
}

function insertAfterOnce(matchRe, insertLines, alreadyRe, from = 0, to = lines.length - 1, label = "") {
  for (let i = from; i <= to; i++) {
    if (matchRe.test(lines[i])) {
      let already = false;
      for (let j = i + 1; j <= Math.min(lines.length - 1, i + 20); j++) {
        if (alreadyRe.test(lines[j])) {
          already = true;
          break;
        }
      }

      if (!already) {
        lines.splice(i + 1, 0, ...insertLines);
        return 1;
      }

      return 0;
    }
  }
  throw new Error("挿入位置が見つかりません: " + label);
}

// payload
const payloadStart = findLine(/function hdOriginBuildSortingDraftSavePayload/);
if (payloadStart < 0) throw new Error("payload作成関数が見つかりません。");

const payloadEnd = findLine(/^\s*\};\s*$/, payloadStart);
if (payloadEnd < 0) throw new Error("payload作成関数のreturn終了が見つかりません。");

changes.push("payload fields inserted: " + insertAfterOnce(
  /^\s*specialist_route_label:\s*hdOriginSortingDraftText/,
  [
    "",
    "    analysis_system_code: hdOriginSortingDraftText(body.analysisSystemCode || body.analysis_system_code || draft.analysis_system_code || root.analysis_system_code || aiSummary.analysis_system_code),",
    "    analysis_system_label: hdOriginSortingDraftText(body.analysisSystemLabel || body.analysis_system_label || draft.analysis_system_label || root.analysis_system_label || aiSummary.analysis_system_label || aiSummary.analysis_system),",
    "    analysis_system_reason: hdOriginSortingDraftText(body.analysisSystemReason || body.analysis_system_reason || draft.analysis_system_reason || root.analysis_system_reason || aiSummary.analysis_system_reason),",
    "    analysis_system_confidence: hdOriginSortingDraftText(body.analysisSystemConfidence || body.analysis_system_confidence || draft.analysis_system_confidence || root.analysis_system_confidence || aiSummary.analysis_system_confidence),"
  ],
  /analysis_system_code:/,
  payloadStart,
  payloadEnd,
  "payload analysis_system_*"
));

// previous update updated_by $42 -> $48
let updatedChanged = 0;
for (let i = 0; i < lines.length; i++) {
  if (/^\s*updated_by\s*=\s*\$42\s*$/.test(lines[i])) {
    lines[i] = lines[i].replace("$42", "$48");
    updatedChanged = 1;
    break;
  }
}
changes.push("previous updated_by parameter changed: " + updatedChanged);

// INSERT columns
const insertStart = findLine(/INSERT INTO accounting\.payment_document_sorting_drafts/);
if (insertStart < 0) throw new Error("INSERT開始が見つかりません。");

const valuesStart = findLine(/\)\s*VALUES\s*\(/, insertStart);
if (valuesStart < 0) throw new Error("VALUES開始が見つかりません。");

changes.push("insert columns inserted: " + insertAfterOnce(
  /^\s*specialist_route_label,\s*$/,
  [
    "",
    "        analysis_system_code,",
    "        analysis_system_label,",
    "        analysis_system_reason,",
    "        analysis_system_confidence,"
  ],
  /analysis_system_code,/,
  insertStart,
  valuesStart,
  "INSERT analysis_system columns"
));

// VALUES block
let valuesLine = -1;
for (let i = valuesStart; i < Math.min(lines.length, valuesStart + 50); i++) {
  if (lines[i].includes("$17,$18")) {
    valuesLine = i;
    break;
  }
}

if (valuesLine < 0) throw new Error("VALUES $17,$18 の行が見つかりません。");

lines.splice(valuesLine, 6,
  "        $17,$18,",
  "        $19,$20,$21,$22,",
  "        $23,$24,$25,$26,$27,$28,",
  "        $29,$30,$31,$32,$33,",
  "        $34::jsonb,$35::jsonb,$36::jsonb,$37::jsonb,$38::jsonb,",
  "        $39,$40,$41,$42,$43,",
  "        $44,$45,$46,$47,$48"
);
changes.push("VALUES parameter block changed to 48 params");

// params
const paramsStart = findLine(/^\s*payload\.payment_document_ocr_import_id,\s*$/, valuesStart);
if (paramsStart < 0) throw new Error("params配列開始が見つかりません。");

const paramsEnd = findLine(/^\s*\]\);\s*$/, paramsStart);
if (paramsEnd < 0) throw new Error("params配列終了が見つかりません。");

changes.push("params inserted: " + insertAfterOnce(
  /^\s*payload\.specialist_route_label,\s*$/,
  [
    "",
    "    payload.analysis_system_code,",
    "    payload.analysis_system_label,",
    "    payload.analysis_system_reason,",
    "    payload.analysis_system_confidence,"
  ],
  /payload\.analysis_system_code/,
  paramsStart,
  paramsEnd,
  "params analysis_system_*"
));

// list SELECT
const listSelectStart = findLine(/d\.specialist_route_code AS current_specialist_route_code/);
if (listSelectStart >= 0) {
  changes.push("list select aliases inserted: " + insertAfterOnce(
    /^\s*d\.specialist_route_label AS current_specialist_route_label,\s*$/,
    [
      "      d.analysis_system_code AS current_analysis_system_code,",
      "      d.analysis_system_label AS current_analysis_system_label,",
      "      d.analysis_system_reason AS current_analysis_system_reason,",
      "      d.analysis_system_confidence AS current_analysis_system_confidence,"
    ],
    /current_analysis_system_code/,
    Math.max(0, listSelectStart - 20),
    Math.min(lines.length - 1, listSelectStart + 30),
    "list select aliases"
  ));
} else {
  changes.push("list select aliases skipped");
}

// list return
const listReturnStart = findLine(/specialistRouteCode:\s*row\.current_specialist_route_code/);
if (listReturnStart >= 0) {
  changes.push("list return fields inserted: " + insertAfterOnce(
    /^\s*specialistRouteLabel:\s*row\.current_specialist_route_label,\s*$/,
    [
      "          analysisSystemCode: row.current_analysis_system_code,",
      "          analysisSystemLabel: row.current_analysis_system_label,",
      "          analysisSystemReason: row.current_analysis_system_reason,",
      "          analysisSystemConfidence: row.current_analysis_system_confidence,"
    ],
    /analysisSystemCode:/,
    Math.max(0, listReturnStart - 10),
    Math.min(lines.length - 1, listReturnStart + 30),
    "list return fields"
  ));
} else {
  changes.push("list return fields skipped");
}

// single SELECT
const singleStart = findLine(/async function hdOriginGetPaymentDocumentSortingDraftByOcrImportId/);
if (singleStart < 0) throw new Error("単票読込関数が見つかりません。");

const singleFrom = findLine(/FROM accounting\.payment_document_sorting_drafts d/, singleStart);
if (singleFrom < 0) throw new Error("単票読込SELECTのFROMが見つかりません。");

changes.push("single select columns inserted: " + insertAfterOnce(
  /^\s*d\.specialist_route_label,\s*$/,
  [
    "      d.analysis_system_code,",
    "      d.analysis_system_label,",
    "      d.analysis_system_reason,",
    "      d.analysis_system_confidence,"
  ],
  /d\.analysis_system_code/,
  singleStart,
  singleFrom,
  "single select columns"
));

// single return
const singleReturnStart = findLine(/specialistRouteCode:\s*row\.specialist_route_code/, singleFrom);
if (singleReturnStart < 0) throw new Error("単票return specialistRouteCode が見つかりません。");

changes.push("single return fields inserted: " + insertAfterOnce(
  /^\s*specialistRouteLabel:\s*row\.specialist_route_label,\s*$/,
  [
    "    analysisSystemCode: row.analysis_system_code,",
    "    analysisSystemLabel: row.analysis_system_label,",
    "    analysisSystemReason: row.analysis_system_reason,",
    "    analysisSystemConfidence: row.analysis_system_confidence,"
  ],
  /analysisSystemCode:/,
  singleReturnStart,
  Math.min(lines.length - 1, singleReturnStart + 40),
  "single return fields"
));

fs.writeFileSync(afterRoutes, lines.join("\r\n"), "utf8");

const check = cp.spawnSync(process.execPath, ["--check", afterRoutes], { encoding: "utf8" });
const exitCode = check.status ?? 0;

const afterLines = fs.readFileSync(afterRoutes, "utf8").split(/\r?\n/);

function snippetAround(re, before = 5, after = 20) {
  const idx = afterLines.findIndex(line => re.test(line));
  if (idx < 0) return ["見つかりません"];
  const out = [];
  for (let i = Math.max(0, idx - before); i <= Math.min(afterLines.length - 1, idx + after); i++) {
    out.push(`L${i + 1}: ${afterLines[i]}`);
  }
  return out;
}

const memo = [];
memo.push("==============================");
memo.push("routes analysis_system_* 保存SQL Node after作成結果");
memo.push("==============================");
memo.push("日時: " + new Date().toLocaleString("ja-JP"));
memo.push("");
memo.push("[本体対象]");
memo.push(routesPath);
memo.push("");
memo.push("[before]");
memo.push(beforeRoutes);
memo.push("");
memo.push("[after]");
memo.push(afterRoutes);
memo.push("");
memo.push("[変更]");
memo.push(...changes);
memo.push("");
memo.push("[Node --check after]");
memo.push("ExitCode: " + exitCode);
memo.push((check.stdout || "") + (check.stderr || ""));
memo.push("");
memo.push("[INSERT / VALUES 抜粋]");
memo.push(...snippetAround(/INSERT INTO accounting\.payment_document_sorting_drafts/, 0, 80));
memo.push("");
memo.push("[params 抜粋]");
memo.push(...snippetAround(/payload\.specialist_route_code/, 5, 35));
memo.push("");
memo.push("[payload 抜粋]");
memo.push(...snippetAround(/analysis_system_code:\s*hdOriginSortingDraftText/, 8, 12));
memo.push("");
memo.push("[SELECT返却 確認]");
const selectHits = afterLines
  .map((line, idx) => ({ line, idx }))
  .filter(x =>
    /analysisSystemCode|analysis_system_code AS current|d\.analysis_system_code|row\.analysis_system_code/.test(x.line)
  )
  .slice(0, 40)
  .map(x => `L${x.idx + 1}: ${x.line.trim()}`);
memo.push(...selectHits);
memo.push("");
memo.push("[次]");
memo.push("ExitCode 0 なら、メモ確認後に手動Copy-Itemで本体へ反映。");

fs.writeFileSync(memoPath, memo.join("\r\n"), "utf8");

cp.spawn("notepad.exe", [memoPath], { detached: true, stdio: "ignore" }).unref();

console.log("OK: 保存SQL Node after作成完了");
console.log("結果メモ: " + memoPath);