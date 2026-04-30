const express = require("express");
const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");
const cors = require("cors");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors());

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

let db;

// Connect once and reuse the connection
async function initDb() {
  try {
    await client.connect();
    db = client.db("codezy_database");
    // console.log("✔ Native MongoDB Connected");
  } catch (e) {
    console.error("Connection error", e);
  }
}

// Registration Route
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, role, expertise } = req.body;
    const users = db.collection("users");

    // Check existing
    const existing = await users.findOne({ email });
    if (existing) return res.status(400).json({ error: "User already exists" });

    // Hash & Insert
    const hashedPassword = await bcrypt.hash(password, 12);
    const result = await users.insertOne({
      name,
      email,
      password: hashedPassword,
      role,
      expertise: role === "teacher" ? expertise : null,
      createdAt: new Date(),
    });

    res.status(201).json({ message: "Success", userId: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Login Route (Required for NextAuth Credentials)

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!db) return res.status(500).json({ error: "Database not ready" });

    const users = db.collection("users");

    const user = await users.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const { password: _, ...userProfile } = user;

    console.log(`✔ User logged in: ${userProfile.email}`);
    res.status(200).json(userProfile);
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// initDb().then(() => {
//   app.listen(5000, () => console.log("Backend running on port 5000"));
// });
// 3. CRITICAL: Export the app for Vercel
module.exports = app;
