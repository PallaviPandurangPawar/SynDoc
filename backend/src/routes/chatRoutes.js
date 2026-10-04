const express = require('express');
const router = express.Router();
const { askChatbot } = require('../controllers/chatController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.post('/', askChatbot);

module.exports = router;