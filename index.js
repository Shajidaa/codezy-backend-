const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const bcrypt = require("bcryptjs");
const cors = require("cors");
require("dotenv").config();

const port = process.env.PORT || 5000;
const app = express();

// CORS Configuration
const corsOptions = {
  origin: ["http://localhost:3000", "https://codezy-frontend.vercel.app"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Database Connection Management
let db;
async function connectDB() {
  if (db) return db;
  await client.connect();
  db = client.db("codezy_database");
  return db;
}

// Routes
app.get("/", (req, res) => {
  res.send("Codezy Backend is Running!");
});

// Registration Route
app.post("/api/auth/register", async (req, res) => {
  try {
    const database = await connectDB();
    const users = database.collection("users");
    const { name, email, password, role, expertise } = req.body;

    const existing = await users.findOne({ email });
    if (existing) return res.status(400).json({ error: "User already exists" });

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
    const database = await connectDB();
    const users = database.collection("users");
    const { email, password } = req.body;

    const user = await users.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const isPasswordCorrect = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrect)
      return res.status(401).json({ error: "Invalid password" });

    const { password: _, ...userProfile } = user;
    res.status(200).json(userProfile);
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST: Lead Collection for Free Demo

app.post("/api/leads/demo", async (req, res) => {
  try {
    const database = await connectDB();
    const leads = database.collection("leads");

    const {
      parentName,
      email,
      phoneNumber,
      childAge,
      schoolName,
      sector,
      experienceLevel,
      bookingDate,
      bookingTime,
    } = req.body;

    if (!sector || !experienceLevel) {
      return res
        .status(400)
        .json({ error: "Please select course sector and experience level." });
    }

    const newLead = {
      parentInfo: {
        name: parentName,
        email: email.toLowerCase(),
        whatsapp: phoneNumber,
      },
      studentInfo: {
        age: parseInt(childAge),
        school: schoolName,
        experience: experienceLevel,
      },
      course: {
        interestedSector: sector,
      },
      appointment: {
        date: new Date(bookingDate),
        time: bookingTime,
      },
      meta: {
        status: "new_lead",
        createdAt: new Date(),
      },
    };

    const result = await leads.insertOne(newLead);
    res.status(201).json({ success: true, bookingId: result.insertedId });
  } catch (err) {
    console.error("Error saving lead:", err);
    res.status(500).json({ error: "Server Error" });
  }
});
// GET: Fetch leads (Secure this for Admin only later)
app.get("/api/leads", async (req, res) => {
  try {
    const database = await connectDB();
    const leads = await database
      .collection("leads")
      .find()
      .sort({ createdAt: -1 })
      .toArray();
    res.status(200).json(leads);
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Start Server for local development
if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

module.exports = app;
