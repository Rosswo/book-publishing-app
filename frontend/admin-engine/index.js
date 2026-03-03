const fs = require("fs");
const path = require("path");

const convertDocxToHtml = require("./converters/docxConverter");
const splitIntoSections = require("./processors/sectionSplitter");
const writeBook = require("./writers/bookWriter");
const updateBooksRegistry = require("./writers/booksRegistryWriter");

console.log("Book Admin Engine Starting...");

const inputPath = process.argv[2];

if (!inputPath) {
    console.error("❌ No DOCX file path provided.");
    process.exit(1);
}

const absolutePath = path.resolve(inputPath);

if (!fs.existsSync(absolutePath)) {
    console.error("❌ File does not exist:", absolutePath);
    process.exit(1);
}

(async () => {
    try {
        console.log("📄 Converting DOCX...");
        const html = await convertDocxToHtml(absolutePath);

        console.log("✂ Splitting into sections...");
        const sections = splitIntoSections(html);

        console.log("🧩 Sections detected:", sections.length);

        console.log("💾 Writing book...");
        const result = writeBook(sections);

        updateBooksRegistry({
            bookId: result.bookId,
            title: sections[0].title
        });

        console.log("✅ Book generated and registered.");
        console.log("📁 Folder:", result.bookFolderPath);
        console.log("📚 Sections:", result.sectionCount);

    } catch (err) {
        console.error("❌ Error:", err);
        process.exit(1);
    }
})();