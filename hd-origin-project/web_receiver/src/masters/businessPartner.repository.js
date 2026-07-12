"use strict";

const pool = require("../db");

const DEFINITIONS = {
  customer: {
    table: "expenses.customers",
    idColumn: "customer_id",
    codeColumn: "customer_code",
    nameColumn: "customer_name",
    columns: [
      "customer_code",
      "customer_name",
      "customer_name_kana",
      "customer_type",
      "corporate_number",
      "invoice_registration_number",
      "postal_code",
      "address",
      "phone",
      "fax",
      "email",
      "contact_person",
      "closing_day",
      "payment_day",
      "payment_terms",
      "invoice_delivery_method",
      "is_active",
      "sort_order",
      "note"
    ]
  },

  vendor: {
    table: "expenses.vendors",
    idColumn: "vendor_id",
    codeColumn: "vendor_code",
    nameColumn: "vendor_name",
    columns: [
      "vendor_code",
      "vendor_name",
      "vendor_name_kana",
      "vendor_type",
      "corporate_number",
      "invoice_registration_number",
      "postal_code",
      "address",
      "phone",
      "fax",
      "email",
      "contact_person",
      "closing_day",
      "payment_day",
      "payment_terms",
      "is_active",
      "sort_order",
      "note"
    ],
    bankColumns: [
      "bank_name",
      "branch_name",
      "account_type",
      "account_number",
      "account_holder"
    ]
  }
};

function getDefinition(type) {
  const definition = DEFINITIONS[String(type || "").toLowerCase()];

  if (!definition) {
    const error = new Error("得意先・取引先区分が不正です。");
    error.statusCode = 400;
    throw error;
  }

  return definition;
}

function quoteIdent(value) {
  return '"' + String(value).replace(/"/g, '""') + '"';
}

function quoteTable(value) {
  return String(value)
    .split(".")
    .map(quoteIdent)
    .join(".");
}

function cleanText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function cleanNullable(value) {
  const text = cleanText(value);
  return text || null;
}

function cleanBoolean(value, defaultValue = true) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (
    value === true ||
    value === 1 ||
    String(value).toLowerCase() === "true" ||
    String(value) === "有効"
  ) {
    return true;
  }

  if (
    value === false ||
    value === 0 ||
    String(value).toLowerCase() === "false" ||
    String(value) === "無効"
  ) {
    return false;
  }

  return defaultValue;
}

function normalizeRow(type, source, blankMode = "preserve") {
  const definition = getDefinition(type);
  const data = {};

  for (const column of definition.columns) {
    if (column === "is_active") {
      if (source[column] !== undefined || blankMode === "clear") {
        data[column] = cleanBoolean(source[column], true);
      }

      continue;
    }

    if (column === "sort_order") {
      if (source[column] !== undefined || blankMode === "clear") {
        data[column] = Number(source[column] || 0);
      }

      continue;
    }

    if (source[column] !== undefined) {
      data[column] = cleanNullable(source[column]);
    } else if (blankMode === "clear") {
      data[column] = null;
    }
  }

  if (type === "vendor") {
    data.bank = {};

    for (const column of definition.bankColumns) {
      if (source[column] !== undefined) {
        data.bank[column] = cleanNullable(source[column]);
      } else if (blankMode === "clear") {
        data.bank[column] = null;
      }
    }
  }

  return data;
}

function validateNormalized(type, row, rowNumber) {
  const definition = getDefinition(type);
  const errors = [];

  const code = cleanText(row[definition.codeColumn]);
  const name = cleanText(row[definition.nameColumn]);

  if (!code) {
    errors.push({
      code: "CODE_REQUIRED",
      message: `${rowNumber}行目：コードが未入力です。`
    });
  }

  if (!name) {
    errors.push({
      code: "NAME_REQUIRED",
      message: `${rowNumber}行目：名称が未入力です。`
    });
  }

  const corporateNumber = cleanText(row.corporate_number);

  if (corporateNumber && !/^\d{13}$/.test(corporateNumber)) {
    errors.push({
      code: "CORPORATE_NUMBER_INVALID",
      message: `${rowNumber}行目：法人番号は13桁の数字で入力してください。`
    });
  }

  const invoiceNumber = cleanText(row.invoice_registration_number);

  if (invoiceNumber && !/^T\d{13}$/i.test(invoiceNumber)) {
    errors.push({
      code: "INVOICE_NUMBER_INVALID",
      message: `${rowNumber}行目：インボイス登録番号はT＋13桁で入力してください。`
    });
  }

  return errors;
}

