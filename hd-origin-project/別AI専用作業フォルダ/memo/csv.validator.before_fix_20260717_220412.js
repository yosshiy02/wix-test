function isNil(v) {
  return v === null || v === undefined;
}

function isBlank(v) {
  return isNil(v) || String(v).trim() === '';
}

function isValidDate(value) {
  if (isBlank(value)) return true;
  const s = String(value).trim();
  if (!/^\d{4}[-\/]?\d{2}[-\/]?\d{2}$/.test(s)) return false;

  const normalized = s.includes('-') || s.includes('/')
    ? s.replace(/\//g, '-')
    : `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;

  const y = Number(normalized.slice(0, 4));
  const m = Number(normalized.slice(5, 7));
  const d = Number(normalized.slice(8, 10));
  const dt = new Date(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00`);

  return dt.getFullYear() === y && (dt.getMonth() + 1) === m && dt.getDate() === d;
}

function isValidBoolean(value) {
  if (isBlank(value)) return true;
  const v = String(value).trim().toLowerCase();
  return ['1', '0', 'true', 'false', 'yes', 'no'].includes(v);
}

function isValidNumber(value) {
  if (isBlank(value)) return true;
  return !Number.isNaN(Number(String(value).replace(/,/g, '')));
}

function validateByColumn(column, value, rowNumber) {
  const warnings = [];
  const errors = [];

  if (column.required && isBlank(value)) {
    errors.push({ level: 'error', rowNumber, field: column.sourceField, message: 'required value missing' });
    return { warnings, errors };
  }

  if (isBlank(value)) {
    return { warnings, errors };
  }

  const type = String(column.type || 'string').toLowerCase();

  if (type === 'number' && !isValidNumber(value)) {
    errors.push({ level: 'error', rowNumber, field: column.sourceField, message: 'invalid number' });
  }

  if (type === 'date' && !isValidDate(value)) {
    errors.push({ level: 'error', rowNumber, field: column.sourceField, message: 'invalid date' });
  }

  if (type === 'boolean' && !isValidBoolean(value)) {
    errors.push({ level: 'error', rowNumber, field: column.sourceField, message: 'invalid boolean' });
  }

  if (column.maxLength && String(value).length > Number(column.maxLength)) {
    warnings.push({ level: 'warning', rowNumber, field: column.sourceField, message: `maxLength exceeded: ${column.maxLength}` });
  }

  if (type === 'number' && isValidNumber(value)) {
    const num = Number(String(value).replace(/,/g, ''));

    if (column.minValue !== undefined && num < Number(column.minValue)) {
      errors.push({ level: 'error', rowNumber, field: column.sourceField, message: `less than minValue: ${column.minValue}` });
    }

    if (column.maxValue !== undefined && num > Number(column.maxValue)) {
      errors.push({ level: 'error', rowNumber, field: column.sourceField, message: `greater than maxValue: ${column.maxValue}` });
    }
  }

  if (column.codePattern) {
    const re = new RegExp(column.codePattern);
    if (!re.test(String(value))) {
      errors.push({ level: 'error', rowNumber, field: column.sourceField, message: `codePattern mismatch: ${column.codePattern}` });
    }
  }

  return { warnings, errors };
}

function validateExportRecords(profile, records) {
  const warnings = [];
  const errors = [];

  if (!Array.isArray(records)) {
    return {
      success: false,
      warnings,
      errors: [{ level: 'error', rowNumber: 0, field: '*', message: 'records must be array' }]
    };
  }

  if (records.length === 0) {
    warnings.push({ level: 'warning', rowNumber: 0, field: '*', message: 'records is empty' });
  }

  records.forEach((record, idx) => {
    const rowNumber = idx + 1;
    for (const column of profile.columns) {
      const result = validateByColumn(column, record[column.sourceField], rowNumber);
      warnings.push(...result.warnings);
      errors.push(...result.errors);
    }
  });

  if (Array.isArray(profile.duplicateKeyFields) && profile.duplicateKeyFields.length > 0) {
    const seen = new Map();

    records.forEach((record, idx) => {
      const key = profile.duplicateKeyFields.map(f => String(record[f] ?? '')).join('||');
      if (key.replace(/\|/g, '') === '') return;

      if (seen.has(key)) {
        errors.push({
          level: 'error',
          rowNumber: idx + 1,
          field: profile.duplicateKeyFields.join(','),
          message: `duplicate key in same file: ${key}`
        });
      } else {
        seen.set(key, idx + 1);
      }
    });
  }

  return {
    success: errors.length === 0,
    warnings,
    errors
  };
}

function validateParsedCsv(profile, parsed, options = {}) {
  const warnings = [...(parsed.warnings || [])];
  const errors = [...(parsed.errors || [])];
  const includeHeader = options.includeHeader !== false;

  if (!parsed || !Array.isArray(parsed.rows)) {
    errors.push({ level: 'error', rowNumber: 0, field: '*', message: 'parsed rows missing' });
    return { success: false, warnings, errors };
  }

  if (includeHeader) {
    if (!Array.isArray(parsed.headers) || parsed.headers.length === 0) {
      errors.push({ level: 'error', rowNumber: 0, field: '*', message: 'header missing' });
    } else {
      const headerSeen = new Set();

      parsed.headers.forEach((h) => {
        if (headerSeen.has(h)) {
          errors.push({ level: 'error', rowNumber: 0, field: h, message: 'duplicate header' });
        }
        headerSeen.add(h);
      });

      const requiredHeaders = profile.columns.map(c => c.csvHeader);

      requiredHeaders.forEach((header) => {
        if (!parsed.headers.includes(header)) {
          errors.push({ level: 'error', rowNumber: 0, field: header, message: 'required header missing' });
        }
      });

      parsed.headers.forEach((header) => {
        if (!requiredHeaders.includes(header)) {
          warnings.push({ level: 'warning', rowNumber: 0, field: header, message: 'unknown header' });
        }
      });
    }
  }

  if (parsed.rows.length === 0) {
    errors.push({ level: 'error', rowNumber: 0, field: '*', message: 'empty file or header only' });
  }

  const rowObjects = parsed.rows.map(r => r.valuesByHeader || {});
  const exportValidation = validateExportRecords(profile, rowObjects);
  warnings.push(...exportValidation.warnings);
  errors.push(...exportValidation.errors);

  return {
    success: errors.length === 0,
    warnings,
    errors
  };
}

module.exports = {
  isBlank,
  isValidDate,
  isValidBoolean,
  isValidNumber,
  validateExportRecords,
  validateParsedCsv
};