// =============================
// UI.JS — Scroll + Theme + Taskbar
// =============================

function toggleOptions() {
    const historyDropdown = document.getElementById("historyDropdown");
    const optionsDropdown = document.getElementById("optionsDropdown");

    historyDropdown.classList.remove("active");
    optionsDropdown.classList.toggle("active");
}

/* =========================
   Scroll Logic
========================= */

document.getElementById("readerContent").addEventListener("scroll", function () {

    if (!currentBook || currentBook.content_type !== "html") return;

    const container = this;
    const current = container.scrollTop;
    const header = document.getElementById("readerHeader");
    const footer = document.getElementById("readerFooter");
    const progressBar = document.getElementById("readingProgressBar");
    const backBtn = document.getElementById("backToTopBtn");

    const isScrollingDown = current > lastScroll;
    const isAtBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 5;

    if (isAtBottom) {
        header.classList.remove("hidden");
        footer.classList.remove("hidden");
    } else if (isScrollingDown) {
        header.classList.add("hidden");
        footer.classList.add("hidden");
    } else {
        header.classList.remove("hidden");
        footer.classList.remove("hidden");
    }

    const scrollPercent =
        (container.scrollTop / (container.scrollHeight - container.clientHeight)) * 100;

    progressBar.style.width = scrollPercent + "%";

    if (container.scrollTop > 400) {
        backBtn.classList.add("show");
    } else {
        backBtn.classList.remove("show");
    }

    lastScroll = current;
    saveProgress();
});

function scrollToTop() {
    const container = document.getElementById("readerContent");
    container.scrollTo({ top: 0, behavior: "smooth" });
}

function toggleTheme() {
    document.body.classList.toggle("light");
    localStorage.setItem(
        "theme",
        document.body.classList.contains("light") ? "light" : "dark"
    );
}

(function initTheme() {
    const saved = localStorage.getItem("theme");
    if (saved === "light") document.body.classList.add("light");
})();

function updateTaskbarTitle(title) {
    const el = document.getElementById("taskbarCurrentTitle");
    if (!el) return;
    el.innerText = title ? title : "No Active Book";
}