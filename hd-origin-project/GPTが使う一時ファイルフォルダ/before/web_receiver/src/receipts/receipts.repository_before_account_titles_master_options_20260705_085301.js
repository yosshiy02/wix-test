const pool = require("../db");

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
      updated_at
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
      $7, $8, $9, $10, $11, $12,
      $13, $14, $15, $16, $17::jsonb,
      'draft', $18, $19::jsonb, ''
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



