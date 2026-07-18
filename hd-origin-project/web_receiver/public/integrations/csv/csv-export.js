(() => {
  const profileDefinitions = [
    {
      exportType: '汎用UTF-8 CSV',
      profileCode: 'generic-utf8',
      encoding: 'utf-8-bom',
      fileNamePrefix: 'generic_utf8',
      columns: [
        ['record_id', 'レコードID'],
        ['record_type', 'レコード種別'],
        ['company_code', '会社コード'],
        ['document_no', '管理番号'],
        ['partner_name', '相手先名'],
        ['record_date', '日付'],
        ['amount', '金額'],
        ['memo', 'メモ']
      ]
    },
    {
      exportType: '汎用Shift_JIS CSV',
      profileCode: 'generic-shift-jis',
      encoding: 'shift_jis',
      fileNamePrefix: 'generic_sjis',
      columns: [
        ['record_id', 'レコードID'],
        ['record_type', 'レコード種別'],
        ['company_code', '会社コード'],
        ['document_no', '管理番号'],
        ['partner_name', '相手先名'],
        ['record_date', '日付'],
        ['amount', '金額'],
        ['memo', 'メモ']
      ]
    },
    {
      exportType: '会計仕訳CSV',
      profileCode: 'accounting-journal',
      encoding: 'utf-8-bom',
      fileNamePrefix: 'accounting_journal',
      columns: [
        ['voucher_date', '伝票日付'],
        ['voucher_no', '伝票番号'],
        ['debit_account_code', '借方科目'],
        ['debit_amount', '借方金額'],
        ['credit_account_code', '貸方科目'],
        ['credit_amount', '貸方金額'],
        ['description', '摘要'],
        ['memo', 'メモ']
      ]
    },
    {
      exportType: '支払予定CSV',
      profileCode: 'payable-schedule',
      encoding: 'utf-8-bom',
      fileNamePrefix: 'payable_schedule',
      columns: [
        ['company_code', '会社コード'],
        ['document_no', '管理番号'],
        ['vendor_name', '支払先名'],
        ['payment_due_date', '支払期限'],
        ['scheduled_payment_date', '支払予定日'],
        ['amount_including_tax', '税込金額'],
        ['status', '状態'],
        ['memo', 'メモ']
      ]
    },
    {
      exportType: '銀行振込CSV',
      profileCode: 'bank-transfer',
      encoding: 'utf-8-bom',
      fileNamePrefix: 'bank_transfer',
      columns: [
        ['transfer_date', '振込指定日'],
        ['recipient_name', '受取人名'],
        ['bank_name', '金融機関名'],
        ['branch_name', '支店名'],
        ['account_no', '口座番号'],
        ['transfer_amount', '振込金額'],
        ['document_no', '管理番号'],
        ['memo', 'メモ']
      ]
    },
    {
      exportType: '売上・請求CSV',
      profileCode: 'sales-invoice',
      encoding: 'utf-8-bom',
      fileNamePrefix: 'sales_invoice',
      columns: [
        ['company_code', '会社コード'],
        ['sales_no', '売上番号'],
        ['customer_name', '得意先名'],
        ['sales_date', '売上日'],
        ['product_name', '商品名'],
        ['quantity', '数量'],
        ['amount_including_tax', '税込金額'],
        ['description', '摘要']
      ]
    },
    {
      exportType: '取引先マスタCSV',
      profileCode: 'business-partner-master',
      encoding: 'utf-8-bom',
      fileNamePrefix: 'business_partner_master',
      columns: [
        ['business_partner_code', '取引先コード'],
        ['business_partner_name', '取引先名'],
        ['postal_code', '郵便番号'],
        ['address1', '住所1'],
        ['phone', '電話番号'],
        ['registration_no', '登録番号'],
        ['is_active', '有効フラグ']
      ]
    },
    {
      exportType: '商品マスタCSV',
      profileCode: 'product-master',
      encoding: 'utf-8-bom',
      fileNamePrefix: 'product_master',
      columns: [
        ['product_code', '商品コード'],
        ['product_name', '商品名'],
        ['unit', '単位'],
        ['standard_unit_price', '標準単価'],
        ['tax_rate', '税率'],
        ['is_active', '有効フラグ']
      ]
    }
  ];

  const mockRecords = {
    'generic-utf8': [
      {
        record_id: '1',
        record_type: 'sample',
        company_code: 'HATO_DAIYA',
        document_no: 'GEN-0001',
        partner_name: '株式会社サンプル',
        record_date: '2026/07/17',
        amount: '110000',
        memo: 'UTF-8モック'
      }
    ],
    'generic-shift-jis': [
      {
        record_id: '1',
        record_type: 'legacy',
        company_code: 'HATO_DAIYA',
        document_no: 'SJIS-0001',
        partner_name: '旧会計ソフト向け',
        record_date: '2026/07/17',
        amount: '55000',
        memo: 'Shift_JISモック'
      }
    ],
    'accounting-journal': [
      {
        voucher_date: '2026/07/17',
        voucher_no: 'JV-0001',
        debit_account_code: '6110',
        debit_amount: '110000',
        credit_account_code: '2110',
        credit_amount: '110000',
        description: '外注費計上',
        memo: 'モック仕訳'
      }
    ],
    'payable-schedule': [
      {
        company_code: 'HATO_DAIYA',
        document_no: 'PD-000001',
        vendor_name: '株式会社サンプル',
        payment_due_date: '2026/07/31',
        scheduled_payment_date: '2026/08/05',
        amount_including_tax: '110000',
        status: 'scheduled',
        memo: 'モック支払予定'
      }
    ],
    'bank-transfer': [
      {
        transfer_date: '2026/08/05',
        recipient_name: '株式会社サンプル',
        bank_name: 'サンプル銀行',
        branch_name: '本店営業部',
        account_no: '1234567',
        transfer_amount: '110000',
        document_no: 'PD-000001',
        memo: 'モック振込'
      }
    ],
    'sales-invoice': [
      {
        company_code: 'HATO_DAIYA',
        sales_no: 'SL-000001',
        customer_name: '株式会社テスト商事',
        sales_date: '2026/07/17',
        product_name: 'サンプル商品A',
        quantity: '10',
        amount_including_tax: '88000',
        description: 'モック売上'
      },
      {
        company_code: 'HATO_DAIYA',
        sales_no: 'SL-000001',
        customer_name: '株式会社テスト商事',
        sales_date: '2026/07/17',
        product_name: 'サンプル商品B',
        quantity: '5',
        amount_including_tax: '22000',
        description: 'モック売上'
      }
    ],
    'business-partner-master': [
      {
        business_partner_code: 'BP-0001',
        business_partner_name: '株式会社サンプル',
        postal_code: '123-4567',
        address1: '東京都千代田区サンプル1-2-3',
        phone: '03-1111-2222',
        registration_no: 'T1234567890123',
        is_active: '1'
      }
    ],
    'product-master': [
      {
        product_code: 'PRD-0001',
        product_name: 'サンプル商品A',
        unit: '個',
        standard_unit_price: '10000',
        tax_rate: '10',
        is_active: '1'
      }
    ]
  };

  const state = {
    csvText: '',
    fileName: ''
  };

  const els = {
    exportType: document.getElementById('exportType'),
    companyCode: document.getElementById('companyCode'),
    dateFrom: document.getElementById('dateFrom'),
    dateTo: document.getElementById('dateTo'),
    status: document.getElementById('status'),
    encoding: document.getElementById('encoding'),
    profileCode: document.getElementById('profileCode'),
    includeHeader: document.getElementById('includeHeader'),
    recordCount: document.getElementById('recordCount'),
    validationResult: document.getElementById('validationResult'),
    csvPreview: document.getElementById('csvPreview'),
    generateButton: document.getElementById('generateButton'),
    downloadButton: document.getElementById('downloadButton')
  };

  function q(value) {
    const s = String(value ?? '');
    if (/[",\r\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function timeStamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return [
      d.getFullYear(),
      pad(d.getMonth() + 1),
      pad(d.getDate())
    ].join('') + '_' + [
      pad(d.getHours()),
      pad(d.getMinutes()),
      pad(d.getSeconds())
    ].join('');
  }

  function fileNameFor(profile) {
    const company = String(els.companyCode.value || 'COMMON').replace(/[\\/:*?"<>| ]/g, '_');
    return `${profile.fileNamePrefix}_${company}_${timeStamp()}_001.csv`;
  }

  function getCurrentProfile() {
    return profileDefinitions.find(x => x.profileCode === els.profileCode.value) || profileDefinitions[0];
  }

  function getMockRows(profileCode) {
    const rows = mockRecords[profileCode] || [];
    const company = els.companyCode.value || 'HATO_DAIYA';
    const status = els.status.value || '';
    return rows.map(r => ({
      ...r,
      company_code: r.company_code || company,
      status: r.status || status
    }));
  }

  function validateRows(profile, rows) {
    const messages = [];
    let hasError = false;

    if (!rows.length) {
      hasError = true;
      messages.push('ERROR: 対象データが0件です。');
    }

    profile.columns.forEach(([key, label]) => {
      const blankCount = rows.filter(r => (r[key] ?? '') === '').length;
      if (blankCount > 0) {
        messages.push(`INFO: ${label} が空の行 ${blankCount} 件`);
      }
    });

    if (!hasError) {
      messages.unshift('OK: モック検証を通過しました。');
    }

    return {
      hasError,
      text: messages.join('\n')
    };
  }

  function buildCsv(profile, rows, includeHeader) {
    const lines = [];

    if (includeHeader) {
      lines.push(profile.columns.map(([, header]) => q(header)).join(','));
    }

    rows.forEach(row => {
      lines.push(profile.columns.map(([key]) => q(row[key] ?? '')).join(','));
    });

    return lines.join('\r\n');
  }

  function fillSelectors() {
    profileDefinitions.forEach(profile => {
      const option1 = document.createElement('option');
      option1.value = profile.profileCode;
      option1.textContent = profile.exportType;
      els.exportType.appendChild(option1);

      const option2 = document.createElement('option');
      option2.value = profile.profileCode;
      option2.textContent = `${profile.profileCode} / ${profile.exportType}`;
      els.profileCode.appendChild(option2);
    });

    ['utf-8', 'utf-8-bom', 'shift_jis', 'cp932'].forEach(enc => {
      const option = document.createElement('option');
      option.value = enc;
      option.textContent = enc;
      els.encoding.appendChild(option);
    });

    els.exportType.value = 'payable-schedule';
    els.profileCode.value = 'payable-schedule';
    els.encoding.value = 'utf-8-bom';
  }

  function syncProfileSelectors(source) {
    const value = source.value;
    els.exportType.value = value;
    els.profileCode.value = value;
    const profile = getCurrentProfile();
    els.encoding.value = profile.encoding;
    const rows = getMockRows(profile.profileCode);
    els.recordCount.textContent = String(rows.length);
  }

  function generate() {
    const profile = getCurrentProfile();
    const rows = getMockRows(profile.profileCode);
    const validation = validateRows(profile, rows);
    const csv = buildCsv(profile, rows, els.includeHeader.checked);

    state.csvText = csv;
    state.fileName = fileNameFor(profile);

    els.recordCount.textContent = String(rows.length);
    els.validationResult.textContent =
      `profileCode=${profile.profileCode}\nencoding=${els.encoding.value}\nfileName=${state.fileName}\n\n${validation.text}`;
    els.csvPreview.value = csv;
    els.downloadButton.disabled = validation.hasError;
  }

  function download() {
    if (!state.csvText) return;

    const blob = new Blob([state.csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = state.fileName || 'csv_export_mock.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  fillSelectors();
  syncProfileSelectors(els.profileCode);

  els.exportType.addEventListener('change', () => syncProfileSelectors(els.exportType));
  els.profileCode.addEventListener('change', () => syncProfileSelectors(els.profileCode));
  els.generateButton.addEventListener('click', generate);
  els.downloadButton.addEventListener('click', download);
})();