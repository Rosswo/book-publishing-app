const express = require("express");
const session = require("express-session");
const path = require("path");

const authRoutes = require("./routes/auth");
const bookRoutes = require("./routes/books");
const uploadRoutes = require("./routes/upload");
const settingsRoutes = require("./routes/settings");

const requireAdmin = require("./middleware/requireAdmin");
const { uploadsStatic } = require("./config/paths");

const app = express();
const PORT = process.env.PORT || 3000;

/* ==============================
   Paths
============================== */

// app/backend → go up one level → app/frontend
const FRONTEND_PATH = path.join(__dirname, "..", "frontend");

/* ==============================
   Middleware
============================== */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
    session({
        secret: "bookapp-secret-key",
        resave: false,
        saveUninitialized: false,
    })
);

/* ==============================
   Protect Admin Before Static
============================== */

app.get("/admin.html", requireAdmin, (req, res) => {
    res.sendFile(path.join(FRONTEND_PATH, "admin.html"));
});

/* ==============================
   Static Frontend
============================== */

app.use(express.static(FRONTEND_PATH));
app.use("/uploads", uploadsStatic);

/* ==============================
   API Routes
============================== */

app.use(authRoutes);
app.use(bookRoutes);
app.use(uploadRoutes);
app.use(settingsRoutes);

/* ==============================
   Root Route
============================== */

app.get("/", (req, res) => {
    res.sendFile(path.join(FRONTEND_PATH, "index.html"));
});

/* ==============================
   Start Server
============================== */

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});