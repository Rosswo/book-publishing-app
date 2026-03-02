// =============================
// SETTINGS.JS — Modal + Options
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

    const res = await fetch(`/settings/${key}`);

    if (!res.ok) {
        openAppModal(title, "<p>Not configured yet.</p>");
        return;
    }

    const setting = await res.json();

    if (!setting.content_path && !setting.original_pdf_path) {
        openAppModal(title, "<p>Not configured yet.</p>");
        return;
    }

    // HTML Mode
    if (setting.content_type === "html" && setting.content_path) {

        const metaRes = await fetch(`/uploads/html/${setting.content_path}/sections.json`);
        const meta = await metaRes.json();

        let combinedHTML = "";

        for (const section of meta) {
            const sectionRes = await fetch(
                `/uploads/html/${setting.content_path}/${section.file}`
            );
            combinedHTML += await sectionRes.text();
        }

        openAppModal(
            title,
            `<div class="settings-content">${combinedHTML}</div>`
        );

        attachImageHandlers();
        return;
    }

    // PDF Mode
    if (setting.content_type === "pdf" && setting.original_pdf_path) {
        openAppModal(
            title,
            `<iframe 
                src="/uploads/books/${setting.original_pdf_path}#toolbar=0" 
                style="width:100%; height:75vh; border:none;">
             </iframe>`
        );
        return;
    }

    openAppModal(title, "<p>Not configured yet.</p>");
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