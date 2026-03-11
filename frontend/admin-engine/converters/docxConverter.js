const mammoth = require("mammoth");

async function convertDocxToHtml(filePath) {

    const result = await mammoth.convertToHtml(
        { path: filePath },
        {
            styleMap: [
                "p[style-name='Heading 1'] => h1:fresh",
                "p[style-name='Caption'] => p.image-caption:fresh",
                // Injected by transformDocument based on leading space count
                "p[style-name='song-verse-indent'] => p.song-verse-indent:fresh",
                "p[style-name='song-chorus'] => p.song-chorus:fresh",
            ],
            transformDocument: transformDocument
        }
    );

    let html = result.value;

    // Remove truly empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, "");
    html = html.replace(/\n{2,}/g, "\n").trim();

    // Wrap detected song blocks
    html = wrapSongBlocks(html);

    return html;
}

/* ================================
   Transform Document
   Runs BEFORE Mammoth converts to HTML.
   Reads raw text of each paragraph,
   counts leading spaces/tabs, and
   injects a custom styleName so
   Mammoth maps it to the right class.

   Space counts from the actual DOCX:
     0 spaces + tab  = verse number line  (e.g. "1.\tVerse text")
     ~12 spaces      = verse continuation line
     ~23 spaces      = chorus line
     ~12 spaces (standalone title) = song title
================================ */

function transformDocument(element) {

    if (element.children) {
        element.children = element.children.map(child => transformDocument(child));
    }

    if (element.type !== "paragraph") return element;

    // Get full raw text of this paragraph
    const rawText = getRawText(element);

    // Count leading spaces
    const leadingSpaces = rawText.length - rawText.trimStart().length;

    // Verse continuation: ~12 spaces (allow 8-18 range for variation)
    if (leadingSpaces >= 8 && leadingSpaces <= 18) {
        return Object.assign({}, element, { styleName: "song-verse-indent" });
    }

    // Chorus: ~23 spaces (allow 19+ range)
    if (leadingSpaces >= 19) {
        return Object.assign({}, element, { styleName: "song-chorus" });
    }

    return element;
}

function getRawText(element) {
    if (element.type === "run" && element.value !== undefined) {
        return element.value;
    }
    if (!element.children) return "";
    return element.children.map(getRawText).join("");
}

/* ================================
   Song Block Wrapper
   Detects song pattern:
     - short standalone line (title)
     - immediately followed by "1.\t" verse
   Wraps them in <div class="song-block">
================================ */

function wrapSongBlocks(html) {
    // Split HTML into paragraph/heading tokens
    const tokenRegex = /(<(?:h1|h2|h3|p)[^>]*>[\s\S]*?<\/(?:h1|h2|h3|p)>)/gi;
    const parts = html.split(tokenRegex).filter(s => s.trim() !== "");

    let result = "";
    let inSong = false;

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isH1 = /^<h1/i.test(part);
        const isSongVerseIndent = /class="song-verse-indent"/.test(part);
        const isSongChorus = /class="song-chorus"/.test(part);
        const isAnySongLine = isSongVerseIndent || isSongChorus;

        // Check if this looks like a verse number line: "1.\t..." or "1. ..."
        const plainText = part.replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, " ").trim();
        const isVerseNumber = /^1[\.\)]\s/.test(plainText) || /^1\t/.test(plainText);

        // Look ahead: if next part is song-structured
        const nextPart = parts[i + 1] || "";
        const nextIsVerseNumber = /^1[\.\)]\s|^1\t/.test(
            nextPart.replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, " ").trim()
        );

        if (isH1) {
            if (inSong) { result += "</div>\n"; inSong = false; }
            result += part + "\n";
            continue;
        }

        // Detect song start: short title line immediately before "1." verse
        if (!inSong && !isAnySongLine && !isVerseNumber) {
            const textLen = plainText.length;
            if (textLen > 0 && textLen <= 80 && nextIsVerseNumber) {
                result += '<div class="song-block">\n';
                result += `<p class="song-title">${part.replace(/^<p[^>]*>/, "").replace(/<\/p>$/, "")}</p>\n`;
                inSong = true;
                continue;
            }
        }

        // Close song block when we hit normal prose (not a song line, not verse number, not empty)
        if (inSong && !isAnySongLine && !isVerseNumber && plainText.length > 0) {
            // Check it's not just a short blank-ish line between verses
            if (plainText.length > 5) {
                result += "</div>\n";
                inSong = false;
            }
        }

        result += part + "\n";
    }

    if (inSong) result += "</div>\n";

    return result;
}

module.exports = convertDocxToHtml;