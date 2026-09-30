const express = require('express');
const router = express.Router();
const { approveByToken, rejectByToken } = require('../controllers/roomActionController');

// Public routes — clicked directly from an email, so there's no login token
// to check. Security comes from the long random token itself.
router.get('/approve/:token', approveByToken);
router.get('/reject/:token', rejectByToken);

module.exports = router;