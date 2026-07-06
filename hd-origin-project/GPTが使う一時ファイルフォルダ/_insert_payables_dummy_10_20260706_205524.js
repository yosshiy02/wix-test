const path = require("path");
const projectRoot = process.argv[2];
const batchTag = process.argv[3];
process.chdir(path.join(projectRoot, "web_receiver"));
require(path.join(projectRoot, "web_receiver", "src", "config"));
const repo = require(path.join(projectRoot, "web_receiver", "src", "payables", "payables.repository"));
const db = require(path.join(projectRoot, "web_receiver", "src", "db"));
const { createBackup } = require(path.join(projectRoot, "web_receiver", "src", "backups", "backup.service"));
async function query(sql, params) {
  if (db && typeof db.query === "function") return db.query(sql, params);
  if (db && db.pool && typeof db.pool.query === "function") return db.pool.query(sql, params);
  throw new Error("db.query が見つかりません。");
}
async function closeDb() {
  if (db && db.pool && typeof db.pool.end === "function") {
    await db.pool.end();
    return;
  }
  if (db && typeof db.end === "function") {
    await db.end();
  }
}
function dateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function line(itemName, description, amountExTax, taxRate, memo) {
  const taxAmount = Math.floor(Number(amountExTax || 0) * Number(taxRate || 0) / 100);
  return {
    account_title_id: null,
    tax_category_id: null,
    item_name: itemName,
    description,
    quantity: 1,
    unit_price: amountExTax,
    amount_ex_tax: amountExTax,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    amount_in_tax: Number(amountExTax) + taxAmount,
    target_person_id: null,
    purpose_id: null,
    project_id: null,
    department_id: null,
    memo: memo || ""
  };
}
function doc(base) {
  return {
    document_type: base.document_type || "invoice",
    payable_kind: base.payable_kind || "unpaid",
    status: base.status || "confirmed",
    vendor_name: base.vendor_name,
    invoice_number: base.invoice_number || "",
    supplier_document_no: base.supplier_document_no || "",
    document_date: base.document_date,
    posting_date: base.posting_date || base.document_date,
    due_date: base.due_date,
    payment_plan_date: base.payment_plan_date || base.due_date,
    currency_code: "JPY",
    summary: base.summary || "",
    memo: base.memo || "",
    internal_note: "ダミーデータ。動作確認用。削除可能。",
    evidence_type: base.evidence_type || "ダミー",
    evidence_file_name: "",
    evidence_file_path: "",
    source_memo: batchTag,
    journal_status: "not_created",
    created_by: "dummy",
    updated_by: "dummy"
  };
}
const samples = [
  {
    document: doc({
      payable_kind: "accounts_payable",
      status: "confirmed",
      vendor_name: "ダミー材料商事株式会社",
      invoice_number: "DUMMY-MAT-001",
      document_date: dateOffset(-20),
      due_date: dateOffset(10),
      summary: "ダミー 革材料仕入"
    }),
    lines: [
      line("革材料", "婦人靴用 革材料 ダミー", 50000, 10, "材料仕入テスト"),
      line("副資材", "芯材・接着材 ダミー", 12000, 10, "")
    ],
    payments: []
  },
  {
    document: doc({
      payable_kind: "accounts_payable",
      status: "confirmed",
      vendor_name: "ダミー箱資材株式会社",
      invoice_number: "DUMMY-BOX-002",
      document_date: dateOffset(-12),
      due_date: dateOffset(18),
      summary: "ダミー 靴箱・包装資材"
    }),
    lines: [
      line("靴箱", "靴箱 300枚 ダミー", 24000, 10, ""),
      line("包装紙", "包装紙 ダミー", 8000, 10, "")
    ],
    payments: []
  },
  {
    document: doc({
      payable_kind: "unpaid",
      status: "confirmed",
      vendor_name: "ダミー運送株式会社",
      invoice_number: "DUMMY-SHIP-003",
      document_date: dateOffset(-40),
      due_date: dateOffset(-5),
      summary: "ダミー 運送料 期限超過テスト"
    }),
    lines: [
      line("運送料", "出荷運賃 ダミー", 18000, 10, "期限超過表示テスト")
    ],
    payments: []
  },
  {
    document: doc({
      payable_kind: "unpaid",
      status: "confirmed",
      vendor_name: "ダミーWix利用料",
      invoice_number: "DUMMY-WIX-004",
      document_date: dateOffset(-15),
      due_date: dateOffset(-1),
      summary: "ダミー Wix月額利用料"
    }),
    lines: [
      line("システム利用料", "Wix利用料 ダミー", 5000, 10, "")
    ],
    payments: [
      { payment_date: dateOffset(-1), payment_amount: 5500, memo: "全額支払ダミー" }
    ]
  },
  {
    document: doc({
      payable_kind: "unpaid",
      status: "confirmed",
      vendor_name: "ダミー税理士事務所",
      invoice_number: "DUMMY-TAX-005",
      document_date: dateOffset(-10),
      due_date: dateOffset(5),
      summary: "ダミー 顧問料 一部支払テスト"
    }),
    lines: [
      line("税理士報酬", "月次顧問料 ダミー", 30000, 10, "")
    ],
    payments: [
      { payment_date: dateOffset(-2), payment_amount: 11000, memo: "一部支払ダミー" }
    ]
  },
  {
    document: doc({
      payable_kind: "accounts_payable",
      status: "draft",
      vendor_name: "ダミー外注加工所",
      invoice_number: "DUMMY-OUT-006",
      document_date: dateOffset(-3),
      due_date: dateOffset(25),
      summary: "ダミー 外注加工費 下書き"
    }),
    lines: [
      line("外注加工費", "底付け加工 ダミー", 42000, 10, "")
    ],
    payments: []
  },
  {
    document: doc({
      payable_kind: "card_payable",
      status: "confirmed",
      vendor_name: "ダミークレジットカード",
      invoice_number: "DUMMY-CARD-007",
      document_date: dateOffset(-7),
      due_date: dateOffset(20),
      summary: "ダミー カード未払"
    }),
    lines: [
      line("消耗品", "事務用品カード利用 ダミー", 7500, 10, ""),
      line("広告宣伝費", "SNS広告カード利用 ダミー", 15000, 10, "")
    ],
    payments: []
  },
  {
    document: doc({
      payable_kind: "accrued_expense",
      status: "confirmed",
      vendor_name: "ダミー不動産管理",
      invoice_number: "DUMMY-RENT-008",
      document_date: dateOffset(-1),
      due_date: dateOffset(14),
      summary: "ダミー 家賃・管理費"
    }),
    lines: [
      line("地代家賃", "事務所家賃 ダミー", 100000, 10, ""),
      line("管理費", "共益費 ダミー", 15000, 10, "")
    ],
    payments: []
  },
  {
    document: doc({
      payable_kind: "unpaid",
      status: "confirmed",
      vendor_name: "ダミー電力株式会社",
      invoice_number: "DUMMY-ELEC-009",
      document_date: dateOffset(-6),
      due_date: dateOffset(7),
      summary: "ダミー 電気代"
    }),
    lines: [
      line("水道光熱費", "工場電気代 ダミー", 36000, 10, "")
    ],
    payments: []
  },
  {
    document: doc({
      payable_kind: "other",
      document_type: "other",
      status: "confirmed",
      vendor_name: "ダミー備品販売",
      invoice_number: "DUMMY-EQP-010",
      document_date: dateOffset(-2),
      due_date: dateOffset(30),
      summary: "ダミー 備品購入"
    }),
    lines: [
      line("工具器具備品", "棚・収納用品 ダミー", 28000, 10, ""),
      line("消耗品", "ラベル・文具 ダミー", 6000, 10, "")
    ],
    payments: []
  }
];
async function main() {
  const backup = await createBackup("before_payables_dummy_insert_" + new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14));
  const inserted = [];
  for (const sample of samples) {
    const saved = await repo.savePayable({
      document: sample.document,
      lines: sample.lines
    });
    inserted.push({
      payable_id: saved.payable_id,
      payable_no: saved.payable_no,
      vendor_name: sample.document.vendor_name,
      summary: sample.document.summary
    });
    for (const payment of sample.payments || []) {
      await repo.addPayment(saved.payable_id, {
        payment_date: payment.payment_date,
        payment_method_id: null,
        payment_amount: payment.payment_amount,
        bank_fee_amount: 0,
        withholding_tax_amount: 0,
        memo: payment.memo || "ダミー支払",
        journal_status: "not_created"
      });
    }
  }
  const countResult = await query(`
    SELECT
      COUNT(*)::INTEGER AS count,
      COALESCE(SUM(total_amount), 0)::NUMERIC(14,2) AS total_amount,
      COALESCE(SUM(paid_amount), 0)::NUMERIC(14,2) AS paid_amount,
      COALESCE(SUM(balance_amount), 0)::NUMERIC(14,2) AS balance_amount
    FROM accounting.payable_documents
    WHERE source_memo = $1
      AND deleted_at IS NULL
  `, [batchTag]);
  const listResult = await query(`
    SELECT
      payable_id,
      payable_no,
      vendor_name,
      status,
      total_amount,
      paid_amount,
      balance_amount,
      due_date,
      source_memo
    FROM accounting.payable_documents
    WHERE source_memo = $1
      AND deleted_at IS NULL
    ORDER BY payable_id
  `, [batchTag]);
  console.log(JSON.stringify({
    ok: true,
    batchTag,
    backup,
    inserted,
    summary: countResult.rows[0],
    rows: listResult.rows
  }, null, 2));
}
main()
  .catch(error => {
    console.error(error.stack || error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });