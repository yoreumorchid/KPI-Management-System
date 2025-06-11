const Kpi = require('../models/kpi');
const User = require('../models/user');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs').promises; // Use promises version for async/await

// --- HTML View Rendering Functions ---

/**
 * @route   GET /manage/view
 * @desc    Renders the manager-view-assigned-kpi.html page.
 * @access  Private (Manager)
 */
exports.viewManagerKpisHtml = async (req, res) => {
  try {
    // Check if user is logged in (Assuming req.session.user is set upon login)
    if (!req.session.user) {
      return res.redirect("/login"); // Redirect to login if not authenticated
    }

    const filePath = path.join(
      __dirname,
      "..",
      "frontend",
      "pages",
      "manager-view-assigned-kpi.html"
    );

    await fs.access(filePath); // Check if file exists
    res.sendFile(filePath); // Send the HTML file
  } catch (err) {
    console.error("Error in viewManagerKpisHtml:", err);
    if (err.code === "ENOENT") {
      return res.status(404).send("Manager View KPI page not found.");
    }
    res.status(500).send("Server Error loading KPI view.");
  }
};

/**
 * @route   GET /manage/assign
 * @desc    Renders the manager-assign-kpi.html page.
 * @access  Private (Manager)
 */
exports.viewManagerAssignKpiHtml = async (req, res) => {
  try {
    // Check if user is logged in
    if (!req.session.user) {
      return res.redirect("/login");
    }

    const filePath = path.join(
      __dirname,
      "..",
      "frontend",
      "pages",
      "manager-assign-kpi.html"
    );

    await fs.access(filePath);
    res.sendFile(filePath);
  } catch (err) {
    console.error("Error in viewManagerAssignKpiHtml:", err);
    if (err.code === "ENOENT") {
      return res.status(404).send("Manager Assign KPI page not found.");
    }
    res.status(500).send("Server Error loading Manager Assign KPI view.");
  }
};

exports.viewManagerKpiDetailHtml = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect("/login");
    }

    const filePath = path.join(
      __dirname,
      "..",
      "frontend",
      "pages",
      "manager-kpi-detail.html"
    );

    await fs.access(filePath);
    res.sendFile(filePath);
  } catch (err) {
    console.error("Error in viewManagerKpiDetailHtml:", err);
    if (err.code === "ENOENT") {
      return res.status(404).send("Manager KPI Detail page not found.");
    }
    res.status(500).send("Server Error loading Manager KPI Detail view.");
  }
};

// --- API Endpoints for Data ---

/**
 * @route   GET /api/kpis/kpis-data (or /manage/kpis-data)
 * @desc    Get all KPIs assigned to the logged-in manager's staff, and lists of staff/departments.
 * Used by manager-view-assigned-kpi.html to populate initial data and filters.
 * @access  Private (Manager)
 */
exports.getManagerKpisData = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: "Unauthorized" }); // Send JSON response for API
    }

    const userId = req.session.user._id;

    // Fetch KPIs assigned to staff managed by this user
    // In a real app, you might filter KPIs by assignedTo: { $in: staffUserIds }
    // For simplicity, assuming manager can see all KPIs and filters apply.
    // If a manager only sees KPIs *assigned to staff they manage*, the query should be adjusted.
    const kpis = await Kpi.find({}) // Fetch all KPIs for now, filters apply later
      .populate("assignedTo", "name department")
      .lean();

    // Fetch staff managed by this user
    const staff = await User.find({ manager: userId, role: 'staff' }, "name department").lean();

    // Extract unique departments from the fetched staff
    const departments = [
      ...new Set(staff.map((s) => s.department).filter(Boolean)),
    ];

    // Send all necessary data as JSON
    res.json({ kpis, staff, departments });
  } catch (err) {
    console.error("Error in getManagerKpisData:", err);
    res.status(500).json({ message: "Server Error fetching KPI data." });
  }
};


