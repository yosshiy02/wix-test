    /* RECEIPT_POST_SAVE_HTML_20260705_START */
    async function flushCurrentReceiptDraftBeforePost(ids) {
      const list = Array.isArray(ids) ? ids.map((id) => Number(id)) : [];

      if (!list.includes(Number(selectedId || 0))) {
        return;
      }

      if (!currentDraft || !currentDraft.id) {
        return;
      }

      try {
        const payload = collectDraftPayload();
        await patchDraftForBulk(currentDraft.id, payload);
      } catch (error) {
        throw new Error("現在表示中の下書き自動保存に失敗しました: " + (error && error.message ? error.message : error));
      }
    }

    async function bulkPostReceiptImports(ids) {
      const res = await fetch("/api/receipts/imports/bulk-post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify({
          receiptImportIds: ids
        })
      });

      const data = await res.json().catch(() => {
        return { ok: false, error: "JSON読込失敗" };
      });

      if (!res.ok) {
        throw new Error(data.error || "本保存APIが失敗しました。");
      }

      return data;
    }

    function buildBulkPostResultText(data) {
      const summary = data.summary || {};
      const results = Array.isArray(data.results) ? data.results : [];
      const failed = results.filter((row) => !row.ok);
      const already = results.filter((row) => row.ok && row.already_saved);

      const lines = [];
      lines.push("本保存結果");
      lines.push("");
      lines.push("対象: " + (summary.total ?? results.length) + " 件");
      lines.push("成功: " + (summary.success ?? 0) + " 件");
      lines.push("既に本保存済み: " + (summary.already_saved ?? already.length) + " 件");
      lines.push("失敗: " + (summary.failed ?? failed.length) + " 件");

      if (failed.length) {
        lines.push("");
        lines.push("失敗内容:");
        failed.forEach((row) => {
          lines.push("- ID " + (row.receipt_import_id || "") + ": " + (row.message || row.reason || "失敗"));
        });
      }

      return lines.join("\n");
    }

    async function bulkSaveCheckedReceipts() {
      const ids = getSelectedBulkReceiptIdsInListOrder();

      if (!ids.length) {
        await receiptAlert("本保存するレシートにチェックを入れてください。", "まとめて本保存");
        return;
      }

      if (!(await receiptConfirm(
        "チェックした " + ids.length + " 件を本保存します。\n\n下書きは削除せず、本保存済みとして記録します。\n既に本保存済みのものは二重登録しません。\n\n実行しますか？",
        "まとめて本保存"
      ))) {
        return;
      }

      const button = document.getElementById("bulkSaveButton");
      const originalText = button ? button.textContent : "";

      setBulkButtonsDisabled(true);

      try {
        if (button) {
          button.textContent = "本保存準備中";
        }

        await flushCurrentReceiptDraftBeforePost(ids);

        if (button) {
          button.textContent = "本保存中";
        }

        const data = await bulkPostReceiptImports(ids);
        const message = buildBulkPostResultText(data);

        selectedBulkReceiptIds.clear();

        if (selectedId) {
          await loadDetail(selectedId);
        } else {
          await loadList();
        }

        await receiptAlert(message, "まとめて本保存");
      } catch (error) {
        await receiptError(
          "まとめて本保存に失敗しました。",
          error && error.stack ? error.stack : String(error || ""),
          "まとめて本保存"
        );
      } finally {
        if (button) {
          button.textContent = originalText || "まとめて保存";
        }

        setBulkButtonsDisabled(false);
      }
    }
    /* RECEIPT_POST_SAVE_HTML_20260705_END */

