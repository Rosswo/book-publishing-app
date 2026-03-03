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
   Core Publish Function
================================ */

async function publishBook({ docxPath }) {

    if (!docxPath) {
        throw new Error("No DOCX file path provided.");
    }

    const absolutePath = path.resolve(docxPath);

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`File does not exist: ${absolutePath}`);
    }

    /* ================================
       Conversion
    ================================= */

    step("Converting DOCX...");
    const html = await convertDocxToHtml(absolutePath);
    success("DOCX converted.");

    /* ================================
       Section Split
    ================================= */

    step("Splitting into sections...");
    const sections = splitIntoSections(html);

    if (!sections || sections.length === 0) {
        throw new Error("No sections detected after split.");
    }

    success(`Sections detected: ${sections.length}`);

    /* ================================
       Write Book
    ================================= */

    step("Writing book to filesystem...");
    const result = writeBook(sections);
    success("Book files written.");

    /* ================================
       Update Registry
    ================================= */

    step("Updating books registry...");
    updateBooksRegistry({
        bookId: result.bookId,
        title: sections[0].title
    });
    success("Registry updated.");

    console.log("\n📁 Folder:", result.bookFolderPath);
    console.log("📚 Sections:", result.sectionCount);

    /* ================================
       Git Automation
    ================================= */

    step("Running Git automation...");

    const projectRoot = path.resolve(__dirname, "../..");

    try {
        execSync("git add .", { cwd: projectRoot });

        const status = execSync("git status --porcelain", {
            cwd: projectRoot
        }).toString();

        if (!status.trim()) {
            info("No changes to commit.");
        } else {
            const commitMessage = `Publish: ${sections[0].title}`;

            execSync(`git commit -m "${commitMessage}"`, {
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

    success("Publishing complete.");

    return {
        bookId: result.bookId,
        title: sections[0].title,
        sectionCount: result.sectionCount
    };
}

/* ================================
   CLI Support (Backward Compatible)
================================ */

if (require.main === module) {

    console.log("\n================================");
    console.log("      Book Admin Engine");
    console.log("================================");

    const inputPath = process.argv[2];

    publishBook({ docxPath: inputPath })
        .then(() => {
            console.log("\n================================");
            console.log("✔ Done.");
            console.log("================================\n");
        })
        .catch(err => {
            fail(err.message || err);
            process.exit(1);
        });
}

module.exports = publishBook;