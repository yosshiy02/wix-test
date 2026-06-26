const fs = require("fs");
const path = require("path");
const os = require("os");
const config = require("./config");

const EXCLUDE_DIRS = new Set([
  ".git",
  "node_modules",
  "backup",
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

function readEnvSafe(projectRoot) {
  const envPath = path.join(projectRoot, ".env");

  if (!fs.existsSync(envPath)) {
    return {
      envPath,
      lines: ["※ .env が見つかりません。"]
    };
  }

  const raw = fs.readFileSync(envPath, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map(line => {
      if (!line.trim()) return line;
      if (line.trim().startsWith("#")) return line;

      const index = line.indexOf("=");

      if (index < 0) return line;

      const key = line.slice(0, index);
      const value = line.slice(index + 1);

      return `${key}=${maskSecret(key, value)}`;
    });

  return {
    envPath,
    lines
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

function writeProjectStatus(extraMemo = "") {
  const projectRoot = config.projectRoot;
  const webDir = config.webDir;
  const outputPath = path.join(projectRoot, "PROJECT_STATUS_FOR_GPT.txt");

  const env = readEnvSafe(projectRoot);
  const tree = buildTree(projectRoot);

  const importantFiles = [
    path.join(projectRoot, ".env"),
    path.join(projectRoot, ".env.example"),
    path.join(projectRoot, "README.md"),
    path.join(projectRoot, "database", "expenses", "master_management_setup.sql"),
    path.join(projectRoot, "database", "expenses", "add_classification_masters.sql"),
    path.join(webDir, "server.js"),
    path.join(webDir, "src", "config.js"),
    path.join(webDir, "src", "db.js"),
    path.join(webDir, "src", "db.bootstrap.js"),
    path.join(webDir, "src", "projectStatus.js"),
    path.join(webDir, "src", "expenses", "expenses.routes.js"),
    path.join(webDir, "src", "expenses", "expenses.repository.js"),
    path.join(webDir, "src", "masters", "masters.routes.js"),
    path.join(webDir, "src", "masters", "master.repository.js"),
    path.join(webDir, "public", "expenses", "expense-input.html"),
    path.join(webDir, "public", "expenses", "expense-list.html"),
    path.join(webDir, "public", "masters", "master-management.html"),
    path.join(webDir, "public", "settings.html")
  ];

  const lines = [];

  lines.push("HD Origin Project 現状引き継ぎメモ");
  lines.push("===================================");
  lines.push("");
  lines.push("このファイルは、別のGPTへ現状を伝えるために起動時に自動生成されています。");
  lines.push("DB_PASSWORD等の秘密情報は伏せています。");
  lines.push("");
  lines.push("[生成情報]");
  lines.push(`生成日時: ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`);
  lines.push(`PC名: ${os.hostname()}`);
  lines.push(`OS: ${os.platform()} ${os.release()} ${os.arch()}`);
  lines.push(`Node.js: ${process.version}`);
  lines.push(`作業ディレクトリ: ${process.cwd()}`);
  lines.push("");
  lines.push("[プロジェクト基本情報]");
  lines.push(`PROJECT_ROOT: ${projectRoot}`);
  lines.push(`WEB_DIR: ${webDir}`);
  lines.push(`PUBLIC_DIR: ${config.publicDir}`);
  lines.push(`SERVER_ENTRY: ${path.join(webDir, "server.js")}`);
  lines.push(`PORT: ${config.PORT}`);
  lines.push("");
  lines.push("[DB接続情報 ※パスワード非表示]");
  lines.push(`DB_HOST: ${config.db.host}`);
  lines.push(`DB_PORT: ${config.db.port}`);
  lines.push(`DB_NAME: ${config.db.database}`);
  lines.push(`DB_USER: ${config.db.user}`);
  lines.push("DB_PASSWORD: ********");
  lines.push(`PG_BIN_PATH: ${config.pgBinPath}`);
  lines.push("");
  lines.push("[バックアップ情報]");
  lines.push(`BACKUP_DIR: ${config.backupDir}`);
  lines.push("");
  lines.push("[.env 内容 ※秘密情報マスク済み]");
  lines.push(`ENV_PATH: ${env.envPath}`);
  lines.push("-----------------------------------");
  lines.push(...env.lines);
  lines.push("-----------------------------------");
  lines.push("");
  lines.push("[重要ファイル存在確認]");
  for (const file of importantFiles) {
    lines.push(`${fileExistsText(file)} : ${file}`);
  }
  lines.push("");
  lines.push("[現在の処理メモ]");
  lines.push("- 画面は HTML/CSS/JS。");
  lines.push("- サーバーは Node.js の server.js。");
  lines.push("- DBはPostgreSQL。");
  lines.push("- .env は接続先設定であり、DB本体ではない。");
  lines.push("- 経費入力画面のマスタ選択肢は /api/expenses/masters から取得する。");
  lines.push("- /api/expenses/masters は web_receiver/src/expenses/expenses.routes.js から expenses.repository.js の getMasters() を呼ぶ。");
  lines.push("- 証憑・インボイスはHTML固定選択肢。");
  lines.push("- 対象者・目的・案件・部門・勘定科目・支払方法・税区分・支払先はPostgreSQLのexpenses系テーブルを見る。");
  lines.push("- DBが無いPCでは、起動時に基本構造を作る設計へ移行中。");
  lines.push("- 過去データは設定画面のDBリストアで戻す方針。");
  lines.push("- このファイルは、他GPTへ状況を伝えるための自動メモ。");
  if (extraMemo) {
    lines.push("");
    lines.push("[追加メモ]");
    lines.push(String(extraMemo));
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
