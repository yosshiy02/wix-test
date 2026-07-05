const fs = require("fs");
const path = require("path");
const os = require("os");
const { TextDecoder } = require("util");
const config = require("./config");

const EXCLUDE_DIRS = new Set([
  ".git",
  "node_modules",
  "backup",
  "GPTが見たいファイル一時フォルダ",
  "_manual_patch_backup",
  ".vs",
  "bin",
  "obj",
  "dist",
  "build",
  ".next",
  ".cache"
]);

const EXCLUDE_FILES = new Set([
  "package-lock.json",
  "Thumbs.db",
  "Desktop.ini"
]);

function maskSecret(key, value) {
  const upper = String(key || "").toUpperCase();

  if (
    upper.includes("PASSWORD") ||
    upper.includes("SECRET") ||
    upper.includes("TOKEN") ||
    upper.includes("KEY")
  ) {
    return value ? "********" : "";
  }

  return value;
}

function readTextAuto(filePath) {
  const buffer = fs.readFileSync(filePath);

  const utf8 = buffer.toString("utf8");

  if (!utf8.includes("�")) {
    return utf8;
  }

  try {
    return new TextDecoder("shift_jis").decode(buffer);
  } catch {
    return utf8;
  }
}

function readRuntimePathsSafe(projectRoot) {
  const runtimePath = path.join(projectRoot, "HD_ORIGIN_RUNTIME_PATHS.txt");

  if (!fs.existsSync(runtimePath)) {
    return {
      filePath: runtimePath,
      lines: ["※ HD_ORIGIN_RUNTIME_PATHS.txt が見つかりません。"],
      values: {}
    };
  }

  const raw = readTextAuto(runtimePath);
  const values = {};

  const lines = raw
    .split(/\r?\n/)
    .map(line => {
      if (!line.trim()) return line;

      const index = line.indexOf("=");

      if (index < 0) return line;

      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1);

      values[key] = value;

      return `${key}=${maskSecret(key, value)}`;
    });

  return {
    filePath: runtimePath,
    lines,
    values
  };
}

function safeReaddir(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

function buildTree(rootDir, options = {}) {
  const maxDepth = options.maxDepth ?? 7;
  const maxItemsPerDir = options.maxItemsPerDir ?? 120;
  const lines = [];

  function walk(currentDir, prefix, depth) {
    if (depth > maxDepth) {
      lines.push(`${prefix}...`);
      return;
    }

    let entries = safeReaddir(currentDir)
      .filter(entry => {
        if (entry.isDirectory() && EXCLUDE_DIRS.has(entry.name)) return false;
        if (entry.isFile() && EXCLUDE_FILES.has(entry.name)) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name, "ja");
      });

    const over = entries.length > maxItemsPerDir;

    if (over) {
      entries = entries.slice(0, maxItemsPerDir);
    }

    entries.forEach((entry, index) => {
      const isLast = index === entries.length - 1 && !over;
      const branch = isLast ? "└─ " : "├─ ";
      const nextPrefix = prefix + (isLast ? "   " : "│  ");
      const fullPath = path.join(currentDir, entry.name);

      lines.push(`${prefix}${branch}${entry.name}${entry.isDirectory() ? "\\" : ""}`);

      if (entry.isDirectory()) {
        walk(fullPath, nextPrefix, depth + 1);
      }
    });

    if (over) {
      lines.push(`${prefix}└─ ... ${safeReaddir(currentDir).length - maxItemsPerDir} items omitted`);
    }
  }

  lines.push(`${path.basename(rootDir)}\\`);
  walk(rootDir, "", 1);

  return lines;
}

function fileExistsText(filePath) {
  return fs.existsSync(filePath) ? "あり" : "なし";
}

