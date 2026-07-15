const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// DB接続設定 (server.jsと同じ環境変数を利用)
const pool = new Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'hd_origin_project',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD
});

// --- イベントデータ (teamEventsMulti) ---
router.get('/events', async (req, res) => {
  try {
    const result = await pool.query('SELECT event_data FROM calendar_kv_store WHERE store_key = ', ['teamEventsMulti']);
    if (result.rows.length > 0) {
      res.json(result.rows[0].store_value);
    } else {
      res.json({});
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

router.post('/events', async (req, res) => {
  try {
    const eventsData = req.body;
    await pool.query(
      'INSERT INTO calendar_kv_store (store_key, store_value, updated_at) VALUES (, , CURRENT_TIMESTAMP) ON CONFLICT (store_key) DO UPDATE SET store_value = EXCLUDED.store_value, updated_at = CURRENT_TIMESTAMP',
      ['teamEventsMulti', JSON.stringify(eventsData)]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB Error' });
  }
});

// --- ユーザー設定 (teamCalendarUsers) ---
router.get('/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT store_value FROM calendar_kv_store WHERE store_key = ', ['teamCalendarUsers']);
    res.json(result.rows.length > 0 ? result.rows[0].store_value : null);
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

router.post('/users', async (req, res) => {
  try {
    await pool.query(
      'INSERT INTO calendar_kv_store (store_key, store_value) VALUES (, ) ON CONFLICT (store_key) DO UPDATE SET store_value = EXCLUDED.store_value',
      ['teamCalendarUsers', JSON.stringify(req.body)]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'DB Error' });
  }
});

module.exports = router;