async function findExisting(client, type, normalized) {
  const definition = getDefinition(type);
  const table = quoteTable(definition.table);

  const code = cleanText(normalized[definition.codeColumn]);
  const corporateNumber = cleanText(normalized.corporate_number);
  const invoiceNumber = cleanText(normalized.invoice_registration_number);

  const result = await client.query(
    `
    SELECT *
    FROM ${table}
    WHERE
      LOWER(COALESCE(${quoteIdent(definition.codeColumn)}, '')) = LOWER($1)
      OR (
        NULLIF($2, '') IS NOT NULL
        AND corporate_number = $2
      )
      OR (
        NULLIF($3, '') IS NOT NULL
        AND UPPER(invoice_registration_number) = UPPER($3)
      )
    ORDER BY
      CASE
        WHEN LOWER(COALESCE(${quoteIdent(definition.codeColumn)}, '')) =
             LOWER($1)
        THEN 0
        WHEN corporate_number = $2 THEN 1
        ELSE 2
      END,
      ${quoteIdent(definition.idColumn)}
    LIMIT 2
    `,
    [code, corporateNumber, invoiceNumber]
  );

  return result.rows;
}

async function listPartners(type) {
  const definition = getDefinition(type);
  const table = quoteTable(definition.table);

  const result = await pool.query(
    `
    SELECT *
    FROM ${table}
    ORDER BY
      is_active DESC,
      sort_order,
      ${quoteIdent(definition.codeColumn)},
      ${quoteIdent(definition.idColumn)}
    `
  );

  if (type !== "vendor") {
    return result.rows;
  }

  const bankResult = await pool.query(
    `
    SELECT *
    FROM expenses.vendor_bank_accounts
    WHERE is_active = TRUE
    ORDER BY vendor_id, is_primary DESC, sort_order, vendor_bank_account_id
    `
  );

  const bankMap = new Map();

  for (const bank of bankResult.rows) {
    if (!bankMap.has(String(bank.vendor_id))) {
      bankMap.set(String(bank.vendor_id), bank);
    }
  }

  return result.rows.map(row => ({
    ...row,
    ...(bankMap.get(String(row.vendor_id)) || {})
  }));
}

async function insertPartner(client, type, normalized) {
  const definition = getDefinition(type);
  const table = quoteTable(definition.table);

  const data = {};

  for (const column of definition.columns) {
    if (normalized[column] !== undefined) {
      data[column] = normalized[column];
    }
  }

  const columns = Object.keys(data);
  const values = columns.map(column => data[column]);
  const placeholders = values.map((_, index) => `$${index + 1}`);

  const result = await client.query(
    `
    INSERT INTO ${table}
      (${columns.map(quoteIdent).join(", ")})
    VALUES
      (${placeholders.join(", ")})
    RETURNING *
    `,
    values
  );

  const row = result.rows[0];

  if (type === "vendor") {
    await saveVendorBankAccount(client, row.vendor_id, normalized.bank || {});
  }

  return row;
}

async function updatePartner(client, type, id, normalized, blankMode) {
  const definition = getDefinition(type);
  const table = quoteTable(definition.table);
  const data = {};

  for (const column of definition.columns) {
    if (normalized[column] !== undefined) {
      data[column] = normalized[column];
    }
  }

  data.updated_at = new Date();

  const columns = Object.keys(data);
  const values = columns.map(column => data[column]);
  const sets = columns.map(
    (column, index) => `${quoteIdent(column)} = $${index + 1}`
  );

  values.push(id);

  const result = await client.query(
    `
    UPDATE ${table}
    SET ${sets.join(", ")}
    WHERE ${quoteIdent(definition.idColumn)} = $${values.length}
    RETURNING *
    `,
    values
  );

  if (!result.rows[0]) {
    const error = new Error("更新対象が見つかりません。");
    error.statusCode = 404;
    throw error;
  }

  if (type === "vendor") {
    await saveVendorBankAccount(
      client,
      id,
      normalized.bank || {},
      blankMode
    );
  }

  return result.rows[0];
}

