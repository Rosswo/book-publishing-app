const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
    res.send("RAILWAY WORKING");
});

app.get("/books", (req, res) => {
    res.json([{ test: true }]);
});

app.listen(PORT, "0.0.0.0", () => {
    console.log("Server running on port", PORT);
});