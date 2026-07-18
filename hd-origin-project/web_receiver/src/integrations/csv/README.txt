HD Origin Project
CSV Integration Foundation
====================================

[Purpose]
Independent CSV import/export foundation for future integrations.
This module is intentionally separated from:
- Access
- OCR
- paymentDocuments existing AI
- receipts
- calendar
- server.js route registration

[Current Phase]
- Standalone foundation only
- Mock UI only
- No DB connection
- No route registration
- No existing source modification

[Folders]
web_receiver\src\integrations\csv\
web_receiver\public\integrations\csv\
database\migrations\draft\

[Features]
- CSV export engine
- CSV parser
- CSV validator
- File name generator
- JSON profile loader
- 8 export profiles
- CSV injection mitigation
- UTF-8 / UTF-8 BOM support
- Shift_JIS / CP932 support when iconv-lite exists
- Mock UI (unconnected)

[Important]
Shift_JIS / CP932 runtime encoding requires iconv-lite.
This scaffolding does NOT install dependencies and does NOT modify existing package configuration.

[Not Connected]
- server.js
- existing routes
- existing repositories
- PostgreSQL
- Access

[Test]
csv.test.js writes summary to:
Environment variable CSV_INTEGRATION_MEMO_PATH
or local fallback report file.

[DRAFT SQL]
csv_integration_history_draft.sql is DRAFT only.
Do not execute in this phase.