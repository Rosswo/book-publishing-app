const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const convertDocxToHtml = require("./converters/docxConverter");
const splitIntoSections = require("./processors/sectionSplitter");
const writeBook = require("./writers/bookWriter");
const updateBooksRegistry = require("./writers/booksRegistryWriter");

/* ================================
   Structured Logging Helpers
================================ */

function step(message) {
    console.log(`\n➡ ${message}`);
}

function success(message) {
    console.log(`✔ ${message}`);
}

function info(message) {
    console.log(`ℹ ${message}`);
}

function fail(message) {
    console.error(`✖ ${message}`);
}

/* ================================
   DOCX Publish (existing pipeline)
================================ */

async function publishBook({ docxPath, title, description, coverPath }) {

    if (!docxPath) {
        throw new Error("No DOCX file path provided.");
    }

    if (!title || !title.trim()) {
        throw new Error("Title is required.");
    }

    const absolutePath = path.resolve(docxPath);

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`File does not exist: ${absolutePath}`);
    }

    step("Converting DOCX...");
    const html = await convertDocxToHtml(absolutePath);
    success("DOCX converted.");

    step("Splitting into sections...");
    const sections = splitIntoSections(html);

    if (!sections || sections.length === 0) {
        throw new Error("No sections detected after split.");
    }

    success(`Sections detected: ${sections.length}`);

    step("Writing book to filesystem...");
    const result = writeBook(sections);
    success("Book files written.");

    let coverRelativePath = "";

    if (coverPath && fs.existsSync(coverPath)) {

        const ext = path.extname(coverPath);
        const coverFileName = "cover" + ext;

        const destinationPath = path.join(result.bookFolderPath, coverFileName);

        fs.copyFileSync(coverPath, destinationPath);

        coverRelativePath = `./books/${result.bookId}/${coverFileName}`;
    }

    step("Updating books registry...");

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
        title: title.trim(),
        sectionCount: result.sectionCount
    };
}

/* ================================
   NEW: PDF Publish
================================ */

function publishPdfBook({ pdfPath, title, description, coverPath }) {

    if (!pdfPath) {
        throw new Error("No PDF file path provided.");
    }

    if (!title || !title.trim()) {
        throw new Error("Title is required.");
    }

    const absolutePath = path.resolve(pdfPath);

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`File does not exist: ${absolutePath}`);
    }

    const bookId = `book-${Date.now()}`;

    const booksRoot = path.resolve(__dirname, "../../books");
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
        bookId: bookId,
        title: title.trim(),
        description: description || "",
        cover_url: coverRelativePath,
        content_type: "pdf",
        file_path: `./books/${bookId}/${pdfFileName}`
    });

    runGit(title);

    success("PDF book published.");

    return {
        bookId,
        title: title.trim()
    };
}

/* ================================
   Git Automation
================================ */

function runGit(title) {

    step("Running Git automation...");

    const projectRoot = path.resolve(__dirname, "../..");

    try {

        execSync("git add .", { cwd: projectRoot });

        const status = execSync("git status --porcelain", {
            cwd: projectRoot
        }).toString();

        if (status.trim()) {

            execSync(`git commit -m "Publish: ${title}"`, {
                cwd: projectRoot,
                stdio: "inherit"
            });

            execSync("git push", {
                cwd: projectRoot,
                stdio: "inherit"
            });

            success("Git push completed.");
        }

    } catch (gitErr) {
        fail(`Git automation failed: ${gitErr.message}`);
    }
}

/* ================================
   CLI Support
================================ */

if (require.main === module) {

    const inputPath = process.argv[2];

    publishBook({
        docxPath: inputPath,
        title: "Untitled Book",
        description: ""
    })
        .then(() => console.log("Done"))
        .catch(err => {
            fail(err.message || err);
            process.exit(1);
        });
}

module.exports = {
    publishBook,
    publishPdfBook
};