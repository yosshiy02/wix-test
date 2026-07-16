(() => {
  "use strict";

  if (
    window.__hdWorkflowSimpleUpdateInstalled
  ) {
    return;
  }

  window.__hdWorkflowSimpleUpdateInstalled =
    true;

  const PROMPTS = {
    accounting_office: {
      label:
        "会計・事務業務",

      description:
        "入力した会計・事務予定だけを解析",

      text:
        ""
    },

    sales: {
      label:
        "営業・商談",

      description:
        "営業予定、顧客対応、見積、商談などを解析",

      text:
        "営業・商談業務です。入力された内容に明示されている予定だけを解析し、年間カレンダーへ反映してください。毎月または年間の予定は対象年の全月へ具体的な日付で展開してください。入力にない準備、確認、連絡、作業工程を勝手に追加してはいけません。"
    },

    manufacturing: {
      label:
        "製造・検品・納期",

      description:
        "製造、検品、出荷、納期などを解析",

      text:
        "製造・検品・納期業務です。入力された内容に明示されている予定だけを解析し、年間カレンダーへ反映してください。毎月または年間の予定は対象年の全月へ具体的な日付で展開してください。入力にない製造工程、検品工程、準備工程を勝手に追加してはいけません。"
    },

    event: {
      label:
        "出店・イベント・遠征",

      description:
        "出店、イベント、移動、遠征予定などを解析",

      text:
        "出店・イベント・遠征業務です。入力された内容に明示されている予定だけを解析し、年間カレンダーへ反映してください。毎月または年間の予定は対象年の全月へ具体的な日付で展開してください。入力にない移動、準備、撤収、作業工程を勝手に追加してはいけません。"
    },

    free: {
      label:
        "自由入力",

      description:
        "業務内容を直接入力して解析",

      text:
        ""
    }
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function promptOptions() {
    return Object
      .entries(PROMPTS)
      .map(
        ([value, item]) => `
          <option value="${escapeHtml(value)}">
            ${escapeHtml(item.label)}
          </option>
        `
      )
      .join("");
  }

  function selectedPrompt() {
    const select =
      document.getElementById(
        "workflowAiPromptSelect"
      );

    return PROMPTS[
      select
        ? select.value
        : "accounting_office"
    ] || PROMPTS.payroll;
  }

  function updatePromptHelp() {
    const help =
      document.getElementById(
        "workflowAiPromptHelp"
      );

    if (!help) {
      return;
    }

    help.textContent =
      selectedPrompt().description;
  }

  function applySelectedPrompt(
    force = false
  ) {
    const textarea =
      document.getElementById(
        "workflowAiText"
      );

    if (!textarea) {
      return;
    }

    const item =
      selectedPrompt();

    if (
      item === PROMPTS.free
    ) {
      if (force) {
        textarea.value = "";
      }

      textarea.placeholder =
        "実施したい業務、日付、周期、担当者、会社独自ルールなどを入力してください。";

      textarea.focus();
      return;
    }

    if (
      force ||
      !textarea.value.trim() ||
      textarea.dataset
        .simplePromptApplied ===
        "1"
    ) {
      textarea.value =
        item.text;

      textarea.dataset
        .simplePromptApplied =
        "1";
    }

    textarea.placeholder =
      "選択した業務プロンプトへ、会社独自の締切、担当者、休日処理などを追記できます。";
  }

  function toggleDetails() {
    const result =
      document.getElementById(
        "workflowAiResult"
      );

    const button =
      document.getElementById(
        "workflowAiDetailToggle"
      );

    if (
      !result ||
      !button
    ) {
      return;
    }

    const isOpen =
      result.classList.toggle(
        "simple-details-open"
      );

    button.textContent =
      isOpen
        ? "詳細を閉じる"
        : "解析内容の詳細を見る";

    button.setAttribute(
      "aria-expanded",
      String(isOpen)
    );
  }

  function updateLabels() {
    document
      .querySelectorAll(
        ".workflow-ai-openai-btn"
      )
      .forEach(button => {
        button.textContent =
          "業務フローAI更新";
      });

    const title =
      document.querySelector(
        ".workflow-ai-openai-header h2"
      );

    if (
      title &&
      title.textContent !==
        "カレンダー自動更新"
    ) {
      title.textContent =
        "カレンダー自動更新";
    }

    const headerText =
      document.querySelector(
        ".workflow-ai-openai-header p"
      );

    if (
      headerText &&
      headerText.textContent !==
        "業務を選び、必要な補足を書いて、更新ボタンを押してください。AIが必要な工程を判断してカレンダーへ反映します。"
    ) {
      headerText.textContent =
        "業務を選び、必要な補足を書いて、更新ボタンを押してください。AIが必要な工程を判断してカレンダーへ反映します。";
    }

    const analyzeButton =
      document.getElementById(
        "workflowAiAnalyzeBtn"
      );

    if (
      analyzeButton &&
      !analyzeButton.disabled &&
      analyzeButton.textContent !==
        "AIで解析してカレンダーを更新"
    ) {
      analyzeButton.textContent =
        "AIで解析してカレンダーを更新";
    }
  }

  function installSimpleUi() {
    updateLabels();

    const textarea =
      document.getElementById(
        "workflowAiText"
      );

    if (!textarea) {
      return false;
    }

    const inputPanel =
      textarea.closest(
        ".workflow-ai-openai-input-panel"
      );

    if (!inputPanel) {
      return false;
    }

    if (
      document.getElementById(
        "workflowAiPromptSelect"
      )
    ) {
      return true;
    }

    const textLabel =
      textarea.closest("label");

    if (textLabel) {
      const labelText =
        Array.from(
          textLabel.childNodes
        ).find(
          node =>
            node.nodeType ===
            Node.TEXT_NODE &&
            node.textContent.trim()
        );

      if (labelText) {
        labelText.textContent =
          "補足・会社独自ルール ";
      }
    }

    const selectorArea =
      document.createElement(
        "section"
      );

    selectorArea.className =
      "workflow-ai-simple-selector";

    selectorArea.innerHTML = `
      <div class="workflow-ai-simple-step">
        <span>1</span>

        <div>
          <strong>
            業務プロンプトを選択
          </strong>

          <small>
            AIへ任せる業務の種類を選びます
          </small>
        </div>
      </div>

      <label class="workflow-ai-simple-select-label">
        業務の種類

        <select
          id="workflowAiPromptSelect"
          class="input-field workflow-ai-simple-select"
        >
          ${promptOptions()}
        </select>
      </label>

      <div
        id="workflowAiPromptHelp"
        class="workflow-ai-simple-help"
      ></div>

      <div class="workflow-ai-simple-flow">
        <span>
          ① 業務を選ぶ
        </span>

        <b>→</b>

        <span>
          ② 必要なら補足
        </span>

        <b>→</b>

        <span>
          ③ カレンダー更新
        </span>
      </div>
    `;

    if (textLabel) {
      inputPanel.insertBefore(
        selectorArea,
        textLabel
      );
    }
    else {
      inputPanel.insertBefore(
        selectorArea,
        textarea
      );
    }

    if (textLabel) {
      const step =
        document.createElement(
          "div"
        );

      step.className =
        "workflow-ai-simple-step workflow-ai-simple-step-two";

      step.innerHTML = `
        <span>2</span>

        <div>
          <strong>
            必要な場合だけ補足
          </strong>

          <small>
            日付、担当者、締切、休日処理などを追記できます
          </small>
        </div>
      `;

      inputPanel.insertBefore(
        step,
        textLabel
      );
    }

    const actions =
      document.querySelector(
        ".workflow-ai-openai-actions"
      );

    if (actions) {
      const actionStep =
        document.createElement(
          "div"
        );

      actionStep.className =
        "workflow-ai-simple-step workflow-ai-simple-step-three";

      actionStep.innerHTML = `
        <span>3</span>

        <div>
          <strong>
            カレンダーを更新
          </strong>

          <small>
            新規登録、既存更新、人間修正の保護を自動で行います
          </small>
        </div>
      `;

      actions.parentNode.insertBefore(
        actionStep,
        actions
      );
    }

    const result =
      document.getElementById(
        "workflowAiResult"
      );

    if (result) {
      const detailButton =
        document.createElement(
          "button"
        );

      detailButton.id =
        "workflowAiDetailToggle";

      detailButton.type =
        "button";

      detailButton.className =
        "workflow-ai-simple-detail-toggle";

      detailButton.textContent =
        "解析内容の詳細を見る";

      detailButton.setAttribute(
        "aria-expanded",
        "false"
      );

      detailButton.addEventListener(
        "click",
        toggleDetails
      );

      result.parentNode.insertBefore(
        detailButton,
        result
      );
    }

    const select =
      document.getElementById(
        "workflowAiPromptSelect"
      );

    select.addEventListener(
      "change",
      () => {
        updatePromptHelp();
        applySelectedPrompt(true);
      }
    );

    textarea.addEventListener(
      "input",
      () => {
        textarea.dataset
          .simplePromptApplied =
          "0";
      }
    );

    updatePromptHelp();
    applySelectedPrompt(false);
    updateLabels();

    return true;
  }

  function installWhenReady() {
    if (installSimpleUi()) {
      return;
    }

    let attempts = 0;

    const timer =
      window.setInterval(
        () => {
          attempts++;

          if (
            installSimpleUi() ||
            attempts >= 80
          ) {
            window.clearInterval(
              timer
            );
          }
        },
        100
      );
  }

  const simpleUiObserver =
    new MutationObserver(
      () => {
        if (installSimpleUi()) {
          simpleUiObserver.disconnect();
        }
      }
    );

  simpleUiObserver.observe(
    document.documentElement,
    {
      childList: true,
      subtree: true
    }
  );

  document.addEventListener(
    "DOMContentLoaded",
    installWhenReady
  );

  if (
    document.readyState !==
    "loading"
  ) {
    installWhenReady();
  }
})();