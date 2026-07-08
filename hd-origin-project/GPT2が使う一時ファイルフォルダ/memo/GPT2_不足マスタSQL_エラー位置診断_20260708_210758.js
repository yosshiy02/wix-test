const fs = require("fs");
const path = require("path");

const projectRoot = process.argv[2];
const migrationPath = process.argv[3];
const resultPath = process.argv[4];

const webDir = path.join(projectRoot, "web_receiver");
process.chdir(webDir);

const db = require(path.join(webDir, "src", "db"));

function lineColFromPosition(text, pos1) {
  const pos = Math.max(0, Number(pos1 || 1) - 1);
  const before = text.slice(0, pos);
  const lines = before.split(/\r?\n/);
  return {
    line: lines.length,
    col: lines[lines.length - 1].length + 1
  };
}

function numberedContext(text, centerLine, span) {
  const lines = text.split(/\r?\n/);
  const start = Math.max(1, centerLine - span);
  const end = Math.min(lines.length, centerLine + span);
  const out = [];

  for (let i = start; i <= end; i++) {
    const marker = i === centerLine ? ">>" : "  ";
    out.push(`${marker} ${String(i).padStart(5, " ")} | ${lines[i - 1]}`);
  }

  return out;
}

async function main() {
  let sql = fs.readFileSync(migrationPath, "utf8").replace(/^\uFEFF/, "");

  const out = [];
  out.push("==============================");
  out.push("GPT2 不足マスタSQL エラー位置診断");
  out.push("==============================");
  out.push("日時: " + new Date().toISOString());
  out.push("");
  out.push("[SQL]");
  out.push(migrationPath);
  out.push("");

  try {
    await db.query(sql);
    out.push("エラーなしで実行できました。");
  } catch (err) {
    out.push("[エラー]");
    out.push("message=" + (err.message || ""));
    out.push("position=" + (err.position || ""));
    out.push("code=" + (err.code || ""));
    out.push("");

    if (err.position) {
      const lc = lineColFromPosition(sql, err.position);
      out.push(`[位置] line=${lc.line} / col=${lc.col}`);
      out.push("");
      out.push("[周辺SQL]");
      out.push(...numberedContext(sql, lc.line, 12));
    } else {
      out.push("[positionなし]");
      out.push(String(err.stack || err));
    }
  }

  fs.writeFileSync(resultPath, out.join("\r\n"), "utf8");

  try {
    await db.end();
  } catch {}
}

main().catch(async err => {
  fs.writeFileSync(resultPath, String(err && err.stack ? err.stack : err), "utf8");
  try { await db.end(); } catch {}
  process.exit(1);
});