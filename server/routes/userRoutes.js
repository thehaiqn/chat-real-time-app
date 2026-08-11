import express from 'express';
import { 
  searchUsers, addFriend, unfriendUser, getFriends, updateAvatar, 
  blockUser, unblockUser, getBlockedUsers, changePassword,
  updateProfile
} from '../controllers/userController.js';
import protectRoute from '../middleware/protectRoute.js';

const router = express.Router();

router.put('/profile', protectRoute, updateProfile);
router.get('/search', protectRoute, searchUsers);
router.post('/add-friend', protectRoute, addFriend);
router.post('/unfriend', protectRoute, unfriendUser);
router.get('/friends', protectRoute, getFriends);

router.put('/avatar', protectRoute, updateAvatar);
router.patch('/block', protectRoute, blockUser);
router.post('/unblock', protectRoute, unblockUser);
router.get('/blocked', protectRoute, getBlockedUsers);
router.put('/password', protectRoute, changePassword);

export default router;
