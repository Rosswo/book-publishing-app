const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const { execSync } = require("child_process");

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
   GET Books
============================ */

app.get("/books", (req, res) => {
    try {
        const booksPath = path.join(__dirname, "../frontend/books/books.json");
        const books = JSON.parse(fs.readFileSync(booksPath, "utf8"));
        res.json(books);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to load books." });
    }
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

        // 🔒 Title required
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
   DELETE Book
============================ */

app.delete("/books/:id", (req, res) => {

    const bookId = req.params.id;

    try {

        const booksPath = path.join(__dirname, "../frontend/books/books.json");
        const booksRoot = path.join(__dirname, "../frontend/books");

        const books = JSON.parse(fs.readFileSync(booksPath, "utf8"));

        const bookIndex = books.findIndex(b => b.id === bookId);

        if (bookIndex === -1) {
            return res.status(404).json({ error: "Book not found." });
        }

        const book = books[bookIndex];

        const bookFolder = path.join(booksRoot, book.content_path);

        // 🔥 Permanently delete book folder
        if (fs.existsSync(bookFolder)) {
            fs.rmSync(bookFolder, { recursive: true, force: true });
        }

        // Remove from registry
        books.splice(bookIndex, 1);

        fs.writeFileSync(booksPath, JSON.stringify(books, null, 2), "utf8");

        /* ============================
           Git Automation
        ============================ */

        const projectRoot = path.resolve(__dirname, "..");

        execSync("git add .", { cwd: projectRoot });

        const status = execSync("git status --porcelain", {
            cwd: projectRoot
        }).toString();

        if (status.trim()) {

            execSync(`git commit -m "Delete: ${book.title}"`, {
                cwd: projectRoot,
                stdio: "inherit"
            });

            execSync("git push", {
                cwd: projectRoot,
                stdio: "inherit"
            });
        }

        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Delete failed." });
    }
});

/* ============================
   Start Server
============================ */

app.listen(PORT, async () => {
    console.log(`\nAdmin UI running at http://localhost:${PORT}`);
    await open(`http://localhost:${PORT}`);
});