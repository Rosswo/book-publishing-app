const mammoth = require("mammoth");

async function convertDocxToHtml(filePath) {
    const result = await mammoth.convertToHtml(
        { path: filePath },
        {
            styleMap: [
                "p[style-name='Heading 1'] => h1:fresh",
                "p[style-name='Caption'] => p.image-caption:fresh"
            ]
        }
    );

    let html = result.value
        .replace(/<p>\s*<\/p>/g, "")
        .replace(/\n{2,}/g, "\n")
        .trim();

    return html;
}

module.exports = convertDocxToHtml;