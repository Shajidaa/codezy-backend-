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
//get teachers
app.get("/users/tutors", async (req, res) => {
  try {
    const database = await connectDB();
    const users = await database
      .collection("users")
      .find({ role: "teacher" })

      .sort({ createdAt: -1 })
      .toArray();
    res.status(200).json(users);
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
app.get("/users/email/:email", async (req, res) => {
  try {
    const database = await connectDB();
    const user = await database
      .collection("users")
      .findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.status(200).json(user);
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// app.get("/users/profile/:email", async (req, res) => {
//   try {
//     const { profile } = req.body;
//     const { email } = req.params; // Get email from URL params as per your route path

//     if (!email) return res.status(400).json({ error: "Email is required" });

//     const database = await connectDB();
//     const usersCollection = database.collection("users");

//     // 1. Find the existing user
//     const user = await usersCollection.findOne({ email });
//     if (!user) return res.status(404).json({ error: "User not found" });

//     // 2. Safely merge old profile parameters with new incoming properties
//     const oldProfile = user.profile || {};
//     const updatedProfile = {
//       ...profile,
//       education: Array.isArray(profile?.education) ? profile.education : [],
//       subjects: Array.isArray(profile?.subjects) ? profile.subjects : [],
//       experience: Array.isArray(profile?.experience) ? profile.experience : [],
//       verified: oldProfile.verified || false,
//       rating: oldProfile.rating || 0,
//       totalReviews: oldProfile.totalReviews || 0,
//     };

//     // 3. Update the document in MongoDB and return the updated fields
//     const result = await usersCollection.findOneAndUpdate(
//       { email },
//       {
//         $set: {
//           profile: updatedProfile,
//           updated_at: new Date(), // Equates to NOW() in PostgreSQL
//         },
//       },
//       { returnDocument: "after" }, // Ensures MongoDB returns the updated version of the object
//     );

//     res.status(200).json({
//       message: "Profile updated successfully",
//       profile: result.profile || result.value?.profile || updatedProfile, // Handles different MongoDB driver variations safely
//     });
//   } catch (err) {
//     console.error("Error updating profile:", err);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// });
// app.put("/users/profile",async(req,res)=>{

// })
// ==========================================
// NEW POST: Enrollment Submission Route
// ==========================================

// 1. GET Profile Endpoint
app.get("/users/profile/:email", async (req, res) => {
  try {
    const { email } = req.params;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const database = await connectDB();
    const user = await database.collection("users").findOne({ email });

    if (!user) return res.status(404).json({ error: "User not found" });

    // Return the profile object (or empty defaults if none exists yet)
    res.status(200).json({
      profile: user.profile || {
        title: "",
        bio: "",
        location: "",
        phone: "",
        calendlyLink: "",
        education: [],
        subjects: [],
        experience: [],
      },
    });
  } catch (err) {
    console.error("Error fetching profile:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// 2. PUT Update Profile Endpoint
app.put("/users/profile/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const { profile } = req.body;

    if (!email) return res.status(400).json({ error: "Email is required" });

    const database = await connectDB();
    const usersCollection = database.collection("users");

    // Check if user exists
    const user = await usersCollection.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const oldProfile = user.profile || {};

    // Structure the incoming changes with explicit fallback protection
    const updatedProfile = {
      title: profile?.title || "",
      bio: profile?.bio || "",
      location: profile?.location || "",
      phone: profile?.phone || "",
      calendlyLink: profile?.calendlyLink || "",
      education: Array.isArray(profile?.education) ? profile.education : [],
      subjects: Array.isArray(profile?.subjects) ? profile.subjects : [],
      experience: Array.isArray(profile?.experience) ? profile.experience : [],
      verified: oldProfile.verified || false,
      rating: oldProfile.rating || 0,
      totalReviews: oldProfile.totalReviews || 0,
    };

    // Database update
    await usersCollection.updateOne(
      { email },
      {
        $set: {
          profile: updatedProfile,
          updated_at: new Date(),
        },
      },
    );

    res.status(200).json({
      message: "Profile updated successfully",
      profile: updatedProfile,
    });
  } catch (err) {
    console.error("Error updating profile:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

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
// ==========================================
// NEW POST: Calendly Booking Storage Route
// ==========================================
app.post("/api/bookings/manual", async (req, res) => {
  try {
    const database = await connectDB();
    const bookingsCollection = database.collection("bookings");

    const { tutorEmail, studentEmail, studentName, inviteeUri, startTime } =
      req.body;

    // Basic Validation
    if (!tutorEmail || !studentEmail) {
      return res
        .status(400)
        .json({ error: "Tutor email and student email are required." });
    }

    const newBooking = {
      tutorEmail: tutorEmail.toLowerCase().trim(),
      studentInfo: {
        name: studentName || "Anonymous Student",
        email: studentEmail.toLowerCase().trim(),
      },
      calendly: {
        inviteeUri: inviteeUri || null,
        scheduledAt: startTime ? new Date(startTime) : new Date(),
      },
      status: "scheduled",
      createdAt: new Date(),
    };

    const result = await bookingsCollection.insertOne(newBooking);

    res.status(201).json({
      success: true,
      message: "Booking saved successfully!",
      bookingId: result.insertedId,
    });
  } catch (err) {
    console.error("Error saving manual booking:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/progress", async (req, res) => {
  try {
    const database = await connectDB();
    const progressCollection = database.collection("progress");
    const {
      studentEmail,
      courseId,
      completedClasses,
      totalClasses,
      performanceScore,
      notes,
    } = req.body;

    if (!studentEmail || !courseId) {
      return res
        .status(400)
        .json({ error: "Student email and courseId are required." });
    }

    const progressData = {
      studentEmail: studentEmail.toLowerCase().trim(),
      courseId,
      completedClasses: parseInt(completedClasses) || 0,
      totalClasses: parseInt(totalClasses) || 10, // Default 10 classes
      performanceScore: performanceScore || "Good",
      notes: notes || "",
      updatedAt: new Date(),
    };

    await progressCollection.updateOne(
      { studentEmail: progressData.studentEmail, courseId },
      { $set: progressData },
      { upsert: true },
    );

    res
      .status(200)
      .json({ success: true, message: "Progress updated successfully!" });
  } catch (err) {
    console.error("Progress saving error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/progress/:email", async (req, res) => {
  try {
    const database = await connectDB();
    const { email } = req.params;
    const studentProgress = await database
      .collection("progress")
      .find({ studentEmail: email.toLowerCase().trim() })
      .toArray();

    res.status(200).json(studentProgress);
  } catch (err) {
    console.error("Error fetching progress:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// ==========================================
// GET: Fetch Bookings for a Specific Student
// ==========================================
app.get("/api/bookings/student/:email", async (req, res) => {
  try {
    const database = await connectDB();
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({ error: "Student email is required." });
    }

    const studentBookings = await database
      .collection("bookings")
      .find({ "studentInfo.email": email.toLowerCase().trim() })
      .sort({ "calendly.scheduledAt": 1 })
      .toArray();

    res.status(200).json(studentBookings);
  } catch (err) {
    console.error("Error fetching student bookings:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// ১. টিচারের নতুন ক্লাস/মিটিং শিডিউল যোগ করা (POST)
app.post("/api/teacher/schedule", async (req, res) => {
  try {
    const database = await connectDB();
    const scheduleCollection = database.collection("teacher_schedules");
    const {
      teacherEmail,
      topic,
      classDate,
      classTime,
      meetLink,
      targetStudentEmail,
    } = req.body;

    if (!teacherEmail || !topic || !classDate || !classTime) {
      return res.status(400).json({ error: "Required fields missing." });
    }

    const newSchedule = {
      teacherEmail: teacherEmail.toLowerCase().trim(),
      targetStudentEmail: targetStudentEmail
        ? targetStudentEmail.toLowerCase().trim()
        : "All Students",
      topic,
      classDate, // Format: YYYY-MM-DD
      classTime, // Format: HH:MM
      meetLink: meetLink || "",
      createdAt: new Date(),
    };

    const result = await scheduleCollection.insertOne(newSchedule);
    res.status(201).json({ success: true, scheduleId: result.insertedId });
  } catch (err) {
    console.error("Error creating schedule:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ২. কোনো নির্দিষ্ট টিচারের সব শিডিউল দেখা (GET)
app.get("/api/teacher/schedule/:email", async (req, res) => {
  try {
    const database = await connectDB();
    const { email } = req.params;
    const schedules = await database
      .collection("teacher_schedules")
      .find({ teacherEmail: email.toLowerCase().trim() })
      .sort({ classDate: 1, classTime: 1 })
      .toArray();

    res.status(200).json(schedules);
  } catch (err) {
    console.error("Error fetching schedules:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// GET: Fetch all enrollments
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

// GET: Fetch all bootcamp levels
app.get("/api/bootcamp-levels", async (req, res) => {
  try {
    const database = await connectDB();
    const levels = await database
      .collection("bootcamp_levels")
      .find()
      .sort({ id: 1 })
      .toArray();

    res.status(200).json(levels);
  } catch (err) {
    console.error("Error fetching bootcamp levels:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// GET: Fetch a single bootcamp level by ID
app.get("/api/bootcamp-levels/:id", async (req, res) => {
  try {
    const database = await connectDB();
    const { id } = req.params;

    const level = await database
      .collection("bootcamp_levels")
      .findOne({ id: id });

    if (!level) {
      return res.status(404).json({ error: "Bootcamp level not found" });
    }

    res.status(200).json(level);
  } catch (err) {
    console.error("Error fetching single level:", err);
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
