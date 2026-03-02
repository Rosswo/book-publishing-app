// =============================
// UI.JS — Scroll + Theme + Taskbar (STABLE)
// =============================

let lastScroll = 0;

/* =========================
   DOM READY
========================= */

document.addEventListener("DOMContentLoaded", function () {

    const history = document.getElementById("historyDropdown");
    const options = document.getElementById("optionsDropdown");
    const historyBtn = document.getElementById("historyBtn");
    const optionsBtn = document.getElementById("optionsBtn");
    const readerContent = document.getElementById("readerContent");

    /* =========================
       DROPDOWN CONTROLS
    ========================= */

    window.toggleHistory = function () {
        if (!history || !options) return;
        options.classList.remove("active");
        history.classList.toggle("active");
    };

    window.toggleOptions = function () {
        if (!history || !options) return;
        history.classList.remove("active");
        options.classList.toggle("active");
    };

    document.addEventListener("click", function (e) {
        if (!history || !options || !historyBtn || !optionsBtn) return;

        if (
            !history.contains(e.target) &&
            !options.contains(e.target) &&
            !historyBtn.contains(e.target) &&
            !optionsBtn.contains(e.target)
        ) {
            history.classList.remove("active");
            options.classList.remove("active");
        }
    });

    /* =========================
       SCROLL LOGIC (SAFE)
    ========================= */

    if (readerContent) {
        readerContent.addEventListener("scroll", function () {

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
                header?.classList.remove("hidden");
                footer?.classList.remove("hidden");
            } else if (isScrollingDown) {
                header?.classList.add("hidden");
                footer?.classList.add("hidden");
            } else {
                header?.classList.remove("hidden");
                footer?.classList.remove("hidden");
            }

            const scrollPercent =
                (container.scrollTop / (container.scrollHeight - container.clientHeight)) * 100;

            if (progressBar) progressBar.style.width = scrollPercent + "%";

            if (container.scrollTop > 400) {
                backBtn?.classList.add("show");
            } else {
                backBtn?.classList.remove("show");
            }

            lastScroll = current;

            if (typeof saveProgress === "function") {
                saveProgress();
            }
        });
    }
});

/* =========================
   BACK TO TOP
========================= */

function scrollToTop() {
    const container = document.getElementById("readerContent");
    if (!container) return;
    container.scrollTo({ top: 0, behavior: "smooth" });
}

/* =========================
   THEME SYSTEM
========================= */

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

/* =========================
   SAFE STUB (Prevents Core Crash)
========================= */

function updateTaskbarTitle(title) {
    // Taskbar title removed visually
    // Keep this function so core.js does not crash
}