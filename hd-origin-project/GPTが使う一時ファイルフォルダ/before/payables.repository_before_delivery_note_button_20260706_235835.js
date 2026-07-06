const db = require("../db");
function getPool() {
  if (db && db.pool && typeof db.pool.connect === "function") return db.pool;
  if (db && typeof db.connect === "function" && typeof db.query === "function") return db;
  return null;
}
async function baseQuery(sql, params) {
  if (db && typeof db.query === "function") {
    return db.query(sql, params);
  }
  if (db && db.pool && typeof db.pool.query === "function") {
    return db.pool.query(sql, params);
  }
  throw new Error("db.query が見つかりません。");
}
async function withTx(fn) {
  const pool = getPool();
  if (!pool) {
    return fn({ query: baseQuery });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
function toInt(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}
function toMoney(value) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}
function toText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}
function toDate(value) {
  const v = toText(value);
  return v ? v : null;
}
function normalizeStatus(value) {
  const v = toText(value) || "draft";
  return ["draft", "confirmed", "partially_paid", "paid", "void"].includes(v) ? v : "draft";
}
function normalizeDocumentType(value) {
  const v = toText(value) || "invoice";
  return ["invoice", "statement", "credit_note", "other"].includes(v) ? v : "invoice";
}
function normalizePayableKind(value) {
  const v = toText(value) || "unpaid";
  return ["accounts_payable", "unpaid", "accrued_expense", "card_payable", "other"].includes(v) ? v : "unpaid";
}
async function nextPayableNo(q) {
  const result = await q.query(`
    SELECT
      'PY-' ||
      to_char(now() AT TIME ZONE 'Asia/Tokyo', 'YYYYMMDD') ||
      '-' ||
      lpad(nextval('accounting.payable_no_seq')::text, 5, '0') AS payable_no
  `);
  return result.rows[0].payable_no;
}
async function recalcPayable(q, payableId) {
  const lineResult = await q.query(`
    SELECT
      COALESCE(SUM(amount_ex_tax), 0)::NUMERIC(14,2) AS subtotal_amount,
      COALESCE(SUM(tax_amount), 0)::NUMERIC(14,2) AS tax_amount,
      COALESCE(SUM(amount_in_tax), 0)::NUMERIC(14,2) AS total_amount
    FROM accounting.payable_lines
    WHERE payable_id = $1
  `, [payableId]);
  const paymentResult = await q.query(`
    SELECT
      COALESCE(SUM(payment_amount), 0)::NUMERIC(14,2) AS paid_amount
    FROM accounting.payable_payments
    WHERE payable_id = $1
  `, [payableId]);
  const totals = lineResult.rows[0] || {};
  const payments = paymentResult.rows[0] || {};
  const subtotal = toMoney(totals.subtotal_amount);
  const tax = toMoney(totals.tax_amount);
  const total = toMoney(totals.total_amount);
  const paid = toMoney(payments.paid_amount);
  const balance = Math.max(total - paid, 0);
  const statusResult = await q.query(`
    SELECT status
    FROM accounting.payable_documents
    WHERE payable_id = $1
  `, [payableId]);
  const oldStatus = statusResult.rows[0] ? statusResult.rows[0].status : "draft";
  let newStatus = oldStatus;
  if (oldStatus !== "void") {
    if (total > 0 && paid >= total) {
      newStatus = "paid";
    } else if (paid > 0) {
      newStatus = "partially_paid";
    } else if (oldStatus === "paid" || oldStatus === "partially_paid") {
      newStatus = "confirmed";
    }
  }
  await q.query(`
    UPDATE accounting.payable_documents
    SET
      subtotal_amount = $2,
      tax_amount = $3,
      total_amount = $4,
      paid_amount = $5,
      balance_amount = $6,
      status = $7,
      updated_at = now()
    WHERE payable_id = $1
  `, [payableId, subtotal, tax, total, paid, balance, newStatus]);
  if (oldStatus !== newStatus) {
    await q.query(`
      INSERT INTO accounting.payable_status_history
        (payable_id, old_status, new_status, reason)
      VALUES
        ($1, $2, $3, $4)
    `, [payableId, oldStatus, newStatus, "auto_recalc"]);
  }
  return {
    subtotal_amount: subtotal,
    tax_amount: tax,
    total_amount: total,
    paid_amount: paid,
    balance_amount: balance,
    status: newStatus
  };
}
async function listPayables(filters = {}) {
  const where = [];
  const params = [];
  function add(value) {
    params.push(value);
    return "$" + params.length;
  }
  if (filters.status) {
    where.push("effective_status = " + add(filters.status));
  }
  if (filters.vendor) {
    where.push("vendor_name ILIKE " + add("%" + filters.vendor + "%"));
  }
  if (filters.from) {
    where.push("document_date >= " + add(filters.from));
  }
  if (filters.to) {
    where.push("document_date <= " + add(filters.to));
  }
  if (filters.dueFrom) {
    where.push("due_date >= " + add(filters.dueFrom));
  }
  if (filters.dueTo) {
    where.push("due_date <= " + add(filters.dueTo));
  }
  if (filters.overdue === "1" || filters.overdue === "true") {
    where.push("is_overdue = true");
  }
  const sql = `
    SELECT *
    FROM accounting.v_payable_documents
    ${where.length ? "WHERE " + where.join(" AND ") : ""}
    ORDER BY
      CASE WHEN is_overdue THEN 0 ELSE 1 END,
      due_date NULLS LAST,
      payable_id DESC
    LIMIT 500
  `;
  const result = await baseQuery(sql, params);
  return result.rows;
}
async function getDashboard() {
  const result = await baseQuery(`
    SELECT
      COUNT(*) FILTER (WHERE effective_status IN ('draft','confirmed','partially_paid'))::INTEGER AS open_count,
      COALESCE(SUM(calculated_balance_amount) FILTER (WHERE effective_status IN ('draft','confirmed','partially_paid')), 0)::NUMERIC(14,2) AS open_balance,
      COUNT(*) FILTER (WHERE is_overdue)::INTEGER AS overdue_count,
      COALESCE(SUM(calculated_balance_amount) FILTER (WHERE is_overdue), 0)::NUMERIC(14,2) AS overdue_balance,
      COUNT(*) FILTER (
        WHERE due_date >= CURRENT_DATE
          AND due_date <= CURRENT_DATE + INTERVAL '7 days'
          AND effective_status IN ('draft','confirmed','partially_paid')
      )::INTEGER AS due_7_count,
      COALESCE(SUM(calculated_balance_amount) FILTER (
        WHERE due_date >= CURRENT_DATE
          AND due_date <= CURRENT_DATE + INTERVAL '7 days'
          AND effective_status IN ('draft','confirmed','partially_paid')
      ), 0)::NUMERIC(14,2) AS due_7_balance
    FROM accounting.v_payable_documents
  `);
  return result.rows[0] || {};
}
async function getPayable(payableId) {
  const headerResult = await baseQuery(`
    SELECT *
    FROM accounting.v_payable_documents
    WHERE payable_id = $1
  `, [payableId]);
  if (headerResult.rows.length === 0) {
    return null;
  }
  const linesResult = await baseQuery(`
    SELECT *
    FROM accounting.payable_lines
    WHERE payable_id = $1
    ORDER BY line_no
  `, [payableId]);
  const paymentsResult = await baseQuery(`
    SELECT *
    FROM accounting.payable_payments
    WHERE payable_id = $1
    ORDER BY payment_date, payable_payment_id
  `, [payableId]);
  const historyResult = await baseQuery(`
    SELECT *
    FROM accounting.payable_status_history
    WHERE payable_id = $1
    ORDER BY created_at DESC, payable_status_history_id DESC
    LIMIT 30
  `, [payableId]);
  return {
    header: headerResult.rows[0],
    lines: linesResult.rows,
    payments: paymentsResult.rows,
    history: historyResult.rows
  };
}
async function savePayable(payload = {}) {
  const document = payload.document || payload;
  const lines = Array.isArray(payload.lines) ? payload.lines : [];
  return withTx(async (q) => {
    const payableId = toInt(document.payable_id);
    let id = payableId;
    let payableNo = toText(document.payable_no);
    if (!id) {
      payableNo = payableNo || await nextPayableNo(q);
      const inserted = await q.query(`
        INSERT INTO accounting.payable_documents (
          payable_no,
          document_type,
          payable_kind,
          status,
          vendor_id,
          vendor_name,
          invoice_number,
          supplier_document_no,
          document_date,
          posting_date,
          due_date,
          payment_plan_date,
          currency_code,
          account_payable_title_id,
          payment_method_id,
          target_person_id,
          purpose_id,
          project_id,
          department_id,
          summary,
          memo,
          internal_note,
          evidence_type,
          evidence_file_name,
          evidence_file_path,
          source_memo,
          journal_status,
          created_by,
          updated_by
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29
        )
        RETURNING payable_id, payable_no
      `, [
        payableNo,
        normalizeDocumentType(document.document_type),
        normalizePayableKind(document.payable_kind),
        normalizeStatus(document.status),
        toInt(document.vendor_id),
        toText(document.vendor_name),
        toText(document.invoice_number),
        toText(document.supplier_document_no),
        toDate(document.document_date),
        toDate(document.posting_date),
        toDate(document.due_date),
        toDate(document.payment_plan_date),
        toText(document.currency_code) || "JPY",
        toInt(document.account_payable_title_id),
        toInt(document.payment_method_id),
        toInt(document.target_person_id),
        toInt(document.purpose_id),
        toInt(document.project_id),
        toInt(document.department_id),
        toText(document.summary),
        toText(document.memo),
        toText(document.internal_note),
        toText(document.evidence_type),
        toText(document.evidence_file_name),
        toText(document.evidence_file_path),
        toText(document.source_memo),
        toText(document.journal_status) || "not_created",
        toText(document.created_by),
        toText(document.updated_by)
      ]);
      id = inserted.rows[0].payable_id;
      payableNo = inserted.rows[0].payable_no;
      await q.query(`
        INSERT INTO accounting.payable_status_history
          (payable_id, old_status, new_status, reason)
        VALUES
          ($1, '', $2, 'created')
      `, [id, normalizeStatus(document.status)]);
    } else {
      const oldResult = await q.query(`
        SELECT status
        FROM accounting.payable_documents
        WHERE payable_id = $1
          AND deleted_at IS NULL
      `, [id]);
      if (oldResult.rows.length === 0) {
        throw new Error("更新対象の請求書・未払データが見つかりません。");
      }
      const oldStatus = oldResult.rows[0].status;
      const newStatus = normalizeStatus(document.status);
      const updated = await q.query(`
        UPDATE accounting.payable_documents
        SET
          document_type = $2,
          payable_kind = $3,
          status = $4,
          vendor_id = $5,
          vendor_name = $6,
          invoice_number = $7,
          supplier_document_no = $8,
          document_date = $9,
          posting_date = $10,
          due_date = $11,
          payment_plan_date = $12,
          currency_code = $13,
          account_payable_title_id = $14,
          payment_method_id = $15,
          target_person_id = $16,
          purpose_id = $17,
          project_id = $18,
          department_id = $19,
          summary = $20,
          memo = $21,
          internal_note = $22,
          evidence_type = $23,
          evidence_file_name = $24,
          evidence_file_path = $25,
          source_memo = $26,
          journal_status = $27,
          updated_by = $28,
          updated_at = now()
        WHERE payable_id = $1
          AND deleted_at IS NULL
        RETURNING payable_id, payable_no
      `, [
        id,
        normalizeDocumentType(document.document_type),
        normalizePayableKind(document.payable_kind),
        newStatus,
        toInt(document.vendor_id),
        toText(document.vendor_name),
        toText(document.invoice_number),
        toText(document.supplier_document_no),
        toDate(document.document_date),
        toDate(document.posting_date),
        toDate(document.due_date),
        toDate(document.payment_plan_date),
        toText(document.currency_code) || "JPY",
        toInt(document.account_payable_title_id),
        toInt(document.payment_method_id),
        toInt(document.target_person_id),
        toInt(document.purpose_id),
        toInt(document.project_id),
        toInt(document.department_id),
        toText(document.summary),
        toText(document.memo),
        toText(document.internal_note),
        toText(document.evidence_type),
        toText(document.evidence_file_name),
        toText(document.evidence_file_path),
        toText(document.source_memo),
        toText(document.journal_status) || "not_created",
        toText(document.updated_by)
      ]);
      payableNo = updated.rows[0].payable_no;
      if (oldStatus !== newStatus) {
        await q.query(`
          INSERT INTO accounting.payable_status_history
            (payable_id, old_status, new_status, reason)
          VALUES
            ($1, $2, $3, 'manual_update')
        `, [id, oldStatus, newStatus]);
      }
    }
    await q.query(`
      DELETE FROM accounting.payable_lines
      WHERE payable_id = $1
    `, [id]);
    let lineNo = 1;
    for (const line of lines) {
      const amountExTax = toMoney(line.amount_ex_tax);
      const taxAmount = toMoney(line.tax_amount);
      const amountInTax = toMoney(line.amount_in_tax) || amountExTax + taxAmount;
      await q.query(`
        INSERT INTO accounting.payable_lines (
          payable_id,
          line_no,
          account_title_id,
          tax_category_id,
          item_name,
          description,
          quantity,
          unit_price,
          amount_ex_tax,
          tax_rate,
          tax_amount,
          amount_in_tax,
          target_person_id,
          purpose_id,
          project_id,
          department_id,
          memo
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17
        )
      `, [
        id,
        lineNo,
        toInt(line.account_title_id),
        toInt(line.tax_category_id),
        toText(line.item_name),
        toText(line.description),
        toMoney(line.quantity) || 1,
        toMoney(line.unit_price),
        amountExTax,
        toMoney(line.tax_rate),
        taxAmount,
        amountInTax,
        toInt(line.target_person_id),
        toInt(line.purpose_id),
        toInt(line.project_id),
        toInt(line.department_id),
        toText(line.memo)
      ]);
      lineNo++;
    }
    const totals = await recalcPayable(q, id);
    return {
      payable_id: id,
      payable_no: payableNo,
      totals
    };
  });
}
async function addPayment(payableId, payload = {}) {
  return withTx(async (q) => {
    const id = toInt(payableId);
    if (!id) {
      throw new Error("payable_id が不正です。");
    }
    const paymentAmount = toMoney(payload.payment_amount);
    if (paymentAmount <= 0) {
      throw new Error("支払額は1円以上で入力してください。");
    }
    await q.query(`
      INSERT INTO accounting.payable_payments (
        payable_id,
        payment_date,
        payment_method_id,
        payment_amount,
        bank_fee_amount,
        withholding_tax_amount,
        memo,
        journal_status
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8
      )
    `, [
      id,
      toDate(payload.payment_date),
      toInt(payload.payment_method_id),
      paymentAmount,
      toMoney(payload.bank_fee_amount),
      toMoney(payload.withholding_tax_amount),
      toText(payload.memo),
      toText(payload.journal_status) || "not_created"
    ]);
    return recalcPayable(q, id);
  });
}
async function deletePayment(payableId, paymentId) {
  return withTx(async (q) => {
    const id = toInt(payableId);
    const pid = toInt(paymentId);
    if (!id || !pid) {
      throw new Error("支払IDが不正です。");
    }
    await q.query(`
      DELETE FROM accounting.payable_payments
      WHERE payable_id = $1
        AND payable_payment_id = $2
    `, [id, pid]);
    return recalcPayable(q, id);
  });
}
async function deletePayable(payableId) {
  return withTx(async (q) => {
    const id = toInt(payableId);
    if (!id) {
      throw new Error("payable_id が不正です。");
    }
    const oldResult = await q.query(`
      SELECT status
      FROM accounting.payable_documents
      WHERE payable_id = $1
        AND deleted_at IS NULL
    `, [id]);
    if (oldResult.rows.length === 0) {
      throw new Error("削除対象が見つかりません。");
    }
    await q.query(`
      UPDATE accounting.payable_documents
      SET
        status = 'void',
        deleted_at = now(),
        updated_at = now()
      WHERE payable_id = $1
    `, [id]);
    await q.query(`
      INSERT INTO accounting.payable_status_history
        (payable_id, old_status, new_status, reason)
      VALUES
        ($1, $2, 'void', 'soft_delete')
    `, [id, oldResult.rows[0].status]);
    return { payable_id: id };
  });
}
module.exports = {
  listPayables,
  getDashboard,
  getPayable,
  savePayable,
  addPayment,
  deletePayment,
  deletePayable
};
