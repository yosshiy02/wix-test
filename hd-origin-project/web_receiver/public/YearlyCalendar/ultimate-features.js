(() => {
    if (window.__hdUltimateFeaturesInstalled) return;
    window.__hdUltimateFeaturesInstalled = true;

    const EVENT_KEY = "teamEventsMulti";
    const USER_KEY = "teamCalendarUsers";
    const SETTINGS_KEY = "teamCalendarSettings";

    const channelNames = {
        general: "全般",
        accounting: "会計",
        sales: "商談",
        event: "出店",
        manufacture: "製造"
    };

    const defaultUsers = [
        { id: "sakaguchi", name: "坂口", color: "#3b82f6", enabled: true },
        { id: "kawatani", name: "川谷", color: "#10b981", enabled: true },
        { id: "takayama", name: "高山", color: "#f59e0b", enabled: true }
    ];

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

    function todayKey() {
        const d = new Date();
        return formatDate(d);
    }

    function formatDate(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    function uuid() {
        return "ult_" + Math.random().toString(36).slice(2, 10);
    }

    function getEvents() {
        return readJson(EVENT_KEY, {});
    }

    function saveEvents(events) {
        writeJson(EVENT_KEY, events);
    }

    function getUsers() {
        const saved = readJson(USER_KEY, null);
        if (Array.isArray(saved) && saved.length) {
            return saved;
        }
        return defaultUsers;
    }

    function getUserName(id) {
        const found = getUsers().find(u => u.id === id);
        return found ? found.name : id;
    }

    function getEventList() {
        const events = getEvents();
        return Object.keys(events)
            .sort()
            .flatMap(date => (events[date] || []).map(event => ({
                date,
                ...event
            })));
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function downloadText(filename, text) {
        const blob = new Blob([text], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    }

    function createButton() {
        if (document.getElementById("ultimateFeatureBtn")) return;

        const btn = document.createElement("button");
        btn.id = "ultimateFeatureBtn";
        btn.className = "ultimate-feature-btn";
        btn.type = "button";
        btn.textContent = "🚀 統合機能";

        const sidebar = document.querySelector(".sidebar");
        if (sidebar) {
            const settingsBtn = document.getElementById("aiGenerateBtn");
            if (settingsBtn) {
                sidebar.insertBefore(btn, settingsBtn);
            } else {
                sidebar.appendChild(btn);
            }
        } else {
            document.body.appendChild(btn);
        }

        btn.addEventListener("click", openModal);
    }

    function createModal() {
        if (document.getElementById("ultimateFeatureModal")) return;

        const modal = document.createElement("div");
        modal.id = "ultimateFeatureModal";
        modal.className = "modal-overlay ultimate-feature-modal";

        modal.innerHTML = `
            <div class="ultimate-box">
                <div class="ultimate-header">
                    <div>
                        <h2>🚀 統合機能センター</h2>
                        <p>検索・追加・バックアップ・整理・印刷をここに集約します。</p>
                    </div>
                    <button id="ultimateCloseBtn" class="ultimate-close-btn" type="button">✖</button>
                </div>

                <div class="ultimate-tabs">
                    <button class="ultimate-tab active" data-tab="dashboard">ダッシュボード</button>
                    <button class="ultimate-tab" data-tab="search">検索</button>
                    <!-- テンプレート機能削除 <button class="ultimate-tab" data-tab="quickadd">クイック追加</button> -->
                    <button class="ultimate-tab" data-tab="backup">保存/復元</button>
                    <button class="ultimate-tab" data-tab="tools">整理ツール</button>
                </div>

                <div class="ultimate-body">
                    <section id="ultimateTab-dashboard" class="ultimate-panel active"></section>
                    <section id="ultimateTab-search" class="ultimate-panel"></section>
                    <!-- <section id="ultimateTab-quickadd" class="ultimate-panel"></section> -->
                    <section id="ultimateTab-backup" class="ultimate-panel"></section>
                    <section id="ultimateTab-tools" class="ultimate-panel"></section>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById("ultimateCloseBtn").addEventListener("click", closeModal);
        modal.addEventListener("click", e => {
            if (e.target === modal) closeModal();
        });

        document.querySelectorAll(".ultimate-tab").forEach(btn => {
            btn.addEventListener("click", () => switchTab(btn.dataset.tab));
        });
    }

    function openModal() {
        createModal();
        renderAll();
        document.getElementById("ultimateFeatureModal").classList.add("active");
    }

    function closeModal() {
        const modal = document.getElementById("ultimateFeatureModal");
        if (modal) modal.classList.remove("active");
    }

    function switchTab(tab) {
        document.querySelectorAll(".ultimate-tab").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.tab === tab);
        });
        document.querySelectorAll(".ultimate-panel").forEach(panel => {
            panel.classList.toggle("active", panel.id === `ultimateTab-${tab}`);
        });
    }

    function renderAll() {
        renderDashboard();
        renderSearch();
        renderQuickAdd();
        renderBackup();
        renderTools();
    }

    function renderDashboard() {
        const panel = document.getElementById("ultimateTab-dashboard");
        const list = getEventList();
        const today = todayKey();
        const ym = today.slice(0, 7);

        const todayCount = list.filter(e => e.date === today).length;
        const monthCount = list.filter(e => e.date.startsWith(ym)).length;
        const deadlineCount = list.filter(e => /締切|期限|🚨|deadline|納期/.test(e.text || "")).length;
        const accountingCount = list.filter(e => e.channel === "accounting").length;
        const manufactureCount = list.filter(e => e.channel === "manufacture").length;
        const salesCount = list.filter(e => e.channel === "sales").length;

        const upcoming = list
            .filter(e => e.date >= today)
            .slice(0, 12);

        panel.innerHTML = `
            <div class="ultimate-kpi-grid">
                <div class="ultimate-kpi"><span>${todayCount}</span><small>今日の予定</small></div>
                <div class="ultimate-kpi"><span>${monthCount}</span><small>今月の予定</small></div>
                <div class="ultimate-kpi danger"><span>${deadlineCount}</span><small>期限系</small></div>
                <div class="ultimate-kpi"><span>${accountingCount}</span><small>会計</small></div>
                <div class="ultimate-kpi"><span>${manufactureCount}</span><small>製造</small></div>
                <div class="ultimate-kpi"><span>${salesCount}</span><small>商談</small></div>
            </div>

            <h3 class="ultimate-section-title">直近予定</h3>
            <div class="ultimate-list">
                ${upcoming.length ? upcoming.map(renderEventCard).join("") : `<div class="ultimate-empty">直近予定はありません。</div>`}
            </div>
        `;
    }

    function renderEventCard(e) {
        return `
            <div class="ultimate-card">
                <div class="ultimate-card-date">${escapeHtml(e.date)}</div>
                <div class="ultimate-card-main">
                    <strong>${escapeHtml(e.text)}</strong>
                    <small>${escapeHtml(channelNames[e.channel] || e.channel)} / ${escapeHtml(getUserName(e.user))}</small>
                </div>
            </div>
        `;
    }

    function renderSearch() {
        const panel = document.getElementById("ultimateTab-search");
        panel.innerHTML = `
            <div class="ultimate-search-row">
                <input id="ultimateSearchInput" class="input-field" placeholder="予定を検索。例：納期、請求、振込、川谷">
                <button id="ultimateSearchBtn" class="btn-save" type="button">検索</button>
            </div>
            <div id="ultimateSearchResult" class="ultimate-list"></div>
        `;

        const runSearch = () => {
            const q = document.getElementById("ultimateSearchInput").value.trim().toLowerCase();
            const result = document.getElementById("ultimateSearchResult");
            if (!q) {
                result.innerHTML = `<div class="ultimate-empty">検索語を入力してください。</div>`;
                return;
            }

            const matches = getEventList().filter(e => {
                const text = [
                    e.date,
                    e.text,
                    e.channel,
                    channelNames[e.channel],
                    e.user,
                    getUserName(e.user)
                ].join(" ").toLowerCase();

                return text.includes(q);
            });

            result.innerHTML = matches.length
                ? matches.slice(0, 200).map(renderEventCard).join("")
                : `<div class="ultimate-empty">該当なし</div>`;
        };

        document.getElementById("ultimateSearchBtn").addEventListener("click", runSearch);
        document.getElementById("ultimateSearchInput").addEventListener("keydown", e => {
            if (e.key === "Enter") runSearch();
        });
    }

    function renderQuickAdd() {
        const panel = document.getElementById("ultimateTab-quickadd");
        const users = getUsers().filter(u => u.enabled !== false);
        const today = todayKey();

        panel.innerHTML = `
            <div class="ultimate-form-grid">
                <label>日付<input id="ultimateAddDate" type="date" class="input-field" value="${today}"></label>
                <label>分類
                    <select id="ultimateAddChannel" class="input-field">
                        ${Object.keys(channelNames).map(k => `<option value="${k}">${channelNames[k]}</option>`).join("")}
                    </select>
                </label>
                <label>担当
                    <select id="ultimateAddUser" class="input-field">
                        ${users.map(u => `<option value="${u.id}">${escapeHtml(u.name)}</option>`).join("")}
                    </select>
                </label>
            </div>
            <label class="ultimate-full-label">予定内容
                <input id="ultimateAddText" class="input-field" placeholder="例：15:00 請求書送付 / 納期確認 / 出荷準備">
            </label>
            <div class="ultimate-action-row">
                <button id="ultimateAddBtn" class="btn-save" type="button">予定を追加</button>
            </div>
        `;

        document.getElementById("ultimateAddBtn").addEventListener("click", () => {
            const date = document.getElementById("ultimateAddDate").value;
            const channel = document.getElementById("ultimateAddChannel").value;
            const user = document.getElementById("ultimateAddUser").value;
            const text = document.getElementById("ultimateAddText").value.trim();

            if (!date || !text) {
                alert("日付と予定内容を入力してください。");
                return;
            }

            const events = getEvents();
            if (!events[date]) events[date] = [];
            events[date].push({ id: uuid(), channel, user, text });
            saveEvents(events);

            document.getElementById("ultimateAddText").value = "";
            alert("予定を追加しました。画面は手動F5で更新してください。");
            renderDashboard();
        });
    }

    function renderBackup() {
        const panel = document.getElementById("ultimateTab-backup");

        panel.innerHTML = `
            <div class="ultimate-action-row">
                <button id="ultimateExportEventsBtn" class="btn-save" type="button">予定JSONを書き出し</button>
                <button id="ultimateExportAllBtn" class="btn-save" type="button">全設定バックアップ</button>
            </div>

            <h3 class="ultimate-section-title">JSONインポート</h3>
            <textarea id="ultimateImportText" class="input-field ultimate-textarea" placeholder="ここに予定JSONを貼り付け"></textarea>
            <div class="ultimate-action-row">
                <button id="ultimateImportMergeBtn" class="btn-save" type="button">予定へ追加</button>
                <button id="ultimateImportReplaceBtn" class="btn-danger" type="button">予定を置換</button>
            </div>
        `;

        document.getElementById("ultimateExportEventsBtn").addEventListener("click", () => {
            downloadText(`calendar-events-${todayKey()}.json`, JSON.stringify(getEvents(), null, 2));
        });

        document.getElementById("ultimateExportAllBtn").addEventListener("click", () => {
            const all = {
                exportedAt: new Date().toISOString(),
                events: getEvents(),
                users: readJson(USER_KEY, []),
                settings: readJson(SETTINGS_KEY, {})
            };
            downloadText(`calendar-full-backup-${todayKey()}.json`, JSON.stringify(all, null, 2));
        });

        document.getElementById("ultimateImportMergeBtn").addEventListener("click", () => importEvents(false));
        document.getElementById("ultimateImportReplaceBtn").addEventListener("click", () => importEvents(true));
    }

    function importEvents(replace) {
        const raw = document.getElementById("ultimateImportText").value.trim();
        if (!raw) {
            alert("JSONを貼り付けてください。");
            return;
        }

        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch {
            alert("JSONとして読めません。");
            return;
        }

        const incoming = parsed.events && typeof parsed.events === "object"
            ? parsed.events
            : parsed;

        if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
            alert("予定JSONの形式ではありません。");
            return;
        }

        if (replace && !confirm("現在の予定を置換します。よろしいですか？")) {
            return;
        }

        const current = replace ? {} : getEvents();

        Object.keys(incoming).forEach(date => {
            if (!Array.isArray(incoming[date])) return;
            if (!current[date]) current[date] = [];
            current[date].push(...incoming[date]);
        });

        saveEvents(current);
        alert("インポートしました。画面は手動F5で更新してください。");
    }

    function renderTools() {
        const panel = document.getElementById("ultimateTab-tools");

        panel.innerHTML = `
            <div class="ultimate-tool-grid">
                <button id="ultimateDuplicateCheckBtn" class="ultimate-tool-btn" type="button">重複予定チェック</button>
                <button id="ultimatePrintBtn" class="ultimate-tool-btn" type="button">印刷</button>
                <button id="ultimateCopySummaryBtn" class="ultimate-tool-btn" type="button">予定サマリーコピー</button>
            </div>
            <div id="ultimateToolsResult" class="ultimate-list"></div>
        `;

        document.getElementById("ultimateDuplicateCheckBtn").addEventListener("click", checkDuplicates);
        document.getElementById("ultimatePrintBtn").addEventListener("click", () => window.print());
        document.getElementById("ultimateCopySummaryBtn").addEventListener("click", copySummary);
    }

    function checkDuplicates() {
        const result = document.getElementById("ultimateToolsResult");
        const list = getEventList();
        const map = new Map();

        list.forEach(e => {
            const key = `${e.date}|${e.channel}|${e.user}|${e.text}`;
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(e);
        });

        const duplicates = Array.from(map.values()).filter(items => items.length > 1);

        result.innerHTML = duplicates.length
            ? duplicates.map(group => `
                <div class="ultimate-card danger">
                    <strong>${escapeHtml(group[0].date)} / ${escapeHtml(group[0].text)}</strong>
                    <small>重複 ${group.length}件</small>
                </div>
            `).join("")
            : `<div class="ultimate-empty">重複予定は見つかりません。</div>`;
    }

    async function copySummary() {
        const list = getEventList();
        const today = todayKey();
        const upcoming = list.filter(e => e.date >= today).slice(0, 30);

        const text = upcoming.map(e => {
            return `${e.date} [${channelNames[e.channel] || e.channel}] ${getUserName(e.user)}: ${e.text}`;
        }).join("\n");

        try {
            await navigator.clipboard.writeText(text || "予定なし");
            alert("予定サマリーをコピーしました。");
        } catch {
            alert("コピーできませんでした。ブラウザの権限を確認してください。");
        }
    }

    document.addEventListener("keydown", e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            openModal();
        }
        if (e.key === "Escape") {
            closeModal();
        }
    });

    document.addEventListener("DOMContentLoaded", () => {
        createButton();
        createModal();
    });
})();
