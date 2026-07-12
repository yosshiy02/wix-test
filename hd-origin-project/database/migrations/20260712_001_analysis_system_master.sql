BEGIN;

CREATE TABLE IF NOT EXISTS expenses.analysis_systems (
  analysis_system_id BIGSERIAL PRIMARY KEY,
  analysis_system_code TEXT NOT NULL,
  analysis_system_name TEXT NOT NULL,
  description TEXT,
  specialist_route_code TEXT,
  destination_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS analysis_systems_code_uidx
ON expenses.analysis_systems (analysis_system_code);

CREATE UNIQUE INDEX IF NOT EXISTS analysis_systems_name_uidx
ON expenses.analysis_systems (analysis_system_name);

INSERT INTO expenses.analysis_systems (
  analysis_system_code,
  analysis_system_name,
  description,
  specialist_route_code,
  destination_url,
  sort_order
)
VALUES
  (
    'invoice_payable_analysis',
    '請求・未払系',
    '請求書、買掛金、未払金、カード請求および支払予定を扱う専門解析先。',
    'invoice_payable',
    '/payables/payment-document-specialist-invoice-payable.html',
    10
  ),
  (
    'receipt_evidence_analysis',
    'レシート・領収書・支払済み証憑系',
    'レシート、領収書および支払済み証憑を扱う専門解析先。',
    'receipt_evidence',
    '/receipts/receipt-list.html',
    20
  ),
  (
    'tax_public_analysis',
    '税金・公的支払系',
    '税金、社会保険料、公的納付書および自治体通知を扱う専門解析先。',
    'tax_public',
    '/payables/payment-document-specialist-tax-public.html',
    30
  ),
  (
    'contract_insurance_lease_analysis',
    '契約・保険・リース系',
    '契約書、保険契約、保険料通知およびリース契約を扱う専門解析先。',
    'contract_insurance_lease',
    '/payables/payment-document-specialist-contract-insurance-lease.html',
    40
  ),
  (
    'utility_communication_analysis',
    '公共料金・通信費系',
    '電気、水道、ガス、電話、通信およびインターネット料金を扱う専門解析先。',
    'utility_communication',
    '/payables/payment-document-specialist-utility-communication.html',
    50
  )
ON CONFLICT (analysis_system_code) DO NOTHING;

ALTER TABLE accounting.payment_document_sorting_drafts
  ADD COLUMN IF NOT EXISTS analysis_system_id BIGINT;

UPDATE accounting.payment_document_sorting_drafts AS draft
SET analysis_system_id = master.analysis_system_id
FROM expenses.analysis_systems AS master
WHERE draft.analysis_system_id IS NULL
  AND NULLIF(BTRIM(draft.analysis_system_code), '') IS NOT NULL
  AND master.analysis_system_code = BTRIM(draft.analysis_system_code);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payment_document_sorting_drafts_analysis_system_fk'
  ) THEN
    ALTER TABLE accounting.payment_document_sorting_drafts
      ADD CONSTRAINT payment_document_sorting_drafts_analysis_system_fk
      FOREIGN KEY (analysis_system_id)
      REFERENCES expenses.analysis_systems (analysis_system_id);
  END IF;
END
$$;


CREATE OR REPLACE FUNCTION accounting.payment_document_sorting_drafts_sync_analysis_system()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  resolved_master expenses.analysis_systems%ROWTYPE;
  requested_code TEXT;
BEGIN
  requested_code := NULLIF(BTRIM(NEW.analysis_system_code), '');

  IF NEW.analysis_system_id IS NULL
     AND requested_code IS NULL THEN

    NEW.analysis_system_code := NULL;
    NEW.analysis_system_label :=
      NULLIF(BTRIM(NEW.analysis_system_label), '');

    RETURN NEW;
  END IF;

  IF NEW.analysis_system_id IS NOT NULL THEN
    SELECT master.*
    INTO resolved_master
    FROM expenses.analysis_systems AS master
    WHERE master.analysis_system_id = NEW.analysis_system_id
      AND master.is_active = TRUE
    LIMIT 1;
  END IF;

  IF NOT FOUND AND requested_code IS NOT NULL THEN
    SELECT master.*
    INTO resolved_master
    FROM expenses.analysis_systems AS master
    WHERE master.analysis_system_code = requested_code
      AND master.is_active = TRUE
    LIMIT 1;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      '有効な専門解析先マスタが見つかりません。analysis_system_id=%, analysis_system_code=%',
      NEW.analysis_system_id,
      requested_code
      USING ERRCODE = '23503';
  END IF;

  NEW.analysis_system_id :=
    resolved_master.analysis_system_id;

  NEW.analysis_system_code :=
    resolved_master.analysis_system_code;

  NEW.analysis_system_label :=
    resolved_master.analysis_system_name;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_document_sorting_drafts_sync_analysis_system
ON accounting.payment_document_sorting_drafts;

CREATE TRIGGER payment_document_sorting_drafts_sync_analysis_system
BEFORE INSERT OR UPDATE OF
  analysis_system_id,
  analysis_system_code,
  analysis_system_label
ON accounting.payment_document_sorting_drafts
FOR EACH ROW
EXECUTE FUNCTION accounting.payment_document_sorting_drafts_sync_analysis_system();
COMMIT;