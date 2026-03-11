const mammoth = require("mammoth");
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

/* ================================
   Main Converter
================================ */

async function convertDocxToHtml(filePath) {

    // Step 1: Extract leading-space data from DOCX using Python
    // (Mammoth strips leading spaces — Python reads them raw)
    const indentMap = buildIndentMap(filePath);

    // Step 2: Convert DOCX to HTML with Mammoth
    const result = await mammoth.convertToHtml(
        { path: filePath },
        {
            styleMap: [
                "p[style-name='Heading 1'] => h1:fresh",
                "p[style-name='Caption'] => p.image-caption:fresh",
            ]
        }
    );

    let html = result.value;

    // Step 3: Apply indent classes based on the map
    html = applyIndentClasses(html, indentMap);

    // Step 4: Remove empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, "");
    html = html.replace(/\n{2,}/g, "\n").trim();

    // Step 5: Wrap detected song blocks
    html = wrapSongBlocks(html);

    return html;
}

/* ================================
   Build Indent Map
   Runs Python to read raw paragraph
   text with leading spaces preserved,
   returns Map: normalizedText -> class
================================ */

function buildIndentMap(filePath) {
    const script = `
import json, sys
from docx import Document
doc = Document(sys.argv[1])
out = []
for p in doc.paragraphs:
    text = p.text
    stripped = text.lstrip(' ')
    spaces = len(text) - len(stripped)
    out.append({"text": stripped.rstrip(), "spaces": spaces})
print(json.dumps(out, ensure_ascii=False))
`;

    try {
        const tmpScript = path.join(os.tmpdir(), "docx_indent_helper.py");
        fs.writeFileSync(tmpScript, script, "utf8");

        const output = execSync(
            `python3 "${tmpScript}" "${filePath}"`,
            { timeout: 15000 }
        ).toString("utf8");

        const paragraphs = JSON.parse(output);
        const map = new Map();

        for (const p of paragraphs) {
            const key = p.text.trim();
            if (!key) continue;
            if (p.spaces >= 19) {
                map.set(key, "song-chorus");
            } else if (p.spaces >= 8) {
                map.set(key, "song-verse-indent");
            }
        }

        return map;

    } catch (err) {
        console.warn("Indent map build failed (non-fatal):", err.message);
        return new Map();
    }
}

/* ================================
   Apply Indent Classes
   For each <p> in Mammoth's HTML,
   extract its plain text, look it up
   in the indent map, inject class.
================================ */

function applyIndentClasses(html, indentMap) {
    if (indentMap.size === 0) return html;

    return html.replace(/<p>([\s\S]*?)<\/p>/gi, (match, inner) => {
        // Get plain text from the inner HTML
        const plainText = inner
            .replace(/<[^>]*>/g, "")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&nbsp;/g, " ")
            .replace(/&#[0-9]+;/g, "")
            .trim();

        const cls = indentMap.get(plainText);
        if (cls) {
            return `<p class="${cls}">${inner}</p>`;
        }
        return match;
    });
}

/* ================================
   Song Block Wrapper
   Detects: short title line before "1." verse
   Wraps in <div class="song-block">
================================ */

function wrapSongBlocks(html) {
    const tokenRegex = /(<(?:h1|h2|h3|p)[^>]*>[\s\S]*?<\/(?:h1|h2|h3|p)>)/gi;
    const parts = html.split(tokenRegex).filter(s => s.trim() !== "");

    let result = "";
    let inSong = false;

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isH1 = /^<h1/i.test(part);
        const isSongLine = /class="song-verse-indent"|class="song-chorus"/.test(part);

        const plainText = part
            .replace(/<[^>]*>/g, "")
            .replace(/&nbsp;/g, " ")
            .trim();

        const isVerseOne = /^1[\.\)]\s|^1\t/.test(plainText);

        // Look ahead for verse-one
        const nextPart = parts[i + 1] || "";
        const nextPlain = nextPart.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
        const nextIsVerseOne = /^1[\.\)]\s|^1\t/.test(nextPlain);

        if (isH1) {
            if (inSong) { result += "</div>\n"; inSong = false; }
            result += part + "\n";
            continue;
        }

        // Start song: short title line + next is "1."
        if (!inSong && !isSongLine && !isVerseOne &&
            plainText.length > 0 && plainText.length <= 80 &&
            nextIsVerseOne) {
            result += '<div class="song-block">\n';
            result += `<p class="song-title">${part.replace(/^<p[^>]*>/, "").replace(/<\/p>$/i, "")}</p>\n`;
            inSong = true;
            continue;
        }

        // Close song on normal prose (not a song line, long enough to be prose)
        if (inSong && !isSongLine && !isVerseOne && plainText.length > 10) {
            result += "</div>\n";
            inSong = false;
        }

        result += part + "\n";
    }

    if (inSong) result += "</div>\n";
    return result;
}

module.exports = convertDocxToHtml;