// =============================
// UI.JS — Scroll + Theme + Taskbar (UPDATED)
// =============================

/* =========================
   DROPDOWN CONTROLS (PRODUCTION SAFE)
========================= */

document.addEventListener("DOMContentLoaded", function () {

    const history = document.getElementById("historyDropdown");
    const options = document.getElementById("optionsDropdown");
    const historyBtn = document.getElementById("historyBtn");
    const optionsBtn = document.getElementById("optionsBtn");

    window.toggleHistory = function () {
        options.classList.remove("active");
        history.classList.toggle("active");
    };

    window.toggleOptions = function () {
        history.classList.remove("active");
        options.classList.toggle("active");
    };

    document.addEventListener("click", function (e) {
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
});


/* =========================
   SCROLL LOGIC
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


/* =========================
   BACK TO TOP
========================= */

function scrollToTop() {
    const container = document.getElementById("readerContent");
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