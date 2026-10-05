const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, updateTrashRetention } = require('../controllers/userController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.get('/me', getProfile);
router.put('/me', updateProfile);
router.put('/me/trash-retention', updateTrashRetention);

module.exports = router;