/**
 * @route   GET /api/kpis (or /manage/)
 * @desc    Get all KPIs with optional filters (staffName, department, status/approvalstat).
 * This is the primary API for the manager-view-assigned-kpi.html's filtering.
 * @access  Public (or Manager specific if needed for finer control)
 */
exports.getKpis = async (req, res) => {
  try {
    const { staffName, department, status } = req.query; // 'status' from frontend refers to approvalstat
    const query = {};

    // Filter by assignedTo (handles both User _id and name)
    if (staffName) {
      // Check if the provided staffName is a valid ObjectId format
      if (!mongoose.Types.ObjectId.isValid(staffName)) {
        // If NOT an ObjectId, assume it's a staff name string
        const staffUser = await User.findOne({ name: new RegExp(staffName, 'i'), role: 'staff' }).select('_id');
        if (staffUser) {
          query.assignedTo = staffUser._id;
        } else {
          return res.json([]); // No user found with that name, so no KPIs will match
        }
      } else {
        // If IS a valid ObjectId, use it directly
        query.assignedTo = staffName;
      }
    }

    // Filter by Approval Status (frontend passes this as 'status')
    if (status) {
      query.approvalstat = new RegExp(status, 'i'); // Case-insensitive match for approvalstat
    }

    // Handle Department Filter
    if (department) {
      const departmentUsers = await User.find({ department: new RegExp(department, 'i') }).select('_id');

      if (departmentUsers.length === 0) {
        return res.json([]); // No users in this department, so no KPIs will match
      }

      const departmentUserIds = departmentUsers.map(user => user._id);

      // If assignedTo is already in the query (from staffName filter),
      // we need to check if that specific staff member is in the department.
      if (query.assignedTo) {
        if (!departmentUserIds.some(id => id.equals(query.assignedTo))) {
          return res.json([]); // Specific staff member is not in the filtered department
        }
      } else {
        // If no staffName filter, then filter by all KPIs assigned to users in the specified department
        query.assignedTo = { $in: departmentUserIds };
      }
    }

    const kpis = await Kpi.find(query).populate('assignedTo', 'name email department');
    res.json(kpis);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
};


/**
 * @route   GET /api/kpis/:id (or /manage/:id)
 * @desc    Get a single KPI by ID. Used by manager-kpi-detail.html.
 * @access  Public (or Manager specific if needed)
 */
exports.getKpiById = async (req, res) => {
  try {
    // Populate assignedTo to get full staff details
    const kpi = await Kpi.findById(req.params.id).populate('assignedTo', 'name email department');
    if (!kpi) {
      return res.status(404).json({ msg: 'KPI not found' });
    }
    res.json(kpi);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ msg: 'Invalid KPI ID' });
    }
    res.status(500).send('Server Error');
  }
};

/**
 * @route   POST /api/kpis (or /manage/)
 * @desc    Create a new KPI. Used by manager-assign-kpi.html.
 * @access  Private (Manager)
 */
exports.createKpi = async (req, res) => {
  // Destructure fields from the request body as sent by manager-assign-kpi.html
  const { title, description, staffName, targetValue, dueDate, performanceIndicator } = req.body;

  try {
    // 1. Find the assigned staff member by name (case-insensitive)
    // Ensure the staff member has the 'staff' role
    const assignedStaff = await User.findOne({ name: new RegExp(staffName, 'i'), role: 'staff' });

    if (!assignedStaff) {
      return res.status(404).json({ msg: 'Assigned staff member not found. Please ensure the staff name is correct and exists as a staff user.' });
    }

    // 2. Create the new KPI object
    const newKpi = new Kpi({
      title,
      description,
      target: performanceIndicator, // Map frontend 'performanceIndicator' to backend 'target'
      targetValue,
      dueDate: new Date(dueDate), // Ensure date is correctly parsed
      assignedTo: assignedStaff._id, // Use the staff's ObjectId
      status: 'Not Started', // Default progress status for newly assigned KPI
      progressNumber: 0, // Default progress for new KPI
      approvalstat: 'Pending', // Default approval status for new KPI
      // assignedBy: req.session.user._id, // Optional: if you want to track who assigned it
    });

    // 3. Save the KPI to the database
    const kpi = await newKpi.save();
    res.status(201).json(kpi); // 201 Created
  } catch (err) {
    console.error(err.message);
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(val => val.message);
        return res.status(400).json({ msg: `Validation Error: ${messages.join(', ')}` });
    }
    res.status(500).send('Server Error during KPI creation');
  }
};

