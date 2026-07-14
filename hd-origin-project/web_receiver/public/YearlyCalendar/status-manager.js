(() => {
    if (window.__hdStatusManagerInstalled) return;
    window.__hdStatusManagerInstalled = true;

    const EVENT_KEY = "teamEventsMulti";
    const STATUS_KEY = "hdEventStatusMap";
    const USER_KEY = "teamCalendarUsers";

    const statuses = {
        todo: "未着手",
        doing: "進行中",
        waiting: "確認待ち",
        done: "完了",
        hold: "保留",
        late: "遅延"
    };

    const statusOrder = ["todo", "doing", "waiting", "done", "hold", "late"];

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

    function getEvents() {
        return readJson(EVENT_KEY, {});
    }

    function getStatusMap() {
        return readJson(STATUS_KEY, {});
    }

    function saveStatusMap(map) {
        writeJson(STATUS_KEY, map);
    }

    function getUsers() {
        const users = readJson(USER_KEY, []);
        if (Array.isArray(users) && users.length) return users;
        return [
            { id: "sakaguchi", name: "坂口" },
            { id: "kawatani", name: "川谷" },
            { id: "takayama", name: "高山" }
        ];
    }

    function userName(id) {
        const found = getUsers().find(x => x.id === id);
        return found ? found.name : id;
    }

    function esc(v) {
        return String(v ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function todayKey() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    function eventKey(date, ev) {
        return ev.id || `${date}|${ev.channel}|${ev.user}|${ev.text}`;
    }

    function flatEvents() {
        const events = getEvents();
        const statusMap = getStatusMap();

        return Object.keys(events).sort().flatMap(date => {
            return (events[date] || []).map(ev => {
                const key = eventKey(date, ev);
                return {
                    key,
                    date,
                    status: statusMap[key] || "todo",
                    ...ev
                };
            });
        });
    }

    function createButton() {
        if (document.getElementById("statusManagerBtn")) return;

        const btn = document.createElement("button");
        btn.id = "statusManagerBtn";
        btn.className = "status-manager-btn";
        btn.type = "button";
        btn.textContent = "✅ 進捗管理";

        const sidebar = document.querySelector(".sidebar");
        const before = document.getElementById("reverseSchedulerBtn") ||
            document.getElementById("executiveCockpitBtn") ||
            document.getElementById("aiGenerateBtn");

        if (sidebar && before) sidebar.insertBefore(btn, before);
        else if (sidebar) sidebar.appendChild(btn);
        else document.body.appendChild(btn);

        btn.addEventListener("click", openModal);
    }

    function ensureModal() {
        if (document.getElementById("statusManagerModal")) return;

        const modal = document.createElement("div");
        modal.id = "statusManagerModal";
        modal.className = "modal-overlay status-manager-modal";
        modal.innerHTML = `
            <div class="status-box">
                <div class="status-header">
                    <div>
                        <h2>✅ 進捗管理</h2>
                        <p>予定を未着手・進行中・確認待ち・完了・保留・遅延に分けて管理します。</p>
                    </div>
                    <button id="statusCloseBtn" class="status-close" type="button">✖</button>
                </div>

                <div class="status-toolbar">
                    <input id="statusSearchInput" class="input-field" placeholder="検索：請求、納期、坂口、東京など">
                    <select id="statusFilterSelect" class="input-field">
                        <option value="all">全ステータス</option>
                        ${statusOrder.map(k => `<option value="${k}">${statuses[k]}</option>`).join("")}
                    </select>
                    <button id="statusRefreshBtn" class="btn-save" type="button">更新</button>
                </div>

                <div id="statusSummary" class="status-summary"></div>
                <div id="statusList" class="status-list"></div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById("statusCloseBtn").addEventListener("click", closeModal);
        document.getElementById("statusRefreshBtn").addEventListener("click", render);
        document.getElementById("statusSearchInput").addEventListener("input", render);
        document.getElementById("statusFilterSelect").addEventListener("change", render);

        modal.addEventListener("click", e => {
            if (e.target === modal) closeModal();
        });
    }

    function openModal() {
        ensureModal();
        render();
        document.getElementById("statusManagerModal").classList.add("active");
    }

    function closeModal() {
        const modal = document.getElementById("statusManagerModal");
        if (modal) modal.classList.remove("active");
    }

    function render() {
        const list = flatEvents();
        const q = (document.getElementById("statusSearchInput")?.value || "").trim().toLowerCase();
        const filter = document.getElementById("statusFilterSelect")?.value || "all";

        const today = todayKey();

        let visible = list.filter(item => {
            if (filter !== "all" && item.status !== filter) return false;

            if (!q) return true;

            const hay = [
                item.date,
                item.text,
                item.channel,
                item.user,
                userName(item.user),
                statuses[item.status]
            ].join(" ").toLowerCase();

            return hay.includes(q);
        });

        visible = visible.slice(0, 300);

        const counts = {};
        statusOrder.forEach(k => counts[k] = 0);
        list.forEach(item => counts[item.status] = (counts[item.status] || 0) + 1);

        const overdue = list.filter(item => {
            return item.date < today && item.status !== "done";
        }).length;

        document.getElementById("statusSummary").innerHTML = `
            ${statusOrder.map(k => `<div class="status-kpi status-${k}"><b>${counts[k] || 0}</b><span>${statuses[k]}</span></div>`).join("")}
            <div class="status-kpi overdue"><b>${overdue}</b><span>期限超過候補</span></div>
        `;

        document.getElementById("statusList").innerHTML = visible.length
            ? visible.map(renderItem).join("")
            : `<div class="status-empty">該当する予定はありません。</div>`;

        document.querySelectorAll(".status-select").forEach(select => {
            select.addEventListener("change", e => {
                const key = e.target.dataset.key;
                const map = getStatusMap();
                map[key] = e.target.value;
                saveStatusMap(map);
                render();
                markCalendar();
            });
        });
    }

    function renderItem(item) {
        const isPast = item.date < todayKey() && item.status !== "done";
        return `
            <div class="status-card status-${item.status} ${isPast ? "is-past" : ""}">
                <div class="status-date">${esc(item.date)}</div>
                <div class="status-main">
                    <b>${esc(item.text)}</b>
                    <small>${esc(item.channel)} / ${esc(userName(item.user))}</small>
                </div>
                <select class="status-select input-field" data-key="${esc(item.key)}">
                    ${statusOrder.map(k => `<option value="${k}" ${item.status === k ? "selected" : ""}>${statuses[k]}</option>`).join("")}
                </select>
            </div>
        `;
    }

    function clearCalendarMarks() {
        document.querySelectorAll(".status-cell-done,.status-cell-late,.status-cell-waiting,.status-cell-doing")
            .forEach(el => el.classList.remove("status-cell-done", "status-cell-late", "status-cell-waiting", "status-cell-doing"));

        document.querySelectorAll(".status-mini-badge").forEach(el => el.remove());
    }

    function markCalendar() {
        clearCalendarMarks();

        const events = getEvents();
        const statusMap = getStatusMap();

        Object.keys(events).forEach(date => {
            const items = events[date] || [];
            if (!items.length) return;

            const dayStatuses = items.map(ev => {
                return statusMap[eventKey(date, ev)] || "todo";
            });

            const cells = document.querySelectorAll(`[data-date="${date}"]`);
            cells.forEach(cell => {
                if (dayStatuses.includes("late")) cell.classList.add("status-cell-late");
                else if (dayStatuses.includes("waiting")) cell.classList.add("status-cell-waiting");
                else if (dayStatuses.includes("doing")) cell.classList.add("status-cell-doing");
                else if (dayStatuses.length && dayStatuses.every(x => x === "done")) cell.classList.add("status-cell-done");

                const notDone = dayStatuses.filter(x => x !== "done").length;
                if (notDone > 0) {
                    const badge = document.createElement("div");
                    badge.className = "status-mini-badge";
                    badge.textContent = `未${notDone}`;
                    const target = cell.querySelector(".cell-inner") || cell;
                    target.appendChild(badge);
                }
            });
        });

        const btn = document.getElementById("statusManagerBtn");
        if (btn) {
            const all = flatEvents();
            const notDone = all.filter(x => x.status !== "done").length;
            btn.textContent = notDone ? `✅ 進捗管理 未${notDone}` : "✅ 進捗管理";
        }
    }

    let timer = null;
    function scheduleMark() {
        clearTimeout(timer);
        timer = setTimeout(markCalendar, 200);
    }

    document.addEventListener("DOMContentLoaded", () => {
        createButton();
        ensureModal();
        scheduleMark();

        const target = document.getElementById("calendarGrid") || document.body;
        new MutationObserver(scheduleMark).observe(target, {
            childList: true,
            subtree: true
        });
    });
})();