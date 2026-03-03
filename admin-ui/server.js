const express = require("express");
const path = require("path");
const multer = require("multer");

const open = (...args) =>
    import("open").then(mod => mod.default(...args));

const publishBook = require("../frontend/admin-engine/index");

const app = express();
const PORT = 3001;

// Storage config (temp uploads folder)
const upload = multer({
    dest: path.join(__dirname, "uploads")
});

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Serve main page
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});

/* ============================
   TEST PUBLISH ENDPOINT
============================ */

app.post("/publish", upload.single("docx"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No DOCX uploaded." });
        }

        const result = await publishBook({
            docxPath: req.file.path
        });

        res.json({
            success: true,
            result
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: err.message || "Publishing failed."
        });
    }
});

app.listen(PORT, async () => {
    console.log(`\nAdmin UI running at http://localhost:${PORT}`);
    await open(`http://localhost:${PORT}`);
});