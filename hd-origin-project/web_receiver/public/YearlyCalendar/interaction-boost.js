(() => {
    if (window.__hdInteractionBoostInstalled) return;
    window.__hdInteractionBoostInstalled = true;

    const EVENT_KEY = "teamEventsMulti";
    const CLIP_KEY = "hdCalendarCopiedEvents";

    let selectedDates = new Set();
    let anchorDate = null;

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
        return "int_" + Math.random().toString(36).slice(2, 10);
    }

    function parseDate(key) {
        return new Date(key + "T00:00:00");
    }

    function fDate(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    function getEvents() {
        return readJson(EVENT_KEY, {});
    }

    function saveEvents(events) {
        writeJson(EVENT_KEY, events);
    }

    function getDateCell(target) {
        return target.closest("[data-date]");
    }

    function clearSelection() {
        selectedDates.clear();
        anchorDate = null;
        document.querySelectorAll(".ib-selected-date").forEach(x => x.classList.remove("ib-selected-date"));
        updateHud();
    }

    function selectDate(date, additive = false) {
        if (!additive) selectedDates.clear();

        if (selectedDates.has(date) && additive) {
            selectedDates.delete(date);
        } else {
            selectedDates.add(date);
        }

        anchorDate = date;
        paintSelection();
    }

    function selectRange(from, to) {
        selectedDates.clear();

        const a = parseDate(from);
        const b = parseDate(to);
        const start = a <= b ? a : b;
        const end = a <= b ? b : a;

        const d = new Date(start);
        while (d <= end) {
            selectedDates.add(fDate(d));
            d.setDate(d.getDate() + 1);
        }

        paintSelection();
    }

    function paintSelection() {
        document.querySelectorAll(".ib-selected-date").forEach(x => x.classList.remove("ib-selected-date"));

        selectedDates.forEach(date => {
            document.querySelectorAll(`[data-date="${date}"]`).forEach(cell => {
                cell.classList.add("ib-selected-date");
            });
        });

        updateHud();
    }

    function createHud() {
        if (document.getElementById("interactionBoostHud")) return;

        const hud = document.createElement("div");
        hud.id = "interactionBoostHud";
        hud.className = "ib-hud";
        hud.innerHTML = `
            <div id="ibHudText">選択なし</div>
            <div class="ib-hud-actions">
                <button id="ibQuickAddBtn" type="button">追加</button>
                <button id="ibCopyBtn" type="button">コピー</button>
                <button id="ibPasteBtn" type="button">貼付</button>
                <button id="ibClearBtn" type="button">解除</button>
            </div>
        `;
        document.body.appendChild(hud);

        document.getElementById("ibQuickAddBtn").addEventListener("click", quickAddToSelected);
        document.getElementById("ibCopyBtn").addEventListener("click", copySelectedEvents);
        document.getElementById("ibPasteBtn").addEventListener("click", pasteToSelectedDates);
        document.getElementById("ibClearBtn").addEventListener("click", clearSelection);
    }

    function updateHud() {
        createHud();
        const hud = document.getElementById("interactionBoostHud");
        const text = document.getElementById("ibHudText");

        if (!selectedDates.size) {
            hud.classList.remove("active");
            text.textContent = "選択なし";
            return;
        }

        const dates = Array.from(selectedDates).sort();
        hud.classList.add("active");
        text.textContent = dates.length === 1
            ? `${dates[0]} を選択中`
            : `${dates[0]} 〜 ${dates[dates.length - 1]} / ${dates.length}日選択中`;
    }

    function quickAddToSelected() {
        if (!selectedDates.size) {
            alert("日付を選択してください。");
            return;
        }

        const text = prompt("選択した日に追加する予定を入力してください。", "10:00 新規予定");
        if (!text) return;

        const events = getEvents();
        Array.from(selectedDates).forEach(date => {
            events[date] = events[date] || [];
            events[date].push({
                id: uuid(),
                channel: "general",
                user: "sakaguchi",
                text
            });
        });

        saveEvents(events);
        alert("予定を追加しました。F5で更新してください。");
    }

    function copySelectedEvents() {
        if (!selectedDates.size) {
            alert("日付を選択してください。");
            return;
        }

        const events = getEvents();
        const copied = [];

        Array.from(selectedDates).sort().forEach(date => {
            (events[date] || []).forEach(ev => {
                copied.push({
                    sourceDate: date,
                    channel: ev.channel,
                    user: ev.user,
                    text: ev.text
                });
            });
        });

        writeJson(CLIP_KEY, copied);
        alert(`${copied.length}件コピーしました。`);
    }

    function pasteToSelectedDates() {
        if (!selectedDates.size) {
            alert("貼り付け先の日付を選択してください。");
            return;
        }

        const copied = readJson(CLIP_KEY, []);
        if (!copied.length) {
            alert("コピー済み予定がありません。");
            return;
        }

        const events = getEvents();

        Array.from(selectedDates).forEach(date => {
            events[date] = events[date] || [];
            copied.forEach(ev => {
                events[date].push({
                    id: uuid(),
                    channel: ev.channel,
                    user: ev.user,
                    text: ev.text
                });
            });
        });

        saveEvents(events);
        alert("貼り付けました。F5で更新してください。");
    }

    function moveSelectedDates(days) {
        if (!selectedDates.size) {
            alert("移動する日付を選択してください。");
            return;
        }

        const events = getEvents();
        const dates = Array.from(selectedDates).sort();
        const moving = {};

        dates.forEach(date => {
            if (events[date]) {
                moving[date] = events[date];
                delete events[date];
            }
        });

        Object.keys(moving).forEach(date => {
            const newDate = fDate(new Date(parseDate(date).getTime() + days * 86400000));
            events[newDate] = events[newDate] || [];
            events[newDate].push(...moving[date]);
        });

        saveEvents(events);
        alert(`${dates.length}日分の予定を${days > 0 ? "後ろ" : "前"}へ移動しました。F5で更新してください。`);
    }

    function deleteSelectedEvents() {
        if (!selectedDates.size) {
            alert("削除する日付を選択してください。");
            return;
        }

        if (!confirm("選択日の予定を削除しますか？")) return;

        const events = getEvents();
        Array.from(selectedDates).forEach(date => {
            delete events[date];
        });

        saveEvents(events);
        clearSelection();
        alert("削除しました。F5で更新してください。");
    }

    function createContextMenu() {
        if (document.getElementById("interactionContextMenu")) return;

        const menu = document.createElement("div");
        menu.id = "interactionContextMenu";
        menu.className = "ib-context-menu";
        menu.innerHTML = `
            <button data-action="add">＋ 選択日に予定追加</button>
            <button data-action="copy">📄 選択日の予定コピー</button>
            <button data-action="paste">📋 選択日に貼り付け</button>
            <button data-action="prev">← 選択日の予定を1日前へ</button>
            <button data-action="next">→ 選択日の予定を1日後へ</button>
            <button data-action="delete" class="danger">🗑 選択日の予定削除</button>
            <button data-action="clear">選択解除</button>
        `;
        document.body.appendChild(menu);

        menu.addEventListener("click", e => {
            const btn = e.target.closest("button[data-action]");
            if (!btn) return;

            const action = btn.dataset.action;
            hideContextMenu();

            if (action === "add") quickAddToSelected();
            if (action === "copy") copySelectedEvents();
            if (action === "paste") pasteToSelectedDates();
            if (action === "prev") moveSelectedDates(-1);
            if (action === "next") moveSelectedDates(1);
            if (action === "delete") deleteSelectedEvents();
            if (action === "clear") clearSelection();
        });
    }

    function showContextMenu(x, y) {
        createContextMenu();
        const menu = document.getElementById("interactionContextMenu");
        menu.classList.add("active");
        menu.style.left = `${Math.min(x, window.innerWidth - 240)}px`;
        menu.style.top = `${Math.min(y, window.innerHeight - 260)}px`;
    }

    function hideContextMenu() {
        const menu = document.getElementById("interactionContextMenu");
        if (menu) menu.classList.remove("active");
    }

    function createHelpButton() {
        if (document.getElementById("functionHelpBtn")) return;

        const btn = document.createElement("button");
        btn.id = "functionHelpBtn";
        btn.className = "function-help-btn";
        btn.type = "button";
        btn.textContent = "⌨ 操作ヘルプ";

        const sidebar = document.querySelector(".sidebar");
        const before = document.getElementById("uiControlBtn") || document.getElementById("aiGenerateBtn");

        if (sidebar && before) sidebar.insertBefore(btn, before);
        else if (sidebar) sidebar.appendChild(btn);
        else document.body.appendChild(btn);

        btn.addEventListener("click", showHelp);
    }

    function showHelp() {
        alert(
`操作ヘルプ

クリック：日付を選択
Ctrl + クリック：複数日を追加選択
Shift + クリック：範囲選択
右クリック：操作メニュー
Esc：選択解除

F2：選択日に予定追加
F4：選択日の予定コピー
F5：ブラウザ更新
F6：選択日に貼り付け
F7：選択日を1日前へ移動
F8：選択日を1日後へ移動
Delete：選択日の予定削除`
        );
    }

    function bindCalendarClicks() {
        const grid = document.getElementById("calendarGrid");
        if (!grid || grid.dataset.ibBound) return;

        grid.dataset.ibBound = "1";

        grid.addEventListener("click", e => {
            const cell = getDateCell(e.target);
            if (!cell || !cell.dataset.date) return;

            const date = cell.dataset.date;

            if (e.shiftKey && anchorDate) {
                selectRange(anchorDate, date);
                e.stopPropagation();
                return;
            }

            if (e.ctrlKey || e.metaKey) {
                selectDate(date, true);
                e.stopPropagation();
                return;
            }

            if (e.altKey) {
                selectDate(date, false);
                e.stopPropagation();
                return;
            }
        }, true);

        grid.addEventListener("contextmenu", e => {
            const cell = getDateCell(e.target);
            if (!cell || !cell.dataset.date) return;

            // 通常の右クリックは元のカレンダー機能へ渡す。
            // 操作系メニューは Ctrl + 右クリック の時だけ出す。
            if (!(e.ctrlKey || e.metaKey)) {
                return;
            }

            if (!selectedDates.has(cell.dataset.date)) {
                selectDate(cell.dataset.date, false);
            }

            e.preventDefault();
            e.stopPropagation();
            showContextMenu(e.clientX, e.clientY);
        }, true);
    }

    function bindKeys() {
        document.addEventListener("keydown", e => {
            if (e.key === "Escape") {
                clearSelection();
                hideContextMenu();
            }

            if (e.key === "F2") {
                e.preventDefault();
                quickAddToSelected();
            }

            if (e.key === "F4") {
                e.preventDefault();
                copySelectedEvents();
            }

            if (e.key === "F6") {
                e.preventDefault();
                pasteToSelectedDates();
            }

            if (e.key === "F7") {
                e.preventDefault();
                moveSelectedDates(-1);
            }

            if (e.key === "F8") {
                e.preventDefault();
                moveSelectedDates(1);
            }

            if (e.key === "Delete") {
                deleteSelectedEvents();
            }
        });

        document.addEventListener("click", e => {
            if (!e.target.closest(".ib-context-menu")) {
                hideContextMenu();
            }
        });
    }

    let timer = null;
    function scheduleBind() {
        clearTimeout(timer);
        timer = setTimeout(() => {
            bindCalendarClicks();
            paintSelection();
        }, 200);
    }

    document.addEventListener("DOMContentLoaded", () => {
        createHud();
        createContextMenu();
        createHelpButton();
        bindKeys();
        scheduleBind();

        const target = document.getElementById("calendarGrid") || document.body;
        new MutationObserver(scheduleBind).observe(target, { childList: true, subtree: true });
    });
})();