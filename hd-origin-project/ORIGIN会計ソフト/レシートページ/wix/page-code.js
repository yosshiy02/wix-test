import {
  saveReceiptFromHtml,
  testAzureReadOcrFromHtml
} from "backend/receiptUpload.jsw";

function safePostMessage($htmlApp, message) {
  if (!$htmlApp || typeof $htmlApp.postMessage !== "function") {
    console.error("HTML_APP_POSTMESSAGE_NOT_AVAILABLE:", {
      id: $htmlApp && $htmlApp.id,
      type: $htmlApp && $htmlApp.type,
      messageType: message && message.type
    });
    return false;
  }

  $htmlApp.postMessage(message);
  return true;
}

$w.onReady(function () {
  const htmlApps = [
    $w("#htmlReceiptApp"),
    $w("#htmlReceiptAppPC")
  ];

  htmlApps.forEach(($htmlApp, index) => {
    console.log("HTML APP CHECK:", {
      index: index,
      id: $htmlApp && $htmlApp.id,
      type: $htmlApp && $htmlApp.type,
      hasOnMessage: !!($htmlApp && typeof $htmlApp.onMessage === "function"),
      hasPostMessage: !!($htmlApp && typeof $htmlApp.postMessage === "function")
    });

    if (!$htmlApp || typeof $htmlApp.onMessage !== "function") {
      console.error("HTML_APP_ONMESSAGE_NOT_AVAILABLE:", {
        index: index,
        id: $htmlApp && $htmlApp.id,
        type: $htmlApp && $htmlApp.type
      });
      return;
    }

    setTimeout(() => {
      safePostMessage($htmlApp, {
        type: "WIX_DEBUG_LOG",
        message: "Wix page-code connected. htmlApp index=" + index
      });
    }, 800);

    $htmlApp.onMessage(async (event) => {
      const data = event.data;

      console.log("HTML MESSAGE RECEIVED:", {
        htmlAppId: $htmlApp.id,
        htmlAppType: $htmlApp.type,
        data: data
      });

      if (!data || !data.type) {
        return;
      }

      safePostMessage($htmlApp, {
        type: "WIX_DEBUG_LOG",
        message: "Wix received message type=" + data.type + " receiptId=" + (data.receiptId || "")
      });

      if (data.type === "SAVE_RECEIPT") {
        try {
          const result = await saveReceiptFromHtml(data);

          safePostMessage($htmlApp, {
            type: "SAVE_RECEIPT_RESULT",
            ok: true,
            receiptId: result.receiptId,
            imageUrl: result.imageUrl,
            itemId: result.itemId,
            status: result.status
          });

        } catch (err) {
          console.error("SAVE_RECEIPT ERROR:", err);

          safePostMessage($htmlApp, {
            type: "SAVE_RECEIPT_RESULT",
            ok: false,
            receiptId: data.receiptId,
            message: err.message || String(err)
          });
        }

        return;
      }

      if (data.type === "TEST_AZURE_READ_OCR") {
        try {
          console.log("START TEST_AZURE_READ_OCR:", data.receiptId);

          const result = await testAzureReadOcrFromHtml(data);

          console.log("END TEST_AZURE_READ_OCR:", result);

          safePostMessage($htmlApp, {
            type: "TEST_AZURE_READ_OCR_RESULT",
            ok: true,
            rawText: result.rawText,
            lineCount: result.lineCount,
            wordCount: result.wordCount,
            provider: result.provider
          });

        } catch (err) {
          console.error("TEST_AZURE_READ_OCR ERROR:", err);

          safePostMessage($htmlApp, {
            type: "TEST_AZURE_READ_OCR_RESULT",
            ok: false,
            message: err.message || String(err)
          });
        }

        return;
      }
    });
  });
});
