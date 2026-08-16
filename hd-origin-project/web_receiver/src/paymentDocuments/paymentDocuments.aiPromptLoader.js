"use strict";

const db = require("../db");

const COMPOSITION_CODES = Object.freeze({
  stage1: "payment_document_stage1",
  stage2: "payment_document_stage2",
  invoice_payable: "payment_document_stage3_invoice_payable",
  receipt_evidence: "payment_document_stage3_receipt_evidence",
  tax_public: "payment_document_stage3_tax_public",
  card_statement: "payment_document_stage3_card_payment",
  utility_communication: "payment_document_stage3_utility_communication",
  contract_insurance_lease: "payment_document_stage3_contract_insurance_lease",
  delivery_note: "payment_document_stage3_delivery_support",
  needs_review: "payment_document_stage3_needs_review"
});

const ANALYSIS_SYSTEM_CODE_MAP = Object.freeze({
  invoice_payable_analysis: "invoice_payable",
  receipt_evidence_analysis: "receipt_evidence",
  tax_public_analysis: "tax_public",
  card_statement_analysis: "card_statement",
  card_payment_analysis: "card_statement",
  utility_communication_analysis: "utility_communication",
  contract_insurance_lease_analysis: "contract_insurance_lease",
  reference_check_analysis: "delivery_note",
  delivery_support_analysis: "delivery_note",
  needs_review_analysis: "needs_review"
});

const RETIRED_COMPOSITE_DOCUMENT_TYPE_CODES = Object.freeze([
  "bank_transfer_notice",
  "credit_note",
  "bank_transfer_receipt",
  "bank_account_statement",
  "direct_debit_notice",
  "bank_deposit_notice",
  "bank_fee_interest_notice",
  "loan_repayment_statement",
  "bill_check_settlement_notice",
  "statement"
]);

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeCode(value) {
  return normalizeText(value).toLowerCase();
}

function getAnalysis(context) {
  if (context && typeof context.analysis === "object" && context.analysis !== null && !Array.isArray(context.analysis)) {
    return context.analysis;
  }
  return {};
}

function getStageCode(context = {}) {
  const phase = normalizeCode(context.phase || context.stage_code || context.stageCode);
  if (phase === "stage1" || phase === "classification" || phase === "sorting") return "stage1";
  if (phase === "stage2" || phase === "detail" || phase === "common_analysis" || phase === "common-analysis") return "stage2";
  if (phase === "stage3" || phase === "specialist" || phase === "specialist_analysis" || phase === "specialist-analysis") return "stage3";
  throw new Error(`未対応のAI解析段階です。phase=${phase || "(empty)"}`);
}

function getAnalysisSystemCode(context = {}) {
  const analysis = getAnalysis(context);
  return normalizeCode(context.analysis_system_code || context.analysisSystemCode || analysis.analysis_system_code || analysis.analysisSystemCode);
}

function getSpecialistAnalysisCode(context = {}) {
  const explicitCode = normalizeCode(context.specialist_analysis_code || context.specialistAnalysisCode);
  if (explicitCode) return explicitCode;
  const analysisSystemCode = getAnalysisSystemCode(context);
  if (!analysisSystemCode) return "";
  return ANALYSIS_SYSTEM_CODE_MAP[analysisSystemCode] || "";
}

function getCompositionCode(context = {}) {
  const stageCode = getStageCode(context);
  if (stageCode === "stage1") return COMPOSITION_CODES.stage1;
  if (stageCode === "stage2") return COMPOSITION_CODES.stage2;
  const specialistAnalysisCode = getSpecialistAnalysisCode(context);
  if (!specialistAnalysisCode) throw new Error("Stage3の専門解析コードを特定できません。");
  const compositionCode = COMPOSITION_CODES[specialistAnalysisCode];
  if (!compositionCode) throw new Error(`未対応の専門解析コードです。 specialist_analysis_code=${specialistAnalysisCode}`);
  return compositionCode;
}

async function queryRows(sql, values = []) {
  const result = await db.query(sql, values);
  if (!result || !Array.isArray(result.rows)) {
    throw new Error("PostgreSQLから正常な検索結果を取得できませんでした。");
  }
  return result.rows;
}

