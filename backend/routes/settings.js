const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const router = express.Router();
const db = require("../database/db");
const requireAdmin = require("../middleware/requireAdmin");
const { htmlDir, booksDir } = require("../config/paths");
const convertDocxToSections = require("../services/converter"); // ✅ FIXED IMPORT

/* =========================
   SETTINGS STORAGE PATH
========================= */

const settingsHtmlDir = path.join(htmlDir, "settings");

if (!fs.existsSync(settingsHtmlDir)) {
    fs.mkdirSync(settingsHtmlDir, { recursive: true });
}

/* =========================
   MULTER CONFIG
========================= */

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, booksDir); // temporary store
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 300 * 1024 * 1024 }
});

/* =========================
   GET SETTING META
========================= */

router.get("/settings/:key", (req, res) => {
    const { key } = req.params;

    const row = db.prepare("SELECT * FROM settings WHERE key = ?").get(key);
    if (!row) return res.status(404).json({ error: "Setting not found" });

    res.json(row);
});

/* =========================
   UPLOAD SETTING CONTENT
========================= */

router.post(
    "/settings/:key",
    requireAdmin,
    upload.fields([
        { name: "docx", maxCount: 1 },
        { name: "pdf", maxCount: 1 }
    ]),
    async (req, res) => {
        try {
            const { key } = req.params;

            const docxFile = req.files?.docx?.[0];
            const pdfFile = req.files?.pdf?.[0];

            const setting = db.prepare("SELECT * FROM settings WHERE key = ?").get(key);
            if (!setting) return res.status(404).json({ error: "Invalid setting key" });

            let contentType = null;
            let contentPath = null;
            let originalPdfPath = null;

            /* ================= DOCX ================= */

            if (docxFile) {

                const folderName = `settings/${key}`;
                const fullFolderPath = path.join(htmlDir, folderName);

                if (fs.existsSync(fullFolderPath)) {
                    fs.rmSync(fullFolderPath, { recursive: true, force: true });
                }

                await convertDocxToSections(docxFile.path, folderName);

                contentType = "html";
                contentPath = folderName;

                // delete temp docx
                fs.unlinkSync(docxFile.path);
            }

            /* ================= PDF ================= */

            else if (pdfFile) {
                contentType = "pdf";
                originalPdfPath = pdfFile.filename;
            }

            else {
                return res.status(400).json({ error: "Upload DOCX or PDF." });
            }

            db.prepare(`
                UPDATE settings
                SET content_type = ?,
                    content_path = ?,
                    original_pdf_path = ?
                WHERE key = ?
            `).run(contentType, contentPath, originalPdfPath, key);

            res.json({ message: "Setting content updated successfully." });

        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    }
);

module.exports = router;