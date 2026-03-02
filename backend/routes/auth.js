const express = require("express");
const path = require("path");
const requireAdmin = require("../middleware/requireAdmin");

const router = express.Router();
const ADMIN_PASSWORD = "admin123";

router.post("/login", (req, res) => {
    if (req.body.password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        return res.json({ success: true });
    }
    res.status(401).json({ error: "Invalid password" });
});

router.get("/logout", (req, res) => {
    req.session.destroy(() => res.redirect("/"));
});

router.get("/admin.html", requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, "..", "..", "frontend", "admin.html"));
});

module.exports = router;