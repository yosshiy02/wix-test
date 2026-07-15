if(window.MobileDragDrop) { MobileDragDrop.polyfill({ holdToDrag: 300 }); }

document.addEventListener("DOMContentLoaded", () => {
    const mainArea = document.getElementById("calendarGrid");
    const dateDisplay = document.getElementById("dateDisplay");
    const viewBtns = document.querySelectorAll(".tab-btn");
    const trashZone = document.getElementById("trashZone");
    const contextMenu = document.getElementById("contextMenu");
    const modal = document.getElementById("memoModal");
    const settingsModal = document.getElementById("settingsModal");

        // HD_USER_SETTINGS_MAX10_V1
    // 担当者を最大10人まで設定可能にする
    const chNames = { general: '全般', accounting: '会計', sales: '商談', event: '出店', manufacture: '製造' };

    const defaultCalendarUsers = [
        { id: 'sakaguchi', name: '坂口', color: '#3b82f6', enabled: true },
        { id: 'kawatani', name: '川谷', color: '#10b981', enabled: true },
        { id: 'takayama', name: '高山', color: '#f59e0b', enabled: true },
        { id: 'user04', name: '担当4', color: '#ec4899', enabled: false },
        { id: 'user05', name: '担当5', color: '#8b5cf6', enabled: false },
        { id: 'user06', name: '担当6', color: '#14b8a6', enabled: false },
        { id: 'user07', name: '担当7', color: '#f97316', enabled: false },
        { id: 'user08', name: '担当8', color: '#64748b', enabled: false },
        { id: 'user09', name: '担当9', color: '#ef4444', enabled: false },
        { id: 'user10', name: '担当10', color: '#0ea5e9', enabled: false }
    ];

    function loadCalendarUsers() {
        let savedUsers = null;

        try {
            savedUsers = JSON.parse(localStorage.getItem("teamCalendarUsers") || "null");
        } catch(e) {
            savedUsers = null;
        }

        if(!Array.isArray(savedUsers)) {
            savedUsers = [];
        }

        const savedMap = {};
        savedUsers.forEach(user => {
            if(user && user.id) {
                savedMap[user.id] = user;
            }
        });

        return defaultCalendarUsers.map(defaultUser => {
            const saved = savedMap[defaultUser.id] || {};
            return {
                id: defaultUser.id,
                name: String(saved.name || defaultUser.name).trim() || defaultUser.name,
                color: /^#[0-9a-fA-F]{6}$/.test(saved.color || "") ? saved.color : defaultUser.color,
                enabled: saved.enabled === false ? false : true
            };
        }).slice(0, 10);
    }

    function saveCalendarUsers(users) {
        const safeUsers = users.slice(0, 10).map((user, index) => {
            const fallback = defaultCalendarUsers[index] || defaultCalendarUsers[0];
            return {
                id: fallback.id,
                name: String(user.name || fallback.name).trim() || fallback.name,
                color: /^#[0-9a-fA-F]{6}$/.test(user.color || "") ? user.color : fallback.color,
                enabled: user.enabled === false ? false : true
            };
        });

        localStorage.setItem("teamCalendarUsers", JSON.stringify(safeUsers));
        appUsers = safeUsers;
    }

    let appUsers = loadCalendarUsers();

    // HD_USER_SETTINGS_HIDE_PLACEHOLDER_USERS_V1
    // 初期の担当4〜10は通常画面へ出さない
    if(!localStorage.getItem("hdUserPlaceholderHiddenV1")) {
        appUsers = appUsers.map(user => {
            if(/^(user0[4-9]|user10)$/.test(user.id) && /^担当\d+$/.test(user.name)) {
                return { ...user, enabled: false };
            }
            return user;
        });
        localStorage.setItem("teamCalendarUsers", JSON.stringify(appUsers));
        localStorage.setItem("hdUserPlaceholderHiddenV1", "1");
    }

    const filters = {
        channels: { general: true, accounting: true, sales: true, event: true, manufacture: true },
        users: {}
    };

    appUsers.forEach(user => {
        filters.users[user.id] = user.enabled !== false;
    });

    const uNames = new Proxy({}, {
        get(target, prop) {
            const found = appUsers.find(user => user.id === prop);
            return found ? found.name : String(prop);
        }
    });

    function getCalendarUserList() {
        return appUsers.slice(0, 10);
    }

    function applyCalendarUserCss() {
        let style = document.getElementById("calendarUserColorStyle");

        if(!style) {
            style = document.createElement("style");
            style.id = "calendarUserColorStyle";
            document.head.appendChild(style);
        }

        style.textContent = appUsers.map(user => `
            .bg-${user.id} { background-color: ${user.color} !important; }
            .eb-${user.id} { border-left-color: ${user.color} !important; }
            .tl-event.eb-${user.id} { border-left-color: ${user.color} !important; }
        `).join("\n");
    }

    function renderUserFilters() {
        const container = document.getElementById("userFilters");
        if(!container) return;

        container.innerHTML = "";

        appUsers
            .filter(user => user.enabled !== false)
            .forEach(user => {
                if(typeof filters.users[user.id] !== "boolean") {
                    filters.users[user.id] = true;
                }

                const button = document.createElement("button");
                button.className = "filter-btn" + (filters.users[user.id] ? " active" : "");
                button.dataset.type = "user";
                button.dataset.val = user.id;
                button.innerHTML = `<span class="dot bg-${user.id}"></span>${user.name}`;

                button.addEventListener("click", () => {
                    filters.users[user.id] = !filters.users[user.id];
                    button.classList.toggle("active", filters.users[user.id]);
                    render();
                });

                container.appendChild(button);
            });
    }

    function updateModalUserOptions() {
        const select = document.getElementById("modalAddUser");
        if(!select) return;

        const visibleUsers = appUsers.filter(user => user.enabled !== false);

        select.innerHTML = visibleUsers.map(user => {
            return `<option value="${user.id}">● ${user.name}</option>`;
        }).join("");
    }

    function ensureUserSettingsPanel() {
        if(document.getElementById("calendarUserSettingsPanel")) return;

        const modalBox = settingsModal ? settingsModal.querySelector(".modal-box") : null;
        if(!modalBox) return;

        const saveButton = document.getElementById("saveSettings");
        const footer = saveButton ? saveButton.closest(".modal-footer") : null;

        const panel = document.createElement("div");
        panel.id = "calendarUserSettingsPanel";
        panel.className = "calendar-user-settings-panel compact";
        panel.innerHTML = `
            <h4 style="font-size:0.9rem; color:var(--primary); margin-bottom:6px;">👤 担当者設定</h4>
            <p id="calendarUserSettingsSummary" style="font-size:0.75rem; color:var(--text-sub); margin-bottom:10px;"></p>
            <button type="button" id="openCalendarUserManagerBtn" class="btn-save" style="width:100%; background:#2563eb;">
                担当者管理を開く
            </button>
        `;

        if(footer) {
            modalBox.insertBefore(panel, footer);
        } else {
            modalBox.appendChild(panel);
        }

        document.getElementById("openCalendarUserManagerBtn").addEventListener("click", openCalendarUserManagerModal);
    }

    function loadUsersIntoSettingsPanel() {
        ensureUserSettingsPanel();

        const summary = document.getElementById("calendarUserSettingsSummary");
        if(!summary) return;

        const visibleUsers = appUsers.filter(user => user.enabled !== false);
        summary.textContent = `表示中: ${visibleUsers.map(user => user.name).join(" / ") || "なし"}　※編集時だけ一覧を開きます`;
    }

    function saveUsersFromSettingsPanel() {
        // 通常の設定保存では担当者一覧を触らない。
        // 担当者は「担当者管理」モーダル内の保存ボタンで保存する。
    }

    function ensureCalendarUserManagerModal() {
        if(document.getElementById("calendarUserManagerModal")) return;

        const modal = document.createElement("div");
        modal.id = "calendarUserManagerModal";
        modal.className = "modal-overlay calendar-user-manager-modal";

        modal.innerHTML = `
            <div class="modal-box calendar-user-manager-box" style="max-width:720px;">
                <h3 class="modal-title">👤 担当者管理</h3>
                <p style="font-size:0.8rem; color:var(--text-sub); margin-bottom:12px;">
                    最大10人まで登録できます。表示ONの人だけ通常画面に出します。
                </p>
                <div id="calendarUserManagerRows" class="calendar-user-settings-rows"></div>
                <div class="modal-footer" style="margin-top:16px;">
                    <button type="button" id="closeCalendarUserManagerBtn" class="btn-cancel">閉じる</button>
                    <button type="button" id="saveCalendarUserManagerBtn" class="btn-save">担当者を保存</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById("closeCalendarUserManagerBtn").addEventListener("click", () => {
            modal.classList.remove("active");
        });

        document.getElementById("saveCalendarUserManagerBtn").addEventListener("click", saveCalendarUserManagerRows);

        modal.addEventListener("click", event => {
            if(event.target === modal) {
                modal.classList.remove("active");
            }
        });
    }

    function openCalendarUserManagerModal() {
        ensureCalendarUserManagerModal();

        const rows = document.getElementById("calendarUserManagerRows");
        rows.innerHTML = appUsers.map((user, index) => `
            <div class="calendar-user-setting-row" data-user-id="${user.id}">
                <div class="calendar-user-setting-no">${index + 1}</div>
                <input
                    type="text"
                    class="input-field calendar-user-name-input"
                    value="${user.name.replace(/"/g, "&quot;")}"
                    maxlength="20"
                    placeholder="担当者名"
                >
                <input
                    type="color"
                    class="calendar-user-color-input"
                    value="${user.color}"
                    title="色"
                >
                <label class="calendar-user-enabled-label">
                    <input
                        type="checkbox"
                        class="calendar-user-enabled-input"
                        ${user.enabled === false ? "" : "checked"}
                    >
                    表示
                </label>
            </div>
        `).join("");

        document.getElementById("calendarUserManagerModal").classList.add("active");
    }

    function saveCalendarUserManagerRows() {
        const rows = Array.from(document.querySelectorAll("#calendarUserManagerRows .calendar-user-setting-row"));

        const updatedUsers = rows.map((row, index) => {
            const fallback = defaultCalendarUsers[index];
            const nameInput = row.querySelector(".calendar-user-name-input");
            const colorInput = row.querySelector(".calendar-user-color-input");
            const enabledInput = row.querySelector(".calendar-user-enabled-input");

            return {
                id: fallback.id,
                name: nameInput ? nameInput.value : fallback.name,
                color: colorInput ? colorInput.value : fallback.color,
                enabled: enabledInput ? enabledInput.checked : true
            };
        });

        saveCalendarUsers(updatedUsers);

        appUsers.forEach(user => {
            filters.users[user.id] = user.enabled !== false;
        });

        applyCalendarUserCss();
        renderUserFilters();
        updateModalUserOptions();
        loadUsersIntoSettingsPanel();
        render();

        document.getElementById("calendarUserManagerModal").classList.remove("active");
        showToast("担当者設定を保存しました");
    }

    let currentView = "year";
    let baseDate = new Date();
    let dragData = null;
    let ctxData = null;

    let isSelecting = false;
    let selectStartDk = null;
    let selectEndDk = null;
    let selectedDateArray = [];
    let historyStack = [];
    let holidays = {};
    let appSettings = {};

    // --- 設定の読み込み ---
    function loadSettings() {
        const localData = localStorage.getItem("teamCalendarSettings");
        if(localData) {
            appSettings = JSON.parse(localData);
        } else {
            appSettings = { companyRules: { salaryDay: 25, salaryRule: "before_holiday", closeDay: 20, payDay: "end_of_month", paymentTaskDaysBefore: 3 }, aiPrompt: "" };
        }
    }
    loadSettings();
    applyCalendarUserCss();
    renderUserFilters();
    updateModalUserOptions();

    // --- 祝日の読み込みと初回描画 ---
    fetch("https://holidays-jp.github.io/api/v1/date.json")
        .then(res => res.json())
        .then(data => { holidays = data; render(); })
        .catch(e => { console.log("祝日エラー"); render(); });

    // --- モード切替（上部ボタンに変更済み） ---
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            const target = e.currentTarget;
            target.classList.add('active');
            const val = target.dataset.val;

            if(val === 'all') {
                for(let k in filters.channels) filters.channels[k] = true;
            } else {
                for(let k in filters.channels) filters.channels[k] = false;
                filters.channels[val] = true;
            }
            render();
        });
    });

    function getEvents() { return JSON.parse(localStorage.getItem("teamEventsMulti") || "{}"); }
    function saveEvents(d, saveToHistory = true) {
        if(saveToHistory) {
            historyStack.push(localStorage.getItem("teamEventsMulti") || "{}");
            if(historyStack.length > 50) historyStack.shift();
            const undoBtn = document.getElementById("undoBtn");
            if(undoBtn) undoBtn.disabled = historyStack.length === 0;
        }
        localStorage.setItem("teamEventsMulti", JSON.stringify(d));
    }

    const undoBtn = document.getElementById("undoBtn");
    if(undoBtn) {
        undoBtn.addEventListener('click', () => {
            if(historyStack.length === 0) return;
            const prevState = historyStack.pop();
            localStorage.setItem("teamEventsMulti", prevState);
            undoBtn.disabled = historyStack.length === 0;
            render(); showToast("元に戻しました ↩️");
        });
    }

    function fDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
    function isToday(d) { const t = new Date(); return d.getDate()===t.getDate() && d.getMonth()===t.getMonth() && d.getFullYear()===t.getFullYear(); }
    function uuid() { return Math.random().toString(36).substr(2, 9); }

    // 会計だけが選択されているかを判定
    function isAccountingOnlyMode() {
        return filters.channels.accounting &&
            !filters.channels.general &&
            !filters.channels.sales &&
            !filters.channels.event &&
            !filters.channels.manufacture;
    }

    // 年間表示用の会計自動予定を計算
    function getAccountingAutoTodoMapForYear(year) {
        const rules = appSettings.companyRules || {};
        const numberOrDefault = (value, fallback) => {
            const numberValue = Number(value);
            return Number.isFinite(numberValue) ? numberValue : fallback;
        };

        const salaryDay = numberOrDefault(rules.salaryDay, 25);
        const closeDay = numberOrDefault(rules.closeDay, 20);
        const paymentTaskDaysBefore =
            numberOrDefault(rules.paymentTaskDaysBefore, 3);

        const map = {};

        const addTodo = (dateObject, type, label) => {
            const dateKey = fDate(dateObject);

            if(!map[dateKey]) {
                map[dateKey] = [];
            }

            map[dateKey].push({
                type,
                label
            });
        };

        for(let monthIndex = 0; monthIndex < 12; monthIndex++) {

            // 給料日
            let salaryDate = new Date(
                year,
                monthIndex,
                salaryDay
            );

            while(
                salaryDate.getDay() === 0 ||
                salaryDate.getDay() === 6 ||
                holidays[fDate(salaryDate)]
            ) {
                if(rules.salaryRule === "after_holiday") {
                    salaryDate.setDate(
                        salaryDate.getDate() + 1
                    );
                } else {
                    salaryDate.setDate(
                        salaryDate.getDate() - 1
                    );
                }
            }

            // 請求締め日
            const closeDate = new Date(
                year,
                monthIndex,
                closeDay
            );

            // 支払日と支払準備日
            let payDate = new Date(
                year,
                monthIndex + 1,
                0
            );

            if(rules.payDay === "next_end_of_month") {
                payDate = new Date(
                    year,
                    monthIndex + 2,
                    0
                );
            }

            let paymentTaskDate = new Date(payDate);

            paymentTaskDate.setDate(
                paymentTaskDate.getDate() -
                paymentTaskDaysBefore
            );

            while(
                paymentTaskDate.getDay() === 0 ||
                paymentTaskDate.getDay() === 6 ||
                holidays[fDate(paymentTaskDate)]
            ) {
                paymentTaskDate.setDate(
                    paymentTaskDate.getDate() - 1
                );
            }

            addTodo(
                salaryDate,
                "salary",
                "給与振込"
            );

            addTodo(
                closeDate,
                "close",
                "請求締め処理"
            );

            addTodo(
                paymentTaskDate,
                "payment",
                "支払業務・振込予約"
            );
        }

        return map;
    }

    function switchView(view, dObj = null) {
        if(dObj) baseDate = new Date(dObj);
        currentView = view;
        viewBtns.forEach(b => b.classList.toggle("active", b.dataset.view === view));
        render();
    }

    function render() {
        mainArea.innerHTML = "";
        mainArea.className = "view-container";

        const y = baseDate.getFullYear(); const m = baseDate.getMonth();
        if (currentView === "year") { dateDisplay.textContent = `${y}年`; renderYear(); }
        else if (currentView === "month") { dateDisplay.textContent = `${y}年 ${m+1}月`; renderGrid("month"); }
        else if (currentView === "week") {
            const s = new Date(baseDate); s.setDate(s.getDate() - s.getDay());
            const e = new Date(s); e.setDate(s.getDate() + 6);
            dateDisplay.textContent = `${s.getMonth()+1}/${s.getDate()} 〜 ${e.getMonth()+1}/${e.getDate()}`;
            renderGrid("week", s);
        }
        else if (currentView === "day") { dateDisplay.textContent = `${y}年 ${m+1}月 ${baseDate.getDate()}日`; renderDay(); }
    }

    // --- 年ビュー ---
    function renderYear() {
        mainArea.className = "year-grid";
        const y = baseDate.getFullYear(); const memos = getEvents();
        const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

        const accountingTodoMap = {};

        for (let m = 0; m < 12; m++) {
            const box = document.createElement("div"); box.className = "mini-month";
            box.innerHTML = `
                <h3 data-m="${m}">${m+1}月</h3>
                <button class="month-list-btn" onclick="window.openBigMonthList(${y}, ${m}, event)">📄 予定リストを表示</button>
            `;
            box.querySelector("h3").onclick = () => switchView("month", new Date(y, m, 1));

            let html = "<table class='mini-table'><tr>" + dayNames.map((d,i)=>`<th class="${i===0?'sun':i===6?'sat':''}">${d}</th>`).join('') + "</tr>";
            const fd = new Date(y, m, 1).getDay(); const days = new Date(y, m+1, 0).getDate();
            let d = 1;

            for(let i=0; i<6; i++) {
                html += "<tr>"; let hasData = false;
                for(let j=0; j<7; j++) {
                    if(i===0 && j<fd || d>days) { html += "<td></td>"; }
                    else {
                        const dt = new Date(y, m, d); const dk = fDate(dt);
                        let tdClass = ""; if(j===0) tdClass += " sun"; else if(j===6) tdClass += " sat";
                        if(holidays[dk]) tdClass += " holiday";

                        let contentHtml = isToday(dt) ? `<span class="today-num">${d}</span>` : d;
                        let dots = "";
                        let titleText = "";
                        let hasAccountingEvent = false;

                        if(memos[dk] && memos[dk].length > 0) {
                            const eventUserIds = new Set();
                            memos[dk].forEach(ev => {
                                if(filters.channels[ev.channel] && filters.users[ev.user]) {
                                    if(ev.channel === 'accounting') {
                                        hasAccountingEvent = true;
                                    }

                                    eventUserIds.add(ev.user);
                                    titleText += `[${chNames[ev.channel]}] ${uNames[ev.user]}: ${ev.text}\n`;
                                }
                            });

                            dots += Array.from(eventUserIds)
                                .slice(0, 10)
                                .map(userId => `<div class="dot bg-${userId}"></div>`)
                                .join("");
                        }

                        const autoTodos = accountingTodoMap[dk] || [];
                        let accountingClasses = "";

                        if(
                            isAccountingOnlyMode() &&
                            hasAccountingEvent
                        ) {
                            accountingClasses +=
                                " accounting-year-filled";
                        }

                        if(autoTodos.length > 0) {
                            accountingClasses +=
                                " accounting-year-auto " +
                                autoTodos
                                    .map(item => `accounting-${item.type}`)
                                    .join(" ");

                            const autoTitle = autoTodos
                                .map(item => `[会計自動] ${item.label}`)
                                .join("\n");

                            titleText +=
                                `${titleText ? "\n" : ""}${autoTitle}`;
                        }

                        html += `<td class="${tdClass}${accountingClasses}" data-date="${dk}" title="${titleText.trim()}"><div class="cell-inner">${contentHtml}<div class="mini-dots">${dots}</div></div></td>`;
                        d++; hasData = true;
                    }
                }
                html += "</tr>";
                if(!hasData) break;
            }
            box.innerHTML += html + "</table>";
            mainArea.appendChild(box);
        }
        setupRangeSelection();
    }

    // --- 月・週ビュー ---
    function renderGrid(mode, startD = null) {
        mainArea.className = "cal-grid" + (mode==="week" ? " week-mode" : "");
        const allEvents = getEvents();
        let s, e;
        if(mode==="month") {
            s = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1); s.setDate(s.getDate() - s.getDay());
            e = new Date(baseDate.getFullYear(), baseDate.getMonth()+1, 0); e.setDate(e.getDate() + (6 - e.getDay()));
        } else {
            s = new Date(startD); e = new Date(startD); e.setDate(e.getDate()+6);
        }

        ['日','月','火','水','木','金','土'].forEach((d,i) => {
            const h = document.createElement("div"); h.className = "cal-header";
            if(i===0) h.style.color="var(--c-danger)"; if(i===6) h.style.color="var(--primary)";
            h.textContent = d; mainArea.appendChild(h);
        });

        let c = new Date(s);
        while(c <= e) {
            const dk = fDate(c);
            const cell = document.createElement("div");
            cell.className = "cal-cell" + (isToday(c) ? " today" : "");
            if(mode==="month" && c.getMonth()!==baseDate.getMonth()) cell.classList.add("out-of-month");
            cell.dataset.date = dk;

            let dHtml = `<div class="date-row"><span class="date-num ${c.getDay()===0?'sun':c.getDay()===6?'sat':''}">${c.getDate()}</span></div>`;
            if(holidays[dk]) dHtml += `<div style="font-size:0.7rem; color:var(--c-danger); margin-bottom:2px;">${holidays[dk]}</div>`;
            cell.innerHTML = dHtml;

            const dayEvs = allEvents[dk] || [];
            dayEvs.forEach(ev => {
                if(!filters.channels[ev.channel] || !filters.users[ev.user]) return;

                const b = document.createElement("div");
                b.className = `event-badge eb-${ev.user}`;
                if(ev.text.includes('🚨')) b.classList.add('deadline-badge');

                b.draggable = true;
                b.innerHTML = `<span class="ch-badge ch-${ev.channel}">${chNames[ev.channel]}</span><span class="eb-text">${uNames[ev.user]}: ${ev.text}</span>`;

                b.ondragstart = (evn) => { evn.stopPropagation(); dragData = { id: ev.id, date: dk }; trashZone.classList.add("drag-active"); };
                b.ondragend = (evn) => { evn.stopPropagation(); trashZone.classList.remove("drag-active"); };
                b.onclick = (evn) => { evn.stopPropagation(); selectedDateArray = [dk]; openModal(); };
                b.oncontextmenu = (evn) => { evn.preventDefault(); evn.stopPropagation(); ctxData = { id: ev.id, date: dk }; showMenu(evn.clientX, evn.clientY); };

                cell.appendChild(b);
            });

            cell.ondragover = (ev) => { ev.preventDefault(); cell.classList.add("drag-over"); };
            cell.ondragleave = () => cell.classList.remove("drag-over");
            cell.ondrop = (ev) => {
                ev.preventDefault(); cell.classList.remove("drag-over");
                if(!dragData || dk === dragData.date) return;
                moveEvent(dragData.id, dragData.date, dk);
            };

            mainArea.appendChild(cell);
            c.setDate(c.getDate()+1);
        }

        // 🌟 会計モードの場合、自動でTODOバッジを配置
        const isAccountingOnly = filters.channels.accounting && !filters.channels.general && !filters.channels.sales && !filters.channels.event && !filters.channels.manufacture;
        if (isAccountingOnly) {
            // 会計ダミー自動表示は廃止
        }

        setupRangeSelection();
    }

    // --- 日ビュー ---
    function renderDay() {
        mainArea.className = "timeline-wrapper";
        const dk = fDate(baseDate);
        const allEvents = getEvents();
        const dayEvs = allEvents[dk] || [];

        let html = `<div class="time-col">`;
        for(let i=0; i<24; i++) html += `<div class="time-label">${i}:00</div>`;
        html += `</div>`;
        mainArea.innerHTML = html;

        const users = getCalendarUserList().filter(user => filters.users[user.id]).map(user => ({ id: user.id, n: user.name, c: user.id }));

        users.forEach(u => {
            const col = document.createElement("div"); col.className = "user-col";
            col.innerHTML = `<div class="user-header"><span class="dot bg-${u.id}" style="margin-right:6px;"></span>${u.n}</div>`;
            const grid = document.createElement("div"); grid.className = "timeline-grid";
            grid.dataset.date = dk;

            const uEvs = dayEvs.filter(e => e.user === u.id && filters.channels[e.channel] && filters.users[e.user]);

            uEvs.forEach(ev => {
                const b = document.createElement("div");
                b.className = `tl-event eb-${ev.user}`;
                if(ev.text.includes('🚨')) b.classList.add('deadline-badge');

                const match = ev.text.match(/(\d{1,2}):(\d{2})/);
                if(match) {
                    const h = parseInt(match[1]); const m = parseInt(match[2]);
                    b.style.top = `${h * 60 + m}px`;
                    b.style.height = "50px";
                } else {
                    b.style.position = "static"; b.style.margin = "4px";
                }

                b.innerHTML = `<span class="ch-badge ch-${ev.channel}">${chNames[ev.channel]}</span> <span class="tl-event-text">${ev.text}</span>`;
                b.onclick = (e) => { e.stopPropagation(); selectedDateArray = [dk]; openModal(); };
                b.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); ctxData = { id: ev.id, date: dk }; showMenu(e.clientX, e.clientY); };
                grid.appendChild(b);
            });

            col.appendChild(grid); mainArea.appendChild(col);
        });

        setupRangeSelection();
    }

    // --- 複数日選択 ---
    function setupRangeSelection() {
        mainArea.addEventListener('mousedown', (e) => {
            const cell = e.target.closest('.cal-cell, td[data-date], .timeline-grid');
            if(!cell || e.target.closest('.event-badge, .tl-event')) return;
            isSelecting = true; selectStartDk = cell.dataset.date; selectEndDk = cell.dataset.date; updateSelectionHighlight();
        });
        mainArea.addEventListener('mousemove', (e) => {
            if(!isSelecting) return;
            const cell = e.target.closest('.cal-cell, td[data-date], .timeline-grid');
            if(cell && cell.dataset.date && cell.dataset.date !== selectEndDk) { selectEndDk = cell.dataset.date; updateSelectionHighlight(); }
        });
        window.addEventListener('mouseup', () => {
            if(isSelecting) { isSelecting = false; if(selectedDateArray.length > 0) openModal(); }
        });
    }

    function updateSelectionHighlight() {
        document.querySelectorAll('.selection-highlight').forEach(c => c.classList.remove('selection-highlight'));
        if(!selectStartDk || !selectEndDk) return;
        const d1 = new Date(selectStartDk); const d2 = new Date(selectEndDk);
        const start = d1 <= d2 ? d1 : d2; const end = d1 <= d2 ? d2 : d1;
        selectedDateArray = [];
        let curr = new Date(start);
        while(curr <= end) {
            const dk = fDate(curr); selectedDateArray.push(dk);
            document.querySelectorAll(`[data-date="${dk}"]`).forEach(c => c.classList.add('selection-highlight'));
            curr.setDate(curr.getDate() + 1);
        }
    }

    // --- イベント操作 ---
    function moveEvent(id, fromD, toD) {
        const data = getEvents();
        if(!data[fromD]) return;
        const evIndex = data[fromD].findIndex(e => e.id === id);
        if(evIndex > -1) {
            const ev = data[fromD].splice(evIndex, 1)[0];
            if(data[fromD].length === 0) delete data[fromD];
            if(!data[toD]) data[toD] = [];
            data[toD].push(ev); saveEvents(data); render(); showToast("予定を移動しました");
        }
    }

    function removeEvent(id, dateKey) {
        const data = getEvents();
        if(data[dateKey]) {
            data[dateKey] = data[dateKey].filter(e => e.id !== id);
            if(data[dateKey].length === 0) delete data[dateKey];
            saveEvents(data); render();
        }
    }

    if(trashZone) {
        trashZone.ondragover = e => { e.preventDefault(); trashZone.classList.add("drag-over"); };
        trashZone.ondragleave = () => trashZone.classList.remove("drag-over");
        trashZone.ondrop = e => {
            e.preventDefault(); trashZone.classList.remove("drag-over", "drag-active");
            if(dragData) { removeEvent(dragData.id, dragData.date); dragData = null; showToast("削除しました"); }
        };
    }

    // --- 右クリックメニュー ---
    function showMenu(x, y) {
        contextMenu.classList.add("active");
        const rect = contextMenu.getBoundingClientRect();
        let posX = x; let posY = y;
        if (x + rect.width > window.innerWidth) posX = window.innerWidth - rect.width;
        if (y + rect.height > window.innerHeight) posY = window.innerHeight - rect.height;
        contextMenu.style.left = `${posX}px`; contextMenu.style.top = `${posY}px`;
    }

    document.onclick = (e) => { if(!e.target.closest(".context-menu")) contextMenu.classList.remove("active"); };

    document.getElementById("menuEdit").onclick = () => { contextMenu.classList.remove("active"); selectedDateArray = [ctxData.date]; openModal(); };
    document.getElementById("menuMoveTomorrow").onclick = () => {
        contextMenu.classList.remove("active");
        const t = new Date(ctxData.date); t.setDate(t.getDate()+1);
        moveEvent(ctxData.id, ctxData.date, fDate(t));
    };
    document.getElementById("menuDelete").onclick = () => { contextMenu.classList.remove("active"); removeEvent(ctxData.id, ctxData.date); showToast("削除しました");};

    // --- 📝予定入力モーダル ---
    const listEl = document.getElementById("modalEventList");
    function openModal() {
        if(selectedDateArray.length === 0) return;
        const isMulti = selectedDateArray.length > 1;
        const firstDate = selectedDateArray[0]; const lastDate = selectedDateArray[selectedDateArray.length - 1];

        document.getElementById("modalDateTitle").textContent = isMulti ? `${firstDate.replace(/-/g,'/')} 〜 ${lastDate.replace(/-/g,'/')}` : firstDate.replace(/-/g, '/');
        listEl.innerHTML = "";

        if(!isMulti) {
            const dayEvs = getEvents()[firstDate] || [];
            if(dayEvs.length === 0) {
                listEl.innerHTML = `<p style="font-size:0.85rem; color:var(--text-sub); text-align:center;">予定はありません</p>`;
            } else {
                dayEvs.forEach(ev => {
                    const item = document.createElement("div"); item.className = "modal-event-item";
                    item.innerHTML = `<div><span class="ch-badge ch-${ev.channel}">${chNames[ev.channel]}</span> <strong>${uNames[ev.user]}</strong>: ${ev.text}</div><button class="delete-btn-small" data-id="${ev.id}">✖</button>`;
                    item.querySelector('button').onclick = () => { removeEvent(ev.id, firstDate); openModal(); showToast("削除しました");};
                    listEl.appendChild(item);
                });
            }
        } else {
            listEl.innerHTML = `<p style="font-size:0.85rem; color:var(--primary); text-align:center; font-weight:bold;">${selectedDateArray.length}日間に一括で予定を追加します</p>`;
        }
        document.getElementById("modalAddText").value = ""; modal.classList.add("active");
    }

    document.getElementById("closeModal").onclick = () => {
        modal.classList.remove("active");
        document.querySelectorAll('.selection-highlight').forEach(c => c.classList.remove('selection-highlight'));
        selectedDateArray = [];
    };

    document.getElementById("modalAddBtn").onclick = () => {
        const text = document.getElementById("modalAddText").value.trim(); if(!text) return;
        const channel = document.getElementById("modalAddChannel").value; const user = document.getElementById("modalAddUser").value;
        const data = getEvents();
        selectedDateArray.forEach(dk => { if(!data[dk]) data[dk] = []; data[dk].push({ id: uuid(), channel, user, text }); });
        saveEvents(data); modal.classList.remove("active"); selectedDateArray = []; render(); showToast("予定を追加しました");
    };

    function showToast(message) {
        const toast = document.createElement('div'); toast.className = `toast`; toast.innerHTML = `✨ ${message}`; document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10); setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 3000);
    }

    // UIアクション
    viewBtns.forEach(b => b.onclick = e => switchView(e.target.dataset.view));
    document.getElementById("prevBtn").onclick = () => {
        if(currentView==="year") baseDate.setFullYear(baseDate.getFullYear()-1);
        else if(currentView==="month") baseDate.setMonth(baseDate.getMonth()-1);
        else if(currentView==="week") baseDate.setDate(baseDate.getDate()-7);
        else if(currentView==="day") baseDate.setDate(baseDate.getDate()-1);
        render();
    };
    document.getElementById("nextBtn").onclick = () => {
        if(currentView==="year") baseDate.setFullYear(baseDate.getFullYear()+1);
        else if(currentView==="month") baseDate.setMonth(baseDate.getMonth()+1);
        else if(currentView==="week") baseDate.setDate(baseDate.getDate()+7);
        else if(currentView==="day") baseDate.setDate(baseDate.getDate()+1);
        render();
    };
    document.getElementById("todayBtn").onclick = () => { baseDate=new Date(); render(); };

    // ⚙️設定モーダルと会計モードの自動算出
    const settingsBtn = document.getElementById('settingsBtn');
    if(settingsBtn && settingsModal) {
        settingsBtn.addEventListener('click', () => {
            document.getElementById('setSalaryDay').value = appSettings.companyRules.salaryDay;
            document.getElementById('setSalaryRule').value = appSettings.companyRules.salaryRule;
            document.getElementById('setCloseDay').value = appSettings.companyRules.closeDay;
            document.getElementById('setPayDay').value = appSettings.companyRules.payDay;
            document.getElementById('setPaymentTaskDaysBefore').value = appSettings.companyRules.paymentTaskDaysBefore;
            document.getElementById('setAiPrompt').value = appSettings.aiPrompt;
            ensureUserSettingsPanel();
            loadUsersIntoSettingsPanel();
            settingsModal.classList.add('active');
        });
        document.getElementById('closeSettings').addEventListener('click', () => settingsModal.classList.remove('active'));
        document.getElementById('saveSettings').addEventListener('click', () => {
            appSettings.companyRules.salaryDay = parseInt(document.getElementById('setSalaryDay').value);
            appSettings.companyRules.salaryRule = document.getElementById('setSalaryRule').value;
            appSettings.companyRules.closeDay = parseInt(document.getElementById('setCloseDay').value);
            appSettings.companyRules.payDay = document.getElementById('setPayDay').value;
            appSettings.companyRules.paymentTaskDaysBefore = parseInt(document.getElementById('setPaymentTaskDaysBefore').value);
            appSettings.aiPrompt = document.getElementById('setAiPrompt').value;
            saveUsersFromSettingsPanel();
            localStorage.setItem("teamCalendarSettings", JSON.stringify(appSettings));
            settingsModal.classList.remove('active');
            render();
            showToast("設定を保存し、会社ルールと担当者設定を更新しました");
        });
    }

    function applyAccountingAutoTodo() {
        const rules = appSettings.companyRules;
        const y = baseDate.getFullYear(); const m = baseDate.getMonth();

        let salaryDate = new Date(y, m, rules.salaryDay);
        while(salaryDate.getDay() === 0 || salaryDate.getDay() === 6 || holidays[fDate(salaryDate)]) {
            if(rules.salaryRule === "before_holiday") salaryDate.setDate(salaryDate.getDate() - 1);
            else salaryDate.setDate(salaryDate.getDate() + 1);
        }

        let payDate = new Date(y, m + 1, 0);
        if(rules.payDay === "next_end_of_month") payDate = new Date(y, m + 2, 0);
        let paymentTaskDate = new Date(payDate);
        paymentTaskDate.setDate(payDate.getDate() - rules.paymentTaskDaysBefore);
        while(paymentTaskDate.getDay() === 0 || paymentTaskDate.getDay() === 6 || holidays[fDate(paymentTaskDate)]) {
            paymentTaskDate.setDate(paymentTaskDate.getDate() - 1);
        }

        const sDk = fDate(salaryDate); const pDk = fDate(paymentTaskDate); const closeDk = fDate(new Date(y, m, rules.closeDay));

        const salaryCell = document.querySelector(`.cal-cell[data-date="${sDk}"]`);
        if(salaryCell && !salaryCell.querySelector('.salary-todo')) {
            const b = document.createElement("div"); b.className = "event-badge auto-todo-badge salary-todo"; b.innerHTML = `💸 10:00 給与振込 [自動算出]`;
            salaryCell.appendChild(b);
        }
        const closeCell = document.querySelector(`.cal-cell[data-date="${closeDk}"]`);
        if(closeCell && !closeCell.querySelector('.close-todo')) {
            const b = document.createElement("div"); b.className = "event-badge auto-todo-badge close-todo"; b.innerHTML = `⚠️ 15:00 請求締め処理 [期日]`;
            closeCell.appendChild(b); closeCell.classList.add('alert-cell');
        }
        const taskCell = document.querySelector(`.cal-cell[data-date="${pDk}"]`);
        if(taskCell && !taskCell.querySelector('.task-todo')) {
            const b = document.createElement("div"); b.className = "event-badge auto-todo-badge task-todo"; b.innerHTML = `✅ 支払業務・振込予約 (${rules.paymentTaskDaysBefore}日前)`;
            taskCell.appendChild(b);
        }
    }

    // 🤖 AI提案モーダル処理
    const aiGenerateBtn = document.getElementById('aiGenerateBtn');
    const aiSuggestModal = document.getElementById('aiSuggestModal');
    if(aiGenerateBtn && aiSuggestModal) {
        aiGenerateBtn.onclick = () => {
            aiSuggestModal.classList.add('active');
            const y = baseDate.getFullYear(); const m = baseDate.getMonth() + 1;
            document.getElementById('aiSuggestText').value = "AIにプロンプトを送信中...\n(曜日と祝日を解析しています)";

            setTimeout(() => {
                let salaryDay = 25; let d = new Date(y, m - 1, salaryDay);
                while(d.getDay() === 0 || d.getDay() === 6 || holidays[`${y}-${String(m).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`]) { d.setDate(d.getDate() - 1); }
                const finalSalaryDate = d.getDate();

                let firstMonday = 1; let md = new Date(y, m - 1, firstMonday);
                while(md.getDay() !== 1) { md.setDate(md.getDate() + 1); }
                const finalFirstMonday = md.getDate();

                const lastDay = new Date(y, m, 0).getDate();

                let promptText = `【SYSTEM: OpenAIへの指示プロンプト生成完了】\n現在の対象月: ${y}年${m}月\n条件: 25日が土日祝の場合は前倒し。第1月曜は全体会議。月末は月次決算。\n----------------------------------------\n\n`;
                promptText += `【AIからの回答（解析されたスケジュール）】\n`;
                promptText += `${m}/${finalFirstMonday} 10:00 全体ミーティング [general/sakaguchi]\n`;
                promptText += `${m}/${finalSalaryDate} 🚨期限: 給与振込・支払処理 [accounting/kawatani]\n`;
                promptText += `${m}/${lastDay} 15:00 月次決算締め処理 [accounting/kawatani]\n`;
                promptText += `${m}/15 13:00 第一工場 設備点検 [manufacture/takayama]\n`;

                document.getElementById('aiSuggestText').value = promptText;
            }, 800);
        };
        document.getElementById('closeAiSuggest').onclick = () => aiSuggestModal.classList.remove('active');
        document.getElementById('applyAiSuggest').onclick = () => {
            const lines = document.getElementById('aiSuggestText').value.split('\n');
            const data = getEvents(); const y = baseDate.getFullYear(); let added = 0;
            lines.forEach(line => {
                const match = line.match(/(\d{1,2})\/(\d{1,2})\s+(.*?)\s*\[([a-z]+)\/([a-z]+)\]/);
                if(match) {
                    const dk = `${y}-${String(match[1]).padStart(2, "0")}-${String(match[2]).padStart(2, "0")}`;
                    if(!data[dk]) data[dk] = [];
                    data[dk].push({ id: uuid(), channel: match[4], user: match[5], text: match[3].trim() });
                    added++;
                }
            });
            if(added > 0) { saveEvents(data); aiSuggestModal.classList.remove('active'); render(); showToast(`${added}件の予定を一括反映しました！`); }
        };
    }

    // 年ビュー用 大モーダル
    window.openBigMonthList = function(year, month, event) {
        event.stopPropagation();
        const modal = document.getElementById('bigMonthModal');
        if (!modal) return;
        const memos = getEvents();
        const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
        const keys = Object.keys(memos).filter(k => k.startsWith(prefix)).sort();
        let listHtml = ''; let hasEvent = false;

        keys.forEach(k => {
            const dayNum = parseInt(k.split('-')[2]);
            memos[k].forEach(ev => {
                if(!filters.channels[ev.channel] || !filters.users[ev.user]) return;
                hasEvent = true;
                listHtml += `<div class="big-event-card" style="border-left-color: var(--c-${ev.user})"><div class="big-event-date">${dayNum}日</div><div class="big-event-detail"><span class="ch-badge ch-${ev.channel}">${chNames[ev.channel]}</span> <strong>${uNames[ev.user]}</strong><br><span style="color: var(--text-main); font-weight: 500;">${ev.text}</span></div></div>`;
            });
        });

        if (!hasEvent) listHtml = '<p style="text-align:center; padding: 40px; color: #94a3b8;">表示する予定はありません。</p>';
        document.getElementById('bigMonthTitle').textContent = `📅 ${year}年 ${month + 1}月の予定一覧`;
        document.getElementById('bigMonthBody').innerHTML = listHtml;
        modal.classList.add('active');
        document.getElementById('closeBigMonth').onclick = () => modal.classList.remove('active');
        modal.onclick = (e) => { if(e.target === modal) modal.classList.remove('active'); };
    };
});

// HD_WORKFLOW_AI_BASE_V1_REMOVED
