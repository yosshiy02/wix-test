(() => {
    if (window.__hdRightClickPlusV2Installed) return;
    window.__hdRightClickPlusV2Installed = true;

    const EVENT_KEY = "teamEventsMulti";
    const STATUS_KEY = "hdEventStatusMap";
    const CLIP_KEY = "hdRightClickCopiedEvents";

    let activeDate = "";
    let activeCell = null;
    let menuOpen = false;

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
        return "rc_" + Math.random().toString(36).slice(2, 10);
    }

    function parseDate(key) {
        return new Date(key + "T00:00:00");
    }

    function fDate(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    function addDays(date, days) {
        const d = parseDate(date);
        d.setDate(d.getDate() + days);
        return fDate(d);
    }

    function getCell(target) {
        return target.closest("[data-date]");
    }

    function getEvents() {
        return readJson(EVENT_KEY, {});
    }

    function saveEvents(events) {
        writeJson(EVENT_KEY, events);
    }

    function eventKey(date, ev) {
        return ev.id || `${date}|${ev.channel}|${ev.user}|${ev.text}`;
    }

    function createMenu() {
        let old = document.getElementById("rightClickPlusMenu");
        if (old) old.remove();

        const menu = document.createElement("div");
        menu.id = "rightClickPlusMenu";
        menu.className = "rcp-menu";
        menu.innerHTML = `
            <div class="rcp-title" id="rcpTitle">日付操作</div>

            <button data-action="quick-add">＋ 予定を追加</button>
            <button data-action="template">🧩 定型予定を追加</button>
            <button data-action="copy-date">📄 この日の予定をコピー</button>
            <button data-action="paste-date">📋 この日に貼り付け</button>

            <div class="rcp-sep"></div>

            <button data-action="move-prev">← この日の予定を1日前へ移動</button>
            <button data-action="move-next">→ この日の予定を1日後へ移動</button>
            <button data-action="duplicate-next">⧉ この日の予定を翌日に複製</button>

            <div class="rcp-sep"></div>

            <button data-action="done">✅ この日の予定を完了</button>
            <button data-action="late">⚠ この日の予定を遅延</button>
            <button data-action="memo">📝 この日にメモ予定を追加</button>

            <div class="rcp-sep"></div>

            <button data-action="copy-date-text">📅 日付をコピー</button>
            <button data-action="copy-summary">📋 この日の予定一覧をコピー</button>
            <button data-action="google-search">🔎 Googleで日付・予定を検索</button>
            <button data-action="browser-help">🌐 標準メニューの出し方</button>

            <div class="rcp-sep"></div>

            <button data-action="delete" class="danger">🗑 この日の予定を削除</button>
        `;

        document.body.appendChild(menu);

        menu.addEventListener("pointerdown", e => {
            e.stopPropagation();
        }, true);

        menu.addEventListener("click", e => {
            const btn = e.target.closest("button[data-action]");
            if (!btn) return;

            const action = btn.dataset.action;
            hideMenu();

            if (!activeDate) return;

            if (action === "quick-add") quickAdd();
            if (action === "template") addTemplate();
            if (action === "copy-date") copyDateEvents();
            if (action === "paste-date") pasteDateEvents();
            if (action === "move-prev") moveDateEvents(-1);
            if (action === "move-next") moveDateEvents(1);
            if (action === "duplicate-next") duplicateToNextDay();
            if (action === "done") setDayStatus("done");
            if (action === "late") setDayStatus("late");
            if (action === "memo") addMemo();
            if (action === "copy-date-text") copyText(activeDate);
            if (action === "copy-summary") copySummary();
            if (action === "google-search") googleSearch();
            if (action === "browser-help") browserHelp();
            if (action === "delete") deleteDateEvents();
        });
    }

    function showMenu(x, y, date, cell) {
        createMenu();

        activeDate = date;
        activeCell = cell;
        menuOpen = true;

        const menu = document.getElementById("rightClickPlusMenu");
        const title = document.getElementById("rcpTitle");

        const events = getEvents();
        const count = (events[date] || []).length;

        title.textContent = `${date} の操作（予定 ${count}件）`;

        menu.classList.add("active");

        const width = 292;
        const height = Math.min(520, window.innerHeight - 20);

        menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - width - 8))}px`;
        menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - height - 8))}px`;
    }

    function hideMenu() {
        const menu = document.getElementById("rightClickPlusMenu");
        if (menu) menu.classList.remove("active");
        menuOpen = false;
    }

    function quickAdd() {
        const text = prompt(`${activeDate} に追加する予定`, "10:00 新規予定");
        if (!text) return;

        const events = getEvents();
        events[activeDate] = events[activeDate] || [];
        events[activeDate].push({
            id: uuid(),
            channel: "general",
            user: "sakaguchi",
            text
        });

        saveEvents(events);
        alert("予定を追加しました。F5してください。");
    }

    function addTemplate() {
        const choice = prompt(
`追加する定型を番号で入力

1 = 会計確認
2 = 請求書確認
3 = 支払準備
4 = 商談
5 = 出荷準備
6 = 移動日
7 = 本番日
8 = 締切・期限`,
"1"
        );

        const map = {
            "1": { channel: "accounting", text: "[確認] 会計確認" },
            "2": { channel: "accounting", text: "[確認] 請求書確認" },
            "3": { channel: "accounting", text: "[準備] 支払準備" },
            "4": { channel: "sales", text: "[実行] 商談" },
            "5": { channel: "manufacture", text: "[準備] 出荷準備" },
            "6": { channel: "event", text: "[移動] 大阪→現地 移動" },
            "7": { channel: "event", text: "[本番] イベント本番" },
            "8": { channel: "general", text: "[締切] 期限" }
        };

        const t = map[choice];
        if (!t) return;

        const name = prompt("案件名を入れてください", "");
        const events = getEvents();

        events[activeDate] = events[activeDate] || [];
        events[activeDate].push({
            id: uuid(),
            channel: t.channel,
            user: "sakaguchi",
            text: name ? `${t.text} / ${name}` : t.text
        });

        saveEvents(events);
        alert("定型予定を追加しました。F5してください。");
    }

    function copyDateEvents() {
        const events = getEvents();
        const items = events[activeDate] || [];

        writeJson(CLIP_KEY, items.map(ev => ({
            channel: ev.channel,
            user: ev.user,
            text: ev.text
        })));

        alert(`${items.length}件コピーしました。`);
    }

    function pasteDateEvents() {
        const copied = readJson(CLIP_KEY, []);
        if (!copied.length) {
            alert("コピー済み予定がありません。");
            return;
        }

        const events = getEvents();
        events[activeDate] = events[activeDate] || [];

        copied.forEach(ev => {
            events[activeDate].push({
                id: uuid(),
                channel: ev.channel || "general",
                user: ev.user || "sakaguchi",
                text: ev.text || ""
            });
        });

        saveEvents(events);
        alert(`${copied.length}件貼り付けました。F5してください。`);
    }

    function moveDateEvents(days) {
        const events = getEvents();
        const items = events[activeDate] || [];

        if (!items.length) {
            alert("この日に予定がありません。");
            return;
        }

        const newDate = addDays(activeDate, days);
        events[newDate] = events[newDate] || [];
        events[newDate].push(...items);
        delete events[activeDate];

        saveEvents(events);
        alert(`${activeDate} の予定を ${newDate} へ移動しました。F5してください。`);
    }

    function duplicateToNextDay() {
        const events = getEvents();
        const items = events[activeDate] || [];

        if (!items.length) {
            alert("この日に予定がありません。");
            return;
        }

        const newDate = addDays(activeDate, 1);
        events[newDate] = events[newDate] || [];

        items.forEach(ev => {
            events[newDate].push({
                id: uuid(),
                channel: ev.channel,
                user: ev.user,
                text: ev.text
            });
        });

        saveEvents(events);
        alert(`${newDate} に複製しました。F5してください。`);
    }

    function setDayStatus(status) {
        const events = getEvents();
        const items = events[activeDate] || [];

        if (!items.length) {
            alert("この日に予定がありません。");
            return;
        }

        const statusMap = readJson(STATUS_KEY, {});

        items.forEach(ev => {
            statusMap[eventKey(activeDate, ev)] = status;
        });

        writeJson(STATUS_KEY, statusMap);
        alert(status === "done" ? "この日の予定を完了にしました。" : "この日の予定を遅延にしました。");
    }

    function addMemo() {
        const memo = prompt(`${activeDate} のメモ`, "メモ：");
        if (!memo) return;

        const events = getEvents();

        events[activeDate] = events[activeDate] || [];
        events[activeDate].push({
            id: uuid(),
            channel: "general",
            user: "sakaguchi",
            text: memo
        });

        saveEvents(events);
        alert("メモ予定を追加しました。F5してください。");
    }

    async function copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            alert("コピーしました。");
        } catch {
            prompt("コピーしてください", text);
        }
    }

    function copySummary() {
        const events = getEvents();
        const items = events[activeDate] || [];

        const text = [
            `${activeDate} の予定`,
            "--------------------",
            ...(items.length ? items.map(ev => `・${ev.text || ""}`) : ["予定なし"])
        ].join("\n");

        copyText(text);
    }

    function googleSearch() {
        const events = getEvents();
        const items = events[activeDate] || [];
        const query = encodeURIComponent(`${activeDate} ${items.map(x => x.text || "").join(" ")}`);
        window.open(`https://www.google.com/search?q=${query}`, "_blank");
    }

    function browserHelp() {
        alert(
`Chrome/Googleの標準右クリックメニューを出す方法

Shift + 右クリック

通常右クリックはカレンダー専用メニューです。
標準メニューそのものを、この中にサブメニュー表示することはブラウザ仕様上できません。`
        );
    }

    function deleteDateEvents() {
        const events = getEvents();
        const items = events[activeDate] || [];

        if (!items.length) {
            alert("この日に予定がありません。");
            return;
        }

        if (!confirm(`${activeDate} の予定 ${items.length}件を削除しますか？`)) return;

        delete events[activeDate];
        saveEvents(events);
        alert("削除しました。F5してください。");
    }

    function bindRightClickEveryTime() {
        document.addEventListener("pointerdown", e => {
            if (e.button === 2) {
                const cell = getCell(e.target);

                if (cell && cell.dataset.date && !e.shiftKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
            } else if (menuOpen && !e.target.closest("#rightClickPlusMenu")) {
                hideMenu();
            }
        }, true);

        document.addEventListener("contextmenu", e => {
            const cell = getCell(e.target);

            if (!cell || !cell.dataset.date) {
                return;
            }

            // Shift + 右クリックだけはChrome標準メニューを出す
            if (e.shiftKey) {
                hideMenu();
                return;
            }

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            showMenu(e.clientX, e.clientY, cell.dataset.date, cell);

            return false;
        }, true);

        window.addEventListener("blur", hideMenu);
        window.addEventListener("resize", hideMenu);

        document.addEventListener("keydown", e => {
            if (e.key === "Escape") hideMenu();
        }, true);
    }

    function markCells() {
        document.querySelectorAll("[data-date]").forEach(cell => {
            cell.classList.add("rcp-enabled-cell");
            cell.title = "右クリック：専用メニュー / Shift+右クリック：Chrome標準メニュー";
        });
    }

    let timer = null;
    function scheduleMark() {
        clearTimeout(timer);
        timer = setTimeout(markCells, 150);
    }

    document.addEventListener("DOMContentLoaded", () => {
        createMenu();
        bindRightClickEveryTime();
        scheduleMark();

        const target = document.getElementById("calendarGrid") || document.body;
        new MutationObserver(scheduleMark).observe(target, {
            childList: true,
            subtree: true
        });
    });
})();