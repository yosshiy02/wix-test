function pad(num, size) {
  return String(num).padStart(size, '0');
}

function formatDateTime(value) {
  const d = value instanceof Date ? value : new Date(value || Date.now());
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1, 2);
  const dd = pad(d.getDate(), 2);
  const hh = pad(d.getHours(), 2);
  const mm = pad(d.getMinutes(), 2);
  const ss = pad(d.getSeconds(), 2);
  return `${yyyy}${MM}${dd}_${hh}${mm}${ss}`;
}

function sanitizeSegment(input, fallback = 'UNKNOWN') {
  const v = String(input ?? '').trim();
  const cleaned = v
    .replace(/[\\\/:\*\?"<>\|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || fallback;
}

function generateFileName({ prefix, company, datetime, sequence = 1, extension = 'csv' }) {
  const safePrefix = sanitizeSegment(prefix || 'csv_export', 'csv_export');
  const safeCompany = sanitizeSegment(company || 'COMMON', 'COMMON');
  const safeDateTime = formatDateTime(datetime || new Date());
  const safeSeq = pad(sequence, 3);
  const safeExt = sanitizeSegment(extension || 'csv', 'csv');
  return `${safePrefix}_${safeCompany}_${safeDateTime}_${safeSeq}.${safeExt}`;
}

module.exports = {
  pad,
  formatDateTime,
  sanitizeSegment,
  generateFileName
};