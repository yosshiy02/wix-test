"use strict";

const fields = {};
let appliedCount = 0;

function aiHardDebugSetControl() {
  return true;
}

(function () {
    for (const [fieldCode, value] of Object.entries(fields)) {
      if (
        value === null ||
        value === undefined ||
        value === ""
      ) {
        continue;
      }

      const escapedFieldCode =
        window.CSS &&
        typeof window.CSS.escape === "function"
          ? window.CSS.escape(String(fieldCode))
          : String(fieldCode)
              .replace(/\\/g, "\\\\")
              .replace(/"/g, '\\"');

      const control = document.querySelector(
        '[data-analysis-item-code="' +
        escapedFieldCode +
        '"]'
      );

      if (!control) {
        continue;
      }

      if (
        typeof aiHardDebugSetControl ===
        "function"
      ) {
        if (
          aiHardDebugSetControl(
            control,
            fieldCode,
            value
          )
        ) {
          appliedCount++;
        }
      } else {
        control.value = String(value);
        appliedCount++;
      }
    }
    })();