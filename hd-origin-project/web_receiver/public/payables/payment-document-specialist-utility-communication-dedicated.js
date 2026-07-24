"use strict";

/* GPT3_UTILITY_DEDICATED_SCREEN_JS_START */
(function () {
  const SAVE_ENDPOINT =
    "/api/payment-documents/utility-communication-drafts/save";

  let showAllFields = false;
  let lastVisibleFieldLabels = [];
  let lastDraft = null;

  function objectValue(value) {
    return value &&
      typeof value === "object" &&
      !Array.isArray(value)
        ? value
        : {};
  }

  function fieldSources(draft) {
    const source = objectValue(draft);

    return [
      objectValue(source.fields),
      objectValue(source.specialistFields),
      objectValue(source.specialist_fields),
      objectValue(
        source.draft &&
        source.draft.fields
      ),
      objectValue(
        source.specialist &&
        source.specialist.draft &&
        source.specialist.draft.fields
      )
    ];
  }

  function ownValue(source, key) {
    return Object.prototype.hasOwnProperty.call(
      source,
      key
    )
      ? source[key]
      : undefined;
  }

  function draftValue(draft, code) {
    for (const source of fieldSources(draft)) {
      const value =
        ownValue(source, code);

      if (value !== undefined) {
        return value;
      }
    }

    const root =
      objectValue(draft);

    const direct =
      ownValue(root, code);

    if (direct !== undefined) {
      return direct;
    }

    if (
      code === "warnings" &&
      Array.isArray(root.warnings)
    ) {
      return root.warnings;
    }

    return undefined;
  }

  function dateInputValue(value) {
    const text =
      value === null ||
      value === undefined
        ? ""
        : String(value);

    if (!text) {
      return "";
    }

    return text.slice(0, 10);
  }

  function dateTimeInputValue(value) {
    const text =
      value === null ||
      value === undefined
        ? ""
        : String(value);

    if (!text) {
      return "";
    }

    return text
      .replace("Z", "")
      .slice(0, 16);
  }

  function setSelectValue(select, value) {
    const text =
      value === null ||
      value === undefined
        ? ""
        : String(value).trim();

    if (!text) {
      select.value = "";
      return;
    }

    const options =
      Array.from(select.options || []);

    const found =
      options.find(function (option) {
        return (
          String(option.value || "") === text ||
          String(option.dataset.code || "") === text ||
          String(option.textContent || "").trim() === text
        );
      });

    if (found) {
      select.value = found.value;
    }
  }

  function setControlValue(control, value) {
    if (!control) {
      return;
    }

    if (control.type === "checkbox") {
      control.checked =
        value === true ||
        value === 1 ||
        value === "1" ||
        value === "true" ||
        value === "対象" ||
        value === "はい";

      return;
    }

    if (control.tagName === "SELECT") {
      setSelectValue(
        control,
        value
      );

      return;
    }

    if (control.type === "date") {
      control.value =
        dateInputValue(value);

      return;
    }

    if (control.type === "datetime-local") {
      control.value =
        dateTimeInputValue(value);

      return;
    }

    if (Array.isArray(value)) {
      control.value =
        value
          .map(function (item) {
            if (
              item &&
              typeof item === "object"
            ) {
              return JSON.stringify(item);
            }

            return String(item);
          })
          .join("\n");

      return;
    }

    if (
      value &&
      typeof value === "object"
    ) {
      control.value =
        JSON.stringify(
          value,
          null,
          2
        );

      return;
    }

    control.value =
      value === null ||
      value === undefined
        ? ""
        : String(value);
  }

  function visibleLabelsFromDraft(draft) {
    const source =
      objectValue(draft);

    const candidates = [
      source.visible_field_labels,
      source.visibleFieldLabels,
      source.draft &&
        source.draft.visible_field_labels,
      source.specialist &&
        source.specialist.visible_field_labels,
      source.specialist &&
        source.specialist.draft &&
        source.specialist.draft.visible_field_labels
    ];

    return (
      candidates.find(Array.isArray) ||
      []
    ).map(String);
  }

  function valueExists(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return false;
    }

    if (Array.isArray(value)) {
      return value.length > 0;
    }

    return true;
  }

  function wrapperCodes(wrapper) {
    return String(
      wrapper.dataset.utilityFieldCodes ||
      ""
    )
      .split(",")
      .map(function (code) {
        return code.trim();
      })
      .filter(Boolean);
  }

  function applyVisibility(labels) {
    const normalized =
      Array.isArray(labels)
        ? labels.map(String)
        : [];

    lastVisibleFieldLabels =
      normalized;

    const visibleSet =
      new Set(normalized);

    document.querySelectorAll(
      "[data-utility-field-codes]"
    ).forEach(function (wrapper) {
      const codes =
        wrapperCodes(wrapper);

      const hasValue =
        codes.some(function (code) {
          return valueExists(
            lastDraft
              ? draftValue(lastDraft, code)
              : undefined
          );
        });

      const alwaysVisible =
        codes.includes("line_items") ||
        codes.includes("warnings") ||
        codes.includes("confirmation_notes");

      wrapper.hidden =
        !showAllFields &&
        !alwaysVisible &&
        !hasValue &&
        !codes.some(function (code) {
          return visibleSet.has(code);
        });
    });

    document.querySelectorAll(
      "[data-utility-section]"
    ).forEach(function (section) {
      const fields =
        Array.from(
          section.querySelectorAll(
            ".utility-dedicated-field, [data-utility-field-codes]"
          )
        );

      const hasVisible =
        fields.some(function (field) {
          return !field.hidden;
        });

      section.classList.toggle(
        "utility-section-empty",
        !showAllFields &&
        !hasVisible
      );
    });

    const button =
      document.getElementById(
        "utilityShowAllFieldsButton"
      );

    if (button) {
      button.setAttribute(
        "aria-pressed",
        showAllFields
          ? "true"
          : "false"
      );

      button.textContent =
        showAllFields
          ? "AI表示項目だけに戻す"
          : "全項目を表示";
    }
  }

  function lineItemsFromDraft(draft) {
    const candidates = [
      draftValue(draft, "line_items"),
      objectValue(draft).line_items,
      objectValue(draft).lineItems
    ];

    return (
      candidates.find(Array.isArray) ||
      []
    );
  }

  function applyDraft(draft) {
    if (
      !draft ||
      typeof draft !== "object"
    ) {
      return;
    }

    lastDraft =
      draft;

    document.querySelectorAll(
      "[data-analysis-item-code]"
    ).forEach(function (control) {
      const code =
        control.dataset.analysisItemCode;

      if (!code) {
        return;
      }

      const value =
        draftValue(
          draft,
          code
        );

      if (value === undefined) {
        return;
      }

      setControlValue(
        control,
        value
      );
    });

    const lineItems =
      lineItemsFromDraft(draft);

    if (
      typeof window.hdOriginSetUtilityLineItems ===
      "function"
    ) {
      window.hdOriginSetUtilityLineItems(
        lineItems
      );
    }

    const labels =
      visibleLabelsFromDraft(draft);

    if (labels.length) {
      lastVisibleFieldLabels =
        labels;
    }

    applyVisibility(
      lastVisibleFieldLabels
    );

    window.__hdOriginUtilityDedicatedLast = {
      applied: true,
      visibleFieldLabels:
        lastVisibleFieldLabels.slice(),
      lineItemCount:
        lineItems.length,
      aiExecution:
        false
    };
  }

  function patchAfter(name, after) {
    const original =
      window[name];

    if (
      typeof original !== "function" ||
      original.__hdOriginUtilityDedicatedPatched
    ) {
      return;
    }

    const wrapped =
      function () {
        const result =
          original.apply(
            this,
            arguments
          );

        try {
          after.apply(
            this,
            arguments
          );
        }
        catch (error) {
          console.warn(
            name +
            " 公共料金専用反映エラー:",
            error
          );
        }

        return result;
      };

    wrapped.__hdOriginUtilityDedicatedPatched =
      true;

    window[name] =
      wrapped;
  }

  function patchApplicationFunctions() {
    patchAfter(
      "applyAiDraftToFormHardDebug",
      function (draft) {
        applyDraft(draft);
      }
    );

    patchAfter(
      "applySortingOnlyDraftToForm",
      function (draft) {
        applyDraft(draft);
      }
    );

    patchAfter(
      "showVisibleFieldsOnly",
      function (labels) {
        applyVisibility(
          Array.isArray(labels)
            ? labels
            : lastVisibleFieldLabels
        );
      }
    );
  }

  function controlValue(control) {
    if (!control) {
      return "";
    }

    if (control.type === "checkbox") {
      return !!control.checked;
    }

    if (control.tagName === "SELECT") {
      const option =
        control.options[
          control.selectedIndex
        ];

      if (
        control.dataset.analysisCodeTarget
      ) {
        const codeControl =
          document.querySelector(
            '[data-analysis-item-code="' +
            control.dataset.analysisCodeTarget +
            '"]'
          );

        if (codeControl) {
          codeControl.value =
            option
              ? (
                  option.dataset.code ||
                  option.value ||
                  ""
                )
              : "";
        }
      }

      return option
        ? (
            String(
              option.textContent ||
              ""
            ).trim() ||
            option.value ||
            ""
          )
        : "";
    }

    return control.value === null ||
      control.value === undefined
        ? ""
        : String(control.value).trim();
  }

  function isVisibleField(control) {
    const wrapper =
      control.closest(
        "[data-utility-field-codes]"
      );

    return !wrapper ||
      !wrapper.hidden;
  }

  function collectFields() {
    const fields = {};

    document.querySelectorAll(
      "[data-analysis-item-code]"
    ).forEach(function (control) {
      const code =
        control.dataset.analysisItemCode;

      if (!code) {
        return;
      }

      const value =
        controlValue(control);

      const hasValue =
        value !== "" &&
        value !== null &&
        value !== undefined;

      if (
        hasValue ||
        isVisibleField(control)
      ) {
        fields[code] =
          value;
      }
    });

    if (
      typeof window.hdOriginGetUtilityLineItems ===
      "function"
    ) {
      const lineItems =
        window.hdOriginGetUtilityLineItems();

      if (
        Array.isArray(lineItems)
      ) {
        fields.line_items =
          lineItems;
      }
    }

    return fields;
  }

  function rawFields(payload) {
    const raw =
      objectValue(payload.rawResult);

    const candidates = [
      raw.draft &&
        raw.draft.fields,
      raw.specialist &&
        raw.specialist.draft &&
        raw.specialist.draft.fields,
      raw.fields,
      payload.specialistFields,
      payload.specialist_fields
    ];

    return objectValue(
      candidates.find(function (value) {
        return value &&
          typeof value === "object" &&
          !Array.isArray(value);
      })
    );
  }

  function selectedOcrId() {
    if (
      typeof window.findSelectedOcrImportId ===
      "function"
    ) {
      const id =
        Number(
          window.findSelectedOcrImportId()
        );

      if (id > 0) {
        return id;
      }
    }

    const restored =
      objectValue(
        window.__hdOriginUtilitySavedRestoreLast
      );

    return Number(
      restored.paymentDocumentOcrImportId ||
      0
    );
  }

  function installFetchPatch() {
    if (
      window.__hdOriginUtilityDedicatedFetchPatched
    ) {
      return;
    }

    const nativeFetch =
      window.fetch.bind(window);

    window.fetch =
      function (input, init) {
        const url =
          typeof input === "string"
            ? input
            : (
                input &&
                input.url
                  ? input.url
                  : ""
              );

        if (
          !url.includes(SAVE_ENDPOINT) ||
          !init ||
          typeof init.body !== "string"
        ) {
          return nativeFetch(
            input,
            init
          );
        }

        try {
          const payload =
            JSON.parse(init.body);

          const ocrId =
            Number(
              payload.paymentDocumentOcrImportId ||
              0
            );

          const selected =
            selectedOcrId();

          const collected =
            collectFields();

          const extracted =
            rawFields(payload);

          const useCurrentScreen =
            !selected ||
            !ocrId ||
            selected === ocrId;

          payload.fields =
            Object.assign(
              {},
              extracted,
              objectValue(payload.fields),
              useCurrentScreen
                ? collected
                : {}
            );

          payload.visibleFields =
            Object.assign(
              {},
              extracted,
              objectValue(
                payload.visibleFields ||
                payload.visible_fields
              ),
              useCurrentScreen
                ? collected
                : {}
            );

          if (useCurrentScreen) {
            payload.humanCorrections =
              Object.assign(
                {},
                objectValue(
                  payload.humanCorrections
                ),
                collected
              );

            if (
              Array.isArray(
                collected.line_items
              )
            ) {
              payload.lineItems =
                collected.line_items;
            }

            const warningControl =
              document.getElementById(
                "draftWarnings"
              );

            if (warningControl) {
              payload.warnings =
                String(
                  warningControl.value ||
                  ""
                )
                  .split(/\r?\n/)
                  .map(function (line) {
                    return line.trim();
                  })
                  .filter(Boolean);
            }
          }

          const nextInit =
            Object.assign(
              {},
              init,
              {
                body:
                  JSON.stringify(payload)
              }
            );

          return nativeFetch(
            input,
            nextInit
          );
        }
        catch (error) {
          console.warn(
            "公共料金・通信費保存データ統合に失敗しました。",
            error
          );

          return nativeFetch(
            input,
            init
          );
        }
      };

    window.__hdOriginUtilityDedicatedFetchPatched =
      true;
  }

  function installUi() {
    const button =
      document.getElementById(
        "utilityShowAllFieldsButton"
      );

    if (
      button &&
      !button.dataset.utilityInstalled
    ) {
      button.dataset.utilityInstalled =
        "1";

      button.addEventListener(
        "click",
        function () {
          showAllFields =
            !showAllFields;

          applyVisibility(
            lastVisibleFieldLabels
          );
        }
      );
    }

    applyVisibility(
      lastVisibleFieldLabels
    );
  }

  window.hdOriginApplyUtilityDedicatedDraft =
    applyDraft;

  window.hdOriginCollectUtilityDedicatedFields =
    collectFields;

  patchApplicationFunctions();
  installFetchPatch();

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      function () {
        patchApplicationFunctions();
        installUi();
      },
      {
        once: true
      }
    );
  }
  else {
    installUi();
  }

  setTimeout(
    patchApplicationFunctions,
    250
  );

  setTimeout(
    function () {
      patchApplicationFunctions();

      if (lastDraft) {
        applyDraft(lastDraft);
      }
    },
    1000
  );
})();
/* GPT3_UTILITY_DEDICATED_SCREEN_JS_END */