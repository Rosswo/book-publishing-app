const mammoth = require("mammoth");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const { htmlDir, imagesDir } = require("../config/paths");

/* =========================
   Reduce Sharp Memory Usage
========================= */

sharp.cache(false);
sharp.concurrency(1);

async function convertDocxToSections(docxPath, folderName) {

    const savedImages = [];

    const result = await mammoth.convertToHtml(
        { path: docxPath },
        {
            styleMap: [
                "p[style-name='Heading 1'] => h1:fresh",
                "p[style-name='Caption'] => p.image-caption:fresh"
            ],

            convertImage: mammoth.images.inline(async (element) => {

                const imageBuffer = await element.read();

                const imageName =
                    Date.now() +
                    "-" +
                    Math.random().toString(36).substring(2, 8) +
                    ".jpg";

                const imagePath = path.join(imagesDir, imageName);

                await sharp(imageBuffer)
                    .resize({
                        width: 1000, // lowered from 1200
                        withoutEnlargement: true
                    })
                    .jpeg({
                        quality: 60, // lowered from 65
                        mozjpeg: true
                    })
                    .toFile(imagePath);

                savedImages.push(imageName);

                return { src: `/uploads/images/${imageName}` };
            }),
        }
    );

    let html = result.value
        .replace(/<p>\s*<\/p>/g, "")
        .replace(/\n{2,}/g, "\n")
        .trim();

    /* ======================================
       REMOVE "Figure X:" FROM CAPTIONS
    ====================================== */

    html = html.replace(
        /<p class="image-caption">Figure\s*\d+[:.\s-]*/gi,
        '<p class="image-caption">'
    );

    const bookFolder = path.join(htmlDir, folderName);
    fs.mkdirSync(bookFolder, { recursive: true });

    const metadata = [];

    /* ======================================
       Section Parsing Logic
    ====================================== */

    const rawChunks = html.split(/(<h1[^>]*>.*?<\/h1>)/gs).filter(Boolean);

    let sections = [];
    let currentSection = {
        titleParts: [],
        content: ""
    };

    rawChunks.forEach(chunk => {

        const isHeading = /^<h1/i.test(chunk.trim());

        if (isHeading) {

            if (currentSection.content.trim() !== "" || currentSection.titleParts.length > 0) {
                sections.push(currentSection);
                currentSection = { titleParts: [], content: "" };
            }

            const cleanTitle = chunk
                .replace(/<[^>]*>/g, "")
                .trim();

            currentSection.titleParts.push(cleanTitle);

        } else {
            currentSection.content += chunk;
        }
    });

    if (currentSection.content.trim() !== "" || currentSection.titleParts.length > 0) {
        sections.push(currentSection);
    }

    if (sections.length === 0) {
        sections = [{
            titleParts: ["Document"],
            content: html
        }];
    }

    /* ======================================
       Save Sections
    ====================================== */

    sections.forEach((section, index) => {

        const title =
            section.titleParts.length > 0
                ? section.titleParts.join(" — ")
                : `Section ${index + 1}`;

        const wrapped = `
<div class="book-content">
${section.content}
</div>
        `;

        const filename = `section-${index + 1}.html`;

        fs.writeFileSync(
            path.join(bookFolder, filename),
            wrapped
        );

        metadata.push({
            title,
            file: filename
        });
    });

    fs.writeFileSync(
        path.join(bookFolder, "sections.json"),
        JSON.stringify(metadata, null, 2)
    );

    return savedImages;
}

module.exports = convertDocxToSections;