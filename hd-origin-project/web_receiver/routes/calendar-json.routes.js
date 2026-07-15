const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../public/YearlyCalendar/data.json');
const settingsPath = path.join(__dirname, '../public/YearlyCalendar/settings.json');

router.get('/data', (req, res) => {
    if (fs.existsSync(dataPath)) { res.sendFile(dataPath); } else { res.json({}); }
});

router.post('/data', express.json({ limit: '10mb' }), (req, res) => {
    fs.writeFile(dataPath, JSON.stringify(req.body, null, 2), 'utf8', (err) => {
        if (err) return res.status(500).json({ error: '保存失敗' });
        res.json({ success: true });
    });
});

router.get('/settings', (req, res) => {
    if (fs.existsSync(settingsPath)) res.sendFile(settingsPath); else res.json({});
});

router.post('/settings', express.json({ limit: '10mb' }), (req, res) => {
    fs.writeFile(settingsPath, JSON.stringify(req.body, null, 2), 'utf8', (err) => {
        if (err) return res.status(500).json({ error: '保存失敗' });
        res.json({ success: true });
    });
});

module.exports = router;
