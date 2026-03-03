const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");

const open = (...args) =>
    import("open").then(mod => mod.default(...args));

const publishBook = require("../frontend/admin-engine/index");

const app = express();
const PORT = 3001;

/* ============================
   Ensure uploads folder exists
============================ */

const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

/* ============================
   Multer Config
============================ */

const upload = multer({
    dest: uploadsDir
});

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

/* ============================
   Serve Admin Page
============================ */

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});

/* ============================
   Publish Endpoint
============================ */

app.post("/publish", upload.single("docx"), async (req, res) => {

    let tempPath = null;

    try {
        if (!req.file) {
            return res.status(400).json({ error: "No DOCX uploaded." });
        }

        tempPath = req.file.path;

        const { title, description } = req.body;

        // 🔒 Title required (no fallback allowed)
        if (!title || !title.trim()) {

            if (tempPath && fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }

            return res.status(400).json({
                error: "Title is required."
            });
        }

        const result = await publishBook({
            docxPath: tempPath,
            title: title.trim(),
            description: description?.trim() || ""
        });

        // 🧹 Delete temp file after success
        if (tempPath && fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }

        res.json({
            success: true,
            result
        });

    } catch (err) {

        // 🧹 Delete temp file if error occurred
        if (tempPath && fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }

        console.error(err);

        res.status(500).json({
            error: err.message || "Publishing failed."
        });
    }
});

/* ============================
   Start Server
============================ */

app.listen(PORT, async () => {
    console.log(`\nAdmin UI running at http://localhost:${PORT}`);
    await open(`http://localhost:${PORT}`);
});