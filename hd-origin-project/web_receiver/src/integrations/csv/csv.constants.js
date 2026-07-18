const ENCODINGS = {
  UTF8: 'utf-8',
  UTF8_BOM: 'utf-8-bom',
  SHIFT_JIS: 'shift_jis',
  CP932: 'cp932'
};

const DELIMITERS = {
  comma: ',',
  tab: '\t',
  semicolon: ';'
};

const LINE_ENDINGS = {
  crlf: '\r\n',
  lf: '\n'
};

const QUOTE_MODES = ['always', 'necessary', 'none'];

const BOOLEAN_FORMATS = {
  '1/0': { true: '1', false: '0' },
  'TRUE/FALSE': { true: 'TRUE', false: 'FALSE' },
  'YES/NO': { true: 'YES', false: 'NO' }
};

const FIELD_TYPES = ['string', 'number', 'date', 'boolean'];

const DANGER_PREFIXES = ['=', '+', '-', '@', '\t', '\r', '\n'];

const DEFAULT_EXPORT_OPTIONS = {
  encoding: ENCODINGS.UTF8_BOM,
  delimiter: DELIMITERS.comma,
  lineEnding: LINE_ENDINGS.crlf,
  includeHeader: true,
  quoteMode: 'necessary',
  nullValue: '',
  booleanFormat: '1/0',
  injectionProtection: true
};

const DEFAULT_IMPORT_OPTIONS = {
  encoding: ENCODINGS.UTF8,
  delimiter: DELIMITERS.comma,
  includeHeader: true,
  ignoreEmptyLines: true
};

module.exports = {
  ENCODINGS,
  DELIMITERS,
  LINE_ENDINGS,
  QUOTE_MODES,
  BOOLEAN_FORMATS,
  FIELD_TYPES,
  DANGER_PREFIXES,
  DEFAULT_EXPORT_OPTIONS,
  DEFAULT_IMPORT_OPTIONS
};