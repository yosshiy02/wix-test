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

/* GPT3_UTILITY_BULK_ANALYZE_SAVE_FIX_START */
(function () {
  "use strict";

  const ANALYSIS_SYSTEM_CODE =
    "utility_communication_analysis";

  const ANALYSIS_SYSTEM_LABEL =
    "公共料金・通信費専門解析システム";

  function objectValue(value) {
    return value &&
      typeof value === "object" &&
      !Array.isArray(value)
        ? value
        : {};
  }

  function firstValue() {
    for (
      let index = 0;
      index < arguments.length;
      index++
    ) {
      const value =
        arguments[index];

      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        return value;
      }
    }

    return "";
  }

  function textValue(value) {
    return value === undefined ||
      value === null
        ? ""
        : String(value).trim();
  }

  function utilityItems() {
    try {
      return Array.isArray(items)
        ? items
        : [];
    }
    catch (error) {
      return [];
    }
  }

  function showReport(value) {
    if (
      typeof window.showResult ===
      "function"
    ) {
      window.showResult(value);
      return;
    }

    try {
      if (
        typeof showResult ===
        "function"
      ) {
        showResult(value);
        return;
      }
    }
    catch (error) {
    }

    console.log(value);
  }

  function renderList() {
    if (
      typeof window.renderSortingList ===
      "function"
    ) {
      window.renderSortingList();
      return;
    }

    try {
      if (
        typeof renderSortingList ===
        "function"
      ) {
        renderSortingList();
      }
    }
    catch (error) {
    }
  }

  function ocrIdOf(item) {
    if (
      typeof window.ocrImportIdOf ===
      "function"
    ) {
      return Number(
        window.ocrImportIdOf(item) ||
        0
      );
    }

    const source =
      objectValue(item);

    return Number(
      firstValue(
        source.paymentDocumentOcrImportId,
        source.payment_document_ocr_import_id,
        source.ocrImportId,
        source.ocr_import_id,
        source.id,
        0
      )
    );
  }

  function sortingDraftIdOf(item, rawResult) {
    const source =
      objectValue(item);

    const raw =
      objectValue(rawResult);

    const draft =
      objectValue(
        firstValue(
          raw.draft,
          source.__aiDraft
        )
      );

    const sorting =
      objectValue(
        firstValue(
          source.sortingDraft,
          source.sorting_draft
        )
      );

    return Number(
      firstValue(
        source.paymentDocumentSortingDraftId,
        source.payment_document_sorting_draft_id,
        source.sortingDraftId,
        source.sorting_draft_id,
        source.latestSortingDraftId,
        source.latest_sorting_draft_id,

        raw.paymentDocumentSortingDraftId,
        raw.payment_document_sorting_draft_id,

        draft.paymentDocumentSortingDraftId,
        draft.payment_document_sorting_draft_id,

        sorting.paymentDocumentSortingDraftId,
        sorting.payment_document_sorting_draft_id,
        sorting.id,
        0
      )
    );
  }

  function selectedIndexes() {
    if (
      typeof window.selectedSortingIndexes ===
      "function"
    ) {
      const result =
        window.selectedSortingIndexes();

      if (Array.isArray(result)) {
        return result;
      }
    }

    try {
      if (
        typeof selectedSortingIndexes ===
        "function"
      ) {
        const result =
          selectedSortingIndexes();

        if (Array.isArray(result)) {
          return result;
        }
      }
    }
    catch (error) {
    }

    const checked =
      window.__checkedOcrImportIds instanceof Set
        ? window.__checkedOcrImportIds
        : new Set();

    return utilityItems()
      .map(function (item, index) {
        return {
          index:
            index,

          id:
            String(
              ocrIdOf(item) ||
              ""
            )
        };
      })
      .filter(function (row) {
        return (
          row.id &&
          checked.has(row.id)
        );
      })
      .map(function (row) {
        return row.index;
      });
  }

  function itemName(item, index) {
    const source =
      objectValue(item);

    return textValue(
      firstValue(
        source.originalFileName,
        source.original_file_name,
        source.fileName,
        source.file_name,
        source.savedFileName,
        source.saved_file_name,
        "No." + String(index + 1)
      )
    );
  }

  function rawResultOf(item) {
    const source =
      objectValue(item);

    return objectValue(
      firstValue(
        source.__aiRawResult,
        source.aiRawResult,
        source.ai_raw_result
      )
    );
  }

  function draftOf(item, rawResult) {
    const source =
      objectValue(item);

    const raw =
      objectValue(rawResult);

    return objectValue(
      firstValue(
        raw.draft,
        raw.aiDraft,
        raw.ai_draft,
        source.__aiDraft,
        source.aiDraft,
        source.ai_draft
      )
    );
  }

  function validFields(value) {
    return (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length > 0
    );
  }

  function fieldsOf(item, rawResult) {
    const raw =
      objectValue(rawResult);

    const draft =
      draftOf(
        item,
        raw
      );

    const candidates = [
      draft.fields,
      draft.specialist_fields,
      draft.specialistFields,

      raw.fields,
      raw.specialist_fields,
      raw.specialistFields
    ];

    for (const candidate of candidates) {
      if (validFields(candidate)) {
        return Object.assign(
          {},
          candidate
        );
      }
    }

    const ignored =
      new Set([
        "visible_field_labels",
        "visibleFieldLabels",
        "warnings",
        "reason",
        "ai_reason",
        "aiReason",
        "confidence",
        "ai_confidence",
        "aiConfidence",
        "document_group",
        "documentGroup",
        "analysis_system_code",
        "analysisSystemCode",
        "analysis_system_label",
        "analysisSystemLabel",
        "analysis_system_reason",
        "analysisSystemReason",
        "analysis_system_confidence",
        "analysisSystemConfidence",
        "specialist_route_code",
        "specialistRouteCode",
        "specialist_route_label",
        "specialistRouteLabel",
        "ai_steps",
        "aiSteps",
        "image_used",
        "imageUsed",
        "ok",
        "message",
        "error"
      ]);

    const result = {};

    Object.entries(draft).forEach(
      function (entry) {
        const key =
          entry[0];

        const value =
          entry[1];

        if (
          !ignored.has(key) &&
          value !== undefined
        ) {
          result[key] =
            value;
        }
      }
    );

    return result;
  }

  function visibleLabelsOf(item, rawResult) {
    const source =
      objectValue(item);

    const raw =
      objectValue(rawResult);

    const draft =
      draftOf(
        item,
        raw
      );

    return (
      [
        raw.visible_field_labels,
        raw.visibleFieldLabels,
        draft.visible_field_labels,
        draft.visibleFieldLabels,
        source.__visibleFieldLabels
      ].find(Array.isArray) ||
      []
    ).map(String);
  }

  function warningsOf(item, rawResult) {
    const raw =
      objectValue(rawResult);

    const draft =
      draftOf(
        item,
        raw
      );

    return (
      [
        raw.warnings,
        draft.warnings
      ].find(Array.isArray) ||
      []
    );
  }

  function rawLinesOf(item, rawResult, fields) {
    const raw =
      objectValue(rawResult);

    const draft =
      draftOf(
        item,
        raw
      );

    const fieldObject =
      objectValue(fields);

    return (
      [
        raw.line_items,
        raw.lineItems,

        draft.line_items,
        draft.lineItems,

        objectValue(draft.fields).line_items,
        objectValue(draft.fields).lineItems,

        objectValue(
          draft.specialist_fields
        ).line_items,

        objectValue(
          draft.specialistFields
        ).lineItems,

        fieldObject.line_items,
        fieldObject.lineItems
      ].find(Array.isArray) ||
      []
    );
  }

  function normalizeLines(item, rawResult, fields) {
    return rawLinesOf(
      item,
      rawResult,
      fields
    ).map(
      function (source, index) {
        const line =
          objectValue(source);

        return {
          line_no:
            Number(
              firstValue(
                line.line_no,
                line.lineNo,
                index + 1
              )
            ),

          item_name:
            textValue(
              firstValue(
                line.item_name,
                line.itemName,
                line.name,
                line.title
              )
            ),

          description:
            textValue(
              firstValue(
                line.description,
                line.detail,
                line.details
              )
            ),

          usage_quantity:
            firstValue(
              line.usage_quantity,
              line.usageQuantity,
              line.quantity,
              ""
            ),

          usage_unit:
            textValue(
              firstValue(
                line.usage_unit,
                line.usageUnit,
                line.unit
              )
            ),

          unit_price:
            firstValue(
              line.unit_price,
              line.unitPrice,
              ""
            ),

          subtotal_amount:
            firstValue(
              line.subtotal_amount,
              line.subtotalAmount,
              line.amount,
              ""
            ),

          tax_category_id:
            firstValue(
              line.tax_category_id,
              line.taxCategoryId,
              ""
            ),

          tax_category_code:
            textValue(
              firstValue(
                line.tax_category_code,
                line.taxCategoryCode
              )
            ),

          tax_category_label:
            textValue(
              firstValue(
                line.tax_category_label,
                line.taxCategoryLabel
              )
            ),

          tax_rate:
            firstValue(
              line.tax_rate,
              line.taxRate,
              ""
            ),

          tax_amount:
            firstValue(
              line.tax_amount,
              line.taxAmount,
              ""
            ),

          total_amount:
            firstValue(
              line.total_amount,
              line.totalAmount,
              ""
            ),

          source_text:
            textValue(
              firstValue(
                line.source_text,
                line.sourceText,
                line.raw_text,
                line.rawText,
                line.original_text,
                line.originalText
              )
            )
        };
      }
    );
  }

  function validateLines(lines) {
    if (!lines.length) {
      throw new Error(
        "料金明細が0行です。保存しません。"
      );
    }

    lines.forEach(
      function (line, index) {
        if (!line.item_name) {
          throw new Error(
            "料金明細" +
            String(index + 1) +
            "行目の料金項目名が空です。"
          );
        }

        if (!line.source_text) {
          throw new Error(
            "料金明細" +
            String(index + 1) +
            "行目のOCR根拠が空です。"
          );
        }
      }
    );
  }

  function verifyRawOcrId(item, rawResult) {
    const expectedId =
      ocrIdOf(item);

    const raw =
      objectValue(rawResult);

    const draft =
      draftOf(
        item,
        raw
      );

    const actualId =
      Number(
        firstValue(
          raw.paymentDocumentOcrImportId,
          raw.payment_document_ocr_import_id,
          raw.ocrImportId,
          raw.ocr_import_id,

          draft.paymentDocumentOcrImportId,
          draft.payment_document_ocr_import_id,
          draft.ocrImportId,
          draft.ocr_import_id,
          0
        )
      );

    if (
      actualId > 0 &&
      actualId !== expectedId
    ) {
      throw new Error(
        "AI結果のOCR IDが対象書類と一致しません。" +
        " 対象=" +
        String(expectedId) +
        " AI結果=" +
        String(actualId)
      );
    }
  }

  function postJsonDirect(url, payload) {
    return new Promise(
      function (resolve, reject) {
        const request =
          new XMLHttpRequest();

        request.open(
          "POST",
          url,
          true
        );

        request.setRequestHeader(
          "Content-Type",
          "application/json; charset=utf-8"
        );

        request.setRequestHeader(
          "Accept",
          "application/json"
        );

        request.onreadystatechange =
          function () {
            if (request.readyState !== 4) {
              return;
            }

            let body = {};

            try {
              body =
                request.responseText
                  ? JSON.parse(
                      request.responseText
                    )
                  : {};
            }
            catch (error) {
              reject(
                new Error(
                  "保存APIの応答がJSONではありません。" +
                  " STATUS=" +
                  String(request.status)
                )
              );

              return;
            }

            if (
              request.status < 200 ||
              request.status >= 300 ||
              !body.ok
            ) {
              reject(
                new Error(
                  body.error ||
                  body.message ||
                  (
                    "保存APIに失敗しました。" +
                    " STATUS=" +
                    String(request.status)
                  )
                )
              );

              return;
            }

            resolve(body);
          };

        request.onerror =
          function () {
            reject(
              new Error(
                "保存APIとの通信に失敗しました。"
              )
            );
          };

        request.send(
          JSON.stringify(payload)
        );
      }
    );
  }

  async function getSaved(id) {
    const response =
      await fetch(
        "/api/payment-documents/utility-communication/saved/" +
        encodeURIComponent(
          String(id)
        ),
        {
          cache:
            "no-store",

          headers: {
            Accept:
              "application/json"
          }
        }
      );

    const body =
      await response.json().catch(
        function () {
          return {};
        }
      );

    if (
      !response.ok ||
      !body.ok
    ) {
      throw new Error(
        body.error ||
        body.message ||
        "保存後データを確認できません。"
      );
    }

    return body;
  }

  function savedFieldsOf(saved) {
    const root =
      objectValue(saved);

    const draft =
      objectValue(
        firstValue(
          root.draft,
          root.savedDraft,
          root.utilityDraft
        )
      );

    const candidates = [
      root.fields,
      root.specialist_fields,
      root.specialistFields,
      draft.fields,
      draft.specialist_fields,
      draft.specialistFields
    ];

    for (const candidate of candidates) {
      if (validFields(candidate)) {
        return candidate;
      }
    }

    return draft;
  }

  function savedLinesOf(saved) {
    const root =
      objectValue(saved);

    const fields =
      savedFieldsOf(root);

    return (
      [
        root.line_items,
        root.lineItems,
        fields.line_items,
        fields.lineItems
      ].find(Array.isArray) ||
      []
    );
  }

  function numberKey(value) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "";
    }

    const number =
      Number(value);

    return Number.isFinite(number)
      ? String(number)
      : textValue(value);
  }

  function lineSignature(line) {
    const source =
      objectValue(line);

    return [
      textValue(
        firstValue(
          source.item_name,
          source.itemName
        )
      ),

      numberKey(
        firstValue(
          source.subtotal_amount,
          source.subtotalAmount
        )
      ),

      numberKey(
        firstValue(
          source.tax_amount,
          source.taxAmount
        )
      ),

      numberKey(
        firstValue(
          source.total_amount,
          source.totalAmount
        )
      ),

      textValue(
        firstValue(
          source.source_text,
          source.sourceText
        )
      )
    ].join("|");
  }

  async function verifySaved(
    expectedOcrId,
    expectedFields,
    expectedLines
  ) {
    const saved =
      await getSaved(
        expectedOcrId
      );

    const savedOcrId =
      Number(
        firstValue(
          saved.paymentDocumentOcrImportId,
          saved.payment_document_ocr_import_id,
          saved.ocrImportId,
          saved.ocr_import_id,
          expectedOcrId
        )
      );

    if (savedOcrId !== expectedOcrId) {
      throw new Error(
        "保存後のOCR IDが一致しません。"
      );
    }

    const savedFields =
      savedFieldsOf(saved);

    const savedLines =
      savedLinesOf(saved);

    if (!Object.keys(savedFields).length) {
      throw new Error(
        "保存後の専門項目が0件です。"
      );
    }

    const missingFields =
      Object.keys(expectedFields).filter(
        function (name) {
          return !Object.prototype.hasOwnProperty.call(
            savedFields,
            name
          );
        }
      );

    if (missingFields.length) {
      throw new Error(
        "保存後に専門項目が欠落しています。" +
        " 欠落=" +
        missingFields.join(",")
      );
    }

    if (
      savedLines.length !==
      expectedLines.length
    ) {
      throw new Error(
        "保存後の料金明細行数が一致しません。" +
        " 期待=" +
        String(expectedLines.length) +
        " 保存=" +
        String(savedLines.length)
      );
    }

    for (
      let index = 0;
      index < expectedLines.length;
      index++
    ) {
      if (
        lineSignature(expectedLines[index]) !==
        lineSignature(savedLines[index])
      ) {
        throw new Error(
          "保存後の料金明細がAI結果と一致しません。" +
          " 行=" +
          String(index + 1)
        );
      }
    }

    return {
      specialistAnalysisId:
        firstValue(
          saved.specialistAnalysisId,
          saved.specialist_analysis_id,
          null
        ),

      utilityCommunicationDraftId:
        firstValue(
          saved.utilityCommunicationDraftId,
          saved.utility_communication_draft_id,
          null
        ),

      fieldNames:
        Object.keys(savedFields),

      lineItemCount:
        savedLines.length
    };
  }

  async function saveDirectItem(item) {
    const ocrId =
      ocrIdOf(item);

    if (!ocrId) {
      throw new Error(
        "OCR保存IDがありません。"
      );
    }

    const rawResult =
      rawResultOf(item);

    if (!Object.keys(rawResult).length) {
      throw new Error(
        "この書類のAI生結果がありません。" +
        "先にまとめて専門解析を実行してください。"
      );
    }

    verifyRawOcrId(
      item,
      rawResult
    );

    const draft =
      draftOf(
        item,
        rawResult
      );

    const fields =
      fieldsOf(
        item,
        rawResult
      );

    if (!Object.keys(fields).length) {
      throw new Error(
        "専門AI結果のfieldsが0件です。保存しません。"
      );
    }

    const lines =
      normalizeLines(
        item,
        rawResult,
        fields
      );

    validateLines(lines);

    const sortingDraftId =
      sortingDraftIdOf(
        item,
        rawResult
      );

    const commonPayload = {
      paymentDocumentOcrImportId:
        ocrId,

      payment_document_ocr_import_id:
        ocrId,

      analysisSystemCode:
        ANALYSIS_SYSTEM_CODE,

      analysis_system_code:
        ANALYSIS_SYSTEM_CODE,

      analysisSystemLabel:
        ANALYSIS_SYSTEM_LABEL,

      analysis_system_label:
        ANALYSIS_SYSTEM_LABEL,

      specialistAnalysisStatus:
        "保存済み",

      specialist_analysis_status:
        "保存済み",

      humanConfirmStatus:
        "未確認",

      human_confirm_status:
        "未確認",

      humanMemo:
        "公共料金・通信費まとめて保存（AI結果直接保存）",

      human_memo:
        "公共料金・通信費まとめて保存（AI結果直接保存）",

      draft:
        draft,

      aiDraft:
        draft,

      fields:
        fields,

      specialistFields:
        fields,

      specialist_fields:
        fields,

      visibleFields:
        fields,

      visible_fields:
        fields,

      visible_field_labels:
        visibleLabelsOf(
          item,
          rawResult
        ),

      lineItems:
        lines,

      line_items:
        lines,

      warnings:
        warningsOf(
          item,
          rawResult
        ),

      rawResult:
        rawResult,

      raw_result:
        rawResult,

      memo:
        "公共料金・通信費まとめて保存（AI結果直接保存）"
    };

    if (sortingDraftId > 0) {
      commonPayload.paymentDocumentSortingDraftId =
        sortingDraftId;

      commonPayload.payment_document_sorting_draft_id =
        sortingDraftId;
    }

    const commonSaved =
      await postJsonDirect(
        "/api/payment-documents/specialist-analysis-results/save",
        commonPayload
      );

    const specialistAnalysisId =
      Number(
        firstValue(
          commonSaved.specialistAnalysisId,
          commonSaved.specialist_analysis_id,
          commonSaved.latestSpecialistAnalysisId,
          0
        )
      );

    if (!specialistAnalysisId) {
      throw new Error(
        "共通専門保存後の専門解析IDがありません。"
      );
    }

    const returnedOcrId =
      Number(
        firstValue(
          commonSaved.paymentDocumentOcrImportId,
          commonSaved.payment_document_ocr_import_id,
          ocrId
        )
      );

    if (returnedOcrId !== ocrId) {
      throw new Error(
        "共通専門保存後のOCR IDが一致しません。"
      );
    }

    const returnedSortingDraftId =
      Number(
        firstValue(
          commonSaved.paymentDocumentSortingDraftId,
          commonSaved.payment_document_sorting_draft_id,
          sortingDraftId,
          0
        )
      );

    const utilityPayload = {
      paymentDocumentOcrImportId:
        ocrId,

      payment_document_ocr_import_id:
        ocrId,

      specialistAnalysisId:
        specialistAnalysisId,

      specialist_analysis_id:
        specialistAnalysisId,

      fields:
        fields,

      specialistFields:
        fields,

      specialist_fields:
        fields,

      visibleFields:
        fields,

      visible_fields:
        fields,

      humanCorrections:
        {},

      human_corrections:
        {},

      rawResult:
        rawResult,

      raw_result:
        rawResult,

      lineItems:
        lines,

      line_items:
        lines,

      warnings:
        warningsOf(
          item,
          rawResult
        ),

      createdByPage:
        "payment-document-specialist-utility-communication.html",

      created_by_page:
        "payment-document-specialist-utility-communication.html"
    };

    if (returnedSortingDraftId > 0) {
      utilityPayload.paymentDocumentSortingDraftId =
        returnedSortingDraftId;

      utilityPayload.payment_document_sorting_draft_id =
        returnedSortingDraftId;
    }

    const utilitySaved =
      await postJsonDirect(
        "/api/payment-documents/utility-communication-drafts/save",
        utilityPayload
      );

    const verified =
      await verifySaved(
        ocrId,
        fields,
        lines
      );

    return {
      ok:
        true,

      paymentDocumentOcrImportId:
        ocrId,

      specialistAnalysisId:
        specialistAnalysisId,

      utilityCommunicationDraftId:
        firstValue(
          utilitySaved.utilityCommunicationDraftId,
          utilitySaved.utility_communication_draft_id,
          verified.utilityCommunicationDraftId
        ),

      fieldNames:
        verified.fieldNames,

      lineItemCount:
        verified.lineItemCount,

      saveSource:
        "item.__aiRawResult_direct",

      domRead:
        false,

      aiExecution:
        false
    };
  }

  /* GPT3_UTILITY_BULK_ANALYZE_ONLY_START */
  window.runSelectedAiDrafts =
    async function () {
      const indexes =
        selectedIndexes();

      if (!indexes.length) {
        showReport(
          "まとめて専門解析する書類にチェックを入れてください。"
        );

        return;
      }

      const button =
        document.querySelector(
          ".sorting-bulk-analyze"
        );

      const originalText =
        button
          ? button.textContent
          : "";

      if (button) {
        button.disabled =
          true;

        button.textContent =
          "専門解析中...";
      }

      const results = [];
      let success = 0;
      let failed = 0;

      try {
        for (
          let position = 0;
          position < indexes.length;
          position++
        ) {
          const index =
            indexes[position];

          const item =
            utilityItems()[index];

          const ocrId =
            ocrIdOf(item);

          const name =
            itemName(
              item,
              index
            );

          showReport(
            "まとめて専門解析中: " +
            String(position + 1) +
            " / " +
            String(indexes.length) +
            "\n" +
            name
          );

          try {
            if (!ocrId) {
              throw new Error(
                "OCR保存IDがありません。"
              );
            }

            const response =
              await fetch(
                "/api/payment-documents/ai-specialist/" +
                encodeURIComponent(
                  String(ocrId)
                ),
                {
                  method:
                    "POST",

                  headers: {
                    "Content-Type":
                      "application/json"
                  }
                }
              );

            const data =
              await response.json();

            if (
              !response.ok ||
              !data.ok
            ) {
              throw new Error(
                data.error ||
                data.message ||
                "専門解析に失敗しました。"
              );
            }

            const fields =
              fieldsOf(
                item,
                data
              );

            if (!Object.keys(fields).length) {
              throw new Error(
                "専門AI結果のfieldsが0件です。"
              );
            }

            const lines =
              normalizeLines(
                item,
                data,
                fields
              );

            validateLines(lines);

            item.__aiRawResult =
              data;

            /* GPT3_UTILITY_ANALYZE_DIRECT_RENDER_START */
            item.__aiDraft =
              draftOf(
                item,
                data
              );

            item.__visibleFieldLabels =
              visibleLabelsOf(
                item,
                data
              );

            item.__utilityUnsavedAiResult =
              true;

            let isCurrentUtilityItem =
              false;

            try {
              isCurrentUtilityItem =
                utilityItems()[selectedIndex] ===
                item;
            }
            catch (error) {
              isCurrentUtilityItem =
                false;
            }

            if (isCurrentUtilityItem) {
              if (
                typeof window.hdOriginApplyUtilityDedicatedDraft ===
                  "function"
              ) {
                window.hdOriginApplyUtilityDedicatedDraft(
                  item.__aiDraft
                );
              }

              if (
                typeof window.hdOriginApplyUtilityCommunicationFields ===
                  "function"
              ) {
                window.hdOriginApplyUtilityCommunicationFields(
                  item.__aiDraft
                );
              }

              if (
                typeof window.hdOriginApplyUtilityLineItems ===
                  "function"
              ) {
                window.hdOriginApplyUtilityLineItems(
                  data
                );
              }

              if (
                typeof showVisibleFieldsOnly ===
                  "function"
              ) {
                showVisibleFieldsOnly(
                  item.__visibleFieldLabels || []
                );
              }
            }
            /* GPT3_UTILITY_ANALYZE_DIRECT_RENDER_END */

            item.__aiDraft =
              data.draft || {};

            item.__visibleFieldLabels =
              visibleLabelsOf(
                item,
                data
              );

            item.__documentGroup =
              firstValue(
                data.document_group,
                data.documentGroup,
                ""
              );

            item.__aiSteps =
              Array.isArray(data.ai_steps)
                ? data.ai_steps
                : [];

            success++;

            results.push({
              ok:
                true,

              name:
                name,

              paymentDocumentOcrImportId:
                ocrId,

              fieldNames:
                Object.keys(fields),

              lineItemCount:
                lines.length,

              databaseSaved:
                false
            });
          }
          catch (error) {
            failed++;

            results.push({
              ok:
                false,

              name:
                name,

              paymentDocumentOcrImportId:
                ocrId || null,

              error:
                error.message || String(error)
            });
          }
        }

        renderList();

        window.__hdOriginUtilityBulkAnalyzeLast = {
          ok:
            failed === 0,

          success:
            success,

          failed:
            failed,

          results:
            results,

          aiExecution:
            true,

          databaseSave:
            false,

          completedAt:
            new Date().toISOString()
        };

        showReport({
          ok:
            failed === 0,

          message:
            "まとめて専門解析が完了しました。まだDBへ保存していません。",

          success:
            success,

          failed:
            failed,

          results:
            results
        });
      }
      finally {
        if (button) {
          button.disabled =
            false;

          button.textContent =
            originalText ||
            "まとめて専門解析";
        }
      }
    };
  /* GPT3_UTILITY_BULK_ANALYZE_ONLY_END */

  /* GPT3_UTILITY_BULK_SAVE_ONLY_START */
  window.runSelectedUtilitySaves =
    async function () {
      const indexes =
        selectedIndexes();

      if (!indexes.length) {
        showReport(
          "まとめて保存する書類にチェックを入れてください。"
        );

        return;
      }

      const button =
        document.getElementById(
          "utilityBulkSaveAnalyzedButton"
        );

      const originalText =
        button
          ? button.textContent
          : "";

      if (button) {
        button.disabled =
          true;

        button.textContent =
          "保存中...";
      }

      const results = [];
      let success = 0;
      let failed = 0;

      try {
        for (
          let position = 0;
          position < indexes.length;
          position++
        ) {
          const index =
            indexes[position];

          const item =
            utilityItems()[index];

          const ocrId =
            ocrIdOf(item);

          const name =
            itemName(
              item,
              index
            );

          showReport(
            "まとめて保存中: " +
            String(position + 1) +
            " / " +
            String(indexes.length) +
            "\n" +
            name
          );

          try {
            const saved =
              await saveDirectItem(item);

            success++;

            results.push(
              Object.assign(
                {
                  name:
                    name
                },
                saved
              )
            );
          }
          catch (error) {
            failed++;

            results.push({
              ok:
                false,

              name:
                name,

              paymentDocumentOcrImportId:
                ocrId || null,

              error:
                error.message || String(error)
            });
          }
        }

        renderList();

        window.__hdOriginUtilityBulkSaveLast = {
          ok:
            failed === 0,

          success:
            success,

          failed:
            failed,

          results:
            results,

          aiExecution:
            false,

          databaseSave:
            true,

          directItemSave:
            true,

          domRead:
            false,

          completedAt:
            new Date().toISOString()
        };

        showReport({
          ok:
            failed === 0,

          message:
            "まとめて保存が完了しました。各書類のAI結果から直接保存しました。",

          success:
            success,

          failed:
            failed,

          directItemSave:
            true,

          domRead:
            false,

          results:
            results
        });
      }
      finally {
        if (button) {
          button.disabled =
            false;

          button.textContent =
            originalText ||
            "まとめて保存";
        }
      }
    };
  /* GPT3_UTILITY_BULK_SAVE_ONLY_END */

  document.addEventListener(
    "DOMContentLoaded",
    function () {
      const analyzeButton =
        document.querySelector(
          ".sorting-bulk-analyze"
        );

      if (analyzeButton) {
        analyzeButton.textContent =
          "まとめて専門解析";

        analyzeButton.title =
          "選択書類を専門解析します。DB保存は行いません。";
      }

      const saveButton =
        document.getElementById(
          "utilityBulkSaveAnalyzedButton"
        );

      if (saveButton) {
        saveButton.textContent =
          "まとめて保存";

        saveButton.title =
          "各書類のAI結果を画面を経由せず直接保存します。";
      }
    },
    {
      once:
        true
    }
  );
})();
/* GPT3_UTILITY_BULK_ANALYZE_SAVE_FIX_END */

