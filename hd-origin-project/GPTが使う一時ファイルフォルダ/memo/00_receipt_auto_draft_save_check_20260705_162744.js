
    /* RECEIPT_AUTO_DRAFT_SAVE_20260705_START */
    /*
      画面変更時の下書き自動保存。
      - 保存ボタンは本保存用にする前提なので、ここでは押させない。
      - input / select / textarea の変更を拾い、現在の下書きへ静かにPATCHする。
      - 明細内訳モーダルは既存の saveTaxBreakdownsForCurrentDraft を使う。
      - アラートは出さず、右下に状態だけ出す。
    */
    let receiptAutoDraftSaveTimer = null;
    let receiptAutoDraftSaveRunning = false;
    let receiptAutoDraftSaveQueued = false;
    let receiptAutoDraftSaveLastJson = "";

    let receiptAutoTaxSaveTimer = null;
    let receiptAutoTaxSaveRunning = false;
    let receiptAutoTaxSaveQueued = false;

    function ensureReceiptAutoSaveStatus() {
      let el = document.getElementById("receiptAutoSaveStatus");
      if (el) return el;

      el = document.createElement("div");
      el.id = "receiptAutoSaveStatus";
      el.style.position = "fixed";
      el.style.right = "0.75rem";
      el.style.bottom = "0.75rem";
      el.style.zIndex = "100001";
      el.style.padding = "0.4rem 0.65rem";
      el.style.borderRadius = "0.45rem";
      el.style.border = "0.0625rem solid #bbb";
      el.style.background = "#ffffff";
      el.style.color = "#333";
      el.style.fontSize = "0.75rem";
      el.style.fontWeight = "800";
      el.style.boxShadow = "0 0.25rem 0.8rem rgba(0,0,0,0.18)";
      el.style.display = "none";
      document.body.appendChild(el);

      return el;
    }

    function setReceiptAutoSaveStatus(text, kind) {
      const el = ensureReceiptAutoSaveStatus();
      el.textContent = String(text || "");
      el.style.display = text ? "block" : "none";

      if (kind === "error") {
        el.style.borderColor = "#d95c5c";
        el.style.background = "#ffe8e8";
        el.style.color = "#8a1f1f";
      } else if (kind === "saving") {
        el.style.borderColor = "#d6a100";
        el.style.background = "#fff7d6";
        el.style.color = "#6b5000";
      } else {
        el.style.borderColor = "#72b979";
        el.style.background = "#ecffef";
        el.style.color = "#0f5f1d";
      }
    }

    function getReceiptAutoSaveDraftId() {
      if (!currentDraft || !currentDraft.id) return null;

      const id = Number(currentDraft.id);
      if (!Number.isFinite(id) || id <= 0) return null;

      return id;
    }

    function queueReceiptDraftAutoSave(reason) {
      const draftId = getReceiptAutoSaveDraftId();
      if (!draftId) return;

      const receiptId = Number(selectedId || 0);

      clearTimeout(receiptAutoDraftSaveTimer);
      setReceiptAutoSaveStatus("下書き保存待ち", "saving");

      receiptAutoDraftSaveTimer = setTimeout(function () {
        runReceiptDraftAutoSave(draftId, receiptId, reason || "change");
      }, 700);
    }

    async function runReceiptDraftAutoSave(draftId, receiptId, reason) {
      if (!draftId) return;

      if (!currentDraft || Number(currentDraft.id) !== Number(draftId)) {
        return;
      }

      if (Number(selectedId || 0) !== Number(receiptId || 0)) {
        return;
      }

      if (receiptAutoDraftSaveRunning) {
        receiptAutoDraftSaveQueued = true;
        return;
      }

      let payload;

      try {
        payload = collectDraftPayload();
      } catch (error) {
        setReceiptAutoSaveStatus("下書き保存失敗", "error");
        console.error("collectDraftPayload failed", error);
        return;
      }

      const json = JSON.stringify(payload);

      if (json === receiptAutoDraftSaveLastJson) {
        setReceiptAutoSaveStatus("下書き保存済", "ok");
        return;
      }

      receiptAutoDraftSaveRunning = true;
      receiptAutoDraftSaveQueued = false;
      setReceiptAutoSaveStatus("下書き保存中", "saving");

      try {
        const res = await fetch("/api/receipts/ai-drafts/" + encodeURIComponent(draftId), {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json; charset=utf-8"
          },
          body: json
        });

        const data = await res.json().catch(function () {
          return { ok: false, error: "JSON読込失敗" };
        });

        if (!res.ok || !data.ok) {
          throw new Error(data.error || "下書き保存に失敗しました。");
        }

        receiptAutoDraftSaveLastJson = json;

        if (data.draft) {
          currentDraft = Object.assign({}, currentDraft || {}, data.draft);
        }

        setReceiptAutoSaveStatus("下書き保存済", "ok");
      } catch (error) {
        setReceiptAutoSaveStatus("下書き保存失敗", "error");
        console.error("receipt auto draft save failed", error);
      } finally {
        receiptAutoDraftSaveRunning = false;

        if (receiptAutoDraftSaveQueued) {
          receiptAutoDraftSaveQueued = false;
          setTimeout(function () {
            runReceiptDraftAutoSave(draftId, receiptId, reason || "queued");
          }, 250);
        }
      }
    }

    function queueReceiptTaxBreakdownAutoSave() {
      if (typeof saveTaxBreakdownsForCurrentDraft !== "function") return;
      if (typeof updateTaxBreakdown !== "function") return;
      if (!currentReceiptAiDraftId) return;

      const draftId = Number(currentReceiptAiDraftId || 0);
      clearTimeout(receiptAutoTaxSaveTimer);
      setReceiptAutoSaveStatus("明細内訳保存待ち", "saving");

      receiptAutoTaxSaveTimer = setTimeout(function () {
        runReceiptTaxBreakdownAutoSave(draftId);
      }, 700);
    }

    async function runReceiptTaxBreakdownAutoSave(draftId) {
      if (!draftId) return;
      if (Number(currentReceiptAiDraftId || 0) !== Number(draftId)) return;

      if (receiptAutoTaxSaveRunning) {
        receiptAutoTaxSaveQueued = true;
        return;
      }

      receiptAutoTaxSaveRunning = true;
      receiptAutoTaxSaveQueued = false;
      setReceiptAutoSaveStatus("明細内訳保存中", "saving");

      try {
        updateTaxBreakdown();
        await saveTaxBreakdownsForCurrentDraft();
        setReceiptAutoSaveStatus("明細内訳保存済", "ok");
      } catch (error) {
        setReceiptAutoSaveStatus("明細内訳保存失敗", "error");
        console.error("receipt tax breakdown auto save failed", error);
      } finally {
        receiptAutoTaxSaveRunning = false;

        if (receiptAutoTaxSaveQueued) {
          receiptAutoTaxSaveQueued = false;
          setTimeout(function () {
            runReceiptTaxBreakdownAutoSave(draftId);
          }, 250);
        }
      }
    }

    function handleReceiptAutoSaveEvent(event) {
      const target = event && event.target ? event.target : null;
      if (!target || !target.closest) return;

      const tag = String(target.tagName || "").toUpperCase();
      if (!["INPUT", "SELECT", "TEXTAREA"].includes(tag)) return;

      if (target.id === "receiptCopySystemText") return;
      if (target.classList && target.classList.contains("receipt-ai-check")) return;

      if (target.closest("#taxBreakdownModal")) {
        queueReceiptTaxBreakdownAutoSave();
        return;
      }

      if (!target.closest("#formArea")) return;

      queueReceiptDraftAutoSave(event.type || "change");
    }

    function installReceiptAutoDraftSave() {
      if (window.receiptAutoDraftSaveInstalled) return;
      window.receiptAutoDraftSaveInstalled = true;

      document.addEventListener("input", handleReceiptAutoSaveEvent);
      document.addEventListener("change", handleReceiptAutoSaveEvent);
    }

    installReceiptAutoDraftSave();
    /* RECEIPT_AUTO_DRAFT_SAVE_20260705_END */

