
const ENDPOINT_CANDIDATES = ["/api/payment-documents/payables","/api/payment-documents/payables/list","/api/payment-documents/unpaid","/api/payment-documents/unpaid/list","/api/payables","/api/payables/list","/api/invoices/payables","/api/invoices/unpaid"];

function yen(value){
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '';
  return n.toLocaleString('ja-JP');
}

function text(value){
  if (value === null || value === undefined) return '';
  return String(value);
}

function num(value){
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/[^\d.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function first(obj, keys){
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') return obj[key];
  }
  return '';
}

function normalize(row){
  const total = num(first(row, ['total_amount','total','amount_total','amount','税込合計','税込金額','gross_amount']));
  const paid = num(first(row, ['paid_amount','payment_amount','支払済額','paid_total']));
  const balanceRaw = first(row, ['unpaid_balance','balance','remaining_amount','未払残高']);
  const balance = balanceRaw === '' ? Math.max(total - paid, 0) : num(balanceRaw);

  return {
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
    note: text(first(row, ['note','memo','remarks','備考']))
  };
}

function statusClass(status){
  const s = String(status || '');
  if (/済|paid|完了/i.test(s)) return 'status paid';
  if (/超過|遅|alert|error|要確認/i.test(s)) return 'status alert';
  if (/未|unpaid|予定|確定/i.test(s)) return 'status unpaid';
  return 'status';
}

function escapeHtml(value){
  return String(value || '').replace(/[&<>"']/g, function(ch){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
  });
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

  params.set('format', 'report');
  params.set('view', 'report');

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

function renderRows(rows, endpoint){
  const normalized = rows.map(normalize);
  const tbody = document.getElementById('detailBody');
  tbody.innerHTML = '';

  let sumNet = 0;
  let sumTax = 0;
  let sumTotal = 0;
  let sumPaid = 0;
  let sumBalance = 0;

  normalized.forEach(function(row, index){
    sumNet += row.net_amount;
    sumTax += row.tax_amount;
    sumTotal += row.total_amount;
    sumPaid += row.paid_amount;
    sumBalance += row.unpaid_balance;

    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="center">' + (index + 1) + '</td>' +
      '<td>' + escapeHtml(row.management_no) + '</td>' +
      '<td class="center"><span class="' + statusClass(row.status) + '">' + escapeHtml(row.status) + '</span></td>' +
      '<td>' + escapeHtml(row.document_type) + '</td>' +
      '<td>' + escapeHtml(row.accounting_type) + '</td>' +
      '<td>' + escapeHtml(row.vendor_name) + '</td>' +
      '<td>' + escapeHtml(row.invoice_no) + '</td>' +
      '<td>' + escapeHtml(row.invoice_date) + '</td>' +
      '<td>' + escapeHtml(row.posting_date) + '</td>' +
      '<td>' + escapeHtml(row.due_date) + '</td>' +
      '<td>' + escapeHtml(row.scheduled_payment_date) + '</td>' +
      '<td class="num">' + yen(row.net_amount) + '</td>' +
      '<td class="num">' + yen(row.tax_amount) + '</td>' +
      '<td class="num">' + yen(row.total_amount) + '</td>' +
      '<td class="num">' + yen(row.paid_amount) + '</td>' +
      '<td class="num">' + yen(row.unpaid_balance) + '</td>' +
      '<td>' + escapeHtml(row.note) + '</td>';

    tbody.appendChild(tr);
  });

  document.getElementById('sumCount').textContent = normalized.length.toLocaleString('ja-JP');
  document.getElementById('sumNet').textContent = yen(sumNet);
  document.getElementById('sumTax').textContent = yen(sumTax);
  document.getElementById('sumTotal').textContent = yen(sumTotal);
  document.getElementById('sumPaid').textContent = yen(sumPaid);
  document.getElementById('sumBalance').textContent = yen(sumBalance);
  document.getElementById('metaCount').textContent = normalized.length.toLocaleString('ja-JP');

  const params = new URLSearchParams(window.location.search);
  const company = params.get('company') || '-';
  document.getElementById('metaCompany').textContent = company;
  document.getElementById('filterBox').textContent =
    '検索条件: ' + (window.location.search ? window.location.search.replace(/^\\?/, '') : '指定なし') +
    ' / 取得API: ' + endpoint;

  if (!normalized.length) {
    document.getElementById('message').innerHTML =
      '<div class="empty">対象データがありません。</div>';
  } else {
    document.getElementById('message').innerHTML = '';
  }
}

async function main(){
  document.getElementById('metaPrintedAt').textContent = new Date().toLocaleString('ja-JP');

  try {
    const result = await loadRows();
    renderRows(result.rows, result.endpoint);
  } catch (error) {
    document.getElementById('message').innerHTML =
      '<div class="error">請求書・未払一覧APIからデータを取得できませんでした。<br>' +
      'この帳票HTMLは作成済みですが、既存APIの実URLに合わせた接続調整が必要です。<br><pre>' +
      escapeHtml(error.message) +
      '</pre></div>';
    document.getElementById('filterBox').textContent = '検索条件: API未接続';
  }
}

document.getElementById('printBtn').addEventListener('click', function(){
  window.print();
});

document.getElementById('reloadBtn').addEventListener('click', function(){
  window.location.reload();
});

main();
