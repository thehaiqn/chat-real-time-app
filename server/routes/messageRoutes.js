import express from 'express';
import protectRoute from '../middleware/protectRoute.js';
import { getMessages, sendMessage, deleteMessage, reactToMessage, searchMessages } from '../controllers/messageController.js';

const router = express.Router();

router.get('/search/:chatId', protectRoute, searchMessages);
router.get('/:chatId', protectRoute, getMessages);
router.post('/send', protectRoute, sendMessage);
router.post('/:messageId/react', protectRoute, reactToMessage);
router.delete('/:messageId', protectRoute, deleteMessage);

export default router;
