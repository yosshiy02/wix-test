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
/* HD_ORIGIN_HIDE_BACKUP_FLOATING_WINDOW_20260706_START */
(function () {
  "use strict";
  if (window.hdOriginHideBackupFloatingWindowInstalled) {
    return;
  }
  window.hdOriginHideBackupFloatingWindowInstalled = true;
  function looksLikeBackupFloatingWindow(el) {
    if (!el || el.nodeType !== 1 || el === document.body || el === document.documentElement) {
      return false;
    }
    const style = window.getComputedStyle(el);
    if (!style || style.position !== "fixed") {
      return false;
    }
    const rect = el.getBoundingClientRect();
    if (!rect || rect.width < 120 || rect.height < 40) {
      return false;
    }
    const isLowerRight =
      rect.left > window.innerWidth * 0.45 &&
      rect.top > window.innerHeight * 0.35;
    if (!isLowerRight) {
      return false;
    }
    const text = String(el.textContent || "").toLowerCase();
    return (
      text.includes("バックアップ") ||
      text.includes("終了") ||
      text.includes("再起動") ||
      text.includes("backup") ||
      text.includes("restart") ||
      text.includes("shutdown") ||
      text.includes("hd origin")
    );
  }
  function hideBackupFloatingWindows() {
    const nodes = document.querySelectorAll("body *");
    for (const node of nodes) {
      if (looksLikeBackupFloatingWindow(node)) {
        node.style.setProperty("display", "none", "important");
        node.style.setProperty("visibility", "hidden", "important");
        node.setAttribute("data-hd-origin-hidden-backup-window", "1");
      }
    }
  }
  function install() {
    hideBackupFloatingWindows();
    const observer = new MutationObserver(function () {
      hideBackupFloatingWindows();
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["style", "class"]
    });
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }
})();
/* HD_ORIGIN_HIDE_BACKUP_FLOATING_WINDOW_20260706_END */

