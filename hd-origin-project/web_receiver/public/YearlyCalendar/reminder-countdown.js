(() => {
    if (window.__hdReminderCountdownInstalled) return;
    window.__hdReminderCountdownInstalled = true;

    const EVENT_KEY = "teamEventsMulti";
    const STATUS_KEY = "hdEventStatusMap";

    function readJson(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch {
            return fallback;
        }
    }

    function todayDate() {
        const d = new Date();
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }

    function dateKey(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    function parseDate(key) {
        return new Date(key + "T00:00:00");
    }

    function diffDays(dateKeyText) {
        const t = todayDate();
        const d = parseDate(dateKeyText);
        return Math.round((d - t) / 86400000);
    }

    function isImportant(text) {
        return /締切|期限|納期|支払|振込|給与|納付|本番|出店|展示会|納品|🚨/.test(String(text || ""));
    }

    function phase(text) {
        const s = String(text || "");
        if (/締切|期限|納期|🚨/.test(s)) return "deadline";
        if (/本番|出店|展示会|納品/.test(s)) return "main";
        if (/移動|帰阪|大阪→|→大阪/.test(s)) return "move";
        if (/準備|確認|検品/.test(s)) return "prepare";
        return "normal";
    }

    function flatEvents() {
        const events = readJson(EVENT_KEY, {});
        const status = readJson(STATUS_KEY, {});
        return Object.keys(events).sort().flatMap(date => {
            return (events[date] || []).map(ev => {
                const key = ev.id || `${date}|${ev.channel}|${ev.user}|${ev.text}`;
                return {
                    date,
                    key,
                    status: status[key] || "todo",
                    days: diffDays(date),
                    phase: phase(ev.text),
                    ...ev
                };
            });
        });
    }

    function createBar() {
        if (document.getElementById("reminderCountdownBar")) return;

        const bar = document.createElement("div");
        bar.id = "reminderCountdownBar";
        bar.className = "reminder-countdown-bar";

        const main = document.querySelector(".main-content");
        const header = document.querySelector(".top-header");

        if (main && header) {
            main.insertBefore(bar, header.nextSibling);
        } else {
            document.body.prepend(bar);
        }
    }

    function renderBar() {
        createBar();

        const list = flatEvents();
        const active = list.filter(x => x.status !== "done");
        const today = active.filter(x => x.days === 0);
        const overdue = active.filter(x => x.days < 0);
        const soon = active.filter(x => x.days > 0 && x.days <= 7 && isImportant(x.text));
        const importantToday = today.filter(x => isImportant(x.text));

        const topItems = [
            ...overdue.slice(0, 3),
            ...importantToday.slice(0, 3),
            ...soon.slice(0, 4)
        ].slice(0, 8);

        const bar = document.getElementById("reminderCountdownBar");

        bar.innerHTML = `
            <div class="reminder-kpis">
                <div class="reminder-kpi danger"><b>${overdue.length}</b><span>超過</span></div>
                <div class="reminder-kpi today"><b>${today.length}</b><span>今日</span></div>
                <div class="reminder-kpi soon"><b>${soon.length}</b><span>7日以内</span></div>
            </div>
            <div class="reminder-ticker">
                ${topItems.length ? topItems.map(item => `
                    <div class="reminder-chip phase-${item.phase}">
                        <b>${labelDays(item.days)}</b>
                        <span>${item.date} ${item.text || ""}</span>
                    </div>
                `).join("") : `<div class="reminder-empty">直近の重要予定はありません</div>`}
            </div>
        `;
    }

    function labelDays(days) {
        if (days < 0) return `${Math.abs(days)}日超過`;
        if (days === 0) return "今日";
        if (days === 1) return "明日";
        return `あと${days}日`;
    }

    function clearCellMarks() {
        document.querySelectorAll(".reminder-cell-overdue,.reminder-cell-today,.reminder-cell-soon")
            .forEach(el => el.classList.remove("reminder-cell-overdue", "reminder-cell-today", "reminder-cell-soon"));

        document.querySelectorAll(".reminder-cell-badge").forEach(el => el.remove());
    }

    function markCells() {
        clearCellMarks();

        const grouped = {};
        flatEvents()
            .filter(x => x.status !== "done" && isImportant(x.text))
            .forEach(item => {
                grouped[item.date] = grouped[item.date] || [];
                grouped[item.date].push(item);
            });

        Object.keys(grouped).forEach(date => {
            const items = grouped[date];
            const minDays = Math.min(...items.map(x => x.days));
            const cells = document.querySelectorAll(`[data-date="${date}"]`);

            cells.forEach(cell => {
                if (minDays < 0) cell.classList.add("reminder-cell-overdue");
                else if (minDays === 0) cell.classList.add("reminder-cell-today");
                else if (minDays <= 7) cell.classList.add("reminder-cell-soon");

                const badge = document.createElement("div");
                badge.className = "reminder-cell-badge";
                badge.textContent = labelDays(minDays);
                const target = cell.querySelector(".cell-inner") || cell;
                target.appendChild(badge);
            });
        });
    }

    let timer = null;
    function schedule() {
        clearTimeout(timer);
        timer = setTimeout(() => {
            renderBar();
            markCells();
        }, 200);
    }

    document.addEventListener("DOMContentLoaded", () => {
        schedule();

        const target = document.getElementById("calendarGrid") || document.body;
        new MutationObserver(schedule).observe(target, { childList: true, subtree: true });
    });
})();