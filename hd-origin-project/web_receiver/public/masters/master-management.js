/* master-management.js
   マスタ管理画面のJS。
   2026-07-07: master-management.html の <script> から分離。
*/
const MASTER_GROUPS = {
  accounting: [
    "account_titles",
    "payment_methods",
    "tax_categories",
    "invoice_types",
    "evidence_types"
  ],
  daily: [
    "vendors",
    "target_people",
    "purposes",
    "projects",
    "departments"
  ],
  organization: [
    "companies",
    "people",
    "positions",
    "permissions"
  ],  paymentDocuments: [
    "document_types",
    "payment_destinations",
    "accounting_categories",
    "payable_kinds",
    "payment_source_types"
  ]
};

const MASTER_NOTES = {
  account_titles:
    "勘定科目は、借方・貸方の伝票入力や集計の土台になります。紙の勘定科目スタンプを元に整備します。",
  payment_methods:
    "支払方法は、現金・普通預金・カードなど、レシート読込や経費入力でも使う支払い手段です。借方・貸方・科目との対応はここに混ぜず、別の仕訳ルール側で扱います。",
  tax_categories:
    "税区分は、消費税の扱いに関係します。自由に増やしすぎず、必要なものだけ管理します。",
  invoice_types:
    "インボイス区分は、適格請求書かどうかなどの判定に使います。",
  evidence_types:
    "証憑区分は、レシート・請求書・領収書など、証拠書類の種類を管理します。",
  vendors:
    "支払先は、買った相手・支払った相手を管理します。",
  target_people:
    "対象者は、その経費・レシート・伝票が誰に関係するかを見るために使います。",
  purposes:
    "目的は、経費の目的や用途を管理します。",
  projects:
    "案件は、仕事・イベント・企画などに紐づけるために使います。",
  departments:
    "部門は、会社内の部署や管理単位に紐づけるために使います。",
  companies:
    "会社は、支払・証憑・台帳・承認処理がどの法人に属するかを区別するために使います。会社名、プログラムコード、法人区分を管理します。",
  people:
    "人物は、会社に所属する人や確認担当者を管理します。経費の対象者マスタとは別に管理します。",
  positions:
    "役職は、代表取締役、専務取締役、常務取締役など、会社内での役職区分を管理します。",
  permissions:
    "権限は、閲覧・確認・承認・管理などの権限区分を管理します。会社・人物・役職との紐付けは次の段階で専用管理します。",  document_types:
    "書類区分は、請求書・納付書・Web明細・カード明細など、支払書類そのものの種類を管理します。固定文字列ではなくマスタから選択します。",
  payment_destinations:
    "処理先は、未払管理・買掛管理・経費管理・税金公的支払など、読取後にどこへ回すかを管理します。",
  accounting_categories:
    "会計区分は、通常・立替・税金・公共料金・保険・リースなど、会計処理の大枠を管理します。",
  payable_kinds:
    "未払種別は、買掛金・未払金・未払費用・カード未払など、未払管理上の区分を管理します。",
  payment_source_types:
    "入手元区分は、スキャン・PDF取込・メール保存・Web明細ダウンロードなど、支払書類の入手経路を管理します。",};

const EXTRA_LABELS = {
  company_code: "プログラムコード",
  company_type: "法人区分",
  person_code: "プログラムコード",
  position_code: "プログラムコード",
  permission_code: "プログラムコード",
  permission_level: "権限レベル",
  account_code: "科目コード",

  payment_method_code: "内部コード",
  tax_category_code: "内部コード",
  invoice_type_code: "内部コード",
  evidence_type_code: "内部コード",

  document_type_code: "内部コード",
  payment_destination_code: "内部コード",
  accounting_category_code: "内部コード",
  payable_kind_code: "内部コード",
  payment_source_type_code: "内部コード",

  default_credit_account: "通常貸方科目",
  tax_rate: "税率"
};

let masterTypes = [];
let currentItems = [];
let selectedType = "";

