const express = require("express");
const fs = require("fs");
const router = express.Router();

const receiptsRepository = require("./receipts.repository");

router.get("/imports", async (req, res) => {
  try {
    const items = await receiptsRepository.listImports({
      limit: req.query.limit,
      offset: req.query.offset
    });

    res.json({
      ok: true,
      count: items.length,
      items
    });
  } catch (error) {
    console.error("[receipts/imports]", error);
    res.status(500).json({
      ok: false,
      message: error.message
    });
  }
});

router.get("/imports/:id", async (req, res) => {
  try {
    const item = await receiptsRepository.getImportById(req.params.id);

    if (!item) {
      return res.status(404).json({
        ok: false,
        message: "レシートが見つかりません。"
      });
    }

    res.json({
      ok: true,
      item
    });
  } catch (error) {
    console.error("[receipts/imports/:id]", error);
    res.status(500).json({
      ok: false,
      message: error.message
    });
  }
});

router.get("/image/:id", async (req, res) => {
  try {
    const item = await receiptsRepository.getImportById(req.params.id);

    if (!item) {
      return res.status(404).send("レシートが見つかりません。");
    }

    if (!item.local_image_path) {
      return res.status(404).send("画像パスがありません。");
    }

    if (!fs.existsSync(item.local_image_path)) {
      return res.status(404).send("画像ファイルが見つかりません: " + item.local_image_path);
    }

    res.sendFile(item.local_image_path);
  } catch (error) {
    console.error("[receipts/image/:id]", error);
    res.status(500).send(error.message);
  }
});

module.exports = router;
