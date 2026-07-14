(() => {
    if (window.__hdReverseSchedulerInstalled) return;
    window.__hdReverseSchedulerInstalled = true;

    const EVENT_KEY = "teamEventsMulti";
    const USER_KEY = "teamCalendarUsers";

    function readJson(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch {
            return fallback;
        }
    }

    function writeJson(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function uuid() {
        return "rev_" + Math.random().toString(36).slice(2, 10);
    }

    function fDate(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    function addDays(dateText, days) {
        const d = new Date(dateText + "T00:00:00");
        d.setDate(d.getDate() + days);
        return fDate(d);
    }

    function getUsers() {
        const users = readJson(USER_KEY, []);
        if (Array.isArray(users) && users.length) {
            return users.filter(u => u.enabled !== false);
        }
        return [
            { id: "sakaguchi", name: "坂口" },
            { id: "kawatani", name: "川谷" },
            { id: "takayama", name: "高山" }
        ];
    }

    function esc(v) {
        return String(v ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    const templates = {
        delivery: {
            label: "納期・出荷逆算",
            channel: "manufacture",
            rows: [
                { offset: -14, phase: "準備", text: "材料・資材確認" },
                { offset: -10, phase: "実行", text: "製造開始" },
                { offset: -5, phase: "確認", text: "中間確認" },
                { offset: -3, phase: "確認", text: "検品" },
                { offset: -2, phase: "実行", text: "梱包・出荷準備" },
                { offset: -1, phase: "実行", text: "出荷" },
                { offset: 0, phase: "締切", text: "納品予定日" }
            ]
        },
        eventTrip: {
            label: "出店・遠征逆算",
            channel: "event",
            rows: [
                { offset: -10, phase: "準備", text: "出店資料・備品確認" },
                { offset: -7, phase: "準備", text: "商品・展示物準備" },
                { offset: -3, phase: "準備", text: "搬入物最終確認" },
                { offset: -1, phase: "移動", text: "大阪→現地 移動" },
                { offset: 0, phase: "本番", text: "イベント本番" },
                { offset: 1, phase: "移動", text: "現地→大阪 帰阪" },
                { offset: 2, phase: "確認", text: "売上・商談メモ・経費整理" }
            ]
        },
        meetingTrip: {
            label: "商談遠征逆算",
            channel: "sales",
            rows: [
                { offset: -7, phase: "準備", text: "商談資料準備" },
                { offset: -3, phase: "確認", text: "見積・提案内容確認" },
                { offset: -1, phase: "移動", text: "大阪→現地 移動" },
                { offset: 0, phase: "実行", text: "現地商談" },
                { offset: 1, phase: "移動", text: "現地→大阪 帰阪" },
                { offset: 2, phase: "実行", text: "お礼メール・議事録送付" },
                { offset: 5, phase: "締切", text: "次アクション回答期限" }
            ]
        },
        accountingMonthEnd: {
            label: "月末支払逆算",
            channel: "accounting",
            rows: [
                { offset: -7, phase: "準備", text: "請求書不足確認" },
                { offset: -5, phase: "確認", text: "支払先・金額確認" },
                { offset: -3, phase: "準備", text: "振込データ準備" },
                { offset: -1, phase: "確認", text: "最終承認" },
                { offset: 0, phase: "実行", text: "月末支払・振込実行" }
            ]
        }
    };

    function createButton() {
        if (document.getElementById("reverseSchedulerBtn")) return;

        const btn = document.createElement("button");
        btn.id = "reverseSchedulerBtn";
        btn.className = "reverse-scheduler-btn";
        btn.type = "button";
        btn.textContent = "🧩 逆算作成";

        const sidebar = document.querySelector(".sidebar");
        const before = document.getElementById("executiveCockpitBtn") ||
            document.getElementById("conflictEngineBtn") ||
            document.getElementById("ultimateFeatureBtn") ||
            document.getElementById("aiGenerateBtn");

        if (sidebar && before) sidebar.insertBefore(btn, before);
        else if (sidebar) sidebar.appendChild(btn);
        else document.body.appendChild(btn);

        btn.addEventListener("click", openModal);
    }

    function ensureModal() {
        if (document.getElementById("reverseSchedulerModal")) return;

        const modal = document.createElement("div");
        modal.id = "reverseSchedulerModal";
        modal.className = "modal-overlay reverse-scheduler-modal";

        const users = getUsers();

        modal.innerHTML = `
            <div class="reverse-box">
                <div class="reverse-header">
                    <div>
                        <h2>🧩 逆算スケジューラー</h2>
                        <p>納期・出店日・商談日・支払日から、準備・移動・実行・締切を自動作成します。</p>
                    </div>
                    <button id="reverseCloseBtn" class="reverse-close" type="button">✖</button>
                </div>

                <div class="reverse-form">
                    <label>テンプレート
                        <select id="reverseTemplate" class="input-field">
                            ${Object.keys(templates).map(k => `<option value="${k}">${templates[k].label}</option>`).join("")}
                        </select>
                    </label>
                    <label>案件名
                        <input id="reverseProjectName" class="input-field" placeholder="例：東京展示会 / 取引先A納品">
                    </label>
                    <label>基準日
                        <input id="reverseBaseDate" type="date" class="input-field">
                    </label>
                    <label>担当者
                        <select id="reverseUser" class="input-field">
                            ${users.map(u => `<option value="${u.id}">${esc(u.name)}</option>`).join("")}
                        </select>
                    </label>
                </div>

                <div class="reverse-actions">
                    <button id="reversePreviewBtn" class="btn-save" type="button">下書き作成</button>
                    <button id="reverseApplyBtn" class="btn-save reverse-apply" type="button">予定へ反映</button>
                </div>

                <div id="reversePreview" class="reverse-preview">
                    <div class="reverse-empty">テンプレートと基準日を選んで下書き作成してください。</div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById("reverseCloseBtn").addEventListener("click", closeModal);
        document.getElementById("reversePreviewBtn").addEventListener("click", preview);
        document.getElementById("reverseApplyBtn").addEventListener("click", apply);

        modal.addEventListener("click", e => {
            if (e.target === modal) closeModal();
        });
    }

    function openModal() {
        ensureModal();
        const dateInput = document.getElementById("reverseBaseDate");
        if (dateInput && !dateInput.value) {
            dateInput.value = fDate(new Date());
        }
        document.getElementById("reverseSchedulerModal").classList.add("active");
    }

    function closeModal() {
        const modal = document.getElementById("reverseSchedulerModal");
        if (modal) modal.classList.remove("active");
    }

    function buildDrafts() {
        const templateKey = document.getElementById("reverseTemplate").value;
        const project = document.getElementById("reverseProjectName").value.trim() || "未設定案件";
        const baseDate = document.getElementById("reverseBaseDate").value;
        const user = document.getElementById("reverseUser").value;

        if (!baseDate) {
            alert("基準日を選んでください。");
            return [];
        }

        const template = templates[templateKey];

        return template.rows.map(row => ({
            date: addDays(baseDate, row.offset),
            channel: template.channel,
            user,
            text: `[${row.phase}] ${project} / ${row.text}`,
            offset: row.offset,
            phase: row.phase
        })).sort((a, b) => a.date.localeCompare(b.date));
    }

    function preview() {
        const drafts = buildDrafts();
        localStorage.setItem("hdReverseSchedulerLastDrafts", JSON.stringify(drafts));

        const box = document.getElementById("reversePreview");
        if (!drafts.length) {
            box.innerHTML = `<div class="reverse-empty">下書きがありません。</div>`;
            return;
        }

        box.innerHTML = `
            <table class="reverse-table">
                <thead>
                    <tr>
                        <th>反映</th>
                        <th>日付</th>
                        <th>区分</th>
                        <th>予定</th>
                    </tr>
                </thead>
                <tbody>
                    ${drafts.map((d, i) => `
                        <tr>
                            <td><input type="checkbox" class="reverse-check" data-index="${i}" checked></td>
                            <td>${esc(d.date)}</td>
                            <td><span class="reverse-phase phase-${esc(d.phase)}">${esc(d.phase)}</span></td>
                            <td>${esc(d.text)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;
    }

    function apply() {
        const drafts = readJson("hdReverseSchedulerLastDrafts", []);
        if (!drafts.length) {
            alert("先に下書き作成してください。");
            return;
        }

        const checked = Array.from(document.querySelectorAll(".reverse-check"))
            .filter(x => x.checked)
            .map(x => Number(x.dataset.index));

        const selected = drafts.filter((_, index) => checked.includes(index));

        if (!selected.length) {
            alert("反映する予定を選んでください。");
            return;
        }

        const events = readJson(EVENT_KEY, {});

        selected.forEach(d => {
            if (!events[d.date]) events[d.date] = [];
            events[d.date].push({
                id: uuid(),
                channel: d.channel,
                user: d.user,
                text: d.text
            });
        });

        writeJson(EVENT_KEY, events);
        alert(`${selected.length}件を予定へ反映しました。ブラウザをF5してください。`);
    }

    document.addEventListener("DOMContentLoaded", () => {
        createButton();
        ensureModal();
    });
})();