function showResult(data) {
  document.getElementById("result").textContent =
    typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

function currentType() {
  return selectedType;
}

function currentTypeInfo() {
  return masterTypes.find(t => t.type === currentType()) || null;
}

function getExtraColumns() {
  const typeInfo = currentTypeInfo();

  if (!typeInfo) {
    return [];
  }

  // 支払方法はレシート読込・経費入力でも使う「支払い手段」なので、
  // 通常貸方科目などの会計変換ルールはここでは表示しない。
  // 借方・貸方・科目との対応は、別の仕訳ルール側で扱う。
  if (typeInfo.type === "payment_methods") {
    return [];
  }

  return Array.isArray(typeInfo.extra_columns)
    ? typeInfo.extra_columns
    : [];
}

function getExtraColumnLabel(column) {
  const typeInfo = currentTypeInfo();
  const labels = typeInfo && typeInfo.extra_column_labels ? typeInfo.extra_column_labels : {};
  return labels[column] || EXTRA_LABELS[column] || column;
}

function getExtraInputType(column) {
  return (
    column === "tax_rate" ||
    column === "permission_level"
  )
    ? "number"
    : "text";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function loadMasterTypes() {
  const res = await fetch("/api/masters/types");
  const data = await res.json();

  if (!data.ok) {
    showResult(data);
    return;
  }

  masterTypes = data.types || [];
  renderMasterButtons();

  const firstType = masterTypes.find(t => t.type === "account_titles") || masterTypes[0];

  if (firstType) {
    await selectMaster(firstType.type);
  } else {
    showResult("マスタ定義がありません。");
  }
}

function renderMasterButtons() {
  renderButtonGroup("accountingMasterButtons", MASTER_GROUPS.accounting);
  renderButtonGroup("dailyMasterButtons", MASTER_GROUPS.daily);
  renderButtonGroup("organizationMasterButtons", MASTER_GROUPS.organization);
  renderButtonGroup("paymentDocumentMasterButtons", MASTER_GROUPS.paymentDocuments);
}

function renderButtonGroup(elementId, typeList) {
  const area = document.getElementById(elementId);

  area.innerHTML = typeList
    .map(type => masterTypes.find(t => t.type === type))
    .filter(Boolean)
    .map(typeInfo => `
      <button
        type="button"
        id="master_button_${escapeHtml(typeInfo.type)}"
        onclick="selectMaster('${escapeHtml(typeInfo.type)}')"
      >
        ${escapeHtml(typeInfo.label)}
      </button>
    `)
    .join("");
}

function updateSelectedButton() {
  for (const typeInfo of masterTypes) {
    const btn = document.getElementById(`master_button_${typeInfo.type}`);
    if (btn) {
      btn.classList.toggle("selected", typeInfo.type === selectedType);
    }
  }
}

async function selectMaster(type) {
  selectedType = type;
  updateSelectedButton();

  const typeInfo = currentTypeInfo();

  if (!typeInfo) {
    showResult(`未対応のマスタです: ${type}`);
    return;
  }

  document.getElementById("addCard").style.display = "";
  document.getElementById("listCard").style.display = "";
  document.getElementById("activeMasterTitle").textContent = typeInfo.label;
  document.getElementById("newNameLabel").textContent = `${typeInfo.label}名`;
  document.getElementById("activeMasterNote").textContent =
    (typeInfo.note || MASTER_NOTES[typeInfo.type] || "このマスタを管理します。") +
    " 表示順は画面の並び替え用です。管理IDは自動番号なので意味を持たせません。";

  renderNewExtraFields();
  await loadMasterItems();
}

function renderNewExtraFields() {
  const area = document.getElementById("newExtraFields");
  const columns = getExtraColumns();

  if (!columns.length) {
    area.innerHTML = "";
    return;
  }

  area.innerHTML = columns.map(column => `
    <div>
      <label>${escapeHtml(getExtraColumnLabel(column))}</label>
      <input
        class="extra-input"
        id="new_extra_${escapeHtml(column)}"
        type="${getExtraInputType(column)}"
        placeholder="${escapeHtml(getExtraColumnLabel(column))}"
      >
    </div>
  `).join("");
}

async function loadMasterItems() {
  const type = currentType();

  if (!type) return;

  const res = await fetch(`/api/masters/${encodeURIComponent(type)}`);
  const data = await res.json();

  if (!data.ok) {
    showResult(data);
    return;
  }

  currentItems = data.items || data.rows || data.masters || [];
  renderMasterList();
  showResult(`${currentTypeInfo().label} を読み込みました。`);
}

function renderMasterList() {
  const columns = getExtraColumns();

  if (!currentItems.length) {
    document.getElementById("masterList").textContent = "データがありません。";
    return;
  }

  const extraHeaders = columns
    .map(column => `<th>${escapeHtml(getExtraColumnLabel(column))}</th>`)
    .join("");

  let html = `
    <table>
      <tr>
        <th>管理ID</th>
        <th>名称</th>
        ${extraHeaders}
        <th>
      <span class="sort-header-wrap">
        <span>表示順</span>
        <button type="button" class="sort-normalize-button" onclick="normalizeMasterSortOrder()">整頓</button>
      </span>
    </th>
        <th>使用中</th>
        <th>操作</th>
      </tr>
  `;

  for (const item of currentItems) {
    const inactiveClass = item.is_active ? "" : "inactive";

    const extraCells = columns.map(column => `
      <td>
        <input
          class="extra-input"
          id="extra_${escapeHtml(column)}_${item.id}"
          type="${getExtraInputType(column)}"
          value="${escapeHtml(item[column] ?? "")}"
        >
      </td>
    `).join("");

    html += `
      <tr class="${inactiveClass}">
        <td class="id-cell">${item.id}</td>
        <td>
          <input class="name-input" id="name_${item.id}" value="${escapeHtml(item.name || "")}">
        </td>
        ${extraCells}
        <td class="sort-cell">
          <button class="move-button" onclick="moveMasterItem(${item.id}, -1)" title="上へ">↑</button>
          <input class="sort-input" id="sort_${item.id}" type="number" value="${item.sort_order || 0}">
          <button class="move-button" onclick="moveMasterItem(${item.id}, 1)" title="下へ">↓</button>
        </td>
        <td>
          <input id="active_${item.id}" type="checkbox" ${item.is_active ? "checked" : ""}>
        </td>
        <td>
          <button onclick="updateMasterItem(${item.id})">更新</button>
          <button class="${item.is_active ? "danger" : "ok"}" onclick="toggleActive(${item.id}, ${item.is_active ? "false" : "true"})">
            ${item.is_active ? "使用停止" : "使用再開"}
          </button>
        </td>
      </tr>
    `;
  }

  html += "</table>";
  document.getElementById("masterList").innerHTML = html;
}

function collectNewExtraPayload() {
  const payload = {};

  for (const column of getExtraColumns()) {
    const el = document.getElementById(`new_extra_${column}`);
    if (el) {
      payload[column] = el.value;
    }
  }

  return payload;
}

function collectRowExtraPayload(id) {
  const payload = {};

  for (const column of getExtraColumns()) {
    const el = document.getElementById(`extra_${column}_${id}`);
    if (el) {
      payload[column] = el.value;
    }
  }

  return payload;
}

function clearNewExtraFields() {
  for (const column of getExtraColumns()) {
    const el = document.getElementById(`new_extra_${column}`);
    if (el) {
      el.value = "";
    }
  }
}

async function addMasterItem() {
  const type = currentType();

  const payload = {
    type,
    name: document.getElementById("newName").value,
    sort_order: document.getElementById("newSortOrder").value,
    ...collectNewExtraPayload()
  };

  const res = await fetch(`/api/masters/${encodeURIComponent(type)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (!data.ok) {
    showResult(data);
    return;
  }

  document.getElementById("newName").value = "";
  document.getElementById("newSortOrder").value = "0";
  clearNewExtraFields();

  showResult(data);
  await loadMasterItems();
}

async function updateMasterItem(id) {
  const type = currentType();

  const payload = {
    name: document.getElementById(`name_${id}`).value,
    sort_order: document.getElementById(`sort_${id}`).value,
    is_active: document.getElementById(`active_${id}`).checked,
    ...collectRowExtraPayload(id)
  };

  const res = await fetch(`/api/masters/${encodeURIComponent(type)}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  showResult(data);

  if (data.ok) {
    await loadMasterItems();
  }
}

async function normalizeMasterSortOrder() {
  const type = currentType();

  if (!type) {
    showResult("先にマスタを選んでください。");
    return;
  }

  if (!currentItems.length) {
    showResult("整頓するマスタ行がありません。");
    return;
  }

  const ok = confirm(
    "現在の表示順を正として、表示順を1から振り直します。\n" +
    "管理ID・名称・使用中/使用停止は変更しません。\n\n" +
    "実行しますか？"
  );

  if (!ok) {
    showResult("表示順の整頓をキャンセルしました。");
    return;
  }

  const errors = [];
  let changedCount = 0;

  for (let i = 0; i < currentItems.length; i++) {
    const item = currentItems[i];
    const nextSortOrder = i + 1;
    const currentSortOrder = Number(item.sort_order || 0);

    if (currentSortOrder === nextSortOrder) {
      continue;
    }

    try {
      const res = await fetch(`/api/masters/${encodeURIComponent(type)}/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sort_order: nextSortOrder
        })
      });

      const data = await res.json();

      if (!data.ok) {
        errors.push({
          id: item.id,
          name: item.name,
          error: data.error || data
        });
        continue;
      }

      changedCount++;
    } catch (error) {
      errors.push({
        id: item.id,
        name: item.name,
        error: error.message || String(error)
      });
    }
  }

  if (errors.length) {
    showResult({
      ok: false,
      message: "一部の表示順整頓に失敗しました。",
      changed_count: changedCount,
      errors
    });
    await loadMasterItems();
    return;
  }

  showResult(
    "表示順を整頓しました。\n" +
    "変更件数: " + changedCount + "件\n" +
    "管理ID・名称・使用中/使用停止は変更していません。"
  );

  await loadMasterItems();
}
async function moveMasterItem(id, direction) {
  const index = currentItems.findIndex(item => Number(item.id) === Number(id));

  if (index < 0) {
    showResult("移動対象が見つかりません。");
    return;
  }

  const nextIndex = index + direction;

  if (nextIndex < 0 || nextIndex >= currentItems.length) {
    showResult("これ以上移動できません。");
    return;
  }

  const current = currentItems[index];
  const target = currentItems[nextIndex];

  const currentSort = Number(current.sort_order || 0);
  const targetSort = Number(target.sort_order || 0);

  const currentName = document.getElementById(`name_${current.id}`).value;
  const targetName = document.getElementById(`name_${target.id}`).value;

  const currentActive = document.getElementById(`active_${current.id}`).checked;
  const targetActive = document.getElementById(`active_${target.id}`).checked;

  const currentExtra = {};
  const targetExtra = {};

  for (const column of getExtraColumns()) {
    const currentEl = document.getElementById(`extra_${column}_${current.id}`);
    const targetEl = document.getElementById(`extra_${column}_${target.id}`);

    if (currentEl) currentExtra[column] = currentEl.value;
    if (targetEl) targetExtra[column] = targetEl.value;
  }

  const currentPayload = {
    name: currentName,
    sort_order: targetSort,
    is_active: currentActive,
    ...currentExtra
  };

  const targetPayload = {
    name: targetName,
    sort_order: currentSort,
    is_active: targetActive,
    ...targetExtra
  };

  const type = currentType();

  const res1 = await fetch(`/api/masters/${encodeURIComponent(type)}/${current.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(currentPayload)
  });

  const data1 = await res1.json();

  if (!data1.ok) {
    showResult(data1);
    return;
  }

  const res2 = await fetch(`/api/masters/${encodeURIComponent(type)}/${target.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(targetPayload)
  });

  const data2 = await res2.json();

  if (!data2.ok) {
    showResult(data2);
    return;
  }

  showResult("表示順を入れ替えました。");
  await loadMasterItems();
}

async function toggleActive(id, active) {
  document.getElementById(`active_${id}`).checked = active;
  await updateMasterItem(id);
}

/* MASTER_MANAGEMENT_SIMPLE_RESTART_20260707_START */
function restartServerLog(message) {
  const result = document.getElementById("result");
  const now = new Date().toLocaleString("ja-JP", {
    hour12: false
  });

  const line = "[" + now + "] " + message;

  if (result) {
    const current = String(result.textContent || "").trim();
    result.textContent = current && current !== "待機中"
      ? current + "\n" + line
      : line;
  }

  console.log(line);
}

function restartServerSleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function restartServerSimple() {
  restartServerLog("サーバー再起動中...");

  try {
    await fetch("/api/system/restart-with-backup", {
      method: "POST"
    });
  } catch (error) {
    // 再起動中は通信が切れることがあるので、ここではエラー扱いにしない
  }

  await restartServerSleep(1200);

  for (let i = 1; i <= 60; i++) {
    try {
      const res = await fetch("/api/masters/types?restart_check=" + Date.now(), {
        cache: "no-store"
      });

      const data = await res.json();

      if (res.ok && data && data.ok) {
        restartServerLog("サーバー再起動完了");
        return;
      }
    } catch (error) {
      // 復帰待ち
    }

    await restartServerSleep(1000);
  }

  restartServerLog("サーバー再起動完了を自動確認できませんでした。画面を再読込してください。");
}
/* MASTER_MANAGEMENT_SIMPLE_RESTART_20260707_END */
document.addEventListener("DOMContentLoaded", loadMasterTypes);

