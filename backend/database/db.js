const Database = require("better-sqlite3");
const fs = require("fs");

/* =========================
   Ensure /data Exists
========================= */

if (!fs.existsSync("/data")) {
    fs.mkdirSync("/data", { recursive: true });
}

/* =========================
   Persistent DB Path
========================= */

const dbPath = "/data/books.db";
const db = new Database(dbPath);

/* =========================
   BOOKS TABLE
========================= */

db.prepare(`
    CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        file_path TEXT,
        cover_path TEXT,
        version TEXT DEFAULT '1.0',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        download_count INTEGER DEFAULT 0,
        content_type TEXT DEFAULT 'pdf',
        content_path TEXT,
        original_pdf_path TEXT,
        images_json TEXT
    )
`).run();

/* Ensure images_json exists */

const bookColumns = db.prepare("PRAGMA table_info(books)").all();
const bookNames = bookColumns.map(c => c.name);

if (!bookNames.includes("images_json")) {
    db.prepare("ALTER TABLE books ADD COLUMN images_json TEXT").run();
}

/* =========================
   SETTINGS TABLE
========================= */

/*
We drop old simple settings table (if exists)
Safe because no production data yet.
*/

db.prepare(`DROP TABLE IF EXISTS settings`).run();

db.prepare(`
    CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        content_type TEXT DEFAULT 'html',
        content_path TEXT,
        original_pdf_path TEXT
    )
`).run();

/* Default entries */

const defaultSettings = ["credits", "memorial"];

defaultSettings.forEach(key => {
    const exists = db.prepare("SELECT key FROM settings WHERE key = ?").get(key);
    if (!exists) {
        db.prepare(`
            INSERT INTO settings (key, content_type, content_path, original_pdf_path)
            VALUES (?, 'html', NULL, NULL)
        `).run(key);
    }
});

module.exports = db;