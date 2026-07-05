const pool = require("../db");

/* RECEIPT_HIDE_SAVED_IMPORTS_20260705_START */
async function listImports(limit = 100, offset = 0, options = {}) {
  const safeLimit = Math.min(Number(limit) || 100, 500);
  const safeOffset = Number(offset) || 0;

  const includeSaved = !!(
    options &&
    (
      options.includeSaved === true ||
      options.include_saved === true ||
      options.includeSaved === "1" ||
      options.include_saved === "1"
    )
  );

  const savedStatuses = [
    "本保存済み",
    "saved",
    "posted",
    "completed"
  ];

  const params = [];
  let whereSql = "";

  if (!includeSaved) {
    params.push(savedStatuses);
    whereSql = "WHERE NOT (COALESCE(status, '') = ANY($1::text[]))";
  }

  params.push(safeLimit);
  params.push(safeOffset);

  const limitIndex = params.length - 1;
  const offsetIndex = params.length;

  const result = await pool.query(
    `
    SELECT *
    FROM accounting.receipt_imports
    ${whereSql}
    ORDER BY imported_at_jst DESC NULLS LAST, id DESC
    LIMIT $${limitIndex}
    OFFSET $${offsetIndex}
    `,
    params
  );

  return result.rows;
}
/* RECEIPT_HIDE_SAVED_IMPORTS_20260705_END */

