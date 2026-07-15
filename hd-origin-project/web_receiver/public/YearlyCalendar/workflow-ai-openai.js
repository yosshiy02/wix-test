(() => {
  "use strict";

  if (window.__hdWorkflowOpenAiUiInstalled) {
    return;
  }

  window.__hdWorkflowOpenAiUiInstalled = true;

  const EVENT_KEY = "teamEventsMulti";
  const USER_KEY = "teamCalendarUsers";
  const RESULT_KEY = "hdWorkflowOpenAiLastResult";

  const CHANNEL_LABELS = {
    general: "全般",
    accounting: "総務・経理",
    sales: "営業・商談",
    event: "出店・イベント",
    manufacture: "製造"
  };

  const PHASE_LABELS = {
    prepare: "準備",
    execute: "実行",
    deadline: "締切",
    review: "確認",
    send: "送付",
    hold: "保留",
    warning: "要注意"
  };

  const PRIORITY_LABELS = {
    high: "高",
    medium: "中",
    low: "低"
  };

  const FALLBACK_USERS = [
    {
      id: "sakaguchi",
      name: "坂口",
      enabled: true
    },
    {
      id: "kawatani",
      name: "川谷",
      enabled: true
    },
    {
      id: "takayama",
      name: "高山",
      enabled: true
    }
  ];

  let currentResult = null;
  let analyzing = false;

  function readJson(key, fallback) {
    try {
      const raw =
        localStorage.getItem(key);

      return raw
        ? JSON.parse(raw)
        : fallback;
    }
    catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(
      key,
      JSON.stringify(value)
    );
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function makeId() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      return window.crypto.randomUUID();
    }

    return (
      "wf_" +
      Date.now().toString(36) +
      "_" +
      Math.random()
        .toString(36)
        .slice(2, 10)
    );
  }

  function calendarUsers() {
    const stored =
      readJson(USER_KEY, []);

    const source =
      Array.isArray(stored) &&
      stored.length
        ? stored
        : FALLBACK_USERS;

    return source
      .filter(user =>
        user &&
        user.enabled !== false
      )
      .map(user => ({
        id:
          String(
            user.id || ""
          ).trim(),

        name:
          String(
            user.name ||
            user.id ||
            ""
          ).trim()
      }))
      .filter(user =>
        user.id &&
        user.name
      )
      .slice(0, 10);
  }

  function displayedYear() {
    const display =
      document.getElementById(
        "dateDisplay"
      );

    const text =
      String(
        display
          ? display.textContent
          : ""
      );

    const match =
      text.match(/(\d{4})年/);

    return match
      ? Number(match[1])
      : new Date().getFullYear();
  }

  function currentCompany() {
    const objectKeys = [
      "hd_origin_current_company",
      "current_company",
      "selected_company"
    ];

    for (const key of objectKeys) {
      const value =
        readJson(key, null);

      if (
        value &&
        typeof value === "object"
      ) {
        return value;
      }
    }

    const companyId =
      Number(
        localStorage.getItem(
          "current_company_id"
        )
      );

    if (
      Number.isInteger(companyId) &&
      companyId > 0
    ) {
      return {
        id: companyId
      };
    }

    return null;
  }

  async function fetchJson(
    url,
    options = {}
  ) {
    const response =
      await fetch(url, options);

    const text =
      await response.text();

    let data = null;

    try {
      data =
        text
          ? JSON.parse(text)
          : {};
    }
    catch {
      data = null;
    }

    if (
      !response.ok ||
      !data ||
      data.ok === false
    ) {
      throw new Error(
        (
          data &&
          (
            data.error ||
            data.message
          )
        ) ||
        "HTTP " +
        response.status
      );
    }

    return data;
  }

  function normalizeMasterRows(
    rows,
    idKey,
    nameKey
  ) {
    if (!Array.isArray(rows)) {
      return [];
    }

    return rows
      .map(row => ({
        id:
          String(
            (
              row &&
              (
                row[idKey] ??
                row.id
              )
            ) ??
            ""
          ).trim(),

        name:
          String(
            (
              row &&
              (
                row[nameKey] ??
                row.name
              )
            ) ??
            ""
          ).trim()
      }))
      .filter(row =>
        row.id &&
        row.name
      )
      .slice(0, 200);
  }

  async function loadMasterContext() {
    const data =
      await fetchJson(
        "/api/expenses/masters"
      );

    const masters =
      data.masters || {};

    return {
      departments:
        normalizeMasterRows(
          masters.departments,
          "department_id",
          "department_name"
        ),

      people:
        normalizeMasterRows(
          masters.target_people,
          "target_person_id",
          "target_person_name"
        )
    };
  }

  function createButton() {
    if (
      document.getElementById(
        "workflowAiBtn"
      )
    ) {
      return;
    }

    const sidebar =
      document.querySelector(
        ".sidebar"
      );

    if (!sidebar) {
      return;
    }

    const button =
      document.createElement(
        "button"
      );

    button.id =
      "workflowAiBtn";

    button.type =
      "button";

    button.className =
      "workflow-ai-openai-btn";

    button.textContent =
      "🧭 業務フローAI仕分け";

    const before =
      document.getElementById(
        "aiGenerateBtn"
      ) ||
      document.getElementById(
        "ultimateFeatureBtn"
      );

    if (before) {
      sidebar.insertBefore(
        button,
        before
      );
    }
    else {
      sidebar.appendChild(button);
    }

    button.addEventListener(
      "click",
      openModal
    );
  }

  function createModal() {
    if (
      document.getElementById(
        "workflowAiModal"
      )
    ) {
      return;
    }

    const modal =
      document.createElement(
        "div"
      );

    modal.id =
      "workflowAiModal";

    modal.className =
      "workflow-ai-openai-modal";

    modal.innerHTML = `
      <div
        class="workflow-ai-openai-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workflowAiTitle"
      >
        <header class="workflow-ai-openai-header">
          <div>
            <h2 id="workflowAiTitle">
              🧭 業務フローAI仕分け
            </h2>
            <p>
              対象者を先に選ばず、業務内容をまとめて入力してください。
              OpenAIが部門・担当者・日付ごとに仕分けます。
            </p>
          </div>

          <button
            id="workflowAiCloseBtn"
            type="button"
            class="workflow-ai-openai-close"
            aria-label="閉じる"
          >
            ✕
          </button>
        </header>

        <div class="workflow-ai-openai-body">
          <section class="workflow-ai-openai-input-panel">
            <div class="workflow-ai-openai-year-row">
              <label for="workflowAiYear">
                対象年
              </label>

              <input
                id="workflowAiYear"
                class="input-field"
                type="number"
                min="2020"
                max="2100"
              >

              <span
                id="workflowAiConnection"
                class="workflow-ai-openai-connection"
              >
                API確認前
              </span>
            </div>

            <label
              for="workflowAiText"
              class="workflow-ai-openai-input-label"
            >
              業務内容
            </label>

            <textarea
              id="workflowAiText"
              class="input-field workflow-ai-openai-textarea"
              placeholder="例：
7月末に東京で展示会を行う。前日に移動し、2日前までに商品と什器を確認する。
高山は製造品の検品、勝部は取引先への案内、坂口は振込と全体確認を担当する。"
            ></textarea>

            <p class="workflow-ai-openai-note">
              マスタにない部門・人物・担当者は勝手に確定せず、
              「未割当・要確認」に残します。
            </p>

            <div class="workflow-ai-openai-actions">
              <button
                id="workflowAiAnalyzeBtn"
                type="button"
                class="btn-save workflow-ai-openai-analyze"
              >
                OpenAIで解析・仕分け
              </button>

              <button
                id="workflowAiApplyBtn"
                type="button"
                class="btn-save workflow-ai-openai-apply"
                disabled
              >
                選択した予定を反映
              </button>
            </div>

            <div
              id="workflowAiStatus"
              class="workflow-ai-openai-status"
            >
              未解析です。
            </div>
          </section>

          <section
            id="workflowAiResult"
            class="workflow-ai-openai-result"
          >
            <div class="workflow-ai-openai-empty">
              業務内容を入力して解析してください。
            </div>
          </section>
        </div>
      </div>
    `;

    document.body.appendChild(
      modal
    );

    document
      .getElementById(
        "workflowAiCloseBtn"
      )
      .addEventListener(
        "click",
        closeModal
      );

    document
      .getElementById(
        "workflowAiAnalyzeBtn"
      )
      .addEventListener(
        "click",
        analyzeWorkflow
      );

    document
      .getElementById(
        "workflowAiApplyBtn"
      )
      .addEventListener(
        "click",
        applySelectedTasks
      );

    modal.addEventListener(
      "click",
      event => {
        if (
          event.target === modal
        ) {
          closeModal();
        }
      }
    );
  }

  async function checkApiStatus() {
    const badge =
      document.getElementById(
        "workflowAiConnection"
      );

    if (!badge) {
      return;
    }

    badge.textContent =
      "API確認中";

    badge.className =
      "workflow-ai-openai-connection checking";

    try {
      const data =
        await fetchJson(
          "/api/calendar/workflow/status"
        );

      const ready =
        data.route_ready &&
        data.openai_key_configured &&
        data.prompt_ready;

      badge.textContent =
        ready
          ? (
              "OpenAI接続準備済み / " +
              (
                data.model ||
                "model"
              )
            )
          : "設定確認が必要";

      badge.className =
        "workflow-ai-openai-connection " +
        (
          ready
            ? "ready"
            : "warning"
        );
    }
    catch (error) {
      badge.textContent =
        "API未反映";

      badge.className =
        "workflow-ai-openai-connection error";

      setStatus(
        "OpenAI APIを確認できません: " +
        error.message,
        "error"
      );
    }
  }

  function openModal() {
    createModal();

    document
      .getElementById(
        "workflowAiYear"
      )
      .value =
        displayedYear();

    const saved =
      readJson(
        RESULT_KEY,
        null
      );

    if (
      saved &&
      Array.isArray(saved.tasks)
    ) {
      currentResult = saved;
      renderResult();
    }

    document
      .getElementById(
        "workflowAiModal"
      )
      .classList
      .add("active");

    checkApiStatus();
  }

  function closeModal() {
    const modal =
      document.getElementById(
        "workflowAiModal"
      );

    if (modal) {
      modal.classList.remove(
        "active"
      );
    }
  }

  function setStatus(
    message,
    type = ""
  ) {
    const status =
      document.getElementById(
        "workflowAiStatus"
      );

    if (!status) {
      return;
    }

    status.textContent =
      message;

    status.className =
      "workflow-ai-openai-status" +
      (
        type
          ? " " + type
          : ""
      );
  }

  function setAnalyzing(value) {
    analyzing = value;

    const analyzeButton =
      document.getElementById(
        "workflowAiAnalyzeBtn"
      );

    const applyButton =
      document.getElementById(
        "workflowAiApplyBtn"
      );

    if (analyzeButton) {
      analyzeButton.disabled =
        value;

      analyzeButton.textContent =
        value
          ? "OpenAIが解析中..."
          : "OpenAIで解析・仕分け";
    }

    if (applyButton) {
      applyButton.disabled =
        value ||
        !(
          currentResult &&
          Array.isArray(
            currentResult.tasks
          ) &&
          currentResult.tasks.length
        );
    }
  }

  async function analyzeWorkflow() {
    if (analyzing) {
      return;
    }

    const year =
      Number(
        document
          .getElementById(
            "workflowAiYear"
          )
          .value
      );

    const workflowText =
      document
        .getElementById(
          "workflowAiText"
        )
        .value
        .trim();

    if (
      !Number.isInteger(year) ||
      year < 2020 ||
      year > 2100
    ) {
      alert(
        "対象年を確認してください。"
      );

      return;
    }

    if (!workflowText) {
      alert(
        "業務内容を入力してください。"
      );

      return;
    }

    setAnalyzing(true);

    setStatus(
      "部門・人物マスタを読み込み、OpenAIへ解析を依頼しています。",
      "working"
    );

    try {
      const masterContext =
        await loadMasterContext();

      const users =
        calendarUsers();

      if (!users.length) {
        throw new Error(
          "カレンダー担当者が登録されていません。"
        );
      }

      const data =
        await fetchJson(
          "/api/calendar/workflow/analyze",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json; charset=utf-8"
            },

            body:
              JSON.stringify({
                target_year:
                  year,

                workflow_text:
                  workflowText,

                company:
                  currentCompany(),

                departments:
                  masterContext.departments,

                people:
                  masterContext.people,

                calendar_users:
                  users
              })
          }
        );

      currentResult = {
        summary:
          String(
            data.summary || ""
          ),

        warnings:
          Array.isArray(
            data.warnings
          )
            ? data.warnings
            : [],

        model:
          String(
            data.model || ""
          ),

        created_at:
          new Date().toISOString(),

        tasks:
          Array.isArray(
            data.tasks
          )
            ? data.tasks.map(
                task => ({
                  client_id:
                    makeId(),

                  ...task
                })
              )
            : []
      };

      writeJson(
        RESULT_KEY,
        currentResult
      );

      renderResult();

      const reviewCount =
        currentResult.tasks
          .filter(
            task =>
              task.needs_review
          )
          .length;

      setStatus(
        currentResult.tasks.length +
        "件へ分解しました。要確認 " +
        reviewCount +
        "件です。",
        reviewCount
          ? "warning"
          : "success"
      );
    }
    catch (error) {
      console.error(
        "[WORKFLOW_AI_OPENAI]",
        error
      );

      setStatus(
        "解析に失敗しました: " +
        error.message,
        "error"
      );

      alert(
        "OpenAI解析に失敗しました。\n" +
        error.message
      );
    }
    finally {
      setAnalyzing(false);
    }
  }

  function groupedCounts(selector) {
    const counts =
      new Map();

    const tasks =
      currentResult &&
      Array.isArray(
        currentResult.tasks
      )
        ? currentResult.tasks
        : [];

    for (const task of tasks) {
      const key =
        selector(task) ||
        "未割当・要確認";

      counts.set(
        key,
        (
          counts.get(key) ||
          0
        ) + 1
      );
    }

    return Array
      .from(
        counts.entries()
      )
      .sort(
        (a, b) =>
          b[1] - a[1]
      );
  }

  function renderGroup(
    title,
    rows
  ) {
    return `
      <section class="workflow-ai-openai-group">
        <h3>
          ${escapeHtml(title)}
        </h3>

        <div class="workflow-ai-openai-group-items">
          ${rows.map(
            ([name, count]) => `
              <span class="${
                name ===
                "未割当・要確認"
                  ? "review"
                  : ""
              }">
                ${escapeHtml(name)}
                <strong>
                  ${count}件
                </strong>
              </span>
            `
          ).join("")}
        </div>
      </section>
    `;
  }

  function userOptions(
    selectedId
  ) {
    return (
      '<option value="">未割当</option>' +
      calendarUsers()
        .map(
          user => `
            <option
              value="${escapeHtml(user.id)}"
              ${
                user.id === selectedId
                  ? "selected"
                  : ""
              }
            >
              ${escapeHtml(user.name)}
            </option>
          `
        )
        .join("")
    );
  }

  function channelOptions(
    selectedChannel
  ) {
    return Object
      .entries(
        CHANNEL_LABELS
      )
      .map(
        ([value, label]) => `
          <option
            value="${value}"
            ${
              value ===
              selectedChannel
                ? "selected"
                : ""
            }
          >
            ${escapeHtml(label)}
          </option>
        `
      )
      .join("");
  }

  function renderResult() {
    const area =
      document.getElementById(
        "workflowAiResult"
      );

    const applyButton =
      document.getElementById(
        "workflowAiApplyBtn"
      );

    const tasks =
      currentResult &&
      Array.isArray(
        currentResult.tasks
      )
        ? currentResult.tasks
        : [];

    if (!area) {
      return;
    }

    if (!tasks.length) {
      area.innerHTML =
        '<div class="workflow-ai-openai-empty">解析結果がありません。</div>';

      if (applyButton) {
        applyButton.disabled = true;
      }

      return;
    }

    const departmentGroups =
      groupedCounts(
        task =>
          task.department_name ||
          CHANNEL_LABELS[
            task.channel
          ]
      );

    const personGroups =
      groupedCounts(
        task =>
          task.calendar_user_name ||
          task.person_name
      );

    const reviewCount =
      tasks.filter(
        task =>
          task.needs_review
      ).length;

    const warnings =
      Array.isArray(
        currentResult.warnings
      )
        ? currentResult.warnings
        : [];

    area.innerHTML = `
      <div class="workflow-ai-openai-summary">
        <div>
          <h3>
            解析結果
          </h3>

          <p>
            ${escapeHtml(
              currentResult.summary ||
              "業務を予定候補へ分解しました。"
            )}
          </p>
        </div>

        <div class="workflow-ai-openai-kpis">
          <span>
            全 ${tasks.length}件
          </span>

          <span class="${
            reviewCount
              ? "danger"
              : ""
          }">
            要確認 ${reviewCount}件
          </span>
        </div>
      </div>

      <div class="workflow-ai-openai-groups">
        ${renderGroup(
          "部門・業務区分別",
          departmentGroups
        )}

        ${renderGroup(
          "担当者別",
          personGroups
        )}
      </div>

      ${
        warnings.length
          ? `
            <div class="workflow-ai-openai-warnings">
              <strong>
                AIからの注意
              </strong>

              ${warnings
                .map(
                  warning =>
                    "<div>・" +
                    escapeHtml(
                      warning
                    ) +
                    "</div>"
                )
                .join("")}
            </div>
          `
          : ""
      }

      <div class="workflow-ai-openai-table-wrap">
        <table class="workflow-ai-openai-table">
          <thead>
            <tr>
              <th>反映</th>
              <th>日付</th>
              <th>部門・区分</th>
              <th>人物判定</th>
              <th>カレンダー担当</th>
              <th>予定区分</th>
              <th>段階</th>
              <th>優先</th>
              <th>作業内容</th>
              <th>判断理由</th>
            </tr>
          </thead>

          <tbody>
            ${tasks
              .map(
                (task, index) => {
                  const canApply =
                    Boolean(
                      task.date &&
                      task.calendar_user_id &&
                      task.title
                    );

                  const groupName =
                    task.department_name ||
                    CHANNEL_LABELS[
                      task.channel
                    ] ||
                    "未割当";

                  const personName =
                    task.person_name ||
                    "未割当";

                  return `
                    <tr
                      data-index="${index}"
                      class="${
                        task.needs_review
                          ? "needs-review"
                          : ""
                      }"
                    >
                      <td>
                        <input
                          class="workflow-ai-task-check"
                          type="checkbox"
                          ${
                            canApply
                              ? "checked"
                              : ""
                          }
                        >
                      </td>

                      <td>
                        <input
                          class="input-field workflow-ai-task-date"
                          type="date"
                          value="${escapeHtml(
                            task.date ||
                            ""
                          )}"
                        >
                      </td>

                      <td>
                        <strong>
                          ${escapeHtml(
                            groupName
                          )}
                        </strong>
                      </td>

                      <td>
                        ${escapeHtml(
                          personName
                        )}
                      </td>

                      <td>
                        <select class="input-field workflow-ai-task-user">
                          ${userOptions(
                            task.calendar_user_id ||
                            ""
                          )}
                        </select>
                      </td>

                      <td>
                        <select class="input-field workflow-ai-task-channel">
                          ${channelOptions(
                            task.channel ||
                            "general"
                          )}
                        </select>
                      </td>

                      <td>
                        <span class="workflow-ai-phase">
                          ${escapeHtml(
                            PHASE_LABELS[
                              task.phase
                            ] ||
                            task.phase ||
                            "実行"
                          )}
                        </span>
                      </td>

                      <td>
                        <span class="workflow-ai-priority">
                          ${escapeHtml(
                            PRIORITY_LABELS[
                              task.priority
                            ] ||
                            task.priority ||
                            "中"
                          )}
                        </span>
                      </td>

                      <td>
                        <input
                          class="input-field workflow-ai-task-title"
                          value="${escapeHtml(
                            task.title ||
                            ""
                          )}"
                        >

                        ${
                          task.source_text
                            ? `
                              <small>
                                根拠:
                                ${escapeHtml(
                                  task.source_text
                                )}
                              </small>
                            `
                            : ""
                        }
                      </td>

                      <td>
                        <small>
                          ${escapeHtml(
                            task.reason ||
                            ""
                          )}
                        </small>
                      </td>
                    </tr>
                  `;
                }
              )
              .join("")}
          </tbody>
        </table>
      </div>
    `;

    if (applyButton) {
      applyButton.disabled =
        false;
    }
  }

  function applySelectedTasks() {
    if (
      !currentResult ||
      !Array.isArray(
        currentResult.tasks
      ) ||
      !currentResult.tasks.length
    ) {
      alert(
        "先にOpenAI解析を実行してください。"
      );

      return;
    }

    const userMap =
      new Map(
        calendarUsers()
          .map(
            user => [
              user.id,
              user
            ]
          )
      );

    const selectedTasks = [];

    document
      .querySelectorAll(
        ".workflow-ai-openai-table tbody tr"
      )
      .forEach(row => {
        const checkbox =
          row.querySelector(
            ".workflow-ai-task-check"
          );

        if (
          !checkbox ||
          !checkbox.checked
        ) {
          return;
        }

        const index =
          Number(
            row.dataset.index
          );

        const sourceTask =
          currentResult.tasks[index];

        if (!sourceTask) {
          return;
        }

        const date =
          row
            .querySelector(
              ".workflow-ai-task-date"
            )
            .value;

        const userId =
          row
            .querySelector(
              ".workflow-ai-task-user"
            )
            .value;

        const channel =
          row
            .querySelector(
              ".workflow-ai-task-channel"
            )
            .value;

        const title =
          row
            .querySelector(
              ".workflow-ai-task-title"
            )
            .value
            .trim();

        if (
          !date ||
          !userMap.has(userId) ||
          !title
        ) {
          return;
        }

        selectedTasks.push({
          ...sourceTask,

          date,

          calendar_user_id:
            userId,

          calendar_user_name:
            userMap.get(userId).name,

          channel,
          title
        });
      });

    if (!selectedTasks.length) {
      alert(
        "反映できる予定がありません。日付・担当者・作業内容を確認してください。"
      );

      return;
    }

    const events =
      readJson(
        EVENT_KEY,
        {}
      );

    for (const task of selectedTasks) {
      if (
        !Array.isArray(
          events[task.date]
        )
      ) {
        events[task.date] = [];
      }

      const departmentLabel =
        task.department_name ||
        CHANNEL_LABELS[
          task.channel
        ] ||
        "";

      const phaseLabel =
        PHASE_LABELS[
          task.phase
        ] ||
        "実行";

      const prefix = [
        departmentLabel
          ? "[" +
            departmentLabel +
            "]"
          : "",

        phaseLabel
          ? "[" +
            phaseLabel +
            "]"
          : ""
      ]
        .filter(Boolean)
        .join("");

      events[task.date].push({
        id:
          makeId(),

        channel:
          task.channel ||
          "general",

        user:
          task.calendar_user_id,

        text:
          (
            prefix +
            " " +
            task.title
          ).trim()
      });
    }

    writeJson(
      EVENT_KEY,
      events
    );

    alert(
      selectedTasks.length +
      "件をカレンダーへ反映しました。"
    );

    window.location.reload();
  }

  document.addEventListener(
    "keydown",
    event => {
      if (
        event.key ===
        "Escape"
      ) {
        closeModal();
      }
    }
  );

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      createButton();
      createModal();
    }
  );
})();
