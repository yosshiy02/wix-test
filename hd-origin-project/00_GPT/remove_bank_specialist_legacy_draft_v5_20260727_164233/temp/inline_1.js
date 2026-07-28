
/* HD_ORIGIN_GPT2_SPECIALIST_FETCH_CONTEXT_20260711_START */
(function () {
  "use strict";

  if (window.__hdOriginSpecialistFetchContextInstalled) {
    return;
  }

  window.__hdOriginSpecialistFetchContextInstalled = true;

  const originalFetch = window.fetch.bind(window);

  const routeDefinitions = {
    invoice_payable: {
      specialist_route_label: "請求・未払系解析",
      analysis_system_code: "invoice_payable_analysis",
      analysis_system_label: "請求・未払系専門解析システム"
    },
    tax_public: {
      specialist_route_label: "税金・公的支払解析",
      analysis_system_code: "tax_public_analysis",
      analysis_system_label: "税金・公的支払専門解析システム"
    },
    bank_transaction: {
      specialist_route_label: "銀行取引解析",
      analysis_system_code: "bank_transaction_analysis",
      analysis_system_label: "銀行取引専門解析システム"
    },
    needs_review: {
      specialist_route_label: "要確認解析",
      analysis_system_code: "needs_review_analysis",
      analysis_system_label: "要確認専門解析システム"
    },
    contract_insurance_lease: {
      specialist_route_label: "契約・保険・リース解析",
      analysis_system_code: "contract_insurance_lease_analysis",
      analysis_system_label: "契約・保険・リース専門解析システム"
    }
  };

  window.fetch = function (input, init) {
    const requestUrl = String(
      input && input.url ? input.url : input || ""
    );

    if (
      !requestUrl.includes(
        "/api/payment-documents/ai-specialist/"
      )
    ) {
      return originalFetch(input, init);
    }

    const routeCode = String(
      document.body &&
      document.body.dataset &&
      document.body.dataset.specialistRouteCode
        ? document.body.dataset.specialistRouteCode
        : ""
    ).trim();

    const definition = routeDefinitions[routeCode];

    if (!definition) {
      return Promise.reject(
        new Error(
          "専門解析画面のdata-specialist-route-codeが不正です: " +
          routeCode
        )
      );
    }

    const nextInit = Object.assign({}, init || {});

    nextInit.method = nextInit.method || "POST";

    nextInit.headers = Object.assign(
      {},
      nextInit.headers || {},
      {
        "Content-Type": "application/json"
      }
    );

    let requestBody = {};

    if (
      typeof nextInit.body === "string" &&
      nextInit.body.trim()
    ) {
      try {
        const parsed = JSON.parse(nextInit.body);

        if (
          parsed &&
          typeof parsed === "object" &&
          !Array.isArray(parsed)
        ) {
          requestBody = parsed;
        }
      } catch (error) {
        return Promise.reject(
          new Error(
            "専門解析リクエスト本文がJSONではありません。"
          )
        );
      }
    }

    nextInit.body = JSON.stringify({
      ...requestBody,
      specialist_route_code: routeCode,
      specialist_route_label:
        requestBody.specialist_route_label ||
        definition.specialist_route_label,
      analysis_system_code:
        requestBody.analysis_system_code ||
        definition.analysis_system_code,
      analysis_system_label:
        requestBody.analysis_system_label ||
        definition.analysis_system_label,
      group: routeCode
    });

    return originalFetch(input, nextInit);
  };
})();
/* HD_ORIGIN_GPT2_SPECIALIST_FETCH_CONTEXT_20260711_END */
