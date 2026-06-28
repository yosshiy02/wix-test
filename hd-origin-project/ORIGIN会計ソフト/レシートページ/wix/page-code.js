import {
  saveReceiptFromHtml,
  testAzureReadOcrFromHtml
} from "backend/receiptUpload.jsw";

$w.onReady(function () {
  $w("#htmlReceiptApp").onMessage(async (event) => {
    const data = event.data;

    if (!data || !data.type) {
      return;
    }

    if (data.type === "SAVE_RECEIPT") {
      try {
        const result = await saveReceiptFromHtml(data);

        $w("#htmlReceiptApp").postMessage({
          type: "SAVE_RECEIPT_RESULT",
          ok: true,
          receiptId: result.receiptId,
          imageUrl: result.imageUrl,
          itemId: result.itemId
        });

      } catch (err) {
        console.error(err);

        $w("#htmlReceiptApp").postMessage({
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
        const result = await testAzureReadOcrFromHtml(data);

        $w("#htmlReceiptApp").postMessage({
          type: "TEST_AZURE_READ_OCR_RESULT",
          ok: true,
          rawText: result.rawText,
          lineCount: result.lineCount,
          wordCount: result.wordCount,
          provider: result.provider
        });

      } catch (err) {
        console.error(err);

        $w("#htmlReceiptApp").postMessage({
          type: "TEST_AZURE_READ_OCR_RESULT",
          ok: false,
          message: err.message || String(err)
        });
      }

      return;
    }
  });
});
