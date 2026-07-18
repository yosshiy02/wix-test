const { loadProfile } = require('./csv.profileLoader');
const { decodeBuffer } = require('./csv.encoding');
const { parseCsv } = require('./csv.parser');
const { validateParsedCsv } = require('./csv.validator');

function importCsvPreview(payload = {}) {
  const profile = loadProfile(payload.profileCode);

  const text = Buffer.isBuffer(payload.input)
    ? decodeBuffer(payload.input, payload.encoding || profile.encoding)
    : String(payload.input ?? '');

  const parsed = parseCsv(text, {
    delimiter: payload.delimiter || profile.delimiter,
    includeHeader: payload.includeHeader !== undefined ? payload.includeHeader : profile.includeHeader,
    ignoreEmptyLines: true
  });

  const validated = validateParsedCsv(profile, parsed, {
    includeHeader: payload.includeHeader !== undefined ? payload.includeHeader : profile.includeHeader
  });

  return {
    success: validated.errors.length === 0,
    profileCode: profile.profileCode,
    headers: parsed.headers,
    rowCount: parsed.rows.length,
    warningCount: validated.warnings.length,
    errorCount: validated.errors.length,
    warnings: validated.warnings,
    errors: validated.errors,
    rows: parsed.rows.slice(0, 100)
  };
}

module.exports = {
  importCsvPreview
};