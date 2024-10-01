const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cors = require("cors");
const multer = require("multer");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const User = require("./models/User.js");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// MongoDB connection URI from .env file
const mongoURI = process.env.MONGO_URI;

// Connect to MongoDB
mongoose
  .connect(mongoURI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Set up multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

// Configure multer with file size limit
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB limit
  },
});

// Route to handle GET requests
app.get("/", (req, res) => {
  res.send("Hello World!");
});

// Route to handle POST requests for user registration (Sign-In)
app.post("/signin", async (req, res) => {
  const { name, prno, mobileNo, dob, password, department, role, email } =
    req.body;

  try {
    const existingUser = await User.findOne({ prno });
    if (existingUser) {
      return res
        .status(400)
        .send({ status: "error", data: "User already exists!" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      prno,
      mobileNo,
      dob,
      password: hashedPassword,
      department,
      role,
      email,
    });

    await newUser.save();

    // Generate a JWT after successful user registration
    const token = jwt.sign({ prno: newUser.prno }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    res
      .status(201)
      .send({ status: "ok", data: "User created successfully!", token });
  } catch (error) {
    console.error("Error saving user:", error);
    res
      .status(500)
      .send({ status: "error", data: "An error occurred. Please try again." });
  }
});

// Route to handle POST requests for user login (Sign-Up)
app.post("/signup", async (req, res) => {
  const { prno, password } = req.body;
  try {
    const user = await User.findOne({ prno });
    if (!user) {
      return res
        .status(400)
        .send({ status: "error", data: "User does not exist!" });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res
        .status(400)
        .send({ status: "error", data: "Invalid password!" });
    }

    // Generate a token when signing in
    const token = jwt.sign({ prno: user.prno }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });
    res.status(200).send({ status: "ok", data: "Sign in successful!", token });
  } catch (error) {
    console.error("Error signing in user:", error.message);
    res
      .status(500)
      .send({ status: "error", data: "An error occurred. Please try again." });
  }
});

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Route to update ID card (with image upload)
app.put(
  "/update-id-card",
  authenticateToken,
  upload.single("photo"),
  async (req, res) => {
    console.log("Uploaded File:", req.file);
    const { name, email, phone, department, dob, address, role } = req.body;

    try {
      const user = await User.findOne({ prno: req.user.prno });
      if (!user) {
        return res
          .status(404)
          .send({ status: "error", data: "User not found!" });
      }

      // Validate and format the date of birth
      if (dob) {
        const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dobRegex.test(dob)) {
          return res.status(400).send({
            status: "error",
            data: "Invalid date format for dob! Please use YYYY-MM-DD.",
          });
        }

        const parsedDob = new Date(dob);
        if (isNaN(parsedDob.getTime())) {
          return res
            .status(400)
            .send({ status: "error", data: "Invalid date value for dob!" });
        }

        user.dob = parsedDob;
      }

      // Update other user fields
      user.name = name || user.name;
      user.email = email || user.email;
      user.phone = phone || user.phone;
      user.department = department || user.department;
      user.address = address || user.address;
      user.photo = req.file ? req.file.path : user.photo;
      user.role = role || user.role;

      await user.save();
      res
        .status(200)
        .send({ status: "ok", data: "User updated successfully!" });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).send({
        status: "error",
        data: "An error occurred. Please try again.",
      });
    }
  }
);

// Route to fetch user profile by employee number
app.get("/profile/:empNumber", async (req, res) => {
  const { empNumber } = req.params;
  try {
    const user = await User.findOne({ prno: empNumber });
    if (!user) {
      return res.status(404).send({ status: "error", data: "User not found!" });
    }
    const { name, prno, dob, createdate, department, role, email } = user;
    res.status(200).send({
      status: "ok",
      data: { name, prno, dob, createdate, department, role, email },
    });
  } catch (error) {
    console.error("Error fetching user profile:", error.message);
    res
      .status(500)
      .send({ status: "error", data: "An error occurred. Please try again." });
  }
});

// Endpoint to fetch all user details
app.get("/api/users", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user details" });
  }
});

// Route to fetch user by prno
app.get("/user/:prno", async (req, res) => {
  const { prno } = req.params;
  try {
    const user = await User.findOne({ prno });
    if (!user) {
      return res.status(404).send({ status: "error", data: "User not found!" });
    }
    const { name, email, phone, department, dob, address, photo, role } = user;
    res.status(200).send({
      status: "ok",
      data: { prno, name, email, phone, department, dob, address, photo, role },
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res
      .status(500)
      .send({ status: "error", data: "An error occurred. Please try again." });
  }
});

// Route to handle GET requests for employee search
app.get("/search", async (req, res) => {
  const { name, prno, department } = req.query;

  try {
    const query = {};
    if (name) query.name = { $regex: name, $options: "i" }; // Case-insensitive search
    if (prno) query.prno = prno;
    if (department) query.department = department;

    const employees = await User.find(query).select(
      "name department prno mobileNo"
    );
    res.status(200).json({ status: "ok", data: employees });
  } catch (error) {
    console.error("Error fetching employees:", error.message);
    res
      .status(500)
      .send({ status: "error", data: "An error occurred. Please try again." });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}/`);
});
