const { BOOLEAN_FORMATS, DANGER_PREFIXES } = require('./csv.constants');

function pad(num, size) {
  return String(num).padStart(size, '0');
}

function formatDate(value, pattern = 'yyyy/MM/dd') {
  if (value === null || value === undefined || String(value).trim() === '') return '';
  const s = String(value).trim();

  const normalized = s.includes('-') || s.includes('/')
    ? s.replace(/\//g, '-')
    : `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) return s;

  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1, 2);
  const dd = pad(date.getDate(), 2);

  switch (pattern) {
    case 'yyyy-MM-dd':
      return `${yyyy}-${MM}-${dd}`;
    case 'yyyyMMdd':
      return `${yyyy}${MM}${dd}`;
    case 'yyyy/MM/dd':
    default:
      return `${yyyy}/${MM}/${dd}`;
  }
}

function formatNumber(value, column = {}) {
  if (value === null || value === undefined || String(value).trim() === '') return '';
  const num = Number(String(value).replace(/,/g, ''));
  if (Number.isNaN(num)) return String(value);

  const decimals = Number.isInteger(Number(column.decimalPlaces))
    ? Number(column.decimalPlaces)
    : 0;

  return num.toFixed(decimals);
}

function formatBoolean(value, booleanFormat = '1/0') {
  if (value === null || value === undefined || String(value).trim() === '') return '';
  const map = BOOLEAN_FORMATS[booleanFormat] || BOOLEAN_FORMATS['1/0'];
  const v = String(value).trim().toLowerCase();
  const bool = ['1', 'true', 'yes'].includes(v);
  return bool ? map.true : map.false;
}

function neutralizeFormula(value, injectionProtection = true) {
  const s = String(value ?? '');

  if (!injectionProtection || s.length === 0) {
    return { value: s, warning: null };
  }

  if (DANGER_PREFIXES.some(prefix => s.startsWith(prefix))) {
    return {
      value: `'${s}`,
      warning: 'CSV injection neutralized'
    };
  }

  return { value: s, warning: null };
}

function normalizeNull(value, nullValue = '') {
  return value === null || value === undefined ? String(nullValue ?? '') : value;
}

function formatValue(record, column, profile) {
  const raw = normalizeNull(record[column.sourceField], profile.nullValue);
  const type = String(column.type || 'string').toLowerCase();

  if (raw === '') return '';

  if (type === 'date') {
    return formatDate(raw, column.format || 'yyyy/MM/dd');
  }

  if (type === 'number') {
    return formatNumber(raw, column);
  }

  if (type === 'boolean') {
    return formatBoolean(raw, profile.booleanFormat || '1/0');
  }

  return String(raw);
}

function escapeCell(value, delimiter, quoteMode) {
  const s = String(value ?? '');
  const needsQuote = s.includes('"') || s.includes('\r') || s.includes('\n') || s.includes(delimiter);
  const escaped = s.replace(/"/g, '""');

  if (quoteMode === 'always') return `"${escaped}"`;
  if (quoteMode === 'none') return escaped;
  return needsQuote ? `"${escaped}"` : escaped;
}

function buildCsv(profile, records) {
  const warnings = [];
  const errors = [];
  const delimiter = profile.delimiter;
  const lineEnding = profile.lineEnding;
  const quoteMode = profile.quoteMode;
  const lines = [];

  if (profile.includeHeader) {
    lines.push(profile.columns.map(c => escapeCell(c.csvHeader, delimiter, quoteMode)).join(delimiter));
  }

  records.forEach((record, idx) => {
    const row = profile.columns.map((column) => {
      const formatted = formatValue(record, column, profile);
      const neutralized = neutralizeFormula(formatted, profile.injectionProtection !== false);

      if (neutralized.warning) {
        warnings.push({
          level: 'warning',
          rowNumber: idx + 1,
          field: column.sourceField,
          message: neutralized.warning
        });
      }

      return escapeCell(neutralized.value, delimiter, quoteMode);
    });

    lines.push(row.join(delimiter));
  });

  return {
    success: errors.length === 0,
    csvText: lines.join(lineEnding),
    warnings,
    errors,
    recordCount: records.length
  };
}

module.exports = {
  formatDate,
  formatNumber,
  formatBoolean,
  neutralizeFormula,
  escapeCell,
  buildCsv
};