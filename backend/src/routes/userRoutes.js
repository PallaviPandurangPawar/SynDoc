const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('../controllers/userController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.get('/me', getProfile);
router.put('/me', updateProfile);

module.exports = router;