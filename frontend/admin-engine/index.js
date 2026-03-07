const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const convertDocxToHtml = require("./converters/docxConverter");
const splitIntoSections = require("./processors/sectionSplitter");
const writeBook = require("./writers/bookWriter");
const updateBooksRegistry = require("./writers/booksRegistryWriter");

/* ================================
   Logging Helpers
================================ */

function step(msg) {
    console.log(`\n➡ ${msg}`);
}

function success(msg) {
    console.log(`✔ ${msg}`);
}

function fail(msg) {
    console.error(`✖ ${msg}`);
}

/* ================================
   DOCX Publish
================================ */

async function publishBook({ docxPath, title, description, coverPath }) {

    if (!docxPath) throw new Error("No DOCX provided.");
    if (!title || !title.trim()) throw new Error("Title is required.");

    const absolutePath = path.resolve(docxPath);

    if (!fs.existsSync(absolutePath)) {
        throw new Error("DOCX file does not exist.");
    }

    step("Converting DOCX...");
    const html = await convertDocxToHtml(absolutePath);
    success("DOCX converted.");

    step("Splitting sections...");
    const sections = splitIntoSections(html);

    if (!sections.length) {
        throw new Error("No sections detected.");
    }

    success(`Sections: ${sections.length}`);

    step("Writing book...");
    const result = writeBook(sections);
    success("Book written.");

    let coverRelativePath = "";

    if (coverPath && fs.existsSync(coverPath)) {

        const ext = path.extname(coverPath);
        const coverFileName = "cover" + ext;

        const destination = path.join(
            result.bookFolderPath,
            coverFileName
        );

        fs.copyFileSync(coverPath, destination);

        coverRelativePath = `./books/${result.bookId}/${coverFileName}`;
    }

    step("Updating registry...");

    updateBooksRegistry({
        bookId: result.bookId,
        title: title.trim(),
        description: description || "",
        cover_url: coverRelativePath
    });

    success("Registry updated.");

    runGit(title);

    return {
        bookId: result.bookId,
        title,
        sectionCount: result.sectionCount
    };
}

/* ================================
   PDF Publish
================================ */

function publishPdfBook({ pdfPath, title, description, coverPath }) {

    if (!pdfPath) throw new Error("No PDF provided.");
    if (!title || !title.trim()) throw new Error("Title is required.");

    const absolutePath = path.resolve(pdfPath);

    if (!fs.existsSync(absolutePath)) {
        throw new Error("PDF file does not exist.");
    }

    const bookId = `book-${Date.now()}`;

    /* FIXED PATH */
    const booksRoot = path.resolve(__dirname, "../books");

    const bookFolder = path.join(booksRoot, bookId);

    fs.mkdirSync(bookFolder);

    const pdfFileName = "book.pdf";
    const pdfDestination = path.join(bookFolder, pdfFileName);

    fs.copyFileSync(absolutePath, pdfDestination);

    let coverRelativePath = "";

    if (coverPath && fs.existsSync(coverPath)) {

        const ext = path.extname(coverPath);
        const coverFileName = "cover" + ext;

        const coverDestination = path.join(bookFolder, coverFileName);

        fs.copyFileSync(coverPath, coverDestination);

        coverRelativePath = `./books/${bookId}/${coverFileName}`;
    }

    updateBooksRegistry({
        bookId,
        title: title.trim(),
        description: description || "",
        cover_url: coverRelativePath,
        content_type: "pdf",
        file_path: `${bookId}/${pdfFileName}`
    });

    runGit(title);

    success("PDF book published.");

    return {
        bookId,
        title
    };
}

/* ================================
   Git Automation
================================ */

function runGit(title) {

    step("Running Git automation...");

    const projectRoot = path.resolve(__dirname, "../..");

    try {

        // FIX 5: Pull before push — prevents conflict if two admins publish at the same time
        try {
            execSync("git pull --rebase origin main", {
                cwd: projectRoot,
                stdio: "pipe"
            });
            success("Git pull complete.");
        } catch (pullErr) {
            console.warn("Git pull warning (non-fatal):", pullErr.message);
        }

        execSync("git add .", { cwd: projectRoot });

        const status = execSync(
            "git status --porcelain",
            { cwd: projectRoot }
        ).toString();

        if (status.trim()) {

            execSync(`git commit -m "Publish: ${title}"`, {
                cwd: projectRoot,
                stdio: "inherit"
            });

            execSync("git push", {
                cwd: projectRoot,
                stdio: "inherit"
            });

            success("Git push complete.");
        }

    } catch (err) {
        fail(`Git automation failed: ${err.message}`);
    }
}

/* ================================
   CLI Support
================================ */

if (require.main === module) {

    const input = process.argv[2];

    publishBook({
        docxPath: input,
        title: "Untitled Book",
        description: ""
    })
        .then(() => console.log("Done"))
        .catch(err => {
            fail(err.message);
            process.exit(1);
        });
}

module.exports = {
    publishBook,
    publishPdfBook
};