/* GPT3_UTILITY_COMMUNICATION_DISPLAY_COMPAT_V3_START */
(function () {
  "use strict";

  if (
    window.__hdOriginUtilityCommunicationDisplayCompatV3
  ) {
    return;
  }

  window.__hdOriginUtilityCommunicationDisplayCompatV3 =
    true;

  function objectValue(value) {
    return (
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    )
      ? value
      : {};
  }

  function firstValue() {
    for (
      let index = 0;
      index < arguments.length;
      index++
    ) {
      const value =
        arguments[index];

      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        return value;
      }
    }

    return "";
  }

  function normalizeAiResult(value) {
    const data =
      objectValue(value);

    const specialist =
      objectValue(
        firstValue(
          data.specialist,
          data.specialist_result
        )
      );

    const specialistDraft =
      objectValue(
        specialist.draft
      );

    if (Object.keys(specialistDraft).length) {
      data.draft =
        specialistDraft;
    }

    if (
      Array.isArray(
        specialist.visible_field_labels
      )
    ) {
      data.visible_field_labels =
        specialist.visible_field_labels.slice();
    }
    else if (
      Array.isArray(
        specialist.visibleFieldLabels
      )
    ) {
      data.visible_field_labels =
        specialist.visibleFieldLabels.slice();
    }

    if (
      Array.isArray(
        specialist.warnings
      )
    ) {
      data.warnings =
        specialist.warnings.slice();
    }

    return data;
  }

  function getItems() {
    try {
      return Array.isArray(items)
        ? items
        : [];
    }
    catch (error) {
      return [];
    }
  }

  function getSelectedItem() {
    try {
      return getItems()[selectedIndex] || null;
    }
    catch (error) {
      return null;
    }
  }

  function getOcrId(item) {
    const source =
      objectValue(item);

    return Number(
      firstValue(
        source.paymentDocumentOcrImportId,
        source.payment_document_ocr_import_id,
        source.ocrImportId,
        source.ocr_import_id,
        source.id,
        0
      )
    );
  }

  function getDraft(item) {
    const source =
      objectValue(item);

    const raw =
      normalizeAiResult(
        objectValue(
          source.__aiRawResult
        )
      );

    return objectValue(
      firstValue(
        raw.draft,
        source.__aiDraft
      )
    );
  }

  function getVisibleLabels(item) {
    const source =
      objectValue(item);

    const raw =
      normalizeAiResult(
        objectValue(
          source.__aiRawResult
        )
      );

    return (
      [
        raw.visible_field_labels,
        raw.visibleFieldLabels,
        source.__visibleFieldLabels
      ].find(Array.isArray) ||
      []
    );
  }

  function applyItemToScreen(item) {
    if (!item) {
      return false;
    }

    const draft =
      getDraft(item);

    const labels =
      getVisibleLabels(item);

    if (!Object.keys(draft).length) {
      return false;
    }

    let appliedCount = 0;

    try {
      if (
        typeof applySortingOnlyDraftToForm ===
        "function"
      ) {
        appliedCount =
          applySortingOnlyDraftToForm(
            draft
          ) || 0;
      }
      else if (
        typeof applyAiDraftToFormHardDebug ===
        "function"
      ) {
        appliedCount =
          applyAiDraftToFormHardDebug(
            draft
          ) || 0;
      }
    }
    catch (error) {
    }

    if (
      typeof window.hdOriginApplyUtilityDedicatedDraft ===
      "function"
    ) {
      window.hdOriginApplyUtilityDedicatedDraft(
        draft
      );
    }

    if (
      typeof window.hdOriginApplyUtilityLineItems ===
      "function"
    ) {
      window.hdOriginApplyUtilityLineItems(
        objectValue(
          item.__aiRawResult
        )
      );
    }

    try {
      if (
        typeof showVisibleFieldsOnly ===
        "function"
      ) {
        showVisibleFieldsOnly(
          labels
        );
      }
    }
    catch (error) {
    }

    window.__hdOriginUtilityCommunicationDisplayLast = {
      ok:
        true,

      paymentDocumentOcrImportId:
        getOcrId(item),

      draftKeys:
        Object.keys(draft),

      fieldKeys:
        Object.keys(
          objectValue(draft.fields)
        ),

      visibleFieldLabels:
        labels,

      appliedCount:
        appliedCount,

      source:
        "specialist.draft"
    };

    return true;
  }

  const originalFetch =
    window.fetch.bind(window);

  window.fetch =
    async function (input, init) {
      const response =
        await originalFetch(
          input,
          init
        );

      const url =
        String(
          input &&
          input.url
            ? input.url
            : input || ""
        );

      if (
        !url.includes(
          "/api/payment-documents/ai-specialist/"
        )
      ) {
        return response;
      }

      return new Proxy(
        response,
        {
          get:
            function (target, property) {
              if (property === "json") {
                return async function () {
                  const data =
                    await target.clone().json();

                  return normalizeAiResult(
                    data
                  );
                };
              }

              const value =
                Reflect.get(
                  target,
                  property,
                  target
                );

              return typeof value === "function"
                ? value.bind(target)
                : value;
            }
        }
      );
    };

  function installAnalyzeWrapper() {
    const original =
      window.runSelectedAiDrafts;

    if (
      typeof original !== "function" ||
      original.__utilityCommunicationDisplayWrapped
    ) {
      return;
    }

    const wrapped =
      async function () {
        const result =
          await original.apply(
            this,
            arguments
          );

        const last =
          objectValue(
            window.__hdOriginUtilityBulkAnalyzeLast
          );

        const successfulIds =
          new Set(
            (
              Array.isArray(last.results)
                ? last.results
                : []
            )
              .filter(function (row) {
                return (
                  row &&
                  row.ok === true
                );
              })
              .map(function (row) {
                return Number(
                  firstValue(
                    row.paymentDocumentOcrImportId,
                    row.payment_document_ocr_import_id,
                    0
                  )
                );
              })
              .filter(Boolean)
          );

        getItems().forEach(
          function (item) {
            const id =
              getOcrId(item);

            if (
              successfulIds.has(id) &&
              item.__aiRawResult
            ) {
              item.__aiRawResult =
                normalizeAiResult(
                  item.__aiRawResult
                );

              item.__aiDraft =
                getDraft(item);

              item.__visibleFieldLabels =
                getVisibleLabels(item);

              item.__utilityUnsavedAiResult =
                true;
            }
          }
        );

        const current =
          getSelectedItem();

        if (
          current &&
          current.__utilityUnsavedAiResult === true
        ) {
          applyItemToScreen(current);
        }

        return result;
      };

    wrapped.__utilityCommunicationDisplayWrapped =
      true;

    window.runSelectedAiDrafts =
      wrapped;
  }

  function installRestoreGuard() {
    const original =
      window.hdOriginUtilityRestoreSavedResult;

    if (
      typeof original !== "function" ||
      original.__utilityCommunicationRestoreGuard
    ) {
      return;
    }

    const wrapped =
      async function (item, index) {
        if (
          item &&
          item.__utilityUnsavedAiResult === true &&
          item.__aiRawResult
        ) {
          applyItemToScreen(item);

          return {
            ok:
              true,

            skippedSavedRestore:
              true,

            paymentDocumentOcrImportId:
              getOcrId(item)
          };
        }

        return original.apply(
          this,
          arguments
        );
      };

    wrapped.__utilityCommunicationRestoreGuard =
      true;

    window.hdOriginUtilityRestoreSavedResult =
      wrapped;
  }

  function installSaveWrapper() {
    const original =
      window.runSelectedUtilitySaves;

    if (
      typeof original !== "function" ||
      original.__utilityCommunicationSaveWrapped
    ) {
      return;
    }

    const wrapped =
      async function () {
        const result =
          await original.apply(
            this,
            arguments
          );

        const last =
          objectValue(
            window.__hdOriginUtilityBulkSaveLast
          );

        const savedIds =
          new Set(
            (
              Array.isArray(last.results)
                ? last.results
                : []
            )
              .filter(function (row) {
                return (
                  row &&
                  row.ok === true
                );
              })
              .map(function (row) {
                return Number(
                  firstValue(
                    row.paymentDocumentOcrImportId,
                    row.payment_document_ocr_import_id,
                    0
                  )
                );
              })
              .filter(Boolean)
          );

        getItems().forEach(
          function (item) {
            if (
              savedIds.has(
                getOcrId(item)
              )
            ) {
              item.__utilityUnsavedAiResult =
                false;
            }
          }
        );

        return result;
      };

    wrapped.__utilityCommunicationSaveWrapped =
      true;

    window.runSelectedUtilitySaves =
      wrapped;
  }

  function install() {
    installAnalyzeWrapper();
    installRestoreGuard();
    installSaveWrapper();
  }

  install();

  document.addEventListener(
    "DOMContentLoaded",
    install,
    {
      once:
        true
    }
  );

  setTimeout(
    install,
    0
  );

  setTimeout(
    install,
    100
  );
})();
/* GPT3_UTILITY_COMMUNICATION_DISPLAY_COMPAT_V3_END */

