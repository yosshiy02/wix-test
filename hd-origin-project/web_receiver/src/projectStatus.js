const fs = require("fs");
/* HD_ORIGIN_PAYMENT_DOCUMENT_SORTING_HANDOFF_20260707_START */
function hdOriginPaymentDocumentSortingHandoffText() {
  return [
    "",
    "==============================",
    "支払書類仕分けシステム 引き継ぎ",
    "==============================",
    "",
    "[ページ名称]",
    "- 旧: 支払書類 読取内容確認",
    "- 新: 支払書類仕分けシステム",
    "- このページは単なるOCR確認画面ではなく、OCR済み支払書類をAI候補と人間判断で仕分ける中核ページとして扱う。",
    "",
    "[根本設計]",
    "- 解析構成は「共通1個 + 専門5個 = 合計6個」で進める。",
    "- AIに全項目を一気に埋めさせない。",
    "- まず共通読取で事実を読む。",
    "- 次に共通仕分けで専門解析を選ぶ。",
    "- 最後に専門解析で会計候補・表示項目・要確認点を出す。",
    "",
    "[0. 共通読取・共通仕分けシステム]",
    "- 全書類共通。",
    "- OCR本文から、書類名、発行元、支払先候補、宛名、会社名、日付、支払期限、金額、税抜金額、消費税額、合計金額、登録番号、支払方法、明細、要確認文言などの事実を読む。",
    "- そのうえで、どの専門解析へ回すかを判定する。",
    "- 共通部分では会計確定まで踏み込みすぎない。",
    "",
    "[1. 請求・未払系解析システム]",
    "- 対象: 請求書、材料仕入請求書、外注請求書、保険料通知、リース料、家賃、公共料金、通信費など。",
    "- 主な判断: 買掛、未払、経費、保険、リース、通信費、公共料金など。",
    "- 保険・契約・リース・公共料金・通信費は、当初はこの中のサブ分類として扱う。",
    "- 材料仕入請求書は買掛候補。",
    "- 保険料通知は買掛ではなく未払金または未払費用候補。",
    "",
    "[2. 支払済み証憑解析システム]",
    "- 対象: 領収書、レシート、支払済み証憑。",
    "- これは既存のレシート系機能が実質該当する。",
    "- 新規でゼロから作るのではなく、既存レシート機能をこの6分類の中へ正式編入する。",
    "- 既存レシート系では、取込、OCR、AI候補、明細、明細内訳、税区分、対象者、目的、案件、部門、未精算/精算済み、下書き保存、本保存、本保存済み台帳まで進んでいる。",
    "",
    "[3. 税金・公的支払解析システム]",
    "- 対象: 納付書、納税通知書、社会保険、労働保険、行政手数料など。",
    "- 主な項目: 税目、納付先、納付番号、通知書番号、年度、期別、納期限、納付額、延滞金。",
    "- 税金・公的支払は買掛登録しない。",
    "- 登録番号T、消費税、税抜金額、請求合計だけで税金扱いしない。",
    "",
    "[4. カード・決済明細解析システム]",
    "- 対象: クレジットカード明細、Square、PayPay、Stripe、決済サービス明細。",
    "- 主な項目: 明細行、利用日、利用先、金額、カード未払、決済手数料、支払方法、引落日。",
    "- 1枚の書類に複数明細がある前提で見る。",
    "",
    "[5. 取引補助書類解析システム]",
    "- 対象: 納品書、注文書、発注書、見積書、検収書。",
    "- 原則、支払確定ではなく照合用。",
    "- 請求書待ち、納品照合、発注照合、見積確認へ回す。",
    "",
    "[重要方針]",
    "- 書類区分は「これは何の書類か」。",
    "- 処理先は「どこへ回すか」。",
    "- 会計候補は「勘定科目・税区分・インボイス区分など」。",
    "- 保存先は「買掛、未払、経費、税金、公的支払、カード、照合用、保留」など。",
    "- 書類区分と会計処理を混ぜすぎない。",
    "",
    "[現時点の完成度]",
    "- 共通読取・共通仕分け: これから根本設計。",
    "- 請求・未払系: 支払書類・請求書・未払系として作成中。",
    "- 支払済み証憑系: 既存レシート系としてかなり完成済み。",
    "- 税金・公的支払系: これから。",
    "- カード・決済明細系: これから。",
    "- 取引補助書類系: 納品書ページ土台あり、解析はこれから。",
    "",
    "[今回の判断]",
    "- 1つの巨大AI解析で全書類を処理する方式は複雑化しやすい。",
    "- 今後は、共通読取・仕分け + 専門解析5系統に分ける。",
    "- 支払書類仕分けシステムは、この6構成を前提に再設計する。"
  ].join("\\n");
}

