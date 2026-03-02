const express = require("express");
const fs = require("fs");

/* =========================
   Persistent Upload Base
========================= */

const uploadsDir = "/data/uploads";
const booksDir = "/data/uploads/books";
const coversDir = "/data/uploads/covers";
const htmlDir = "/data/uploads/html";
const imagesDir = "/data/uploads/images";

/* =========================
   Ensure Directories Exist
========================= */

[uploadsDir, booksDir, coversDir, htmlDir, imagesDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

/* =========================
   Export Paths
========================= */

module.exports = {
    uploadsDir,
    booksDir,
    coversDir,
    htmlDir,
    imagesDir,
    uploadsStatic: express.static(uploadsDir)
};