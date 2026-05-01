const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const bcrypt = require("bcryptjs");
const cors = require("cors");
require("dotenv").config();
const port = process.env.PORT || 5000;
const app = express();
app.use(express.json());
app.use(cors());

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function run() {
  try {
    const db = client.db("codezy_database");
    const usersCollection = db.collection("users");
    // Registration Route
    app.post("/api/auth/register", async (req, res) => {
      try {
        const { name, email, password, role, expertise } = req.body;
        const users = db.collection("users");

        // Check existing
        const existing = await users.findOne({ email });
        if (existing)
          return res.status(400).json({ error: "User already exists" });

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
        console.error("Registration error:", err);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });

    // Login Route
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
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!",
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
// For Vercel serverless functions
module.exports = app;
