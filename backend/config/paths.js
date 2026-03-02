const path = require("path");
const express = require("express");
const fs = require("fs");

const uploadsDir = path.join(__dirname, "..", "uploads");
const booksDir = path.join(uploadsDir, "books");
const coversDir = path.join(uploadsDir, "covers");
const htmlDir = path.join(uploadsDir, "html");
const imagesDir = path.join(uploadsDir, "images");

[booksDir, coversDir, htmlDir, imagesDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

module.exports = {
    uploadsDir,
    booksDir,
    coversDir,
    htmlDir,
    imagesDir,
    uploadsStatic: express.static(uploadsDir)
};