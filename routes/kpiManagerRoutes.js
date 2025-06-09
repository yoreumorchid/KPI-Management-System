const kpiController = require('../controllers/kpiManagerController');
const express = require('express');
const router = express.Router();
const Kpi = require('../models/kpi');

// HTML View Route (Most Specific)
router.get("/view", kpiController.viewManagerKpisHtml);

// API Endpoint for Manager's KPI Data (More Specific than ':id')
router.get("/kpis-data", kpiController.getManagerKpisData); // This is what the frontend should call

// CRUD Routes for KPIs (Order: GET all, then GET by ID, POST, PUT, DELETE)
router.get('/', kpiController.getKpis); // Get all KPIs with filters
router.post('/', kpiController.createKpi); // POST new KPI

// Specific KPI by ID routes (These must come after '/view' and '/kpis-data')
router.get('/:id', kpiController.getKpiById); // GET KPI by ID
router.put('/:id', kpiController.updateKpi); // UPDATE KPI by ID
router.delete('/:id', kpiController.deleteKpi); // DELETE KPI by ID

module.exports = router;