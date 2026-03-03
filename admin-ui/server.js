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

app.post("/publish",
    upload.fields([
        { name: "docx", maxCount: 1 },
        { name: "cover", maxCount: 1 }
    ]),
    async (req, res) => {

        let tempDocxPath = null;
        let tempCoverPath = null;

        try {

            if (!req.files || !req.files.docx) {
                return res.status(400).json({ error: "No DOCX uploaded." });
            }

            tempDocxPath = req.files.docx[0].path;

            if (req.files.cover) {
                tempCoverPath = req.files.cover[0].path;
            }

            const { title, description } = req.body;

            if (!title || !title.trim()) {

                if (tempDocxPath && fs.existsSync(tempDocxPath)) {
                    fs.unlinkSync(tempDocxPath);
                }

                if (tempCoverPath && fs.existsSync(tempCoverPath)) {
                    fs.unlinkSync(tempCoverPath);
                }

                return res.status(400).json({
                    error: "Title is required."
                });
            }

            const result = await publishBook({
                docxPath: tempDocxPath,
                title: title.trim(),
                description: description?.trim() || "",
                coverPath: tempCoverPath
            });

            // Clean temp uploads
            if (tempDocxPath && fs.existsSync(tempDocxPath)) {
                fs.unlinkSync(tempDocxPath);
            }

            if (tempCoverPath && fs.existsSync(tempCoverPath)) {
                fs.unlinkSync(tempCoverPath);
            }

            res.json({
                success: true,
                result
            });

        } catch (err) {

            if (tempDocxPath && fs.existsSync(tempDocxPath)) {
                fs.unlinkSync(tempDocxPath);
            }

            if (tempCoverPath && fs.existsSync(tempCoverPath)) {
                fs.unlinkSync(tempCoverPath);
            }

            console.error(err);

            res.status(500).json({
                error: err.message || "Publishing failed."
            });
        }
    }
);
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

        if (fs.existsSync(bookFolder)) {
            fs.rmSync(bookFolder, { recursive: true, force: true });
        }

        books.splice(bookIndex, 1);

        fs.writeFileSync(booksPath, JSON.stringify(books, null, 2), "utf8");

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