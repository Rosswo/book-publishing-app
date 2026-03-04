const fs = require("fs");
const path = require("path");

function updateBooksRegistry(bookData) {

    const booksJsonPath = path.resolve(__dirname, "../../books/books.json");

    if (!fs.existsSync(booksJsonPath)) {
        throw new Error("books.json not found.");
    }

    const existing = JSON.parse(
        fs.readFileSync(booksJsonPath, "utf8")
    );

    if (existing.some(b => b.id === bookData.bookId)) {
        throw new Error("Duplicate book ID detected.");
    }

    const entry = {
        id: bookData.bookId,
        title: bookData.title,
        description: bookData.description || "",
        cover_url: bookData.cover_url || "",
        content_type: bookData.content_type || "html",
        content_path: null,
        file_path: null,
        original_pdf_path: null
    };

    if (entry.content_type === "html") {
        entry.content_path = bookData.bookId;
    }

    if (entry.content_type === "pdf") {
        entry.file_path = `${bookData.bookId}/book.pdf`;
    }

    existing.push(entry);

    fs.writeFileSync(
        booksJsonPath,
        JSON.stringify(existing, null, 2),
        "utf8"
    );

    return true;
}

module.exports = updateBooksRegistry;