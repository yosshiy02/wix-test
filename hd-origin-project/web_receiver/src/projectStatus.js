"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { TextDecoder } = require("util");
const config = require("./config");

const EXCLUDE_DIRS = new Set([
  ".git",
  "node_modules",
  "backup",
  "Backup",
  "GPTが見たいファイル一時フォルダ",
  "GPTが使う一時ファイルフォルダ",
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
  const runtimePath = path.join(
    projectRoot,
    "HD_ORIGIN_RUNTIME_PATHS.txt"
  );

  if (!fs.existsSync(runtimePath)) {
    return {
      filePath: runtimePath,
      lines: [
        "※ HD_ORIGIN_RUNTIME_PATHS.txt が見つかりません。"
      ],
      values: {}
    };
  }

  const raw = readTextAuto(runtimePath);
  const values = {};

  const lines = raw
    .split(/\r?\n/)
    .map((line) => {
      if (!line.trim()) {
        return line;
      }

      const index = line.indexOf("=");

      if (index < 0) {
        return line;
      }

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
    return fs.readdirSync(
      dir,
      {
        withFileTypes: true
      }
    );
  } catch {
    return [];
  }
}

function buildTree(rootDir, options = {}) {
  const maxDepth = options.maxDepth ?? 5;
  const maxItemsPerDir = options.maxItemsPerDir ?? 80;
  const lines = [];

  function walk(currentDir, prefix, depth) {
    if (depth > maxDepth) {
      lines.push(`${prefix}...`);
      return;
    }

    const originalEntries = safeReaddir(currentDir);

    let entries = originalEntries
      .filter((entry) => {
        if (
          entry.isDirectory() &&
          EXCLUDE_DIRS.has(entry.name)
        ) {
          return false;
        }

        if (
          entry.isFile() &&
          EXCLUDE_FILES.has(entry.name)
        ) {
          return false;
        }

        return true;
      })
      .sort((left, right) => {
        if (
          left.isDirectory() &&
          !right.isDirectory()
        ) {
          return -1;
        }

        if (
          !left.isDirectory() &&
          right.isDirectory()
        ) {
          return 1;
        }

        return left.name.localeCompare(
          right.name,
          "ja"
        );
      });

    const over =
      entries.length > maxItemsPerDir;

    if (over) {
      entries = entries.slice(
        0,
        maxItemsPerDir
      );
    }

    entries.forEach((entry, index) => {
      const isLast =
        index === entries.length - 1 &&
        !over;

      const branch =
        isLast
          ? "└─ "
          : "├─ ";

      const nextPrefix =
        prefix +
        (
          isLast
            ? "   "
            : "│  "
        );

      const fullPath = path.join(
        currentDir,
        entry.name
      );

      lines.push(
        `${prefix}${branch}${entry.name}` +
        (
          entry.isDirectory()
            ? "\\"
            : ""
        )
      );

      if (entry.isDirectory()) {
        walk(
          fullPath,
          nextPrefix,
          depth + 1
        );
      }
    });

    if (over) {
      lines.push(
        `${prefix}└─ ... 省略`
      );
    }
  }

  lines.push(`${path.basename(rootDir)}\\`);
  walk(rootDir, "", 1);

  return lines;
}

function fileExistsText(filePath) {
  return fs.existsSync(filePath)
    ? "あり"
    : "なし";
}

function appendSection(lines, title, values) {
  lines.push("");
  lines.push(`[${title}]`);

  for (const value of values) {
    lines.push(value);
  }
}

function writeProjectStatus() {
  const projectRoot = config.projectRoot;
  const webDir = config.webDir;

  const outputPath = path.join(
    projectRoot,
    "PROJECT_STATUS_FOR_GPT.txt"
  );

  const runtime =
    readRuntimePathsSafe(projectRoot);

  const runtimeValues =
    runtime.values || {};

  const importantFiles = [
    path.join(
      projectRoot,
      "HD_ORIGIN_RUNTIME_PATHS.txt"
    ),
    path.join(
      projectRoot,
      "HD_ORIGIN_PC_RULES.txt"
    ),
    path.join(
      projectRoot,
      ".env_path.txt"
    ),
    path.join(
      webDir,
      "start_hd_origin.bat"
    ),
    path.join(
      webDir,
      "server.js"
    ),
    path.join(
      webDir,
      "src",
      "config.js"
    ),
    path.join(
      webDir,
      "src",
      "db.js"
    ),
    path.join(
      webDir,
      "src",
      "db.bootstrap.js"
    ),
    path.join(
      webDir,
      "src",
      "projectStatus.js"
    ),
    path.join(
      webDir,
      "src",
      "paymentDocuments",
      "paymentDocuments.routes.js"
    ),
    path.join(
      webDir,
      "src",
      "paymentDocuments",
      "paymentDocuments.aiPromptLoader.js"
    ),
    path.join(
      webDir,
      "public",
      "payables",
      "payment-document-inbox.html"
    ),
    path.join(
      webDir,
      "public",
      "payables",
      "payment-document-review.html"
    ),
    path.join(
      webDir,
      "public",
      "payables",
      "payable-list.html"
    ),
    path.join(
      webDir,
      "public",
      "settings.html"
    )
  ];

  const lines = [];

  lines.push("HD Origin Project スタート文書");
  lines.push("=======================================");
  lines.push("");
  lines.push(
    "このファイルは、起動時点のPC、パス、現在設計、作業ルールを次担当GPTへ伝えるために自動生成されます。"
  );
  lines.push(
    "秘密情報は伏せます。旧PCの固定パスは正として扱いません。"
  );

  appendSection(
    lines,
    "最重要作業ルール",
    [
      "- 常に丁寧語で対応する。",
      "- 現物確認なしの推測修正を行わない。",
      "- 同じエラーを繰り返さず、過去の類似原因と失敗パターンを再利用する。",
      "- 修正対象以外のファイルやコードへ触れない。",
      "- PowerShellは、そのまま貼り付けて実行できる完全スクリプトで提示する。",
      "- ユーザーへ部分書換えや手作業の差替えを求めない。",
      "- before、after、apply、undo、memoを使用する。",
      "- 読み取り確認ではDB、ファイル、AI、OCR、Gitを変更しない。",
      "- サーバー再起動はユーザーが実施する。",
      "- GPTが勝手にcommit、push、サーバー再起動を行わない。",
      "- .env、秘密情報、DB本体、証憑画像、実バックアップを勝手に変更・削除しない。"
    ]
  );

  appendSection(
    lines,
    "PC・パス運用",
    [
      "- PCは変わる前提で扱う。",
      "- PROJECT_ROOT、WEB_DIR、Dropbox、Node、PostgreSQL、証憑、バックアップのパスを固定しない。",
      "- HD_ORIGIN_RUNTIME_PATHS.txt、config.js、.env_path.txt、環境変数、起動時検出値を正とする。",
      "- 旧PCの絶対パスを新PCへそのまま流用しない。",
      "- DB内に旧PCパスが残る場合も、現在設定と保存ファイル名から再解決する。"
    ]
  );

  appendSection(
    lines,
    "現在の正規構成",
    [
      "- 正規システムはWebブラウザ、Node.js、PostgreSQLで構成する。",
      "- 現在の支払書類フローではAccessを使用しない。",
      "- OCR結果、AI結果、共通下書き、専門解析結果はPostgreSQLで管理する。",
      "- AIプロンプトはPostgreSQLのai_prompt_definitionsとai_prompt_compositionsを正とする。",
      "- 古い外部テキストプロンプト固定読込方式を正規方式として復活させない。",
      "- AIへ渡すのはOCR本文のみ。画像AIは禁止する。"
    ]
  );

  appendSection(
    lines,
    "支払書類AI 正規処理順",
    [
      "1. OCR取込",
      "2. Stage1 共通仕分け",
      "3. Stage2 共通下書き",
      "4. Stage1・Stage2結果を自動保存",
      "5. analysis_system_codeで専門画面へ振り分け",
      "6. 専門画面でStage3 specialistを1回だけ実行",
      "7. 専門解析結果を下書きDBへ保存",
      "8. 人間確認・修正・確定",
      "",
      "- 基礎解析の正規APIは /api/payment-documents/ai-draft/:id。",
      "- まとめて仕分けでも旧 /ai-sort/:id を使用しない。",
      "- 専門解析ボタンではStage1・Stage2を再実行しない。",
      "- 専門解析ボタンから /ai-sort または /ai-draft を呼ばない。",
      "- 複数件の専門解析は、対象書類ごとにStage3を1回ずつ実行する。"
    ]
  );

  appendSection(
    lines,
    "AI判定の絶対ルール",
    [
      "- 会社判定、文書種別、専門解析先、仕分けは必ずAIのみで決定する。",
      "- SQL、固定値、HTML、JavaScript、OCR語句ルール、人間の推測で分類しない。",
      "- マスタはAIへ候補と説明を提示するために使用する。",
      "- AI結果を返却後に別コードへ寄せたり書き換えたりしない。",
      "- analysis_system_codeを専門画面分岐の正規キーとする。",
      "- specialist_route_code、document_type_code、payment_destination_code等を代替キーにしない。",
      "- analysis_system_codeが空の場合、勝手に要確認へ落として成功扱いしない。",
      "- AIのfields、visible_field_labels、warningsを画面側で生成・補完・上書きしない。"
    ]
  );

  appendSection(
    lines,
    "専門解析先マスタ",
    [
      "- invoice_payable：請求・未払",
      "- receipt_evidence：領収・レシート",
      "- tax_public：税金・公的",
      "- card_statement：カード・決済",
      "- utility_communication：公共・通信",
      "- contract_insurance_lease：契約・保険・リース",
      "- delivery_note：納品書・補助",
      "- needs_review：要確認・その他",
      "",
      "- DBのpayment_document_specialist_analyses.specialist_analysis_codeを正とする。",
      "- *_analysis形式とマスタコード形式を混在させない。",
      "- API、AI返却、保存、画面、DBマスタのコード形式を統一する。"
    ]
  );

  appendSection(
    lines,
    "Stage1・Stage2 現在の確定内容",
    [
      "- 今完成させるのはStage2までとする。",
      "- Stage3は各専門解析で専門項目を解析する。現在のStage1・Stage2修正ではStage3へ触らない。",
      "- Stage1は共通仕分けだけを行う。",
      "- Stage1では、会社、文書種別、処理先、会計区分、専門解析先、analysis_system_code、信頼度、判定理由、要確認を返す。",
      "- 証憑種別は取込データ種類からシステムが保持する情報を使用し、AIやJavaScriptで推測しない。",
      "- Stage1の会社、文書種別、処理先、会計区分、専門解析先は、DBマスタ候補を提示されたAIだけが決定する。",
      "- Node.jsはDBマスタ候補の提示、返却スキーマ・型・候補内コードの検証、保存だけを行う。",
      "- Node.js、SQL、HTML、固定値、キーワード判定、既定値、後付け補正でAIの分類を変更しない。",
      "- analysis_system_codeを専門解析先の正規キーとし、返却後に別コードへ変換しない。",
      "- Stage2はOCR本文から基本10項目だけを抽出する。",
      "- Stage2基本10項目は、document_number、reference_number、issuer_name、issuer_registration_number、issuer_postal_code、issuer_address、issuer_phone、recipient_name、recipient_code、document_dateとする。",
      "- Stage2では金額、税額、支払期限、支払日、支払方法、明細、契約内容、専門項目を解析しない。",
      "- Stage2はStage1の仕分け結果を変更・再判定しない。",
      "- normalize処理とStage1・Stage2結合処理で、AIが返したanalysis_system_code、信頼度、判定理由、要確認を消去・補完・上書きしない。",
      "- AI返却値、画面表示値、DB保存値の3つが一致することを確認する。",
      "- AI解析成功とDB保存成功を別々に確認し、表示項目数だけで成功判定しない。"
    ]
  );

  appendSection(
    lines,
    "専門解析",
    [
      "- 専門解析はStage3 specialistだけを実行する。",
      "- 専門解析結果のdraft、fields、visible_field_labels、warningsを保存する。",
      "- 共通保存APIは /api/payment-documents/specialist-analysis-results/save。",
      "- payment_document_sorting_drafts.latest_specialist_analysis_idを更新する。",
      "- 人間修正時は画面で保持しているanalysis_system_codeを使用する。",
      "- 保存時に専門AI結果を固定フォーム項目だけへ丸め込まない。"
    ]
  );

  appendSection(
    lines,
    "画面修正ルール",
    [
      "- 表示後JavaScriptでDOMを移動して帳尻を合わせない。",
      "- appendChild、insertBefore、unwrapElement等の後付け配置を増やさない。",
      "- 初期HTML生成またはrenderForm等の正規生成箇所を修正する。",
      "- CSSのマイナスmargin、transform、position、overflow:hiddenで根本問題を隠さない。",
      "- 画面画像だけで親子構造を断定せず、DOMツリーと生成コードを確認する。",
      "- AI候補を画面JavaScriptで固定化・補完・上書きしない。"
    ]
  );

  appendSection(
    lines,
    "Git・起動ルール",
    [
      "- GitHubのorigin/mainをソースの正とする。",
      "- 初期起動時はcommit・pushを行わない。",
      "- 現地PCの不要な未コミット変更とローカルのみのコミットは破棄してよい。",
      "- 起動時はfetch後にorigin/mainへ完全一致させる。",
      "- 秘密情報やGit管理外のPC固有設定は削除対象にしない。",
      "- GitUpは定められた再起動処理内だけで扱う。",
      "- サーバー再起動はユーザーが実施する。"
    ]
  );

  appendSection(
    lines,
    "復活禁止",
    [
      "- 旧『共通1個＋専門5個＝合計6個』設計を復活させない。",
      "- 旧『これから根本設計』という説明を復活させない。",
      "- 専門解析ボタンでStage1・Stage2を再実行しない。",
      "- 外部プロンプトファイル固定読込方式を正規入口として復活させない。",
      "- Web支払書類フローの原因説明にAccessを持ち出さない。"
    ]
  );

  appendSection(
    lines,
    "生成情報",
    [
      `生成日時: ${new Date().toLocaleString(
        "ja-JP",
        {
          timeZone: "Asia/Tokyo"
        }
      )}`,
      `PC名: ${os.hostname()}`,
      `OS: ${os.platform()} ${os.release()} ${os.arch()}`,
      `Node.js: ${process.version}`,
      `作業ディレクトリ: ${process.cwd()}`
    ]
  );

  appendSection(
    lines,
    "起動時確定パス",
    [
      `RUNTIME_PATHS_FILE: ${runtime.filePath}`,
      "-----------------------------------",
      ...runtime.lines,
      "-----------------------------------"
    ]
  );

  appendSection(
    lines,
    "主要確定値",
    [
      `PROJECT_ROOT: ${
        runtimeValues.PROJECT_ROOT ||
        projectRoot
      }`,
      `WEB_DIR: ${
        runtimeValues.WEB_DIR ||
        webDir
      }`,
      `HD_ORIGIN_ENV_PATH: ${maskSecret(
        "HD_ORIGIN_ENV_PATH",
        runtimeValues.HD_ORIGIN_ENV_PATH || ""
      )}`,
      `DB_HOST: ${runtimeValues.DB_HOST || ""}`,
      `DB_PORT: ${runtimeValues.DB_PORT || ""}`,
      `DB_NAME: ${runtimeValues.DB_NAME || ""}`,
      `DB_USER: ${runtimeValues.DB_USER || ""}`,
      "DB_PASSWORD: ********",
      `PG_BIN_PATH: ${runtimeValues.PG_BIN_PATH || ""}`,
      `BACKUP_DIR: ${runtimeValues.BACKUP_DIR || ""}`,
      `NODE_PATH: ${runtimeValues.NODE_PATH || ""}`,
      `NPM_PATH: ${runtimeValues.NPM_PATH || ""}`
    ]
  );

  appendSection(
    lines,
    "重要ファイル存在確認",
    importantFiles.map(
      (file) =>
        `${fileExistsText(file)} : ${file}`
    )
  );

  appendSection(
    lines,
    "プロジェクトツリー",
    [
      "-----------------------------------",
      ...buildTree(projectRoot),
      "-----------------------------------"
    ]
  );

  fs.writeFileSync(
    outputPath,
    lines.join(os.EOL),
    "utf8"
  );

  console.log(
    `[PROJECT_STATUS] wrote: ${outputPath}`
  );

  return outputPath;
}

module.exports = {
  writeProjectStatus
};