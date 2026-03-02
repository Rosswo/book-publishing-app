const express = require("express");
const path = require("path");
const fs = require("fs");
const db = require("../database/db");
const requireAdmin = require("../middleware/requireAdmin");
const { booksDir, coversDir, htmlDir, imagesDir } = require("../config/paths");

const router = express.Router();

/* =========================
   Get Books
========================= */

router.get("/books", (req, res) => {
    const books = db.prepare("SELECT * FROM books ORDER BY created_at DESC").all();
    res.json(books);
});

/* =========================
   Delete Book
========================= */

router.delete("/books/:id", requireAdmin, (req, res) => {

    const id = req.params.id;
    const book = db.prepare("SELECT * FROM books WHERE id = ?").get(id);

    if (!book) return res.status(404).json({ error: "Not found" });

    // Delete HTML folder
    if (book.content_type === "html" && book.content_path) {
        const folderPath = path.join(htmlDir, book.content_path);
        fs.rmSync(folderPath, { recursive: true, force: true });
    }

    // Delete PDF file
    if (book.file_path) {
        const filePath = path.join(booksDir, book.file_path);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    // Delete cover
    if (book.cover_path) {
        const coverPath = path.join(coversDir, book.cover_path);
        if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
    }

    // 🔥 Delete associated images
    if (book.images_json) {
        try {
            const images = JSON.parse(book.images_json);

            images.forEach(img => {
                const imgPath = path.join(imagesDir, img);
                if (fs.existsSync(imgPath)) {
                    fs.unlinkSync(imgPath);
                }
            });

        } catch (err) {
            console.error("Image deletion parse error:", err);
        }
    }

    db.prepare("DELETE FROM books WHERE id = ?").run(id);

    res.json({ message: "Deleted successfully" });
});

module.exports = router;