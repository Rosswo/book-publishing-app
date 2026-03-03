const fs = require("fs");
const path = require("path");
const slugify = require("../utils/slugify");

function writeBook(sections) {

    if (!sections || sections.length === 0) {
        throw new Error("No sections provided to writer.");
    }

    const baseSlug = slugify(sections[0].title);
    const timestamp = Date.now();
    const bookId = `book-${baseSlug}-${timestamp}`;

    const booksRoot = path.resolve(__dirname, "../../books");
    const bookFolderPath = path.join(booksRoot, bookId);

    fs.mkdirSync(bookFolderPath, { recursive: true });

    const metadata = [];

    sections.forEach((section) => {

        const filename = `section-${section.index}.html`;
        const filePath = path.join(bookFolderPath, filename);

        fs.writeFileSync(filePath, section.content, "utf8");

        metadata.push({
            title: section.title,
            file: filename
        });
    });

    fs.writeFileSync(
        path.join(bookFolderPath, "sections.json"),
        JSON.stringify(metadata, null, 2),
        "utf8"
    );

    return {
        bookId,
        bookFolderPath,
        sectionCount: sections.length
    };
}

module.exports = writeBook;