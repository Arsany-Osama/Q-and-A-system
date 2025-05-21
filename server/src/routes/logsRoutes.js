const express = require('express');
const { authenticateToken, checkRole } = require('../middleware/authMiddleware');
const { getLogs } = require('../controllers/logsController');

const router = express.Router();

router.get('/',authenticateToken,checkRole("ADMIN"),getLogs);

module.exports = router;