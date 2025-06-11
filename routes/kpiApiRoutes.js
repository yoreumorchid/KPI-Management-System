// routes/kpiApiRoutes.js (formerly kpiManagerRoutes.js)
const express = require('express');
const router = express.Router();
const kpiController = require('../controllers/kpiManagerController'); // Ensure path is correct

// API endpoints (returning JSON data) under the /api/kpis prefix
router.get('/kpis-data', kpiController.getManagerKpisData); // Used by manager-view-assigned-kpi to get initial data
router.get('/', kpiController.getKpis); // Main API route for filtering/listing KPIs
router.post('/', kpiController.createKpi); // For creating new KPIs

// Dynamic :id routes (specific to single KPI operations on a specific KPI ID)
router.get('/:id', kpiController.getKpiById);      // Access: /api/kpis/SOME_KPI_ID
router.put('/:id', kpiController.updateKpi);      // Access: /api/kpis/SOME_KPI_ID
router.delete('/:id', kpiController.deleteKpi); // Access: /api/kpis/SOME_KPI_ID

module.exports = router;