async function saveVendorBankAccount(
  client,
  vendorId,
  bank,
  blankMode = "preserve"
) {
  const hasAnyValue = Object.values(bank || {}).some(
    value => cleanText(value) !== ""
  );

  if (!hasAnyValue && blankMode !== "clear") {
    return;
  }

  const existing = await client.query(
    `
    SELECT vendor_bank_account_id
    FROM expenses.vendor_bank_accounts
    WHERE vendor_id = $1
      AND is_primary = TRUE
    ORDER BY vendor_bank_account_id
    LIMIT 1
    `,
    [vendorId]
  );

  const values = [
    cleanText(bank.bank_name),
    cleanText(bank.branch_name),
    cleanText(bank.account_type),
    cleanText(bank.account_number),
    cleanText(bank.account_holder)
  ];

  if (existing.rows[0]) {
    await client.query(
      `
      UPDATE expenses.vendor_bank_accounts
      SET
        bank_name = $1,
        branch_name = $2,
        account_type = $3,
        account_number = $4,
        account_holder = $5,
        is_active = TRUE,
        updated_at = NOW()
      WHERE vendor_bank_account_id = $6
      `,
      [...values, existing.rows[0].vendor_bank_account_id]
    );

    return;
  }

  await client.query(
    `
    INSERT INTO expenses.vendor_bank_accounts (
      vendor_id,
      bank_name,
      branch_name,
      account_type,
      account_number,
      account_holder,
      is_primary,
      is_active
    )
    VALUES ($1, $2, $3, $4, $5, $6, TRUE, TRUE)
    `,
    [vendorId, ...values]
  );
}

