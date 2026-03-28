require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const mysql = require("mysql2");
const nodemailer = require("nodemailer");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname));
app.use(express.json());

// =======================
// MYSQL
// =======================
const db = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Marcosmaia2004!",
    database: "umb_exchange"
});

db.connect(err => {
    if (err) console.error(err);
    else console.log("Connected to MySQL");
});

// =======================
// EMAIL (GMAIL SMTP)
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
// LOGIN (SEND CODE)
// =======================
app.post("/login", (req, res) => {
    const email = req.body.email.trim().toLowerCase();

    if (!email.endsWith("@umb.edu")) {
        return res.json({
            success: false,
            message: "Only UMB emails allowed"
        });
    }

    const code = Math.floor(100000 + Math.random() * 900000);
    verificationCodes[email] = code;

    setTimeout(() => {
        delete verificationCodes[email];
        delete attempts[email];
    }, 10 * 60 * 1000);

    const mailOptions = {
        from: `"UMB Exchange" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: "Your UMB Exchange Verification Code",
        html: `
        <div style="font-family: Arial; background:#f4f6f8; padding:30px;">
            <div style="max-width:500px; margin:auto; background:white; padding:20px; border-radius:10px; text-align:center;">
                <h2 style="color:#2b6cb0;">UMB Exchange</h2>
                <h3>Verification Code</h3>
                <p>Use this code to log in:</p>
                <div style="font-size:28px; font-weight:bold; letter-spacing:5px; margin:20px;">
                    ${code}
                </div>
                <a href="http://localhost:3000"
                   style="display:inline-block; padding:10px 20px; background:#2b6cb0; color:white; text-decoration:none; border-radius:5px;">
                   Go to UMB Exchange
                </a>
                <p style="font-size:12px; color:gray; margin-top:20px;">
                    This code expires in 10 minutes.
                </p>
            </div>
        </div>
        `
    };

    transporter.sendMail(mailOptions, (err) => {
        if (err) {
            console.error(err);
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
});

// =======================
// VERIFY CODE
// =======================
app.post("/verify-code", (req, res) => {
    const { email, code } = req.body;

    attempts[email] = (attempts[email] || 0) + 1;

    if (attempts[email] > 5) {
        return res.json({
            success: false,
            message: "Too many attempts. Try again later."
        });
    }

    if (verificationCodes[email] != code) {
        return res.json({
            success: false,
            message: "Invalid code"
        });
    }

    delete verificationCodes[email];
    delete attempts[email];

    const sql = `
        INSERT INTO users (email)
        VALUES (?)
        ON DUPLICATE KEY UPDATE email=email
    `;

    db.query(sql, [email], (err) => {
        if (err) {
            return res.json({
                success: false,
                message: "Database error"
            });
        }

        db.query("SELECT id FROM users WHERE email = ?", [email], (err, rows) => {
            if (err || rows.length === 0) {
                return res.json({
                    success: false,
                    message: "User fetch error"
                });
            }

            res.json({
                success: true,
                user_id: rows[0].id,
                email: email
            });
        });
    });
});

// =======================
// CREATE LISTING
// =======================
app.post("/createListing", (req, res) => {
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
        return res.json({ success: false, message: "User not logged in" });
    }

    const sql = `
        INSERT INTO listings 
        (course_code, title, edition, price, book_condition, rating, description, seller_email)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(sql, [
        course_code,
        title,
        edition || null,
        price,
        book_condition,
        rating || null,
        description || null,
        seller_email
    ], (err) => {
        if (err) {
            console.error(err);
            return res.json({ success: false });
        }

        io.emit("newListing"); // 🔥 real-time update
        res.json({ success: true });
    });
});

// =======================
// GET LISTINGS (OPTIONAL FILTER)
// =======================
app.get("/getListings", (req, res) => {
    const course = req.query.course;

    let sql = "SELECT * FROM listings";
    let params = [];

    if (course) {
        sql += " WHERE course_code = ?";
        params.push(course);
    }

    sql += " ORDER BY created_at DESC";

    db.query(sql, params, (err, results) => {
        if (err) {
            console.error(err);
            return res.json([]);
        }

        res.json(results);
    });
});

// =======================
// DELETE LISTING (OWNER ONLY)
// =======================
app.post("/deleteListing", (req, res) => {
    const { id, seller_email } = req.body;

    const sql = "DELETE FROM listings WHERE id = ? AND seller_email = ?";

    db.query(sql, [id, seller_email], (err, result) => {
        if (err) {
            console.error(err);
            return res.json({ success: false });
        }

        io.emit("newListing"); // refresh listings
        res.json({ success: true });
    });
});

// =======================
// SOCKETS (MESSAGING + REALTIME)
// =======================
io.on("connection", (socket) => {

    socket.on("joinRoom", (room) => socket.join(room));

    socket.on("sendMessage", (data) => {
        db.query(
            "INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)",
            [data.sender_id, data.receiver_id, data.message]
        );

        io.to(data.room).emit("receiveMessage", data);
    });

});

// =======================
// START SERVER
// =======================
server.listen(3000, () => {
    console.log("Server running on http://localhost:3000");
});