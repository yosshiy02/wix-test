(() => {
    if (window.__hdUiControlPanelInstalled) return;
    window.__hdUiControlPanelInstalled = true;

    const EVENT_KEY = "teamEventsMulti";
    const UI_KEY = "hdCalendarUiSettings";

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

    function getUi() {
        return readJson(UI_KEY, {
            density: "normal",
            dark: false,
            sidebarCollapsed: false,
            bigText: false
        });
    }

    function saveUi(ui) {
        writeJson(UI_KEY, ui);
        applyUi();
    }

    function applyUi() {
        const ui = getUi();

        document.body.classList.toggle("ui-density-compact", ui.density === "compact");
        document.body.classList.toggle("ui-density-wide", ui.density === "wide");
        document.body.classList.toggle("ui-dark-mode", !!ui.dark);
        document.body.classList.toggle("ui-sidebar-collapsed", !!ui.sidebarCollapsed);
        document.body.classList.toggle("ui-big-text", !!ui.bigText);
    }

    function createButton() {
        if (document.getElementById("uiControlBtn")) return;

        const btn = document.createElement("button");
        btn.id = "uiControlBtn";
        btn.className = "ui-control-btn";
        btn.type = "button";
        btn.textContent = "🎛 UI操作";

        const sidebar = document.querySelector(".sidebar");
        const before = document.getElementById("statusManagerBtn") ||
            document.getElementById("reverseSchedulerBtn") ||
            document.getElementById("executiveCockpitBtn") ||
            document.getElementById("aiGenerateBtn");

        if (sidebar && before) sidebar.insertBefore(btn, before);
        else if (sidebar) sidebar.appendChild(btn);
        else document.body.appendChild(btn);

        btn.addEventListener("click", openPanel);
    }

    function ensurePanel() {
        if (document.getElementById("uiControlPanel")) return;

        const panel = document.createElement("div");
        panel.id = "uiControlPanel";
        panel.className = "ui-control-panel";

        panel.innerHTML = `
            <div class="ui-control-header">
                <b>🎛 UI操作</b>
                <button id="uiCloseBtn" type="button">✖</button>
            </div>

            <div class="ui-control-section">
                <div class="ui-control-label">表示密度</div>
                <div class="ui-segment">
                    <button data-density="compact">詰める</button>
                    <button data-density="normal">標準</button>
                    <button data-density="wide">広め</button>
                </div>
            </div>

            <div class="ui-control-section">
                <button id="uiDarkBtn" class="ui-action-btn" type="button">🌙 ダーク風表示</button>
                <button id="uiSidebarBtn" class="ui-action-btn" type="button">📌 サイドバー折りたたみ</button>
                <button id="uiBigTextBtn" class="ui-action-btn" type="button">🔎 文字を大きく</button>
                <button id="uiFullscreenBtn" class="ui-action-btn" type="button">⛶ フルスクリーン</button>
            </div>

            <div class="ui-control-section">
                <div class="ui-control-label">予定ミニ検索</div>
                <input id="uiMiniSearch" class="input-field" placeholder="例：納期、東京、請求">
                <div id="uiMiniSearchResult" class="ui-mini-result"></div>
            </div>

            <div class="ui-control-section">
                <div class="ui-control-label">ショートカット</div>
                <div class="ui-shortcuts">
                    <span>Ctrl + / ：UI操作</span>
                    <span>Esc ：閉じる</span>
                    <span>Ctrl + Shift + E ：経営者ビュー</span>
                    <span>Ctrl + Shift + K ：衝突管理</span>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        document.getElementById("uiCloseBtn").addEventListener("click", closePanel);

        panel.querySelectorAll("[data-density]").forEach(btn => {
            btn.addEventListener("click", () => {
                const ui = getUi();
                ui.density = btn.dataset.density;
                saveUi(ui);
                syncPanel();
            });
        });

        document.getElementById("uiDarkBtn").addEventListener("click", () => {
            const ui = getUi();
            ui.dark = !ui.dark;
            saveUi(ui);
            syncPanel();
        });

        document.getElementById("uiSidebarBtn").addEventListener("click", () => {
            const ui = getUi();
            ui.sidebarCollapsed = !ui.sidebarCollapsed;
            saveUi(ui);
            syncPanel();
        });

        document.getElementById("uiBigTextBtn").addEventListener("click", () => {
            const ui = getUi();
            ui.bigText = !ui.bigText;
            saveUi(ui);
            syncPanel();
        });

        document.getElementById("uiFullscreenBtn").addEventListener("click", async () => {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen().catch(() => {});
            } else {
                await document.exitFullscreen().catch(() => {});
            }
        });

        document.getElementById("uiMiniSearch").addEventListener("input", runMiniSearch);
    }

    function openPanel() {
        ensurePanel();
        syncPanel();
        document.getElementById("uiControlPanel").classList.add("active");
    }

    function closePanel() {
        const panel = document.getElementById("uiControlPanel");
        if (panel) panel.classList.remove("active");
    }

    function syncPanel() {
        const panel = document.getElementById("uiControlPanel");
        if (!panel) return;

        const ui = getUi();

        panel.querySelectorAll("[data-density]").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.density === ui.density);
        });

        document.getElementById("uiDarkBtn").classList.toggle("active", !!ui.dark);
        document.getElementById("uiSidebarBtn").classList.toggle("active", !!ui.sidebarCollapsed);
        document.getElementById("uiBigTextBtn").classList.toggle("active", !!ui.bigText);
    }

    function flatEvents() {
        const events = readJson(EVENT_KEY, {});
        return Object.keys(events).sort().flatMap(date => {
            return (events[date] || []).map(ev => ({
                date,
                ...ev
            }));
        });
    }

    function runMiniSearch() {
        const q = document.getElementById("uiMiniSearch").value.trim().toLowerCase();
        const result = document.getElementById("uiMiniSearchResult");

        if (!q) {
            result.innerHTML = "";
            return;
        }

        const items = flatEvents().filter(ev => {
            return [ev.date, ev.text, ev.channel, ev.user].join(" ").toLowerCase().includes(q);
        }).slice(0, 12);

        result.innerHTML = items.length
            ? items.map(ev => `
                <div class="ui-mini-card">
                    <b>${ev.date}</b>
                    <span>${ev.text || ""}</span>
                </div>
            `).join("")
            : `<div class="ui-mini-empty">該当なし</div>`;
    }

    document.addEventListener("DOMContentLoaded", () => {
        applyUi();
        createButton();
        ensurePanel();
    });

    document.addEventListener("keydown", e => {
        if ((e.ctrlKey || e.metaKey) && e.key === "/") {
            e.preventDefault();
            openPanel();
        }

        if (e.key === "Escape") {
            closePanel();
        }
    });
})();