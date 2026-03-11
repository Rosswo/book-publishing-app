const mammoth = require("mammoth");
const fs = require("fs");
const zlib = require("zlib");
const os = require("os");
const path = require("path");

/* ─────────────────────────────────────────────
   MAIN
───────────────────────────────────────────── */
async function convertDocxToHtml(filePath) {

    // 1. Read all files from the DOCX ZIP
    const entries = readZip(filePath);

    // 2. Get word/document.xml
    const docEntry = entries.find(e => e.name === "word/document.xml");
    const xml = docEntry.data.toString("utf8");

    // 3. Extract paragraph texts (state machine preserves leading spaces)
    const paraTexts = extractParaTexts(xml);

    // 4. Build indent map
    const indentMap = buildIndentMap(paraTexts);

    // 5. Inject real Word paragraph styles into XML
    const modifiedXml = injectStyles(xml, indentMap);

    // 6. Write temp DOCX with modified XML
    const modifiedEntries = entries.map(e =>
        e.name === "word/document.xml"
            ? { name: e.name, data: Buffer.from(modifiedXml, "utf8") }
            : e
    );
    const tempPath = path.join(os.tmpdir(), `_docx_temp_${Date.now()}.docx`);
    fs.writeFileSync(tempPath, writeZip(modifiedEntries));

    // 7. Run Mammoth on temp file — styleMap picks up the injected styles
    //    exactly the same way it picks up Heading 1
    const result = await mammoth.convertToHtml(
        { path: tempPath },
        {
            styleMap: [
                "p[style-name='Heading 1'] => h1:fresh",
                "p[style-name='Caption'] => p.image-caption:fresh",
                "p[style-name='song-title'] => p.song-title:fresh",
                "p[style-name='song-verse-indent'] => p.song-verse-indent:fresh",
                "p[style-name='song-chorus'] => p.song-chorus:fresh",
            ]
        }
    );

    // 8. Cleanup
    try { fs.unlinkSync(tempPath); } catch (_) { }

    // 9. Post-process HTML
    let html = result.value;
    html = html.replace(/<p[^>]*>\s*<\/p>/g, "");
    html = html.replace(/\n{2,}/g, "\n").trim();
    html = wrapSongBlocks(html);

    return html;
}

/* ─────────────────────────────────────────────
   READ ZIP
   Reads all entries from a PKZIP file using
   only Node.js built-ins (fs + zlib).
───────────────────────────────────────────── */
function readZip(filePath) {
    const buf = fs.readFileSync(filePath);
    const entries = [];

    // Find End of Central Directory
    let eocd = -1;
    for (let i = buf.length - 22; i >= 0; i--) {
        if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
    }

    const cdOffset = buf.readUInt32LE(eocd + 16);
    const cdEntries = buf.readUInt16LE(eocd + 8);

    let pos = cdOffset;
    for (let i = 0; i < cdEntries; i++) {
        const compression = buf.readUInt16LE(pos + 10);
        const compressedSz = buf.readUInt32LE(pos + 20);
        const fnameLen = buf.readUInt16LE(pos + 28);
        const extraLen = buf.readUInt16LE(pos + 30);
        const commentLen = buf.readUInt16LE(pos + 32);
        const localOffset = buf.readUInt32LE(pos + 42);
        const fname = buf.toString("utf8", pos + 46, pos + 46 + fnameLen);

        const lhFnLen = buf.readUInt16LE(localOffset + 26);
        const lhExLen = buf.readUInt16LE(localOffset + 28);
        const dataStart = localOffset + 30 + lhFnLen + lhExLen;
        const raw = buf.slice(dataStart, dataStart + compressedSz);
        const data = compression === 8 ? zlib.inflateRawSync(raw) : raw;

        entries.push({ name: fname, data });
        pos += 46 + fnameLen + extraLen + commentLen;
    }

    return entries;
}

