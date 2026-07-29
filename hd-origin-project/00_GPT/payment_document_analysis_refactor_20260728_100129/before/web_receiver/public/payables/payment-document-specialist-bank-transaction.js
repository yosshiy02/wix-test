(function () {
  "use strict";

  const analysisSystemCode =
    "bank_transaction_analysis";

  const specialistAnalysisCode =
    "bank_transaction";

  let showAllFields = true;

  function updateButton() {
    const button =
      document.getElementById(
        "bankTransactionShowAllFieldsButton"
      );

    if (!button) {
      return;
    }

    button.setAttribute(
      "aria-pressed",
      showAllFields ? "true" : "false"
    );

    button.textContent =
      showAllFields
        ? "全項目を表示中"
        : "全項目を表示";
  }

  function updateFieldVisibility() {
    document
      .querySelectorAll(
        "[data-bank-transaction-section]"
      )
      .forEach(function (section) {
        section.hidden =
          !showAllFields;
      });
  }

  function init() {
    window.HD_BANK_TRANSACTION_SPECIALIST =
      Object.freeze({
        analysisSystemCode:
          analysisSystemCode,

        specialistAnalysisCode:
          specialistAnalysisCode
      });

    const button =
      document.getElementById(
        "bankTransactionShowAllFieldsButton"
      );

    if (button) {
      button.addEventListener(
        "click",
        function () {
          showAllFields =
            !showAllFields;

          updateButton();
          updateFieldVisibility();
        }
      );
    }

    updateButton();
    updateFieldVisibility();
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init
    );
  }
  else {
    init();
  }
})();