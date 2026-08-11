import User from '../models/User.js';
import Chat from '../models/Chat.js';
import Message from '../models/Message.js';
import bcrypt from 'bcryptjs';
import { io } from '../socket/socket.js';

export const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(200).json([]);
    }

    const currentUserId = req.user._id;
    const currentUser = await User.findById(currentUserId);

    const users = await User.find({
      $and: [
        { _id: { $ne: currentUserId } },
        { _id: { $nin: currentUser.blockedUsers } },
        {
          $or: [
            { email: { $regex: `^${query}$`, $options: 'i' } },
            { phoneNumber: query },
          ],
        },
      ],
    }).select('-password');

    res.status(200).json(users);
  } catch (error) {
    console.log('Error in searchUsers controller', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { username, email, phoneNumber, gender, profilePic } = req.body;
    const currentUserId = req.user._id;

    const user = await User.findById(currentUserId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if email or username is taken by someone else
    if (username !== user.username) {
      const existingUsername = await User.findOne({ username });
      if (existingUsername) return res.status(400).json({ error: 'Username already taken' });
    }

    if (email !== user.email) {
      const existingEmail = await User.findOne({ email });
      if (existingEmail) return res.status(400).json({ error: 'Email already taken' });
    }

    if (username) user.username = username;
    if (email) user.email = email;
    if (phoneNumber !== undefined) user.phoneNumber = phoneNumber;
    if (gender) user.gender = gender;
    if (profilePic) user.profilePic = profilePic;

    await user.save();

    const { io } = await import('../socket/socket.js');
    io.emit('user-profile-updated', user);

    res.status(200).json(user);
  } catch (error) {
    console.log('Error in updateProfile controller', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const addFriend = async (req, res) => {
  try {
    const { friendId } = req.body;
    const currentUserId = req.user._id;

    if (currentUserId.toString() === friendId) {
      return res.status(400).json({ error: "You can't add yourself as a friend" });
    }

    const user = await User.findById(currentUserId);
    const friend = await User.findById(friendId);

    if (!friend) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.friends.includes(friendId)) {
      return res.status(400).json({ error: 'User is already your friend' });
    }

    user.friends.push(friendId);
    friend.friends.push(currentUserId); // Bidirectional friendship

    await user.save();
    await friend.save();

    // Avoid sending password to the client
    friend.password = undefined;

    // Emit event to both users
    const io = (await import('../socket/socket.js')).io;
    
    io.to(friendId.toString()).emit('new-friend-added', user);
    io.to(currentUserId.toString()).emit('new-friend-added', friend);

    res.status(200).json({ message: 'Friend added successfully', newFriend: friend });
  } catch (error) {
    console.log('Error in addFriend controller', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const unfriendUser = async (req, res) => {
  try {
    const { friendId } = req.body;
    const currentUserId = req.user._id;

    const user = await User.findById(currentUserId);
    const friend = await User.findById(friendId);

    if (!friend) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.friends = user.friends.filter(id => id.toString() !== friendId);
    friend.friends = friend.friends.filter(id => id.toString() !== currentUserId.toString());

    await user.save();
    await friend.save();

    res.status(200).json({ message: 'Unfriended successfully', friends: user.friends });
  } catch (error) {
    console.log('Error in unfriendUser controller', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getFriends = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const user = await User.findById(currentUserId).populate('friends', '-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.status(200).json(user.friends);
  } catch (error) {
    console.log('Error in getFriends controller', error.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const updateAvatar = async (req, res) => {
  try {
    const { profilePic } = req.body;
    const currentUserId = req.user._id;

    if (!profilePic) {
      return res.status(400).json({ error: "Profile pic is required" });
    }

    const updatedUser = await User.findByIdAndUpdate(currentUserId, { profilePic }, { new: true }).select("-password");

    const { io } = await import('../socket/socket.js');
    io.emit('user-profile-updated', updatedUser);

    res.status(200).json(updatedUser);
  } catch (error) {
    console.log("Error in update avatar:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const blockUser = async (req, res) => {
  try {
    const { userIdToBlock } = req.body;
    const currentUserId = req.user._id;

    if (currentUserId.toString() === userIdToBlock) {
      return res.status(400).json({ error: "You cannot block yourself" });
    }

    const user = await User.findById(currentUserId);
    if (!user.blockedUsers.includes(userIdToBlock)) {
      user.blockedUsers.push(userIdToBlock);
      
      // Optionally remove from friends if blocked
      user.friends = user.friends.filter(id => id.toString() !== userIdToBlock);
      
      const blockedUser = await User.findById(userIdToBlock);
      if(blockedUser) {
          blockedUser.friends = blockedUser.friends.filter(id => id.toString() !== currentUserId.toString());
          await blockedUser.save();
      }

      await user.save();
    }
    
    // Find the 1-on-1 chat between these two users and delete it
    const chat = await Chat.findOne({
      isGroupChat: false,
      users: { $all: [currentUserId, userIdToBlock] }
    });
    
    if (chat) {
      await Message.deleteMany({ chatId: chat._id });
      await Chat.findByIdAndDelete(chat._id);
      
      // Emit chat-deleted to both users via socket or to the room
      io.to(chat._id.toString()).emit('chat-deleted', chat._id);
      // Wait, if they are not in the room, they might not get it. 
      // The socket logic in chat-deleted uses chatId.
      io.to(currentUserId.toString()).emit('chat-deleted', chat._id);
      io.to(userIdToBlock.toString()).emit('chat-deleted', chat._id);
    }
    
    // populate blocked users for return
    const updatedUser = await User.findById(currentUserId).populate('blockedUsers', '-password');
    res.status(200).json({ message: "User blocked successfully", blockedUsers: updatedUser.blockedUsers, friends: updatedUser.friends });
  } catch (error) {
    console.log("Error in blockUser:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const { userIdToUnblock } = req.body;
    const currentUserId = req.user._id;

    const user = await User.findById(currentUserId);
    user.blockedUsers = user.blockedUsers.filter(id => id.toString() !== userIdToUnblock);
    await user.save();

    const updatedUser = await User.findById(currentUserId).populate('blockedUsers', '-password');
    res.status(200).json({ message: "User unblocked successfully", blockedUsers: updatedUser.blockedUsers });
  } catch (error) {
    console.log("Error in unblockUser:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const getBlockedUsers = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('blockedUsers', '-password');
    res.status(200).json(user.blockedUsers);
  } catch (error) {
    console.log("Error in getBlockedUsers:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Incorrect old password" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.log("Error in changePassword:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
