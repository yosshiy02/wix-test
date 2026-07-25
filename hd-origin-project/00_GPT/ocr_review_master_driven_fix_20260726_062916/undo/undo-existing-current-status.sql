BEGIN;

UPDATE accounting.payment_document_ocr_imports
SET current_status = 'OCR待ち',
    updated_at = CURRENT_TIMESTAMP
WHERE payment_document_ocr_import_id = 28;

UPDATE accounting.payment_document_ocr_imports
SET current_status = 'OCR待ち',
    updated_at = CURRENT_TIMESTAMP
WHERE payment_document_ocr_import_id = 29;

UPDATE accounting.payment_document_ocr_imports
SET current_status = 'OCR待ち',
    updated_at = CURRENT_TIMESTAMP
WHERE payment_document_ocr_import_id = 30;

UPDATE accounting.payment_document_ocr_imports
SET current_status = 'OCR待ち',
    updated_at = CURRENT_TIMESTAMP
WHERE payment_document_ocr_import_id = 31;

UPDATE accounting.payment_document_ocr_imports
SET current_status = 'OCR待ち',
    updated_at = CURRENT_TIMESTAMP
WHERE payment_document_ocr_import_id = 32;

UPDATE accounting.payment_document_ocr_imports
SET current_status = 'OCR待ち',
    updated_at = CURRENT_TIMESTAMP
WHERE payment_document_ocr_import_id = 33;

UPDATE accounting.payment_document_ocr_imports
SET current_status = 'OCR待ち',
    updated_at = CURRENT_TIMESTAMP
WHERE payment_document_ocr_import_id = 34;

COMMIT;
