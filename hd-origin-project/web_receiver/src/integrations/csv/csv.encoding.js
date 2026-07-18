const { ENCODINGS } = require('./csv.constants');

function normalizeEncoding(input) {
  const value = String(input || '').trim().toLowerCase();
  switch (value) {
    case 'utf8':
    case 'utf-8':
      return ENCODINGS.UTF8;
    case 'utf8-bom':
    case 'utf-8-bom':
      return ENCODINGS.UTF8_BOM;
    case 'shift_jis':
    case 'shift-jis':
    case 'sjis':
      return ENCODINGS.SHIFT_JIS;
    case 'cp932':
    case 'ms932':
      return ENCODINGS.CP932;
    default:
      return ENCODINGS.UTF8;
  }
}

function getIconvLite() {
  try {
    return require('iconv-lite');
  } catch (_) {
    return null;
  }
}

function supportsLegacyEncoding() {
  return !!getIconvLite();
}

function stripBom(text) {
  if (typeof text !== 'string') return '';
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

function addUtf8Bom(text) {
  return '\uFEFF' + (text || '');
}

function encodeText(text, encoding) {
  const normalized = normalizeEncoding(encoding);
  const safeText = String(text ?? '');

  if (normalized === ENCODINGS.UTF8) {
    return Buffer.from(safeText, 'utf8');
  }

  if (normalized === ENCODINGS.UTF8_BOM) {
    return Buffer.from(addUtf8Bom(safeText), 'utf8');
  }

  const iconv = getIconvLite();
  if (!iconv) {
    throw new Error('Shift_JIS/CP932 requires iconv-lite. This module does not modify existing package config.');
  }

  if (normalized === ENCODINGS.SHIFT_JIS) {
    return iconv.encode(safeText, 'shift_jis');
  }

  if (normalized === ENCODINGS.CP932) {
    return iconv.encode(safeText, 'cp932');
  }

  return Buffer.from(safeText, 'utf8');
}

function decodeBuffer(buffer, encoding) {
  const normalized = normalizeEncoding(encoding);
  const safeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || '');

  if (normalized === ENCODINGS.UTF8 || normalized === ENCODINGS.UTF8_BOM) {
    return stripBom(safeBuffer.toString('utf8'));
  }

  const iconv = getIconvLite();
  if (!iconv) {
    throw new Error('Shift_JIS/CP932 requires iconv-lite. This module does not modify existing package config.');
  }

  if (normalized === ENCODINGS.SHIFT_JIS) {
    return stripBom(iconv.decode(safeBuffer, 'shift_jis'));
  }

  if (normalized === ENCODINGS.CP932) {
    return stripBom(iconv.decode(safeBuffer, 'cp932'));
  }

  return stripBom(safeBuffer.toString('utf8'));
}

module.exports = {
  normalizeEncoding,
  supportsLegacyEncoding,
  stripBom,
  addUtf8Bom,
  encodeText,
  decodeBuffer
};