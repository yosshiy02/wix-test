const fs = require("fs");

const target = process.argv[2];
const after = process.argv[3];

let text = fs.readFileSync(target, "utf8");
const original = text;

const oldBlockRegex = /await loadReceiptMasterOptions\(\);\s*const select = document\.getElementById\(def\.selectId\);\s*const row = data\.row \|\| data\.item \|\| \{\};\s*const newId = row\.id \|\| row\[def\.selectId\.replace\("Id", "_id"\)\];\s*if \(select && newId !== undefined && newId !== null && String\(newId\) !== ""\) \{\s*select\.value = String\(newId\);\s*\}\s*syncReceiptMasterCandidateName\(kind, true\);/m;

const newBlock = `await loadReceiptMasterOptions();

      const select = document.getElementById(def.selectId);
      const row = data.row || data.item || {};

      const idKeyByMasterType = {
        purposes: "purpose_id",
        projects: "project_id",
        departments: "department_id",
        vendors: "vendor_id",
        payment_methods: "payment_method_id",
        account_titles: "account_title_id",
        tax_categories: "tax_category_id",
        invoice_types: "invoice_type_id",
        evidence_types: "evidence_type_id"
      };

      const nameKeyByMasterType = {
        purposes: "purpose_name",
        projects: "project_name",
        departments: "department_name",
        vendors: "vendor_name",
        payment_methods: "payment_method_name",
        account_titles: "account_title_name",
        tax_categories: "tax_category_name",
        invoice_types: "invoice_type_name",
        evidence_types: "evidence_type_name"
      };

      const idKeys = [
        idKeyByMasterType[def.masterType],
        "id",
        def.idKey,
        def.valueKey,
        "master_id"
      ].filter(Boolean);

      const nameKeys = [
        nameKeyByMasterType[def.masterType],
        "name",
        def.nameKey,
        def.labelKey,
        "master_name"
      ].filter(Boolean);

      const pickFirstValue = (obj, keys) => {
        for (const key of keys) {
          if (obj && obj[key] !== undefined && obj[key] !== null && String(obj[key]) !== "") {
            return obj[key];
          }
        }
        return "";
      };

      const newId = pickFirstValue(row, idKeys);
      const newName = String(pickFirstValue(row, nameKeys) || name || "").trim();

      if (select && newId !== undefined && newId !== null && String(newId) !== "") {
        let option = Array.from(select.options || []).find((item) => {
          return String(item.value) === String(newId);
        });

        if (!option) {
          option = new Option(newName || String(newId), String(newId));
          select.add(option);
        } else if (newName) {
          option.textContent = newName;
        }

        select.value = String(newId);
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }

      syncReceiptMasterCandidateName(kind, true);`;

if (!oldBlockRegex.test(text)) {
  throw new Error("登録後の画面反映ブロックが見つかりません。");
}

text = text.replace(oldBlockRegex, newBlock);

if (text === original) {
  throw new Error("変更が入りませんでした。");
}

fs.writeFileSync(after, text, "utf8");
