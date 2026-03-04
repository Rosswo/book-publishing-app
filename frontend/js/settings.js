// =============================
// SETTINGS.JS — Static Version (Mobile PDF Fix)
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

        const basePath = `./books/settings/${key}`;

        // Load config
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

            const isMobile =
                /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
                window.innerWidth < 768;

            // Mobile → open native PDF viewer
            if (isMobile) {
                window.location.href = pdfPath;
                return;
            }

            // Desktop → modal viewer
            openAppModal(
                title,
                `<iframe
                    src="${pdfPath}"
                    style="width:100%; height:75vh; border:none;">
                </iframe>`
            );

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

    if (window.close) {
        window.close();
    } else {
        location.reload();
    }

}