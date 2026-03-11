const mammoth = require("mammoth");

async function convertDocxToHtml(filePath) {

    // Pass 1: collect all paragraph raw texts (with leading spaces)
    // via transformDocument before mammoth strips anything
    const paraTexts = [];

    await mammoth.convertToHtml(
        { path: filePath },
        {
            transformDocument: function (doc) {
                collectParagraphTexts(doc, paraTexts);
                return doc; // don't change anything yet
            }
        }
    );

    // Build indent map from collected texts
    const indentMap = buildIndentMap(paraTexts);

    // Pass 2: real conversion, injecting styleName via transformDocument
    const result = await mammoth.convertToHtml(
        { path: filePath },
        {
            styleMap: [
                "p[style-name='Heading 1'] => h1:fresh",
                "p[style-name='Caption'] => p.image-caption:fresh",
                "p[style-name='song-title'] => p.song-title:fresh",
                "p[style-name='song-verse-indent'] => p.song-verse-indent:fresh",
                "p[style-name='song-chorus'] => p.song-chorus:fresh",
            ],
            transformDocument: function (doc) {
                return tagParagraphs(doc, indentMap);
            }
        }
    );

    let html = result.value;

    // Clean empty paragraphs
    html = html.replace(/<p[^>]*>\s*<\/p>/g, "");
    html = html.replace(/\n{2,}/g, "\n").trim();

    // Wrap song blocks
    html = wrapSongBlocks(html);

    return html;
}

/* ─────────────────────────────────────────────
   PASS 1: Collect paragraph texts

   Walk every paragraph in the document tree,
   concatenate ALL text node values (preserving
   the leading spaces that are split across
   multiple <w:t> runs in Word).
───────────────────────────────────────────── */
function collectParagraphTexts(element, out) {
    if (!element) return;
    if (element.type === "paragraph") {
        const fullText = getAllText(element);
        out.push(fullText);
        return; // don't recurse into paragraph children again
    }
    if (element.children) {
        element.children.forEach(child => collectParagraphTexts(child, out));
    }
}

function getAllText(element) {
    if (element.type === "text") return element.value || "";
    if (!element.children) return "";
    return element.children.map(getAllText).join("");
}

/* ─────────────────────────────────────────────
   BUILD INDENT MAP

   Space counts measured from real DOCX:
     0  spaces = verse number line or normal prose
     8–18 spaces = verse continuation line
     19+ spaces = chorus line

   Title detection: 8–18 spaces AND short (≤40 chars)
   AND next non-empty para is a verse number line (1., 2.…)
   AND previous non-empty para is NOT an indented line
───────────────────────────────────────────── */
function buildIndentMap(paraTexts) {
    const n = paraTexts.length;
    const map = new Map();

    for (let i = 0; i < n; i++) {
        const full = paraTexts[i];
        const stripped = full.replace(/^ +/, "");
        const spaces = full.length - stripped.length;
        const text = stripped.trim();

        if (!text) continue;

        if (spaces >= 19) {
            map.set(text, "song-chorus");

        } else if (spaces >= 8) {
            // Could be song-title if short + context matches
            if (text.length <= 40) {
                // Next non-empty
                let j = i + 1;
                while (j < n && !paraTexts[j].trim()) j++;
                const nextText = j < n ? paraTexts[j].trim() : "";
                const nextIsVerse = /^\d+[.)]\s*/.test(nextText);

                // Prev non-empty
                let k = i - 1;
                while (k >= 0 && !paraTexts[k].trim()) k--;
                const prevFull = k >= 0 ? paraTexts[k] : "";
                const prevSpaces = prevFull.length - prevFull.replace(/^ +/, "").length;
                const prevIsSongLine = prevSpaces >= 8;

                if (nextIsVerse && !prevIsSongLine) {
                    map.set(text, "song-title");
                    continue;
                }
            }
            map.set(text, "song-verse-indent");
        }
    }

    return map;
}

/* ─────────────────────────────────────────────
   PASS 2: Tag paragraphs

   Walk document tree, find paragraphs, look up
   their plain text in the indent map, and inject
   a styleName so mammoth maps it to a CSS class.
───────────────────────────────────────────── */
function tagParagraphs(element, indentMap) {
    if (!element) return element;

    if (element.type === "paragraph") {
        const fullText = getAllText(element);
        const text = fullText.trim();
        const cls = indentMap.get(text);
        if (cls) {
            return Object.assign({}, element, { styleName: cls });
        }
        return element;
    }

    if (element.children) {
        return Object.assign({}, element, {
            children: element.children.map(c => tagParagraphs(c, indentMap))
        });
    }

    return element;
}

/* ─────────────────────────────────────────────
   WRAP SONG BLOCKS

   Wraps detected song content in
   <div class="song-block">.
   Opens on song-title, closes on h1 or prose.
───────────────────────────────────────────── */
function wrapSongBlocks(html) {
    const tokenRe = /(<(?:h[1-6]|p)[^>]*>[\s\S]*?<\/(?:h[1-6]|p)>)/gi;
    const parts = html.split(tokenRe).filter(s => s.trim() !== "");

    let result = "";
    let inSong = false;

    for (const part of parts) {
        const isHeading = /^<h[1-6]/i.test(part);
        const isSongTitle = /class="song-title"/.test(part);
        const isSongLine = /class="song-verse-indent"|class="song-chorus"/.test(part);
        const plainText = part.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
        const isVerseNum = /^\d+[.)]\s*/.test(plainText);

        if (isHeading) {
            if (inSong) { result += "</div>\n"; inSong = false; }
            result += part + "\n";
            continue;
        }

        if (!inSong && isSongTitle) {
            result += '<div class="song-block">\n';
            inSong = true;
            result += part + "\n";
            continue;
        }

        if (inSong && !isSongLine && !isVerseNum && !isSongTitle && plainText.length > 10) {
            result += "</div>\n";
            inSong = false;
        }

        result += part + "\n";
    }

    if (inSong) result += "</div>\n";
    return result;
}

module.exports = convertDocxToHtml;