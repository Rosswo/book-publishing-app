// =============================
// APP.JS — ENTRY
// =============================

async function loadBooks() {
    const res = await fetch("/books");
    const books = await res.json();
    const container = document.getElementById("booksContainer");
    container.innerHTML = "";

    books.forEach(book => {
        const card = document.createElement("div");
        card.className = "book";

        card.innerHTML =
            `${book.cover_path
                ? `<img src="/uploads/covers/${book.cover_path}">`
                : ""}
             <div>${book.title}</div>`;

        card.onclick = () => openBook(book);
        container.appendChild(card);
    });
}

loadBooks();