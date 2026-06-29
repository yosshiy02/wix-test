const db = require("../db");

function getRows(result) {
  if (Array.isArray(result)) return result;
  if (result && Array.isArray(result.rows)) return result.rows;
  return [];
}

async function runQuery(sql, params) {
  if (db && typeof db.query === "function") {
    return db.query(sql, params);
  }

  if (db && db.pool && typeof db.pool.query === "function") {
    return db.pool.query(sql, params);
  }

  if (db && db.default && typeof db.default.query === "function") {
    return db.default.query(sql, params);
  }

  throw new Error("db.query が見つかりません。src/db.js の export 形式を確認してください。");
}

async function listImports(options = {}) {
  const limit = Math.min(Math.max(parseInt(options.limit || 100, 10), 1), 500);
  const offset = Math.max(parseInt(options.offset || 0, 10), 0);

  const result = await runQuery(
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
    [limit, offset]
  );

  return getRows(result);
}

async function getImportById(id) {
  const result = await runQuery(
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

  return getRows(result)[0] || null;
}

module.exports = {
  listImports,
  getImportById
};
