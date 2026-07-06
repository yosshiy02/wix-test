/* HD_ORIGIN_EXIT_GUARD_20260706_START */
(function () {
  if (window.hdOriginExitGuardInstalled) return;
  window.hdOriginExitGuardInstalled = true;
  let nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  let bypassFetchConfirm = false;
  let exitActionRunning = false;
  let allowNormalNavigationUntil = 0;
  function isInternalNormalNavigationAllowed() {
    return Date.now() < allowNormalNavigationUntil;
  }
  function allowNormalNavigationBriefly() {
    allowNormalNavigationUntil = Date.now() + 2500;
  }
  document.addEventListener("click", function (event) {
    const target = event.target && event.target.closest
      ? event.target.closest("a, button")
      : null;
    if (!target) return;
    if (target.closest("#hdOriginExitGuardPanel")) return;
    const text = String(target.textContent || "").trim();
    if (text.includes("終了") || text.includes("再起動")) return;
    allowNormalNavigationBriefly();
  }, true);
  window.addEventListener("beforeunload", function (event) {
    if (exitActionRunning) return;
    if (isInternalNormalNavigationAllowed()) return;
    event.preventDefault();
    event.returnValue = "HD Origin Projectを閉じる前に、安全終了または安全再起動でDBバックアップしてください。";
    return event.returnValue;
  });
  function actionLabel(action) {
    return action === "restart" ? "再起動" : "終了";
  }
  function confirmBackupTwice(action) {
    const label = actionLabel(action);
    const first = window.confirm(
      "現在のデータをDBバックアップしてから" + label + "しますか？\n\n" +
      "証憑画像は取り込み時にDropboxへ保存される前提です。\n" +
      "ここで作成するのはPostgreSQLのDBバックアップです。"
    );
    if (!first) return false;
    const second = window.confirm(
      "【2回目確認】\n\n" +
      "本当に、現在のDBデータをバックアップしてから" + label + "しますか？\n\n" +
      "バックアップが成功した後にサーバーを" + label + "します。"
    );
    return !!second;
  }
  function setPanelStatus(message) {
    const el = document.getElementById("hdOriginExitGuardStatus");
    if (el) el.textContent = message || "";
  }
  async function runSystemExit(action) {
    if (exitActionRunning) return false;
    if (!confirmBackupTwice(action)) return false;
    if (!nativeFetch) {
      window.alert("fetch が使えないため、安全終了/再起動を実行できません。");
      return false;
    }
    exitActionRunning = true;
    setPanelStatus("DBバックアップ中です。画面を閉じないでください。");
    try {
      bypassFetchConfirm = true;
      const url = action === "restart"
        ? "/api/system/restart"
        : "/api/system/shutdown";
      const res = await nativeFetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        }
      });
      const data = await res.json().catch(function () {
        return { ok: false, error: "サーバー応答の読込に失敗しました。" };
      });
      if (!res.ok || !data.ok) {
        exitActionRunning = false;
        setPanelStatus("バックアップまたは" + actionLabel(action) + "に失敗しました。");
        window.alert(
          "バックアップまたは" + actionLabel(action) + "に失敗しました。\n\n" +
          (data.error || data.detail || "")
        );
        return false;
      }
      const fileName = data.backup && data.backup.file_name
        ? data.backup.file_name
        : "";
      setPanelStatus("DBバックアップ完了: " + fileName + " / サーバー" + actionLabel(action) + "中");
      if (action === "shutdown") {
        document.body.innerHTML =
          "<h1>HD Origin Projectを安全終了しました</h1>" +
          "<p>DBバックアップを作成してからサーバー終了を要求しました。</p>" +
          "<p>バックアップ: " + String(fileName || "").replace(/[&<>"']/g, function (c) {
            return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c];
          }) + "</p>";
      }
      return true;
    } catch (error) {
      exitActionRunning = false;
      setPanelStatus("通信エラーで安全終了/再起動に失敗しました。");
      window.alert("通信エラーで安全終了/再起動に失敗しました。\n\n" + String(error && error.message ? error.message : error));
      return false;
    } finally {
      bypassFetchConfirm = false;
    }
  }
  window.hdOriginSafeShutdown = function () {
    return runSystemExit("shutdown");
  };
  window.hdOriginSafeRestart = function () {
    return runSystemExit("restart");
  };
  if (nativeFetch) {
    window.fetch = function (input, init) {
      const url = typeof input === "string"
        ? input
        : (input && input.url ? input.url : "");
      const method = String(
        init && init.method
          ? init.method
          : (input && input.method ? input.method : "GET")
      ).toUpperCase();
      const isRestartPost =
        method === "POST" &&
        String(url || "").includes("/api/system/restart");
      const isShutdownPost =
        method === "POST" &&
        (
          String(url || "").includes("/api/system/shutdown") ||
          String(url || "").includes("/api/system/exit")
        );
      if (!bypassFetchConfirm && (isRestartPost || isShutdownPost)) {
        const action = isRestartPost ? "restart" : "shutdown";
        if (!confirmBackupTwice(action)) {
          return Promise.resolve(new Response(
            JSON.stringify({
              ok: false,
              cancelled: true,
              error: "ユーザーが安全終了/再起動をキャンセルしました。"
            }),
            {
              status: 409,
              headers: {
                "Content-Type": "application/json; charset=utf-8"
              }
            }
          ));
        }
      }
      return nativeFetch(input, init);
    };
  }
  function addExitGuardPanel() {
    if (document.getElementById("hdOriginExitGuardPanel")) return;
    const panel = document.createElement("div");
    panel.id = "hdOriginExitGuardPanel";
    panel.style.position = "fixed";
    panel.style.right = "12px";
    panel.style.bottom = "12px";
    panel.style.zIndex = "99999";
    panel.style.background = "rgba(255,255,255,0.96)";
    panel.style.border = "1px solid #999";
    panel.style.borderRadius = "8px";
    panel.style.padding = "8px";
    panel.style.fontSize = "12px";
    panel.style.boxShadow = "0 2px 10px rgba(0,0,0,0.18)";
    panel.style.maxWidth = "260px";
    panel.innerHTML =
      '<div style="font-weight:bold; margin-bottom:6px;">HD Origin 安全終了</div>' +
      '<button type="button" onclick="hdOriginSafeShutdown()" style="margin-right:6px;">DBバックアップして終了</button>' +
      '<button type="button" onclick="hdOriginSafeRestart()">DBバックアップして再起動</button>' +
      '<div id="hdOriginExitGuardStatus" style="margin-top:6px; color:#555;">待機中</div>';
    document.body.appendChild(panel);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", addExitGuardPanel);
  } else {
    addExitGuardPanel();
  }
})();
/* HD_ORIGIN_EXIT_GUARD_20260706_END */
