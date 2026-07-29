
(function () {
  "use strict";

  if (window.__hdOriginSpecialistFullAutoSaveInstalled) {
    return;
  }

  window.__hdOriginSpecialistFullAutoSaveInstalled = true;

  let saveTimer = 0;
  let saveRunning = false;
  let saveAgain = false;
  let initialFormReady = false;
  let lastSavedAt = "";
  let lastSaveError = "";
  let activeOcrImportId = 0;
  let activeAnalysisResult = null;
  let activeAnalysisItem = null;
  let queuedSaveReason = "";
  let queuedSaveContext = null;

  function saveFunction() {
    return window.hdOriginSaveSpecialistAnalysisFromReviewPage;
  }

  function itemOcrImportId(item) {
    if (!item) {
      return 0;
    }

    try {
      if (typeof window.ocrImportIdOf === "function") {
        const windowId = Number(window.ocrImportIdOf(item)) || 0;

        if (windowId) {
          return windowId;
        }
      }
    } catch (error) {
      console.warn("window.ocrImportIdOf failed:", error);
    }

    try {
      if (typeof ocrImportIdOf === "function") {
        const localId = Number(ocrImportIdOf(item)) || 0;

        if (localId) {
          return localId;
        }
      }
    } catch (error) {
      console.warn("local ocrImportIdOf failed:", error);
    }

    return Number(
      item.paymentDocumentOcrImportId ||
      item.payment_document_ocr_import_id ||
      item.ocrImportId ||
      item.ocr_import_id ||
      item.id ||
      0
    ) || 0;
  }

  function selectedOcrId(context) {
    const contextId = Number(
      context && (
        context.ocrImportId ||
        context.paymentDocumentOcrImportId ||
        context.payment_document_ocr_import_id ||
        context.id
      )
    ) || 0;

    if (contextId) {
      activeOcrImportId = contextId;
      return contextId;
    }

    const contextItemId = itemOcrImportId(
      context && context.item
    );

    if (contextItemId) {
      activeOcrImportId = contextItemId;
      return contextItemId;
    }

    if (activeOcrImportId) {
      return activeOcrImportId;
    }

    try {
      if (
        typeof selectedIndex === "number" &&
        selectedIndex >= 0 &&
        Array.isArray(items) &&
        items[selectedIndex]
      ) {
        const selectedId = itemOcrImportId(items[selectedIndex]);

        if (selectedId) {
          activeOcrImportId = selectedId;
          return selectedId;
        }
      }
    } catch (error) {
      console.warn("HD Origin auto-save selected ID lookup failed:", error);
    }

    const checked = document.querySelector(
      "input[type='checkbox']:checked[data-payment-document-ocr-import-id]," +
      "input[type='checkbox']:checked[data-ocr-import-id]"
    );

    if (checked) {
      const checkedId = Number(
        checked.dataset.paymentDocumentOcrImportId ||
        checked.dataset.ocrImportId
      ) || 0;

      if (checkedId) {
        activeOcrImportId = checkedId;
        return checkedId;
      }
    }

    return 0;
  }

  function statusText(text, isError) {
    let el = document.getElementById("hdOriginSpecialistAutoSaveStatus");

    if (!el) {
      el = document.createElement("div");
      el.id = "hdOriginSpecialistAutoSaveStatus";
      el.setAttribute("role", "status");
      el.style.position = "fixed";
      el.style.right = "16px";
      el.style.bottom = "16px";
      el.style.zIndex = "99999";
      el.style.padding = "8px 12px";
      el.style.borderRadius = "6px";
      el.style.fontSize = "13px";
      el.style.boxShadow = "0 2px 10px rgba(0,0,0,.18)";
      document.body.appendChild(el);
    }

    el.textContent = text || "";
    el.style.background = isError ? "#fff0f0" : "#f3fff4";
    el.style.border = isError
      ? "1px solid #d33"
      : "1px solid #32964b";
    el.style.color = isError ? "#a00" : "#185c28";
  }

  async function executeSave(reason, context) {
    context = context && typeof context === "object"
      ? context
      : {};

    if (
      !context.analysisResult &&
      activeAnalysisResult
    ) {
      context.analysisResult = activeAnalysisResult;
    }

    if (
      !context.item &&
      activeAnalysisItem
    ) {
      context.item = activeAnalysisItem;
    }

    const resolvedOcrImportId = selectedOcrId(context);

    if (!resolvedOcrImportId) {
      throw new Error("保存対象のOCR取込IDを確認できません。");
    }
    const fn = saveFunction();

    if (typeof fn !== "function") {
      throw new Error("専門解析保存関数がまだ準備されていません。");
    }

    if (!selectedOcrId()) {
      throw new Error("保存対象のOCR取込IDを確認できません。");
    }

    if (saveRunning) {
      saveAgain = true;
      queuedSaveReason = reason || "human-edit";
      queuedSaveContext = context || null;
      return null;
    }

    saveRunning = true;
    saveAgain = false;

    statusText(
      reason === "analysis"
        ? "専門解析結果をDBへ保存中..."
        : "変更内容をDBへ自動保存中...",
      false
    );

    try {
      window.__hdOriginSpecialistActiveOcrImportId = resolvedOcrImportId;
      window.__hdOriginSpecialistActiveItem =
        context && context.item ? context.item : null;

      const result = await fn({
        ocrImportId: resolvedOcrImportId,
        item: context && context.item ? context.item : null,
        analysisResult:
          context && context.analysisResult
            ? context.analysisResult
            : null
      });

      lastSavedAt = new Date().toISOString();
      lastSaveError = "";

      statusText(
        reason === "analysis"
          ? "専門解析結果をDBへ保存しました"
          : "変更内容を自動保存しました",
        false
      );

      console.log("HD Origin specialist auto-save succeeded:", {
        reason,
        result,
        savedAt: lastSavedAt
      });

      return result;
    } catch (error) {
      lastSaveError =
        error && error.message
          ? error.message
          : String(error);

      statusText(
        "DB自動保存失敗: " + lastSaveError,
        true
      );

      console.error("HD Origin specialist auto-save failed:", {
        reason,
        error
      });

      throw error;
    } finally {
      saveRunning = false;

      if (saveAgain) {
        saveAgain = false;

        const nextReason = queuedSaveReason || "human-edit";
        const nextContext = queuedSaveContext;

        queuedSaveReason = "";
        queuedSaveContext = null;

        window.setTimeout(function () {
          executeSave(nextReason, nextContext).catch(function () {});
        }, 100);
      }
    }
  }

  window.hdOriginSpecialistAutoSaveNow = function (reason, context) {
    context = context && typeof context === "object"
      ? context
      : {};

    if (
      context.analysisResult &&
      typeof context.analysisResult === "object"
    ) {
      activeAnalysisResult = context.analysisResult;
    }

    if (
      context.item &&
      typeof context.item === "object"
    ) {
      activeAnalysisItem = context.item;
    }

    if (saveTimer) {
      window.clearTimeout(saveTimer);
      saveTimer = 0;
    }

    return executeSave(reason || "manual", context || null);
  };

  function scheduleHumanSave() {
    if (!initialFormReady) {
      return;
    }

    if (saveTimer) {
      window.clearTimeout(saveTimer);
    }

    statusText("変更を検知しました。自動保存待ち...", false);

    saveTimer = window.setTimeout(function () {
      saveTimer = 0;

      executeSave("human-edit", {
        ocrImportId: activeOcrImportId,
        analysisResult: activeAnalysisResult,
        item: activeAnalysisItem
      }).catch(function () {});
    }, 1000);
  }

  function isEditableAnalysisField(target) {
    if (!target || !target.matches) {
      return false;
    }

    if (!target.matches(
      ".analysis-field, .master-select, " +
      ".analysis-panel input, .analysis-panel select, .analysis-panel textarea"
    )) {
      return false;
    }

    if (
      target.disabled ||
      target.readOnly ||
      target.type === "button" ||
      target.type === "submit"
    ) {
      return false;
    }

    return true;
  }

  document.addEventListener("input", function (event) {
    if (!event.isTrusted) {
      return;
    }

    if (isEditableAnalysisField(event.target)) {
      scheduleHumanSave();
    }
  }, true);

  document.addEventListener("change", function (event) {
    if (!event.isTrusted) {
      return;
    }

    if (isEditableAnalysisField(event.target)) {
      scheduleHumanSave();
    }
  }, true);

  window.addEventListener("beforeunload", function (event) {
    if (!saveTimer && !saveRunning) {
      return;
    }

    event.preventDefault();
    event.returnValue = "";
  });

  window.setTimeout(function () {
    initialFormReady = true;
  }, 1500);

  window.hdOriginSpecialistAutoSaveState = function () {
    return {
      saveRunning,
      saveAgain,
      pending: !!saveTimer,
      lastSavedAt,
      lastSaveError,
      selectedOcrId: selectedOcrId(null)
    };
  };

  console.log("HD Origin specialist full auto-save installed.");
})();
