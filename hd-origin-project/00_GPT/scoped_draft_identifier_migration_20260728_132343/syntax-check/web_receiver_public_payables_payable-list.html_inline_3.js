
(function () {
  "use strict";
  window.hdOriginPayablesReload = function () {
    window.location.reload();
  };
  window.hdOriginPayablesRestart = async function () {
    if (!window.confirm("HD Origin Project サーバーを再起動しますか？\n未保存の作業がある場合は先に保存してください。")) {
      return;
    }
    try {
      const res = await fetch("/api/system/restart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        },
        body: JSON.stringify({})
      });
      const data = await res.json().catch(function () {
        return { ok: false, error: "JSON読込失敗" };
      });
      if (!res.ok || !data.ok) {
        window.alert("サーバー再起動要求に失敗しました: " + (data.error || ""));
        return;
      }
      window.alert("サーバー再起動を要求しました。黒い画面が再起動した後、ブラウザを再読み込みしてください。");
    } catch (error) {
      window.alert("サーバー再起動要求でエラーが発生しました: " + (error && error.message ? error.message : error));
    }
  };
})();

/* GPT00_PAYABLE_COMPANY_DISPLAY_ONLY_20260711 */
function renderPayableCompanyDisplay() {
  const codeElement =
    document.getElementById(
      "companyCode"
    );

  const nameElement =
    document.getElementById(
      "companyName"
    );

  const statusElement =
    document.getElementById(
      "payableCompanyDisplayStatus"
    );

  if (
    !codeElement ||
    !nameElement ||
    !statusElement
  ) {
    return;
  }

  const companyCode =
    String(codeElement.value || "")
      .trim();

  const companyName =
    String(nameElement.value || "")
      .trim();

  if (!companyCode || !companyName) {
    statusElement.textContent =
      "会社情報がありません。取込元データを確認してください。";

    return;
  }

  statusElement.textContent =
    companyCode +
    " / " +
    companyName;
}

document.addEventListener(
  "DOMContentLoaded",
  () => {
    renderPayableCompanyDisplay();
  }
);