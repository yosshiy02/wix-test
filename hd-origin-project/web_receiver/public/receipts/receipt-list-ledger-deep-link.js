"use strict";

(function () {
  const params = new URLSearchParams(
    window.location.search
  );

  const targetId = Number(
    params.get(
      "payment_document_ocr_import_id"
    ) ||
    params.get("ocr_id") ||
    0
  );

  if (
    !Number.isFinite(targetId) ||
    targetId <= 0
  ) {
    return;
  }

  let attemptCount = 0;
  let opened = false;

  function itemId(item) {
    return Number(
      item &&
      (
        item.paymentDocumentOcrImportId ||
        item.payment_document_ocr_import_id ||
        item.id
      )
    );
  }

  function tryOpenReceipt() {
    if (opened) {
      return;
    }

    attemptCount++;

    try {
      if (
        typeof loadDetail === "function" &&
        typeof currentItems !== "undefined" &&
        Array.isArray(currentItems)
      ) {
        const exists = currentItems.some(
          function (item) {
            return itemId(item) === targetId;
          }
        );

        if (exists) {
          opened = true;
          loadDetail(targetId);
          return;
        }
      }
    }
    catch (_) {
    }

    if (attemptCount < 100) {
      window.setTimeout(
        tryOpenReceipt,
        100
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      function () {
        window.setTimeout(
          tryOpenReceipt,
          100
        );
      }
    );
  }
  else {
    window.setTimeout(
      tryOpenReceipt,
      100
    );
  }
})();