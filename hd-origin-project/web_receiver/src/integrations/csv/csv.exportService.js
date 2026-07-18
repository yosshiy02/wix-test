const { loadProfile } = require('./csv.profileLoader');
const { validateExportRecords } = require('./csv.validator');
const { buildCsv } = require('./csv.formatter');
const { encodeText } = require('./csv.encoding');
const { generateFileName } = require('./csv.fileName');

function exportCsv(payload = {}) {
  const profile = loadProfile(payload.profileCode);
  const records = Array.isArray(payload.records) ? payload.records : [];

  const effectiveProfile = {
    ...profile,
    encoding: payload.encoding || profile.encoding,
    includeHeader: payload.includeHeader !== undefined ? payload.includeHeader : profile.includeHeader
  };

  const validate = validateExportRecords(effectiveProfile, records);
  const built = buildCsv(effectiveProfile, records);
  const warnings = [...validate.warnings, ...built.warnings];
  const errors = [...validate.errors, ...built.errors];

  const fileName = generateFileName({
    prefix: effectiveProfile.fileNamePrefix,
    company: payload.companyCode || (records[0] && records[0].company_code) || 'COMMON',
    datetime: payload.datetime || new Date(),
    sequence: payload.sequence || 1
  });

  const csvBuffer = errors.length === 0
    ? encodeText(built.csvText, effectiveProfile.encoding)
    : Buffer.from('', 'utf8');

  return {
    success: errors.length === 0,
    profileCode: effectiveProfile.profileCode,
    encoding: effectiveProfile.encoding,
    fileName,
    recordCount: records.length,
    warningCount: warnings.length,
    errorCount: errors.length,
    csvText: built.csvText,
    csvBuffer,
    warnings,
    errors
  };
}

module.exports = {
  exportCsv
};