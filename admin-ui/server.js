const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const { execSync } = require("child_process");

const open = (...args) =>
    import("open").then(mod => mod.default(...args));

const publishEngine = require("../frontend/admin-engine/index");

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
   Publish Book (DOCX or PDF)
============================ */

app.post(
    "/publish",
    upload.fields([
        { name: "docx", maxCount: 1 },
        { name: "book", maxCount: 1 },
        { name: "cover", maxCount: 1 }
    ]),
    async (req, res) => {

        let tempDocxPath = null;
        let tempPdfPath = null;
        let tempCoverPath = null;

        try {

            const { title, description } = req.body;

            if (!title || !title.trim()) {
                return res.status(400).json({ error: "Title is required." });
            }

            if (req.files?.docx) {
                tempDocxPath = req.files.docx[0].path;
            }

            if (req.files?.book) {
                tempPdfPath = req.files.book[0].path;
            }

            if (req.files?.cover) {
                tempCoverPath = req.files.cover[0].path;
            }

            if (!tempDocxPath && !tempPdfPath) {
                return res.status(400).json({
                    error: "Upload DOCX or PDF."
                });
            }

            let result;

            if (tempDocxPath) {

                result = await publishEngine.publishBook({
                    docxPath: tempDocxPath,
                    title: title.trim(),
                    description: description?.trim() || "",
                    coverPath: tempCoverPath
                });

            } else if (tempPdfPath) {

                result = publishEngine.publishPdfBook({
                    pdfPath: tempPdfPath,
                    title: title.trim(),
                    description: description?.trim() || "",
                    coverPath: tempCoverPath
                });

            }

            if (tempDocxPath && fs.existsSync(tempDocxPath)) {
                fs.unlinkSync(tempDocxPath);
            }

            if (tempPdfPath && fs.existsSync(tempPdfPath)) {
                fs.unlinkSync(tempPdfPath);
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

            if (tempPdfPath && fs.existsSync(tempPdfPath)) {
                fs.unlinkSync(tempPdfPath);
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
   DELETE Book (HTML + PDF FIX)
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

        let bookFolder = null;

        if (book.content_type === "html" && book.content_path) {
            bookFolder = path.join(booksRoot, book.content_path);
        }

        else if (book.content_type === "pdf" && book.file_path) {
            const folder = book.file_path.split("/")[0];
            bookFolder = path.join(booksRoot, folder);
        }

        if (bookFolder && fs.existsSync(bookFolder)) {
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
   Publish Setting PDF
============================ */

app.post("/publish-setting/:key", upload.single("pdf"), (req, res) => {

    const key = req.params.key;

    if (!["credits", "memorial"].includes(key)) {
        return res.status(400).json({ error: "Invalid setting key." });
    }

    if (!req.file) {
        return res.status(400).json({ error: "No PDF uploaded." });
    }

    try {

        const settingsFolder = path.join(
            __dirname,
            "../frontend/books/settings",
            key
        );

        if (!fs.existsSync(settingsFolder)) {
            fs.mkdirSync(settingsFolder, { recursive: true });
        }

        fs.readdirSync(settingsFolder).forEach(file => {
            fs.rmSync(path.join(settingsFolder, file), { force: true });
        });

        const finalFileName = `${key}.pdf`;
        const finalPath = path.join(settingsFolder, finalFileName);

        fs.copyFileSync(req.file.path, finalPath);

        fs.writeFileSync(
            path.join(settingsFolder, "config.json"),
            JSON.stringify({
                content_type: "pdf",
                file: finalFileName
            }, null, 2),
            "utf8"
        );

        fs.unlinkSync(req.file.path);

        const projectRoot = path.resolve(__dirname, "..");

        execSync("git add .", { cwd: projectRoot });

        const status = execSync("git status --porcelain", {
            cwd: projectRoot
        }).toString();

        if (status.trim()) {

            execSync(`git commit -m "Update setting: ${key}"`, {
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

        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        console.error(err);

        res.status(500).json({
            error: err.message || "Upload failed."
        });
    }
});

/* ============================
   Start Server
============================ */

app.listen(PORT, () => {
    console.log(`\nAdmin UI running at http://localhost:${PORT}`);
});

const { exec } = require("child_process");
exec(`start http://localhost:${PORT}`);