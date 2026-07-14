(() => {
    if (window.__hdMondayStartV3Installed) return;
    window.__hdMondayStartV3Installed = true;

    const labels = ["月", "火", "水", "木", "金", "土", "日"];

    function parseDate(s) {
        return new Date(s + "T00:00:00");
    }

    function ymd(d) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }

    function getMondayColumn(dateObj) {
        // 月=1 火=2 水=3 木=4 金=5 土=6 日=7
        return ((dateObj.getDay() + 6) % 7) + 1;
    }

    function getMonthKey(dateText) {
        return String(dateText || "").slice(0, 7);
    }

    function getMainMonth(cells) {
        const count = {};
        cells.forEach(cell => {
            const key = getMonthKey(cell.dataset.date);
            if (!key) return;
            count[key] = (count[key] || 0) + 1;
        });

        return Object.keys(count).sort((a, b) => count[b] - count[a])[0] || "";
    }

    function getStartMonday(monthKey) {
        const first = parseDate(monthKey + "-01");
        const d = new Date(first);
        const diff = (d.getDay() + 6) % 7;
        d.setDate(d.getDate() - diff);
        return d;
    }

    function findRealMonthGrid() {
        const allCells = Array.from(document.querySelectorAll("[data-date]"))
            .filter(cell => {
                const rect = cell.getBoundingClientRect();
                return rect.width > 20 && rect.height > 20 && !cell.closest(".mini-month");
            });

        if (allCells.length < 20) return null;

        const parentScores = new Map();

        allCells.forEach(cell => {
            let p = cell.parentElement;
            let depth = 0;

            while (p && p !== document.body && depth < 6) {
                const count = Array.from(p.querySelectorAll("[data-date]"))
                    .filter(x => !x.closest(".mini-month")).length;

                if (count >= 20) {
                    const score = count - depth;
                    parentScores.set(p, Math.max(parentScores.get(p) || 0, score));
                }

                p = p.parentElement;
                depth++;
            }
        });

        const best = Array.from(parentScores.entries())
            .sort((a, b) => b[1] - a[1])[0];

        return best ? best[0] : null;
    }

    function removeOldInjectedHeaders(grid) {
        grid.querySelectorAll(".monday-v3-header").forEach(x => x.remove());
    }

    function hideOldWeekHeaders(grid) {
        const weekdayText = /^(日|月|火|水|木|金|土|Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/;

        Array.from(grid.children).forEach(el => {
            if (el.matches("[data-date]")) return;

            const txt = (el.textContent || "").trim();
            if (weekdayText.test(txt)) {
                el.classList.add("monday-v3-hide-old-header");
            }
        });

        // 兄弟階層に曜日ヘッダーがある場合も隠す
        const parent = grid.parentElement;
        if (parent) {
            Array.from(parent.querySelectorAll("*")).forEach(el => {
                if (el.matches("[data-date]")) return;
                if (el.classList.contains("monday-v3-header")) return;
                if (el.children.length > 0) return;

                const txt = (el.textContent || "").trim();
                if (weekdayText.test(txt)) {
                    const r = el.getBoundingClientRect();
                    const gr = grid.getBoundingClientRect();

                    if (Math.abs(r.left - gr.left) < gr.width + 50 && r.top <= gr.top + 120) {
                        el.classList.add("monday-v3-hide-old-header");
                    }
                }
            });
        }
    }

    function injectMondayHeaders(grid) {
        removeOldInjectedHeaders(grid);

        labels.forEach((label, index) => {
            const h = document.createElement("div");
            h.className = "monday-v3-header";
            h.textContent = label;
            h.style.gridColumn = String(index + 1);
            h.style.gridRow = "1";
            h.style.order = String(index + 1);

            if (label === "土") h.classList.add("sat");
            if (label === "日") h.classList.add("sun");

            grid.prepend(h);
        });
    }

    function forceMonday() {
        const grid = findRealMonthGrid();
        if (!grid) return;

        const cells = Array.from(grid.querySelectorAll("[data-date]"))
            .filter(cell => !cell.closest(".mini-month"));

        if (cells.length < 20) return;

        const mainMonth = getMainMonth(cells);
        if (!mainMonth) return;

        const startMonday = getStartMonday(mainMonth);

        grid.classList.add("monday-v3-grid");
        grid.style.display = "grid";
        grid.style.gridTemplateColumns = "repeat(7, minmax(0, 1fr))";
        grid.style.gridAutoRows = "minmax(240px, auto)";
        grid.style.gap = "8px";
        grid.style.alignItems = "stretch";

        hideOldWeekHeaders(grid);
        injectMondayHeaders(grid);

        cells.forEach(cell => {
            const date = cell.dataset.date;
            if (!date) return;

            const d = parseDate(date);
            const col = getMondayColumn(d);
            const diffDays = Math.floor((d - startMonday) / 86400000);
            const week = Math.floor(diffDays / 7);

            cell.classList.add("monday-v3-cell");
            cell.style.gridColumn = String(col);
            cell.style.gridRow = String(week + 2);
            cell.style.order = String((week + 2) * 10 + col);

            cell.classList.toggle("monday-v3-sat", d.getDay() === 6);
            cell.classList.toggle("monday-v3-sun", d.getDay() === 0);
        });
    }

    let timer = null;
    function schedule() {
        clearTimeout(timer);
        timer = setTimeout(forceMonday, 250);
    }

    document.addEventListener("DOMContentLoaded", () => {
        schedule();

        const target = document.getElementById("calendarGrid") || document.body;

        new MutationObserver(schedule).observe(target, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class", "style"]
        });

        document.addEventListener("click", schedule, true);
    });
})();