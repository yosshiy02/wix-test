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

async function createAiDraft(receiptImportId, draft) {
  const result = await pool.query(
    `
    INSERT INTO accounting.receipt_ai_drafts (
      receipt_import_id,
      transaction_date,
      vendor_name,
      total_amount,
      tax_amount,
      tax_rate,
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
      $13::jsonb, 'draft', $14, $15::jsonb, ''
    )
    RETURNING *
    `,
    [
      receiptImportId,
      draft.transactionDate,
      draft.vendorName,
      draft.totalAmount,
      draft.taxAmount,
      draft.taxRate,
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

  return result.rows[0];
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
      total_amount = $4,
      tax_amount = $5,
      tax_rate = $6,
      payment_method_name = $7,
      account_title_name = $8,
      invoice_number = $9,
      summary = $10,
      memo = $11,
      confidence = $12,
      line_items = $13::jsonb,
      status = $14,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
    `,
    [
      id,
      patch.transactionDate || null,
      patch.vendorName || "",
      patch.totalAmount === "" || patch.totalAmount === undefined ? null : Number(patch.totalAmount),
      patch.taxAmount === "" || patch.taxAmount === undefined ? null : Number(patch.taxAmount),
      patch.taxRate || "",
      patch.paymentMethodName || "",
      patch.accountTitleName || "",
      patch.invoiceNumber || "",
      patch.summary || "",
      patch.memo || "",
      patch.confidence === "" || patch.confidence === undefined ? null : Number(patch.confidence),
      JSON.stringify(Array.isArray(patch.lineItems) ? patch.lineItems : []),
      patch.status || "draft"
    ]
  );

  return result.rows[0] || null;
}

module.exports = {
  listImports,
  getImportById,
  createAiDraft,
  getAiDrafts,
  updateAiDraft,
};