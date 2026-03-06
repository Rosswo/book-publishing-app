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

            requestAnimationFrame(async () => {
                await renderPdfToCanvas(pdfPath, "settingsPdfContainer");
            });

            return;
        }

        openAppModal(title, "<p>Not configured yet.</p>");

    } catch (err) {

        console.error("Settings load error:", err);
        openAppModal(title, "<p>Error loading content.</p>");

    }
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
    if (window.AndroidBridge) {
        window.AndroidBridge.exitApp();
    } else {
        window.close();
    }
}