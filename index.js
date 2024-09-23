const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const cors = require("cors");
require("dotenv").config();
require("./models/User.js");
const jwt = require("jsonwebtoken");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection URI from .env file
const mongoURI = process.env.MONGO_URI;

// Connect to MongoDB
mongoose
  .connect(mongoURI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.error("MongoDB connection error:", err));

const User = mongoose.model("User");

// Route to handle GET requests
app.get("/", (req, res) => {
  res.send("Hello World!");
});

// Route to handle POST requests for user login (Sign-In)
app.post("/signin", async (req, res) => {
  const { name, prno, mobileNo, dob, password, department } = req.body;

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
    });

    await newUser.save();

    // Generate a JWT after successful user registration
    const token = jwt.sign({ prno: newUser.prno }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    console.log("User created successfully");
    res
      .status(201)
      .send({ status: "ok", data: "User created successfully!", token });
  } catch (error) {
    console.error("Error saving user:", error.message);
    res
      .status(500)
      .send({ status: "error", data: "An error occurred. Please try again." });
  }
});

// Route to handle POST requests for user registration (Sign-Up)
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

    console.log("User signed in successfully");
    res.status(200).send({ status: "ok", data: "Sign in successful!", token });
  } catch (error) {
    console.error("Error signing in user:", error.message);
    res
      .status(500)
      .send({ status: "error", data: "An error occurred. Please try again." });
  }
});

// Route to fetch user profile by employee number
app.get("/profile/:empNumber", async (req, res) => {
  const { empNumber } = req.params;
  try {
    const user = await User.findOne({ prno: empNumber });
    if (!user) {
      console.log("User not found");
      return res.status(404).send({ status: "error", data: "User not found!" });
    }
    const { name, prno, dob, createdate, department } = user;
    res.status(200).send({
      status: "ok",
      data: { name, prno, dob, createdate, department },
    });
  } catch (error) {
    console.error("Error fetching user profile:", error.message);
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
    if (name) query.name = { $regex: name, $options: "i" };
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
