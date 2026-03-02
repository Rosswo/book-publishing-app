const Database = require("better-sqlite3");
const fs = require("fs");
const path = require("path");

/* =========================
   ENV-AWARE DB PATH
========================= */

const isRailway = !!process.env.RAILWAY_ENVIRONMENT;

const DATA_PATH = isRailway
    ? "/data"
    : path.join(__dirname);

const DB_PATH = isRailway
    ? "/data/books.db"
    : path.join(__dirname, "books.db");

console.log("Running in Railway?", isRailway);
console.log("Using DB path:", DB_PATH);

/* =========================
   Ensure Directory Exists
========================= */

if (!fs.existsSync(DATA_PATH)) {
    fs.mkdirSync(DATA_PATH, { recursive: true });
}

const db = new Database(DB_PATH);
console.log("DB opened successfully.");

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

/* Ensure images_json column exists */
const bookColumns = db.prepare("PRAGMA table_info(books)").all();
const bookNames = bookColumns.map(c => c.name);

if (!bookNames.includes("images_json")) {
    db.prepare("ALTER TABLE books ADD COLUMN images_json TEXT").run();
}

/* =========================
   SETTINGS TABLE
========================= */

db.prepare(`
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        content_type TEXT DEFAULT 'html',
        content_path TEXT,
        original_pdf_path TEXT
    )
`).run();

/* Ensure default keys exist */
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

const count = db.prepare("SELECT COUNT(*) as c FROM books").get().c;
console.log("Current book count:", count);

module.exports = db;