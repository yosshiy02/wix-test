let items = [];
  let selectedIndex = -1;
  let previewRotation = 0;
  const selectedFileNames = new Set();

  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function kb(bytes) {
    const n = Number(bytes) || 0;
    if (n >= 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + " MB";
    return Math.round(n / 1024) + " KB";
  }

  function formatJapanDateTime(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    const parts = new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).formatToParts(date).reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});

    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
  }

  function ocrLabel(item) {
    if (item.ocrStatus === "ocr_done" || item.ocrRawText) return "OCR済";
    if (item.ocrStatus === "ocr_error") return "OCR失敗";
    if (item.ocrStatus === "ocr_skipped") return "対象外";
    if (item.ocrStatus === "ocr_empty") return "空";
    return "OCR待ち";
  }

  function ocrClass(item) {
    if (item.ocrStatus === "ocr_done" || item.ocrRawText) return "ocr-badge done";
    if (item.ocrStatus === "ocr_error") return "ocr-badge error";
    if (item.ocrStatus === "ocr_skipped") return "ocr-badge skipped";
    if (item.ocrStatus === "ocr_empty") return "ocr-badge empty";
    return "ocr-badge waiting";
  }

  function showResult(message) {
    const el = document.getElementById("result");

    if (!el) {
      return;
    }

    const text = typeof message === "string" ? message : JSON.stringify(message, null, 2);

    el.textContent = text || "";
    el.classList.toggle("has-message", !!text);
  }

  let hdOriginUploadLogWindow = null;
  let hdOriginUploadLogBody = null;

  function hdOriginUploadLogTime() {
    const d = new Date();
    return String(d.getHours()).padStart(2, "0") + ":" +
      String(d.getMinutes()).padStart(2, "0") + ":" +
      String(d.getSeconds()).padStart(2, "0");
  }

  function ensureUploadLogWindow() {
    if (hdOriginUploadLogWindow && hdOriginUploadLogBody) {
      return;
    }

    const box = document.createElement("div");
    box.id = "uploadLogWindow";
    box.style.cssText = [
      "position:fixed",
      "right:0.8rem",
      "bottom:0.8rem",
      "width:min(42rem, calc(100vw - 1.6rem))",
      "height:min(24rem, calc(100vh - 1.6rem))",
      "background:#ffffff",
      "border:2px solid #111827",
      "border-radius:0.65rem",
      "box-shadow:0 12px 35px rgba(0,0,0,0.35)",
      "z-index:99999",
      "display:none",
      "grid-template-rows:auto minmax(0, 1fr)",
      "overflow:hidden",
      "font-family:inherit"
    ].join(";");

    const header = document.createElement("div");
    header.style.cssText = [
      "display:flex",
      "align-items:center",
      "justify-content:space-between",
      "gap:0.5rem",
      "background:#111827",
      "color:#ffffff",
      "padding:0.45rem 0.55rem",
      "font-weight:800",
      "font-size:0.82rem"
    ].join(";");

    const title = document.createElement("div");
    title.id = "uploadLogTitle";
    title.textContent = "取込ログ";

    const buttons = document.createElement("div");
    buttons.style.cssText = "display:flex;gap:0.35rem;align-items:center;";

    const clearButton = document.createElement("button");
    clearButton.type = "button";
    clearButton.textContent = "クリア";
    clearButton.style.cssText = "font-size:0.72rem;padding:0.25rem 0.45rem;background:#374151;color:#fff;border:1px solid #6b7280;border-radius:0.35rem;";
    clearButton.onclick = function () {
      if (hdOriginUploadLogBody) {
        hdOriginUploadLogBody.innerHTML = "";
      }
    };

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.textContent = "閉じる";
    closeButton.style.cssText = "font-size:0.72rem;padding:0.25rem 0.45rem;background:#ffffff;color:#111827;border:1px solid #d1d5db;border-radius:0.35rem;";
    closeButton.onclick = function () {
      box.style.display = "none";
    };

    buttons.appendChild(clearButton);
    buttons.appendChild(closeButton);

    header.appendChild(title);
    header.appendChild(buttons);

    const body = document.createElement("div");
    body.id = "uploadLogBody";
    body.style.cssText = [
      "overflow:auto",
      "padding:0.55rem",
      "background:#f9fafb",
      "font-size:0.78rem",
      "line-height:1.45",
      "white-space:pre-wrap"
    ].join(";");

    box.appendChild(header);
    box.appendChild(body);
    document.body.appendChild(box);

    hdOriginUploadLogWindow = box;
    hdOriginUploadLogBody = body;
  }

  function openUploadLog(title) {
    ensureUploadLogWindow();

    const titleEl = document.getElementById("uploadLogTitle");
    if (titleEl) {
      titleEl.textContent = title || "取込ログ";
    }

    hdOriginUploadLogBody.innerHTML = "";
    hdOriginUploadLogWindow.style.display = "grid";
  }

  function appendUploadLog(message, kind) {
    ensureUploadLogWindow();

    if (hdOriginUploadLogWindow.style.display === "none") {
      hdOriginUploadLogWindow.style.display = "grid";
    }

    const line = document.createElement("div");
    const type = String(kind || "");

    line.textContent = "[" + hdOriginUploadLogTime() + "] " + String(message || "");
    line.style.cssText = [
      "padding:0.18rem 0.25rem",
      "border-bottom:1px solid #e5e7eb",
      "color:#111827"
    ].join(";");

    if (type === "ok") {
      line.style.background = "#ecfdf5";
      line.style.color = "#065f46";
      line.style.fontWeight = "700";
    } else if (type === "dup") {
      line.style.background = "#fffbeb";
      line.style.color = "#92400e";
      line.style.fontWeight = "800";
    } else if (type === "error") {
      line.style.background = "#fef2f2";
      line.style.color = "#991b1b";
      line.style.fontWeight = "800";
    } else if (type === "summary") {
      line.style.background = "#eff6ff";
      line.style.color = "#1e3a8a";
      line.style.fontWeight = "900";
      line.style.marginTop = "0.25rem";
    }

    hdOriginUploadLogBody.appendChild(line);
    hdOriginUploadLogBody.scrollTop = hdOriginUploadLogBody.scrollHeight;
  }


  function selectedItem() {
    return selectedIndex >= 0 ? items[selectedIndex] : null;
  }

  function updateSelectedSummary() {
    const el = document.getElementById("selectedSummary");
    if (el) {
      el.textContent = "選択: " + selectedFileNames.size + "件";
    }
  }

  function toggleSelectedByIndex(index, checked) {
    const item = items[index];
    if (!item) return;

    if (checked) {
      selectedFileNames.add(item.fileName);
    } else {
      selectedFileNames.delete(item.fileName);
    }

    updateSelectedSummary();
  }

  function selectAllItems() {
    items.forEach(item => selectedFileNames.add(item.fileName));
    renderList();
    updateSelectedSummary();
  }

  function clearSelection() {
    selectedFileNames.clear();
    renderList();
    updateSelectedSummary();
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadSelectedFiles() {
    return uploadSelectedFilesFromInput("uploadInput");
  }

  async function uploadSelectedFolder() {
    return uploadSelectedFilesFromInput("folderInput");
  }

  async function uploadSelectedFilesFromInput(inputId) {
    const input = document.getElementById(inputId);
    const files = Array.from(input.files || []);

    if (!files.length) {
      showResult("ファイルが選択されていません。");
      return;
    }

    let successCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    const duplicates = [];
    const errors = [];

    showResult("INBOXへ追加中です。\n対象: " + files.length + "件");
    openUploadLog("支払書類 取込ログ");
    appendUploadLog("取込開始: 対象 " + files.length + "件", "summary");

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      appendUploadLog("[" + (i + 1) + "/" + files.length + "] 読込開始: " + file.name + " (" + kb(file.size) + ")", "");

      try {
        showResult(
          "INBOXへ追加中です。\n" +
          "処理中: " + (i + 1) + " / " + files.length + "\n" +
          "ファイル: " + file.name
        );

        const dataUrl = await readFileAsDataUrl(file);

        const res = await fetch("/api/payment-documents/scan-inbox/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || "",
            dataUrl,
            documentType: "",
            destination: "",
            sourceType: "",
            vendorName: "",
            note: ""
          })
        });

        const data = await res.json();

        if (!data.ok) {
          throw new Error(data.error || "追加失敗");
        }

        if (data.duplicate || data.skipped) {
          const existing = data.duplicateItem || data.item || {};
          const duplicateText = file.name + " → 既にあり: " + (existing.originalFileName || existing.fileName || "既存ファイル");
          duplicateCount++;
          duplicates.push(duplicateText);
          appendUploadLog("重複スキップ: " + duplicateText, "dup");
          continue;
        }

        successCount++;
        const added = data.item || {};
        appendUploadLog("追加成功: " + file.name + " → " + (added.fileName || added.originalFileName || "INBOX"), "ok");
      } catch (error) {
        const errorText = file.name + ": " + (error.message || String(error));
        errorCount++;
        errors.push(errorText);
        appendUploadLog("エラー: " + errorText, "error");
      }
    }

    input.value = "";
    await loadInbox();

    appendUploadLog(
      "取込完了: 追加成功 " + successCount + "件 / 重複スキップ " + duplicateCount + "件 / エラー " + errorCount + "件",
      "summary"
    );

    const details = [];

    if (duplicates.length) {
      details.push("[重複スキップ]");
      details.push(duplicates.join("\n"));
    }

    if (errors.length) {
      if (details.length) details.push("");
      details.push("[エラー]");
      details.push(errors.join("\n"));
    }

    showResult(
      "INBOX追加完了\n" +
      "対象: " + files.length + "件\n" +
      "追加成功: " + successCount + "件\n" +
      "重複スキップ: " + duplicateCount + "件\n" +
      "エラー: " + errorCount + "件" +
      (details.length ? "\n\n" + details.join("\n") : "")
    );
  }

  async function loadInbox() {
    const preview = document.getElementById("preview");
    const ocrStatusBox = document.getElementById("ocrStatusBox");
    const ocrText = document.getElementById("ocrText");

    preview.textContent = "左から書類を選択してください。";
    ocrStatusBox.textContent = "OCR状態：未選択";
    ocrText.value = "";
    selectedIndex = -1;

    const res = await fetch("/api/payment-documents/scan-inbox");
    const data = await res.json();

    if (!data.ok) {
      showResult("読込失敗: " + (data.error || "原因不明"));
      return;
    }

    items = data.items || [];

    const alive = new Set(items.map(item => item.fileName));
    for (const fileName of Array.from(selectedFileNames)) {
      if (!alive.has(fileName)) selectedFileNames.delete(fileName);
    }

    const ocrDoneCount = items.filter(item => item.ocrStatus === "ocr_done" || item.ocrRawText).length;
    const ocrWaitingCount = items.length - ocrDoneCount;

    const summary = document.getElementById("summary");
    if (summary) {
      summary.textContent = "件数: " + items.length + " / OCR済: " + ocrDoneCount + " / OCR待ち等: " + ocrWaitingCount;
    }

    renderList();
    updateSelectedSummary();
  }

  function renderList() {
    const list = document.getElementById("list");

    if (!items.length) {
      list.innerHTML = '<div class="muted">OCR取込待ちの支払書類がありません。</div>';
      return;
    }

    list.innerHTML = items.map((item, index) => {
      const displayName = item.originalFileName || item.fileName;
      const checked = selectedFileNames.has(item.fileName) ? "checked" : "";
      const active = index === selectedIndex ? " active" : "";

      return `
        <div class="item-row">
          <input class="row-check" type="checkbox" ${checked}
            onclick="event.stopPropagation()"
            onchange="toggleSelectedByIndex(${index}, this.checked)">
          <button class="item${active}" onclick="selectItem(${index})">
            <span class="no">${index + 1}</span>
            <span class="name">${esc(displayName)}</span>
            <span class="${ocrClass(item)}">${ocrLabel(item)}</span>
          </button>
          <button class="delete-mini" onclick="deleteItem(event, ${index})">削除</button>
        </div>
      `;
    }).join("");
  }
  function applyPreviewRotation() {
    const img = document.querySelector("#preview img");
    if (img) {
      img.style.transform = "rotate(" + previewRotation + "deg)";
    }
  }

  function rotatePreview(delta) {
    if (!selectedItem()) {
      showResult("先に書類を選択してください。");
      return;
    }

    previewRotation = (previewRotation + delta) % 360;
    applyPreviewRotation();
  }

  function resetPreview() {
    previewRotation = 0;
    applyPreviewRotation();
  }

  function selectItem(index) {
    selectedIndex = index;
    previewRotation = 0;

    renderList();

    const item = items[index];
    const fileUrl = "/api/payment-documents/scan-inbox/file/" + encodeURIComponent(item.fileName);
    const mime = String(item.mimeType || "");
    const preview = document.getElementById("preview");

    if (mime.startsWith("image/")) {
      preview.innerHTML = `<img src="${fileUrl}?t=${Date.now()}" alt="支払書類">`;
    } else if (mime.includes("pdf") || item.fileName.toLowerCase().endsWith(".pdf")) {
      preview.innerHTML = `<iframe src="${fileUrl}?t=${Date.now()}"></iframe>`;
    } else if (item.fileName.toLowerCase().endsWith(".eml") || item.fileName.toLowerCase().endsWith(".msg")) {
      preview.innerHTML = '<div class="muted">メール保存ファイルです。原本ファイルとして保存されています。</div>';
    } else {
      preview.innerHTML = '<div class="muted">この形式は画面プレビュー対象外です。ファイルはINBOXに入っています。</div>';
    }
    const ocrAtText = item.ocrAt ? " / " + formatJapanDateTime(item.ocrAt) : "";
    document.getElementById("ocrStatusBox").textContent = "OCR状態：" + ocrLabel(item) + ocrAtText;
    document.getElementById("ocrText").value = item.ocrRawText || item.ocrTextPreview || "";
    showResult("");
  }

  async function runCurrentOcr() {
    const item = selectedItem();

    if (!item) {
      showResult("先に書類を選択してください。");
      return;
    }

    selectedFileNames.clear();
    selectedFileNames.add(item.fileName);
    updateSelectedSummary();
    await runSelectedOcr();
  }

  async function runSelectedOcr() {
    const fileNames = Array.from(selectedFileNames);

    if (!fileNames.length) {
      showResult("OCR対象にチェックを入れてください。");
      return;
    }

    const ok = confirm("選択した " + fileNames.length + "件をまとめてOCRしますか？");
    if (!ok) {
      showResult("");
      return;
    }

    showResult("まとめてOCR実行中です。\n対象: " + fileNames.length + "件\n処理中は画面を閉じないでください。");

    try {
      const res = await fetch("/api/payment-documents/scan-inbox/ocr-selected", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ fileNames })
      });

      const data = await res.json();

      showResult(
        "まとめてOCR結果\n" +
        "対象: " + (data.targetCount || fileNames.length) + "件\n" +
        "成功: " + (data.successCount || 0) + "件\n" +
        "失敗: " + (data.failedCount || 0) + "件"
      );

      await loadInbox();
    } catch (error) {
      showResult("まとめてOCRでエラー:\n" + (error.message || String(error)));
    }
  }

  async function deleteItem(event, index) {
    event.stopPropagation();

    const item = items[index];

    if (!item) return;

    if (!confirm("INBOXから削除しますか？\n" + (item.originalFileName || item.fileName))) {
      return;
    }

    const res = await fetch("/api/payment-documents/scan-inbox/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ fileName: item.fileName })
    });

    const data = await res.json();

    if (!data.ok) {
      showResult("削除失敗: " + (data.error || "原因不明"));
      return;
    }

    selectedFileNames.delete(item.fileName);
    await loadInbox();
    showResult("INBOXから削除しました。");
  }

  async function deleteSelected() {
    if (selectedIndex < 0) {
      showResult("先に書類を選択してください。");
      return;
    }

    await deleteItem({ stopPropagation: function () {} }, selectedIndex);
  }

  async function restartServer() {
    const ok = confirm("サーバーを再起動しますか？\n終了前バックアップありの再起動APIを呼びます。");

    if (!ok) {
      return;
    }

    showResult("サーバー再起動を要求中です。");

    try {
      const res = await fetch("/api/system/restart-with-backup", {
        method: "POST"
      });

      const data = await res.json();
      showResult(data);
    } catch (error) {
      showResult("再起動要求後に接続が切れた可能性があります。\n" + (error.message || String(error)));
    }
  }

  loadInbox().catch(error => {
    showResult("初期読込エラー: " + (error.message || String(error)));
  });