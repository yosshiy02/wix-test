const path = require("path");
const fs = require("fs");

const projectRoot = process.argv[2];
const resultPath = process.argv[3];

const webDir = path.join(projectRoot, "web_receiver");
process.chdir(webDir);

const repo = require(path.join(webDir, "src", "expenses", "expenses.repository.js"));
const db = require(path.join(webDir, "src", "db"));

async function main() {
  const masters = await repo.getMasters();

  const keys = [
    "account_titles",
    "payment_methods",
    "tax_categories",
    "vendors",
    "target_people",
    "purposes",
    "projects",
    "departments",
    "contract_insurance_lease_kinds",
    "insurance_types",
    "lease_item_categories",
    "contract_types",
    "contract_statuses",
    "payment_statuses",
    "payment_cycles",
    "company_burden_types",
    "personal_mix_flags",
    "payable_registration_types",
    "accounts_payable_registration_types",
    "auto_renewal_types",
    "ownership_transfer_types",
    "early_cancellation_types"
  ];

  const out = [];
  out.push("==============================");
  out.push("GPT2 /api/expenses/masters 直接反映確認");
  out.push("==============================");
  out.push("日時: " + new Date().toISOString());
  out.push("");

  for (const key of keys) {
    const value = masters[key];
    out.push(`${key}: ${Array.isArray(value) ? value.length : "[なし]"}`);
  }

  fs.writeFileSync(resultPath, out.join("\r\n"), "utf8");
  await db.end();
}

main().catch(async err => {
  fs.writeFileSync(resultPath, String(err && err.stack ? err.stack : err), "utf8");
  try { await db.end(); } catch {}
  process.exit(1);
});