async function getImportById(id) {
  const result = await pool.query(
    `
    SELECT
      id,
      upload_id,
      wix_item_id,
      wix_image_url,
      local_image_file_name,
      local_image_path,
      image_hash_sha256,
      image_size_bytes,
      original_file_name,
      captured_at_jst,
      imported_at_jst,
      import_batch_id,
      ocr_provider,
      ocr_raw_text,
      ocr_line_count,
      ocr_word_count,
      status,
      created_at,
      updated_at
    FROM accounting.receipt_imports
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}


function normalizeReceiptTaxCategory(row) {
  const raw = String(
    row.taxCategoryName ||
    row.tax_category_name ||
    row.taxRate ||
    row.tax_rate ||
    ""
  ).trim();

  if (raw.includes("軽減") || raw.includes("8")) {
    return {
      taxCategoryId: 2,
      taxCategoryName: "軽減8%",
      taxRate: "0.08"
    };
  }

  if (raw.includes("非課税")) {
    return {
      taxCategoryId: 3,
      taxCategoryName: "非課税",
      taxRate: "0"
    };
  }

  if (raw.includes("不課税")) {
    return {
      taxCategoryId: 4,
      taxCategoryName: "不課税",
      taxRate: "0"
    };
  }

  if (raw.includes("対象外")) {
    return {
      taxCategoryId: 5,
      taxCategoryName: "対象外",
      taxRate: "0"
    };
  }

  if (raw.includes("10") || raw.includes("課税") || raw === "") {
    return {
      taxCategoryId: 1,
      taxCategoryName: "課税10%",
      taxRate: "0.10"
    };
  }

  return {
    taxCategoryId: null,
    taxCategoryName: raw,
    taxRate: ""
  };
}

function normalizeReceiptTaxTreatment(row) {
  const raw = String(
    row.taxTreatmentName ||
    row.tax_treatment_name ||
    ""
  ).trim();

  if (raw.includes("税抜") || raw.includes("外税")) {
    return {
      taxTreatmentId: 2,
      taxTreatmentName: "税抜・外税"
    };
  }

  if (raw.includes("非課税")) {
    return {
      taxTreatmentId: 3,
      taxTreatmentName: "非課税"
    };
  }

  if (raw.includes("不課税")) {
    return {
      taxTreatmentId: 4,
      taxTreatmentName: "不課税"
    };
  }

  if (raw.includes("免税")) {
    return {
      taxTreatmentId: 5,
      taxTreatmentName: "免税"
    };
  }

  if (raw.includes("対象外")) {
    return {
      taxTreatmentId: 6,
      taxTreatmentName: "対象外"
    };
  }

  if (raw.includes("不明")) {
    return {
      taxTreatmentId: 7,
      taxTreatmentName: "不明"
    };
  }

  return {
    taxTreatmentId: 1,
    taxTreatmentName: "税込・内税"
  };
}

function buildReceiptTaxBreakdownsFromDraft(draft) {
  const rawItems =
    Array.isArray(draft.taxBreakdowns) ? draft.taxBreakdowns :
    Array.isArray(draft.tax_breakdowns) ? draft.tax_breakdowns :
    draft.aiRawJson && Array.isArray(draft.aiRawJson.taxBreakdowns) ? draft.aiRawJson.taxBreakdowns :
    draft.ai_raw_json && Array.isArray(draft.ai_raw_json.taxBreakdowns) ? draft.ai_raw_json.taxBreakdowns :
    [];

  const sourceItems = rawItems.length > 0
    ? rawItems
    : [];
const rows = [];

  for (let i = 0; i < sourceItems.length; i++) {
    const item = sourceItems[i] || {};

    const category = normalizeReceiptTaxCategory(item);
    const treatment = normalizeReceiptTaxTreatment(item);

    const targetAmount =
      item.targetAmount ??
      item.target_amount ??
      item.taxableAmount ??
      item.taxable_amount ??
      item.amount ??
      "";

    const taxAmount =
      item.taxAmount ??
      item.tax_amount ??
      item.consumptionTaxAmount ??
      item.consumption_tax_amount ??
      "";

    const hasMeaning =
      category.taxCategoryId ||
      category.taxCategoryName ||
      treatment.taxTreatmentId ||
      String(targetAmount || "").trim() !== "" ||
      String(taxAmount || "").trim() !== "";

    if (!hasMeaning) {
      continue;
    }

    rows.push({
      taxCategoryId: category.taxCategoryId,
      taxCategoryName: category.taxCategoryName,
      taxRate: category.taxRate,
      taxTreatmentId: treatment.taxTreatmentId,
      taxTreatmentName: treatment.taxTreatmentName,
      targetAmount,
      taxAmount,
      aiConfidence: item.aiConfidence ?? item.ai_confidence ?? draft.confidence ?? null,
      isConfirmed: false,
      sortOrder: Number(item.sortOrder || item.sort_order || (i + 1) * 10)
    });
  }

  return rows;
}
async function createAiDraft(receiptImportId, draft) {
  const result = await pool.query(
    `
    INSERT INTO accounting.receipt_ai_drafts (
      receipt_import_id,
      transaction_date,
      vendor_name,
      vendor_address,
      vendor_phone,
      receipt_time_text,
      total_amount,
      tax_amount,
      tax_rate,
      tax_treatment_name,
      payment_method_name,
      purpose_id,
      purpose_temp_name,
      account_title_name,
      invoice_number,
      summary,
      memo,
      confidence,
      line_items,
      status,
      ai_model,
      ai_raw_json,
      error_message
    ) VALUES (
            $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11, $12, $13,
      $14, $15, $16, $17, $18, $19::jsonb,
      'draft', $20, $21::jsonb, ''
    )
    RETURNING *
    `,
    [
      receiptImportId,
      draft.transactionDate,
      draft.vendorName,
      draft.vendorAddress || "",
      draft.vendorPhone || "",
      draft.receiptTimeText || "",
      draft.totalAmount,
      draft.taxAmount,
      draft.taxRate,
      draft.taxTreatmentName || draft.tax_treatment_name || "",
      draft.paymentMethodName,
      draft.purposeId || draft.purpose_id || null,
      draft.purposeName || draft.purpose_name || "",
      draft.accountTitleName,
      draft.invoiceNumber,
      draft.summary,
      draft.memo,
      draft.confidence,
      JSON.stringify(draft.lineItems || []),
      draft.aiModel,
      JSON.stringify(draft.aiRawJson || {})
    ]
  );
  const savedDraft = result.rows[0];

  const aiTaxBreakdowns = buildReceiptTaxBreakdownsFromDraft(draft);

  if (aiTaxBreakdowns.length > 0) {
    await replaceReceiptTaxBreakdowns(Number(savedDraft.id), aiTaxBreakdowns);
  }

  return savedDraft;
}

async function getAiDrafts(receiptImportId) {
  const result = await pool.query(
    `
    SELECT *
    FROM accounting.receipt_ai_drafts
    WHERE receipt_import_id = $1
    ORDER BY id DESC
    `,
    [receiptImportId]
  );

  return result.rows;
}

async function updateAiDraft(id, patch) {
  const result = await pool.query(
    `
    UPDATE accounting.receipt_ai_drafts
    SET
      transaction_date = $2,
      vendor_name = $3,
      vendor_address = $4,
      vendor_phone = $5,
      receipt_time_text = $6,
      total_amount = $7,
      tax_amount = $8,
      tax_rate = $9,
      tax_treatment_name = $10,
      payment_method_id = $11,
      payment_method_name = $12,
      target_person_id = $13,
      purpose_id = $14,
      project_id = $15,
      department_id = $16,
      invoice_type_id = $17,
      evidence_type_id = $18,
      evidence_memo = $19,
      account_title_name = $20,
      invoice_number = $21,
      summary = $22,
      memo = $23,
      confidence = $24,
      line_items = $25::jsonb,
      status = $26,
      purpose_temp_name = $27,
      project_temp_name = $28,
      department_temp_name = $29,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
    `,
    [
      id,
      patch.transactionDate || null,
      patch.vendorName || "",
      patch.vendorAddress || patch.vendor_address || "",
      patch.vendorPhone || patch.vendor_phone || "",
      patch.receiptTimeText || patch.receipt_time_text || "",
      patch.totalAmount === "" || patch.totalAmount === undefined ? null : Number(patch.totalAmount),
      patch.taxAmount === "" || patch.taxAmount === undefined ? null : Number(patch.taxAmount),
      patch.taxRate || "",
      patch.taxTreatmentName || patch.tax_treatment_name || "",
      patch.paymentMethodId || patch.payment_method_id || null,
      patch.paymentMethodName || patch.payment_method_name || "",
      patch.targetPersonId || patch.target_person_id || null,
      patch.purposeId || patch.purpose_id || null,
      patch.projectId || patch.project_id || null,
      patch.departmentId || patch.department_id || null,
      patch.invoiceTypeId || patch.invoice_type_id || null,
      patch.evidenceTypeId || patch.evidence_type_id || null,
      patch.evidenceMemo || patch.evidence_memo || "",
      patch.accountTitleName || patch.account_title_name || "",
      patch.invoiceNumber || patch.invoice_number || "",
      patch.summary || "",
      patch.memo || "",
      patch.confidence === "" || patch.confidence === undefined ? null : Number(patch.confidence),
      JSON.stringify(Array.isArray(patch.lineItems) ? patch.lineItems : []),
      patch.status || "draft",
      patch.purposeTempName || patch.purpose_temp_name || "",
      patch.projectTempName || patch.project_temp_name || "",
      patch.departmentTempName || patch.department_temp_name || ""
    ]
  );

  return result.rows[0] || null;
}


async function getImportByImageHashSha256(hash) {
  const result = await pool.query(
    `
    SELECT
      id,
      upload_id,
      wix_item_id,
      wix_image_url,
      local_image_file_name,
      local_image_path,
      image_hash_sha256,
      image_size_bytes,
      original_file_name,
      captured_at_jst,
      imported_at_jst,
      import_batch_id,
      ocr_provider,
      ocr_raw_text,
      ocr_line_count,
      ocr_word_count,
      status,
      created_at,
      updated_at
    FROM accounting.receipt_imports
    WHERE image_hash_sha256 = $1
    ORDER BY id DESC
    LIMIT 1
    `,
    [hash]
  );

  return result.rows[0] || null;
}

async function createLocalImport(data) {
  const result = await pool.query(
    `
    INSERT INTO accounting.receipt_imports (
      upload_id,
      wix_item_id,
      wix_image_url,
      local_image_file_name,
      local_image_path,
      image_hash_sha256,
      image_size_bytes,
      original_file_name,
      captured_at_jst,
      imported_at_jst,
      import_batch_id,
      ocr_provider,
      ocr_raw_text,
      ocr_line_count,
      ocr_word_count,
      status
    ) VALUES (
      $1,
      null,
      null,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      CURRENT_TIMESTAMP,
      $8,
      $9,
      $10,
      $11,
      $12,
      'imported'
    )
    RETURNING *
    `,
    [
      data.uploadId,
      data.localImageFileName,
      data.localImagePath,
      data.imageHashSha256,
      data.imageSizeBytes,
      data.originalFileName,
      data.capturedAtJst,
      data.importBatchId,
      data.ocrProvider,
      data.ocrRawText,
      data.ocrLineCount,
      data.ocrWordCount
    ]
  );

  return result.rows[0];
}


async function listImportsForOcrDuplicateCheck(limit = 300) {
  const safeLimit = Math.min(Math.max(Number(limit) || 300, 1), 1000);

  const result = await pool.query(
    `
    SELECT
      id,
      upload_id,
      local_image_file_name,
      local_image_path,
      image_hash_sha256,
      original_file_name,
      imported_at_jst,
      ocr_provider,
      ocr_raw_text,
      ocr_line_count,
      ocr_word_count,
      status,
      created_at,
      updated_at
    FROM accounting.receipt_imports
    WHERE ocr_raw_text IS NOT NULL
      AND length(trim(ocr_raw_text)) > 0
    ORDER BY id DESC
    LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}


async function deleteImportById(id) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const found = await client.query(
      `
      SELECT *
      FROM accounting.receipt_imports
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    const item = found.rows[0] || null;

    if (!item) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      `
      DELETE FROM accounting.receipt_ai_drafts
      WHERE receipt_import_id = $1
      `,
      [id]
    );

    await client.query(
      `
      DELETE FROM accounting.receipt_imports
      WHERE id = $1
      `,
      [id]
    );

    await client.query("COMMIT");

    return item;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}


async function getReceiptMasterOptions() {
  const taxCategoriesResult = await pool.query(
    `
    SELECT
      tax_category_id,
      tax_name,
      tax_rate,
      sort_order
    FROM expenses.tax_categories
    WHERE is_active = TRUE
    ORDER BY sort_order, tax_category_id
    `
  );

  const taxTreatmentsResult = await pool.query(
    `
    SELECT
      tax_treatment_id,
      treatment_name,
      treatment_code,
      is_tax_included,
      sort_order
    FROM expenses.tax_treatments
    WHERE is_active = TRUE
    ORDER BY sort_order, tax_treatment_id
    `
  );

  const paymentMethodsResult = await pool.query(
    `
    SELECT
      payment_method_id,
      method_name AS payment_method_name,
      sort_order
    FROM expenses.payment_methods
    WHERE is_active = TRUE
    ORDER BY sort_order, payment_method_id
    `
  );

  const targetPeopleResult = await pool.query(
    `
    SELECT
      target_person_id,
      target_person_name,
      sort_order
    FROM expenses.target_people
    WHERE is_active = TRUE
    ORDER BY sort_order, target_person_id
    `
  );

  const purposesResult = await pool.query(
    `
    SELECT
      purpose_id,
      purpose_name,
      sort_order
    FROM expenses.purposes
    WHERE is_active = TRUE
    ORDER BY sort_order, purpose_id
    `
  );

  const projectsResult = await pool.query(
    `
    SELECT
      project_id,
      project_name,
      sort_order
    FROM expenses.projects
    WHERE is_active = TRUE
    ORDER BY sort_order, project_id
    `
  );

  const departmentsResult = await pool.query(
    `
    SELECT
      department_id,
      department_name,
      sort_order
    FROM expenses.departments
    WHERE is_active = TRUE
    ORDER BY sort_order, department_id
    `
  );

  const invoiceTypesResult = await pool.query(
    `
    SELECT
      invoice_type_id,
      invoice_type_name,
      sort_order
    FROM expenses.invoice_types
    WHERE is_active = TRUE
    ORDER BY sort_order, invoice_type_id
    `
  );

  const evidenceTypesResult = await pool.query(
    `
    SELECT
      evidence_type_id,
      evidence_type_name,
      sort_order
    FROM expenses.evidence_types
    WHERE is_active = TRUE
    ORDER BY sort_order, evidence_type_id
    `
  );

  return {
    taxCategories: taxCategoriesResult.rows,
    taxTreatments: taxTreatmentsResult.rows,
    paymentMethods: paymentMethodsResult.rows,
    targetPeople: targetPeopleResult.rows,
    purposes: purposesResult.rows,
    projects: projectsResult.rows,
    departments: departmentsResult.rows,
    invoiceTypes: invoiceTypesResult.rows,
    evidenceTypes: evidenceTypesResult.rows
  };
}
async function getReceiptTaxBreakdowns(receiptAiDraftId) {
  const result = await pool.query(
    `
    SELECT
      id,
      receipt_ai_draft_id,
      tax_category_id,
      tax_category_name,
      tax_rate,
      tax_treatment_id,
      tax_treatment_name,
      target_amount,
      tax_amount,
      ai_confidence,
      is_confirmed,
      sort_order
    FROM accounting.receipt_tax_breakdowns
    WHERE receipt_ai_draft_id = $1
    ORDER BY sort_order, id
    `,
    [receiptAiDraftId]
  );

  return result.rows;
}

async function replaceReceiptTaxBreakdowns(receiptAiDraftId, items) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const draftCheck = await client.query(
      `
      SELECT id
      FROM accounting.receipt_ai_drafts
      WHERE id = $1
      LIMIT 1
      `,
      [receiptAiDraftId]
    );

    if (draftCheck.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      `
      DELETE FROM accounting.receipt_tax_breakdowns
      WHERE receipt_ai_draft_id = $1
      `,
      [receiptAiDraftId]
    );

    const rows = Array.isArray(items) ? items : [];
    const inserted = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || {};

      const taxCategoryId = row.taxCategoryId || row.tax_category_id || null;
      const taxCategoryName = row.taxCategoryName || row.tax_category_name || "";
      const taxRate = row.taxRate || row.tax_rate || "";

      const taxTreatmentId = row.taxTreatmentId || row.tax_treatment_id || null;
      const taxTreatmentName = row.taxTreatmentName || row.tax_treatment_name || "";

      const targetAmount = row.targetAmount ?? row.target_amount ?? "";
      const taxAmount = row.taxAmount ?? row.tax_amount ?? "";
      const aiConfidence = row.aiConfidence ?? row.ai_confidence ?? "";

      const isConfirmed =
        row.isConfirmed === false || row.is_confirmed === false
          ? false
          : true;

      const sortOrder = Number(row.sortOrder || row.sort_order || (i + 1) * 10);

      const hasMeaning =
        taxCategoryId ||
        taxCategoryName ||
        taxTreatmentId ||
        taxTreatmentName ||
        String(targetAmount || "").trim() !== "" ||
        String(taxAmount || "").trim() !== "";

      if (!hasMeaning) {
        continue;
      }

      const result = await client.query(
        `
        INSERT INTO accounting.receipt_tax_breakdowns (
          receipt_ai_draft_id,
          tax_category_id,
          tax_category_name,
          tax_rate,
          tax_treatment_id,
          tax_treatment_name,
          target_amount,
          tax_amount,
          ai_confidence,
          is_confirmed,
          sort_order
        ) VALUES (
          $1,
          $2::BIGINT,
          COALESCE(
            (SELECT tax_name FROM expenses.tax_categories WHERE tax_category_id = $2::BIGINT),
            $3::TEXT,
            ''
          ),
          COALESCE(
            (SELECT tax_rate FROM expenses.tax_categories WHERE tax_category_id = $2::BIGINT),
            NULLIF($4::TEXT, '')::NUMERIC,
            0
          ),
          $5::BIGINT,
          COALESCE(
            (SELECT treatment_name FROM expenses.tax_treatments WHERE tax_treatment_id = $5::BIGINT),
            $6::TEXT,
            ''
          ),
          NULLIF($7::TEXT, '')::NUMERIC,
          NULLIF($8::TEXT, '')::NUMERIC,
          NULLIF($9::TEXT, '')::NUMERIC,
          $10::BOOLEAN,
          $11::INTEGER
        )
        RETURNING
          id,
          receipt_ai_draft_id,
          tax_category_id,
          tax_category_name,
          tax_rate,
          tax_treatment_id,
          tax_treatment_name,
          target_amount,
          tax_amount,
          ai_confidence,
          is_confirmed,
          sort_order
        `,
        [
          receiptAiDraftId,
          taxCategoryId ? String(taxCategoryId) : null,
          taxCategoryName,
          taxRate,
          taxTreatmentId ? String(taxTreatmentId) : null,
          taxTreatmentName,
          targetAmount,
          taxAmount,
          aiConfidence,
          isConfirmed,
          sortOrder
        ]
      );

      inserted.push(result.rows[0]);
    }

    await client.query("COMMIT");

    return inserted;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/* RECEIPT_ACCOUNTING_HOTFIX_START */
/*
  応急復旧:
  作業途中の expenses.receipt_imports / expenses.receipt_files 用ブロックは残す。
  ただし現DBには expenses.receipt_imports が無いため、
  実行時に使われる関数を accounting.receipt_imports ベースで再定義する。
*/

async function listImportsForOcrDuplicateCheck(limit = 300) {
  const safeLimit = Math.min(Math.max(Number(limit) || 300, 1), 1000);

  const result = await pool.query(
    `
    SELECT
      id,
      upload_id,
      wix_item_id,
      wix_image_url,
      local_image_file_name,
      local_image_path,
      image_hash_sha256,
      image_size_bytes,
      original_file_name,
      captured_at_jst,
      imported_at_jst,
      import_batch_id,
      ocr_provider,
      ocr_raw_text,
      ocr_line_count,
      ocr_word_count,
      status,
      created_at,
      updated_at
    FROM accounting.receipt_imports
    WHERE ocr_raw_text IS NOT NULL
      AND length(trim(ocr_raw_text)) > 0
    ORDER BY imported_at_jst DESC NULLS LAST, id DESC
    LIMIT $1
    `,
    [safeLimit]
  );

  return result.rows;
}

async function listImports(limit = 100, offset = 0) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const result = await pool.query(
    `
    SELECT
      id,
      upload_id,
      wix_item_id,
      wix_image_url,
      local_image_file_name,
      local_image_path,
      image_hash_sha256,
      image_size_bytes,
      original_file_name,
      captured_at_jst,
      imported_at_jst,
      import_batch_id,
      ocr_provider,
      ocr_raw_text,
      ocr_line_count,
      ocr_word_count,
      status,
      created_at,
      updated_at,
      NULL::date AS receipt_date,
      ''::text AS vendor_name,
      NULL::numeric AS total_amount,
      NULL::numeric AS tax_amount,
      ''::text AS invoice_number,
      NULL::integer AS payment_method_id,
      ''::text AS payment_method_name,
      NULL::integer AS target_person_id,
      ''::text AS target_person,
      NULL::integer AS purpose_id,
      ''::text AS purpose,
      NULL::integer AS project_id,
      ''::text AS project_name,
      NULL::integer AS department_id,
      ''::text AS department_name,
      ''::text AS evidence_type,
      ''::text AS evidence_memo,
      ''::text AS summary
    FROM accounting.receipt_imports
    ORDER BY imported_at_jst DESC NULLS LAST, id DESC
    LIMIT $1 OFFSET $2
    `,
    [safeLimit, safeOffset]
  );

  return result.rows;
}

async function getImportById(id) {
  const result = await pool.query(
    `
    SELECT
      id,
      upload_id,
      wix_item_id,
      wix_image_url,
      local_image_file_name,
      local_image_path,
      image_hash_sha256,
      image_size_bytes,
      original_file_name,
      captured_at_jst,
      imported_at_jst,
      import_batch_id,
      ocr_provider,
      ocr_raw_text,
      ocr_line_count,
      ocr_word_count,
      status,
      created_at,
      updated_at,
      NULL::date AS receipt_date,
      ''::text AS vendor_name,
      NULL::numeric AS total_amount,
      NULL::numeric AS tax_amount,
      ''::text AS invoice_number,
      NULL::integer AS payment_method_id,
      ''::text AS payment_method_name,
      NULL::integer AS target_person_id,
      ''::text AS target_person,
      NULL::integer AS purpose_id,
      ''::text AS purpose,
      NULL::integer AS project_id,
      ''::text AS project_name,
      NULL::integer AS department_id,
      ''::text AS department_name,
      ''::text AS evidence_type,
      ''::text AS evidence_memo,
      ''::text AS summary
    FROM accounting.receipt_imports
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function getImportByImageHashSha256(hash) {
  const result = await pool.query(
    `
    SELECT
      id,
      upload_id,
      wix_item_id,
      wix_image_url,
      local_image_file_name,
      local_image_path,
      image_hash_sha256,
      image_size_bytes,
      original_file_name,
      captured_at_jst,
      imported_at_jst,
      import_batch_id,
      ocr_provider,
      ocr_raw_text,
      ocr_line_count,
      ocr_word_count,
      status,
      created_at,
      updated_at
    FROM accounting.receipt_imports
    WHERE image_hash_sha256 = $1
    ORDER BY id DESC
    LIMIT 1
    `,
    [hash]
  );

  return result.rows[0] || null;
}

async function createLocalImport(data) {
  const result = await pool.query(
    `
    INSERT INTO accounting.receipt_imports (
      upload_id,
      wix_item_id,
      wix_image_url,
      local_image_file_name,
      local_image_path,
      image_hash_sha256,
      image_size_bytes,
      original_file_name,
      captured_at_jst,
      imported_at_jst,
      import_batch_id,
      ocr_provider,
      ocr_raw_text,
      ocr_line_count,
      ocr_word_count,
      status
    ) VALUES (
      $1,
      NULL,
      NULL,
      $2,
      $3,
      $4,
      $5,
      $6,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      $7,
      $8,
      $9,
      $10,
      $11,
      'imported'
    )
    RETURNING *
    `,
    [
      data.uploadId || data.upload_id || ("local-" + Date.now()),
      data.localImageFileName || data.local_image_file_name || "",
      data.localImagePath || data.local_image_path || "",
      data.imageHashSha256 || data.image_hash_sha256 || "",
      data.imageSizeBytes || data.image_size_bytes || null,
      data.originalFileName || data.original_file_name || data.localImageFileName || "",
      data.importBatchId || data.import_batch_id || "local",
      data.ocrProvider || data.ocr_provider || "",
      data.ocrRawText || data.ocr_raw_text || "",
      data.ocrLineCount || data.ocr_line_count || 0,
      data.ocrWordCount || data.ocr_word_count || 0
    ]
  );

  return result.rows[0];
}

async function deleteImportById(id) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const found = await client.query(
      `
      SELECT *
      FROM accounting.receipt_imports
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    const item = found.rows[0] || null;

    if (!item) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      `
      DELETE FROM accounting.receipt_tax_breakdowns
      WHERE receipt_ai_draft_id IN (
        SELECT id
        FROM accounting.receipt_ai_drafts
        WHERE receipt_import_id = $1
      )
      `,
      [id]
    ).catch(() => {});

    await client.query(
      `
      DELETE FROM accounting.receipt_ai_drafts
      WHERE receipt_import_id = $1
      `,
      [id]
    ).catch(() => {});

    await client.query(
      `
      DELETE FROM accounting.receipt_imports
      WHERE id = $1
      `,
      [id]
    );

    await client.query("COMMIT");

    return item;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
/* RECEIPT_ACCOUNTING_HOTFIX_END */
/* RECEIPT_AI_DRAFT_MASTER_SAVE_START */
/*
  AI下書き保存の上書き。
  AIが返した支払方法ID・インボイス区分ID・証憑区分ID・証憑メモも保存する。
  勘定科目は現テーブルでは account_title_name として保存する。
*/

createAiDraft = async function createAiDraftWithMasterIds(receiptImportId, draft) {
  const result = await pool.query(
    `
    INSERT INTO accounting.receipt_ai_drafts (
      receipt_import_id,
      transaction_date,
      vendor_name,
      vendor_address,
      vendor_phone,
      receipt_time_text,
      total_amount,
      tax_amount,
      tax_rate,
      tax_treatment_name,
      payment_method_id,
      payment_method_name,
      account_title_name,
      invoice_type_id,
      evidence_type_id,
      evidence_memo,
      invoice_number,
      summary,
      memo,
      confidence,
      line_items,
      status,
      ai_model,
      ai_raw_json,
      error_message
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11, $12,
      $13, $14, $15, $16, $17, $18,
      $19, $20, $21::jsonb, 'draft', $22, $23::jsonb, ''
    )
    RETURNING *
    `,
    [
      receiptImportId,
      draft.transactionDate,
      draft.vendorName,
      draft.vendorAddress || "",
      draft.vendorPhone || "",
      draft.receiptTimeText || "",
      draft.totalAmount,
      draft.taxAmount,
      draft.taxRate,
      draft.taxTreatmentName || draft.tax_treatment_name || "",
      draft.paymentMethodId || draft.payment_method_id || null,
      draft.paymentMethodName || draft.payment_method_name || "",
      draft.accountTitleName || draft.account_title_name || "",
      draft.invoiceTypeId || draft.invoice_type_id || null,
      draft.evidenceTypeId || draft.evidence_type_id || null,
      draft.evidenceMemo || draft.evidence_memo || "",
      draft.invoiceNumber || draft.invoice_number || "",
      draft.summary || "",
      draft.memo || "",
      draft.confidence,
      JSON.stringify(draft.lineItems || []),
      draft.aiModel,
      JSON.stringify(draft.aiRawJson || {})
    ]
  );

  const savedDraft = result.rows[0];

  const aiTaxBreakdowns = buildReceiptTaxBreakdownsFromDraft(draft);

  if (aiTaxBreakdowns.length > 0) {
    await replaceReceiptTaxBreakdowns(Number(savedDraft.id), aiTaxBreakdowns);
  }

  return savedDraft;
};
/* RECEIPT_AI_DRAFT_MASTER_SAVE_END */
module.exports = {
  getReceiptTaxBreakdowns,
  replaceReceiptTaxBreakdowns,
  getReceiptMasterOptions,
  deleteImportById,
  listImportsForOcrDuplicateCheck,
  listImports,
  getImportById,
  createAiDraft,
  getAiDrafts,
  updateAiDraft,
  getImportByImageHashSha256,
  createLocalImport,
};

/* RECEIPT_ACCOUNT_TITLES_MASTER_OPTIONS_20260705_START */
/*
  /api/receipts/master-options に勘定科目マスタ accountTitles を追加する。
  既存の getReceiptMasterOptions は壊さず、返却データへ accountTitles だけ足す。
*/
const __receiptAccountTitlesMasterOptionsPool =
  (typeof pool !== "undefined" && pool && pool.query)
    ? pool
    : require("../db");

async function __getReceiptAccountTitlesForMasterOptions() {
  const result = await __receiptAccountTitlesMasterOptionsPool.query(`
    SELECT
      account_title_id,
      account_name,
      account_code,
      sort_order
    FROM expenses.account_titles
    WHERE is_active = TRUE
    ORDER BY sort_order, account_title_id
  `);

  return result.rows.map((row) => ({
    ...row,
    account_title_name: row.account_name,
    accountTitleId: row.account_title_id,
    accountTitleName: row.account_name
  }));
}

if (module.exports && typeof module.exports.getReceiptMasterOptions === "function") {
  const __baseGetReceiptMasterOptions = module.exports.getReceiptMasterOptions;

  module.exports.getReceiptMasterOptions = async function getReceiptMasterOptionsWithAccountTitles() {
    const data = await __baseGetReceiptMasterOptions.apply(this, arguments);
    const accountTitles = await __getReceiptAccountTitlesForMasterOptions();

    return {
      ...data,
      accountTitles
    };
  };
}
/* RECEIPT_ACCOUNT_TITLES_MASTER_OPTIONS_20260705_END */

/* RECEIPT_NEW_6_TABLE_REPOSITORY_FUNCTIONS_20260705_START */
/*
  新レシートDB 6テーブル用 repository 関数。
  旧 receipt_ai_drafts / receipt_tax_breakdowns はここでは変更しない。
  既存APIを壊さないため、module.exports へ追加代入する。
*/

function __receiptNew6ToNumberOrNull(value) {
  if (value === "" || value === undefined || value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function __receiptNew6Text(value) {
  if (value === undefined || value === null) return "";
  return String(value);
}

function __receiptNew6FirstDefined() {
  for (const value of arguments) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function __receiptNew6BuildLineItems(draft) {
  if (!draft) return [];

  if (Array.isArray(draft.lineItems)) return draft.lineItems;
  if (Array.isArray(draft.line_items)) return draft.line_items;
  if (Array.isArray(draft.items)) return draft.items;
  if (Array.isArray(draft.details)) return draft.details;

  return [];
}

async function createReceiptDraftFromImport(receiptImportId) {
  const importResult = await pool.query(
    `
    SELECT
      id,
      local_image_file_name,
      local_image_path,
      image_hash_sha256,
      original_file_name,
      imported_at_jst
    FROM accounting.receipt_imports
    WHERE id = $1
    LIMIT 1
    `,
    [receiptImportId]
  );

  const item = importResult.rows[0] || null;

  if (!item) {
    return null;
  }

  const receiptName =
    item.original_file_name ||
    item.local_image_file_name ||
    ("receipt_import_" + item.id);

  const result = await pool.query(
    `
    INSERT INTO accounting.receipt_drafts (
      receipt_import_id,
      receipt_name,
      receipt_image_path,
      receipt_imported_at,
      image_hash_sha256,
      draft_status
    ) VALUES (
      $1, $2, $3, $4, $5, '取込済み'
    )
    RETURNING *
    `,
    [
      item.id,
      receiptName,
      item.local_image_path || "",
      item.imported_at_jst || null,
      item.image_hash_sha256 || ""
    ]
  );

  return result.rows[0] || null;
}

async function createReceiptDraftDetailFromAi(draftReceiptId, receiptImportId, draft) {
  const importResult = await pool.query(
    `
    SELECT
      id,
      ocr_raw_text
    FROM accounting.receipt_imports
    WHERE id = $1
    LIMIT 1
    `,
    [receiptImportId]
  );

  const importItem = importResult.rows[0] || {};

  const result = await pool.query(
    `
    INSERT INTO accounting.receipt_draft_details (
      draft_receipt_id,
      receipt_import_id,

      transaction_date,
      receipt_time_text,

      vendor_name,
      vendor_address,
      vendor_phone,

      payment_method_id,

      total_amount,
      tax_total_amount,

      invoice_number,
      invoice_type_id,

      evidence_type_id,
      evidence_memo,

      target_person_id,

      summary,
      memo,

      account_title_id,
      purpose_id,
      project_id,
      department_id,

      ocr_raw_text
    ) VALUES (
      $1, $2,
      $3, $4,
      $5, $6, $7,
      $8,
      $9, $10,
      $11, $12,
      $13, $14,
      $15,
      $16, $17,
      $18, $19, $20, $21,
      $22
    )
    RETURNING *
    `,
    [
      draftReceiptId,
      receiptImportId,

      __receiptNew6FirstDefined(draft.transactionDate, draft.transaction_date),
      __receiptNew6Text(__receiptNew6FirstDefined(draft.receiptTimeText, draft.receipt_time_text)),

      __receiptNew6Text(__receiptNew6FirstDefined(draft.vendorName, draft.vendor_name)),
      __receiptNew6Text(__receiptNew6FirstDefined(draft.vendorAddress, draft.vendor_address)),
      __receiptNew6Text(__receiptNew6FirstDefined(draft.vendorPhone, draft.vendor_phone)),

      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(draft.paymentMethodId, draft.payment_method_id)),

      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(draft.totalAmount, draft.total_amount)),
      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(draft.taxAmount, draft.tax_total_amount, draft.tax_amount)),

      __receiptNew6Text(__receiptNew6FirstDefined(draft.invoiceNumber, draft.invoice_number)),
      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(draft.invoiceTypeId, draft.invoice_type_id)),

      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(draft.evidenceTypeId, draft.evidence_type_id)),
      __receiptNew6Text(__receiptNew6FirstDefined(draft.evidenceMemo, draft.evidence_memo)),

      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(draft.targetPersonId, draft.target_person_id)),

      __receiptNew6Text(draft.summary),
      __receiptNew6Text(draft.memo),

      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(draft.accountTitleId, draft.account_title_id)),
      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(draft.purposeId, draft.purpose_id)),
      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(draft.projectId, draft.project_id)),
      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(draft.departmentId, draft.department_id)),

      __receiptNew6Text(__receiptNew6FirstDefined(draft.ocrRawText, draft.ocr_raw_text, importItem.ocr_raw_text))
    ]
  );

  return result.rows[0] || null;
}

async function replaceReceiptDraftDetailBreakdowns(draftReceiptId, draftReceiptDetailId, items) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `
      DELETE FROM accounting.receipt_draft_detail_breakdowns
      WHERE draft_receipt_detail_id = $1
      `,
      [draftReceiptDetailId]
    );

    const rows = Array.isArray(items) ? items : [];
    const inserted = [];

    for (const row of rows) {
      const itemName = __receiptNew6Text(
        __receiptNew6FirstDefined(
          row.itemName,
          row.item_name,
          row.name,
          row.description,
          row.productName,
          row.product_name
        )
      ).trim();

      const quantity = __receiptNew6ToNumberOrNull(
        __receiptNew6FirstDefined(row.quantity, row.qty)
      );

      const unitPrice = __receiptNew6ToNumberOrNull(
        __receiptNew6FirstDefined(row.unitPrice, row.unit_price)
      );

      const amount = __receiptNew6ToNumberOrNull(
        __receiptNew6FirstDefined(row.amount, row.price, row.total)
      );

      const taxCategoryId = __receiptNew6ToNumberOrNull(
        __receiptNew6FirstDefined(row.taxCategoryId, row.tax_category_id)
      );

      const taxTreatmentId = __receiptNew6ToNumberOrNull(
        __receiptNew6FirstDefined(row.taxTreatmentId, row.tax_treatment_id)
      );

      const note = __receiptNew6Text(
        __receiptNew6FirstDefined(row.note, row.memo, row.remarks)
      );

      const hasMeaning =
        itemName ||
        quantity !== null ||
        unitPrice !== null ||
        amount !== null ||
        taxCategoryId !== null ||
        taxTreatmentId !== null ||
        note;

      if (!hasMeaning) {
        continue;
      }

      const result = await client.query(
        `
        INSERT INTO accounting.receipt_draft_detail_breakdowns (
          draft_receipt_id,
          draft_receipt_detail_id,
          item_name,
          quantity,
          unit_price,
          amount,
          tax_category_id,
          tax_treatment_id,
          note
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9
        )
        RETURNING *
        `,
        [
          draftReceiptId,
          draftReceiptDetailId,
          itemName,
          quantity,
          unitPrice,
          amount,
          taxCategoryId,
          taxTreatmentId,
          note
        ]
      );

      inserted.push(result.rows[0]);
    }

    await client.query("COMMIT");
    return inserted;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function createReceiptDraftFromAi(receiptImportId, draft) {
  const receiptDraft = await createReceiptDraftFromImport(receiptImportId);

  if (!receiptDraft) {
    return null;
  }

  const detail = await createReceiptDraftDetailFromAi(
    Number(receiptDraft.draft_receipt_id),
    Number(receiptImportId),
    draft || {}
  );

  const lineItems = __receiptNew6BuildLineItems(draft || {});

  const breakdowns = detail
    ? await replaceReceiptDraftDetailBreakdowns(
        Number(receiptDraft.draft_receipt_id),
        Number(detail.draft_receipt_detail_id),
        lineItems
      )
    : [];

  return {
    ...(detail || {}),
    id: detail ? detail.draft_receipt_detail_id : null,
    draft_receipt_id: receiptDraft.draft_receipt_id,
    draftReceiptId: receiptDraft.draft_receipt_id,
    draft_receipt_detail_id: detail ? detail.draft_receipt_detail_id : null,
    draftReceiptDetailId: detail ? detail.draft_receipt_detail_id : null,
    receipt_import_id: receiptImportId,
    receiptImportId,
    line_items: lineItems,
    lineItems,
    breakdowns
  };
}

async function getReceiptDraftByImportId(receiptImportId) {
  const draftResult = await pool.query(
    `
    SELECT *
    FROM accounting.receipt_drafts
    WHERE receipt_import_id = $1
    ORDER BY draft_receipt_id DESC
    LIMIT 1
    `,
    [receiptImportId]
  );

  const draft = draftResult.rows[0] || null;

  if (!draft) {
    return null;
  }

  const detailsResult = await pool.query(
    `
    SELECT *
    FROM accounting.receipt_draft_details
    WHERE draft_receipt_id = $1
    ORDER BY draft_receipt_detail_id DESC
    `,
    [draft.draft_receipt_id]
  );

  return {
    ...draft,
    details: detailsResult.rows
  };
}

async function updateReceiptDraftDetail(id, patch) {
  const result = await pool.query(
    `
    UPDATE accounting.receipt_draft_details
    SET
      transaction_date = $2,
      receipt_time_text = $3,

      vendor_name = $4,
      vendor_address = $5,
      vendor_phone = $6,

      payment_method_id = $7,

      total_amount = $8,
      tax_total_amount = $9,

      invoice_number = $10,
      invoice_type_id = $11,

      evidence_type_id = $12,
      evidence_memo = $13,

      target_person_id = $14,

      summary = $15,
      memo = $16,

      account_title_id = $17,
      purpose_id = $18,
      project_id = $19,
      department_id = $20,

      updated_at = CURRENT_TIMESTAMP
    WHERE draft_receipt_detail_id = $1
    RETURNING *
    `,
    [
      id,

      __receiptNew6FirstDefined(patch.transactionDate, patch.transaction_date),
      __receiptNew6Text(__receiptNew6FirstDefined(patch.receiptTimeText, patch.receipt_time_text)),

      __receiptNew6Text(__receiptNew6FirstDefined(patch.vendorName, patch.vendor_name)),
      __receiptNew6Text(__receiptNew6FirstDefined(patch.vendorAddress, patch.vendor_address)),
      __receiptNew6Text(__receiptNew6FirstDefined(patch.vendorPhone, patch.vendor_phone)),

      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(patch.paymentMethodId, patch.payment_method_id)),

      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(patch.totalAmount, patch.total_amount)),
      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(patch.taxAmount, patch.taxTotalAmount, patch.tax_total_amount, patch.tax_amount)),

      __receiptNew6Text(__receiptNew6FirstDefined(patch.invoiceNumber, patch.invoice_number)),
      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(patch.invoiceTypeId, patch.invoice_type_id)),

      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(patch.evidenceTypeId, patch.evidence_type_id)),
      __receiptNew6Text(__receiptNew6FirstDefined(patch.evidenceMemo, patch.evidence_memo)),

      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(patch.targetPersonId, patch.target_person_id)),

      __receiptNew6Text(patch.summary),
      __receiptNew6Text(patch.memo),

      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(patch.accountTitleId, patch.account_title_id)),
      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(patch.purposeId, patch.purpose_id)),
      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(patch.projectId, patch.project_id)),
      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(patch.departmentId, patch.department_id))
    ]
  );

  return result.rows[0] || null;
}

module.exports.createReceiptDraftFromImport = createReceiptDraftFromImport;
module.exports.createReceiptDraftDetailFromAi = createReceiptDraftDetailFromAi;
module.exports.replaceReceiptDraftDetailBreakdowns = replaceReceiptDraftDetailBreakdowns;
module.exports.createReceiptDraftFromAi = createReceiptDraftFromAi;
module.exports.getReceiptDraftByImportId = getReceiptDraftByImportId;
module.exports.updateReceiptDraftDetail = updateReceiptDraftDetail;
/* RECEIPT_NEW_6_TABLE_REPOSITORY_FUNCTIONS_20260705_END */

/* RECEIPT_NEW_6_GET_DRAFT_WITH_BREAKDOWNS_20260705_START */
/*
  新6テーブル下書き取得の上書き。
  明細 details に receipt_draft_detail_breakdowns を付けて返す。
  画面側の日付ズレ対策として DATE は YYYY-MM-DD 文字列で返す。
*/
async function getReceiptDraftByImportIdWithBreakdowns(receiptImportId) {
  const draftResult = await pool.query(
    `
    SELECT *
    FROM accounting.receipt_drafts
    WHERE receipt_import_id = $1
    ORDER BY draft_receipt_id DESC
    LIMIT 1
    `,
    [receiptImportId]
  );

  const draft = draftResult.rows[0] || null;

  if (!draft) {
    return null;
  }

  const detailsResult = await pool.query(
    `
    SELECT
      *,
      to_char(transaction_date, 'YYYY-MM-DD') AS transaction_date_text
    FROM accounting.receipt_draft_details
    WHERE draft_receipt_id = $1
    ORDER BY draft_receipt_detail_id DESC
    `,
    [draft.draft_receipt_id]
  );

  const breakdownsResult = await pool.query(
    `
    SELECT *
    FROM accounting.receipt_draft_detail_breakdowns
    WHERE draft_receipt_id = $1
    ORDER BY draft_receipt_detail_id, draft_receipt_detail_breakdown_id
    `,
    [draft.draft_receipt_id]
  );

  const breakdownsByDetailId = new Map();

  for (const row of breakdownsResult.rows) {
    const key = Number(row.draft_receipt_detail_id);
    if (!breakdownsByDetailId.has(key)) {
      breakdownsByDetailId.set(key, []);
    }

    breakdownsByDetailId.get(key).push({
      ...row,

      id: row.draft_receipt_detail_breakdown_id,

      itemName: row.item_name,
      item_name: row.item_name,

      quantity: row.quantity,
      unitPrice: row.unit_price,
      unit_price: row.unit_price,
      amount: row.amount,

      taxCategoryId: row.tax_category_id,
      tax_category_id: row.tax_category_id,

      taxTreatmentId: row.tax_treatment_id,
      tax_treatment_id: row.tax_treatment_id,

      note: row.note
    });
  }

  const details = detailsResult.rows.map((detail) => {
    const key = Number(detail.draft_receipt_detail_id);
    const breakdowns = breakdownsByDetailId.get(key) || [];
    const transactionDateText = detail.transaction_date_text || "";

    return {
      ...detail,

      transaction_date: transactionDateText,
      transactionDate: transactionDateText,
      receipt_date: transactionDateText,
      receiptDate: transactionDateText,

      breakdowns,
      line_items: breakdowns,
      lineItems: breakdowns
    };
  });

  return {
    ...draft,
    details
  };
}

module.exports.getReceiptDraftByImportId = getReceiptDraftByImportIdWithBreakdowns;
/* RECEIPT_NEW_6_GET_DRAFT_WITH_BREAKDOWNS_20260705_END */

/* RECEIPT_NEW_6_GET_DRAFT_WITH_BREAKDOWNS_V2_20260705_START */
/*
  新6テーブル下書き取得 V2。
  画面表示用に、明細内訳の商品名フィールド別名を増やす。
  tax_category_id / tax_treatment_id が入っている場合はマスタ名も返す。
  既存の getReceiptDraftByImportId を末尾で再上書きする。
*/
async function getReceiptDraftByImportIdWithBreakdownsV2(receiptImportId) {
  const draftResult = await pool.query(
    `
    SELECT *
    FROM accounting.receipt_drafts
    WHERE receipt_import_id = $1
    ORDER BY draft_receipt_id DESC
    LIMIT 1
    `,
    [receiptImportId]
  );

  const draft = draftResult.rows[0] || null;

  if (!draft) {
    return null;
  }

  const detailsResult = await pool.query(
    `
    SELECT
      *,
      to_char(transaction_date, 'YYYY-MM-DD') AS transaction_date_text
    FROM accounting.receipt_draft_details
    WHERE draft_receipt_id = $1
    ORDER BY draft_receipt_detail_id DESC
    `,
    [draft.draft_receipt_id]
  );

  const breakdownsResult = await pool.query(
    `
    SELECT
      b.*,
      tc.tax_name AS tax_category_name,
      tc.tax_rate AS tax_rate,
      tt.treatment_name AS tax_treatment_name
    FROM accounting.receipt_draft_detail_breakdowns b
    LEFT JOIN expenses.tax_categories tc
      ON tc.tax_category_id = b.tax_category_id
    LEFT JOIN expenses.tax_treatments tt
      ON tt.tax_treatment_id = b.tax_treatment_id
    WHERE b.draft_receipt_id = $1
    ORDER BY b.draft_receipt_detail_id, b.draft_receipt_detail_breakdown_id
    `,
    [draft.draft_receipt_id]
  );

  const breakdownsByDetailId = new Map();

  for (const row of breakdownsResult.rows) {
    const key = Number(row.draft_receipt_detail_id);
    if (!breakdownsByDetailId.has(key)) {
      breakdownsByDetailId.set(key, []);
    }

    const name = row.item_name || "";

    breakdownsByDetailId.get(key).push({
      ...row,

      id: row.draft_receipt_detail_breakdown_id,

      item_name: name,
      itemName: name,
      product_name: name,
      productName: name,
      name: name,
      description: name,
      title: name,

      quantity: row.quantity,
      qty: row.quantity,

      unit_price: row.unit_price,
      unitPrice: row.unit_price,

      amount: row.amount,
      total: row.amount,
      price: row.amount,

      tax_category_id: row.tax_category_id,
      taxCategoryId: row.tax_category_id,
      tax_category_name: row.tax_category_name || "",
      taxCategoryName: row.tax_category_name || "",
      tax_rate: row.tax_rate,
      taxRate: row.tax_rate,

      tax_treatment_id: row.tax_treatment_id,
      taxTreatmentId: row.tax_treatment_id,
      tax_treatment_name: row.tax_treatment_name || "",
      taxTreatmentName: row.tax_treatment_name || "",

      note: row.note || "",
      memo: row.note || "",
      remarks: row.note || ""
    });
  }

  const details = detailsResult.rows.map((detail) => {
    const key = Number(detail.draft_receipt_detail_id);
    const breakdowns = breakdownsByDetailId.get(key) || [];
    const transactionDateText = detail.transaction_date_text || "";

    return {
      ...detail,

      id: detail.draft_receipt_detail_id,

      transaction_date: transactionDateText,
      transactionDate: transactionDateText,
      receipt_date: transactionDateText,
      receiptDate: transactionDateText,

      tax_amount: detail.tax_total_amount,
      taxAmount: detail.tax_total_amount,
      tax_total_amount: detail.tax_total_amount,
      taxTotalAmount: detail.tax_total_amount,

      total_amount: detail.total_amount,
      totalAmount: detail.total_amount,

      vendor_name: detail.vendor_name,
      vendorName: detail.vendor_name,

      payment_method_id: detail.payment_method_id,
      paymentMethodId: detail.payment_method_id,

      account_title_id: detail.account_title_id,
      accountTitleId: detail.account_title_id,

      purpose_id: detail.purpose_id,
      purposeId: detail.purpose_id,

      project_id: detail.project_id,
      projectId: detail.project_id,

      department_id: detail.department_id,
      departmentId: detail.department_id,

      breakdowns,
      line_items: breakdowns,
      lineItems: breakdowns,
      items: breakdowns
    };
  });

  return {
    ...draft,
    details
  };
}

module.exports.getReceiptDraftByImportId = getReceiptDraftByImportIdWithBreakdownsV2;
/* RECEIPT_NEW_6_GET_DRAFT_WITH_BREAKDOWNS_V2_20260705_END */

/* RECEIPT_NEW_6_TAX_SAVE_V2_20260705_START */
/*
  新6テーブル保存 V2。
  AI解析結果の税区分・税処理を、明細内訳 receipt_draft_detail_breakdowns にも入れる。
  既存データは自動では変わらない。次回AI解析分から反映される。
*/

function __receiptNew6PickTaxFallbackFromDraft(draft) {
  const rows = buildReceiptTaxBreakdownsFromDraft(draft || {});
  const first = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

  if (!first) {
    return {
      taxCategoryId: null,
      taxTreatmentId: null
    };
  }

  return {
    taxCategoryId: first.taxCategoryId || first.tax_category_id || null,
    taxTreatmentId: first.taxTreatmentId || first.tax_treatment_id || null
  };
}

function __receiptNew6ApplyTaxFallbackToLineItems(lineItems, draft) {
  const fallback = __receiptNew6PickTaxFallbackFromDraft(draft || {});
  const rows = Array.isArray(lineItems) ? lineItems : [];

  return rows.map((row) => {
    const item = row || {};

    return {
      ...item,

      taxCategoryId:
        item.taxCategoryId ||
        item.tax_category_id ||
        fallback.taxCategoryId ||
        null,

      tax_category_id:
        item.tax_category_id ||
        item.taxCategoryId ||
        fallback.taxCategoryId ||
        null,

      taxTreatmentId:
        item.taxTreatmentId ||
        item.tax_treatment_id ||
        fallback.taxTreatmentId ||
        null,

      tax_treatment_id:
        item.tax_treatment_id ||
        item.taxTreatmentId ||
        fallback.taxTreatmentId ||
        null
    };
  });
}

async function createReceiptDraftFromAiTaxSaveV2(receiptImportId, draft) {
  const receiptDraft = await createReceiptDraftFromImport(receiptImportId);

  if (!receiptDraft) {
    return null;
  }

  const detail = await createReceiptDraftDetailFromAi(
    Number(receiptDraft.draft_receipt_id),
    Number(receiptImportId),
    draft || {}
  );

  const rawLineItems = __receiptNew6BuildLineItems(draft || {});
  const lineItems = __receiptNew6ApplyTaxFallbackToLineItems(rawLineItems, draft || {});

  const breakdowns = detail
    ? await replaceReceiptDraftDetailBreakdowns(
        Number(receiptDraft.draft_receipt_id),
        Number(detail.draft_receipt_detail_id),
        lineItems
      )
    : [];

  return {
    ...(detail || {}),
    id: detail ? detail.draft_receipt_detail_id : null,
    draft_receipt_id: receiptDraft.draft_receipt_id,
    draftReceiptId: receiptDraft.draft_receipt_id,
    draft_receipt_detail_id: detail ? detail.draft_receipt_detail_id : null,
    draftReceiptDetailId: detail ? detail.draft_receipt_detail_id : null,
    receipt_import_id: receiptImportId,
    receiptImportId,
    line_items: lineItems,
    lineItems,
    breakdowns
  };
}

module.exports.createReceiptDraftFromAi = createReceiptDraftFromAiTaxSaveV2;
/* RECEIPT_NEW_6_TAX_SAVE_V2_20260705_END */

/* RECEIPT_NEW_6_TAX_BREAKDOWNS_API_20260705_START */
/*
  新6テーブル用 税額内訳API。
  旧 receipt_tax_breakdowns は使わず、
  receipt_draft_details / receipt_draft_detail_breakdowns から画面互換の税額内訳を返す。
*/

async function getReceiptDraftDetailTaxBreakdowns(draftReceiptDetailId) {
  const detailResult = await pool.query(
    `
    SELECT
      draft_receipt_detail_id,
      draft_receipt_id,
      total_amount,
      tax_total_amount
    FROM accounting.receipt_draft_details
    WHERE draft_receipt_detail_id = $1
    LIMIT 1
    `,
    [draftReceiptDetailId]
  );

  const detail = detailResult.rows[0] || null;

  if (!detail) {
    return null;
  }

  const firstTaxResult = await pool.query(
    `
    SELECT
      b.tax_category_id,
      b.tax_treatment_id,
      tc.tax_name AS tax_category_name,
      tc.tax_rate,
      tt.treatment_name AS tax_treatment_name
    FROM accounting.receipt_draft_detail_breakdowns b
    LEFT JOIN expenses.tax_categories tc
      ON tc.tax_category_id = b.tax_category_id
    LEFT JOIN expenses.tax_treatments tt
      ON tt.tax_treatment_id = b.tax_treatment_id
    WHERE b.draft_receipt_detail_id = $1
      AND (
        b.tax_category_id IS NOT NULL
        OR b.tax_treatment_id IS NOT NULL
      )
    ORDER BY b.draft_receipt_detail_breakdown_id
    LIMIT 1
    `,
    [draftReceiptDetailId]
  );

  const tax = firstTaxResult.rows[0] || {};

  const targetAmount = detail.total_amount;
  const taxAmount = detail.tax_total_amount;

  if (targetAmount === null && taxAmount === null) {
    return [];
  }

  return [
    {
      id: Number(draftReceiptDetailId),
      receipt_ai_draft_id: Number(draftReceiptDetailId),
      draft_receipt_detail_id: Number(draftReceiptDetailId),

      tax_category_id: tax.tax_category_id || null,
      taxCategoryId: tax.tax_category_id || null,
      tax_category_name: tax.tax_category_name || "",
      taxCategoryName: tax.tax_category_name || "",
      tax_rate: tax.tax_rate || null,
      taxRate: tax.tax_rate || null,

      tax_treatment_id: tax.tax_treatment_id || null,
      taxTreatmentId: tax.tax_treatment_id || null,
      tax_treatment_name: tax.tax_treatment_name || "",
      taxTreatmentName: tax.tax_treatment_name || "",

      target_amount: targetAmount,
      targetAmount: targetAmount,

      tax_amount: taxAmount,
      taxAmount: taxAmount,

      ai_confidence: null,
      aiConfidence: null,

      is_confirmed: true,
      isConfirmed: true,

      sort_order: 10,
      sortOrder: 10
    }
  ];
}

async function replaceReceiptDraftDetailTaxBreakdowns(draftReceiptDetailId, items) {
  const rows = Array.isArray(items) ? items : [];
  const first = rows[0] || {};

  const taxAmountRaw =
    first.taxAmount ??
    first.tax_amount ??
    first.amountTax ??
    first.amount_tax ??
    null;

  const targetAmountRaw =
    first.targetAmount ??
    first.target_amount ??
    null;

  const taxCategoryId =
    first.taxCategoryId ||
    first.tax_category_id ||
    null;

  const taxTreatmentId =
    first.taxTreatmentId ||
    first.tax_treatment_id ||
    null;

  const taxAmount =
    taxAmountRaw === "" || taxAmountRaw === undefined || taxAmountRaw === null
      ? null
      : Number(taxAmountRaw);

  const targetAmount =
    targetAmountRaw === "" || targetAmountRaw === undefined || targetAmountRaw === null
      ? null
      : Number(targetAmountRaw);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const detailCheck = await client.query(
      `
      SELECT
        draft_receipt_detail_id,
        total_amount
      FROM accounting.receipt_draft_details
      WHERE draft_receipt_detail_id = $1
      LIMIT 1
      `,
      [draftReceiptDetailId]
    );

    const detail = detailCheck.rows[0] || null;

    if (!detail) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      `
      UPDATE accounting.receipt_draft_details
      SET
        tax_total_amount = $2,
        total_amount = COALESCE($3, total_amount),
        updated_at = CURRENT_TIMESTAMP
      WHERE draft_receipt_detail_id = $1
      `,
      [
        draftReceiptDetailId,
        Number.isFinite(taxAmount) ? taxAmount : null,
        Number.isFinite(targetAmount) ? targetAmount : null
      ]
    );

    if (taxCategoryId || taxTreatmentId) {
      await client.query(
        `
        UPDATE accounting.receipt_draft_detail_breakdowns
        SET
          tax_category_id = COALESCE($2::BIGINT, tax_category_id),
          tax_treatment_id = COALESCE($3::BIGINT, tax_treatment_id),
          updated_at = CURRENT_TIMESTAMP
        WHERE draft_receipt_detail_id = $1
        `,
        [
          draftReceiptDetailId,
          taxCategoryId || null,
          taxTreatmentId || null
        ]
      );
    }

    await client.query("COMMIT");

    return await getReceiptDraftDetailTaxBreakdowns(draftReceiptDetailId);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports.getReceiptDraftDetailTaxBreakdowns = getReceiptDraftDetailTaxBreakdowns;
module.exports.replaceReceiptDraftDetailTaxBreakdowns = replaceReceiptDraftDetailTaxBreakdowns;
/* RECEIPT_NEW_6_TAX_BREAKDOWNS_API_20260705_END */

/* RECEIPT_NEW_6_CONFIDENCE_20260705_START */
/*
  新6テーブル 信頼度対応。
  receipt_draft_details.ai_confidence にAI信頼度を保存し、
  画面返却時に confidence / aiConfidence として返す。
*/

function __receiptNew6ConfidenceToNumberOrNull(value) {
  if (value === "" || value === undefined || value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function __receiptNew6PickConfidence(draft) {
  const raw =
    draft.confidence ??
    draft.aiConfidence ??
    draft.ai_confidence ??
    draft.confidenceScore ??
    draft.confidence_score ??
    null;

  return __receiptNew6ConfidenceToNumberOrNull(raw);
}

async function createReceiptDraftDetailFromAiConfidenceV2(draftReceiptId, receiptImportId, draft) {
  const importResult = await pool.query(
    `
    SELECT
      id,
      ocr_raw_text
    FROM accounting.receipt_imports
    WHERE id = $1
    LIMIT 1
    `,
    [receiptImportId]
  );

  const importItem = importResult.rows[0] || {};

  const result = await pool.query(
    `
    INSERT INTO accounting.receipt_draft_details (
      draft_receipt_id,
      receipt_import_id,

      transaction_date,
      receipt_time_text,

      vendor_name,
      vendor_address,
      vendor_phone,

      payment_method_id,

      total_amount,
      tax_total_amount,

      invoice_number,
      invoice_type_id,

      evidence_type_id,
      evidence_memo,

      target_person_id,

      summary,
      memo,

      account_title_id,
      purpose_id,
      project_id,
      department_id,

      ocr_raw_text,
      ai_confidence
    ) VALUES (
      $1, $2,
      $3, $4,
      $5, $6, $7,
      $8,
      $9, $10,
      $11, $12,
      $13, $14,
      $15,
      $16, $17,
      $18, $19, $20, $21,
      $22, $23
    )
    RETURNING *
    `,
    [
      draftReceiptId,
      receiptImportId,

      __receiptNew6FirstDefined(draft.transactionDate, draft.transaction_date),
      __receiptNew6Text(__receiptNew6FirstDefined(draft.receiptTimeText, draft.receipt_time_text)),

      __receiptNew6Text(__receiptNew6FirstDefined(draft.vendorName, draft.vendor_name)),
      __receiptNew6Text(__receiptNew6FirstDefined(draft.vendorAddress, draft.vendor_address)),
      __receiptNew6Text(__receiptNew6FirstDefined(draft.vendorPhone, draft.vendor_phone)),

      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(draft.paymentMethodId, draft.payment_method_id)),

      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(draft.totalAmount, draft.total_amount)),
      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(draft.taxAmount, draft.tax_total_amount, draft.tax_amount)),

      __receiptNew6Text(__receiptNew6FirstDefined(draft.invoiceNumber, draft.invoice_number)),
      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(draft.invoiceTypeId, draft.invoice_type_id)),

      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(draft.evidenceTypeId, draft.evidence_type_id)),
      __receiptNew6Text(__receiptNew6FirstDefined(draft.evidenceMemo, draft.evidence_memo)),

      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(draft.targetPersonId, draft.target_person_id)),

      __receiptNew6Text(draft.summary),
      __receiptNew6Text(draft.memo),

      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(draft.accountTitleId, draft.account_title_id)),
      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(draft.purposeId, draft.purpose_id)),
      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(draft.projectId, draft.project_id)),
      __receiptNew6ToNumberOrNull(__receiptNew6FirstDefined(draft.departmentId, draft.department_id)),

      __receiptNew6Text(__receiptNew6FirstDefined(draft.ocrRawText, draft.ocr_raw_text, importItem.ocr_raw_text)),
      __receiptNew6PickConfidence(draft || {})
    ]
  );

  return result.rows[0] || null;
}

async function createReceiptDraftFromAiConfidenceV3(receiptImportId, draft) {
  const receiptDraft = await createReceiptDraftFromImport(receiptImportId);

  if (!receiptDraft) {
    return null;
  }

  const detail = await createReceiptDraftDetailFromAiConfidenceV2(
    Number(receiptDraft.draft_receipt_id),
    Number(receiptImportId),
    draft || {}
  );

  const rawLineItems = __receiptNew6BuildLineItems(draft || {});
  const lineItems = __receiptNew6ApplyTaxFallbackToLineItems(rawLineItems, draft || {});

  const breakdowns = detail
    ? await replaceReceiptDraftDetailBreakdowns(
        Number(receiptDraft.draft_receipt_id),
        Number(detail.draft_receipt_detail_id),
        lineItems
      )
    : [];

  return {
    ...(detail || {}),

    id: detail ? detail.draft_receipt_detail_id : null,
    draft_receipt_id: receiptDraft.draft_receipt_id,
    draftReceiptId: receiptDraft.draft_receipt_id,
    draft_receipt_detail_id: detail ? detail.draft_receipt_detail_id : null,
    draftReceiptDetailId: detail ? detail.draft_receipt_detail_id : null,
    receipt_import_id: receiptImportId,
    receiptImportId,

    confidence: detail ? detail.ai_confidence : null,
    aiConfidence: detail ? detail.ai_confidence : null,
    ai_confidence: detail ? detail.ai_confidence : null,

    line_items: lineItems,
    lineItems,
    breakdowns
  };
}

async function getReceiptDraftByImportIdConfidenceV3(receiptImportId) {
  const draftResult = await pool.query(
    `
    SELECT *
    FROM accounting.receipt_drafts
    WHERE receipt_import_id = $1
    ORDER BY draft_receipt_id DESC
    LIMIT 1
    `,
    [receiptImportId]
  );

  const draft = draftResult.rows[0] || null;

  if (!draft) {
    return null;
  }

  const detailsResult = await pool.query(
    `
    SELECT
      *,
      to_char(transaction_date, 'YYYY-MM-DD') AS transaction_date_text
    FROM accounting.receipt_draft_details
    WHERE draft_receipt_id = $1
    ORDER BY draft_receipt_detail_id DESC
    `,
    [draft.draft_receipt_id]
  );

  const breakdownsResult = await pool.query(
    `
    SELECT
      b.*,
      tc.tax_name AS tax_category_name,
      tc.tax_rate AS tax_rate,
      tt.treatment_name AS tax_treatment_name
    FROM accounting.receipt_draft_detail_breakdowns b
    LEFT JOIN expenses.tax_categories tc
      ON tc.tax_category_id = b.tax_category_id
    LEFT JOIN expenses.tax_treatments tt
      ON tt.tax_treatment_id = b.tax_treatment_id
    WHERE b.draft_receipt_id = $1
    ORDER BY b.draft_receipt_detail_id, b.draft_receipt_detail_breakdown_id
    `,
    [draft.draft_receipt_id]
  );

  const breakdownsByDetailId = new Map();

  for (const row of breakdownsResult.rows) {
    const key = Number(row.draft_receipt_detail_id);
    if (!breakdownsByDetailId.has(key)) {
      breakdownsByDetailId.set(key, []);
    }

    const name = row.item_name || "";

    breakdownsByDetailId.get(key).push({
      ...row,

      id: row.draft_receipt_detail_breakdown_id,

      item_name: name,
      itemName: name,
      product_name: name,
      productName: name,
      name: name,
      description: name,
      title: name,

      quantity: row.quantity,
      qty: row.quantity,

      unit_price: row.unit_price,
      unitPrice: row.unit_price,

      amount: row.amount,
      total: row.amount,
      price: row.amount,

      tax_category_id: row.tax_category_id,
      taxCategoryId: row.tax_category_id,
      tax_category_name: row.tax_category_name || "",
      taxCategoryName: row.tax_category_name || "",
      tax_rate: row.tax_rate,
      taxRate: row.tax_rate,

      tax_treatment_id: row.tax_treatment_id,
      taxTreatmentId: row.tax_treatment_id,
      tax_treatment_name: row.tax_treatment_name || "",
      taxTreatmentName: row.tax_treatment_name || "",

      note: row.note || "",
      memo: row.note || "",
      remarks: row.note || ""
    });
  }

  const details = detailsResult.rows.map((detail) => {
    const key = Number(detail.draft_receipt_detail_id);
    const breakdowns = breakdownsByDetailId.get(key) || [];
    const transactionDateText = detail.transaction_date_text || "";

    return {
      ...detail,

      id: detail.draft_receipt_detail_id,

      transaction_date: transactionDateText,
      transactionDate: transactionDateText,
      receipt_date: transactionDateText,
      receiptDate: transactionDateText,

      confidence: detail.ai_confidence,
      aiConfidence: detail.ai_confidence,
      ai_confidence: detail.ai_confidence,

      tax_amount: detail.tax_total_amount,
      taxAmount: detail.tax_total_amount,
      tax_total_amount: detail.tax_total_amount,
      taxTotalAmount: detail.tax_total_amount,

      total_amount: detail.total_amount,
      totalAmount: detail.total_amount,

      vendor_name: detail.vendor_name,
      vendorName: detail.vendor_name,

      payment_method_id: detail.payment_method_id,
      paymentMethodId: detail.payment_method_id,

      account_title_id: detail.account_title_id,
      accountTitleId: detail.account_title_id,

      purpose_id: detail.purpose_id,
      purposeId: detail.purpose_id,

      project_id: detail.project_id,
      projectId: detail.project_id,

      department_id: detail.department_id,
      departmentId: detail.department_id,

      breakdowns,
      line_items: breakdowns,
      lineItems: breakdowns,
      items: breakdowns
    };
  });

  return {
    ...draft,
    details
  };
}

module.exports.createReceiptDraftDetailFromAi = createReceiptDraftDetailFromAiConfidenceV2;
module.exports.createReceiptDraftFromAi = createReceiptDraftFromAiConfidenceV3;
module.exports.getReceiptDraftByImportId = getReceiptDraftByImportIdConfidenceV3;
/* RECEIPT_NEW_6_CONFIDENCE_20260705_END */

/* RECEIPT_POST_SAVE_REPOSITORY_20260705_START */
/*
  下書き3テーブルから本保存3テーブルへ確定保存する。
  慎重保存:
  - 下書きは削除しない
  - 画像は削除しない
  - 1レシートごとにトランザクション
  - source_draft_receipt_id で二重本保存を防ぐ
*/
function __receiptPostSaveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function __receiptPostSaveMissing(value) {
  return value === undefined || value === null || value === "";
}

async function postReceiptDraftByImportId(receiptImportId, options = {}) {
  const importId = __receiptPostSaveNumber(receiptImportId);

  if (!importId || importId <= 0) {
    throw new Error("receipt_import_id が不正です。");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const draftResult = await client.query(
      `
      SELECT *
      FROM accounting.receipt_drafts
      WHERE receipt_import_id = $1
      ORDER BY draft_receipt_id DESC
      LIMIT 1
      FOR UPDATE
      `,
      [importId]
    );

    const draft = draftResult.rows[0] || null;

    if (!draft) {
      await client.query("COMMIT");
      return {
        ok: false,
        skipped: true,
        reason: "draft_not_found",
        receipt_import_id: importId,
        message: "下書きがありません。"
      };
    }

    const existingResult = await client.query(
      `
      SELECT *
      FROM accounting.receipts
      WHERE source_draft_receipt_id = $1
      ORDER BY receipt_id DESC
      LIMIT 1
      `,
      [draft.draft_receipt_id]
    );

    const existing = existingResult.rows[0] || null;

    if (existing) {
      await client.query(
        `
        UPDATE accounting.receipt_drafts
        SET draft_status = '本保存済み',
            updated_at = NOW()
        WHERE draft_receipt_id = $1
        `,
        [draft.draft_receipt_id]
      );

      await client.query(
        `
        UPDATE accounting.receipt_imports
        SET status = '本保存済み',
            updated_at = NOW()
        WHERE id = $1
        `,
        [importId]
      );

      await client.query("COMMIT");

      return {
        ok: true,
        already_saved: true,
        receipt_import_id: importId,
        draft_receipt_id: draft.draft_receipt_id,
        receipt_id: existing.receipt_id,
        message: "既に本保存済みです。二重登録はしていません。"
      };
    }

    const detailsResult = await client.query(
      `
      SELECT *
      FROM accounting.receipt_draft_details
      WHERE draft_receipt_id = $1
      ORDER BY draft_receipt_detail_id
      FOR UPDATE
      `,
      [draft.draft_receipt_id]
    );

    const details = detailsResult.rows || [];

    if (!details.length) {
      await client.query("COMMIT");
      return {
        ok: false,
        skipped: true,
        reason: "detail_not_found",
        receipt_import_id: importId,
        draft_receipt_id: draft.draft_receipt_id,
        message: "下書き明細がありません。"
      };
    }

    const validationErrors = [];

    details.forEach((detail, index) => {
      const label = "明細" + String(index + 1);

      if (__receiptPostSaveMissing(detail.account_title_id)) {
        validationErrors.push(label + ": 勘定科目が未選択です。");
      }

      if (__receiptPostSaveMissing(detail.total_amount)) {
        validationErrors.push(label + ": 合計金額が未入力です。");
      }
    });

    if (validationErrors.length) {
      await client.query("COMMIT");
      return {
        ok: false,
        skipped: true,
        reason: "validation_error",
        receipt_import_id: importId,
        draft_receipt_id: draft.draft_receipt_id,
        message: validationErrors.join(" / "),
        validation_errors: validationErrors
      };
    }

    const receiptResult = await client.query(
      `
      INSERT INTO accounting.receipts (
        source_draft_receipt_id,
        receipt_import_id,
        receipt_name,
        receipt_image_path,
        receipt_imported_at,
        image_hash_sha256,
        saved_status,
        saved_at,
        created_at,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        '本保存済み',
        NOW(),
        NOW(),
        NOW()
      )
      RETURNING *
      `,
      [
        draft.draft_receipt_id,
        draft.receipt_import_id,
        draft.receipt_name,
        draft.receipt_image_path,
        draft.receipt_imported_at,
        draft.image_hash_sha256
      ]
    );

    const receipt = receiptResult.rows[0];
    const detailIdMap = new Map();

    for (const detail of details) {
      const savedDetailResult = await client.query(
        `
        INSERT INTO accounting.receipt_details (
          receipt_id,
          source_draft_receipt_detail_id,
          transaction_date,
          receipt_time_text,
          vendor_name,
          vendor_address,
          vendor_phone,
          payment_method_id,
          total_amount,
          tax_total_amount,
          invoice_number,
          invoice_type_id,
          evidence_type_id,
          evidence_memo,
          target_person_id,
          summary,
          memo,
          account_title_id,
          purpose_id,
          project_id,
          department_id,
          ocr_raw_text,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22,
          NOW(), NOW()
        )
        RETURNING *
        `,
        [
          receipt.receipt_id,
          detail.draft_receipt_detail_id,
          detail.transaction_date,
          detail.receipt_time_text,
          detail.vendor_name,
          detail.vendor_address,
          detail.vendor_phone,
          detail.payment_method_id,
          detail.total_amount,
          detail.tax_total_amount,
          detail.invoice_number,
          detail.invoice_type_id,
          detail.evidence_type_id,
          detail.evidence_memo,
          detail.target_person_id,
          detail.summary,
          detail.memo,
          detail.account_title_id,
          detail.purpose_id,
          detail.project_id,
          detail.department_id,
          detail.ocr_raw_text
        ]
      );

      const savedDetail = savedDetailResult.rows[0];
      detailIdMap.set(Number(detail.draft_receipt_detail_id), Number(savedDetail.receipt_detail_id));
    }

    const breakdownResult = await client.query(
      `
      SELECT *
      FROM accounting.receipt_draft_detail_breakdowns
      WHERE draft_receipt_id = $1
      ORDER BY draft_receipt_detail_breakdown_id
      `,
      [draft.draft_receipt_id]
    );

    let savedBreakdownCount = 0;

    for (const breakdown of breakdownResult.rows || []) {
      const receiptDetailId = detailIdMap.get(Number(breakdown.draft_receipt_detail_id));

      if (!receiptDetailId) {
        throw new Error("明細内訳の親明細が見つかりません。draft_breakdown_id=" + breakdown.draft_receipt_detail_breakdown_id);
      }

      await client.query(
        `
        INSERT INTO accounting.receipt_detail_breakdowns (
          receipt_id,
          receipt_detail_id,
          source_draft_receipt_detail_breakdown_id,
          item_name,
          quantity,
          unit_price,
          amount,
          tax_category_id,
          tax_treatment_id,
          note,
          created_at,
          updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10,
          NOW(), NOW()
        )
        `,
        [
          receipt.receipt_id,
          receiptDetailId,
          breakdown.draft_receipt_detail_breakdown_id,
          breakdown.item_name,
          breakdown.quantity,
          breakdown.unit_price,
          breakdown.amount,
          breakdown.tax_category_id,
          breakdown.tax_treatment_id,
          breakdown.note
        ]
      );

      savedBreakdownCount++;
    }

    await client.query(
      `
      UPDATE accounting.receipt_drafts
      SET draft_status = '本保存済み',
          updated_at = NOW()
      WHERE draft_receipt_id = $1
      `,
      [draft.draft_receipt_id]
    );

    await client.query(
      `
      UPDATE accounting.receipt_imports
      SET status = '本保存済み',
          updated_at = NOW()
      WHERE id = $1
      `,
      [importId]
    );

    await client.query("COMMIT");

    return {
      ok: true,
      receipt_import_id: importId,
      draft_receipt_id: draft.draft_receipt_id,
      receipt_id: receipt.receipt_id,
      detail_count: details.length,
      breakdown_count: savedBreakdownCount,
      message: "本保存しました。"
    };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}

    throw error;
  } finally {
    client.release();
  }
}

module.exports.postReceiptDraftByImportId = postReceiptDraftByImportId;
/* RECEIPT_POST_SAVE_REPOSITORY_20260705_END */


