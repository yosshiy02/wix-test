
const ENDPOINT_CANDIDATES = ["/api/payment-documents/payables","/api/payment-documents/payables/list","/api/payment-documents/unpaid","/api/payment-documents/unpaid/list","/api/payables","/api/payables/list","/api/invoices/payables","/api/invoices/unpaid"];

function yen(value){
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('ja-JP');
}

function num(value){
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function text(value){
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'はい' : 'いいえ';
  return String(value);
}

function escapeHtml(value){
  return String(value || '').replace(/[&<>"']/g, function(ch){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
  });
}

function first(row, keys){
  for (const key of keys) {
    if (row && row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return '';
}

function findArray(payload){
  if (Array.isArray(payload)) return payload;

  const keys = ['rows','items','data','results','list','payables','documents','invoices','records'];
  for (const key of keys) {
    if (Array.isArray(payload && payload[key])) return payload[key];
  }

  if (payload && payload.data) {
    const nested = findArray(payload.data);
    if (nested.length) return nested;
  }

  return [];
}

function buildQuery(){
  const current = new URL(window.location.href);
  const params = new URLSearchParams();

  for (const [key, value] of current.searchParams.entries()) {
    if (['view','format'].includes(key)) continue;
    if (value) params.set(key, value);
  }

  params.set('format', 'sub-output');
  params.set('view', 'sub-output');

  return params;
}

async function fetchFromEndpoint(endpoint){
  const query = buildQuery();
  const url = endpoint + (endpoint.includes('?') ? '&' : '?') + query.toString();

  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' },
    credentials: 'same-origin'
  });

  if (!response.ok) {
    throw new Error(response.status + ' ' + response.statusText);
  }

  return response.json();
}

async function loadRows(){
  const errors = [];

  for (const endpoint of ENDPOINT_CANDIDATES) {
    try {
      const payload = await fetchFromEndpoint(endpoint);
      const rows = findArray(payload);
      if (rows.length || payload) {
        return { endpoint, rows };
      }
    } catch (error) {
      errors.push(endpoint + ': ' + error.message);
    }
  }

  throw new Error(errors.join('\\n'));
}

function normalizePayable(row){
  const total = num(first(row, ['total_amount','total','amount_total','amount','税込合計','税込金額','gross_amount']));
  const paid = num(first(row, ['paid_amount','payment_amount','支払済額','paid_total']));
  const balanceRaw = first(row, ['unpaid_balance','balance','remaining_amount','未払残高']);
  const balance = balanceRaw === '' ? Math.max(total - paid, 0) : num(balanceRaw);

  return {
    id: text(first(row, ['id','payment_document_id','document_id'])),
    management_no: text(first(row, ['management_no','management_number','control_no','document_no','payment_document_no','管理番号','id'])),
    status: text(first(row, ['status','state','payment_status','状態'])),
    document_type: text(first(row, ['document_type','doc_type','document_category','書類区分'])),
    accounting_type: text(first(row, ['accounting_type','accounting_category','会計区分'])),
    vendor_name: text(first(row, ['vendor_name','payee_name','supplier_name','partner_name','支払先','取引先'])),
    invoice_no: text(first(row, ['invoice_no','invoice_number','bill_no','請求書番号','先方書類番号'])),
    invoice_date: text(first(row, ['invoice_date','billing_date','issue_date','請求日'])),
    posting_date: text(first(row, ['posting_date','recorded_date','accrual_date','計上日'])),
    due_date: text(first(row, ['due_date','payment_due_date','支払期限'])),
    scheduled_payment_date: text(first(row, ['scheduled_payment_date','payment_scheduled_date','支払予定日'])),
    net_amount: num(first(row, ['net_amount','subtotal','tax_excluded_amount','amount_without_tax','税抜合計','税抜金額'])),
    tax_amount: num(first(row, ['tax_amount','consumption_tax','消費税','消費税額'])),
    total_amount: total,
    paid_amount: paid,
    unpaid_balance: balance,
    debit_account: text(first(row, ['debit_account','expense_account','account_title','勘定科目','借方科目'])),
    credit_account: text(first(row, ['credit_account','payable_account','貸方科目'])),
    department: text(first(row, ['department','department_name','部門'])),
    project: text(first(row, ['project','project_name','案件'])),
    bank_name: text(first(row, ['bank_name','振込先銀行','銀行名'])),
    branch_name: text(first(row, ['branch_name','bank_branch_name','支店名'])),
    account_type: text(first(row, ['bank_account_type','account_type','預金種別'])),
    account_no: text(first(row, ['bank_account_no','account_no','account_number','口座番号'])),
    account_holder: text(first(row, ['bank_account_holder','account_holder','口座名義'])),
    note: text(first(row, ['note','memo','remarks','備考']))
  };
}

function setCommonMeta(count, endpoint){
  const params = new URLSearchParams(window.location.search);
  const company = params.get('company') || '-';

  document.getElementById('metaCompany').textContent = company;
  document.getElementById('metaPrintedAt').textContent = new Date().toLocaleString('ja-JP');
  document.getElementById('metaCount').textContent = count.toLocaleString('ja-JP');
  document.getElementById('filterBox').textContent =
    '検索条件: ' + (window.location.search ? window.location.search.replace(/^\\?/, '') : '指定なし') +
    ' / 取得API: ' + endpoint;
}

document.getElementById('printBtn').addEventListener('click', function(){
  window.print();
});

document.getElementById('reloadBtn').addEventListener('click', function(){
  window.location.reload();
});
