// =============================
// CORE.JS — Reader Engine (STATIC VERSION)
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

    // ================= HTML BOOK =================

    if (book.content_type === "html") {

        const res = await fetch(`./books/${book.content_path}/sections.json`);
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

    // ================= PDF BOOK =================

    else if (book.content_type === "pdf") {

        sections = [];
        currentSectionIndex = 0;

        document.getElementById("sectionPanel").style.display = "none";
        document.getElementById("readerFooter").style.display = "none";
        document.getElementById("readingProgressBar").style.width = "0%";

        const pdfPath = `./books/${book.file_path}`;

        document.getElementById("readerContent").innerHTML = `
            <div class="pdf-wrapper">
                <div id="pdfCanvasContainer" class="pdf-canvas-container">
                    <p style="color:var(--text-muted); padding:20px; text-align:center;">Loading PDF...</p>
                </div>
            </div>
        `;

        await renderPdfToCanvas(pdfPath, "pdfCanvasContainer");
    }
}

/* =========================
   PDF.js Renderer
   FIX 4: Uses devicePixelRatio for sharp rendering on high-DPI screens (Android/iOS)
   Renders canvas at 2x or 3x physical pixels, CSS scales it back down = crisp text
========================= */

async function renderPdfToCanvas(pdfUrl, containerId) {

    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const pdfjsLib = window.pdfjsLib;

        if (!pdfjsLib) {
            container.innerHTML = `<p style="color:red; padding:20px;">PDF library not loaded.</p>`;
            return;
        }

        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;

        container.innerHTML = "";

        // Device pixel ratio: 2 on most phones, 3 on high-end — makes PDFs sharp
        const dpr = window.devicePixelRatio || 1;
        const cssWidth = container.clientWidth || window.innerWidth;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {

            const page = await pdf.getPage(pageNum);

            const unscaledViewport = page.getViewport({ scale: 1 });

            // Scale to fill container width at full device resolution
            const cssScale = cssWidth / unscaledViewport.width;
            const renderScale = cssScale * dpr;

            const viewport = page.getViewport({ scale: renderScale });

            const canvas = document.createElement("canvas");

            // Canvas pixel size = full DPI resolution (sharp)
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            // CSS display size = normal layout size (scales back down cleanly)
            canvas.style.width = cssWidth + "px";
            canvas.style.height = Math.floor(unscaledViewport.height * cssScale) + "px";
            canvas.style.display = "block";
            canvas.style.marginBottom = "8px";
            canvas.style.borderRadius = "4px";

            container.appendChild(canvas);

            const ctx = canvas.getContext("2d");
            await page.render({ canvasContext: ctx, viewport }).promise;
        }

    } catch (err) {
        console.error("PDF render error:", err);
        container.innerHTML = `<p style="color:red; padding:20px;">Failed to load PDF.</p>`;
    }
}

/* =========================
   Section Loading
========================= */

async function loadSection(savedScroll = 0) {

    if (!sections || sections.length === 0) return;

    const container = document.getElementById("readerContent");
    const section = sections[currentSectionIndex];
    if (!section) return;

    const res = await fetch(
        `./books/${currentBook.content_path}/${section.file}`
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
   Image + Caption Grouping
========================= */

function groupImagesWithCaptions(container) {

    const images = container.querySelectorAll(".book-content img");

    images.forEach(img => {

        const next = img.nextElementSibling;

        if (next && next.classList.contains("image-caption")) {

            const wrapper = document.createElement("div");
            wrapper.className = "image-block";

            img.parentNode.insertBefore(wrapper, img);
            wrapper.appendChild(img);
            wrapper.appendChild(next);
        }
    });
}

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

function closeSectionPanel() {
    const panel = document.getElementById("sectionPanel");
    if (panel) panel.style.display = "none";
}

/* =========================
   Image Modal
========================= */

function attachImageHandlers() {

    const container = document.getElementById("readerContent");

    container.onclick = function (e) {

        const img = e.target.closest(".book-content img");
        if (!img) return;

        openImageModal(img.src);
    };
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