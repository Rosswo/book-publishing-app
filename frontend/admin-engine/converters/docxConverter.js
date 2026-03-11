const mammoth = require("mammoth");
const fs = require("fs");
const zlib = require("zlib");

async function convertDocxToHtml(filePath) {

    // Step 1: Read raw DOCX (ZIP) and extract word/document.xml
    //         using only Node.js built-ins (fs + zlib). No Python. No npm.
    const xml = extractDocumentXml(filePath);

    // Step 2: Parse paragraphs with a state machine to preserve leading spaces
    const paraTexts = extractParaTexts(xml);

    // Step 3: Build indent map (song-title / song-verse-indent / song-chorus)
    const indentMap = buildIndentMap(paraTexts);

    // Step 4: Run mammoth - styleMap turns injected styleNames into CSS classes
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
            transformDocument: (doc) => tagParagraphs(doc, indentMap)
        }
    );

    let html = result.value;
    html = html.replace(/<p[^>]*>\s*<\/p>/g, "");
    html = html.replace(/\n{2,}/g, "\n").trim();
    html = wrapSongBlocks(html);

    return html;
}

/* ─────────────────────────────────────────────
   STEP 1: Extract word/document.xml from DOCX

   DOCX is a PKZIP file. We find the central
   directory, locate word/document.xml, read its
   local file header, then deflate-decompress
   the data with Node's built-in zlib.
───────────────────────────────────────────── */
function extractDocumentXml(filePath) {
    const buf = fs.readFileSync(filePath);

    // Find End of Central Directory (last PK\x05\x06)
    let eocd = -1;
    for (let i = buf.length - 22; i >= 0; i--) {
        if (buf[i] === 0x50 && buf[i + 1] === 0x4b && buf[i + 2] === 0x05 && buf[i + 3] === 0x06) {
            eocd = i; break;
        }
    }
    if (eocd === -1) throw new Error("Not a valid ZIP/DOCX file");

    const cdOffset = buf.readUInt32LE(eocd + 16);
    const cdEntries = buf.readUInt16LE(eocd + 8);

    // Scan central directory for "word/document.xml"
    let pos = cdOffset;
    for (let i = 0; i < cdEntries; i++) {
        const sig = buf.readUInt32LE(pos);
        if (sig !== 0x02014b50) break;

        const compression = buf.readUInt16LE(pos + 10);
        const compressedSize = buf.readUInt32LE(pos + 20);
        const fnameLen = buf.readUInt16LE(pos + 28);
        const extraLen = buf.readUInt16LE(pos + 30);
        const commentLen = buf.readUInt16LE(pos + 32);
        const localOffset = buf.readUInt32LE(pos + 42);
        const fname = buf.toString("utf8", pos + 46, pos + 46 + fnameLen);

        if (fname === "word/document.xml") {
            // Read local file header to find data start
            const lhFnameLen = buf.readUInt16LE(localOffset + 26);
            const lhExtraLen = buf.readUInt16LE(localOffset + 28);
            const dataStart = localOffset + 30 + lhFnameLen + lhExtraLen;
            const compressed = buf.slice(dataStart, dataStart + compressedSize);

            if (compression === 8) {
                return zlib.inflateRawSync(compressed).toString("utf8");
            } else {
                return compressed.toString("utf8"); // stored uncompressed
            }
        }

        pos += 46 + fnameLen + extraLen + commentLen;
    }

    throw new Error("word/document.xml not found in DOCX");
}

/* ─────────────────────────────────────────────
   STEP 2: Extract paragraph texts

   State machine walks the XML character by
   character. Handles <w:p>, <w:t>, <w:tab/>.
   Preserves ALL leading spaces exactly as typed.
   No regex - avoids issues with nested tags.
───────────────────────────────────────────── */
function extractParaTexts(xml) {
    const paras = [];
    let inPara = false;
    let inText = false;
    let curPara = "";
    let curText = "";

    let i = 0;
    const n = xml.length;

    while (i < n) {
        if (xml[i] === "<") {
            // Scan to end of tag
            let j = i + 1;
            while (j < n && xml[j] !== ">") j++;
            const tag = xml.substring(i + 1, j);

            if (tag === "w:p" || tag.startsWith("w:p ")) {
                inPara = true;
                inText = false;
                curPara = "";
            } else if (tag === "/w:p") {
                if (inPara) paras.push(curPara);
                inPara = false;
                inText = false;
            } else if (inPara && (tag === "w:t" || tag.startsWith("w:t "))) {
                inText = true;
                curText = "";
            } else if (inPara && tag === "/w:t") {
                curPara += curText;
                inText = false;
            } else if (inPara && (tag === "w:tab/" || tag.startsWith("w:tab "))) {
                curPara += "\t";
            }

            i = j + 1;

        } else if (inText) {
            let j = i;
            while (j < n && xml[j] !== "<") j++;
            curText += xml.substring(i, j);
            i = j;
        } else {
            i++;
        }
    }

    return paras;
}

/* ─────────────────────────────────────────────
   STEP 3: Build indent map

   Thresholds from real DOCX measurement:
     0  spaces → prose or verse number line
     8–18 spaces → verse continuation line
     19+ spaces → chorus line

   Title = 8–18 spaces, ≤40 chars, preceded by
   prose (prev para not indented), followed by
   a verse number line (starts with digit + dot)
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
            if (text.length <= 40) {
                // look forward: next non-empty must start with verse number
                let j = i + 1;
                while (j < n && !paraTexts[j].trim()) j++;
                const nextText = j < n ? paraTexts[j].trim() : "";
                const nextIsVerse = /^\d+[.)]\s*/.test(nextText);

                // look backward: prev non-empty must NOT be indented
                let k = i - 1;
                while (k >= 0 && !paraTexts[k].trim()) k--;
                const prevFull = k >= 0 ? paraTexts[k] : "";
                const prevSpaces = prevFull.length - prevFull.replace(/^ +/, "").length;

                if (nextIsVerse && prevSpaces < 8) {
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
   STEP 4a: Tag paragraphs in mammoth's document
   tree by injecting styleName based on indent map
───────────────────────────────────────────── */
function tagParagraphs(element, indentMap) {
    if (!element) return element;
    if (element.type === "paragraph") {
        const text = getAllText(element).trim();
        const cls = indentMap.get(text);
        if (cls) return Object.assign({}, element, { styleName: cls });
        return element;
    }
    if (element.children) {
        return Object.assign({}, element, {
            children: element.children.map(c => tagParagraphs(c, indentMap))
        });
    }
    return element;
}

function getAllText(el) {
    if (el.type === "text") return el.value || "";
    if (!el.children) return "";
    return el.children.map(getAllText).join("");
}

/* ─────────────────────────────────────────────
   STEP 4b: Wrap song-block div around songs

   Opens on <p class="song-title">.
   Keeps verse number lines (1., 2., 3.) inside.
   Closes on heading or long prose paragraph.
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