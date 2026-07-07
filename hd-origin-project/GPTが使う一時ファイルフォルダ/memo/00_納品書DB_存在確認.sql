SELECT
  to_regclass('accounting.delivery_note_imports') AS delivery_note_imports,
  to_regclass('accounting.delivery_note_drafts') AS delivery_note_drafts,
  to_regclass('accounting.delivery_note_draft_details') AS delivery_note_draft_details,
  to_regclass('accounting.delivery_notes') AS delivery_notes,
  to_regclass('accounting.delivery_note_details') AS delivery_note_details;
