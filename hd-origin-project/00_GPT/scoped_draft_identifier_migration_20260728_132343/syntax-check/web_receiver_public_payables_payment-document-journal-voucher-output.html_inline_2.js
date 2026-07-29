
function renderJournal(rows, endpoint){
  const normalized = rows.map(normalizePayable);
  const tbody = document.getElementById('detailBody');
  tbody.innerHTML = '';

  let debitTotal = 0;
  let creditTotal = 0;

  normalized.forEach(function(row, index){
    const amount = row.total_amount || row.unpaid_balance;
    const debit = amount;
    const credit = amount;

    debitTotal += debit;
    creditTotal += credit;

    const voucherDate = row.posting_date || row.invoice_date || row.due_date || '';
    const voucherNo = 'JV-' + (row.management_no || row.id || String(index + 1)).replace(/[^A-Za-z0-9-]/g, '');
    const debitAccount = row.debit_account || row.accounting_type || '費用/仕入';
    const creditAccount = row.credit_account || '未払金';
    const memo = [row.vendor_name, row.invoice_no, row.document_type].filter(Boolean).join(' / ');

    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td class="center">' + (index + 1) + '</td>' +
      '<td>' + escapeHtml(voucherDate) + '</td>' +
      '<td>' + escapeHtml(voucherNo) + '</td>' +
      '<td>' + escapeHtml(memo) + '</td>' +
      '<td>' + escapeHtml(debitAccount) + '</td>' +
      '<td>' + escapeHtml([row.department, row.project].filter(Boolean).join(' / ')) + '</td>' +
      '<td class="num">' + yen(debit) + '</td>' +
      '<td>' + escapeHtml(creditAccount) + '</td>' +
      '<td class="num">' + yen(credit) + '</td>' +
      '<td class="num">' + yen(row.tax_amount) + '</td>' +
      '<td>' + escapeHtml(row.management_no) + '</td>';

    tbody.appendChild(tr);
  });

  document.getElementById('sumCount').textContent = normalized.length.toLocaleString('ja-JP');
  document.getElementById('sumDebit').textContent = yen(debitTotal);
  document.getElementById('sumCredit').textContent = yen(creditTotal);
  document.getElementById('sumDiff').textContent = yen(debitTotal - creditTotal);

  setCommonMeta(normalized.length, endpoint);

  if (!normalized.length) {
    document.getElementById('message').innerHTML = '<div class="empty">対象データがありません。</div>';
  } else {
    document.getElementById('message').innerHTML = '';
  }
}

async function main(){
  document.getElementById('metaPrintedAt').textContent = new Date().toLocaleString('ja-JP');

  try {
    const result = await loadRows();
    renderJournal(result.rows, result.endpoint);
  } catch (error) {
    document.getElementById('message').innerHTML =
      '<div class="error">振替伝票データを取得できませんでした。<br>サブ出力HTMLは作成済みです。次工程で実APIへ接続調整してください。<br><pre>' +
      escapeHtml(error.message) +
      '</pre></div>';
    document.getElementById('filterBox').textContent = '検索条件: API未接続';
  }
}

main();
