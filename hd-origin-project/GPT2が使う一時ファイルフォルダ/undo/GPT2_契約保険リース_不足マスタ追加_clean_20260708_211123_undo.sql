BEGIN;

DROP TABLE IF EXISTS expenses.early_cancellation_types;
DROP TABLE IF EXISTS expenses.ownership_transfer_types;
DROP TABLE IF EXISTS expenses.auto_renewal_types;
DROP TABLE IF EXISTS expenses.accounts_payable_registration_types;
DROP TABLE IF EXISTS expenses.payable_registration_types;
DROP TABLE IF EXISTS expenses.personal_mix_flags;
DROP TABLE IF EXISTS expenses.company_burden_types;
DROP TABLE IF EXISTS expenses.payment_cycles;
DROP TABLE IF EXISTS expenses.payment_statuses;
DROP TABLE IF EXISTS expenses.contract_statuses;
DROP TABLE IF EXISTS expenses.contract_types;
DROP TABLE IF EXISTS expenses.lease_item_categories;
DROP TABLE IF EXISTS expenses.insurance_types;
DROP TABLE IF EXISTS expenses.contract_insurance_lease_kinds;

COMMIT;