/* ─────────────────────────────────────────────
   WRITE ZIP
   Writes all entries as stored (uncompressed).
   Includes CRC32 which ZIP requires.
───────────────────────────────────────────── */
function writeZip(entries) {
    const parts = [];
    const cd = [];
    let offset = 0;

    for (const entry of entries) {
        const name = Buffer.from(entry.name, "utf8");
        const data = entry.data;
        const crc = crc32(data);
        const sz = data.length;

        const lh = Buffer.alloc(30 + name.length);
        lh.writeUInt32LE(0x04034b50, 0);
        lh.writeUInt16LE(20, 4);
        lh.writeUInt16LE(0, 6);
        lh.writeUInt16LE(0, 8);   // stored
        lh.writeUInt16LE(0, 10);
        lh.writeUInt16LE(0, 12);
        lh.writeUInt32LE(crc, 14);
        lh.writeUInt32LE(sz, 18);
        lh.writeUInt32LE(sz, 22);
        lh.writeUInt16LE(name.length, 26);
        lh.writeUInt16LE(0, 28);
        name.copy(lh, 30);

        const cde = Buffer.alloc(46 + name.length);
        cde.writeUInt32LE(0x02014b50, 0);
        cde.writeUInt16LE(20, 4);
        cde.writeUInt16LE(20, 6);
        cde.writeUInt16LE(0, 8);
        cde.writeUInt16LE(0, 10);  // stored
        cde.writeUInt16LE(0, 12);
        cde.writeUInt16LE(0, 14);
        cde.writeUInt32LE(crc, 16);
        cde.writeUInt32LE(sz, 20);
        cde.writeUInt32LE(sz, 24);
        cde.writeUInt16LE(name.length, 28);
        cde.writeUInt16LE(0, 30);
        cde.writeUInt16LE(0, 32);
        cde.writeUInt16LE(0, 34);
        cde.writeUInt16LE(0, 36);
        cde.writeUInt32LE(0, 38);
        cde.writeUInt32LE(offset, 42);
        name.copy(cde, 46);

        parts.push(lh, data);
        cd.push(cde);
        offset += lh.length + sz;
    }

    const cdBuf = Buffer.concat(cd);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(cdBuf.length, 12);
    eocd.writeUInt32LE(offset, 16);
    eocd.writeUInt16LE(0, 20);

    return Buffer.concat([...parts, cdBuf, eocd]);
}

function crc32(buf) {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[i] = c;
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ t[(crc ^ buf[i]) & 0xFF];
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

/* ─────────────────────────────────────────────
   EXTRACT PARAGRAPH TEXTS
   State machine — preserves leading spaces that
   are split across multiple <w:t> runs.
───────────────────────────────────────────── */
function extractParaTexts(xml) {
    const paras = [];
    let inPara = false, inText = false;
    let curPara = "", curText = "";
    let i = 0; const n = xml.length;

    while (i < n) {
        if (xml[i] === "<") {
            let j = i + 1;
            while (j < n && xml[j] !== ">") j++;
            const tag = xml.substring(i + 1, j);

            if (tag === "w:p" || tag.startsWith("w:p ")) {
                inPara = true; inText = false; curPara = "";
            } else if (tag === "/w:p") {
                if (inPara) paras.push(curPara);
                inPara = inText = false;
            } else if (inPara && (tag === "w:t" || tag.startsWith("w:t "))) {
                inText = true; curText = "";
            } else if (inPara && tag === "/w:t") {
                curPara += curText; inText = false;
            } else if (inPara && (tag === "w:tab/" || tag.startsWith("w:tab "))) {
                curPara += "\t";
            }
            i = j + 1;
        } else if (inText) {
            let j = i;
            while (j < n && xml[j] !== "<") j++;
            curText += xml.substring(i, j); i = j;
        } else { i++; }
    }
    return paras;
}

/* ─────────────────────────────────────────────
   BUILD INDENT MAP
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
                let j = i + 1;
                while (j < n && !paraTexts[j].trim()) j++;
                const nextText = j < n ? paraTexts[j].trim() : "";
                let k = i - 1;
                while (k >= 0 && !paraTexts[k].trim()) k--;
                const prevSpaces = k >= 0
                    ? paraTexts[k].length - paraTexts[k].replace(/^ +/, "").length
                    : 0;
                if (/^\d+[.)]\s*/.test(nextText) && prevSpaces < 8) {
                    map.set(text, "song-title"); continue;
                }
            }
            map.set(text, "song-verse-indent");
        }
    }
    return map;
}

