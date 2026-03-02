const express = require("express");
const multer = require("multer");
const fs = require("fs");
const db = require("../database/db");
const requireAdmin = require("../middleware/requireAdmin");
const convertDocxToSections = require("../services/converter");
const { booksDir, coversDir } = require("../config/paths");

const router = express.Router();

/* =========================
   Multer Storage
========================= */

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        if (file.fieldname === "book") cb(null, booksDir);
        else if (file.fieldname === "docx") cb(null, booksDir);
        else if (file.fieldname === "cover") cb(null, coversDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + "-" + file.originalname);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 300 * 1024 * 1024 }, // 300MB limit
});

/* =========================
   Upload Route
========================= */

router.post(
    "/upload",
    requireAdmin,
    upload.fields([
        { name: "book", maxCount: 1 },
        { name: "docx", maxCount: 1 },
        { name: "cover", maxCount: 1 },
    ]),
    async (req, res) => {
        try {
            const { title, description, version } = req.body;

            if (!title) {
                return res.status(400).json({ error: "Title required." });
            }

            const pdfFile = req.files?.book?.[0];
            const docxFile = req.files?.docx?.[0];
            const coverFile = req.files?.cover?.[0];

            let contentType = "pdf";
            let contentPath = null;
            let originalPdfPath = null;
            let filePath = null;
            let imagesJson = null;

            /* =========================
               DOCX Upload (Primary)
            ========================= */

            if (docxFile) {

                contentType = "html";
                const folderName = "book-" + Date.now();

                const savedImages = await convertDocxToSections(
                    docxFile.path,
                    folderName
                );

                contentPath = folderName;
                imagesJson = JSON.stringify(savedImages || []);

                // Delete DOCX after successful conversion
                if (fs.existsSync(docxFile.path)) {
                    fs.unlinkSync(docxFile.path);
                }

                // Optional original PDF fallback
                if (pdfFile) {
                    originalPdfPath = pdfFile.filename;
                }
            }

            /* =========================
               PDF Only Upload
            ========================= */

            else if (pdfFile) {
                contentType = "pdf";
                filePath = pdfFile.filename;
            }

            else {
                return res.status(400).json({ error: "Upload PDF or DOCX." });
            }

            /* =========================
               Save To Database (Unified Insert)
            ========================= */

            db.prepare(`
                INSERT INTO books 
                (title, description, file_path, cover_path, version, download_count, content_type, content_path, original_pdf_path, images_json)
                VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
            `).run(
                title,
                description || "",
                filePath,
                coverFile ? coverFile.filename : null,
                version || "1.0",
                contentType,
                contentPath,
                originalPdfPath,
                imagesJson
            );

            res.json({ message: "Book uploaded successfully." });

        } catch (err) {
            console.error("Upload error:", err);
            res.status(500).json({ error: err.message });
        }
    }
);

module.exports = router;