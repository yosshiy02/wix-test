"use strict";

const pool = require("../db");

const DIRECTIONS = new Set([
  "sales",
  "purchase",
  "manufacturing_outsource",
  "manufacturing_consign"
]);

const CALCULATION_BASES = new Set([
  "line_amount",
  "subtotal",
  "invoice_total",
  "processing_fee",
  "custom"
]);

const TAX_BASES = new Set([
  "before_tax",
  "after_tax",
  "not_applicable"
]);

const FREIGHT_TREATMENTS = new Set([
  "include",
  "exclude",
  "separate",
  "not_applicable"
]);

const ROUNDING_METHODS = new Set([
  "round_down",
  "round",
  "round_up",
  "none"
]);

const ROUNDING_UNITS = new Set([1, 10, 100, 1000]);

function text(value) {
  return String(value ?? "").trim();
}

function nullableText(value) {
  const normalized = text(value);
  return normalized || null;
}

function nullableNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number;
}

function booleanValue(value, defaultValue = true) {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  if (
    value === true ||
    value === 1 ||
    String(value).toLowerCase() === "true"
  ) {
    return true;
  }

  if (
    value === false ||
    value === 0 ||
    String(value).toLowerCase() === "false"
  ) {
    return false;
  }

  return defaultValue;
}

function parseStructuredRule(value) {
  if (value === undefined || value === null || value === "") {
    return {};
  }

  if (
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return value;
  }

  let parsed;

  try {
    parsed = JSON.parse(String(value));
  } catch {
    const error = new Error(
      "構造化JSONの書式が正しくありません。"
    );
    error.statusCode = 400;
    throw error;
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    const error = new Error(
      "構造化JSONはJSONオブジェクトで入力してください。"
    );
    error.statusCode = 400;
    throw error;
  }

  return parsed;
}

function normalizePayload(payload) {
  const companyId = Number(payload.company_id);
  const transactionDirection =
    text(payload.transaction_direction);

  if (!Number.isInteger(companyId) || companyId <= 0) {
    const error = new Error("会社を選択してください。");
    error.statusCode = 400;
    throw error;
  }

  if (!DIRECTIONS.has(transactionDirection)) {
    const error = new Error("取引方向が不正です。");
    error.statusCode = 400;
    throw error;
  }

  const ruleName = text(payload.rule_name);

  if (!ruleName) {
    const error = new Error("ルール名を入力してください。");
    error.statusCode = 400;
    throw error;
  }

  const calculationBase =
    text(payload.calculation_base) || "subtotal";

  const taxBase =
    text(payload.tax_base) || "before_tax";

  const freightTreatment =
    text(payload.freight_treatment) || "exclude";

  const roundingMethod =
    text(payload.rounding_method) || "round_down";

  const roundingUnit =
    Number(payload.rounding_unit || 1);

  if (!CALCULATION_BASES.has(calculationBase)) {
    const error = new Error("計算基準が不正です。");
    error.statusCode = 400;
    throw error;
  }

  if (!TAX_BASES.has(taxBase)) {
    const error = new Error("税計算基準が不正です。");
    error.statusCode = 400;
    throw error;
  }

  if (!FREIGHT_TREATMENTS.has(freightTreatment)) {
    const error = new Error("送料の扱いが不正です。");
    error.statusCode = 400;
    throw error;
  }

  if (!ROUNDING_METHODS.has(roundingMethod)) {
    const error = new Error("端数処理が不正です。");
    error.statusCode = 400;
    throw error;
  }

  if (!ROUNDING_UNITS.has(roundingUnit)) {
    const error = new Error("端数単位が不正です。");
    error.statusCode = 400;
    throw error;
  }

  const deductionRate =
    nullableNumber(payload.deduction_rate);

  const fixedAmount =
    nullableNumber(payload.deduction_fixed_amount);

  if (deductionRate !== null && deductionRate < 0) {
    const error = new Error("歩引き率は0以上で入力してください。");
    error.statusCode = 400;
    throw error;
  }

  if (fixedAmount !== null && fixedAmount < 0) {
    const error = new Error("固定控除額は0以上で入力してください。");
    error.statusCode = 400;
    throw error;
  }

  const effectiveFrom =
    nullableText(payload.effective_from);

  const effectiveTo =
    nullableText(payload.effective_to);

  if (
    effectiveFrom &&
    effectiveTo &&
    effectiveTo < effectiveFrom
  ) {
    const error = new Error(
      "適用終了日は適用開始日以降にしてください。"
    );
    error.statusCode = 400;
    throw error;
  }

  return {
    company_id: companyId,
    transaction_direction: transactionDirection,
    rule_name: ruleName,
    deduction_enabled: booleanValue(
      payload.deduction_enabled,
      false
    ),
    deduction_rate: deductionRate,
    deduction_fixed_amount: fixedAmount,
    calculation_base: calculationBase,
    tax_base: taxBase,
    freight_treatment: freightTreatment,
    rounding_method: roundingMethod,
    rounding_unit: roundingUnit,
    target_brand: nullableText(payload.target_brand),
    target_item_group:
      nullableText(payload.target_item_group),
    minimum_quantity:
      nullableNumber(payload.minimum_quantity),
    minimum_amount:
      nullableNumber(payload.minimum_amount),
    effective_from: effectiveFrom,
    effective_to: effectiveTo,
    structured_rule:
      parseStructuredRule(payload.structured_rule),
    human_note: nullableText(payload.human_note),
    priority: Number(payload.priority || 100),
    is_active: booleanValue(payload.is_active, true)
  };
}

