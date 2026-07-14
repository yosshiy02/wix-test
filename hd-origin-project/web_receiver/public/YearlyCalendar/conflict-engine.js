(() => {
    if (window.__hdConflictEngineInstalled) return;
    window.__hdConflictEngineInstalled = true;

    const EVENT_KEY = "teamEventsMulti";
    const USER_KEY = "teamCalendarUsers";

    const channelNames = {
        general: "全般",
        accounting: "会計",
        sales: "商談",
        event: "出店",
        manufacture: "製造"
    };

    function readJson(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch {
            return fallback;
        }
    }

    function getEvents() {
        return readJson(EVENT_KEY, {});
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

    function getUserName(id) {
        const found = getUsers().find(u => u.id === id);
        return found ? found.name : id;
    }

    function escapeHtml(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function extractTime(text) {
        const match = String(text || "").match(/(\d{1,2}):(\d{2})/);
        if (!match) return "";
        return `${String(match[1]).padStart(2, "0")}:${match[2]}`;
    }

    function phaseOf(text) {
        const s = String(text || "");
        if (/移動|帰阪|大阪→|→大阪|出張/.test(s)) return "travel";
        if (/本番|出店|展示会|イベント|商談|納品/.test(s)) return "main";
        if (/締切|期限|納期|🚨/.test(s)) return "deadline";
        if (/準備|搬入|設営|確認|検品/.test(s)) return "prepare";
        return "normal";
    }

    function normalizeProjectName(text) {
        const s = String(text || "")
            .replace(/\d{1,2}:\d{2}/g, "")
            .replace(/\[(.*?)\]/g, "")
            .replace(/大阪→|→大阪|東京→|名古屋→|福岡→/g, "")
            .replace(/移動|帰阪|準備|本番|出店|展示会|納品|搬入|設営|売上|確認|メール|送付|整理/g, "")
            .replace(/[\/・、。]/g, " ")
            .trim();

        const place = String(text || "").match(/東京|名古屋|福岡|大阪|京都|神戸|横浜|広島|札幌|仙台/);
        if (place) return place[0];

        return s.slice(0, 8) || "案件";
    }

    function flattenEvents() {
        const events = getEvents();
        return Object.keys(events).sort().flatMap(date => {
            return (events[date] || []).map(ev => ({
                date,
                time: extractTime(ev.text),
                phase: phaseOf(ev.text),
                project: normalizeProjectName(ev.text),
                ...ev
            }));
        });
    }

    function analyze() {
        const list = flattenEvents();
        const byDate = {};
        const conflicts = [];
        const overloads = [];
        const dangerDays = [];
        const travelGroups = {};

        list.forEach(ev => {
            if (!byDate[ev.date]) byDate[ev.date] = [];
            byDate[ev.date].push(ev);
        });

        Object.keys(byDate).forEach(date => {
            const dayItems = byDate[date];

            if (dayItems.length >= 4) {
                overloads.push({
                    date,
                    count: dayItems.length,
                    items: dayItems
                });
            }

            const hasDeadline = dayItems.some(x => x.phase === "deadline");
            const hasTravel = dayItems.some(x => x.phase === "travel");
            const hasMain = dayItems.some(x => x.phase === "main");

            if (hasDeadline || dayItems.length >= 6) {
                dangerDays.push({
                    date,
                    reason: hasDeadline ? "期限系予定あり" : "予定集中",
                    items: dayItems
                });
            }

            const userTimeMap = {};
            dayItems.forEach(ev => {
                if (!ev.time) return;
                const key = `${ev.user}|${ev.time}`;
                if (!userTimeMap[key]) userTimeMap[key] = [];
                userTimeMap[key].push(ev);
            });

            Object.keys(userTimeMap).forEach(key => {
                const items = userTimeMap[key];
                if (items.length >= 2) {
                    conflicts.push({
                        type: "same_user_same_time",
                        severity: "high",
                        date,
                        user: items[0].user,
                        time: items[0].time,
                        message: `${getUserName(items[0].user)}の${items[0].time}予定が重複`,
                        items
                    });
                }
            });

            if (hasTravel && hasMain) {
                const travelUsers = new Set(dayItems.filter(x => x.phase === "travel").map(x => x.user));
                const mainSameUser = dayItems.some(x => x.phase === "main" && travelUsers.has(x.user));
                if (mainSameUser) {
                    conflicts.push({
                        type: "travel_and_main_same_day",
                        severity: "medium",
                        date,
                        user: "",
                        time: "",
                        message: "移動日と本番予定が同日にあります",
                        items: dayItems
                    });
                }
            }

            dayItems.forEach(ev => {
                if (ev.phase === "travel" || ev.phase === "main") {
                    const key = `${ev.channel}|${ev.project}`;
                    if (!travelGroups[key]) {
                        travelGroups[key] = {
                            key,
                            project: ev.project,
                            channel: ev.channel,
                            dates: new Set(),
                            items: []
                        };
                    }
                    travelGroups[key].dates.add(ev.date);
                    travelGroups[key].items.push(ev);
                }
            });
        });

        const groupedTrips = Object.values(travelGroups)
            .map(group => ({
                ...group,
                dates: Array.from(group.dates).sort()
            }))
            .filter(group => group.items.some(x => x.phase === "travel") && group.items.some(x => x.phase === "main"))
            .sort((a, b) => a.dates[0].localeCompare(b.dates[0]));

        return {
            list,
            byDate,
            conflicts,
            overloads,
            dangerDays,
            travelGroups: groupedTrips
        };
    }

    function createButton() {
        if (document.getElementById("conflictEngineBtn")) return;

        const btn = document.createElement("button");
        btn.id = "conflictEngineBtn";
        btn.className = "conflict-engine-btn";
        btn.type = "button";
        btn.textContent = "⚠ 衝突管理";

        const sidebar = document.querySelector(".sidebar");
        const target = document.getElementById("ultimateFeatureBtn") || document.getElementById("aiGenerateBtn");

        if (sidebar && target) {
            sidebar.insertBefore(btn, target);
        } else if (sidebar) {
            sidebar.appendChild(btn);
        } else {
            document.body.appendChild(btn);
        }

        btn.addEventListener("click", openModal);
    }

    function ensureModal() {
        if (document.getElementById("conflictEngineModal")) return;

        const modal = document.createElement("div");
        modal.id = "conflictEngineModal";
        modal.className = "modal-overlay conflict-engine-modal";
        modal.innerHTML = `
            <div class="conflict-box">
                <div class="conflict-header">
                    <div>
                        <h2>⚠ 衝突・危険日管理</h2>
                        <p>予定かぶり、予定集中、遠征の流れを確認します。</p>
                    </div>
                    <button type="button" id="conflictCloseBtn" class="conflict-close-btn">✖</button>
                </div>

                <div class="conflict-tabs">
                    <button class="conflict-tab active" data-tab="conflicts">衝突</button>
                    <button class="conflict-tab" data-tab="overload">集中日</button>
                    <button class="conflict-tab" data-tab="travel">遠征まとまり</button>
                    <button class="conflict-tab" data-tab="rules">表示ルール</button>
                </div>

                <div class="conflict-body">
                    <section id="conflictPanel-conflicts" class="conflict-panel active"></section>
                    <section id="conflictPanel-overload" class="conflict-panel"></section>
                    <section id="conflictPanel-travel" class="conflict-panel"></section>
                    <section id="conflictPanel-rules" class="conflict-panel"></section>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById("conflictCloseBtn").addEventListener("click", closeModal);
        modal.addEventListener("click", e => {
            if (e.target === modal) closeModal();
        });

        modal.querySelectorAll(".conflict-tab").forEach(btn => {
            btn.addEventListener("click", () => {
                modal.querySelectorAll(".conflict-tab").forEach(x => x.classList.toggle("active", x === btn));
                modal.querySelectorAll(".conflict-panel").forEach(panel => {
                    panel.classList.toggle("active", panel.id === `conflictPanel-${btn.dataset.tab}`);
                });
            });
        });
    }

    function openModal() {
        ensureModal();
        renderModal();
        document.getElementById("conflictEngineModal").classList.add("active");
    }

    function closeModal() {
        const modal = document.getElementById("conflictEngineModal");
        if (modal) modal.classList.remove("active");
    }

    function renderModal() {
        const data = analyze();

        document.getElementById("conflictPanel-conflicts").innerHTML = data.conflicts.length
            ? data.conflicts.map(renderConflict).join("")
            : `<div class="conflict-empty">重大な予定かぶりは見つかりません。</div>`;

        document.getElementById("conflictPanel-overload").innerHTML = data.overloads.length
            ? data.overloads.map(renderOverload).join("")
            : `<div class="conflict-empty">予定集中日はありません。</div>`;

        document.getElementById("conflictPanel-travel").innerHTML = data.travelGroups.length
            ? data.travelGroups.map(renderTravelGroup).join("")
            : `<div class="conflict-empty">遠征まとまりはありません。</div>`;

        document.getElementById("conflictPanel-rules").innerHTML = `
            <div class="conflict-rule-card">
                <h3>表示ルール案</h3>
                <p><b>移動日</b>：薄く塗る。予定カードも控えめに表示。</p>
                <p><b>本番日・イベント日</b>：濃く塗る。同じ案件名は同系色にする。</p>
                <p><b>同じ担当・同じ時刻</b>：赤警告。</p>
                <p><b>1日に4件以上</b>：予定集中として件数バッジ。</p>
                <p><b>締切・期限・納期</b>：危険日として強調。</p>
            </div>
        `;
    }

    function renderConflict(c) {
        return `
            <div class="conflict-card ${c.severity}">
                <div class="conflict-card-title">${escapeHtml(c.date)} ${c.time ? escapeHtml(c.time) : ""}　${escapeHtml(c.message)}</div>
                <div class="conflict-item-list">
                    ${c.items.map(renderMiniEvent).join("")}
                </div>
            </div>
        `;
    }

    function renderOverload(o) {
        return `
            <div class="conflict-card medium">
                <div class="conflict-card-title">${escapeHtml(o.date)}　予定集中 ${o.count}件</div>
                <div class="conflict-item-list">
                    ${o.items.slice(0, 12).map(renderMiniEvent).join("")}
                </div>
            </div>
        `;
    }

    function renderTravelGroup(g) {
        const start = g.dates[0];
        const end = g.dates[g.dates.length - 1];
        return `
            <div class="conflict-card travel">
                <div class="conflict-card-title">${escapeHtml(g.project)} / ${escapeHtml(channelNames[g.channel] || g.channel)}　${escapeHtml(start)}〜${escapeHtml(end)}</div>
                <div class="conflict-timeline">
                    ${g.dates.map(date => `<span>${escapeHtml(date)}</span>`).join("")}
                </div>
                <div class="conflict-item-list">
                    ${g.items.slice(0, 16).map(renderMiniEvent).join("")}
                </div>
            </div>
        `;
    }

    function renderMiniEvent(e) {
        return `
            <div class="conflict-mini-event phase-${escapeHtml(e.phase)}">
                <span>${escapeHtml(e.time || "終日")}</span>
                <b>${escapeHtml(getUserName(e.user))}</b>
                <em>${escapeHtml(channelNames[e.channel] || e.channel)}</em>
                <strong>${escapeHtml(e.text)}</strong>
            </div>
        `;
    }

    function clearMarks() {
        document.querySelectorAll(".conflict-cell-mark,.conflict-overload-mark,.conflict-danger-mark,.conflict-travel-thin,.conflict-event-strong")
            .forEach(el => el.classList.remove("conflict-cell-mark", "conflict-overload-mark", "conflict-danger-mark", "conflict-travel-thin", "conflict-event-strong"));

        document.querySelectorAll(".conflict-day-badge").forEach(el => el.remove());
    }

    function markCalendar() {
        const data = analyze();
        clearMarks();

        Object.keys(data.byDate).forEach(date => {
            const items = data.byDate[date];
            const cells = document.querySelectorAll(`[data-date="${date}"]`);
            if (!cells.length) return;

            const hasTravel = items.some(x => x.phase === "travel");
            const hasMain = items.some(x => x.phase === "main");
            const hasDeadline = items.some(x => x.phase === "deadline");
            const hasConflict = data.conflicts.some(c => c.date === date);

            cells.forEach(cell => {
                if (hasTravel) cell.classList.add("conflict-travel-thin");
                if (hasMain) cell.classList.add("conflict-event-strong");
                if (items.length >= 4) cell.classList.add("conflict-overload-mark");
                if (hasDeadline) cell.classList.add("conflict-danger-mark");
                if (hasConflict) cell.classList.add("conflict-cell-mark");

                const badge = document.createElement("div");
                badge.className = "conflict-day-badge";
                badge.innerHTML = [
                    hasConflict ? "⚠" : "",
                    items.length >= 4 ? `+${items.length}` : "",
                    hasTravel && hasMain ? "移/本" : ""
                ].filter(Boolean).join(" ");

                if (badge.textContent.trim()) {
                    const inner = cell.querySelector(".cell-inner") || cell;
                    inner.appendChild(badge);
                }
            });
        });

        const btn = document.getElementById("conflictEngineBtn");
        if (btn) {
            btn.textContent = data.conflicts.length
                ? `⚠ 衝突管理 ${data.conflicts.length}`
                : "⚠ 衝突管理";
            btn.classList.toggle("has-conflict", data.conflicts.length > 0);
        }
    }

    let markTimer = null;
    function scheduleMark() {
        clearTimeout(markTimer);
        markTimer = setTimeout(markCalendar, 150);
    }

    document.addEventListener("DOMContentLoaded", () => {
        createButton();
        ensureModal();
        scheduleMark();

        const target = document.getElementById("calendarGrid") || document.body;
        const observer = new MutationObserver(scheduleMark);
        observer.observe(target, { childList: true, subtree: true });
    });

    document.addEventListener("keydown", e => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "k") {
            e.preventDefault();
            openModal();
        }
    });
})();