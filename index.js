const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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

// ==========================================
// NEW POST: Enrollment Submission Route
// ==========================================
app.post("/api/enrollments", async (req, res) => {
  try {
    const database = await connectDB();
    const enrollments = database.collection("enrollments");

    const {
      fullName,
      email,
      phone,
      whatsapp,
      paymentMethod,
      lastThreeDigits,
      transactionId,
      planId, // আপনার ফ্রন্টএন্ড থেকে planData.id রিসিভ করার জন্য
    } = req.body;

    // প্রাথমিক ভ্যালিডেশন
    if (!fullName || !email || !phone || !whatsapp || !paymentMethod) {
      return res.status(400).json({ error: "প্রয়োজনীয় সব তথ্য প্রদান করুন।" });
    }

    // বিকাশ বা নগদের ক্ষেত্রে লাস্ট ৩ ডিজিট এবং ট্রানজেকশন আইডি বাধ্যতামূলক
    if (
      (paymentMethod === "bkash" || paymentMethod === "nagad") &&
      (!lastThreeDigits || !transactionId)
    ) {
      return res.status(400).json({
        error:
          "বিকাশ/নগদ পেমেন্টের ক্ষেত্রে লাস্ট ৩ ডিজিট এবং ট্রানজেকশন আইডি দিতে হবে।",
      });
    }

    const newEnrollment = {
      studentInfo: {
        name: fullName,
        email: email.toLowerCase().trim(),
        contact: phone,
        whatsapp: whatsapp,
      },
      paymentInfo: {
        method: paymentMethod, // 'bkash' | 'nagad' | 'card'
        lastThreeDigits: paymentMethod !== "card" ? lastThreeDigits : null,
        transactionId:
          paymentMethod !== "card"
            ? transactionId.toUpperCase().trim()
            : "CARD_GATEWAY",
      },
      coursePlanId: planId || null,
      status: "pending",
      createdAt: new Date(),
    };

    const result = await enrollments.insertOne(newEnrollment);
    res.status(201).json({ success: true, enrollmentId: result.insertedId });
  } catch (err) {
    console.error("Enrollment Saving Error:", err);
    res.status(500).json({ error: "সার্ভারে সমস্যা হয়েছে, আবার চেষ্টা করুন।" });
  }
});

// GET: Fetch all enrollments (Admin Panel এর জন্য দরকারী হতে পারে)
app.get("/api/enrollments", async (req, res) => {
  try {
    const database = await connectDB();
    const allEnrollments = await database
      .collection("enrollments")
      .find()
      .sort({ createdAt: -1 })
      .toArray();
    res.status(200).json(allEnrollments);
  } catch (err) {
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

// GET: Fetch leads
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

app.get("/courses", async (req, res) => {
  try {
    const database = await connectDB();
    const { category } = req.query;

    let query = {};

    if (category && category !== "all") {
      query.category = category;
    }

    const courses = await database
      .collection("courses")
      .find(query)
      .sort({ id: 1 })
      .toArray();

    res.status(200).json(courses);
  } catch (err) {
    console.error("Error fetching courses:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.get("/course", async (req, res) => {
  try {
    const database = await connectDB();
    const { category } = req.query;

    let query = {};

    if (category && category !== "all") {
      query.category = category;
    }

    const courses = await database
      .collection("courses")
      .find(query)
      .limit(6)
      .sort({ id: 1 })
      .toArray();

    res.status(200).json(courses);
  } catch (err) {
    console.error("Error fetching courses:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/courses/:id", async (req, res) => {
  try {
    const database = await connectDB();
    const { id } = req.params;

    let query = {};

    if (ObjectId.isValid(id)) {
      query = { _id: new ObjectId(id) };
    } else {
      query = { id: parseInt(id) || id };
    }

    const course = await database.collection("courses").findOne(query);

    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    res.status(200).json(course);
  } catch (err) {
    console.error("Error fetching course:", err);
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
