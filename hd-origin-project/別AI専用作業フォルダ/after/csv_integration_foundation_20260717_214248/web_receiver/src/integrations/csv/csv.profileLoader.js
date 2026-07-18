const fs = require('fs');
const path = require('path');
const { ENCODINGS, DELIMITERS, LINE_ENDINGS, QUOTE_MODES } = require('./csv.constants');

const PROFILE_DIR = path.join(__dirname, 'profiles');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function validateProfile(profile) {
  const errors = [];

  if (!profile || typeof profile !== 'object') errors.push('profile object missing');
  if (!profile.profileCode) errors.push('profileCode missing');
  if (!profile.profileName) errors.push('profileName missing');
  if (!profile.direction) errors.push('direction missing');
  if (!Object.values(ENCODINGS).includes(String(profile.encoding || '').toLowerCase())) errors.push('encoding invalid');
  if (!Object.values(DELIMITERS).includes(profile.delimiter)) errors.push('delimiter invalid');
  if (!Object.values(LINE_ENDINGS).includes(profile.lineEnding)) errors.push('lineEnding invalid');
  if (!QUOTE_MODES.includes(profile.quoteMode)) errors.push('quoteMode invalid');
  if (!Array.isArray(profile.columns) || profile.columns.length === 0) errors.push('columns missing');

  const sourceSet = new Set();
  const headerSet = new Set();

  for (const c of profile.columns || []) {
    if (!c.sourceField) errors.push(`sourceField missing: ${JSON.stringify(c)}`);
    if (!c.csvHeader) errors.push(`csvHeader missing: ${JSON.stringify(c)}`);
    if (c.sourceField && sourceSet.has(c.sourceField)) errors.push(`duplicate sourceField: ${c.sourceField}`);
    if (c.csvHeader && headerSet.has(c.csvHeader)) errors.push(`duplicate csvHeader: ${c.csvHeader}`);
    if (c.sourceField) sourceSet.add(c.sourceField);
    if (c.csvHeader) headerSet.add(c.csvHeader);
  }

  return {
    success: errors.length === 0,
    errors
  };
}

function loadProfile(profileCode) {
  const filePath = path.join(PROFILE_DIR, `${profileCode}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Profile not found: ${profileCode}`);
  }

  const profile = readJson(filePath);
  const checked = validateProfile(profile);

  if (!checked.success) {
    throw new Error(`Profile invalid: ${profileCode} :: ${checked.errors.join(' | ')}`);
  }

  return profile;
}

function listProfiles() {
  if (!fs.existsSync(PROFILE_DIR)) return [];

  return fs.readdirSync(PROFILE_DIR)
    .filter(name => name.endsWith('.json'))
    .map(name => {
      const filePath = path.join(PROFILE_DIR, name);
      const profile = readJson(filePath);
      return {
        profileCode: profile.profileCode,
        profileName: profile.profileName,
        direction: profile.direction,
        encoding: profile.encoding,
        fileNamePrefix: profile.fileNamePrefix,
        columnCount: Array.isArray(profile.columns) ? profile.columns.length : 0
      };
    })
    .sort((a, b) => a.profileCode.localeCompare(b.profileCode));
}

module.exports = {
  PROFILE_DIR,
  validateProfile,
  loadProfile,
  listProfiles
};