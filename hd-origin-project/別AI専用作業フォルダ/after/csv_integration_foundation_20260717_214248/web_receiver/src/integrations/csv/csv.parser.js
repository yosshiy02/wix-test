function parseCsv(text, options = {}) {
  const delimiter = options.delimiter || ',';
  const includeHeader = options.includeHeader !== false;
  const ignoreEmptyLines = options.ignoreEmptyLines !== false;

  const source = String(text ?? '');
  const rows = [];
  const warnings = [];
  const errors = [];

  let currentCell = '';
  let currentRow = [];
  let inQuotes = false;

  const pushCell = () => {
    currentRow.push(currentCell);
    currentCell = '';
  };

  const pushRow = () => {
    if (ignoreEmptyLines && currentRow.every(v => String(v).trim() === '')) {
      currentRow = [];
      return;
    }
    rows.push(currentRow);
    currentRow = [];
  };

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === delimiter) {
      pushCell();
      continue;
    }

    if (ch === '\r') {
      if (next === '\n') i += 1;
      pushCell();
      pushRow();
      continue;
    }

    if (ch === '\n') {
      pushCell();
      pushRow();
      continue;
    }

    currentCell += ch;
  }

  pushCell();
  if (currentRow.length > 0) pushRow();

  let headers = [];
  let bodyRows = rows;

  if (includeHeader) {
    headers = rows[0] || [];
    bodyRows = rows.slice(1);
  } else {
    const maxColumns = rows.reduce((m, r) => Math.max(m, r.length), 0);
    headers = Array.from({ length: maxColumns }, (_, idx) => `column_${idx + 1}`);
  }

  const expectedColumnCount = headers.length;
  const mappedRows = bodyRows.map((rawColumns, idx) => {
    if (rawColumns.length !== expectedColumnCount) {
      errors.push({
        level: 'error',
        rowNumber: includeHeader ? idx + 2 : idx + 1,
        field: '*',
        message: `column count mismatch expected=${expectedColumnCount} actual=${rawColumns.length}`
      });
    }

    const valuesByHeader = {};
    headers.forEach((header, colIdx) => {
      valuesByHeader[header] = rawColumns[colIdx] ?? '';
    });

    return {
      rowNumber: includeHeader ? idx + 2 : idx + 1,
      rawColumns,
      valuesByHeader
    };
  });

  return {
    headers,
    rows: mappedRows,
    warnings,
    errors
  };
}

module.exports = {
  parseCsv
};