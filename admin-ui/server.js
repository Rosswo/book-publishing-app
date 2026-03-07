const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const { execSync } = require("child_process");

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

        const booksPath = path.join(
            __dirname,
            "../frontend/books/books.json"
        );

        const books = JSON.parse(
            fs.readFileSync(booksPath, "utf8")
        );

        res.json(books);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            error: "Failed to load books."
        });

    }

});

/* ============================
   Publish Book
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
                return res.status(400).json({
                    error: "Title is required."
                });
            }

            if (req.files?.docx)
                tempDocxPath = req.files.docx[0].path;

            if (req.files?.book)
                tempPdfPath = req.files.book[0].path;

            if (req.files?.cover)
                tempCoverPath = req.files.cover[0].path;

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

            } else {

                result = publishEngine.publishPdfBook({
                    pdfPath: tempPdfPath,
                    title: title.trim(),
                    description: description?.trim() || "",
                    coverPath: tempCoverPath
                });

            }

            if (tempDocxPath && fs.existsSync(tempDocxPath))
                fs.unlinkSync(tempDocxPath);

            if (tempPdfPath && fs.existsSync(tempPdfPath))
                fs.unlinkSync(tempPdfPath);

            if (tempCoverPath && fs.existsSync(tempCoverPath))
                fs.unlinkSync(tempCoverPath);

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

    }
);

/* ============================
   DELETE Book
============================ */

app.delete("/books/:id", (req, res) => {

    const bookId = req.params.id.trim();

    console.log("Deleting book:", bookId);

    try {

        const booksPath = path.join(
            __dirname,
            "../frontend/books/books.json"
        );

        const booksRoot = path.join(
            __dirname,
            "../frontend/books"
        );

        const books = JSON.parse(
            fs.readFileSync(booksPath, "utf8")
        );

        const bookIndex = books.findIndex(
            b => b.id === bookId
        );

        if (bookIndex === -1) {
            return res.status(404).json({
                error: "Book not found."
            });
        }

        const book = books[bookIndex];

        const bookFolder = path.join(
            booksRoot,
            book.id
        );

        /* DELETE FOLDER */

        if (fs.existsSync(bookFolder)) {

            fs.rmSync(bookFolder, {
                recursive: true,
                force: true
            });

            console.log("Folder deleted:", bookFolder);

        }

        /* REMOVE FROM JSON */

        books.splice(bookIndex, 1);

        fs.writeFileSync(
            booksPath,
            JSON.stringify(books, null, 2),
            "utf8"
        );

        console.log("books.json updated");

        /* GIT AUTOMATION (SAFE) */

        try {

            const projectRoot = path.resolve(__dirname, "..");

            // FIX 5: Pull before push — prevents conflict if two admins publish at the same time
            try {
                execSync("git pull --rebase origin main", {
                    cwd: projectRoot,
                    stdio: "pipe"
                });
                console.log("Git pull complete");
            } catch (pullErr) {
                console.warn("Git pull warning (non-fatal):", pullErr.message);
            }

            execSync("git add .", { cwd: projectRoot });

            const status = execSync(
                "git status --porcelain",
                { cwd: projectRoot }
            ).toString();

            if (status.trim()) {

                execSync(
                    `git commit -m "Delete: ${book.title}"`,
                    { cwd: projectRoot }
                );

                execSync(
                    "git push",
                    { cwd: projectRoot }
                );

                console.log("Git push complete");

            }

        } catch (gitErr) {

            console.warn("Git failed but delete succeeded");

        }

        res.json({ success: true });

    } catch (err) {

        console.error("Delete error:", err);

        res.status(500).json({
            error: "Delete failed."
        });

    }

});

/* ============================
   Publish Setting PDF
============================ */

app.post(
    "/publish-setting/:key",
    upload.single("pdf"),
    (req, res) => {

        const key = req.params.key;

        if (!["credits", "memorial"].includes(key)) {
            return res.status(400).json({
                error: "Invalid setting key."
            });
        }

        if (!req.file) {
            return res.status(400).json({
                error: "No PDF uploaded."
            });
        }

        try {

            const settingsFolder = path.join(
                __dirname,
                "../frontend/books/settings",
                key
            );

            fs.mkdirSync(settingsFolder, { recursive: true });

            fs.readdirSync(settingsFolder).forEach(file => {
                fs.rmSync(
                    path.join(settingsFolder, file),
                    { force: true }
                );
            });

            const finalFileName = `${key}.pdf`;

            const finalPath = path.join(
                settingsFolder,
                finalFileName
            );

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

            /* GIT AUTOMATION — deploy to Cloudflare */

            try {

                const projectRoot = path.resolve(__dirname, "..");

                // Pull first to avoid conflict with other admin
                try {
                    execSync("git pull --rebase origin main", {
                        cwd: projectRoot,
                        stdio: "pipe"
                    });
                    console.log("Git pull complete");
                } catch (pullErr) {
                    console.warn("Git pull warning (non-fatal):", pullErr.message);
                }

                execSync("git add .", { cwd: projectRoot });

                const status = execSync(
                    "git status --porcelain",
                    { cwd: projectRoot }
                ).toString();

                if (status.trim()) {

                    execSync(
                        `git commit -m "Update setting: ${key}"`,
                        { cwd: projectRoot }
                    );

                    execSync("git push", { cwd: projectRoot });

                    console.log("Git push complete for setting:", key);

                }

            } catch (gitErr) {
                console.warn("Git failed but setting upload succeeded:", gitErr.message);
            }

            res.json({ success: true });

        } catch (err) {

            console.error(err);

            res.status(500).json({
                error: err.message || "Upload failed."
            });

        }

    }
);

/* ============================
   Start Server
============================ */

const server = app.listen(PORT, () => {
    console.log(`Admin UI running at http://localhost:${PORT}`);
});