import Message from '../models/Message.js';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import { io } from '../socket/socket.js';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    // Get the chat to check clearedHistory
    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    let query = { chatId };
    
    // If the user has a cleared history timestamp for this chat, only fetch messages after that time
    if (chat.clearedHistory && chat.clearedHistory.has(userId.toString())) {
      const clearedAt = chat.clearedHistory.get(userId.toString());
      query.createdAt = { $gt: clearedAt };
    }

    const messages = await Message.find(query)
      .populate('senderId', 'username profilePic email')
      .populate('chatId')
      .populate({
        path: 'replyTo',
        select: 'text image messageType senderId',
        populate: {
          path: 'senderId',
          select: 'username'
        }
      });
      
    res.status(200).json(messages);
  } catch (error) {
    console.log('Error in getMessages controller: ', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const searchMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { q, sender, date } = req.query;
    const userId = req.user._id;

    if (!q) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    let query = { 
      chatId,
      text: { $regex: q, $options: 'i' }
    };

    if (sender) {
      query.senderId = sender;
    }

    if (date) {
      // date format expected: YYYY-MM-DD
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      query.createdAt = {
        $gte: startOfDay,
        $lte: endOfDay
      };
    }
    
    // If the user has a cleared history timestamp for this chat, only fetch messages after that time
    if (chat.clearedHistory && chat.clearedHistory.has(userId.toString())) {
      const clearedAt = chat.clearedHistory.get(userId.toString());
      if (query.createdAt) {
        // If there's already a date filter, adjust the $gte to be the max of startOfDay and clearedAt
        if (!query.createdAt.$gte || query.createdAt.$gte < clearedAt) {
           query.createdAt.$gte = clearedAt;
        }
      } else {
        query.createdAt = { $gt: clearedAt };
      }
    }

    const messages = await Message.find(query)
      .populate('senderId', 'username profilePic email')
      .populate('chatId')
      .sort({ createdAt: -1 })
      .limit(20);
      
    res.status(200).json(messages);
  } catch (error) {
    console.log('Error in searchMessages controller: ', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text, image, audio, messageType, chatId, replyTo } = req.body;
    const senderId = req.user._id;

    if (!chatId) {
      return res.status(400).json({ error: 'Invalid data passed into request' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat.isGroupChat) {
       const receiverId = chat.users.find(u => u.toString() !== senderId.toString()) || senderId;
       const receiver = await User.findById(receiverId);
       const sender = await User.findById(senderId);
       
       if (sender.blockedUsers.includes(receiverId) || receiver.blockedUsers.includes(senderId)) {
          return res.status(403).json({ error: 'Cannot send message. User is blocked.' });
       }
    }

    let newMessage = new Message({
      senderId,
      text,
      image,
      audio,
      chatId,
      messageType: messageType || 'text',
      replyTo: replyTo || null,
    });

    await newMessage.save();
    
    newMessage = await newMessage.populate('senderId', 'username profilePic');
    newMessage = await newMessage.populate('chatId');
    newMessage = await User.populate(newMessage, {
      path: 'chatId.users',
      select: 'username profilePic email',
    });
    
    if (replyTo) {
      newMessage = await newMessage.populate({
        path: 'replyTo',
        select: 'text image messageType senderId',
        populate: {
          path: 'senderId',
          select: 'username'
        }
      });
    }

    await Chat.findByIdAndUpdate(chatId, { latestMessage: newMessage });

    // Emit to each user in the chat personally
    newMessage.chatId.users.forEach((user) => {
      // Don't send notification to the sender's current socket?
      // Actually, if they have multiple devices, emitting to sender is fine.
      // We will emit to everyone, and frontend ignores duplicate messages.
      io.to(user._id.toString()).emit('newMessage', newMessage);
    });

    res.status(201).json(newMessage);

    // AI Bot integration logic (simplified for groups: only respond if @AI is mentioned)
    if (text && text.trim().startsWith('@AI')) {
      const prompt = text.replace('@AI', '').trim();
      if (prompt) {
        try {
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
          });

          // Create a mock bot user in DB or just use a system ID. For now we use the senderId as bot ID to avoid errors, or create a specific bot logic.
          // In a real app we'd have a specific Bot user.
          let aiMessage = new Message({
            senderId: senderId, // Hack for now: appears from sender, but text says [BOT]
            chatId: chatId,
            text: `[BOT AI]: ${response.text}`,
            messageType: 'text'
          });

          await aiMessage.save();
          aiMessage = await aiMessage.populate('senderId', 'username profilePic');
          aiMessage = await aiMessage.populate('chatId');

          await Chat.findByIdAndUpdate(chatId, { latestMessage: aiMessage });
          io.to(chatId).emit('newMessage', aiMessage);
        } catch (aiError) {
          console.log('Error from Gemini API: ', aiError.message);
        }
      }
    }
  } catch (error) {
    console.log('Error in sendMessage controller: ', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const senderId = req.user._id;

    const message = await Message.findById(messageId);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (message.senderId.toString() !== senderId.toString()) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    await Message.findByIdAndDelete(messageId);

    // Emit to room that a message was deleted
    io.to(message.chatId.toString()).emit('messageDeleted', messageId);
    
    res.status(200).json({ message: 'Message deleted successfully', messageId });
  } catch (error) {
    console.log('Error in deleteMessage controller: ', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const reactToMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user._id;

    if (!emoji) {
      return res.status(400).json({ error: 'Emoji is required' });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Initialize map if missing
    if (!message.reactions) {
      message.reactions = new Map();
    }

    let userHadThisEmoji = false;

    // Remove user from any existing reactions
    for (const [key, users] of message.reactions.entries()) {
      const userIndex = users.findIndex(id => id.toString() === userId.toString());
      if (userIndex !== -1) {
        if (key === emoji) {
          userHadThisEmoji = true;
        }
        users.splice(userIndex, 1);
        if (users.length > 0) {
          message.reactions.set(key, users);
        } else {
          message.reactions.delete(key);
        }
      }
    }

    // If they didn't just click the same emoji they already had, add the new one
    if (!userHadThisEmoji) {
      let usersReacted = message.reactions.get(emoji) || [];
      usersReacted.push(userId);
      message.reactions.set(emoji, usersReacted);
    }

    await message.save();

    // Convert map to plain object to send in response/socket
    const reactionsObj = {};
    for (const [key, val] of message.reactions.entries()) {
      reactionsObj[key] = val;
    }

    // Emit to room
    io.to(message.chatId.toString()).emit('messageReacted', {
      messageId,
      reactions: reactionsObj
    });

    res.status(200).json({ message: 'Reaction updated successfully', reactions: reactionsObj });
  } catch (error) {
    console.log('Error in reactToMessage controller: ', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};