function writeProjectStatus() {
  const projectRoot = config.projectRoot;
  const webDir = config.webDir;
  const outputPath = path.join(projectRoot, "PROJECT_STATUS_FOR_GPT.txt");

  const runtime = readRuntimePathsSafe(projectRoot);
  const runtimeValues = runtime.values || {};
  const tree = buildTree(projectRoot);

  const importantFiles = [
    path.join(projectRoot, "HD_ORIGIN_RUNTIME_PATHS.txt"),
    path.join(projectRoot, "HD_ORIGIN_PC_RULES.txt"),
    path.join(projectRoot, ".env_path.txt"),
    path.join(projectRoot, ".env.example"),
    path.join(projectRoot, "README.md"),
    path.join(webDir, "start_hd_origin.bat"),
    path.join(webDir, "server.js"),
    path.join(webDir, "src", "config.js"),
    path.join(webDir, "src", "db.js"),
    path.join(webDir, "src", "db.bootstrap.js"),
    path.join(webDir, "src", "projectStatus.js"),
    path.join(webDir, "src", "backups", "backup.routes.js"),
    path.join(webDir, "src", "backups", "backup.service.js"),
    path.join(webDir, "src", "expenses", "expenses.routes.js"),
    path.join(webDir, "src", "expenses", "expenses.repository.js"),
    path.join(webDir, "src", "masters", "masters.routes.js"),
    path.join(webDir, "src", "masters", "master.repository.js"),
    path.join(webDir, "src", "receipts", "receipts.routes.js"),
    path.join(webDir, "src", "receipts", "receipts.repository.js"),
    path.join(webDir, "src", "receipts", "receipts.ai.js"),
    path.join(webDir, "public", "expenses", "expense-input.html"),
    path.join(webDir, "public", "expenses", "expense-list.html"),
    path.join(webDir, "public", "masters", "master-management.html"),
    path.join(webDir, "public", "receipts", "receipt-list.html"),
    path.join(webDir, "public", "receipts", "receipt-scan-inbox.html"),
    path.join(webDir, "public", "settings.html")
  ];

  const lines = [];

  lines.push("HD Origin Project 構造・起動パス確認メモ");
  lines.push("=======================================");
  lines.push("");
  lines.push("このファイルは、起動BATが確定したPC別パスとフォルダ構造を次のGPTへ伝えるために自動生成されています。");
  lines.push("DB_PASSWORD等の秘密情報は伏せています。");
  lines.push("");
  lines.push("[作業ルール]");
  lines.push("- 基本的にファイル編集は PowerShell で行う。");
  lines.push("- PowerShellで確認テキストを出す場合は、コンソール表示だけにせず、メモ帳など別ウインドウで開く。");
  lines.push("- ただし、ユーザーが明示しない限り、クリップボードは触らない。");
  lines.push("- 確認結果だけを出す場合は、ユーザーが明示しない限り、フォルダを勝手に開かない。");
  lines.push("- GPTに見せるファイルは、プロジェクト直下の「GPTが使う一時ファイルフォルダ」に集める。");
  lines.push("- 「GPTが使う一時ファイルフォルダ」は一時作業用なので、収集前に古い作業ファイルを残さない。");
  lines.push("- GPTが読むためのコピーは「GPTが使う一時ファイルフォルダ\\GPTに渡すフォルダ」に集める。");
  lines.push("- 「GPTに渡すフォルダ」は毎回クリーンしてから、今回必要なファイルだけコピーする。");
  lines.push("- GPTに渡すファイル数は、原則15ファイル以内。複雑な確認で必要な場合のみ最大20ファイルまで可。それを超える場合は分割する。");
  lines.push("- 「GPTが使う一時ファイルフォルダ」には、GPTに渡すフォルダ / before / after / apply / undo / memo を置く。");
  lines.push("- before には修正前コピー、after には修正版、apply には本体反映手順、undo には戻し手順、memo には確認結果・作業メモを書く。");
  lines.push("- 今後の修正は、本体へいきなり直接当てず、before に修正前、after に修正版を作り、確認後に apply で本体へ反映する。");
  lines.push("- 問題が出た場合は、undo の手順で before から本体へ戻す。");
  lines.push("- 収集対象の元ファイルは、確認段階では変更しない。コピーのみ行う。");
  lines.push("- .env、秘密情報、DB、画像、実バックアップ、backup フォルダは、ユーザーが明示しない限り収集・削除・移動・変更しない。");
  lines.push("");
  lines.push("");
  lines.push("[日本語文字化け・Node日本語パス注意]");
  lines.push("- PowerShell経由で日本語入りの JavaScript / SQL / 一時スクリプトを作ると、環境によって文字コードがズレてDBマスタ名が文字化けすることがある。");
  lines.push("- DBへ日本語マスタを投入・更新する場合、日本語文字列をPowerShell内へ直書きしない。");
  lines.push("- 安全策として、JavaScript側では日本語を Unicodeエスケープで定義する。例: \\u4f1a\\u8b70 = 会議。");
  lines.push("- 既にUTF-8で保存された外部ファイルをNodeで読み込む方法も可。ただし文字コード確認を必須にする。");
  lines.push("- Set-ContentでJSを作る場合、日本語を含む内容は特に注意する。UnicodeエスケープだけのJSなら Encoding ASCII でも可。");
  lines.push("- console.table の日本語出力は文字化けしやすい。確認結果は UTF-8 の txt に書き出して notepad で開く。");
  lines.push("- Node / PowerShell のコンソール表示だけで判断しない。DB内の値まで壊れている場合があるため、必ずDB再確認する。");
  lines.push("- Node一時スクリプトを「GPTが使う一時ファイルフォルダ」など日本語パス配下で実行し、__dirname から結果ファイルを書こうとすると、パス自体が文字化けして失敗することがある。");
  lines.push("- NodeでDB修復・マスタ投入を行う場合は、web_receiver直下など英数字パスに一時JSを置き、結果ファイル名も英数字にする。");
  lines.push("- DB更新後に結果ファイル保存で失敗しても、COMMIT後ならDB更新済みの場合がある。再実行前に必ずDB確認する。");
  lines.push("- 今回、expenses.purposes の目的マスタ追加で日本語が文字化けした。v1修復は一意制約で失敗、v3は結果ファイル保存で失敗したが、DB確認では有効目的マスタが正常化済み。");
  lines.push("- 現在の目的マスタは、10:会議、20:商談、30:出張先会議、40:出張、50:来客対応、60:取引先訪問、70:仕入先訪問、80:社内会議、90:社内打合せ、100:打合せ、以降350:私用まで正常。");
  lines.push("- 以後の日本語マスタ投入では、同じ事故を繰り返さない。");
  lines.push("[生成情報]");
  lines.push(`生成日時: ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`);
  lines.push(`PC名: ${os.hostname()}`);
  lines.push(`OS: ${os.platform()} ${os.release()} ${os.arch()}`);
  lines.push(`Node.js: ${process.version}`);
  lines.push(`作業ディレクトリ: ${process.cwd()}`);
  lines.push("");
  lines.push("[起動BAT確定パス情報]");
  lines.push(`RUNTIME_PATHS_FILE: ${runtime.filePath}`);
  lines.push("-----------------------------------");
  lines.push(...runtime.lines);
  lines.push("-----------------------------------");
  lines.push("");
  lines.push("[主要確定値]");
  lines.push(`PROJECT_ROOT: ${runtimeValues.PROJECT_ROOT || projectRoot}`);
  lines.push(`WEB_DIR: ${runtimeValues.WEB_DIR || webDir}`);
  lines.push(`HD_ORIGIN_ENV_PATH: ${maskSecret("HD_ORIGIN_ENV_PATH", runtimeValues.HD_ORIGIN_ENV_PATH || "")}`);
  lines.push(`DB_HOST: ${runtimeValues.DB_HOST || ""}`);
  lines.push(`DB_PORT: ${runtimeValues.DB_PORT || ""}`);
  lines.push(`DB_NAME: ${runtimeValues.DB_NAME || ""}`);
  lines.push(`DB_USER: ${runtimeValues.DB_USER || ""}`);
  lines.push("DB_PASSWORD: ********");
  lines.push(`PG_BIN_PATH: ${runtimeValues.PG_BIN_PATH || ""}`);
  lines.push(`BACKUP_DIR: ${runtimeValues.BACKUP_DIR || ""}`);
  lines.push(`NODE_PATH: ${runtimeValues.NODE_PATH || ""}`);
  lines.push(`NPM_PATH: ${runtimeValues.NPM_PATH || ""}`);
  lines.push("");
  lines.push("[重要ファイル存在確認]");
  for (const file of importantFiles) {
    lines.push(`${fileExistsText(file)} : ${file}`);
  }
  lines.push("");
  lines.push("[プロジェクトツリー]");
  lines.push("-----------------------------------");
  lines.push(...tree);
  lines.push("-----------------------------------");
  lines.push("");

  fs.writeFileSync(outputPath, lines.join(os.EOL), "utf8");

  console.log(`[PROJECT_STATUS] wrote: ${outputPath}`);

  return outputPath;
}

module.exports = {
  writeProjectStatus
};