function hdOriginAppendPaymentDocumentSortingHandoffToProjectStatus(value) {
  const text = String(value || "");

  if (text.includes("支払書類仕分けシステム 引き継ぎ")) {
    return text;
  }

  return text.replace(/\s*$/g, "") + "\\n" + hdOriginPaymentDocumentSortingHandoffText() + "\\n";
}

const hdOriginOriginalProjectStatusWriteFileSync20260707 = fs.writeFileSync.bind(fs);

fs.writeFileSync = function hdOriginProjectStatusWriteFileSync20260707(filePath, data, options) {
  try {
    const target = String(filePath || "").replace(/\\/g, "/");

    if (
      target.endsWith("/PROJECT_STATUS_FOR_GPT.txt") ||
      target.endsWith("PROJECT_STATUS_FOR_GPT.txt")
    ) {
      if (typeof data === "string") {
        data = hdOriginAppendPaymentDocumentSortingHandoffToProjectStatus(data);
      } else if (Buffer.isBuffer(data)) {
        data = Buffer.from(
          hdOriginAppendPaymentDocumentSortingHandoffToProjectStatus(data.toString("utf8")),
          "utf8"
        );
      }
    }
  } catch {
    // スタート文書生成そのものを止めない
  }

  return hdOriginOriginalProjectStatusWriteFileSync20260707(filePath, data, options);
};
/* HD_ORIGIN_PAYMENT_DOCUMENT_SORTING_HANDOFF_20260707_END */

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
  lines.push("");  lines.push("");
  lines.push("[スタート文書ルール]");
  lines.push("HD_ORIGIN_START_DOCUMENT_FIXED_PATH_RULE_20260706");
  lines.push("- この PROJECT_STATUS_FOR_GPT.txt を、今後『スタート文書』と呼ぶ。");
  lines.push("- PCは動的に変わる前提で扱う。");
  lines.push("- PROJECT_ROOT、Dropbox、証憑、バックアップ、Node、PostgreSQL、Chrome 等のパスは固定パスで絶対に書かない。");
  lines.push("- パスは必ず HD_ORIGIN_RUNTIME_PATHS.txt、config.js、.env_path.txt、環境変数、または起動時に検出した値から動的に解決する。");
  lines.push("- DBへ保存する証憑パスも、旧PCの絶対パスを前提にしない。config.receiptRoot と local_image_file_name から再解決できる形を優先する。");
  lines.push("");

  /* HD_ORIGIN_ALL_PC_SYNC_STATUS_20260715_START */
  lines.push("[Git・Dropbox 全PC同期仕様]");
  lines.push("HD_ORIGIN_ALL_PC_SYNC_STATUS_20260715");
  lines.push("- 最大目的は、どのPCで開いてもソースとDBが同じ状態になること。");
  lines.push("- ソースの正本はGitHubの現在ブランチとする。");
  lines.push("- PostgreSQL業務データの正本はDropbox内の最新バックアップとする。");
  lines.push("");
  lines.push("[サーバー再起動・終了ボタンの動作]");
  lines.push("- GPT一時フォルダ、秘密.env、PC固有実行パス、スタート文書、Access DB、ロックファイル、DBバックアップはGit対象外とする。");
  lines.push("- 除外対象以外の変更を全件自動抽出し、変更があればgit addとgit commitを行う。");
  lines.push("- GitHubからfetchとpull --rebase --autostashを行う。");
  lines.push("- 現在ブランチをGitHubへpushする。");
  lines.push("- origin側だけのコミット数とローカル側だけのコミット数が両方0であることを確認する。");
  lines.push("- commit、pull、push、完全一致確認のどこかが失敗した場合、DBバックアップと再起動・終了を中止する。");
  lines.push("- GitHubとの完全一致確認後にだけ、DropboxへPostgreSQL終了前バックアップを作成する。");
  lines.push("- DBバックアップ成功後にだけサーバーを終了または再起動する。");
  lines.push("");
  lines.push("[通常起動の動作]");
  lines.push("- start_hd_origin.batは通常起動処理より先にGitHubからfetchとpullを行う。");
  lines.push("- ローカルに既存コミットがあればGitHubへpushする。");
  lines.push("- originとローカルの差分が両方0であることを確認する。");
  lines.push("- 同期後の最新start_hd_origin.batを読み直してから、環境読込、最新DB復元、server.js起動へ進む。");
  lines.push("- Git同期に失敗した場合は、PCごとの状態が分かれることを防ぐため起動を中止する。");
  lines.push("");
  lines.push("[禁止]");
  lines.push("- commitだけ行い、pushせずに別PCへ移ることを禁止する。");
  lines.push("- GitHubとの差分を残したまま正常再起動として扱うことを禁止する。");
  lines.push("- Git同期失敗を無視してDB復元やサーバー起動へ進むことを禁止する。");
  lines.push("");
  /* HD_ORIGIN_ALL_PC_SYNC_STATUS_20260715_END */
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

