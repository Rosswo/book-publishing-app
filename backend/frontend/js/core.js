// =============================
// CORE.JS — Reader Engine (UPDATED UX FIX)
// =============================

let currentBook = null;
let sections = [];
let currentSectionIndex = 0;

/* =========================
   Resume Logic
========================= */

function storageKey(id) {
    return `book-progress-${id}`;
}

function saveProgress() {
    if (!currentBook || currentBook.content_type !== "html") return;

    const container = document.getElementById("readerContent");

    localStorage.setItem(
        storageKey(currentBook.id),
        JSON.stringify({
            section: currentSectionIndex,
            scroll: container.scrollTop
        })
    );
}

function loadProgress(id) {
    const data = localStorage.getItem(storageKey(id));
    return data ? JSON.parse(data) : null;
}

/* =========================
   Reader Core
========================= */

function resetReaderState() {
    const container = document.getElementById("readerContent");
    container.scrollTop = 0;
    container.innerHTML = "";
    document.getElementById("sectionPanel").style.display = "none";
}

function closeReader() {
    saveProgress();
    resetReaderState();

    document.getElementById("readerView").style.display = "none";
    document.getElementById("libraryView").style.display = "block";
    document.getElementById("libraryTopbar").style.display = "flex";
    document.getElementById("libraryTaskbar").style.display = "flex";

    currentBook = null;
    sections = [];
    currentSectionIndex = 0;

    updateTaskbarTitle(null);
}

async function openBook(book) {

    resetReaderState();
    currentBook = book;
    addToHistory(book);

    document.getElementById("libraryView").style.display = "none";
    document.getElementById("libraryTopbar").style.display = "none";
    document.getElementById("readerView").style.display = "flex";
    document.getElementById("libraryTaskbar").style.display = "none";

    document.getElementById("readerTitle").innerText = book.title;
    updateTaskbarTitle(book.title);

    if (book.content_type === "html") {

        const res = await fetch(`/uploads/html/${book.content_path}/sections.json`);
        sections = await res.json();

        if (!sections || sections.length === 0) {
            document.getElementById("readerContent").innerHTML =
                "<p style='padding:20px;'>No sections found.</p>";
            return;
        }

        const progress = loadProgress(book.id);
        currentSectionIndex =
            progress && progress.section < sections.length
                ? progress.section
                : 0;

        buildSectionPanel();
        await loadSection(progress ? progress.scroll : 0);

        document.getElementById("readerFooter").style.display = "flex";
        document.getElementById("readingProgressBar").style.width = "0%";
    }

    else if (book.content_type === "pdf") {

        sections = [];
        currentSectionIndex = 0;

        document.getElementById("sectionPanel").style.display = "none";
        document.getElementById("readerFooter").style.display = "none";
        document.getElementById("readingProgressBar").style.width = "0%";

        const pdfPath =
            book.original_pdf_path
                ? `/uploads/books/${book.original_pdf_path}`
                : `/uploads/books/${book.file_path}`;

        document.getElementById("readerContent").innerHTML = `
            <div class="pdf-wrapper">
                <iframe 
                    src="${pdfPath}#toolbar=0"
                    class="pdf-frame">
                </iframe>
            </div>
        `;
    }
}

async function loadSection(savedScroll = 0) {

    if (!sections || sections.length === 0) return;

    const container = document.getElementById("readerContent");
    const section = sections[currentSectionIndex];
    if (!section) return;

    const res = await fetch(
        `/uploads/html/${currentBook.content_path}/${section.file}`
    );

    const html = await res.text();
    container.innerHTML = html;

    groupImagesWithCaptions(container);
    attachImageHandlers();

    requestAnimationFrame(() => {
        container.scrollTop = savedScroll || 0;
    });

    updateActiveSection();
}

/* =========================
   Close Panel Helpers
========================= */

function closeSectionPanel() {
    const panel = document.getElementById("sectionPanel");
    panel.style.display = "none";
}

/* Close when clicking outside */
document.addEventListener("click", function (e) {
    const panel = document.getElementById("sectionPanel");
    const toggleBtn = document.querySelector(".outline-btn");

    if (!panel || panel.style.display !== "block") return;

    if (!panel.contains(e.target) && !toggleBtn.contains(e.target)) {
        closeSectionPanel();
    }
});

/* Close when scrolling */
document.getElementById("readerContent").addEventListener("scroll", function () {
    closeSectionPanel();
});

/* =========================
   Section Navigation
========================= */

function updateActiveSection() {
    document.querySelectorAll(".section-item")
        .forEach((el, i) =>
            el.classList.toggle("active", i === currentSectionIndex)
        );
}

function nextSection() {
    if (!sections.length) return;

    if (currentSectionIndex < sections.length - 1) {
        saveProgress();
        currentSectionIndex++;
        loadSection();
        closeSectionPanel();
    }
}

function prevSection() {
    if (!sections.length) return;

    if (currentSectionIndex > 0) {
        saveProgress();
        currentSectionIndex--;
        loadSection();
        closeSectionPanel();
    }
}

function buildSectionPanel() {
    const panel = document.getElementById("sectionPanel");
    panel.innerHTML = "";

    sections.forEach((section, index) => {
        const item = document.createElement("div");
        item.className = "section-item";
        item.innerText = section.title;

        item.onclick = () => {
            saveProgress();
            currentSectionIndex = index;
            loadSection();
            closeSectionPanel();
        };

        panel.appendChild(item);
    });
}

function toggleSections() {
    if (!sections.length) return;

    const panel = document.getElementById("sectionPanel");
    panel.style.display =
        panel.style.display === "block" ? "none" : "block";
}

/* =========================
   IMAGE MODAL
========================= */

function attachImageHandlers() {
    document.querySelectorAll(".book-content img")
        .forEach(img => {
            img.onclick = () => {
                openImageModal(img.src);
            };
        });
}

function openImageModal(src) {
    const modal = document.getElementById("imageModal");
    const modalImg = document.getElementById("modalImage");

    modalImg.src = src;
    modal.classList.add("active");
}

function closeImageModal() {
    document.getElementById("imageModal").classList.remove("active");
}