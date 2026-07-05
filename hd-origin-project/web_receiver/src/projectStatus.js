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
  lines.push("- レイアウト編集は、応急処置的に表示後JSでDOMを動かして直さない。");
  lines.push("- appendChild / insertBefore / unwrapElement などで、画面表示後に項目を移動して帳尻を合わせる修正を増やさない。");
  lines.push("- レイアウトを直す場合は、まず renderForm などの初期HTML生成部分を確認し、最初から正しいDOM構造で出るように根本から編集する。");
  lines.push("- CSSだけで無理に位置を合わせない。特に width: calc(...), マイナスmargin, overflow:hidden, position, transform, margin-left:auto, justify-self で逃げない。");
  lines.push("- レイアウト編集では、先にコード上のツリーを出す。画面画像だけで親子関係を断定しない。");
  lines.push("- グループ単位をユーザーと確定してから編集する。勝手にグループを増やさない、細分化しない。");
  lines.push("- 「解体」と言われたグループは、そのラッパーをツリーから外し、中身を親グループ直下へ上げた前提で考える。解体済みグループを後の説明で復活させない。");
  lines.push("- 境界線確認は、確定したグループだけに付ける。余計な親枠・仮グループ・思いつきの線を追加しない。");
  lines.push("- 既存の後付けレイアウトJSや過去のRECEIPT_系CSSブロックがある場合は、追加修正の前に「残す」「削る」「初期HTMLへ戻す」を一覧化する。");
  lines.push("- ユーザーが「ツリー出して」「解体して」と言った場合は、コードを書かず、まずツリーだけを書く。");
  lines.push("- PowerShellや修正コードは、ユーザーが明示的に「コードを書け」「PowerShellを出せ」「修正しろ」と言うまで出さない。");
  lines.push("");
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





