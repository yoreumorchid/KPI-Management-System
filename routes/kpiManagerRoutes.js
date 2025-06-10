const kpiController = require('../controllers/kpiManagerController');
const express = require('express');
const router = express.Router();
const Kpi = require('../models/kpi');

// 1. Specific HTML views first
router.get('/view', kpiController.viewManagerKpisHtml);
router.get('/assign', kpiController.viewManagerAssignKpiHtml);

// 2. OR serve file manually like this (if you're not using EJS or a template engine)
const path = require('path');

router.get('/manager-assign-kpi.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pages/manager-assign-kpi.html'));
});


// 3. Specific API endpoint
router.get('/kpis-data', kpiController.getManagerKpisData);

// 4. General CRUD endpoints
router.get('/', kpiController.getKpis);
router.post('/', kpiController.createKpi);



// 5. Dynamic :id routes should always come last
router.get('/:id', kpiController.getKpiById);
router.put('/:id', kpiController.updateKpi);
router.delete('/:id', kpiController.deleteKpi);

module.exports = router;