async function listCompanies() {
  const result = await pool.query(`
    SELECT
      company_id,
      company_code,
      company_name,
      company_type,
      is_active
    FROM expenses.companies
    ORDER BY
      is_active DESC,
      sort_order,
      company_name,
      company_id
  `);

  return result.rows;
}

async function listRules(filters = {}) {
  const values = [];
  const conditions = [];

  if (filters.company_id) {
    values.push(Number(filters.company_id));
    conditions.push(`r.company_id = $${values.length}`);
  }

  if (
    filters.transaction_direction &&
    DIRECTIONS.has(filters.transaction_direction)
  ) {
    values.push(filters.transaction_direction);
    conditions.push(
      `r.transaction_direction = $${values.length}`
    );
  }

  if (filters.active_only === "true") {
    conditions.push("r.is_active = TRUE");
  }

  const where = conditions.length
    ? `WHERE ${conditions.join(" AND ")}`
    : "";

  const result = await pool.query(
    `
    SELECT
      r.*,
      c.company_code,
      c.company_name,
      c.company_type
    FROM expenses.company_transaction_rules r
    INNER JOIN expenses.companies c
      ON c.company_id = r.company_id
    ${where}
    ORDER BY
      c.company_name,
      r.transaction_direction,
      r.priority,
      r.effective_from NULLS FIRST,
      r.company_transaction_rule_id
    `,
    values
  );

  return result.rows;
}

