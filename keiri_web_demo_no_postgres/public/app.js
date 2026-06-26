const form = document.querySelector('#txForm');
const body = document.querySelector('#txBody');
const message = document.querySelector('#message');
const reloadBtn = document.querySelector('#reloadBtn');

function today() {
  return new Date().toISOString().slice(0, 10);
}

form.transaction_date.value = today();

function formatDate(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function formatAmount(value) {
  return Number(value || 0).toLocaleString('ja-JP');
}

async function loadTransactions() {
  body.innerHTML = '<tr><td colspan="7">読み込み中...</td></tr>';

  const res = await fetch('/api/transactions');
  const data = await res.json();

  if (!data.ok) {
    body.innerHTML = `<tr><td colspan="7">読み込み失敗：${data.error}</td></tr>`;
    return;
  }

  if (data.items.length === 0) {
    body.innerHTML = '<tr><td colspan="7">まだ登録がありません。</td></tr>';
    return;
  }

  body.innerHTML = data.items.map(item => `
    <tr>
      <td>${formatDate(item.transaction_date)}</td>
      <td>${item.type || ''}</td>
      <td>${item.partner || ''}</td>
      <td>${item.description || ''}</td>
      <td class="amount">${formatAmount(item.amount)}</td>
      <td>${item.tax_type || ''}</td>
      <td>${item.payment_method || ''}</td>
    </tr>
  `).join('');
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '保存中...';

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  const res = await fetch('/api/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (!data.ok) {
    message.textContent = `エラー：${data.error}`;
    return;
  }

  message.textContent = '保存しました。';
  form.description.value = '';
  form.amount.value = '';
  form.memo.value = '';

  await loadTransactions();
});

reloadBtn.addEventListener('click', loadTransactions);

loadTransactions().catch(err => {
  body.innerHTML = `<tr><td colspan="7">エラー：${err.message}</td></tr>`;
});
