// =============================
// APP.JS — Static Version (Branch 1)
// =============================

async function loadBooks() {
    try {
        const response = await fetch("./books/books.json");

        if (!response.ok) {
            throw new Error("books.json not found");
        }

        const books = await response.json();

        const container = document.getElementById("booksContainer");
        container.innerHTML = "";

        if (!books || books.length === 0) {
            container.innerHTML = `
                <div style="opacity:0.6; padding:20px;">
                    No books available.
                </div>
            `;
            return;
        }

        books.forEach(book => {

            const card = document.createElement("div");
            card.className = "book";

            const coverHTML = book.cover_url
                ? `<img src="${book.cover_url}" alt="${book.title}">`
                : "";

            card.innerHTML = `
    ${coverHTML}
    <div class="book-title">${book.title}</div>
    ${book.description ? `<div class="book-description">${book.description}</div>` : ""}
`;

            card.onclick = () => {
                if (typeof openBook === "function") {
                    openBook(book);
                }
            };

            container.appendChild(card);
        });

    } catch (err) {
        console.error("Failed to load books:", err);

        const container = document.getElementById("booksContainer");
        container.innerHTML = `
            <div style="color:red; padding:20px;">
                Failed to load books.
            </div>
        `;
    }
}

loadBooks();