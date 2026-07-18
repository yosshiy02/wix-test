const UNCONNECTED = 'CSV integration repository is intentionally unconnected in this phase.';

async function listExportProfiles() { throw new Error(UNCONNECTED); }
async function fetchPayableExportRows() { throw new Error(UNCONNECTED); }
async function fetchJournalExportRows() { throw new Error(UNCONNECTED); }
async function fetchBankTransferExportRows() { throw new Error(UNCONNECTED); }
async function fetchSalesInvoiceExportRows() { throw new Error(UNCONNECTED); }
async function fetchBusinessPartnerExportRows() { throw new Error(UNCONNECTED); }
async function fetchProductExportRows() { throw new Error(UNCONNECTED); }
async function saveExportHistory() { throw new Error(UNCONNECTED); }
async function saveImportHistory() { throw new Error(UNCONNECTED); }
async function findExportHistoryById() { throw new Error(UNCONNECTED); }

module.exports = {
  UNCONNECTED,
  listExportProfiles,
  fetchPayableExportRows,
  fetchJournalExportRows,
  fetchBankTransferExportRows,
  fetchSalesInvoiceExportRows,
  fetchBusinessPartnerExportRows,
  fetchProductExportRows,
  saveExportHistory,
  saveImportHistory,
  findExportHistoryById
};