async function loadCompositionPromptTexts(compositionCode) {
  const rows = await queryRows(
    `SELECT apd.prompt_code, apd.prompt_text, apc.is_required
     FROM "マスターテーブル".ai_prompt_compositions AS apc
     INNER JOIN "マスターテーブル".ai_prompt_definitions AS apd ON apd.prompt_definition_id = apc.prompt_definition_id
     WHERE apc.composition_code = $1 AND apc.is_active = true AND apd.is_active = true
     ORDER BY apc.sequence_no, apd.display_order, apd.prompt_definition_id`,
    [compositionCode]
  );
  if (rows.length === 0) throw new Error(`有効なプロンプト構成がありません。 composition_code=${compositionCode}`);

  const promptTexts = [];
  for (const row of rows) {
    const promptText = String(row.prompt_text ?? "");
    if (row.is_required === true && !promptText.trim()) {
      throw new Error(`必須プロンプト本文が空です。 prompt_code=${row.prompt_code}`);
    }
    if (!promptText.trim()) continue;
    promptTexts.push(promptText);
  }
  if (promptTexts.length === 0) throw new Error(`有効なプロンプト本文がありません。 composition_code=${compositionCode}`);
  return promptTexts;
}

async function loadActiveCandidateMasters() {
  const [companyRows, documentTypeRows, specialistRows] = await Promise.all([
    queryRows(`SELECT "自社会社ID" AS company_id, "自社会社コード" AS company_code, "自社会社名" AS company_name, "自社会社略称名" AS company_short_name, NULL::text AS description FROM "マスターテーブル"."自社会社マスターテーブル" WHERE "自社会社有効" = true ORDER BY "自社会社表示順", "自社会社ID"`),
    queryRows(`SELECT "書類種別ID" AS document_type_id, "書類種別英語名" AS document_type_code, "書類種別名" AS document_type_name, "書類種別説明" AS description FROM "マスターテーブル"."書類種別マスタテーブル" WHERE "書類種別有効" = true AND NOT ("書類種別英語名" = ANY($1::text[])) ORDER BY "書類種別表示順", "書類種別ID"`, [RETIRED_COMPOSITE_DOCUMENT_TYPE_CODES]),
    queryRows(`SELECT specialist_analysis_id, specialist_analysis_code, specialist_analysis_name, description FROM "マスターテーブル".payment_document_specialist_analyses WHERE is_active = true ORDER BY display_order, specialist_analysis_id`)
  ]);

  return {
    companies: companyRows.map(row => ({ company_id: row.company_id, company_code: row.company_code, company_name: row.company_name, company_short_name: row.company_short_name, description: row.description })),
    document_types: documentTypeRows.map(row => ({ document_type_id: row.document_type_id, document_type_code: row.document_type_code, document_type_name: row.document_type_name, description: row.description })),
    specialist_analyses: specialistRows.map(row => ({ specialist_analysis_id: row.specialist_analysis_id, specialist_analysis_code: row.specialist_analysis_code, specialist_analysis_name: row.specialist_analysis_name, description: row.description }))
  };
}

async function loadStage1CandidateMasters() {
  const [companies, documentTypes, systems] =
    await Promise.all([
      queryRows(`SELECT "自社会社コード" AS company_code, "自社会社名" AS company_name FROM "マスターテーブル"."自社会社マスターテーブル" WHERE "自社会社有効" = true ORDER BY "自社会社表示順"`),
      queryRows(`SELECT "書類種別英語名" AS document_type_code, "書類種別名" AS document_type_name FROM "マスターテーブル"."書類種別マスタテーブル" WHERE "書類種別有効" = true AND NOT ("書類種別英語名" = ANY($1::text[])) ORDER BY "書類種別表示順"`, [RETIRED_COMPOSITE_DOCUMENT_TYPE_CODES]),
      queryRows(`SELECT analysis_system_code, analysis_system_name, description FROM "マスターテーブル".analysis_systems WHERE is_active=true ORDER BY sort_order`)
    ]);

  return {
    companies,
    document_types: documentTypes,
    analysis_systems: systems
  };
}

function buildCandidateMasterPrompt(candidateMasters) {
  return [
    "【PostgreSQLマスタから取得した有効候補】",
    "以下の候補は、AIがOCR本文から判断するための候補一覧です。",
    "文字列の単純一致、固定ルール、既定値だけで判定してはいけません。",
    "会社、文書種別、専門解析先の最終判断は、必ずAIがOCR本文全体から行ってください。",
    "【会社候補】\n" + JSON.stringify(candidateMasters.companies, null, 2),
    "【文書種別候補】\n" + JSON.stringify(candidateMasters.document_types, null, 2),
    "【専門解析候補】\n" + JSON.stringify(candidateMasters.specialist_analyses, null, 2)
  ].join("\n");
}

