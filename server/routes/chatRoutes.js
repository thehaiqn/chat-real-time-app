import express from 'express';
import protectRoute from '../middleware/protectRoute.js';
import { accessChat, fetchChats, createGroupChat, deleteChat, updateGroupSettings, updateChatTheme, updateNickname, addMember, toggleMute, leaveGroup, joinGroup, kickMember, togglePin } from '../controllers/chatController.js';

const router = express.Router();

router.post('/', protectRoute, accessChat);
router.get('/', protectRoute, fetchChats);
router.post('/group', protectRoute, createGroupChat);
router.delete('/:chatId', protectRoute, deleteChat);
router.put('/:chatId/settings', protectRoute, updateGroupSettings);
router.patch('/:chatId/theme', protectRoute, updateChatTheme);
router.patch('/:chatId/nickname', protectRoute, updateNickname);
router.post('/:chatId/member', protectRoute, addMember);
router.delete('/:chatId/member/:userId', protectRoute, kickMember);
router.patch('/:chatId/mute', protectRoute, toggleMute);
router.post('/:chatId/leave', protectRoute, leaveGroup);
router.post('/:chatId/join', protectRoute, joinGroup);
router.patch('/:chatId/pin', protectRoute, togglePin);

export default router;
