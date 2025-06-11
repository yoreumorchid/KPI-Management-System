// routes/kpiViewRoutes.js
const express = require('express');
const router = express.Router();
const kpiController = require('../controllers/kpiManagerController'); // Ensure path is correct

// Routes for serving HTML pages under the /manage prefix
// These routes will *render* the HTML files.
router.get('/view', kpiController.viewManagerKpisHtml); // Access: /manage/view
router.get('/assign', kpiController.viewManagerAssignKpiHtml); // Access: /manage/assign
router.get('/kpidetail', kpiController.viewManagerKpiDetailHtml); // Access: /manage/kpidetail

module.exports = router;