function buildStage1CandidateMasterPrompt(m) {
  return [
    "【Stage1 有効マスタ候補】",
    "OCR本文全体から、各候補を1つずつAIが選択してください。",
    "固定値・後付け補完は禁止です。",
    "【会社】\n" + JSON.stringify(m.companies, null, 2),
    "【書類種類】\n" + JSON.stringify(m.document_types, null, 2),
    "【専門解析先】\n" + JSON.stringify(m.analysis_systems, null, 2)
  ].join("\n");
}

function normalizeJsonType(jsonTypeCode) {
  const value = normalizeCode(jsonTypeCode);
  return ["string", "number", "integer", "boolean", "object", "array"].includes(value) ? value : "string";
}

function buildMultipleOf(decimalPlaces) {
  const places = Number(decimalPlaces);
  return (!Number.isInteger(places) || places <= 0) ? null : Number(`0.${"0".repeat(places - 1)}1`);
}

function buildSchemaDescription(row) {
  const parts = [];
  const itemName = normalizeText(row.analysis_item_name);
  const itemDescription = normalizeText(row.analysis_item_description);
  const extractionInstruction = normalizeText(row.extraction_instruction);
  if (itemName) parts.push(`項目名: ${itemName}`);
  if (itemDescription) parts.push(`項目説明: ${itemDescription}`);
  if (extractionInstruction) parts.push(`抽出指示: ${extractionInstruction}`);
  if (row.is_recommended === true) parts.push("推奨項目");
  if (row.confidence_threshold !== null && row.confidence_threshold !== undefined) parts.push(`信頼度閾値: ${row.confidence_threshold}`);
  return parts.join("\n");
}

function buildPropertySchema(row) {
  let jsonType = normalizeJsonType(row.json_type_code);
  if (jsonType === "array") jsonType = "string";

  const schema = { type: jsonType };
  const description = buildSchemaDescription(row);
  if (description) schema.description = description;

  const maxLength = Number(row.max_length);
  if (jsonType === "string" && Number.isInteger(maxLength) && maxLength > 0) schema.maxLength = maxLength;
  if (jsonType === "number") {
    const multipleOf = buildMultipleOf(row.decimal_places);
    if (multipleOf !== null) schema.multipleOf = multipleOf;
  }

  if (row.is_multiple === true) {
    return { type: "array", description: schema.description, items: schema };
  }
  return schema;
}