/* HD_ORIGIN_DELIVERY_NOTE_VENDOR_RULES_TODO_PATCH_20260707_START */
const hdOriginDeliveryNoteVendorRulesTodoMarker = "HD_ORIGIN_TODO_DELIVERY_NOTE_VENDOR_RULES_20260707";

function hdOriginBuildDeliveryNoteVendorRulesTodoBlock() {
  return [
    "",
    "[次にやること: 納品書AI 取引先別ルール]",
    "HD_ORIGIN_TODO_DELIVERY_NOTE_VENDOR_RULES_20260707",
    "- 納品書AI解析は、共通ルールだけで確定しない。取引先別ルールを後から追加できる設計にする。",
    "- 納品書は取引先ごとに帳票のクセが強いため、明細の列位置、商品コード、備考、税額の読み方を取引先別に補正できるようにする。",
    "- 株式会社マルシンの例では、明細先頭の「0001」が全行共通で出るため、商品コードとして自動確定しない。",
    "- 全行共通のコードは item_code に確定入力せず、raw_code または memo に残して人間確認対象にする。",
    "- 「上二回」など加工・備考っぽい語は、商品名へ混ぜるか備考へ分けるかを取引先別ルールで判断する。",
    "- 明細解析では、数量 × 単価 = 金額 が一致する組み合わせを優先する。",
    "- 税額がOCRで読めない場合は、明細合計を税抜額候補として扱い、税込合計・消費税額は要確認にする。",
    "- 初期段階ではDB化を急がず、まずAIプロンプトまたはルールJSONで取引先別ルールを持てる形にする。"
  ].join("\n");
}