async function saveSingle(type, payload) {
  const definition = getDefinition(type);
  const blankMode = payload.blank_mode === "clear" ? "clear" : "preserve";
  const normalized = normalizeRow(type, payload, blankMode);
  const errors = validateNormalized(type, normalized, 1);

  if (errors.length) {
    const error = new Error(errors[0].message);
    error.statusCode = 400;
    error.details = errors;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let row;

    if (payload.id) {
      row = await updatePartner(
        client,
        type,
        Number(payload.id),
        normalized,
        blankMode
      );
    } else {
      const matches = await findExisting(client, type, normalized);

      if (matches.length > 0) {
        const error = new Error("同じコード・法人番号・インボイス番号の登録があります。");
        error.statusCode = 409;
        throw error;
      }

      row = await insertPartner(client, type, normalized);
    }

    await client.query("COMMIT");
    return row;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function disablePartner(type, id) {
  const definition = getDefinition(type);
  const table = quoteTable(definition.table);

  const result = await pool.query(
    `
    UPDATE ${table}
    SET is_active = FALSE,
        updated_at = NOW()
    WHERE ${quoteIdent(definition.idColumn)} = $1
    RETURNING *
    `,
    [id]
  );

  if (!result.rows[0]) {
    const error = new Error("対象データが見つかりません。");
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
}

async function importPartners(type, payload) {
  const definition = getDefinition(type);
  const rows = Array.isArray(payload.rows) ? payload.rows : [];

  const importMode = [
    "validate",
    "insert_only",
    "upsert"
  ].includes(payload.import_mode)
    ? payload.import_mode
    : "validate";

  const blankMode =
    payload.blank_mode === "clear"
      ? "clear"
      : "preserve";

  if (!rows.length) {
    const error = new Error("取込データがありません。");
    error.statusCode = 400;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const batchResult = await client.query(
      `
      INSERT INTO expenses.business_partner_import_batches (
        partner_type,
        import_mode,
        blank_mode,
        file_name,
        total_count,
        requested_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
      `,
      [
        type,
        importMode,
        blankMode,
        cleanText(payload.file_name),
        rows.length,
        cleanText(payload.requested_by)
      ]
    );

    const batch = batchResult.rows[0];
    const results = [];

    let insertCount = 0;
    let updateCount = 0;
    let unchangedCount = 0;
    let errorCount = 0;

    const seenCodes = new Set();

    for (let index = 0; index < rows.length; index += 1) {
      const rowNumber = index + 2;
      const source = rows[index] || {};
      const normalized = normalizeRow(type, source, blankMode);
      const code = cleanText(normalized[definition.codeColumn]).toLowerCase();

      const validationErrors = validateNormalized(
        type,
        normalized,
        rowNumber
      );

      if (code && seenCodes.has(code)) {
        validationErrors.push({
          code: "DUPLICATE_IN_FILE",
          message: `${rowNumber}行目：CSV内でコードが重複しています。`
        });
      }

      if (code) {
        seenCodes.add(code);
      }

      let actionType = "error";
      let matchedId = null;
      let errorCode = null;
      let errorMessage = null;

      if (!validationErrors.length) {
        const matches = await findExisting(client, type, normalized);

        if (matches.length > 1) {
          validationErrors.push({
            code: "MULTIPLE_MATCHES",
            message: `${rowNumber}行目：複数の既存データに一致しました。`
          });
        } else if (matches.length === 1) {
          matchedId = matches[0][definition.idColumn];

          if (importMode === "insert_only") {
            validationErrors.push({
              code: "EXISTING_NOT_ALLOWED",
              message: `${rowNumber}行目：追加のみモードですが既存データがあります。`
            });
          } else {
            actionType =
              importMode === "validate"
                ? "update"
                : "update";
          }
        } else {
          actionType = "insert";
        }
      }

      if (validationErrors.length) {
        actionType = "error";
        errorCode = validationErrors[0].code;
        errorMessage = validationErrors
          .map(item => item.message)
          .join(" / ");

        errorCount += 1;
      } else if (actionType === "insert") {
        insertCount += 1;
      } else if (actionType === "update") {
        updateCount += 1;
      } else {
        unchangedCount += 1;
      }

      await client.query(
        `
        INSERT INTO expenses.business_partner_import_rows (
          import_batch_id,
          row_number,
          action_type,
          matched_id,
          program_code,
          display_name,
          is_valid,
          error_code,
          error_message,
          source_data,
          normalized_data
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10::jsonb, $11::jsonb
        )
        `,
        [
          batch.import_batch_id,
          rowNumber,
          actionType,
          matchedId,
          cleanText(normalized[definition.codeColumn]),
          cleanText(normalized[definition.nameColumn]),
          validationErrors.length === 0,
          errorCode,
          errorMessage,
          JSON.stringify(source),
          JSON.stringify(normalized)
        ]
      );

      results.push({
        row_number: rowNumber,
        action_type: actionType,
        matched_id: matchedId,
        program_code: cleanText(normalized[definition.codeColumn]),
        display_name: cleanText(normalized[definition.nameColumn]),
        valid: validationErrors.length === 0,
        errors: validationErrors
      });
    }

    if (errorCount > 0 && importMode !== "validate") {
      const error = new Error(
        `CSVに${errorCount}件のエラーがあるため、全件をロールバックしました。`
      );

      error.statusCode = 400;
      error.importResults = results;
      throw error;
    }

    if (importMode !== "validate") {
      for (const result of results) {
        if (!result.valid) {
          continue;
        }

        const source = rows[result.row_number - 2];
        const normalized = normalizeRow(type, source, blankMode);

        if (result.action_type === "insert") {
          await insertPartner(client, type, normalized);
        } else if (result.action_type === "update") {
          await updatePartner(
            client,
            type,
            result.matched_id,
            normalized,
            blankMode
          );
        }
      }
    }

    await client.query(
      `
      UPDATE expenses.business_partner_import_batches
      SET
        insert_count = $2,
        update_count = $3,
        unchanged_count = $4,
        error_count = $5,
        status = $6,
        completed_at = NOW()
      WHERE import_batch_id = $1
      `,
      [
        batch.import_batch_id,
        insertCount,
        updateCount,
        unchangedCount,
        errorCount,
        importMode === "validate" ? "validated" : "completed"
      ]
    );

    await client.query("COMMIT");

    return {
      import_batch_id: batch.import_batch_id,
      partner_type: type,
      import_mode: importMode,
      blank_mode: blankMode,
      total_count: rows.length,
      insert_count: insertCount,
      update_count: updateCount,
      unchanged_count: unchangedCount,
      error_count: errorCount,
      committed: importMode !== "validate",
      rows: results
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listPartners,
  saveSingle,
  disablePartner,
  importPartners
};