/* GPT3_UTILITY_COMMUNICATION_FIELD_MAPPING_START */
(function () {
  "use strict";

  if (
    window.__hdOriginUtilityCommunicationFieldMappingInstalled
  ) {
    return;
  }

  window.__hdOriginUtilityCommunicationFieldMappingInstalled =
    true;

  function objectValue(value) {
    return (
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    )
      ? value
      : {};
  }

  function firstValue() {
    for (
      let index = 0;
      index < arguments.length;
      index++
    ) {
      const value =
        arguments[index];

      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        return value;
      }
    }

    return "";
  }

  function textValue(value) {
    if (
      value === undefined ||
      value === null
    ) {
      return "";
    }

    return String(value);
  }

  function fieldsFromDraft(draft) {
    const source =
      objectValue(draft);

    return objectValue(
      firstValue(
        source.fields,
        source.specialist_fields,
        source.specialistFields
      )
    );
  }

  function setSelectValue(
    control,
    value,
    alternateValue
  ) {
    const wanted =
      textValue(value).trim();

    const alternate =
      textValue(alternateValue).trim();

    const options =
      Array.from(
        control.options || []
      );

    const matched =
      options.find(function (option) {
        const optionValue =
          textValue(
            option.value
          ).trim();

        const optionText =
          textValue(
            option.textContent
          ).trim();

        const optionCode =
          textValue(
            option.dataset &&
            (
              option.dataset.code ||
              option.dataset.analysisCode ||
              option.dataset.masterCode
            )
          ).trim();

        return (
          (
            wanted &&
            (
              optionValue === wanted ||
              optionText === wanted ||
              optionCode === wanted
            )
          ) ||
          (
            alternate &&
            (
              optionValue === alternate ||
              optionText === alternate ||
              optionCode === alternate
            )
          )
        );
      });

    if (matched) {
      control.value =
        matched.value;

      control.dispatchEvent(
        new Event(
          "change",
          {
            bubbles:
              true
          }
        )
      );

      return true;
    }

    return false;
  }

  function setControlValue(
    control,
    value,
    alternateValue
  ) {
    if (!control) {
      return false;
    }

    if (
      control.tagName === "SELECT"
    ) {
      return setSelectValue(
        control,
        value,
        alternateValue
      );
    }

    if (
      control.type === "checkbox"
    ) {
      control.checked =
        value === true ||
        value === 1 ||
        value === "1" ||
        value === "true" ||
        value === "あり";

      control.dispatchEvent(
        new Event(
          "change",
          {
            bubbles:
              true
          }
        )
      );

      return true;
    }

    let nextValue =
      textValue(value);

    if (
      control.type === "datetime-local" &&
      nextValue
    ) {
      nextValue =
        nextValue
          .replace(
            " ",
            "T"
          )
          .replace(
            /Z$/,
            ""
          )
          .slice(
            0,
            16
          );
    }

    control.value =
      nextValue;

    control.dispatchEvent(
      new Event(
        "input",
        {
          bubbles:
            true
        }
      )
    );

    control.dispatchEvent(
      new Event(
        "change",
        {
          bubbles:
            true
        }
      )
    );

    return true;
  }

  function showMappedControl(control) {
    if (!control) {
      return;
    }

    const label =
      control.closest("label");

    if (label) {
      label.classList.remove(
        "ai-field-hidden"
      );

      label.style.display =
        "";
    }

    const section =
      control.closest(
        ".draft-section, [data-utility-section]"
      );

    if (section) {
      section.classList.remove(
        "ai-section-hidden"
      );

      section.style.display =
        "";
    }
  }

  function valueForCode(
    code,
    fields,
    draft
  ) {
    const source =
      objectValue(draft);

    if (
      Object.prototype.hasOwnProperty.call(
        fields,
        code
      )
    ) {
      return fields[code];
    }

    if (
      Object.prototype.hasOwnProperty.call(
        source,
        code
      )
    ) {
      return source[code];
    }

    return "";
  }

  function applyCommunicationFields(draft) {
    const source =
      objectValue(draft);

    const fields =
      fieldsFromDraft(source);

    const controls =
      Array.from(
        document.querySelectorAll(
          "[data-analysis-item-code]"
        )
      );

    let appliedCount = 0;

    controls.forEach(
      function (control) {
        const code =
          textValue(
            control.getAttribute(
              "data-analysis-item-code"
            )
          ).trim();

        if (!code) {
          return;
        }

        const value =
          valueForCode(
            code,
            fields,
            source
          );

        if (
          value === "" ||
          value === null ||
          value === undefined
        ) {
          return;
        }

        let alternateValue =
          "";

        if (
          code.endsWith("_label")
        ) {
          const codeName =
            code.replace(
              /_label$/,
              "_code"
            );

          alternateValue =
            valueForCode(
              codeName,
              fields,
              source
            );
        }
        else if (
          code.endsWith("_code")
        ) {
          const labelName =
            code.replace(
              /_code$/,
              "_label"
            );

          alternateValue =
            valueForCode(
              labelName,
              fields,
              source
            );
        }

        if (
          setControlValue(
            control,
            value,
            alternateValue
          )
        ) {
          showMappedControl(
            control
          );

          appliedCount++;
        }
      }
    );

    const warnings =
      Array.isArray(source.warnings)
        ? source.warnings
        : [];

    const warningControl =
      document.getElementById(
        "draftWarnings"
      );

    if (
      warningControl &&
      warnings.length
    ) {
      warningControl.value =
        warnings.join("\n");

      showMappedControl(
        warningControl
      );

      appliedCount++;
    }

    window.__hdOriginUtilityCommunicationMappingLast = {
      ok:
        true,

      appliedCount:
        appliedCount,

      fieldCodes:
        Object.keys(fields),

      mappedValues: {
        email_from:
          fields.email_from || "",

        email_subject:
          fields.email_subject || "",

        email_received_at:
          fields.email_received_at || "",

        usage_period:
          fields.usage_period || "",

        total_amount:
          fields.total_amount ?? "",

        currency:
          fields.currency || "",

        payment_method_code:
          fields.payment_method_code || "",

        payment_method_label:
          fields.payment_method_label || ""
      }
    };

    return appliedCount;
  }

  function installMappingWrapper() {
    const original =
      window.hdOriginApplyUtilityDedicatedDraft;

    if (
      typeof original !== "function" ||
      original.__utilityCommunicationFieldMappingWrapped
    ) {
      return false;
    }

    const wrapped =
      function (draft) {
        const result =
          original.apply(
            this,
            arguments
          );

        applyCommunicationFields(
          draft
        );

        return result;
      };

    wrapped.__utilityCommunicationFieldMappingWrapped =
      true;

    window.hdOriginApplyUtilityDedicatedDraft =
      wrapped;

    return true;
  }

  window.hdOriginApplyUtilityCommunicationFields =
    applyCommunicationFields;

  installMappingWrapper();

  document.addEventListener(
    "DOMContentLoaded",
    installMappingWrapper,
    {
      once:
        true
    }
  );

  setTimeout(
    installMappingWrapper,
    0
  );

  setTimeout(
    installMappingWrapper,
    250
  );

  setTimeout(
    installMappingWrapper,
    1000
  );
})();
/* GPT3_UTILITY_COMMUNICATION_FIELD_MAPPING_END */