function hdOriginAppendDeliveryNoteVendorRulesTodoToText(text) {
  const source = String(text || "");
  const block = hdOriginBuildDeliveryNoteVendorRulesTodoBlock().trim();

  if (!source.includes(hdOriginDeliveryNoteVendorRulesTodoMarker)) {
    return source.trimEnd() + "\n\n" + block + "\n";
  }

  const pattern = /\n?\[次にやること: 納品書AI 取引先別ルール\]\nHD_ORIGIN_TODO_DELIVERY_NOTE_VENDOR_RULES_20260707[\s\S]*?(?=\n\[[^\n]+\]|\s*$)/;

  if (pattern.test(source)) {
    return source.replace(pattern, "\n" + block);
  }

  return source.trimEnd() + "\n\n" + block + "\n";
}

function hdOriginAppendDeliveryNoteVendorRulesTodoToFile() {
  const fsLocal = require("fs");
  const pathLocal = require("path");
  const projectRootLocal = pathLocal.resolve(__dirname, "..", "..");
  const statusPathLocal = pathLocal.join(projectRootLocal, "PROJECT_STATUS_FOR_GPT.txt");

  if (!fsLocal.existsSync(statusPathLocal)) {
    return;
  }

  const current = fsLocal.readFileSync(statusPathLocal, "utf8");
  const next = hdOriginAppendDeliveryNoteVendorRulesTodoToText(current);

  if (next !== current) {
    fsLocal.writeFileSync(statusPathLocal, next, "utf8");
  }
}

const hdOriginOriginalWriteProjectStatus = module.exports.writeProjectStatus;

if (typeof hdOriginOriginalWriteProjectStatus === "function") {
  module.exports.writeProjectStatus = function hdOriginWriteProjectStatusWithDeliveryNoteTodo(...args) {
    const result = hdOriginOriginalWriteProjectStatus.apply(this, args);

    const afterWrite = () => {
      try {
        hdOriginAppendDeliveryNoteVendorRulesTodoToFile();
      } catch (error) {
        console.error("[HD_ORIGIN] delivery note vendor rules TODO append failed:", error && error.message ? error.message : error);
      }
    };

    if (result && typeof result.then === "function") {
      return result.then((value) => {
        afterWrite();
        return value;
      });
    }

    afterWrite();
    return result;
  };
}
/* HD_ORIGIN_DELIVERY_NOTE_VENDOR_RULES_TODO_PATCH_20260707_END */