async function getRule(id) {
  const result = await pool.query(
    `
    SELECT
      r.*,
      c.company_code,
      c.company_name,
      c.company_type
    FROM expenses.company_transaction_rules r
    INNER JOIN expenses.companies c
      ON c.company_id = r.company_id
    WHERE r.company_transaction_rule_id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
}

async function saveRule(id, payload) {
  const data = normalizePayload(payload);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const companyResult = await client.query(
      `
      SELECT company_id
      FROM expenses.companies
      WHERE company_id = $1
      `,
      [data.company_id]
    );

    if (!companyResult.rows[0]) {
      const error = new Error("選択した会社が存在しません。");
      error.statusCode = 400;
      throw error;
    }

    let result;

    if (id) {
      result = await client.query(
        `
        UPDATE expenses.company_transaction_rules
        SET
          company_id = $1,
          transaction_direction = $2,
          rule_name = $3,
          deduction_enabled = $4,
          deduction_rate = $5,
          deduction_fixed_amount = $6,
          calculation_base = $7,
          tax_base = $8,
          freight_treatment = $9,
          rounding_method = $10,
          rounding_unit = $11,
          target_brand = $12,
          target_item_group = $13,
          minimum_quantity = $14,
          minimum_amount = $15,
          effective_from = $16,
          effective_to = $17,
          structured_rule = $18::jsonb,
          human_note = $19,
          priority = $20,
          is_active = $21,
          updated_at = NOW()
        WHERE company_transaction_rule_id = $22
        RETURNING *
        `,
        [
          data.company_id,
          data.transaction_direction,
          data.rule_name,
          data.deduction_enabled,
          data.deduction_rate,
          data.deduction_fixed_amount,
          data.calculation_base,
          data.tax_base,
          data.freight_treatment,
          data.rounding_method,
          data.rounding_unit,
          data.target_brand,
          data.target_item_group,
          data.minimum_quantity,
          data.minimum_amount,
          data.effective_from,
          data.effective_to,
          JSON.stringify(data.structured_rule),
          data.human_note,
          data.priority,
          data.is_active,
          id
        ]
      );

      if (!result.rows[0]) {
        const error = new Error(
          "更新対象の会社別ルールがありません。"
        );
        error.statusCode = 404;
        throw error;
      }
    } else {
      result = await client.query(
        `
        INSERT INTO expenses.company_transaction_rules (
          company_id,
          transaction_direction,
          rule_name,
          deduction_enabled,
          deduction_rate,
          deduction_fixed_amount,
          calculation_base,
          tax_base,
          freight_treatment,
          rounding_method,
          rounding_unit,
          target_brand,
          target_item_group,
          minimum_quantity,
          minimum_amount,
          effective_from,
          effective_to,
          structured_rule,
          human_note,
          priority,
          is_active
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13,
          $14, $15, $16, $17, $18::jsonb,
          $19, $20, $21
        )
        RETURNING *
        `,
        [
          data.company_id,
          data.transaction_direction,
          data.rule_name,
          data.deduction_enabled,
          data.deduction_rate,
          data.deduction_fixed_amount,
          data.calculation_base,
          data.tax_base,
          data.freight_treatment,
          data.rounding_method,
          data.rounding_unit,
          data.target_brand,
          data.target_item_group,
          data.minimum_quantity,
          data.minimum_amount,
          data.effective_from,
          data.effective_to,
          JSON.stringify(data.structured_rule),
          data.human_note,
          data.priority,
          data.is_active
        ]
      );
    }

    await client.query("COMMIT");
    return await getRule(
      result.rows[0].company_transaction_rule_id
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function disableRule(id) {
  const result = await pool.query(
    `
    UPDATE expenses.company_transaction_rules
    SET
      is_active = FALSE,
      updated_at = NOW()
    WHERE company_transaction_rule_id = $1
    RETURNING *
    `,
    [id]
  );

  if (!result.rows[0]) {
    const error = new Error(
      "無効化対象の会社別ルールがありません。"
    );
    error.statusCode = 404;
    throw error;
  }

  return await getRule(id);
}

async function resolveRules({
  company_id,
  transaction_direction,
  target_date,
  target_brand,
  target_item_group,
  quantity,
  amount
}) {
  const values = [
    Number(company_id),
    text(transaction_direction),
    target_date || new Date().toISOString().slice(0, 10),
    nullableText(target_brand),
    nullableText(target_item_group),
    nullableNumber(quantity),
    nullableNumber(amount)
  ];

  const result = await pool.query(
    `
    SELECT
      r.*,
      c.company_code,
      c.company_name
    FROM expenses.company_transaction_rules r
    INNER JOIN expenses.companies c
      ON c.company_id = r.company_id
    WHERE r.company_id = $1
      AND r.transaction_direction = $2
      AND r.is_active = TRUE
      AND (
        r.effective_from IS NULL
        OR r.effective_from <= $3::date
      )
      AND (
        r.effective_to IS NULL
        OR r.effective_to >= $3::date
      )
      AND (
        r.target_brand IS NULL
        OR r.target_brand = ''
        OR r.target_brand = $4
      )
      AND (
        r.target_item_group IS NULL
        OR r.target_item_group = ''
        OR r.target_item_group = $5
      )
      AND (
        r.minimum_quantity IS NULL
        OR COALESCE($6::numeric, 0) >= r.minimum_quantity
      )
      AND (
        r.minimum_amount IS NULL
        OR COALESCE($7::numeric, 0) >= r.minimum_amount
      )
    ORDER BY
      r.priority,
      r.effective_from DESC NULLS LAST,
      r.company_transaction_rule_id
    `,
    values
  );

  return result.rows;
}

module.exports = {
  listCompanies,
  listRules,
  getRule,
  saveRule,
  disableRule,
  resolveRules
};