/**
 * @route   PUT /api/kpis/:id (or /manage/:id)
 * @desc    Update a KPI by ID. Used by manager-kpi-detail.html for editing.
 * @access  Private (Manager)
 */
exports.updateKpi = async (req, res) => {
  // Destructure all possible fields that could be updated from the frontend
  const {
    title,
    description,
    staffName, // Used to reassign KPI to a different staff
    targetValue,
    dueDate,
    performanceIndicator, // Maps to 'target' in KPI schema
    status, // From frontend dropdown, corresponds to 'approvalstat' in schema
    progressNumber,
    approvalstat, // Direct update, if explicitly sent
    evidence // Array of evidence URLs/descriptions
  } = req.body;

  try {
    let kpi = await Kpi.findById(req.params.id);

    if (!kpi) {
      return res.status(404).json({ msg: 'KPI not found' });
    }

    // Update KPI fields if they are provided in the request body
    if (title !== undefined) kpi.title = title;
    if (description !== undefined) kpi.description = description;
    if (targetValue !== undefined) kpi.targetValue = targetValue;
    if (dueDate !== undefined) kpi.dueDate = new Date(dueDate);
    if (performanceIndicator !== undefined) kpi.target = performanceIndicator; // Map 'performanceIndicator' to 'target'

    // Frontend manager-kpi-detail's "Status" dropdown updates 'approvalstat'
    // If the frontend sends 'status' with values like "Pending", "Approved", "Rejected"
    if (status !== undefined) {
      kpi.approvalstat = status; // Update approvalstat based on frontend 'status' field
    }
    // If frontend sends 'approvalstat' directly, it would override or be redundant.
    // Keeping this for explicit backend update if desired.
    if (approvalstat !== undefined) kpi.approvalstat = approvalstat;

    if (typeof progressNumber !== 'undefined') kpi.progressNumber = progressNumber; // Allow 0
    if (evidence !== undefined) kpi.evidence = evidence; // Assuming evidence is an array of strings

    // If staffName is provided, find the new assignedTo user and update
    if (staffName !== undefined) {
      const newAssignedStaff = await User.findOne({ name: new RegExp(staffName, 'i'), role: 'staff' });
      if (!newAssignedStaff) {
        return res.status(404).json({ msg: 'New assigned staff member not found. Please ensure the staff name is correct.' });
      }
      kpi.assignedTo = newAssignedStaff._id;
    }

    await kpi.save();
    res.json(kpi);
  } catch (err) {
    console.error(err.message);
    if (err.name === 'ValidationError') {
      let errors = {};
      Object.keys(err.errors).forEach((key) => {
        errors[key] = err.errors[key].message;
      });
      return res.status(400).json({ msg: 'Validation Error', errors });
    }
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ msg: 'Invalid KPI ID' });
    }
    res.status(500).send('Server Error');
  }
};


/**
 * @route   DELETE /api/kpis/:id (or /manage/:id)
 * @desc    Delete a KPI by ID. Used by manager-kpi-detail.html.
 * @access  Private (Manager)
 */
exports.deleteKpi = async (req, res) => {
  try {
    // Find and delete the KPI directly
    const deletedKpi = await Kpi.findByIdAndDelete(req.params.id);

    if (!deletedKpi) {
      return res.status(404).json({ msg: 'KPI not found' });
    }

    res.json({ msg: 'KPI removed successfully.' });
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(400).json({ msg: 'Invalid KPI ID' });
    }
    res.status(500).send('Server Error');
  }
};