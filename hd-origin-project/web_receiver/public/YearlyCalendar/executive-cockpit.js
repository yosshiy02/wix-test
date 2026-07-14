(() => {
    if (window.__hdExecutiveCockpitInstalled) return;
    window.__hdExecutiveCockpitInstalled = true;

    const EVENT_KEY = "teamEventsMulti";
    const USER_KEY = "teamCalendarUsers";

    const chNames = {
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

    function pad(n) {
        return String(n).padStart(2, "0");
    }

    function fDate(d) {
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    function todayKey() {
        return fDate(new Date());
    }

    function addDays(date, days) {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
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
        const u = getUsers().find(x => x.id === id);
        return u ? u.name : id;
    }

    function eventsFlat() {
        const events = readJson(EVENT_KEY, {});
        return Object.keys(events).sort().flatMap(date => {
            return (events[date] || []).map(ev => ({ date, ...ev }));
        });
    }

    function esc(v) {
        return String(v ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");
    }

    function phase(text) {
        const s = String(text || "");
        if (/締切|期限|納期|🚨/.test(s)) return "deadline";
        if (/移動|帰阪|大阪→|→大阪/.test(s)) return "move";
        if (/本番|出店|展示会|納品|商談/.test(s)) return "main";
        if (/準備|確認|検品|搬入|設営|梱包|積込/.test(s)) return "prepare";
        return "normal";
    }

    function projectName(text) {
        const s = String(text || "");
        const place = s.match(/東京|名古屋|福岡|大阪|京都|神戸|横浜|広島|札幌|仙台/);
        if (place) return place[0] + "案件";
        if (/請求/.test(s)) return "請求業務";
        if (/給与/.test(s)) return "給与業務";
        if (/源泉|市民税|住民税|納付/.test(s)) return "納付業務";
        if (/出荷|納品|納期/.test(s)) return "出荷納期";
        if (/商談|見積/.test(s)) return "商談";
        return "その他";
    }

    function createButton() {
        if (document.getElementById("executiveCockpitBtn")) return;

        const btn = document.createElement("button");
        btn.id = "executiveCockpitBtn";
        btn.className = "executive-cockpit-btn";
        btn.textContent = "📊 経営者ビュー";

        const sidebar = document.querySelector(".sidebar");
        const before = document.getElementById("conflictEngineBtn") || document.getElementById("ultimateFeatureBtn") || document.getElementById("aiGenerateBtn");

        if (sidebar && before) sidebar.insertBefore(btn, before);
        else if (sidebar) sidebar.appendChild(btn);
        else document.body.appendChild(btn);

        btn.addEventListener("click", openCockpit);
    }

    function ensureModal() {
        if (document.getElementById("executiveCockpitModal")) return;

        const modal = document.createElement("div");
        modal.id = "executiveCockpitModal";
        modal.className = "modal-overlay executive-cockpit-modal";
        modal.innerHTML = `
            <div class="executive-box">
                <div class="executive-header">
                    <div>
                        <h2>📊 経営者ビュー</h2>
                        <p>今日・今週・危険・担当者負荷・案件まとまりを一画面で確認します。</p>
                    </div>
                    <button id="executiveCloseBtn" class="executive-close" type="button">✖</button>
                </div>
                <div id="executiveBody" class="executive-body"></div>
            </div>
        `;

        document.body.appendChild(modal);
        document.getElementById("executiveCloseBtn").addEventListener("click", closeCockpit);
        modal.addEventListener("click", e => {
            if (e.target === modal) closeCockpit();
        });
    }

    function openCockpit() {
        ensureModal();
        renderCockpit();
        document.getElementById("executiveCockpitModal").classList.add("active");
    }

    function closeCockpit() {
        const modal = document.getElementById("executiveCockpitModal");
        if (modal) modal.classList.remove("active");
    }

    function renderCockpit() {
        const list = eventsFlat();
        const today = todayKey();
        const weekEnd = fDate(addDays(new Date(), 7));

        const todayItems = list.filter(x => x.date === today);
        const weekItems = list.filter(x => x.date >= today && x.date <= weekEnd);
        const dangerItems = list.filter(x => phase(x.text) === "deadline" || /締切|期限|納期|🚨/.test(x.text || ""));
        const travelItems = list.filter(x => phase(x.text) === "move");
        const mainItems = list.filter(x => phase(x.text) === "main");

        const byUser = {};
        weekItems.forEach(x => {
            byUser[x.user] = byUser[x.user] || [];
            byUser[x.user].push(x);
        });

        const byProject = {};
        list.forEach(x => {
            const p = projectName(x.text);
            byProject[p] = byProject[p] || [];
            byProject[p].push(x);
        });

        const projects = Object.keys(byProject)
            .map(name => ({ name, items: byProject[name] }))
            .sort((a, b) => b.items.length - a.items.length)
            .slice(0, 8);

        document.getElementById("executiveBody").innerHTML = `
            <div class="executive-kpis">
                <div class="executive-kpi"><b>${todayItems.length}</b><span>今日</span></div>
                <div class="executive-kpi"><b>${weekItems.length}</b><span>今週</span></div>
                <div class="executive-kpi danger"><b>${dangerItems.length}</b><span>期限系</span></div>
                <div class="executive-kpi"><b>${travelItems.length}</b><span>移動</span></div>
                <div class="executive-kpi"><b>${mainItems.length}</b><span>本番</span></div>
            </div>

            <div class="executive-grid">
                <section>
                    <h3>今日やること</h3>
                    ${cards(todayItems.slice(0, 12), "今日は予定なし")}
                </section>

                <section>
                    <h3>今週の予定</h3>
                    ${cards(weekItems.slice(0, 16), "今週の予定なし")}
                </section>

                <section>
                    <h3>危険・期限</h3>
                    ${cards(dangerItems.slice(0, 16), "危険予定なし")}
                </section>

                <section>
                    <h3>担当者負荷</h3>
                    ${workload(byUser)}
                </section>

                <section class="wide">
                    <h3>案件まとまり</h3>
                    ${projectCards(projects)}
                </section>
            </div>
        `;
    }

    function cards(items, emptyText) {
        if (!items.length) return `<div class="executive-empty">${emptyText}</div>`;

        return `<div class="executive-list">` + items.map(x => `
            <div class="executive-card phase-${phase(x.text)}">
                <div class="executive-date">${esc(x.date)}</div>
                <div>
                    <b>${esc(x.text)}</b>
                    <small>${esc(chNames[x.channel] || x.channel)} / ${esc(userName(x.user))}</small>
                </div>
            </div>
        `).join("") + `</div>`;
    }

    function workload(byUser) {
        const users = Object.keys(byUser).map(id => ({ id, count: byUser[id].length }));
        if (!users.length) return `<div class="executive-empty">今週の担当予定なし</div>`;

        const max = Math.max(...users.map(x => x.count), 1);

        return `<div class="executive-workload">` + users.map(x => `
            <div class="executive-load-row">
                <span>${esc(userName(x.id))}</span>
                <div><i style="width:${Math.round((x.count / max) * 100)}%"></i></div>
                <b>${x.count}</b>
            </div>
        `).join("") + `</div>`;
    }

    function projectCards(projects) {
        if (!projects.length) return `<div class="executive-empty">案件なし</div>`;

        return `<div class="executive-projects">` + projects.map(p => {
            const dates = p.items.map(x => x.date).sort();
            const start = dates[0];
            const end = dates[dates.length - 1];
            const hasMove = p.items.some(x => phase(x.text) === "move");
            const hasMain = p.items.some(x => phase(x.text) === "main");
            const hasDeadline = p.items.some(x => phase(x.text) === "deadline");

            return `
                <div class="executive-project">
                    <div>
                        <b>${esc(p.name)}</b>
                        <small>${esc(start)}〜${esc(end)} / ${p.items.length}件</small>
                    </div>
                    <div class="executive-tags">
                        ${hasMove ? "<span>移動</span>" : ""}
                        ${hasMain ? "<span>本番</span>" : ""}
                        ${hasDeadline ? "<span class='danger'>期限</span>" : ""}
                    </div>
                </div>
            `;
        }).join("") + `</div>`;
    }

    document.addEventListener("DOMContentLoaded", () => {
        createButton();
        ensureModal();
    });

    document.addEventListener("keydown", e => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "e") {
            e.preventDefault();
            openCockpit();
        }
    });
})();