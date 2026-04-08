require("dotenv").config();

const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mysql = require("mysql2");
const nodemailer = require("nodemailer");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 3000;

// Middleware
app.use(express.static(__dirname));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =======================
// MYSQL
// =======================
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Bostonceltics2008!", // change if needed
    database: "umb_exchange"
});

db.connect((err) => {
    if (err) {
        console.error("DB CONNECT ERROR:", err);
    } else {
        console.log("Connected to MySQL");
    }
});

// =======================
// EMAIL
// =======================
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS
    }
});

// =======================
// TEMP STORAGE
// =======================
const verificationCodes = {};
const attempts = {};

// =======================
// HOME
// =======================
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// =======================
// GET USER BY ID
// =======================
app.get("/getUser/:id", (req, res) => {
    const userId = Number(req.params.id);

    db.query(
        "SELECT id, email FROM users WHERE id = ?",
        [userId],
        (err, rows) => {
            if (err || rows.length === 0) {
                return res.status(404).json({ success: false });
            }

            res.json({
                success: true,
                user: rows[0]
            });
        }
    );
});

// =======================
// LOGIN (SEND CODE)
// =======================
app.post("/login", (req, res) => {
    try {
        const email = (req.body.email || "").trim().toLowerCase();

        if (!email.endsWith("@umb.edu")) {
            return res.json({
                success: false,
                message: "Only UMB emails allowed"
            });
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        verificationCodes[email] = code;

        setTimeout(() => {
            delete verificationCodes[email];
            delete attempts[email];
        }, 10 * 60 * 1000);

        const mailOptions = {
            from: process.env.GMAIL_USER,
            to: email,
            subject: "UMB Exchange Verification Code",
            text: `Your verification code is: ${code}\n\nExpires in 10 minutes.`
        };

        transporter.sendMail(mailOptions, (err) => {
            if (err) {
                console.error("EMAIL ERROR:", err);
                return res.json({
                    success: false,
                    message: "Error sending email"
                });
            }

            return res.json({
                success: true,
                message: "Verification code sent"
            });
        });
    } catch (err) {
        console.error("LOGIN ERROR:", err);
        res.status(500).json({ success: false });
    }
});

// =======================
// VERIFY CODE
// =======================
app.post("/verify-code", (req, res) => {
    try {
        const email = (req.body.email || "").trim().toLowerCase();
        const code = (req.body.code || "").trim();

        attempts[email] = (attempts[email] || 0) + 1;

        if (attempts[email] > 5) {
            return res.json({ success: false, message: "Too many attempts" });
        }

        if (verificationCodes[email] !== code) {
            return res.json({ success: false, message: "Invalid code" });
        }

        delete verificationCodes[email];
        delete attempts[email];

        const insertSql = `
            INSERT INTO users (email)
            VALUES (?)
            ON DUPLICATE KEY UPDATE email = email
        `;

        db.query(insertSql, [email], (err) => {
            if (err) {
                console.error("USER INSERT ERROR:", err);
                return res.json({ success: false });
            }

            db.query("SELECT id FROM users WHERE email = ?", [email], (err, rows) => {
                if (err || rows.length === 0) {
                    return res.json({ success: false });
                }

                res.json({
                    success: true,
                    user_id: rows[0].id,
                    email
                });
            });
        });
    } catch (err) {
        console.error("VERIFY ERROR:", err);
        res.status(500).json({ success: false });
    }
});

// =======================
// CREATE LISTING
// =======================
app.post("/createListing", (req, res) => {
    try {
        const {
            course_code,
            title,
            edition,
            price,
            book_condition,
            rating,
            description,
            seller_email
        } = req.body;

        if (!seller_email) {
            return res.json({ success: false });
        }

        const sql = `
            INSERT INTO listings
            (course_code, title, edition, price, book_condition, rating, description, seller_email)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.query(
            sql,
            [
                course_code,
                title,
                edition || null,
                price,
                book_condition,
                rating || null,
                description || null,
                seller_email
            ],
            (err, result) => {
                if (err) {
                    console.error("CREATE LISTING ERROR:", err);
                    return res.json({ success: false });
                }

                io.emit("newListing");
                res.json({ success: true, id: result.insertId });
            }
        );
    } catch (err) {
        console.error("CREATE LISTING ROUTE ERROR:", err);
        res.status(500).json({ success: false });
    }
});

// =======================
// GET LISTINGS (WITH SELLER ID)
// =======================
app.get("/getListings", (req, res) => {
    try {
        const course = req.query.course;

        let sql = `
            SELECT listings.*, users.id AS seller_id
            FROM listings
            LEFT JOIN users ON listings.seller_email = users.email
        `;
        let params = [];

        if (course) {
            sql += " WHERE listings.course_code = ?";
            params.push(course);
        }

        sql += " ORDER BY listings.created_at DESC";

        db.query(sql, params, (err, results) => {
            if (err) {
                console.error("GET LISTINGS ERROR:", err);
                return res.json([]);
            }

            res.json(results);
        });
    } catch (err) {
        console.error("GET LISTINGS ROUTE ERROR:", err);
        res.json([]);
    }
});

// =======================
// DELETE LISTING
// =======================
app.post("/deleteListing", (req, res) => {
    try {
        const { id, seller_email } = req.body;

        const sql = "DELETE FROM listings WHERE id = ? AND seller_email = ?";

        db.query(sql, [id, seller_email], (err) => {
            if (err) {
                console.error("DELETE ERROR:", err);
                return res.json({ success: false });
            }

            io.emit("newListing");
            res.json({ success: true });
        });
    } catch (err) {
        console.error("DELETE ROUTE ERROR:", err);
        res.status(500).json({ success: false });
    }
});

// =======================
// GET MESSAGES
// =======================
app.get("/getMessages", (req, res) => {
    try {
        const senderId = Number(req.query.sender_id);
        const receiverId = Number(req.query.receiver_id);
        const listingId = req.query.listing_id ? Number(req.query.listing_id) : null;

        let sql = `
            SELECT *
            FROM messages
            WHERE (
                (sender_id = ? AND receiver_id = ?)
                OR
                (sender_id = ? AND receiver_id = ?)
            )
        `;
        const params = [senderId, receiverId, receiverId, senderId];

        if (listingId) {
            sql += " AND listing_id = ?";
            params.push(listingId);
        } else {
            sql += " AND listing_id IS NULL";
        }

        sql += " ORDER BY timestamp ASC";

        db.query(sql, params, (err, results) => {
            if (err) {
                console.error("GET MESSAGES ERROR:", err);
                return res.status(500).send("Database error");
            }

            res.json(results);
        });
    } catch (err) {
        console.error("GET MESSAGES ROUTE ERROR:", err);
        res.status(500).send("Server error");
    }
});

// =======================
// GET CONVERSATIONS
// =======================
app.get("/getConversations", (req, res) => {
    try {
        const userId = Number(req.query.user_id);

        const sql = `
            SELECT
                other_user.id AS other_user_id,
                other_user.email AS other_user_email,
                m.listing_id,
                m.course_code,
                m.book_title,
                m.message AS last_message,
                m.timestamp AS last_timestamp
            FROM messages m
            JOIN (
                SELECT
                    CASE
                        WHEN sender_id = ? THEN receiver_id
                        ELSE sender_id
                    END AS other_user_id,
                    listing_id,
                    MAX(timestamp) AS max_timestamp
                FROM messages
                WHERE sender_id = ? OR receiver_id = ?
                GROUP BY
                    CASE
                        WHEN sender_id = ? THEN receiver_id
                        ELSE sender_id
                    END,
                    listing_id
            ) latest
                ON (
                    (
                        (m.sender_id = ? AND m.receiver_id = latest.other_user_id)
                        OR
                        (m.receiver_id = ? AND m.sender_id = latest.other_user_id)
                    )
                    AND (m.listing_id <=> latest.listing_id)
                    AND m.timestamp = latest.max_timestamp
                )
            JOIN users other_user
                ON other_user.id = latest.other_user_id
            ORDER BY m.timestamp DESC
        `;

        db.query(
            sql,
            [userId, userId, userId, userId, userId, userId],
            (err, results) => {
                if (err) {
                    console.error("GET CONVERSATIONS ERROR:", err);
                    return res.status(500).json([]);
                }

                res.json(results);
            }
        );
    } catch (err) {
        console.error("GET CONVERSATIONS ROUTE ERROR:", err);
        res.status(500).json([]);
    }
});

// =======================
// SOCKET.IO (CHAT)
// =======================
io.on("connection", (socket) => {
    console.log("User connected");

    socket.on("joinRoom", (room) => {
        socket.join(room);
    });

    socket.on("sendMessage", (data) => {
        const {
            sender_id,
            receiver_id,
            message,
            room,
            listing_id,
            course_code,
            book_title
        } = data;

        db.query(
            `
            INSERT INTO messages
            (sender_id, receiver_id, message, listing_id, course_code, book_title)
            VALUES (?, ?, ?, ?, ?, ?)
            `,
            [
                sender_id,
                receiver_id,
                message,
                listing_id || null,
                course_code || null,
                book_title || null
            ],
            (err, result) => {
                if (err) {
                    console.error("MESSAGE ERROR:", err);
                    return;
                }

                io.to(room).emit("receiveMessage", {
                    id: result.insertId,
                    sender_id,
                    receiver_id,
                    message,
                    listing_id: listing_id || null,
                    course_code: course_code || null,
                    book_title: book_title || null,
                    timestamp: new Date().toISOString()
                });
            }
        );
    });
});

// =======================
// START SERVER
// =======================
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});