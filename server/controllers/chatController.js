import Chat from "../models/Chat.js";
import User from "../models/User.js";
import Message from "../models/Message.js";
import { io } from "../socket/socket.js";

// 1. Tạo hoặc truy cập cuộc trò chuyện 1-1
export const accessChat = async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.sendStatus(400);
  }
  // Tìm xem cuộc trò chuyện 1-1 giữa 2 người này đã tồn tại chưa
  try {
    let isChat = await Chat.find({
      isGroupChat: false,
      $and: [
        { users: { $elemMatch: { $eq: req.user._id } } },
        { users: { $elemMatch: { $eq: userId } } },
      ],
    })
      .populate("users", "-password")
      .populate("latestMessage");
    // Liên kết sâu để lấy thông tin người gửi của tin nhắn cuối cùng
    isChat = await User.populate(isChat, {
      path: "latestMessage.senderId",
      select: "username profilePic email",
    });

    if (isChat.length > 0) {
      res.send(isChat[0]);
    } else {
      // Nếu chưa có, tiến hành tạo mới một cuộc hội thoại 1-1
      var chatData = {
        chatName: "sender",
        isGroupChat: false,
        users: [req.user._id, userId],
      };

      const createdChat = await Chat.create(chatData);
      const FullChat = await Chat.findOne({ _id: createdChat._id }).populate(
        "users",
        "-password",
      );
      res.status(200).json(FullChat);
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
// 2. Lấy danh sách tất cả các cuộc trò chuyện của một user
export const fetchChats = async (req, res) => {
  try {
    let results = await Chat.find({
      users: { $elemMatch: { $eq: req.user._id } },
    })
      .populate("users", "-password")
      .populate("groupAdmin", "-password")
      .populate("latestMessage")
      .sort({ updatedAt: -1 }); // Chat nào mới tương tác sẽ đẩy lên đầu

    results = await User.populate(results, {
      path: "latestMessage.senderId",
      select: "username profilePic email",
    });

    res.status(200).send(results);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
// 3. Tạo cuộc trò chuyện nhóm (Group Chat)
export const createGroupChat = async (req, res) => {
  if (!req.body.users || !req.body.name) {
    return res.status(400).send({ message: "Please Fill all the fields" });
  }

  var users = Array.isArray(req.body.users)
    ? req.body.users
    : JSON.parse(req.body.users);

  if (users.length < 2) {
    return res
      .status(400)
      .send("More than 2 users are required to form a group chat");
  }

  users.push(req.user._id); // Thêm người dùng hiện tại vào nhóm

  try {
    const groupChat = await Chat.create({
      chatName: req.body.name,
      users: users,
      isGroupChat: true,
      groupAdmin: req.user._id,
    });

    const fullGroupChat = await Chat.findOne({ _id: groupChat._id })
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    res.status(200).json(fullGroupChat);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = await Chat.findById(chatId);

    if (!chat) {
      return res.status(404).json({ error: "Chat not found" });
    }

    // Xóa mềm: cập nhật clearedHistory cho người dùng thực hiện yêu cầu.
    if (!chat.clearedHistory) {
      chat.clearedHistory = new Map();
    }
    chat.clearedHistory.set(req.user._id.toString(), new Date());
    await chat.save();

    // Phát sự kiện tới người dùng cụ thể này (hoặc được xử lý cục bộ bởi store ở phía frontend)
    // Không cần phát tín hiệu ra phòng vì các người dùng khác không bị ảnh hưởng.
    res.status(200).json({
      message: "Chat history cleared successfully",
      chatId,
      clearedAt: chat.clearedHistory.get(req.user._id.toString()),
    });
  } catch (error) {
    console.log("Error in deleteChat controller: ", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateGroupSettings = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { chatName, groupAvatar, theme, permissions } = req.body;

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    const isAdmin = chat.groupAdmin?.toString() === req.user._id.toString();

    // Security check: if not admin and canChangeNameAvatar is false, block name/avatar updates
    if (!isAdmin && chat.permissions?.canChangeNameAvatar === false) {
      if (chatName || groupAvatar !== undefined) {
        return res.status(403).json({ error: "Only admins can change the group name or avatar" });
      }
    }

    if (chatName) chat.chatName = chatName;
    if (groupAvatar !== undefined) chat.groupAvatar = groupAvatar;
    if (theme) chat.theme = theme;
    
    // Only admins can update permissions
    if (permissions && isAdmin) {
      if (permissions.canChangeNameAvatar !== undefined) chat.permissions.canChangeNameAvatar = permissions.canChangeNameAvatar;
      if (permissions.canPinMessages !== undefined) chat.permissions.canPinMessages = permissions.canPinMessages;
      if (permissions.canCreateNotes !== undefined) chat.permissions.canCreateNotes = permissions.canCreateNotes;
    }

    await chat.save();

    const updatedChat = await Chat.findById(chatId)
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    // Phát sự kiện để cập nhật khung chat cho tất cả thành viên.
    io.to(chatId).emit("chat-updated", updatedChat);

    res.status(200).json(updatedChat);
  } catch (error) {
    console.log("Error in updateGroupSettings:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateChatTheme = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { theme } = req.body;

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    chat.theme = theme;
    await chat.save();

    const updatedChat = await Chat.findById(chatId)
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    // Emit event to update chat for all members
    io.to(chatId).emit("chat-updated", updatedChat);

    res.status(200).json(updatedChat);
  } catch (error) {
    console.log("Error in updateChatTheme:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const updateNickname = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId, nickname } = req.body;

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    chat.nicknames.set(userId, nickname);
    chat.markModified("nicknames");
    await chat.save();

    const updatedChat = await Chat.findById(chatId)
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    io.to(chatId).emit("nickname-updated", updatedChat);

    res.status(200).json(updatedChat);
  } catch (error) {
    console.log("Error in updateNickname:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const addMember = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.body;

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    if (!chat.isGroupChat) {
      return res
        .status(400)
        .json({ error: "Cannot add member to a 1-on-1 chat" });
    }

    // Any group member can add members, so we remove the admin check
    // if (chat.groupAdmin.toString() !== req.user._id.toString()) {
    //   return res.status(403).json({ error: "Only the admin can add members" });
    // }

    if (chat.users.includes(userId)) {
      return res.status(400).json({ error: "User is already in the group" });
    }

    chat.users.push(userId);
    await chat.save();

    const updatedChat = await Chat.findById(chatId)
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    res.status(200).json(updatedChat);
  } catch (error) {
    console.log("Error in addMember:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const toggleMute = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { duration } = req.body;
    const userId = req.user._id.toString();

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    if (duration === null || duration === undefined) {
      chat.mutedUntil.delete(userId);
    } else {
      let mutedUntilDate;
      if (duration === -1) {
        mutedUntilDate = new Date("9999-12-31");
      } else {
        mutedUntilDate = new Date(Date.now() + duration);
      }
      chat.mutedUntil.set(userId, mutedUntilDate);
    }

    chat.markModified("mutedUntil");
    await chat.save();

    const updatedChat = await Chat.findById(chatId)
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    res.status(200).json(updatedChat);
  } catch (error) {
    console.log("Error in toggleMute:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const leaveGroup = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    if (!chat.isGroupChat) {
      return res.status(400).json({ error: "Cannot leave a 1-on-1 chat" });
    }

    if (!chat.users.includes(userId)) {
      return res
        .status(400)
        .json({ error: "You are not a member of this group" });
    }

    chat.users = chat.users.filter((id) => id.toString() !== userId.toString());

    if (chat.users.length === 0) {
      await Chat.findByIdAndDelete(chatId);
      return res
        .status(200)
        .json({ message: "Group deleted as it was empty", chatId });
    }

    if (chat.groupAdmin.toString() === userId.toString()) {
      chat.groupAdmin = chat.users[0];
    }

    await chat.save();

    // Fetch populated to send to remaining members
    const updatedChat = await Chat.findById(chatId)
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    io.to(chatId).emit("group-updated", updatedChat);

    res.status(200).json({ message: "Left group successfully", chatId });
  } catch (error) {
    console.log("Error in leaveGroup:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const joinGroup = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    if (!chat.isGroupChat) {
      return res
        .status(400)
        .json({ error: "Cannot join a 1-on-1 chat via link" });
    }

    if (chat.users.includes(userId)) {
      return res
        .status(400)
        .json({ error: "You are already a member of this group" });
    }

    chat.users.push(userId);
    await chat.save();

    const updatedChat = await Chat.findById(chatId)
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    res.status(200).json(updatedChat);
  } catch (error) {
    console.log("Error in joinGroup:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const kickMember = async (req, res) => {
  try {
    const { chatId, userId } = req.params;
    const currentUserId = req.user._id;

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    if (!chat.isGroupChat) {
      return res.status(400).json({ error: "Cannot kick from a 1-on-1 chat" });
    }

    if (chat.groupAdmin.toString() !== currentUserId.toString()) {
      return res.status(403).json({ error: "Only the admin can kick members" });
    }

    if (!chat.users.includes(userId)) {
      return res
        .status(400)
        .json({ error: "User is not a member of this group" });
    }

    if (userId.toString() === currentUserId.toString()) {
      return res.status(400).json({ error: "You cannot kick yourself" });
    }

    chat.users = chat.users.filter((id) => id.toString() !== userId.toString());
    await chat.save();

    const updatedChat = await Chat.findById(chatId)
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    // Notify the kicked user
    io.to(userId.toString()).emit("member-kicked", { chatId });

    // Notify the rest of the group
    io.to(chatId).emit("group-updated", updatedChat);
    io.to(chatId).emit("update-group-members", updatedChat);

    res.status(200).json(updatedChat);
  } catch (error) {
    console.log("Error in kickMember:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const togglePin = async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    const isPinned = chat.pinnedBy.includes(userId);

    if (isPinned) {
      chat.pinnedBy = chat.pinnedBy.filter((id) => id.toString() !== userId.toString());
    } else {
      chat.pinnedBy.push(userId);
    }

    await chat.save();

    const updatedChat = await Chat.findById(chatId)
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    res.status(200).json(updatedChat);
  } catch (error) {
    console.log("Error in togglePin:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
};
