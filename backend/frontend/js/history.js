// =============================
// HISTORY.JS
// =============================

const HISTORY_KEY = "book-history";

function getHistory() {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
}

function saveHistory(history) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function addToHistory(book) {
    let history = getHistory();
    history = history.filter(item => item.id !== book.id);

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

    history = history.slice(0, 5);
    saveHistory(history);
}

function removeFromHistory(id) {
    let history = getHistory();
    history = history.filter(item => item.id !== id);
    saveHistory(history);
}

function toggleHistory() {
    const historyDropdown = document.getElementById("historyDropdown");
    const optionsDropdown = document.getElementById("optionsDropdown");

    optionsDropdown.classList.remove("active");

    if (historyDropdown.classList.contains("active")) {
        historyDropdown.classList.remove("active");
        return;
    }

    renderHistory();
    historyDropdown.classList.add("active");
}

function renderHistory() {
    const list = document.getElementById("historyList");
    list.innerHTML = "";

    const history = getHistory();

    if (history.length === 0) {
        list.innerHTML = "<div class='history-item'>No recently read books</div>";
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
            document.getElementById("historyDropdown").classList.remove("active");
            openBook(item);
        };

        const del = document.createElement("span");
        del.innerText = "✕";
        del.style.cursor = "pointer";
        del.style.opacity = "0.6";

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