async function buildSpecialistJsonSchema(specialistAnalysisCode) {
  const rows = await queryRows(
    `SELECT
      sai.is_required, sai.is_recommended,
      sai.confidence_threshold, sai.extraction_instruction,
      ai.analysis_item_id,
      ai.analysis_item_code, ai.analysis_item_name,
      ai.description AS analysis_item_description,
      ai.max_length, ai.decimal_places,
      ai.is_multiple, adt.json_type_code
     FROM "マスターテーブル".payment_document_specialist_analyses AS psa
     INNER JOIN "マスターテーブル".specialist_analysis_items AS sai
       ON sai.specialist_analysis_id = psa.specialist_analysis_id
     INNER JOIN "マスターテーブル".analysis_items AS ai
       ON ai.analysis_item_id = sai.analysis_item_id
     INNER JOIN "マスターテーブル".analysis_data_types AS adt
       ON adt.analysis_data_type_id = ai.analysis_data_type_id
     WHERE psa.specialist_analysis_code = $1
       AND psa.is_active = true
       AND sai.is_active = true
       AND ai.is_active = true
       AND adt.is_active = true
     ORDER BY
       sai.display_order,
       ai.display_order,
       ai.analysis_item_id`,
    [specialistAnalysisCode]
  );

  if (rows.length === 0) {
    throw new Error(
      `専門解析項目がありません。 specialist_analysis_code=${specialistAnalysisCode}`
    );
  }

  const parentAnalysisItemIds = rows
    .map(row => Number(row.analysis_item_id))
    .filter(value => Number.isInteger(value) && value > 0);

  const childRows = parentAnalysisItemIds.length > 0
    ? await queryRows(
        `SELECT
          aicp.parent_analysis_item_id,
          aicp.is_required,
          false AS is_recommended,
          NULL::numeric AS confidence_threshold,
          aicp.extraction_instruction,
          child.analysis_item_id,
          child.analysis_item_code,
          child.analysis_item_name,
          child.description AS analysis_item_description,
          child.max_length,
          child.decimal_places,
          child.is_multiple,
          adt.json_type_code
         FROM "マスターテーブル".analysis_item_child_properties AS aicp
         INNER JOIN "マスターテーブル".analysis_items AS child
           ON child.analysis_item_id = aicp.child_analysis_item_id
         INNER JOIN "マスターテーブル".analysis_data_types AS adt
           ON adt.analysis_data_type_id = child.analysis_data_type_id
         WHERE aicp.parent_analysis_item_id = ANY($1::bigint[])
           AND aicp.is_active = true
           AND child.is_active = true
           AND adt.is_active = true
         ORDER BY
           aicp.parent_analysis_item_id,
           aicp.display_order,
           child.analysis_item_id`,
        [parentAnalysisItemIds]
      )
    : [];

  const childRowsByParent = new Map();

  for (const childRow of childRows) {
    const parentId = String(
      childRow.parent_analysis_item_id || ""
    );

    if (!childRowsByParent.has(parentId)) {
      childRowsByParent.set(parentId, []);
    }

    childRowsByParent.get(parentId).push(childRow);
  }

  const properties = {};
  const required = [];

  for (const row of rows) {
    const itemCode = normalizeText(
      row.analysis_item_code
    );

    if (!itemCode) {
      throw new Error(
        "解析項目コードが空です。"
      );
    }

    if (properties[itemCode]) {
      throw new Error(
        `解析項目コードが重複しています。 ${itemCode}`
      );
    }

    const propertySchema = buildPropertySchema(row);
    const parentId = String(row.analysis_item_id || "");
    const childDefinitions =
      childRowsByParent.get(parentId) || [];

    if (
      propertySchema.type === "array" &&
      childDefinitions.length > 0
    ) {
      const childProperties = {};
      const childRequired = [];

      for (const childRow of childDefinitions) {
        const childCode = normalizeText(
          childRow.analysis_item_code
        );

        if (!childCode) {
          throw new Error(
            `子解析項目コードが空です。 parent=${itemCode}`
          );
        }

        if (childProperties[childCode]) {
          throw new Error(
            `子解析項目コードが重複しています。 parent=${itemCode} child=${childCode}`
          );
        }

        childProperties[childCode] =
          buildPropertySchema(childRow);

        if (childRow.is_required === true) {
          childRequired.push(childCode);
        }
      }

      const itemSchema = {
        type: "object",
        additionalProperties: false,
        properties: childProperties
      };

      if (childRequired.length > 0) {
        itemSchema.required = childRequired;
      }

      propertySchema.items = itemSchema;
    }

    properties[itemCode] = propertySchema;

    if (row.is_required === true) {
      required.push(itemCode);
    }
  }

  const schema = {
    type: "object",
    additionalProperties: false,
    properties
  };

  if (required.length > 0) {
    schema.required = required;
  }

  return {
    name: `payment_document_${specialistAnalysisCode}`,
    strict: true,
    schema
  };
}

function buildSpecialistSchemaPrompt(specialistAnalysisCode, jsonSchema) {
  return [
    "【PostgreSQLマスタから動的生成した専門解析 fields JSON Schema】",
    `専門解析コード: ${specialistAnalysisCode}`,
    "以下のJSON Schemaは、返却JSON全体ではなく analysis.fields の構造だけを定義します。",
    "返却JSON全体は、共通プロンプトで指定した analysis・visible_field_labels・warnings の形式を維持してください。",
    "analysis.fields は以下のJSON Schemaに適合させてください。",
    JSON.stringify(jsonSchema.schema, null, 2)
  ].join("\n");
}

