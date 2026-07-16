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
      "🧭 業務フローAI仕分け・内容修正";

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
              🧭 業務フローAI仕分け・内容修正
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
                OpenAIで解析・自動反映
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
      syncCurrentResultWithCalendar();
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

    if (analyzeButton) {
      analyzeButton.disabled =
        value;

      analyzeButton.textContent =
        value
          ? "OpenAIが解析中..."
          : "OpenAIで解析・自動反映";
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

      const autoApplyResult =
        autoApplyAnalyzedTasks();

      writeJson(
        RESULT_KEY,
        currentResult
      );

      renderResult();

      setStatus(
        currentResult.tasks.length +
        "件を解析しました。新規反映 " +
        autoApplyResult.created +
        "件、更新 " +
        autoApplyResult.updated +
        "件、人間修正保護 " +
        autoApplyResult.protectedCount +
        "件、要確認 " +
        autoApplyResult.reviewCount +
        "件です。",
        autoApplyResult.reviewCount
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



  function padDatePart(value) {
    return String(value)
      .padStart(2, "0");
  }

  function formatWorkflowDate(
    year,
    month,
    day
  ) {
    return [
      year,
      padDatePart(month),
      padDatePart(day)
    ].join("-");
  }

  function parseWorkflowDate(value) {
    const match =
      String(value || "")
        .match(
          /^(\d{4})-(\d{2})-(\d{2})$/
        );

    if (!match) {
      return null;
    }

    return {
      year:
        Number(match[1]),

      month:
        Number(match[2]),

      day:
        Number(match[3])
    };
  }

  function workflowDaysInMonth(
    year,
    month
  ) {
    return new Date(
      year,
      month,
      0
    ).getDate();
  }

  function isWorkflowMonthEndTask(
    task
  ) {
    const ruleText = [
      task.monthly_rule,
      task.date_rule,
      task.schedule_rule,
      task.title,
      task.reason
    ]
      .filter(Boolean)
      .join(" ");

    return (
      task.month_end === true ||
      ruleText.includes("month_end") ||
      ruleText.includes("月末") ||
      ruleText.includes("最終日")
    );
  }

  function workflowSeriesId(task) {
    return String(
      task.series_id ||
      task.rule_key ||
      task.job_code ||
      task.title ||
      task.client_id ||
      "general_workflow"
    )
      .trim()
      .replace(
        /\s+/g,
        "_"
      );
  }

  function cloneWorkflowOccurrence(
    task,
    date,
    occurrenceIndex,
    targetYear
  ) {
    const seriesId =
      workflowSeriesId(task);

    return {
      ...task,

      client_id:
        [
          task.client_id ||
            makeId(),
          date,
          occurrenceIndex
        ].join("_"),

      date,

      target_year:
        targetYear,

      workflow_series_id:
        seriesId,

      workflow_occurrence_key:
        [
          seriesId,
          date,
          task.calendar_user_id ||
            "unassigned"
        ].join("|"),

      workflow_original_date:
        task.workflow_original_date ||
        task.date ||
        "",

      workflow_is_expanded:
        true,

      workflow_occurrence_index:
        occurrenceIndex
    };
  }

  function expandMonthlyWorkflowTask(
    task,
    targetYear,
    parts
  ) {
    const rows = [];

    for (
      let month = 1;
      month <= 12;
      month++
    ) {
      const lastDay =
        workflowDaysInMonth(
          targetYear,
          month
        );

      const day =
        isWorkflowMonthEndTask(task)
          ? lastDay
          : Math.min(
              parts.day,
              lastDay
            );

      rows.push(
        cloneWorkflowOccurrence(
          task,
          formatWorkflowDate(
            targetYear,
            month,
            day
          ),
          month,
          targetYear
        )
      );
    }

    return rows;
  }

  function expandWeeklyWorkflowTask(
    task,
    targetYear,
    parts
  ) {
    const original =
      new Date(
        parts.year,
        parts.month - 1,
        parts.day
      );

    const targetWeekday =
      original.getDay();

    const cursor =
      new Date(
        targetYear,
        0,
        1
      );

    while (
      cursor.getDay() !==
      targetWeekday
    ) {
      cursor.setDate(
        cursor.getDate() + 1
      );
    }

    const rows = [];
    let occurrenceIndex = 1;

    while (
      cursor.getFullYear() ===
      targetYear
    ) {
      rows.push(
        cloneWorkflowOccurrence(
          task,
          formatWorkflowDate(
            cursor.getFullYear(),
            cursor.getMonth() + 1,
            cursor.getDate()
          ),
          occurrenceIndex,
          targetYear
        )
      );

      occurrenceIndex++;

      cursor.setDate(
        cursor.getDate() + 7
      );
    }

    return rows;
  }

  function expandDailyWorkflowTask(
    task,
    targetYear
  ) {
    const rows = [];

    const cursor =
      new Date(
        targetYear,
        0,
        1
      );

    let occurrenceIndex = 1;

    while (
      cursor.getFullYear() ===
      targetYear
    ) {
      rows.push(
        cloneWorkflowOccurrence(
          task,
          formatWorkflowDate(
            cursor.getFullYear(),
            cursor.getMonth() + 1,
            cursor.getDate()
          ),
          occurrenceIndex,
          targetYear
        )
      );

      occurrenceIndex++;

      cursor.setDate(
        cursor.getDate() + 1
      );
    }

    return rows;
  }

  function expandYearlyWorkflowTask(
    task,
    targetYear,
    parts
  ) {
    const lastDay =
      workflowDaysInMonth(
        targetYear,
        parts.month
      );

    const day =
      Math.min(
        parts.day,
        lastDay
      );

    return [
      cloneWorkflowOccurrence(
        task,
        formatWorkflowDate(
          targetYear,
          parts.month,
          day
        ),
        1,
        targetYear
      )
    ];
  }

  function expandWorkflowTask(
    task,
    targetYear
  ) {
    const parts =
      parseWorkflowDate(
        task.date
      );

    if (!parts) {
      return [
        {
          ...task,

          workflow_series_id:
            workflowSeriesId(task),

          workflow_is_expanded:
            false,

          needs_review:
            true
        }
      ];
    }

    const recurrence =
      String(
        task.recurrence ||
        "none"
      ).toLowerCase();

    if (recurrence === "monthly") {
      return expandMonthlyWorkflowTask(
        task,
        targetYear,
        parts
      );
    }

    if (recurrence === "weekly") {
      return expandWeeklyWorkflowTask(
        task,
        targetYear,
        parts
      );
    }

    if (recurrence === "daily") {
      return expandDailyWorkflowTask(
        task,
        targetYear
      );
    }

    if (recurrence === "yearly") {
      return expandYearlyWorkflowTask(
        task,
        targetYear,
        parts
      );
    }

    return [
      cloneWorkflowOccurrence(
        task,
        task.date,
        1,
        targetYear
      )
    ];
  }

  function expandWorkflowTasksForYear(
    tasks,
    targetYear
  ) {
    const expanded = [];
    const unique = new Map();

    for (
      const task
      of tasks
    ) {
      const occurrences =
        expandWorkflowTask(
          task,
          targetYear
        );

      for (
        const occurrence
        of occurrences
      ) {
        const uniqueKey = [
          occurrence.workflow_series_id ||
            workflowSeriesId(occurrence),
          occurrence.date ||
            "no-date",
          occurrence.calendar_user_id ||
            "unassigned",
          occurrence.phase ||
            "",
          occurrence.title ||
            ""
        ].join("|");

        if (!unique.has(uniqueKey)) {
          unique.set(
            uniqueKey,
            occurrence
          );
        }
      }
    }

    for (
      const occurrence
      of unique.values()
    ) {
      expanded.push(occurrence);
    }

    expanded.sort(
      (left, right) =>
        String(left.date || "")
          .localeCompare(
            String(right.date || "")
          )
    );

    return expanded;
  }



  function autoApplyAnalyzedTasks() {
    const events =
      readJson(
        EVENT_KEY,
        {}
      );

    const users =
      calendarUsers();

    const fallbackUser =
      users.length
        ? users[0]
        : {
            id: "unassigned",
            name: "未割当"
          };

    let created = 0;
    let updated = 0;
    let protectedCount = 0;
    let reviewCount = 0;

    const tasks =
      currentResult &&
      Array.isArray(
        currentResult.tasks
      )
        ? currentResult.tasks
        : [];

    for (const task of tasks) {
      if (
        !task ||
        !task.date ||
        !task.title
      ) {
        reviewCount++;
        continue;
      }

      const effectiveUserId =
        String(
          task.calendar_user_id ||
          fallbackUser.id ||
          "unassigned"
        ).trim() ||
        "unassigned";

      const effectiveUserName =
        String(
          task.calendar_user_name ||
          fallbackUser.name ||
          "未割当"
        ).trim() ||
        "未割当";

      const requiresReview =
        task.needs_review === true ||
        !task.calendar_user_id;

      if (requiresReview) {
        reviewCount++;
      }

      task.calendar_user_id =
        effectiveUserId;

      task.calendar_user_name =
        effectiveUserName;

      task.needs_review =
        requiresReview;

      const stableKey = [
        task.rule_key ||
          task.job_code ||
          task.title ||
          "general_workflow",
        task.date,
        effectiveUserId
      ].join("|");

      let foundDate = "";
      let foundIndex = -1;
      let foundEvent = null;

      for (
        const [date, items]
        of Object.entries(events)
      ) {
        if (!Array.isArray(items)) {
          continue;
        }

        const index =
          items.findIndex(
            item =>
              String(
                item &&
                item.workflow_rule_instance
                  ? item.workflow_rule_instance
                  : ""
              ) === stableKey
          );

        if (index >= 0) {
          foundDate = date;
          foundIndex = index;
          foundEvent = items[index];
          break;
        }
      }

      if (
        foundEvent &&
        foundEvent.workflow_manually_edited ===
          true
      ) {
        task.applied = true;

        task.applied_event_id =
          String(
            foundEvent.id ||
            ""
          );

        task.applied_date =
          foundDate;

        protectedCount++;
        continue;
      }

      const eventId =
        foundEvent &&
        foundEvent.id
          ? String(
              foundEvent.id
            )
          : makeId();

      if (foundEvent) {
        events[foundDate].splice(
          foundIndex,
          1
        );

        if (
          events[foundDate].length ===
          0
        ) {
          delete events[foundDate];
        }

        updated++;
      }
      else {
        created++;
      }

      if (
        !Array.isArray(
          events[task.date]
        )
      ) {
        events[task.date] = [];
      }

      events[task.date].push({
        id:
          eventId,

        channel:
          task.channel ||
          "general",

        user:
          effectiveUserId,

        text:
          buildCalendarEventText(
            task
          ),

        workflow_ai:
          true,

        source:
          "workflow_ai",

        workflow_task_id:
          task.client_id ||
          makeId(),

        workflow_rule_instance:
          stableKey,

        workflow_rule_key:
          task.rule_key ||
          "",

        workflow_job_code:
          task.job_code ||
          "",

        workflow_major_category:
          task.major_category ||
          "",

        workflow_middle_category:
          task.middle_category ||
          "",

        workflow_minor_category:
          task.minor_category ||
          "",

        workflow_recurrence:
          task.recurrence ||
          "none",

        workflow_raw_title:
          task.title,

        workflow_department_id:
          task.department_id ||
          "",

        workflow_department_name:
          task.department_name ||
          "",

        workflow_person_id:
          task.person_id ||
          "",

        workflow_person_name:
          task.person_name ||
          "",

        workflow_calendar_user_id:
          effectiveUserId,

        workflow_calendar_user_name:
          effectiveUserName,

        workflow_phase:
          task.phase ||
          "execute",

        workflow_priority:
          task.priority ||
          "medium",

        workflow_reason:
          task.reason ||
          "",

        workflow_needs_review:
          requiresReview,

        workflow_manually_edited:
          false,

        workflow_updated_at:
          new Date().toISOString()
      });

      task.applied = true;

      task.applied_event_id =
        eventId;

      task.applied_date =
        task.date;
    }

    writeJson(
      EVENT_KEY,
      events
    );

    return {
      created,
      updated,
      protectedCount,
      reviewCount
    };
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

  /* WORKFLOW_AI_ROW_EDITOR_V3 */

  function buildCalendarEventText(task) {
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

    return (
      prefix +
      " " +
      String(
        task.title ||
        ""
      ).trim()
    ).trim();
  }

  function findWorkflowEvent(
    task,
    sourceEvents = null
  ) {
    const events =
      sourceEvents ||
      readJson(
        EVENT_KEY,
        {}
      );

    const taskId =
      String(
        task.client_id ||
        ""
      );

    const appliedEventId =
      String(
        task.applied_event_id ||
        ""
      );

    for (
      const [date, items]
      of Object.entries(events)
    ) {
      if (!Array.isArray(items)) {
        continue;
      }

      const workflowIndex =
        items.findIndex(
          item =>
            taskId &&
            String(
              item.workflow_task_id ||
              ""
            ) === taskId
        );

      if (workflowIndex >= 0) {
        return {
          events,
          date,
          index:
            workflowIndex,
          event:
            items[
              workflowIndex
            ]
        };
      }

      const eventIdIndex =
        items.findIndex(
          item =>
            appliedEventId &&
            String(
              item.id ||
              ""
            ) === appliedEventId
        );

      if (eventIdIndex >= 0) {
        return {
          events,
          date,
          index:
            eventIdIndex,
          event:
            items[
              eventIdIndex
            ]
        };
      }
    }

    const legacyDate =
      String(
        task.applied_date ||
        task.date ||
        ""
      );

    const legacyItems =
      Array.isArray(
        events[legacyDate]
      )
        ? events[legacyDate]
        : [];

    const expectedText =
      buildCalendarEventText(task);

    const legacyIndex =
      legacyItems.findIndex(
        item =>
          String(
            item.user ||
            ""
          ) ===
            String(
              task.calendar_user_id ||
              ""
            ) &&
          String(
            item.channel ||
            ""
          ) ===
            String(
              task.channel ||
              ""
            ) &&
          String(
            item.text ||
            ""
          ) ===
            expectedText
      );

    if (legacyIndex >= 0) {
      return {
        events,
        date:
          legacyDate,
        index:
          legacyIndex,
        event:
          legacyItems[
            legacyIndex
          ]
      };
    }

    return null;
  }

  function syncCurrentResultWithCalendar() {
    if (
      !currentResult ||
      !Array.isArray(
        currentResult.tasks
      )
    ) {
      return;
    }

    const events =
      readJson(
        EVENT_KEY,
        {}
      );

    for (
      const task
      of currentResult.tasks
    ) {
      const linked =
        findWorkflowEvent(
          task,
          events
        );

      if (linked) {
        task.applied =
          true;

        task.applied_event_id =
          String(
            linked.event.id ||
            ""
          );

        task.applied_date =
          linked.date;

        task.date =
          linked.date;

        task.calendar_user_id =
          String(
            linked.event.user ||
            task.calendar_user_id ||
            ""
          );

        task.channel =
          String(
            linked.event.channel ||
            task.channel ||
            "general"
          );

        if (
          linked.event
            .workflow_raw_title
        ) {
          task.title =
            String(
              linked.event
                .workflow_raw_title
            );
        }

        if (
          linked.event
            .workflow_phase
        ) {
          task.phase =
            String(
              linked.event
                .workflow_phase
            );
        }

        if (
          linked.event
            .workflow_priority
        ) {
          task.priority =
            String(
              linked.event
                .workflow_priority
            );
        }
      }
      else {
        task.applied =
          false;

        task.applied_event_id =
          "";

        task.applied_date =
          "";
      }
    }

    writeJson(
      RESULT_KEY,
      currentResult
    );
  }

  function phaseOptions(
    selectedPhase
  ) {
    return Object
      .entries(
        PHASE_LABELS
      )
      .map(
        ([value, label]) => `
          <option
            value="${value}"
            ${
              value ===
              selectedPhase
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

  function priorityOptions(
    selectedPriority
  ) {
    return Object
      .entries(
        PRIORITY_LABELS
      )
      .map(
        ([value, label]) => `
          <option
            value="${value}"
            ${
              value ===
              selectedPriority
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

    const appliedCount =
      tasks.filter(
        task =>
          task.applied
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
            入力後内容修正システム
          </h3>

          <p>
            ${escapeHtml(
              currentResult.summary ||
              "業務を予定候補へ分解しました。"
            )}
          </p>

          <p class="workflow-ai-openai-edit-help">
            日付・担当者・区分・段階・優先度・内容を修正し、
            各予定の右端にあるボタンを押してください。
          </p>
        </div>

        <div class="workflow-ai-openai-kpis">
          <span>
            全 ${tasks.length}件
          </span>

          <span class="applied">
            反映済み ${appliedCount}件
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
              <th>状態</th>
              <th>日付</th>
              <th>部門・区分</th>
              <th>人物判定</th>
              <th>担当者</th>
              <th>予定区分</th>
              <th>段階</th>
              <th>優先度</th>
              <th>作業内容</th>
              <th>判断理由</th>
              <th>操作</th>
            </tr>
          </thead>

          <tbody>
            ${tasks
              .map(
                (task, index) => {
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
                          ? "needs-review "
                          : ""
                      }${
                        task.applied
                          ? "is-applied"
                          : ""
                      }"
                    >
                      <td>
                        <span class="workflow-ai-apply-state ${
                          task.applied
                            ? "applied"
                            : "pending"
                        }">
                          ${
                            task.applied
                              ? "反映済み"
                              : "未反映"
                          }
                        </span>
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
                        <select class="input-field workflow-ai-task-phase">
                          ${phaseOptions(
                            task.phase ||
                            "execute"
                          )}
                        </select>
                      </td>

                      <td>
                        <select class="input-field workflow-ai-task-priority">
                          ${priorityOptions(
                            task.priority ||
                            "medium"
                          )}
                        </select>
                      </td>

                      <td>
                        <textarea
                          class="input-field workflow-ai-task-title"
                        >${escapeHtml(
                          task.title ||
                          ""
                        )}</textarea>

                        ${
                          task.source_text
                            ? `
                              <small>
                                元の入力:
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

                      <td>
                        <div class="workflow-ai-row-actions">
                          <button
                            type="button"
                            class="workflow-ai-row-save ${
                              task.applied
                                ? "update"
                                : "apply"
                            }"
                            data-index="${index}"
                          >
                            ${
                              task.applied
                                ? "変更を保存"
                                : "カレンダーへ反映"
                            }
                          </button>

                          ${
                            task.applied
                              ? `
                                <button
                                  type="button"
                                  class="workflow-ai-row-remove"
                                  data-index="${index}"
                                >
                                  反映解除
                                </button>
                              `
                              : ""
                          }
                        </div>
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

    bindRowActions(area);
  }

  function readRowValues(index) {
    const row =
      document.querySelector(
        '.workflow-ai-openai-table tbody tr[data-index="' +
        index +
        '"]'
      );

    if (!row) {
      return null;
    }

    return {
      row,

      date:
        row
          .querySelector(
            ".workflow-ai-task-date"
          )
          .value,

      userId:
        row
          .querySelector(
            ".workflow-ai-task-user"
          )
          .value,

      channel:
        row
          .querySelector(
            ".workflow-ai-task-channel"
          )
          .value,

      phase:
        row
          .querySelector(
            ".workflow-ai-task-phase"
          )
          .value,

      priority:
        row
          .querySelector(
            ".workflow-ai-task-priority"
          )
          .value,

      title:
        row
          .querySelector(
            ".workflow-ai-task-title"
          )
          .value
          .trim()
    };
  }

  function saveTaskRow(index) {
    if (
      analyzing ||
      !currentResult ||
      !Array.isArray(
        currentResult.tasks
      )
    ) {
      return;
    }

    const task =
      currentResult.tasks[index];

    const values =
      readRowValues(index);

    if (!task || !values) {
      alert(
        "編集対象の予定が見つかりません。"
      );

      return;
    }

    if (!values.date) {
      alert(
        "日付を入力してください。"
      );

      return;
    }

    if (!values.userId) {
      alert(
        "担当者を選択してください。"
      );

      return;
    }

    if (!values.title) {
      alert(
        "作業内容を入力してください。"
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

    if (!userMap.has(values.userId)) {
      alert(
        "担当者マスタを確認してください。"
      );

      return;
    }

    const events =
      readJson(
        EVENT_KEY,
        {}
      );

    /*
      入力値でtaskを書き換える前に、
      現在紐付いているカレンダー予定を特定する。
    */
    const linked =
      findWorkflowEvent(
        task,
        events
      );

    const eventId =
      linked &&
      linked.event &&
      linked.event.id
        ? String(
            linked.event.id
          )
        : makeId();

    if (linked) {
      events[linked.date].splice(
        linked.index,
        1
      );

      if (
        events[linked.date]
          .length === 0
      ) {
        delete events[
          linked.date
        ];
      }
    }

    task.date =
      values.date;

    task.calendar_user_id =
      values.userId;

    task.calendar_user_name =
      userMap.get(
        values.userId
      ).name;

    task.channel =
      values.channel;

    task.phase =
      values.phase;

    task.priority =
      values.priority;

    task.title =
      values.title;

    task.needs_review =
      false;

    if (
      !Array.isArray(
        events[values.date]
      )
    ) {
      events[values.date] = [];
    }

    events[values.date].push({
      id:
        eventId,

      channel:
        values.channel,

      user:
        values.userId,

      text:
        buildCalendarEventText(
          task
        ),

      workflow_ai:
        true,

      source:
        "workflow_ai",

      workflow_task_id:
        task.client_id,

      workflow_raw_title:
        values.title,

      workflow_department_id:
        task.department_id ||
        "",

      workflow_department_name:
        task.department_name ||
        "",

      workflow_person_id:
        task.person_id ||
        "",

      workflow_person_name:
        task.person_name ||
        "",

      workflow_phase:
        values.phase,

      workflow_priority:
        values.priority,

      workflow_updated_at:
        new Date()
          .toISOString()
    });

    task.applied =
      true;

    task.applied_event_id =
      eventId;

    task.applied_date =
      values.date;

    writeJson(
      EVENT_KEY,
      events
    );

    writeJson(
      RESULT_KEY,
      currentResult
    );

    renderResult();

    setStatus(
      linked
        ? "予定の変更を保存しました。"
        : "予定をカレンダーへ反映しました。",
      "success"
    );
  }

  function removeTaskRow(index) {
    if (
      analyzing ||
      !currentResult ||
      !Array.isArray(
        currentResult.tasks
      )
    ) {
      return;
    }

    const task =
      currentResult.tasks[index];

    if (!task) {
      return;
    }

    const events =
      readJson(
        EVENT_KEY,
        {}
      );

    const linked =
      findWorkflowEvent(
        task,
        events
      );

    if (!linked) {
      task.applied =
        false;

      task.applied_event_id =
        "";

      task.applied_date =
        "";

      writeJson(
        RESULT_KEY,
        currentResult
      );

      renderResult();

      setStatus(
        "反映済み予定が見つからなかったため、状態だけ未反映へ戻しました。",
        "warning"
      );

      return;
    }

    if (
      !confirm(
        "この予定をカレンダーから解除しますか？\n\n" +
        String(
          task.title ||
          ""
        )
      )
    ) {
      return;
    }

    events[linked.date].splice(
      linked.index,
      1
    );

    if (
      events[linked.date]
        .length === 0
    ) {
      delete events[
        linked.date
      ];
    }

    task.applied =
      false;

    task.applied_event_id =
      "";

    task.applied_date =
      "";

    writeJson(
      EVENT_KEY,
      events
    );

    writeJson(
      RESULT_KEY,
      currentResult
    );

    renderResult();

    setStatus(
      "カレンダーへの反映を解除しました。編集内容は仕分け画面に残っています。",
      "success"
    );
  }

  function bindRowActions(area) {
    area
      .querySelectorAll(
        ".workflow-ai-row-save"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            saveTaskRow(
              Number(
                button.dataset.index
              )
            );
          }
        );
      });

    area
      .querySelectorAll(
        ".workflow-ai-row-remove"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            removeTaskRow(
              Number(
                button.dataset.index
              )
            );
          }
        );
      });
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