/* ─────────────────────────────────────────────
   INJECT STYLES INTO XML
   Walks each <w:p> block, checks its plain text
   against the indent map, injects a real Word
   paragraph style (<w:pStyle>) into the XML.
   Mammoth's styleMap then picks it up exactly
   the same way it handles Heading 1.
───────────────────────────────────────────── */
function injectStyles(xml, indentMap) {
    const result = [];
    let i = 0; const n = xml.length;

    while (i < n) {
        const pStart = xml.indexOf("<w:p", i);
        if (pStart === -1) { result.push(xml.substring(i)); break; }

        const after = xml[pStart + 4];
        if (after !== ">" && after !== " " && after !== "\n" && after !== "\r") {
            result.push(xml.substring(i, pStart + 5));
            i = pStart + 5; continue;
        }

        result.push(xml.substring(i, pStart));

        const pEnd = xml.indexOf("</w:p>", pStart) + 6;
        let para = xml.substring(pStart, pEnd);

        // Extract plain text of this paragraph
        let text = "";
        let pi = 0, inT = false, tBuf = "";
        while (pi < para.length) {
            if (para[pi] === "<") {
                let pj = pi + 1;
                while (pj < para.length && para[pj] !== ">") pj++;
                const t = para.substring(pi + 1, pj);
                if (t === "w:t" || t.startsWith("w:t ")) { inT = true; tBuf = ""; }
                else if (t === "/w:t") { text += tBuf; inT = false; }
                else if (t === "w:tab/" || t.startsWith("w:tab ")) { text += "\t"; }
                pi = pj + 1;
            } else if (inT) {
                let pj = pi;
                while (pj < para.length && para[pj] !== "<") pj++;
                tBuf += para.substring(pi, pj); pi = pj;
            } else { pi++; }
        }

        const style = indentMap.get(text.trim());
        if (style) {
            const styleTag = `<w:pStyle w:val="${style}"/>`;
            if (para.includes("<w:pPr>")) {
                para = para.replace("<w:pPr>", `<w:pPr>${styleTag}`);
            } else if (para.includes("<w:pPr ")) {
                const s = para.indexOf("<w:pPr ");
                const e = para.indexOf(">", s) + 1;
                para = para.substring(0, e) + styleTag + para.substring(e);
            } else {
                const e = para.indexOf(">") + 1;
                para = para.substring(0, e) + `<w:pPr>${styleTag}</w:pPr>` + para.substring(e);
            }
        }

        result.push(para);
        i = pEnd;
    }

    return result.join("");
}

/* ─────────────────────────────────────────────
   WRAP SONG BLOCKS
───────────────────────────────────────────── */
function wrapSongBlocks(html) {
    const tokenRe = /(<(?:h[1-6]|p)[^>]*>[\s\S]*?<\/(?:h[1-6]|p)>)/gi;
    const parts = html.split(tokenRe).filter(s => s.trim() !== "");
    let result = "", inSong = false;

    for (const part of parts) {
        const isHeading = /^<h[1-6]/i.test(part);
        const isSongTitle = /class="song-title"/.test(part);
        const isSongLine = /class="song-verse-indent"|class="song-chorus"/.test(part);
        const plainText = part.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
        const isVerseNum = /^\d+[.)]\s*/.test(plainText);

        if (isHeading) {
            if (inSong) { result += "</div>\n"; inSong = false; }
            result += part + "\n"; continue;
        }
        if (!inSong && isSongTitle) {
            result += '<div class="song-block">\n';
            inSong = true;
            result += part + "\n"; continue;
        }
        if (inSong && !isSongLine && !isVerseNum && !isSongTitle && plainText.length > 10) {
            result += "</div>\n"; inSong = false;
        }
        result += part + "\n";
    }
    if (inSong) result += "</div>\n";
    return result;
}

module.exports = convertDocxToHtml;