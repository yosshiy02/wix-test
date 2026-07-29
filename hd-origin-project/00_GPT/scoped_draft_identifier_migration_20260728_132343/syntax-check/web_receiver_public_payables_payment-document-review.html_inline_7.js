
(function () {
  "use strict";

  const reviewItemsUrl = "/api/payment-documents/review-items";
  let refreshTimer = null;
  let refreshRunning = false;

  function objectValue(value) {
    return value &&
      typeof value === "object" &&
      !Array.isArray(value)
        ? value
        : {};
  }

  function analysisSystemCodeOf(item) {
    const source = objectValue(item);

    const basicAnalysis = objectValue(
      source.latestBasicAnalysis ||
      source.latest_basic_analysis
    );

    const basicRawResult = objectValue(
      basicAnalysis.rawResult ||
      basicAnalysis.raw_result
    );

    const latest = objectValue(
      basicRawResult.analysis
    );

    const saved = {};

    const draft = objectValue(
      source.analysisResult ||
      source.analysis
    );

    const sortResult = objectValue(
      source.sortResult ||
      source.sort_result
    );

    const candidates = [
      latest.analysisSystemCode,
      latest.analysis_system_code,

      saved.analysisSystemCode,
      saved.analysis_system_code,

      draft.analysisSystemCode,
      draft.analysis_system_code,

      sortResult.analysisSystemCode,
      sortResult.analysis_system_code,

      source.analysisSystemCode,
      source.analysis_system_code
    ];

    for (const candidate of candidates) {
      const code = String(candidate || "").trim();

      if (code) {
        return code;
      }
    }

    return "";
  }

  function applySpecialistNavigationCounts(items) {
    const counts = Object.create(null);

    (Array.isArray(items) ? items : []).forEach(function (item) {
      const code = analysisSystemCodeOf(item);

      if (!code) {
        return;
      }

      counts[code] = (counts[code] || 0) + 1;
    });

    document.querySelectorAll(
      ".specialist-system-nav " +
      ".specialist-system-button[data-analysis-system-code]"
    ).forEach(function (button) {
      const code = String(
        button.dataset.analysisSystemCode || ""
      ).trim();

      const label = String(
        button.dataset.baseLabel ||
        button.textContent ||
        ""
      )
        .replace(/\s*（\d+）\s*$/, "")
        .trim();

      button.dataset.baseLabel = label;
      button.textContent =
        label + "（" + (counts[code] || 0) + "）";
    });
  }

  async function refreshSpecialistNavigationCounts() {
    if (refreshRunning) {
      return;
    }

    refreshRunning = true;

    try {
      const response = await fetch(reviewItemsUrl, {
        cache: "no-store"
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        throw new Error(
          data.error || "専門画面件数の取得に失敗しました。"
        );
      }

            /* HD_ORIGIN_CIL_SAVED_COUNT_FILTER_20260723_START */
      const countSourceItems=Array.isArray(data.items)
        ? data.items
        : [];

      let countVisibleItems=countSourceItems;

      try {
        const cilResponse=await fetch(
          "/api/payment-documents/contract-insurance-lease/list",
          { cache:"no-store" }
        );

        if (cilResponse.ok) {
          const cilData=await cilResponse.json();

          const cilRows=Array.isArray(cilData)
            ? cilData
            : Array.isArray(cilData.items)
              ? cilData.items
              : Array.isArray(cilData.rows)
                ? cilData.rows
                : [];

          const savedCilIds=new Set(
            cilRows
              .map(function (row) {
                return Number(
                  row.payment_document_ocr_import_id ||
                  row.paymentDocumentOcrImportId ||
                  row.ocrImportId ||
                  row.id ||
                  0
                );
              })
              .filter(function (id) {
                return Number.isInteger(id) && id > 0;
              })
          );

          countVisibleItems=countSourceItems.filter(function (item) {
            const id=Number(
              item.paymentDocumentOcrImportId ||
              item.payment_document_ocr_import_id ||
              item.ocrImportId ||
              item.ocr_import_id ||
              item.id ||
              0
            );

            const code=analysisSystemCodeOf(item);

            return !(
              code==="contract_insurance_lease_analysis" &&
              savedCilIds.has(id)
            );
          });
        }
      } catch (error) {
        console.warn(
          "契約・保険・リース保存済み件数の除外に失敗しました。",
          error
        );
      }

      applySpecialistNavigationCounts(countVisibleItems);
      /* HD_ORIGIN_CIL_SAVED_COUNT_FILTER_20260723_END */
    }
    catch (error) {
      console.warn(
        "専門画面件数更新失敗:",
        error
      );
    }
    finally {
      refreshRunning = false;
    }
  }

  function scheduleSpecialistNavigationCounts() {
    window.clearTimeout(refreshTimer);

    refreshTimer = window.setTimeout(function () {
      refreshSpecialistNavigationCounts();
    }, 250);
  }

  function startSpecialistNavigationCounts() {
    refreshSpecialistNavigationCounts();

    const list = document.getElementById("list");

    if (list) {
      const observer = new MutationObserver(function () {
        scheduleSpecialistNavigationCounts();
      });

      observer.observe(list, {
        childList: true,
        subtree: true
      });
    }

    const originalLoadItems = window.loadItems;

    if (
      typeof originalLoadItems === "function" &&
      !originalLoadItems.__specialistCountWrapped
    ) {
      const wrappedLoadItems = async function () {
        try {
          return await originalLoadItems.apply(
            this,
            arguments
          );
        }
        finally {
          scheduleSpecialistNavigationCounts();
        }
      };

      wrappedLoadItems.__specialistCountWrapped = true;
      window.loadItems = wrappedLoadItems;
    }
  }

  window.refreshSpecialistNavigationCounts =
    refreshSpecialistNavigationCounts;

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      startSpecialistNavigationCounts,
      { once: true }
    );
  }
  else {
    startSpecialistNavigationCounts();
  }
})();