/* HD_ORIGIN_RESTART_BACKUP_LOCK_20260709_START */
(function hdOriginRestartBackupOperationLock() {
  if (window.__hdOriginRestartBackupOperationLockInstalled) {
    return;
  }

  window.__hdOriginRestartBackupOperationLockInstalled = true;

  const RESTART_PATHS = new Set([
    "/api/system/restart",
    "/api/system/restart-with-backup"
  ]);

  let locked = false;
  let overlay = null;

  function isRestartBackupUrl(input) {
    try {
      const raw = typeof input === "string"
        ? input
        : input && input.url
          ? input.url
          : "";

      if (!raw) {
        return false;
      }

      const url = new URL(raw, window.location.href);
      return RESTART_PATHS.has(url.pathname);
    } catch {
      return false;
    }
  }

  function ensureStyle() {
    if (document.getElementById("hd-origin-restart-backup-lock-style")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "hd-origin-restart-backup-lock-style";
    style.textContent = `
#hd-origin-restart-backup-lock {
  position: fixed;
  inset: 0;
  z-index: 2147483647;
  background: rgba(15, 23, 42, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  box-sizing: border-box;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

#hd-origin-restart-backup-lock .hd-origin-lock-card {
  width: min(560px, 100%);
  background: #ffffff;
  color: #111827;
  border-radius: 16px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
  padding: 28px;
  text-align: center;
}

#hd-origin-restart-backup-lock .hd-origin-lock-title {
  font-size: 22px;
  font-weight: 800;
  margin-bottom: 12px;
}

#hd-origin-restart-backup-lock .hd-origin-lock-message {
  font-size: 15px;
  line-height: 1.8;
  white-space: pre-line;
}

#hd-origin-restart-backup-lock .hd-origin-lock-spinner {
  width: 42px;
  height: 42px;
  border: 4px solid #d1d5db;
  border-top-color: #111827;
  border-radius: 50%;
  margin: 0 auto 18px;
  animation: hdOriginRestartBackupSpin 0.9s linear infinite;
}

#hd-origin-restart-backup-lock.hd-origin-lock-done .hd-origin-lock-spinner,
#hd-origin-restart-backup-lock.hd-origin-lock-error .hd-origin-lock-spinner {
  display: none;
}

#hd-origin-restart-backup-lock .hd-origin-lock-error-button {
  display: none;
  margin-top: 18px;
  padding: 10px 18px;
  border: 0;
  border-radius: 10px;
  background: #111827;
  color: #ffffff;
  font-weight: 700;
  cursor: pointer;
}

#hd-origin-restart-backup-lock.hd-origin-lock-error .hd-origin-lock-error-button {
  display: inline-block;
}

@keyframes hdOriginRestartBackupSpin {
  to { transform: rotate(360deg); }
}
`;
    document.head.appendChild(style);
  }

  function setOverlay(title, message, mode) {
    ensureStyle();

    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "hd-origin-restart-backup-lock";
      overlay.setAttribute("role", "alertdialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.innerHTML = `
        <div class="hd-origin-lock-card">
          <div class="hd-origin-lock-spinner"></div>
          <div class="hd-origin-lock-title"></div>
          <div class="hd-origin-lock-message"></div>
          <button type="button" class="hd-origin-lock-error-button">閉じる</button>
        </div>
      `;
      document.body.appendChild(overlay);

      overlay.querySelector(".hd-origin-lock-error-button").addEventListener("click", function () {
        unlockOperation();
      });
    }

    overlay.classList.toggle("hd-origin-lock-done", mode === "done");
    overlay.classList.toggle("hd-origin-lock-error", mode === "error");

    overlay.querySelector(".hd-origin-lock-title").textContent = title;
    overlay.querySelector(".hd-origin-lock-message").textContent = message;
  }

  function lockOperation() {
    locked = true;

    setOverlay(
      "サーバー再起動準備中",
      [
        "終了前バックアップを作成しています。",
        "バックアップ完了画面が出るまで、他の操作はできません。",
        "",
        "この画面を閉じたり、別のボタンを押したりしないでください。"
      ].join("\n"),
      "busy"
    );
  }

  function showBackupComplete(message) {
    locked = true;

    setOverlay(
      "バックアップが完了しました",
      [
        message || "終了前バックアップを作成しました。",
        "",
        "サーバーを再起動しています。",
        "画面が開き直るまでお待ちください。"
      ].join("\n"),
      "done"
    );
  }

  function showBackupError(message) {
    locked = true;

    setOverlay(
      "バックアップに失敗しました",
      [
        message || "終了前バックアップに失敗しました。",
        "",
        "再起動は続行しません。",
        "内容を確認してください。"
      ].join("\n"),
      "error"
    );
  }

  function unlockOperation() {
    locked = false;

    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }

    overlay = null;
  }

  function blockIfLocked(event) {
    if (!locked) {
      return;
    }

    if (overlay && overlay.contains(event.target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  [
    "click",
    "dblclick",
    "mousedown",
    "mouseup",
    "pointerdown",
    "pointerup",
    "touchstart",
    "touchend",
    "submit",
    "keydown"
  ].forEach(eventName => {
    document.addEventListener(eventName, blockIfLocked, true);
  });

  if (window.fetch) {
    const originalFetch = window.fetch.bind(window);

    window.fetch = function hdOriginRestartBackupLockedFetch(input, init) {
      const shouldLock = isRestartBackupUrl(input);

      if (shouldLock) {
        lockOperation();
      }

      return originalFetch(input, init)
        .then(async response => {
          if (shouldLock) {
            let body = null;

            try {
              body = await response.clone().json();
            } catch {
              body = null;
            }

            if (response.ok) {
              showBackupComplete(body && body.message ? body.message : "終了前バックアップを作成しました。");
            } else {
              showBackupError(body && (body.error || body.detail) ? (body.error || body.detail) : `HTTP ${response.status}`);
            }
          }

          return response;
        })
        .catch(error => {
          if (shouldLock) {
            showBackupError(error && error.message ? error.message : "通信エラーが発生しました。");
          }

          throw error;
        });
    };
  }

  if (window.XMLHttpRequest) {
    const OriginalXMLHttpRequest = window.XMLHttpRequest;

    window.XMLHttpRequest = function hdOriginRestartBackupLockedXhr() {
      const xhr = new OriginalXMLHttpRequest();
      const originalOpen = xhr.open;
      const originalSend = xhr.send;

      xhr.__hdOriginRestartBackupLockTarget = false;

      xhr.open = function(method, url) {
        xhr.__hdOriginRestartBackupLockTarget = isRestartBackupUrl(url);
        return originalOpen.apply(xhr, arguments);
      };

      xhr.send = function() {
        if (xhr.__hdOriginRestartBackupLockTarget) {
          lockOperation();

          xhr.addEventListener("loadend", function() {
            let body = null;

            try {
              body = JSON.parse(xhr.responseText || "{}");
            } catch {
              body = null;
            }

            if (xhr.status >= 200 && xhr.status < 300) {
              showBackupComplete(body && body.message ? body.message : "終了前バックアップを作成しました。");
            } else {
              showBackupError(body && (body.error || body.detail) ? (body.error || body.detail) : `HTTP ${xhr.status}`);
            }
          }, { once: true });
        }

        return originalSend.apply(xhr, arguments);
      };

      return xhr;
    };
  }
})();
/* HD_ORIGIN_RESTART_BACKUP_LOCK_20260709_END */


