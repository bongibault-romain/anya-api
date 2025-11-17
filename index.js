const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
app.use(express.json());

// --- DB INIT ---
const db = new sqlite3.Database(path.join(__dirname, "db.sqlite"));

// Créer les tables si elles n'existent pas
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS counters (
            id INTEGER PRIMARY KEY,
            value INTEGER NOT NULL
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS ip_logs (
            ip TEXT PRIMARY KEY
        )
    `);

    // Initialiser le compteur si vide
    db.get("SELECT COUNT(*) AS count FROM counters", (err, row) => {
        if (row.count === 0) {
            db.run("INSERT INTO counters (id, value) VALUES (1, 0)");
        }
    });
});

// --- ROUTE GET : récupérer le compteur ---
app.get("/counter", (req, res) => {
    db.get("SELECT value FROM counters WHERE id = 1", (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ counter: row.value });
    });
});

// --- ROUTE POST : incrémenter une fois par IP ---
app.post("/counter/increment", (req, res) => {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    // Vérifier si l'IP a déjà incrementé
    db.get("SELECT ip FROM ip_logs WHERE ip = ?", [ip], (err, row) => {
        if (row) {
            return res.status(403).json({ error: "IP has already incremented the counter" });
        }

        // Ajouter l'IP
        db.run("INSERT INTO ip_logs (ip) VALUES (?)", [ip], (err2) => {
            if (err2) return res.status(500).json({ error: err2.message });

            // Incrémenter le compteur
            db.run("UPDATE counters SET value = value + 1 WHERE id = 1", (err3) => {
                if (err3) return res.status(500).json({ error: err3.message });

                // Retourner la nouvelle valeur
                db.get("SELECT value FROM counters WHERE id = 1", (err4, row2) => {
                    res.json({ counter: row2.value });
                });
            });
        });
    });
});

// --- START ---
const PORT = 3000;
app.listen(PORT, () => {
    console.log("Server running on http://localhost:" + PORT);
});