/*
HD_ORIGIN_START_DOC_SPECIALIST_STAGE3_COMMON_MEMO_20260709_START
スタート文書追記:
他の専門解析システムを作るGPT向けに、専門解析ボタンの共通設計を PROJECT_STATUS_FOR_GPT.txt へ追記する。
保存しない設計ではない。解析ボタン・表示メモ・保存処理の責務を分けるだけ。
HD_ORIGIN_START_DOC_SPECIALIST_STAGE3_COMMON_MEMO_20260709_END
*/
(function hdOriginAppendSpecialistStage3CommonMemoToStartDocument() {
  try {
    const fs = require("fs");
    const path = require("path");

    const projectRoot = path.resolve(__dirname, "..", "..");
    const statusPath = path.join(projectRoot, "PROJECT_STATUS_FOR_GPT.txt");

    if (!fs.existsSync(statusPath)) {
      return;
    }

    const blockStart = "HD_ORIGIN_SPECIALIST_STAGE3_COMMON_DESIGN_MEMO_20260709_START";
    const blockEnd = "HD_ORIGIN_SPECIALIST_STAGE3_COMMON_DESIGN_MEMO_20260709_END";

    const memo = `

==============================
専門解析システム 共通設計メモ
${blockStart}
==============================

[対象]
このメモは、支払書類仕分けシステムの各専門解析システムを作るGPT向け。

対象例:
- 税金・公的支払解析
- 契約・保険・リース解析
- 公共料金・通信費解析
- 支払済み証憑解析
- カード明細照合解析
- 請求・未払系解析

[最重要結論]
専門解析画面の「専門解析」ボタン、または「まとめて専門解析」ボタンでは、1回目解析・2回目解析を再実行しない。

専門解析ボタンで実行するAIは、各専門システム用の stage3 specialist 解析だけ。

つまり、専門解析ボタンは「1段階解析」である。

[正しい流れ]
専門解析ボタン
→ /api/payment-documents/ai-specialist/:id
→ OCR本文を取得
→ 対象専門システムの stage3-specialist プロンプトを読む
→ specialist AIを1回だけ実行
→ fields / visible_field_labels / warnings 等を返す
→ 画面表示

[専門解析ボタンで走るもの]
- stage3 specialist のAI解析のみ
- 各専門システム専用プロンプト
- 共通専門プロンプト
- OCR本文ベースの専門解析

[専門解析ボタンで走らないもの]
- 1回目仕分けAI
- /api/payment-documents/ai-sort/:id
- classification
- sorting
- 2回目共通下書きAI
- /api/payment-documents/ai-draft/:id
- detail
- 旧2段階AI

[重要な考え方]
1回目解析・2回目解析は、専門解析ボタンの中で再実行しない。
専門解析は、1回目・2回目をもう一度やる場所ではない。

専門解析は、すでに専門画面へ来た書類に対して、その専門分野として深掘りするためのAIである。

[stage3 という名前について]
stage3-specialist という名前だが、専門解析ボタンを押した時に3回AIが走るという意味ではない。

stage3 は全体設計上の位置付け。
実際の専門解析ボタンのAI呼び出しは、各書類ごとに1回だけ。

[まとめて専門解析について]
「まとめて専門解析」で対象書類が複数ある場合、書類ごとに specialist を1回ずつ実行する。

例:
対象書類が2件の場合
- 1件目 → specialist 1回
- 2件目 → specialist 1回

これは3段階解析ではない。
単に、対象書類ごとに専門解析を1回ずつ実行しているだけ。

[プロンプトファイルについて]
専門解析では、複数のプロンプトファイルを読むことがある。

例:
- stage3-specialist/common/system.txt
- stage3-specialist/common/output-schema.txt
- stage3-specialist/common/human-confirm-rules.txt
- stage3-specialist/各専門/system.txt
- stage3-specialist/各専門/fields.txt
- stage3-specialist/各専門/rules.txt
- stage3-specialist/各専門/examples.txt

ただし、複数ファイルを読むことは、複数段階AIを実行することではない。

複数プロンプトファイルを、1回の specialist AI呼び出しにまとめて渡すだけ。

[1回目解析結果との関係]
専門解析画面へ対象書類を表示するために、1回目仕分け結果の analysis_system_code や specialist_route_code を参照することはある。

ただし、それは「どの専門画面に出すか」のルーティング・絞り込みのため。

専門解析ボタンを押した時に、1回目解析を再実行してはいけない。
また、専門解析の結果を1回目解析ロジックで後から上書きしてはいけない。

[2回目解析結果との関係]
専門解析ボタンでは、旧2回目 detail / ai-draft を呼ばない。

専門解析画面では、共通下書きAIのdetail結果を作り直すのではなく、専門解析AIが専門項目を返す。

[専門解析の出力方針]
専門解析AIは、固定項目を無理に全部埋めるのではなく、AIが必要と判断した項目を返す。

基本出力:
- draft
- fields
- visible_field_labels
- warnings
- analysis_system_code
- analysis_system_label
- analysis_system_reason
- analysis_system_confidence
- document_type_code / document_type_label
- payment_destination_code / payment_destination_label
- accounting_category_code / accounting_category_label
- payable_kind_code / payable_kind_label
- specialist_route_code / specialist_route_label

[表示方針]
画面側は、AIが返した visible_field_labels を正とする。

HTML・JSで、
「この種類ならこの項目を足す」
「このOCR語句があるからこの項目を補正する」
「空欄だから勝手に固定値を入れる」
という後付け補正をしない。

[表示メモと保存処理の違い]
各専門画面の「表示中項目メモ」は、画面に現在表示されている項目を確認用に出力するだけの機能である。

このメモ出力操作では、DB保存・下書き保存・本登録は行わない。

ただし、これは「専門解析結果を保存しない」という意味ではない。

専門解析AIが返した fields / visible_field_labels / warnings などの結果は、単体保存・まとめて保存などの保存処理で下書きDBへ保存する前提である。

AI解析の成功確認、表示メモの確認、DB保存の確認は別々に扱う。

[保存方針]
専門解析AIが返した fields / visible_field_labels / warnings は、下書き保存時に壊さず保存する。

専門解析ボタン自体はAI解析を実行するボタンであり、保存処理とは責務を分ける。

保存は、単体保存・まとめて保存などの保存処理で行う。

保存側では、専門AIの結果を固定フォーム項目だけに丸め込まない。
専門AIが選んだ項目、表示対象ラベル、警告情報をそのまま保持できるようにする。

[他GPTへの禁止事項]
専門解析システムを作る時、以下は禁止。

- 専門解析ボタンから /ai-sort を呼ぶ
- 専門解析ボタンから /ai-draft を呼ぶ
- 専門解析の中で1回目仕分けAIを再実行する
- 専門解析の中で2回目detail AIを再実行する
- 1回目・2回目の解析結果を専門解析結果として流用して終わらせる
- HTML/JSでOCR語句ベースの後付け分類をする
- AIの visible_field_labels を無視して固定項目だけ表示する
- 専門AI結果を保存時に固定項目へ潰す
- 「表示中項目メモに保存していませんと書いてある」ことを理由に、専門解析結果は保存不要と解釈する

[確認方法]
専門解析ボタンが正しく作れているかは、rawResult の ai_steps を見る。

正しい状態:
[
  {
    "name": "specialist"
  }
]

classification が {} であること。
旧 detail が走っていないこと。
prompt_rule_files に stage3-specialist/common と対象専門フォルダが入っていること。

[税金・公的支払で確認済みの例]
税金・公的支払専門解析では、専門解析ボタン実行時に ai_steps は specialist のみ。
classification は {}。
image_used は false。
display_mode は ai_decides_visible_fields。
prompt_rule_files は common と tax-public を読んでいる。

これは、専門解析ボタンが1回目・2回目を走らせず、stage3 specialist だけを1回実行している状態である。

[保存確認について]
専門解析AIが成功していても、下書き保存が成功しているとは限らない。

これは「保存しない」という意味ではない。
専門解析結果は保存する前提。

保存で失敗した場合は、AI段階数の問題ではなく、保存API・DB列・JSON保存形式の問題として切り分ける。

AI解析の成功確認と、DB保存の成功確認は別物。

[結論]
各専門解析システムは、1回目・2回目をいじらず、専門解析ボタンでは stage3 specialist だけを1回実行する設計にする。

専門解析は「既存解析を再実行する場所」ではなく、「専門分野として深掘りする場所」である。

専門解析結果は、表示して終わりではなく、保存処理で下書きDBへ保存する前提で扱う。

${blockEnd}
==============================
`;

    let current = fs.readFileSync(statusPath, "utf8");

    if (current.includes(blockStart) && current.includes(blockEnd)) {
      const startIndex = current.indexOf(blockStart);
      const endIndex = current.indexOf(blockEnd, startIndex);
      const before = current.slice(0, current.lastIndexOf("\n==============================", startIndex));
      const after = current.slice(current.indexOf("==============================", endIndex) + "==============================".length);
      current = `${before}${memo}${after}`;
      fs.writeFileSync(statusPath, current, "utf8");
      return;
    }

    if (!current.includes(blockStart)) {
      fs.appendFileSync(statusPath, memo, "utf8");
    }
  } catch (err) {
    // スタート文書表示を止めないため、追記失敗時も例外で落とさない。
    console.warn("[HD_ORIGIN] specialist stage3 common memo append skipped:", err && err.message ? err.message : err);
  }
})();

