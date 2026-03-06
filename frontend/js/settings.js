// =============================
// SETTINGS.JS — Static Version
// =============================

function openAppModal(title, contentHTML) {
    document.getElementById("appModalTitle").innerText = title;
    document.getElementById("appModalBody").innerHTML = contentHTML;
    document.getElementById("appModal").classList.add("active");
}

function closeAppModal() {
    document.getElementById("appModal").classList.remove("active");
}

async function renderSetting(key, title) {

    try {

        const basePath = `/books/settings/${key}`;

        const configRes = await fetch(`${basePath}/config.json`);

        if (!configRes.ok) {
            openAppModal(title, "<p>Not configured yet.</p>");
            return;
        }

        const config = await configRes.json();

        // ================= HTML MODE =================
        if (config.content_type === "html") {

            const metaRes = await fetch(`${basePath}/sections.json`);

            if (!metaRes.ok) {
                openAppModal(title, "<p>No content found.</p>");
                return;
            }

            const sections = await metaRes.json();

            let combinedHTML = "";

            for (const section of sections) {
                const sectionRes = await fetch(`${basePath}/${section.file}`);
                combinedHTML += await sectionRes.text();
            }

            openAppModal(
                title,
                `<div class="settings-content">${combinedHTML}</div>`
            );

            if (typeof attachImageHandlers === "function") {
                attachImageHandlers();
            }

            return;
        }

        // ================= PDF MODE =================
        if (config.content_type === "pdf" && config.file) {

            const pdfPath = `${basePath}/${config.file}`;

            openAppModal(
                title,
                `<div id="settingsPdfContainer" class="pdf-canvas-container" style="overflow-y:auto; max-height:80vh;">
                    <p style="color:var(--text-muted); padding:20px; text-align:center;">Loading PDF...</p>
                </div>`
            );

            // Wait for DOM to update then render
            requestAnimationFrame(() => {
                renderSettingsPdf(pdfPath, "settingsPdfContainer");
            });

            return;
        }

        openAppModal(title, "<p>Not configured yet.</p>");

    } catch (err) {

        console.error("Settings load error:", err);
        openAppModal(title, "<p>Error loading content.</p>");

    }
}

async function renderSettingsPdf(pdfUrl, containerId) {

    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        // Reuse renderPdfToCanvas from core.js if available, otherwise load PDF.js
        if (typeof renderPdfToCanvas === "function") {
            await renderPdfToCanvas(pdfUrl, containerId);
            return;
        }

        // Fallback: load PDF.js independently
        if (!window.pdfjsLib) {
            await loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
                "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        }

        const loadingTask = window.pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;

        container.innerHTML = "";

        const devicePixelRatio = window.devicePixelRatio || 1;
        const viewportWidth = container.clientWidth || window.innerWidth;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {

            const page = await pdf.getPage(pageNum);

            const unscaledViewport = page.getViewport({ scale: 1 });
            const scale = (viewportWidth / unscaledViewport.width) * devicePixelRatio;
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement("canvas");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.width = "100%";
            canvas.style.display = "block";
            canvas.style.marginBottom = "8px";
            canvas.style.borderRadius = "4px";

            container.appendChild(canvas);

            const ctx = canvas.getContext("2d");
            await page.render({ canvasContext: ctx, viewport }).promise;
        }

    } catch (err) {
        console.error("Settings PDF render error:", err);
        container.innerHTML = `<p style="color:red; padding:20px;">Failed to load PDF.</p>`;
    }
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
            resolve();
            return;
        }
        const script = document.createElement("script");
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

function openAppVersion() {
    openAppModal(
        "App Version",
        `<p><strong>Version:</strong> 1.0.0</p>
         <p>This version is manually updated when the client upgrades the application.</p>`
    );
}

function openCredits() {
    renderSetting("credits", "Credits");
}

function openMemorial() {
    renderSetting("memorial", "Memorial");
}

function exitApp() {
    if (window.close) {
        window.close();
    } else {
        location.reload();
    }
}