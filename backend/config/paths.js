const express = require("express");
const fs = require("fs");
const path = require("path");

/* =========================
   ENV DETECTION
========================= */

const isRailway = !!process.env.RAILWAY_ENVIRONMENT;

/* =========================
   Upload Base Path
========================= */

const uploadsDir = isRailway
    ? "/data/uploads"
    : path.join(__dirname, "..", "uploads");

const booksDir = path.join(uploadsDir, "books");
const coversDir = path.join(uploadsDir, "covers");
const htmlDir = path.join(uploadsDir, "html");
const imagesDir = path.join(uploadsDir, "images");

/* =========================
   Ensure Directories Exist
========================= */

[uploadsDir, booksDir, coversDir, htmlDir, imagesDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

console.log("Running in Railway?", isRailway);
console.log("Uploads directory:", uploadsDir);

/* =========================
   Export
========================= */

module.exports = {
    uploadsDir,
    booksDir,
    coversDir,
    htmlDir,
    imagesDir,
    uploadsStatic: express.static(uploadsDir)
};