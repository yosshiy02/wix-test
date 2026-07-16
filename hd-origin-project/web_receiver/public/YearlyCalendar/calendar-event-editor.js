(() => {
  "use strict";

  if (window.__hdCalendarEventEditorInstalled) {
    return;
  }

  window.__hdCalendarEventEditorInstalled = true;

  const EVENT_KEY = "teamEventsMulti";
  const USER_KEY = "teamCalendarUsers";
  const STATUS_KEY = "hdEventStatusMap";

  const CHANNELS = {
    general: "全般",
    accounting: "総務・経理",
    sales: "営業・商談",
    event: "出店・イベント",
    manufacture: "製造"
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

  let editingDate = "";
  let editingId = "";

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);

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

  function makeId() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      return window.crypto.randomUUID();
    }

    return (
      "event_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 10)
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

  function getUsers() {
    const stored = readJson(
      USER_KEY,
      []
    );

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
        id: String(user.id || "").trim(),
        name: String(
          user.name ||
          user.id ||
          ""
        ).trim()
      }))
      .filter(user =>
        user.id &&
        user.name
      );
  }

  function dateFromMainModal() {
    const title =
      document.getElementById(
        "modalDateTitle"
      );

    const text =
      String(
        title
          ? title.textContent
          : ""
      ).trim();

    if (
      text.includes("〜") ||
      text.includes("～")
    ) {
      return "";
    }

    const match =
      text.match(
        /(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/
      );

    if (!match) {
      return "";
    }

    return (
      match[1] +
      "-" +
      String(match[2]).padStart(2, "0") +
      "-" +
      String(match[3]).padStart(2, "0")
    );
  }

  function findEvent(date, id) {
    const events =
      readJson(
        EVENT_KEY,
        {}
      );

    const items =
      Array.isArray(events[date])
        ? events[date]
        : [];

    const event =
      items.find(item =>
        String(item.id) ===
        String(id)
      );

    return {
      events,
      event
    };
  }

  function ensureModal() {
    if (
      document.getElementById(
        "calendarEventEditorModal"
      )
    ) {
      return;
    }

    const modal =
      document.createElement(
        "div"
      );

    modal.id =
      "calendarEventEditorModal";

    modal.className =
      "calendar-event-editor-modal";

    modal.innerHTML = `
      <div
        class="calendar-event-editor-box"
        role="dialog"
        aria-modal="true"
        aria-labelledby="calendarEventEditorTitle"
      >
        <header class="calendar-event-editor-header">
          <div>
            <h2 id="calendarEventEditorTitle">
              ✏️ 予定を編集
            </h2>

            <p>
              OpenAIから反映した予定も、通常予定も編集できます。
            </p>
          </div>

          <button
            id="calendarEventEditorClose"
            type="button"
            class="calendar-event-editor-close"
            aria-label="閉じる"
          >
            ✕
          </button>
        </header>

        <div class="calendar-event-editor-body">
          <label>
            日付
            <input
              id="calendarEventEditorDate"
              type="date"
              class="input-field"
            >
          </label>

          <div class="calendar-event-editor-grid">
            <label>
              担当者
              <select
                id="calendarEventEditorUser"
                class="input-field"
              ></select>
            </label>

            <label>
              予定区分
              <select
                id="calendarEventEditorChannel"
                class="input-field"
              >
                ${Object.entries(CHANNELS)
                  .map(
                    ([value, label]) => `
                      <option value="${value}">
                        ${escapeHtml(label)}
                      </option>
                    `
                  )
                  .join("")}
              </select>
            </label>
          </div>

          <label>
            予定内容
            <textarea
              id="calendarEventEditorText"
              class="input-field calendar-event-editor-text"
            ></textarea>
          </label>

          <div
            id="calendarEventEditorInfo"
            class="calendar-event-editor-info"
          ></div>
        </div>

        <footer class="calendar-event-editor-footer">
          <button
            id="calendarEventEditorDelete"
            type="button"
            class="calendar-event-editor-delete"
          >
            削除
          </button>

          <button
            id="calendarEventEditorDuplicate"
            type="button"
            class="calendar-event-editor-duplicate"
          >
            複製
          </button>

          <button
            id="calendarEventEditorCancel"
            type="button"
            class="btn-cancel"
          >
            キャンセル
          </button>

          <button
            id="calendarEventEditorSave"
            type="button"
            class="btn-save"
          >
            変更を保存
          </button>
        </footer>
      </div>
    `;

    document.body.appendChild(
      modal
    );

    document
      .getElementById(
        "calendarEventEditorClose"
      )
      .addEventListener(
        "click",
        closeEditor
      );

    document
      .getElementById(
        "calendarEventEditorCancel"
      )
      .addEventListener(
        "click",
        closeEditor
      );

    document
      .getElementById(
        "calendarEventEditorSave"
      )
      .addEventListener(
        "click",
        saveEditor
      );

    document
      .getElementById(
        "calendarEventEditorDelete"
      )
      .addEventListener(
        "click",
        deleteEditor
      );

    document
      .getElementById(
        "calendarEventEditorDuplicate"
      )
      .addEventListener(
        "click",
        duplicateEditor
      );

    modal.addEventListener(
      "click",
      event => {
        if (event.target === modal) {
          closeEditor();
        }
      }
    );
  }

  function openEditor(date, id) {
    ensureModal();

    const found =
      findEvent(
        date,
        id
      );

    if (!found.event) {
      alert(
        "編集対象の予定が見つかりません。"
      );

      return;
    }

    editingDate =
      date;

    editingId =
      String(id);

    const users =
      getUsers();

    const userSelect =
      document.getElementById(
        "calendarEventEditorUser"
      );

    userSelect.innerHTML =
      users
        .map(
          user => `
            <option
              value="${escapeHtml(user.id)}"
              ${
                user.id ===
                found.event.user
                  ? "selected"
                  : ""
              }
            >
              ${escapeHtml(user.name)}
            </option>
          `
        )
        .join("");

    document
      .getElementById(
        "calendarEventEditorDate"
      )
      .value =
        date;

    document
      .getElementById(
        "calendarEventEditorChannel"
      )
      .value =
        found.event.channel ||
        "general";

    document
      .getElementById(
        "calendarEventEditorText"
      )
      .value =
        found.event.text ||
        "";

    const sourceLabel =
      found.event.workflow_ai === true ||
      found.event.source ===
        "workflow_ai"
        ? "OpenAI反映予定"
        : "カレンダー予定";

    document
      .getElementById(
        "calendarEventEditorInfo"
      )
      .textContent =
        sourceLabel +
        " / 予定ID: " +
        editingId;

    document
      .getElementById(
        "calendarEventEditorModal"
      )
      .classList
      .add("active");

    setTimeout(
      () => {
        document
          .getElementById(
            "calendarEventEditorText"
          )
          .focus();
      },
      50
    );
  }

  function closeEditor() {
    const modal =
      document.getElementById(
        "calendarEventEditorModal"
      );

    if (modal) {
      modal.classList.remove(
        "active"
      );
    }

    editingDate = "";
    editingId = "";
  }

  function saveEditor() {
    if (
      !editingDate ||
      !editingId
    ) {
      return;
    }

    const newDate =
      document
        .getElementById(
          "calendarEventEditorDate"
        )
        .value;

    const newUser =
      document
        .getElementById(
          "calendarEventEditorUser"
        )
        .value;

    const newChannel =
      document
        .getElementById(
          "calendarEventEditorChannel"
        )
        .value;

    const newText =
      document
        .getElementById(
          "calendarEventEditorText"
        )
        .value
        .trim();

    if (!newDate) {
      alert(
        "日付を入力してください。"
      );

      return;
    }

    if (!newUser) {
      alert(
        "担当者を選択してください。"
      );

      return;
    }

    if (!CHANNELS[newChannel]) {
      alert(
        "予定区分を確認してください。"
      );

      return;
    }

    if (!newText) {
      alert(
        "予定内容を入力してください。"
      );

      return;
    }

    const found =
      findEvent(
        editingDate,
        editingId
      );

    if (!found.event) {
      alert(
        "編集対象の予定が見つかりません。"
      );

      return;
    }

    const events =
      found.events;

    events[editingDate] =
      events[editingDate]
        .filter(item =>
          String(item.id) !==
          editingId
        );

    if (
      events[editingDate].length === 0
    ) {
      delete events[editingDate];
    }

    if (
      !Array.isArray(
        events[newDate]
      )
    ) {
      events[newDate] = [];
    }

    events[newDate].push({
      ...found.event,

      id:
        editingId,

      channel:
        newChannel,

      user:
        newUser,

      text:
        newText,

      workflow_manually_edited:
        true,

      edited_at:
        new Date().toISOString()
    });

    writeJson(
      EVENT_KEY,
      events
    );

    alert(
      "予定を更新しました。"
    );

    window.location.reload();
  }

  function deleteEditor() {
    if (
      !editingDate ||
      !editingId
    ) {
      return;
    }

    const found =
      findEvent(
        editingDate,
        editingId
      );

    if (!found.event) {
      alert(
        "削除対象の予定が見つかりません。"
      );

      return;
    }

    if (
      !confirm(
        "この予定を削除しますか？\n\n" +
        String(
          found.event.text ||
          ""
        )
      )
    ) {
      return;
    }

    found.events[editingDate] =
      found.events[editingDate]
        .filter(item =>
          String(item.id) !==
          editingId
        );

    if (
      found.events[editingDate]
        .length === 0
    ) {
      delete found.events[
        editingDate
      ];
    }

    writeJson(
      EVENT_KEY,
      found.events
    );

    const statusMap =
      readJson(
        STATUS_KEY,
        {}
      );

    if (
      Object.prototype.hasOwnProperty.call(
        statusMap,
        editingId
      )
    ) {
      delete statusMap[editingId];

      writeJson(
        STATUS_KEY,
        statusMap
      );
    }

    alert(
      "予定を削除しました。"
    );

    window.location.reload();
  }

  function duplicateEditor() {
    if (
      !editingDate ||
      !editingId
    ) {
      return;
    }

    const found =
      findEvent(
        editingDate,
        editingId
      );

    if (!found.event) {
      alert(
        "複製対象の予定が見つかりません。"
      );

      return;
    }

    const destinationDate =
      document
        .getElementById(
          "calendarEventEditorDate"
        )
        .value ||
      editingDate;

    const user =
      document
        .getElementById(
          "calendarEventEditorUser"
        )
        .value ||
      found.event.user;

    const channel =
      document
        .getElementById(
          "calendarEventEditorChannel"
        )
        .value ||
      found.event.channel;

    const text =
      document
        .getElementById(
          "calendarEventEditorText"
        )
        .value
        .trim() ||
      found.event.text;

    if (
      !Array.isArray(
        found.events[destinationDate]
      )
    ) {
      found.events[destinationDate] = [];
    }

    found.events[destinationDate].push({
      ...found.event,

      id:
        makeId(),

      channel,
      user,
      text,

      copied_from_id:
        editingId,

      copied_at:
        new Date().toISOString()
    });

    writeJson(
      EVENT_KEY,
      found.events
    );

    alert(
      "予定を複製しました。"
    );

    window.location.reload();
  }

  function makeInlineButton(
    label,
    className
  ) {
    const button =
      document.createElement(
        "button"
      );

    button.type =
      "button";

    button.className =
      className;

    button.textContent =
      label;

    return button;
  }

  function enhanceEventList() {
    const list =
      document.getElementById(
        "modalEventList"
      );

    if (!list) {
      return;
    }

    const date =
      dateFromMainModal();

    if (!date) {
      return;
    }

    list
      .querySelectorAll(
        ".modal-event-item"
      )
      .forEach(item => {
        if (
          item.dataset
            .calendarEditorEnhanced ===
          "1"
        ) {
          return;
        }

        const deleteButton =
          item.querySelector(
            ".delete-btn-small[data-id]"
          );

        if (!deleteButton) {
          return;
        }

        const id =
          deleteButton.dataset.id;

        if (!id) {
          return;
        }

        item.dataset
          .calendarEditorEnhanced =
          "1";

        item.classList.add(
          "calendar-event-editor-ready"
        );

        const actions =
          document.createElement(
            "div"
          );

        actions.className =
          "calendar-event-inline-actions";

        const editButton =
          makeInlineButton(
            "✏️ 編集",
            "calendar-event-inline-edit"
          );

        const duplicateButton =
          makeInlineButton(
            "📄 複製",
            "calendar-event-inline-copy"
          );

        editButton.addEventListener(
          "click",
          event => {
            event.preventDefault();
            event.stopPropagation();

            openEditor(
              dateFromMainModal() ||
              date,
              id
            );
          }
        );

        duplicateButton.addEventListener(
          "click",
          event => {
            event.preventDefault();
            event.stopPropagation();

            openEditor(
              dateFromMainModal() ||
              date,
              id
            );

            setTimeout(
              () => {
                duplicateEditor();
              },
              20
            );
          }
        );

        deleteButton.title =
          "予定を削除";

        deleteButton.textContent =
          "🗑";

        if (deleteButton.parentNode) {
          deleteButton.parentNode.insertBefore(
            actions,
            deleteButton
          );

          actions.appendChild(
            editButton
          );

          actions.appendChild(
            duplicateButton
          );

          actions.appendChild(
            deleteButton
          );
        }

        item.addEventListener(
          "dblclick",
          event => {
            if (
              event.target.closest(
                "button"
              )
            ) {
              return;
            }

            openEditor(
              dateFromMainModal() ||
              date,
              id
            );
          }
        );
      });
  }

  function installObserver() {
    const list =
      document.getElementById(
        "modalEventList"
      );

    if (!list) {
      return;
    }

    new MutationObserver(
      enhanceEventList
    ).observe(
      list,
      {
        childList: true,
        subtree: true
      }
    );

    enhanceEventList();
  }

  document.addEventListener(
    "keydown",
    event => {
      if (
        event.key === "Escape"
      ) {
        closeEditor();
      }
    }
  );

  document.addEventListener(
    "DOMContentLoaded",
    () => {
      ensureModal();
      installObserver();
    }
  );
})();
