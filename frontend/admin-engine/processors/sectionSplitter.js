function splitIntoSections(html) {

    const headingRegex = /<h1[^>]*>.*?<\/h1>/gis;
    const headings = html.match(headingRegex);

    // If no headings → single section fallback
    if (!headings || headings.length === 0) {
        return [{
            title: "Document",
            content: `<div class="book-content">\n${html}\n</div>`,
            index: 1
        }];
    }

    const parts = html.split(headingRegex);

    const sections = headings.map((heading, i) => {
        const title = heading.replace(/<[^>]*>/g, "").trim();

        const body = parts[i + 1] || "";

        const wrappedContent = `
<div class="book-content">
${heading}
${body}
</div>
        `.trim();

        return {
            title,
            content: wrappedContent,
            index: i + 1
        };
    });

    return sections;
}

module.exports = splitIntoSections;