async function selectPaymentDocumentPromptFiles(context = {}) {
  const stageCode = getStageCode(context);

  if (stageCode === "stage1") {
    const masters = await loadStage1CandidateMasters();
    return [buildStage1CandidateMasterPrompt(masters)];
  }

  if (stageCode === "stage2") {
    return [];
  }

  const compositionCode = getCompositionCode(context);
  const promptTexts = await loadCompositionPromptTexts(compositionCode);

  const specialistAnalysisCode = getSpecialistAnalysisCode(context);
  if (!specialistAnalysisCode) throw new Error("Stage3の専門解析コードを特定できません。");

  const [candidateMasters, jsonSchema] = await Promise.all([
    loadActiveCandidateMasters(),
    buildSpecialistJsonSchema(specialistAnalysisCode)
  ]);

  promptTexts.push(buildCandidateMasterPrompt(candidateMasters));
  /* HD_ORIGIN_CIL_PAYMENT_METHOD_AI_20260722 */
  if (specialistAnalysisCode === "contract_insurance_lease") {
    const paymentMethods = await queryRows(
      `SELECT payment_method_id, payment_method_code,
              method_name AS payment_method_name
       FROM "マスターテーブル".payment_methods
       WHERE is_active = true
       ORDER BY sort_order, payment_method_id`
    );

    promptTexts.push([
      "【支払方法マスタ候補】",
      JSON.stringify(paymentMethods, null, 2),
      "OCR本文から支払方法を判断する。",
      "fields[\"支払方法\"]には候補のpayment_method_nameを完全一致で返す。",
      "OCRの口座振替が同じ意味なら、マスタ名称の口座引落を返す。",
      "判断不能なら空欄にしてwarningsへ理由を書く。"
    ].join("\n"));
  }

  /* HD_ORIGIN_UTILITY_TAX_CATEGORY_AI_20260723 */
  if (specialistAnalysisCode === "utility_communication") {
    const taxCategories = await queryRows(
      `SELECT
         tax_category_id,
         tax_name AS tax_category_label,
         tax_rate
       FROM "マスターテーブル".tax_categories
       WHERE is_active = true
       ORDER BY sort_order, tax_category_id`
    );

    promptTexts.push([
      "【税区分マスタ候補】",
      JSON.stringify(taxCategories, null, 2),
      "各料金明細の税区分は、この候補一覧からAIがOCR本文全体を見て判断してください。",
      "line_items[].tax_category_idには、選択した候補のtax_category_idを整数で返してください。",
      "line_items[].tax_category_labelには、同じ候補のtax_category_labelを完全一致で返してください。",
      "line_items[].tax_rateには、OCR本文に税率が印字されている場合だけ数値を返してください。",
      "候補を判断できない場合はtax_category_idをnull、tax_category_labelを空欄にし、推測しないでください。",
      "明細税額はOCR本文に実際に印字されている場合だけ返し、独自計算や按分をしないでください。"
    ].join("\n"));
  }
  promptTexts.push(buildSpecialistSchemaPrompt(specialistAnalysisCode, jsonSchema));
  return promptTexts;
}

async function appendPaymentDocumentExternalPrompt(basePrompt, promptTexts) {
  const parts = [];
  const normalizedBasePrompt = String(basePrompt ?? "").trim();
  if (normalizedBasePrompt) parts.push(normalizedBasePrompt);

  const texts = Array.isArray(promptTexts) ? promptTexts : [];
  for (const promptTextValue of texts) {
    const promptText = String(promptTextValue ?? "").trim();
    if (promptText) parts.push(promptText);
  }
  return parts.join("\n\n");
}

function loadPaymentDocumentPromptText(_legacyFileName, fallbackText = "") {
  /*
    同期形式で残る旧呼出との互換用。
    この関数ではDB検索を行わない。
  */
  return String(fallbackText ?? "").trim();
}

async function loadPaymentDocumentPromptTextFromDb(
  promptName,
  fallbackText = ""
) {
  const normalizedPromptName = normalizeText(promptName);
  const normalizedFallback = String(
    fallbackText ?? ""
  ).trim();

  if (!normalizedPromptName) {
    return normalizedFallback;
  }

  const rows = await queryRows(
    `SELECT
       prompt_text
     FROM "マスターテーブル".ai_prompt_definitions
     WHERE prompt_name = $1
       AND is_active = true
     ORDER BY
       updated_at DESC,
       prompt_definition_id DESC
     LIMIT 1`,
    [normalizedPromptName]
  );

  if (rows.length === 0) {
    return normalizedFallback;
  }

  const promptText = String(
    rows[0].prompt_text ?? ""
  ).trim();

  return promptText || normalizedFallback;
}
module.exports = {
  loadPaymentDocumentPromptText,

  loadPaymentDocumentPromptTextFromDb,
  selectPaymentDocumentPromptFiles,
  appendPaymentDocumentExternalPrompt
};