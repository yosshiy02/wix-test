const { listProfiles } = require('./csv.profileLoader');

function getExportDefinitions() {
  return listProfiles().map((p) => ({
    profileCode: p.profileCode,
    profileName: p.profileName,
    direction: p.direction,
    encoding: p.encoding,
    fileNamePrefix: p.fileNamePrefix,
    columnCount: p.columnCount
  }));
}

module.exports = {
  getExportDefinitions
};