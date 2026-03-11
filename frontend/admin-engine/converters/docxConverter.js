const mammoth = require("mammoth");
const { execSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

/* ─────────────────────────────────────────────
   MAIN CONVERTER
───────────────────────────────────────────── */
async function convertDocxToHtml(filePath) {

    // Step 1: Build indent map using stdlib Python (no pip needed)
    const indentMap = buildIndentMap(filePath);

    // Step 2: Convert to HTML with Mammoth
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

    // Step 3: Inject indent classes based on map
    // Matches <p> with or without existing attributes
    html = html.replace(/<p([^>]*)>([\s\S]*?)<\/p>/gi, (match, attrs, inner) => {
        const plainText = inner
            .replace(/<[^>]*>/g, "")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&nbsp;/g, " ")
            .replace(/&#\d+;/g, " ")
            .trim();
        const cls = indentMap.get(plainText);
        if (cls) {
            // Replace or add class attribute
            const newAttrs = attrs.replace(/\bclass="[^"]*"/, "").trim();
            return `<p${newAttrs ? " " + newAttrs : ""} class="${cls}">${inner}</p>`;
        }
        return match;
    });

    // Step 4: Remove empty paragraphs
    html = html.replace(/<p[^>]*>\s*<\/p>/g, "");
    html = html.replace(/\n{2,}/g, "\n").trim();

    // Step 5: Wrap song blocks
    html = wrapSongBlocks(html);

    return html;
}

/* ─────────────────────────────────────────────
   BUILD INDENT MAP
   Uses only Python stdlib (zipfile + xml).
   No python-docx or pip required.

   Space counts from actual DOCX text nodes:
     0  spaces = verse number (1., 2., 3.) or prose
     8–18 spaces = verse continuation line
     19+ spaces = chorus line
   Title = 8–18 spaces, short text (≤40 chars),
           preceded by non-song-indent content,
           followed by verse number line
───────────────────────────────────────────── */
function buildIndentMap(filePath) {
    const pythonScript = `
import zipfile, json, sys, re
import xml.etree.ElementTree as ET

NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

def get_para_text(para_el):
    parts = []
    for r in para_el.findall(".//{%s}r" % NS):
        for child in r:
            tag = child.tag.split('}')[-1]
            if tag == 't':
                parts.append(child.text or "")
            elif tag == 'tab':
                parts.append("\\t")
    return "".join(parts)

with zipfile.ZipFile(sys.argv[1]) as z:
    xml_bytes = z.read("word/document.xml")

tree = ET.fromstring(xml_bytes)
body = tree.find("{%s}body" % NS)
paras = []
for p in body.findall("{%s}p" % NS):
    full = get_para_text(p)
    stripped = full.lstrip(" ")
    spaces = len(full) - len(stripped)
    paras.append({"text": stripped.rstrip(), "spaces": spaces})

n = len(paras)
result = {}

for i, p in enumerate(paras):
    text = p["text"].strip()
    spaces = p["spaces"]
    if not text:
        continue
    if spaces >= 19:
        result[text] = "song-chorus"
    elif spaces >= 8:
        if len(text) <= 40:
            # Look forward: next non-empty must be a verse number line
            j = i + 1
            while j < n and not paras[j]["text"].strip():
                j += 1
            next_text = paras[j]["text"].strip() if j < n else ""
            # Look backward: prev non-empty must NOT be a song-indent line
            k = i - 1
            while k >= 0 and not paras[k]["text"].strip():
                k -= 1
            prev_spaces = paras[k]["spaces"] if k >= 0 else 0
            if re.match(r"^\\d+[.)]", next_text) and prev_spaces < 8:
                result[text] = "song-title"
                continue
        result[text] = "song-verse-indent"

print(json.dumps(result, ensure_ascii=False))
`;

    try {
        const tmpScript = path.join(os.tmpdir(), "_docx_indent_map.py");
        fs.writeFileSync(tmpScript, pythonScript, "utf8");
        const output = execSync(
            `python3 "${tmpScript}" "${filePath}"`,
            { timeout: 20000 }
        ).toString("utf8");
        const obj = JSON.parse(output);
        return new Map(Object.entries(obj));
    } catch (err) {
        console.warn("[docxConverter] indent map build failed:", err.message);
        return new Map();
    }
}

/* ─────────────────────────────────────────────
   WRAP SONG BLOCKS

   Opens <div class="song-block"> when it sees
   a paragraph with class="song-title".
   Keeps verse number lines (1., 2., 3. …) inside.
   Closes on h1 or long prose paragraph.
───────────────────────────────────────────── */
function wrapSongBlocks(html) {
    // Split into block-level tokens
    const tokenRe = /(<(?:h[1-6]|p|div)[^>]*>[\s\S]*?<\/(?:h[1-6]|p|div)>)/gi;
    const parts = html.split(tokenRe).filter(s => s.trim() !== "");

    let result = "";
    let inSong = false;

    for (const part of parts) {
        const isH1 = /^<h[1-6]/i.test(part);
        const isSongTitle = /class="song-title"/.test(part);
        const isSongLine = /class="song-verse-indent"|class="song-chorus"/.test(part);

        const plainText = part
            .replace(/<[^>]*>/g, "")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .trim();

        // Verse number lines: 1., 2., 3. etc — keep inside block
        const isVerseNum = /^\d+[.)]\s*/.test(plainText);

        // ── Close on heading
        if (isH1) {
            if (inSong) { result += "</div>\n"; inSong = false; }
            result += part + "\n";
            continue;
        }

        // ── Open on song-title
        if (!inSong && isSongTitle) {
            result += '<div class="song-block">\n';
            inSong = true;
            result += part + "\n";
            continue;
        }

        // ── Close on long prose (not a song class, not a verse number)
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