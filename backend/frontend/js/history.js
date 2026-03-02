// =============================
// HISTORY.JS — Stable + UI Compatible
// =============================

const HISTORY_KEY = "book-history";
const HISTORY_LIMIT = 5;

/* =========================
   Get History
========================= */

function getHistory() {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
}

/* =========================
   Save History
========================= */

function saveHistory(history) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

/* =========================
   Add Book To History
========================= */

function addToHistory(book) {
    if (!book) return;

    let history = getHistory();

    // Remove duplicate
    history = history.filter(item => item.id !== book.id);

    // Add to front
    history.unshift({
        id: book.id,
        title: book.title,
        cover_path: book.cover_path,
        content_path: book.content_path,
        content_type: book.content_type,
        file_path: book.file_path,
        original_pdf_path: book.original_pdf_path,
        lastReadAt: Date.now()
    });

    // Limit history size
    history = history.slice(0, HISTORY_LIMIT);

    saveHistory(history);
}

/* =========================
   Remove From History
========================= */

function removeFromHistory(id) {
    let history = getHistory();
    history = history.filter(item => item.id !== id);
    saveHistory(history);
}

/* =========================
   Render History List
========================= */

function renderHistory() {

    const list = document.getElementById("historyList");
    if (!list) return;

    list.innerHTML = "";

    const history = getHistory();

    if (history.length === 0) {
        list.innerHTML =
            "<div class='history-item'>No recently read books</div>";
        return;
    }

    history.forEach(item => {

        const row = document.createElement("div");
        row.className = "history-item";
        row.style.display = "flex";
        row.style.justifyContent = "space-between";
        row.style.alignItems = "center";

        const title = document.createElement("span");
        title.innerText = item.title;
        title.style.flex = "1";
        title.style.cursor = "pointer";

        title.onclick = () => {
            const dropdown = document.getElementById("historyDropdown");
            if (dropdown) dropdown.classList.remove("active");

            if (typeof openBook === "function") {
                openBook(item);
            }
        };

        const del = document.createElement("span");
        del.innerText = "✕";
        del.style.cursor = "pointer";
        del.style.opacity = "0.6";
        del.style.marginLeft = "10px";

        del.onclick = (e) => {
            e.stopPropagation();
            removeFromHistory(item.id);
            renderHistory();
        };

        row.appendChild(title);
        row.appendChild(del);
        list.appendChild(row);
    });
}

/* =========================
   Auto Render When Page Loads
========================= */

document.addEventListener("DOMContentLoaded", function () {
    renderHistory();
});