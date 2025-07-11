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
    // Fetch only KPIs assigned to the manager's staff
    const managedStaff = await User.find({ manager: userId, role: 'Staff' }).select('_id');
    const managedStaffIds = managedStaff.map((s) => s._id);

    const kpis = await Kpi.find({ assignedTo: { $in: managedStaffIds } })
    .populate("assignedTo", "name department")
    .lean();


    // Fetch staff managed by this user
    const staff = await User.find({ manager: userId, role: 'Staff' }, "name department").lean();

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
    if (!req.session.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const managerId = req.session.user._id;
    const { staffName, department, status } = req.query;

    const query = {};

    // STEP 1: Fetch all staff under this manager
    const managedStaff = await User.find({
      manager: managerId,
      role: "Staff"
    }).select("_id name department");

    const managedStaffIds = managedStaff.map(s => s._id.toString());

    // STEP 2: Apply staffName filter, only if it belongs to managedStaff
    if (staffName) {
      if (mongoose.Types.ObjectId.isValid(staffName)) {
        if (!managedStaffIds.includes(staffName)) {
          return res.json([]); // staff not managed by this manager
        }
        query.assignedTo = staffName;
      } else {
        const matched = managedStaff.find(s => s.name.toLowerCase() === staffName.toLowerCase());
        if (!matched) {
          return res.json([]); // staff name not managed by this manager
        }
        query.assignedTo = matched._id;
      }
    }

    // STEP 3: Apply department filter (multiple departments allowed)
    if (department) {
      const filteredStaff = managedStaff.filter(s => {
        return Array.isArray(s.department)
          ? s.department.map(d => d.toLowerCase()).includes(department.toLowerCase())
          : s.department?.toLowerCase() === department.toLowerCase();
      });

      const filteredStaffIds = filteredStaff.map(s => s._id.toString());

      if (filteredStaffIds.length === 0) return res.json([]);

      if (query.assignedTo) {
        // Cross-check that staffName is also in department
        if (!filteredStaffIds.includes(query.assignedTo.toString())) {
          return res.json([]);
        }
      } else {
        query.assignedTo = { $in: filteredStaffIds };
      }
    }

    // STEP 4: Apply approval status filter
    if (status) {
      query.approvalstat = new RegExp(status, "i");
    }

    // STEP 5: If no specific staff assigned, default to all managed staff
    if (!query.assignedTo) {
      query.assignedTo = { $in: managedStaffIds };
    }

    // STEP 6: Fetch and return only scoped KPIs
    const kpis = await Kpi.find(query).populate("assignedTo", "name email department");
    res.json(kpis);

  } catch (err) {
    console.error("Error in getKpis:", err);
    res.status(500).json({ message: "Server Error fetching KPIs." });
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
    const kpi = await Kpi.findById(req.params.id)
      .populate('assignedTo', 'name email department')
      .lean(); // Optional: if you're not modifying the object

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
  const {
    title,
    description,
    staffName,
    targetValue,
    dueDate,
    performanceIndicator
  } = req.body;

  // Ensure logged-in user
  if (!req.session.user) {
    return res.status(401).json({ msg: "Unauthorized" });
  }

  const managerId = req.session.user._id;

  // Validate required fields
  if (!targetValue || !staffName || !dueDate || !title || !description || !performanceIndicator) {
    return res.status(400).json({ msg: "All fields are required." });
  }

  try {
    // 1. Find the staff by name (case-insensitive)
    const staff = await User.findOne({
      name: new RegExp(`^${staffName}$`, 'i'),
      role: 'Staff'
    });

    if (!staff) {
      return res.status(404).json({
        msg: "Staff member not found. Please ensure the staff name is correct."
      });
    }

    // 2. Check if the staff is managed by the current manager
    if (!staff.manager || staff.manager.toString() !== managerId.toString()) {
      return res.status(403).json({
        msg: "You can only assign KPIs to staff members assigned to you."
      });
    }

    // 3. Create the KPI
    const newKpi = new Kpi({
      title,
      description,
      target: performanceIndicator,
      targetValue,
      dueDate: new Date(dueDate),
      assignedTo: staff._id,
      status: 'Not Started',
      progressNumber: 0,
      approvalstat: 'No New Progress',
      startDate: new Date()
    });

    const savedKpi = await newKpi.save();
    res.status(201).json(savedKpi);
  } catch (err) {
    console.error("Error in createKpi:", err.message);
    res.status(500).json({ msg: "Server error while assigning KPI." });
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
    evidence, // Array of evidence URLs/descriptions
    feedback
  } = req.body;

  try {
    let kpi = await Kpi.findById(req.params.id);

    if (!kpi) {
      return res.status(404).json({ msg: 'KPI not found' });
    }

    // Handle legacy string feedback by converting it to an array if needed
    if (typeof kpi.feedback === 'string') {
      kpi.feedback = [{
        text: kpi.feedback,
        date: new Date()
      }];
      await kpi.save();
    }

    // Update KPI fields if they are provided in the request body
    if (title !== undefined) kpi.title = title;
    if (description !== undefined) kpi.description = description;
    if (targetValue !== undefined) kpi.targetValue = targetValue;
    if (dueDate !== undefined) kpi.dueDate = new Date(dueDate);
    if (performanceIndicator !== undefined) kpi.target = performanceIndicator; // Map 'performanceIndicator' to 'target'

    // Frontend manager-kpi-detail's "Status" dropdown updates 'approvalstat'
    if (status !== undefined) {
      kpi.status = status;  // update the progress status, NOT approvalstat
    }
    if (approvalstat !== undefined) {
      kpi.approvalstat = approvalstat; // update approvalstat separately if sent
    }

    if (typeof progressNumber !== 'undefined') kpi.progressNumber = progressNumber; // Allow 0
    if (evidence !== undefined) kpi.evidence = evidence; // Assuming evidence is an array of strings

    // If new feedback text is provided, push it into the feedback array
    if (feedback) {
      kpi.feedback.push({
        text: feedback,
        date: new Date()
      });
    }

    // If staffName is provided, find the new assignedTo user and update
    if (staffName !== undefined) {
      const newAssignedStaff = await User.findOne({ name: new RegExp(staffName, 'i'), role: 'Staff' });
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