const mammoth = require("mammoth");

async function convertDocxToHtml(filePath) {
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

    // Remove truly empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, "");
    html = html.replace(/\n{2,}/g, "\n").trim();

    // Auto-detect and wrap song blocks
    html = wrapSongBlocks(html);

    return html;
}

/* ================================
   Song Block Auto-Detection

   Pattern detected:
   - A short standalone line (song title)
   - Immediately followed by a paragraph starting with "1."
   - Everything from that title until the next h1 or next song title
     is wrapped in <div class="song-block">

   Leading spaces and &nbsp; are preserved via CSS pre-wrap
   so chorus indentation appears exactly as typed in Word.

   Normal numbered paragraphs (e.g. "1. In the beginning...")
   won't trigger this because they won't be preceded by a
   short standalone title line and followed by song-structured content.
================================ */

function wrapSongBlocks(html) {
    // Split into individual tags/text chunks for processing
    const tokenRegex = /(<[^>]+>|[^<]+)/g;
    const tokens = html.match(tokenRegex) || [];

    // First pass: parse into paragraph objects
    // Each paragraph: { open, content, close, raw }
    const paragraphs = [];
    let i = 0;
    while (i < tokens.length) {
        const tok = tokens[i];
        if (/^<p[\s>]/i.test(tok)) {
            let inner = "";
            let close = "";
            let j = i + 1;
            while (j < tokens.length) {
                if (/^<\/p>/i.test(tokens[j])) {
                    close = tokens[j];
                    break;
                }
                inner += tokens[j];
                j++;
            }
            paragraphs.push({ open: tok, content: inner, close, raw: tok + inner + close, index: i });
            i = j + 1;
        } else if (/^<h1[\s>]/i.test(tok)) {
            // Find closing h1
            let inner = "";
            let close = "";
            let j = i + 1;
            while (j < tokens.length) {
                if (/^<\/h1>/i.test(tokens[j])) { close = tokens[j]; break; }
                inner += tokens[j];
                j++;
            }
            paragraphs.push({ open: tok, content: inner, close, raw: tok + inner + close, isH1: true, index: i });
            i = j + 1;
        } else {
            // whitespace between tags — skip
            i++;
        }
    }

    // Second pass: identify song blocks
    // A song starts when:
    //   paragraph[n] is short (<=80 chars, no period mid-sentence feel)
    //   AND paragraph[n+1] starts with "1." or "1 "
    function getPlainText(content) {
        return content.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
    }

    function startsWithVerseNumber(content) {
        const text = getPlainText(content);
        return /^1[\.\)]\s/.test(text);
    }

    function isShortTitleLine(content) {
        const text = getPlainText(content);
        return text.length > 0 && text.length <= 80 && !text.match(/^[0-9]+[\.\)]/);
    }

    const result = [];
    let inSong = false;

    for (let n = 0; n < paragraphs.length; n++) {
        const p = paragraphs[n];
        const next = paragraphs[n + 1];

        if (p.isH1) {
            if (inSong) { result.push("</div>"); inSong = false; }
            result.push(p.raw);
            continue;
        }

        // Detect song start: short title line + next paragraph starts with "1."
        if (!inSong && next && !next.isH1 &&
            isShortTitleLine(p.content) &&
            startsWithVerseNumber(next.content)) {
            result.push('<div class="song-block">');
            result.push(`<p class="song-title">${p.content}</p>`);
            inSong = true;
            continue;
        }

        if (inSong) {
            result.push(p.raw);
        } else {
            result.push(p.raw);
        }
    }

    if (inSong) result.push("</div>");

    return result.join("\n");
}

module.exports = convertDocxToHtml;