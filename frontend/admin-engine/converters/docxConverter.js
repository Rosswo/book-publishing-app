const mammoth = require("mammoth");

async function convertDocxToHtml(filePath) {
    const result = await mammoth.convertToHtml(
        { path: filePath },
        {
            styleMap: [
                // Section headings — split into reader sections
                "p[style-name='Heading 1'] => h1:fresh",

                // Image captions
                "p[style-name='Caption'] => p.image-caption:fresh",

                // Song title marker — client applies "Subtitle" style in Word
                // to the title line of every song
                "p[style-name='Subtitle'] => h2.song-title:fresh"
            ]
        }
    );

    let html = result.value;

    // Remove blank paragraphs
    html = html.replace(/<p>\s*<\/p>/g, "");

    // Wrap song blocks:
    // Everything from <h2 class="song-title"> until the next <h1> or <h2 class="song-title">
    // gets wrapped in <div class="song-block"> so CSS preserves spacing exactly
    html = wrapSongBlocks(html);

    html = html.replace(/\n{2,}/g, "\n").trim();

    return html;
}

/* ================================
   Song Block Wrapper
   Detects <h2 class="song-title"> and wraps
   all following content until the next
   section boundary in a song-block div.
   Normal paragraphs outside are completely untouched.
================================ */

function wrapSongBlocks(html) {
    const boundaryRegex = /(<h1[^>]*>.*?<\/h1>|<h2[^>]*class="song-title"[^>]*>.*?<\/h2>)/gis;
    const parts = html.split(boundaryRegex);

    let result = "";
    let inSong = false;

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isSongTitle = /<h2[^>]*class="song-title"[^>]*>/i.test(part);
        const isH1 = /<h1[^>]*>/i.test(part);

        if (isSongTitle) {
            // Close any previous song block
            if (inSong) result += "</div>\n";
            // Open a new song block with the title inside
            result += `<div class="song-block">\n${part}\n`;
            inSong = true;
        } else if (isH1) {
            // Close song block before a new chapter heading
            if (inSong) {
                result += "</div>\n";
                inSong = false;
            }
            result += part;
        } else {
            result += part;
        }
    }

    // Close any unclosed song block at end of document
    if (inSong) result += "</div>\n";

    return result;
}

module.exports = convertDocxToHtml;