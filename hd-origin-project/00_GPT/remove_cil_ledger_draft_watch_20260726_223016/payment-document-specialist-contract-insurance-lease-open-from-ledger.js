"use strict";

(function () {
  const params=new URLSearchParams(location.search);

  const targetId=Number(
    params.get("ocr_import_id") ||
    params.get("ocrImportId") ||
    params.get("id") ||
    0
  );

  const savedIds=new Set();
  let listPolicyApplied=false;

  function itemId(item) {
    if (!item) return 0;

    return Number(
      item.paymentDocumentOcrImportId ||
      item.payment_document_ocr_import_id ||
      item.ocrImportId ||
      item.ocr_import_id ||
      item.id ||
      0
    );
  }

  function renderList() {
    if (typeof window.renderSortingList==="function") {
      window.renderSortingList();
    } else if (typeof renderSortingList==="function") {
      renderSortingList();
    }
  }

  function selectIndex(index) {
    if (index < 0 || typeof selectItem!=="function") {
      return;
    }

    selectItem(index);
  }

  function removeFromSelection(id) {
    const key=String(id);

    try {
      if (
        typeof checkedOcrImportIds!=="undefined" &&
        checkedOcrImportIds instanceof Set
      ) {
        checkedOcrImportIds.delete(key);
      }
    } catch (error) {}

    if (window.__checkedOcrImportIds instanceof Set) {
      window.__checkedOcrImportIds.delete(key);
    }

    if (window.__expandedOcrImportIds instanceof Set) {
      window.__expandedOcrImportIds.delete(key);
    }
  }

  function removeSavedItem(id) {
    if (
      !id ||
      typeof items==="undefined" ||
      !Array.isArray(items)
    ) {
      return;
    }

    const index=items.findIndex(function (item) {
      return itemId(item)===Number(id);
    });

    if (index < 0) {
      return;
    }

    items.splice(index,1);
    removeFromSelection(id);

    if (!items.length) {
      selectedIndex=-1;
      renderList();
      return;
    }

    selectedIndex=Math.min(index,items.length-1);
    renderList();
    selectIndex(selectedIndex);
  }

  function applyListPolicy() {
    if (
      typeof items==="undefined" ||
      !Array.isArray(items) ||
      !items.length
    ) {
      return false;
    }

    const currentId=
      selectedIndex >= 0 && items[selectedIndex]
        ? itemId(items[selectedIndex])
        : 0;

    const filtered=items.filter(function (item) {
      const id=itemId(item);

      if (targetId && id===targetId) {
        return true;
      }

      return !savedIds.has(id);
    });

    items.splice(0,items.length,...filtered);

    if (!items.length) {
      selectedIndex=-1;
      renderList();
      listPolicyApplied=true;
      return true;
    }

    let nextIndex=-1;

    if (targetId) {
      nextIndex=items.findIndex(function (item) {
        return itemId(item)===targetId;
      });
    }

    if (nextIndex < 0 && currentId) {
      nextIndex=items.findIndex(function (item) {
        return itemId(item)===currentId;
      });
    }

    if (nextIndex < 0) {
      nextIndex=0;
    }

    selectedIndex=nextIndex;
    renderList();
    selectIndex(nextIndex);

    listPolicyApplied=true;
    return true;
  }

  async function loadSavedIds() {
    const response=await fetch(
      "/api/payment-documents/contract-insurance-lease/list",
      { cache:"no-store" }
    );

    if (!response.ok) {
      throw new Error("保存済み一覧を取得できません。");
    }

    const json=await response.json();
    const rows=Array.isArray(json)
      ? json
      : Array.isArray(json.rows)
        ? json.rows
        : Array.isArray(json.items)
          ? json.items
          : [];

    rows.forEach(function (row) {
      const id=Number(
        row.payment_document_ocr_import_id ||
        row.paymentDocumentOcrImportId ||
        0
      );

      if (id > 0) {
        savedIds.add(id);
      }
    });
  }

  function patchSaveFetch() {
    if (window.__hdOriginCilSavedListFetchPatched) {
      return;
    }

    window.__hdOriginCilSavedListFetchPatched=true;

    const originalFetch=window.fetch.bind(window);

    window.fetch=async function (input,init) {
      const response=await originalFetch(input,init);

      try {
        const url=
          typeof input==="string"
            ? input
            : input && input.url
              ? input.url
              : "";

        if (
          response.ok &&
          url.includes(
            "/api/payment-documents/contract-insurance-lease-drafts/save"
          )
        ) {
          const payload=
            init && typeof init.body==="string"
              ? JSON.parse(init.body)
              : {};

          const id=Number(
            payload.paymentDocumentOcrImportId ||
            payload.payment_document_ocr_import_id ||
            payload.ocrImportId ||
            0
          );

          if (id > 0) {
            savedIds.add(id);

            window.setTimeout(function () {
              removeSavedItem(id);
            },0);
          }
        }
      } catch (error) {
        console.warn(
          "保存後リスト除外処理に失敗しました。",
          error
        );
      }

      return response;
    };
  }

  patchSaveFetch();

  loadSavedIds()
    .then(function () {
      let attempts=0;

      const timer=window.setInterval(function () {
        attempts+=1;

        if (
          applyListPolicy() ||
          attempts >= 200
        ) {
          window.clearInterval(timer);
        }
      },50);
    })
    .catch(function (error) {
      console.error(error);
    });
})();