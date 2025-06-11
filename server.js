require("dotenv").config();
const express = require("express");
const session = require("express-session");
const mongoose = require("mongoose");
const path = require("path");
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the 'styles' directory
app.use(express.static(path.join(__dirname, 'frontend')));

// Models
const User = require("./models/user");
const KPI = require("./models/kpi");

app.use(cors()); // <--- This line should be early in your server.js
app.use(express.json({ extended: false })); // This is for parsing JSON request bodies

// Connect DB
mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/kpi_system")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// View Engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/views"));

// Session
app.use(session({
  secret: "mySecret",
  resave: false,
  saveUninitialized: false
}));

// Routes
app.use('/api/dashboard', require('./routes/dashboardRoutes'));


// Define API Routes
//app.use('/api/kpis', require('./routes/kpiManagerRoutes'));
app.use('/api', require('./routes/userRoutes')); 

// Load manager KPI routes
/*const kpiManagerRoutes = require("./routes/kpiManagerRoutes");
app.use("/manage", kpiManagerRoutes);
*/
// Mount HTML View Routes under /manage prefix
// These routes will explicitly serve your .html files for specific URLs like /manage/view.
app.use("/manage", require("./routes/kpiViewRoutes"));

// Mount API Routes for KPIs under /api/kpis prefix
// These routes will handle your backend data requests (JSON).
app.use('/api/kpis', require('./routes/kpiApiRoutes'));
// Load staff KPI routes
const kpiStaffRoutes = require("./routes/kpiStaffRoutes");
app.use("/kpi", kpiStaffRoutes);


app.get("/", (req, res) => {
  res.redirect("/login");
});

// Web Page Routes (Login, Dashboard)
app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email, password });
  console.log("Found user:", user);

  if (user) {
    req.session.user = {
      _id: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
    };
    res.redirect("/dashboard");
  } else {
    res.send("Login failed");
  }
});

// 404 catch-all
app.get(/(.*)/, (req, res) => {
  res.status(404).send("Sorry, Page Not Found!");
});

// Start Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});