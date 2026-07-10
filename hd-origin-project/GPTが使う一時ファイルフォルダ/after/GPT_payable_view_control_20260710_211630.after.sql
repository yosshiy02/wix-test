CREATE OR REPLACE VIEW accounting.v_payable_documents AS
WITH line_totals AS (
  SELECT
    payable_lines.payable_id,
    count(*) AS line_count,
    COALESCE(
      sum(payable_lines.amount_ex_tax),
      0::numeric
    )::numeric(14,2) AS calculated_subtotal_amount,
    COALESCE(
      sum(payable_lines.tax_amount),
      0::numeric
    )::numeric(14,2) AS calculated_tax_amount,
    COALESCE(
      sum(payable_lines.amount_in_tax),
      0::numeric
    )::numeric(14,2) AS calculated_total_amount
  FROM accounting.payable_lines
  GROUP BY payable_lines.payable_id
),
payment_totals AS (
  SELECT
    payable_payments.payable_id,
    count(*) AS payment_count,
    COALESCE(
      sum(payable_payments.payment_amount),
      0::numeric
    )::numeric(14,2) AS calculated_paid_amount
  FROM accounting.payable_payments
  GROUP BY payable_payments.payable_id
)
SELECT
  d.payable_id,
  d.payable_no,
  d.document_type,
  d.payable_kind,
  d.status,
  d.vendor_id,
  d.vendor_name,
  d.invoice_number,
  d.supplier_document_no,
  d.document_date,
  d.posting_date,
  d.due_date,
  d.payment_plan_date,
  d.currency_code,
  d.subtotal_amount,
  d.tax_amount,
  d.withholding_tax_amount,
  d.total_amount,
  d.paid_amount,
  d.balance_amount,
  d.account_payable_title_id,
  d.payment_method_id,
  d.target_person_id,
  d.purpose_id,
  d.project_id,
  d.department_id,
  d.summary,
  d.memo,
  d.internal_note,
  d.evidence_type,
  d.evidence_file_name,
  d.evidence_file_path,
  d.source_memo,
  d.journal_status,
  d.created_by,
  d.updated_by,
  d.created_at,
  d.updated_at,
  d.deleted_at,

  COALESCE(
    l.line_count,
    0::bigint
  ) AS line_count,

  COALESCE(
    p.payment_count,
    0::bigint
  ) AS payment_count,

  COALESCE(
    l.calculated_subtotal_amount,
    d.subtotal_amount,
    0::numeric
  )::numeric(14,2) AS calculated_subtotal_amount,

  COALESCE(
    l.calculated_tax_amount,
    d.tax_amount,
    0::numeric
  )::numeric(14,2) AS calculated_tax_amount,

  COALESCE(
    l.calculated_total_amount,
    d.total_amount,
    0::numeric
  )::numeric(14,2) AS calculated_total_amount,

  COALESCE(
    p.calculated_paid_amount,
    d.paid_amount,
    0::numeric
  )::numeric(14,2) AS calculated_paid_amount,

  GREATEST(
    COALESCE(
      l.calculated_total_amount,
      d.total_amount,
      0::numeric
    ) -
    COALESCE(
      p.calculated_paid_amount,
      d.paid_amount,
      0::numeric
    ),
    0::numeric
  )::numeric(14,2) AS calculated_balance_amount,

  CASE
    WHEN d.deleted_at IS NOT NULL
      THEN 'deleted'::text

    WHEN d.status = 'void'::text
      THEN 'void'::text

    WHEN COALESCE(
      l.calculated_total_amount,
      d.total_amount,
      0::numeric
    ) > 0::numeric
    AND COALESCE(
      p.calculated_paid_amount,
      d.paid_amount,
      0::numeric
    ) >= COALESCE(
      l.calculated_total_amount,
      d.total_amount,
      0::numeric
    )
      THEN 'paid'::text

    WHEN COALESCE(
      p.calculated_paid_amount,
      d.paid_amount,
      0::numeric
    ) > 0::numeric
      THEN 'partially_paid'::text

    ELSE d.status
  END AS effective_status,

  d.due_date IS NOT NULL
  AND d.due_date < CURRENT_DATE
  AND d.status <> ALL (
    ARRAY[
      'paid'::text,
      'void'::text
    ]
  )
  AND GREATEST(
    COALESCE(
      l.calculated_total_amount,
      d.total_amount,
      0::numeric
    ) -
    COALESCE(
      p.calculated_paid_amount,
      d.paid_amount,
      0::numeric
    ),
    0::numeric
  ) > 0::numeric AS is_overdue,

  d.company_code,
  d.company_name,
  d.evidence_status,
  d.evidence_due_date,
  d.evidence_received_date,
  d.review_status,
  d.review_reason,
  d.warning_level,
  d.professional_review_required,
  d.professional_review_status,
  d.professional_reviewer,
  d.professional_reviewed_at,
  d.professional_review_result

FROM accounting.payable_documents d

LEFT JOIN line_totals l
  ON l.payable_id = d.payable_id

LEFT JOIN payment_totals p
  ON p.payable_id = d.payable_id

WHERE d.deleted_at IS NULL;