const express = require('express');
const router = express.Router();
const {
  sendNotification,
  listNotifications,
  markRead,
  markAllRead,
  deleteNotification,
  clearNotifications
} = require('../controllers/notificationController');
const { protect } = require('../middlewares/auth');

router.use(protect);

router.get('/', listNotifications);
router.post('/', sendNotification);
router.patch('/read-all', markAllRead); // must come before '/:id/read'
router.patch('/:id/read', markRead);
router.delete('/', clearNotifications);
router.delete('/:id', deleteNotification);

module.exports = router;