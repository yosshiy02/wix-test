/*
  HD_ORIGIN_SPECIALIST_RECORD_NAVIGATION_GPT2_20260712

  対象:
  - 請求・未払系
  - 税金・公的支払系
  - 契約・保険・リース系
  - 公共料金・通信費系

  方針:
  - 画面を開いたときは先頭レコードを選択する
  - 左右ボタンは保存済みレコードの表示を移動するだけ
  - 左右移動では専門解析を実行しない
  - 単品専門解析ボタンは設置しない
*/
(function () {
  "use strict";

  if (window.__hdOriginSpecialistRecordNavigationInstalled) {
    return;
  }

  window.__hdOriginSpecialistRecordNavigationInstalled = true;

  let listObserver = null;
  let selectionRunning = false;

  function rows() {
    try {
      if (
        typeof items !== "undefined" &&
        Array.isArray(items)
      ) {
        return items;
      }
    } catch (error) {
      console.error(
        "専門解析一覧の取得に失敗しました。",
        error
      );
    }

    return [];
  }

  function currentIndex() {
    try {
      if (typeof selectedIndex !== "undefined") {
        const value = Number(selectedIndex);

        if (Number.isInteger(value)) {
          return value;
        }
      }
    } catch (error) {
      console.error(
        "選択位置の取得に失敗しました。",
        error
      );
    }

    return -1;
  }

  function setCurrentIndex(index) {
    try {
      selectedIndex = index;
      return true;
    } catch (error) {
      console.error(
        "選択位置の更新に失敗しました。",
        error
      );
      return false;
    }
  }

  function selectionFunction() {
    try {
      if (typeof selectItem === "function") {
        return selectItem;
      }
    } catch (error) {
      console.error(
        "selectItemの確認に失敗しました。",
        error
      );
    }

    if (typeof window.selectItem === "function") {
      return window.selectItem;
    }

    return null;
  }

  function showNavigationMessage(message) {
    try {
      if (typeof showResult === "function") {
        showResult(message);
        return;
      }
    } catch (error) {
      console.error(error);
    }

    console.log(message);
  }

  function itemName(item, index) {
    if (!item) {
      return "レコード " + (index + 1);
    }

    return String(
      item.originalFileName ||
      item.savedFileName ||
      item.fileName ||
      ("レコード " + (index + 1))
    );
  }

  function updateNavigation() {
    const allRows = rows();
    const total = allRows.length;
    const index = currentIndex();
    const valid =
      total > 0 &&
      index >= 0 &&
      index < total;

    const previousButton = document.getElementById(
      "specialistPreviousRecordButton"
    );

    const nextButton = document.getElementById(
      "specialistNextRecordButton"
    );

if (counter) {
      counter.textContent = valid
        ? (index + 1) + " / " + total
        : "0 / " + total;

      counter.title = valid
        ? itemName(allRows[index], index)
        : "選択中のレコードはありません";
    }
  }

  function selectIndex(index) {
    const allRows = rows();

    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index >= allRows.length
    ) {
      updateNavigation();
      return false;
    }

    if (selectionRunning) {
      return false;
    }

    const select = selectionFunction();

    if (!select) {
      showNavigationMessage(
        "専門解析画面のレコード選択関数が見つかりません。"
      );
      updateNavigation();
      return false;
    }

    selectionRunning = true;

    try {
      setCurrentIndex(index);

      const result = select(index);

      if (
        result &&
        typeof result.then === "function"
      ) {
        result
          .catch(function (error) {
            console.error(
              "専門解析レコードの表示に失敗しました。",
              error
            );
          })
          .finally(function () {
            selectionRunning = false;
            updateNavigation();
          });

        return true;
      }

      selectionRunning = false;
      updateNavigation();
      return true;
    } catch (error) {
      selectionRunning = false;

      console.error(
        "専門解析レコードの表示に失敗しました。",
        error
      );

      updateNavigation();
      return false;
    }
  }

  function ensureInitialSelection() {
    const allRows = rows();
    const total = allRows.length;
    const index = currentIndex();

    if (!total) {
      updateNavigation();
      return;
    }

    if (
      index < 0 ||
      index >= total
    ) {
      selectIndex(0);
      return;
    }

    updateNavigation();
  }

  window.hdOriginSpecialistMoveRecord =
    function (direction) {
      const allRows = rows();
      const total = allRows.length;

      if (!total) {
        updateNavigation();
        return;
      }

      const current = currentIndex();
      const base =
        current >= 0 && current < total
          ? current
          : 0;

      const next = Math.max(
        0,
        Math.min(
          total - 1,
          base + Number(direction || 0)
        )
      );

      if (next === current) {
        updateNavigation();
        return;
      }

      selectIndex(next);
    };

  window.hdOriginSpecialistEnsureInitialSelection =
    ensureInitialSelection;

  window.hdOriginSpecialistUpdateRecordNavigation =
    updateNavigation;

  function installListObserver() {
    const list = document.getElementById("list");

    if (
      !list ||
      list.dataset.specialistRecordObserver === "1"
    ) {
      return;
    }

    list.dataset.specialistRecordObserver = "1";

    listObserver = new MutationObserver(
      function () {
        window.queueMicrotask(
          ensureInitialSelection
        );
      }
    );

    listObserver.observe(
      list,
      {
        childList: true,
        subtree: false
      }
    );
  }

  function install() {
    installListObserver();

    document.addEventListener(
      "click",
      function (event) {
        const target =
          event.target &&
          event.target.closest
            ? event.target.closest("#list")
            : null;

        if (!target) {
          return;
        }

        window.requestAnimationFrame(
          updateNavigation
        );
      },
      true
    );

    window.queueMicrotask(
      ensureInitialSelection
    );

    window.setTimeout(
      ensureInitialSelection,
      0
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      install,
      {
        once: true
      }
    );
  } else {
    install();
  }

  window.addEventListener(
    "pageshow",
    function () {
      installListObserver();
      ensureInitialSelection();
    }
  );
})();
