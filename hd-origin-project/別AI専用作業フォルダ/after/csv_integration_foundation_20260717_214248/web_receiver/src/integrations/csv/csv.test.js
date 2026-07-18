const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { exportCsv } = require('./csv.exportService');
const { importCsvPreview } = require('./csv.importService');
const { parseCsv } = require('./csv.parser');
const { generateFileName } = require('./csv.fileName');
const { supportsLegacyEncoding, encodeText, decodeBuffer } = require('./csv.encoding');
const { loadProfile } = require('./csv.profileLoader');

const tests = [];
const results = [];

function test(name, fn) {
  tests.push({ name, fn });
}

function record(status, name, detail) {
  results.push({ status, name, detail: detail || '' });
}

test('UTF8_日本語出力', () => {
  const result = exportCsv({
    profileCode: 'payable-schedule',
    records: [{ company_code: 'HATO', document_no: 'PD-1', vendor_name: '株式会社サンプル', amount_including_tax: 110000 }]
  });
  assert.equal(result.success, true);
  assert.ok(result.csvText.includes('株式会社サンプル'));
});

test('UTF8_BOM付与', () => {
  const buf = encodeText('abc', 'utf-8-bom');
  assert.equal(buf[0], 0xEF);
  assert.equal(buf[1], 0xBB);
  assert.equal(buf[2], 0xBF);
});

test('SHIFT_JIS_日本語出力', () => {
  if (!supportsLegacyEncoding()) return 'SKIP';
  const buf = encodeText('株式会社', 'shift_jis');
  const txt = decodeBuffer(buf, 'shift_jis');
  assert.equal(txt, '株式会社');
});

test('カンマ含み値', () => {
  const result = exportCsv({
    profileCode: 'generic-utf8',
    records: [{ record_id: '1', record_type: 'memo', company_code: 'A', document_no: 'D1', partner_name: 'A,B', record_date: '2026-07-17', amount: 1, memo: 'x' }]
  });
  assert.ok(result.csvText.includes('"A,B"'));
});

test('ダブルクォート含み値', () => {
  const result = exportCsv({
    profileCode: 'generic-utf8',
    records: [{ record_id: '1', record_type: 'memo', company_code: 'A', document_no: 'D1', partner_name: 'A"B', record_date: '2026-07-17', amount: 1, memo: 'x' }]
  });
  assert.ok(result.csvText.includes('"A""B"'));
});

test('改行含み値', () => {
  const result = exportCsv({
    profileCode: 'generic-utf8',
    records: [{ record_id: '1', record_type: 'memo', company_code: 'A', document_no: 'D1', partner_name: "A\nB", record_date: '2026-07-17', amount: 1, memo: 'x' }]
  });
  assert.ok(result.csvText.includes('"A'));
});

test('NULL出力', () => {
  const result = exportCsv({
    profileCode: 'generic-utf8',
    records: [{ record_id: '1', record_type: null, company_code: 'A', document_no: 'D1', partner_name: 'P', record_date: '2026-07-17', amount: 1, memo: null }]
  });
  assert.equal(result.success, true);
});

test('不正日付検出', () => {
  const result = exportCsv({
    profileCode: 'payable-schedule',
    records: [{ company_code: 'HATO', document_no: 'PD-1', vendor_name: '株式会社サンプル', payment_due_date: '2026-13-99', amount_including_tax: 110000 }]
  });
  assert.equal(result.success, false);
});

test('CSVインジェクション対策', () => {
  const result = exportCsv({
    profileCode: 'generic-utf8',
    records: [{ record_id: '1', record_type: '=2+2', company_code: 'A', document_no: 'D1', partner_name: 'P', record_date: '2026-07-17', amount: 1, memo: 'x' }]
  });
  assert.ok(result.csvText.includes("'=2+2"));
});

test('CSV解析_列数不一致', () => {
  const parsed = parseCsv("a,b\r\n1,2,3", { delimiter: ',', includeHeader: true });
  assert.equal(parsed.errors.length > 0, true);
});

test('CSV読込プレビュー', () => {
  const csv = "会社コード,管理番号,支払先名,税込金額\r\nHATO,PD-1,株式会社サンプル,110000";
  const result = importCsvPreview({
    profileCode: 'payable-schedule',
    input: csv
  });
  assert.equal(result.success, true);
  assert.equal(result.rowCount, 1);
});

test('ファイル名禁止文字除去', () => {
  const name = generateFileName({ prefix: 'payable:schedule', company: 'HATO/DAIYA', datetime: new Date('2026-07-17T21:05:00'), sequence: 1 });
  assert.equal(name.includes(':'), false);
  assert.equal(name.includes('/'), false);
});

test('1万行CSV生成', () => {
  const rows = Array.from({ length: 10000 }, (_, i) => ({
    company_code: 'HATO',
    document_no: `PD-${String(i + 1).padStart(5, '0')}`,
    vendor_name: `取引先${i + 1}`,
    amount_including_tax: i + 1
  }));
  const result = exportCsv({
    profileCode: 'payable-schedule',
    records: rows
  });
  assert.equal(result.success, true);
  assert.equal(result.recordCount, 10000);
});

test('プロファイル読込8種', () => {
  const expected = [
    'generic-utf8',
    'generic-shift-jis',
    'accounting-journal',
    'payable-schedule',
    'bank-transfer',
    'sales-invoice',
    'business-partner-master',
    'product-master'
  ];
  expected.forEach(code => {
    const p = loadProfile(code);
    assert.equal(p.profileCode, code);
  });
});

(async () => {
  for (const t of tests) {
    try {
      const ret = await t.fn();
      if (ret === 'SKIP') {
        record('SKIP', t.name, 'iconv-lite not available');
      } else {
        record('OK', t.name, '');
      }
    } catch (err) {
      record('NG', t.name, err && err.message ? err.message : String(err));
    }
  }

  const ok = results.filter(x => x.status === 'OK').length;
  const ng = results.filter(x => x.status === 'NG').length;
  const skip = results.filter(x => x.status === 'SKIP').length;

  const lines = [];
  lines.push(`DATETIME=${new Date().toISOString()}`);
  lines.push(`TEST_CASE_COUNT=${results.length}`);
  lines.push(`TEST_SUCCESS_COUNT=${ok}`);
  lines.push(`TEST_FAILURE_COUNT=${ng}`);
  lines.push(`TEST_SKIP_COUNT=${skip}`);
  lines.push('');
  results.forEach(r => {
    lines.push(`[${r.status}] ${r.name}${r.detail ? ' :: ' + r.detail : ''}`);
  });

  const report = lines.join('\r\n');
  const envPath = process.env.CSV_INTEGRATION_MEMO_PATH;
  const fallback = path.join(__dirname, 'CSV_INTEGRATION_TEST_RESULT.txt');
  const outPath = envPath || fallback;

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, report, 'utf8');
  console.log(report);

  process.exit(ng > 0 ? 1 : 0);
})();