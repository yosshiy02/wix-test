(() => {
    if (window.__hdEventFlowVisualInstalled) return;
    window.__hdEventFlowVisualInstalled = true;

    const EVENT_KEY = "teamEventsMulti";

    function readEvents() {
        try {
            return JSON.parse(localStorage.getItem(EVENT_KEY) || "{}");
        } catch {
            return {};
        }
    }

    function phaseOf(text) {
        const s = String(text || "");
        if (/移動|帰阪|大阪→|→大阪|出張/.test(s)) return "move";
        if (/本番|出店|展示会|イベント|納品|商談/.test(s)) return "main";
        if (/締切|期限|納期|🚨/.test(s)) return "deadline";
        if (/準備|搬入|設営|確認|検品|梱包|積込/.test(s)) return "prepare";
        return "normal";
    }

    function timeOf(text) {
        const m = String(text || "").match(/(\d{1,2}):(\d{2})/);
        return m ? `${String(m[1]).padStart(2, "0")}:${m[2]}` : "";
    }

    function clearMarks() {
        document.querySelectorAll(".flow-move,.flow-prepare,.flow-main,.flow-deadline,.flow-busy,.flow-conflict")
            .forEach(el => el.classList.remove("flow-move","flow-prepare","flow-main","flow-deadline","flow-busy","flow-conflict"));

        document.querySelectorAll(".flow-badge,.flow-reason-pop").forEach(el => el.remove());
    }

    function analyzeDate(date, items) {
        const result = {
            count: items.length,
            hasMove: false,
            hasPrepare: false,
            hasMain: false,
            hasDeadline: false,
            hasConflict: false,
            reasons: []
        };

        const userTime = {};

        items.forEach(ev => {
            const phase = phaseOf(ev.text);
            const time = timeOf(ev.text);

            if (phase === "move") result.hasMove = true;
            if (phase === "prepare") result.hasPrepare = true;
            if (phase === "main") result.hasMain = true;
            if (phase === "deadline") result.hasDeadline = true;

            if (time && ev.user) {
                const key = `${ev.user}|${time}`;
                userTime[key] = userTime[key] || [];
                userTime[key].push(ev);
            }
        });

        Object.keys(userTime).forEach(key => {
            if (userTime[key].length >= 2) {
                result.hasConflict = true;
                const [user, time] = key.split("|");
                result.reasons.push(`同じ担当者の${time}予定が重複`);
            }
        });

        if (result.count >= 4) {
            result.reasons.push(`予定が${result.count}件あります`);
        }

        if (result.hasMove && result.hasMain) {
            result.reasons.push("移動日と本番予定が同日にあります");
        }

        if (result.hasDeadline) {
            result.reasons.push("締切・期限・納期があります");
        }

        return result;
    }

    function makePopup(date, items, info) {
        const pop = document.createElement("div");
        pop.className = "flow-reason-pop";
        pop.innerHTML = `
            <div class="flow-pop-title">${date}</div>
            <div class="flow-pop-reasons">
                ${info.reasons.length ? info.reasons.map(x => `<div>⚠ ${x}</div>`).join("") : `<div>通常予定</div>`}
            </div>
            <div class="flow-pop-list">
                ${items.slice(0, 8).map(ev => `<div>・${ev.text || ""}</div>`).join("")}
            </div>
        `;
        return pop;
    }

    function applyMarks() {
        clearMarks();

        const events = readEvents();

        Object.keys(events).forEach(date => {
            const items = Array.isArray(events[date]) ? events[date] : [];
            if (!items.length) return;

            const info = analyzeDate(date, items);
            const cells = document.querySelectorAll(`[data-date="${date}"]`);

            cells.forEach(cell => {
                if (info.hasMove) cell.classList.add("flow-move");
                if (info.hasPrepare) cell.classList.add("flow-prepare");
                if (info.hasMain) cell.classList.add("flow-main");
                if (info.hasDeadline) cell.classList.add("flow-deadline");
                if (info.count >= 4) cell.classList.add("flow-busy");
                if (info.hasConflict) cell.classList.add("flow-conflict");

                const badgeText = [
                    info.hasConflict ? "⚠" : "",
                    info.count >= 4 ? `+${info.count}` : "",
                    info.hasMove && info.hasMain ? "移/本" : "",
                    info.hasDeadline ? "締" : ""
                ].filter(Boolean).join(" ");

                if (badgeText) {
                    const badge = document.createElement("div");
                    badge.className = "flow-badge";
                    badge.textContent = badgeText;
                    const target = cell.querySelector(".cell-inner") || cell;
                    target.appendChild(badge);
                }

                cell.addEventListener("click", e => {
                    if (!e.altKey && !cell.classList.contains("flow-conflict") && !cell.classList.contains("flow-busy") && !cell.classList.contains("flow-deadline")) {
                        return;
                    }

                    document.querySelectorAll(".flow-reason-pop").forEach(x => x.remove());

                    const pop = makePopup(date, items, info);
                    document.body.appendChild(pop);

                    const rect = cell.getBoundingClientRect();
                    pop.style.left = `${Math.min(rect.left + window.scrollX, window.scrollX + window.innerWidth - 340)}px`;
                    pop.style.top = `${rect.bottom + window.scrollY + 8}px`;

                    e.stopPropagation();
                });
            });
        });
    }

    document.addEventListener("click", e => {
        if (!e.target.closest(".flow-reason-pop")) {
            document.querySelectorAll(".flow-reason-pop").forEach(x => x.remove());
        }
    });

    let timer = null;
    function schedule() {
        clearTimeout(timer);
        timer = setTimeout(applyMarks, 200);
    }

    document.addEventListener("DOMContentLoaded", () => {
        schedule();

        const target = document.getElementById("calendarGrid") || document.body;
        new MutationObserver(schedule).observe(target, {
            childList: true,
            subtree: true
        });
    });
})();