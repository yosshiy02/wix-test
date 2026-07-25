const pool = require("../db");

function normalizeLimit(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.round(n), 500);
}

function normalizeOffset(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function nullableText(value) {
  const s = String(value ?? "").trim();
  return s || null;
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  return n;
}

function nullableDate(value) {
  const s = String(value ?? "").trim();
  if (!s) return null;
  return s.slice(0, 10);
}

async function listImports(options = {}) {
  const limit = normalizeLimit(options.limit, 100);
  const offset = normalizeOffset(options.offset);

  const result = await pool.query(
    `
    SELECT
      id,
      local_image_file_name,
      local_image_path,
      original_file_name,
      image_hash_sha256,
      image_size_bytes,
      mime_type,
      source_type,
      import_status,
      ocr_status,
      ocr_provider,
      ocr_raw_text,
      ai_status,
      ai_json,
      captured_at_jst,
      imported_at_jst,
      created_at,
      updated_at
    FROM accounting.delivery_note_imports
    ORDER BY imported_at_jst DESC NULLS LAST, id DESC
    LIMIT $1 OFFSET $2
    `,
    [limit, offset]
  );

  return result.rows;
}

async function getImportById(id) {
  const result = await pool.query(
    `
    SELECT *
    FROM accounting.delivery_note_imports
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function createImport(payload) {
  const result = await pool.query(
    `
    INSERT INTO accounting.delivery_note_imports (
      local_image_file_name,
      local_image_path,
      original_file_name,
      image_hash_sha256,
      image_size_bytes,
      mime_type,
      source_type,
      import_status,
      ocr_status,
      ocr_provider,
      ocr_raw_text,
      ai_status,
      ai_json
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING *
    `,
    [
      payload.local_image_file_name,
      payload.local_image_path,
      payload.original_file_name || payload.local_image_file_name,
      payload.image_hash_sha256 || null,
      payload.image_size_bytes || null,
      payload.mime_type || null,
      payload.source_type || "manual_upload",
      payload.import_status || "取込済み",
      payload.ocr_status || "未OCR",
      payload.ocr_provider || null,
      payload.ocr_raw_text || null,
      payload.ai_status || "未解析",
      payload.ai_json || null
    ]
  );

  return result.rows[0];
}

async function updateImportOcrRawText(id, ocrRawText) {
  const result = await pool.query(
    `
    UPDATE accounting.delivery_note_imports
    SET
      ocr_raw_text = $2,
      ocr_status = CASE WHEN COALESCE($2, '') = '' THEN '未OCR' ELSE 'OCR本文あり' END,
      updated_at = now()
    WHERE id = $1
    RETURNING *
    `,
    [id, ocrRawText || null]
  );

  return result.rows[0] || null;
}

async function updateImportAiResult(id, aiJson) {
  const result = await pool.query(
    `
    UPDATE accounting.delivery_note_imports
    SET
      ai_json = $2,
      ai_status = '解析済み',
      updated_at = now()
    WHERE id = $1
    RETURNING *
    `,
    [id, aiJson || null]
  );

  return result.rows[0] || null;
}

async function getDraftByImportId(importId) {
  const result = await pool.query(
    `
    SELECT *
    FROM accounting.delivery_note_drafts
    WHERE import_id = $1
    ORDER BY delivery_note_draft_id DESC
    LIMIT 1
    `,
    [importId]
  );

  const draft = result.rows[0] || null;
  if (!draft) return null;

  const detailResult = await pool.query(
    `
    SELECT *
    FROM accounting.delivery_note_draft_details
    WHERE delivery_note_draft_id = $1
    ORDER BY line_no ASC, delivery_note_draft_detail_id ASC
    `,
    [draft.delivery_note_draft_id]
  );

  return {
    ...draft,
    lines: detailResult.rows
  };
}

async function saveDraft(payload) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const importId = Number(payload.import_id || payload.importId || 0) || null;
    const lines = Array.isArray(payload.lines) ? payload.lines : [];

    let draftId = null;

    if (importId) {
      const existing = await client.query(
        `
        SELECT delivery_note_draft_id
        FROM accounting.delivery_note_drafts
        WHERE import_id = $1
        ORDER BY delivery_note_draft_id DESC
        LIMIT 1
        `,
        [importId]
      );

      if (existing.rows[0]) {
        draftId = existing.rows[0].delivery_note_draft_id;
      }
    }

    const values = [
      importId,
      nullableDate(payload.delivery_date || payload.deliveryDate),
      nullableText(payload.vendor_name || payload.vendorName),
      nullableText(payload.delivery_note_no || payload.deliveryNoteNo),
      nullableNumber(payload.total_quantity || payload.totalQuantity),
      nullableNumber(payload.subtotal_amount || payload.subtotalAmount),
      nullableNumber(payload.tax_amount || payload.taxAmount),
      nullableNumber(payload.total_amount || payload.totalAmount),
      nullableText(payload.summary),
      nullableText(payload.memo),
      nullableText(payload.ocr_raw_text || payload.ocrRawText),
      payload.ai_json || payload.aiJson || null
    ];

    let draft;

    if (draftId) {
      const updated = await client.query(
        `
        UPDATE accounting.delivery_note_drafts
        SET
          import_id = $1,
          delivery_date = $2,
          vendor_name = $3,
          delivery_note_no = $4,
          total_quantity = $5,
          subtotal_amount = $6,
          tax_amount = $7,
          total_amount = $8,
          summary = $9,
          memo = $10,
          ocr_raw_text = $11,
          ai_json = $12,
          updated_at = now()
        WHERE delivery_note_draft_id = $13
        RETURNING *
        `,
        [...values, draftId]
      );

      draft = updated.rows[0];

      await client.query(
        `DELETE FROM accounting.delivery_note_draft_details WHERE delivery_note_draft_id = $1`,
        [draftId]
      );
    } else {
      const inserted = await client.query(
        `
        INSERT INTO accounting.delivery_note_drafts (
          import_id,
          delivery_date,
          vendor_name,
          delivery_note_no,
          total_quantity,
          subtotal_amount,
          tax_amount,
          total_amount,
          summary,
          memo,
          ocr_raw_text,
          ai_json
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING *
        `,
        values
      );

      draft = inserted.rows[0];
      draftId = draft.delivery_note_draft_id;
    }

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] || {};

      await client.query(
        `
        INSERT INTO accounting.delivery_note_draft_details (
          delivery_note_draft_id,
          line_no,
          item_code,
          item_name,
          description,
          quantity,
          unit,
          unit_price,
          amount,
          tax_category_id,
          memo
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        `,
        [
          draftId,
          i + 1,
          nullableText(line.item_code || line.itemCode),
          nullableText(line.item_name || line.itemName),
          nullableText(line.description),
          nullableNumber(line.quantity),
          nullableText(line.unit),
          nullableNumber(line.unit_price || line.unitPrice),
          nullableNumber(line.amount),
          line.tax_category_id || line.taxCategoryId || null,
          nullableText(line.memo)
        ]
      );
    }

    if (importId) {
      await client.query(
        `
        UPDATE accounting.delivery_note_imports
        SET
          import_status = '下書き保存済み',
          ocr_raw_text = COALESCE($2, ocr_raw_text),
          updated_at = now()
        WHERE id = $1
        `,
        [importId, nullableText(payload.ocr_raw_text || payload.ocrRawText)]
      );
    }

    await client.query("COMMIT");

    return await getDraftByImportId(importId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listImports,
  getImportById,
  createImport,
  updateImportOcrRawText,
  updateImportAiResult,
  getDraftByImportId,
  saveDraft
};