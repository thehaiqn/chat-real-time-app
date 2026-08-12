import { useEffect, useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useCallStore } from "../store/useCallStore";
import MessageInput from "./MessageInput";
import { format } from "timeago.js";
import s from "../styles/ChatArea.module.css";
import {
  Reply,
  Smile,
  X,
  Phone,
  Video,
  Search,
  PanelRightClose,
} from "lucide-react";

const ChatArea = () => {
  const [activeReactionId, setActiveReactionId] = useState(null);
  const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😡"];

  const {
    messages,
    isMessagesLoading,
    selectedUser,
    selectedChat, // ← full Chat document, always available
    selectedChatId,
    typingUserId,
    setReplyingTo,
    reactToMessage,
    showDetailsPanel,
    toggleDetailsPanel,
    showSearchPanel,
    toggleSearchPanel,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const { startCall, startGroupCall } = useCallStore();
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current && messages) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, typingUserId]);

  /* ---- derived display values ---- */
  const getDisplayName = (chat) => {
    if (!chat) return "";
    if (chat.isGroupChat) return chat.chatName;
    const friend = chat.users?.find((u) => u._id !== authUser._id);
    if (!friend) return chat.username || "Unknown User";
    return chat.nicknames?.[friend._id] || friend.fullName || friend.username;
  };

  const getChatPic = () => {
    if (selectedUser?.isGroupChat) return selectedUser.groupAvatar || null;
    if (selectedUser?.profilePic) return selectedUser.profilePic;
    const friend = selectedUser?.users?.find((u) => u._id !== authUser._id);
    return friend?.profilePic || null;
  };

  if (isMessagesLoading) {
    return (
      <div className={s.loadingState}>
        <span className="loading loading-spinner loading-lg text-brand-red" />
      </div>
    );
  }

  const chatName = getDisplayName(selectedChat || selectedUser);
  const chatPic = getChatPic();

  const theme = selectedChat?.theme;
  const bgStyle = {
    backgroundImage: theme && theme !== "default" ? `url(${theme})` : "none",
    backgroundColor: "#ffffff",
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  /* Determine friend online status */
  const isGroup = selectedChat?.isGroupChat || selectedUser?.isGroupChat;
  const friend = selectedChat
    ? selectedChat.users?.find((u) => u._id !== authUser._id)
    : selectedUser?.users
      ? selectedUser.users.find((u) => u._id !== authUser._id)
      : selectedUser;

  const isOnline = friend
    ? useAuthStore.getState().onlineUsers.includes(friend._id)
    : false;

  return (
    <div className={`${s.chatRoot} bg-white`} style={bgStyle}>
      {/* Overlay (only visible when a bg image is set) */}
      {theme && theme !== "default" && !theme.startsWith("#") && (
        <div className={s.bgOverlay} />
      )}

      {/* ── Header ── */}
      <div className={s.header}>
        <div className={s.headerAvatar}>
          {chatPic ? (
            <img src={chatPic} alt={chatName} className={s.headerAvatarImg} />
          ) : (
            chatName.charAt(0).toUpperCase()
          )}
        </div>

        <div>
          <h3 className={s.headerName}>{chatName}</h3>
          {selectedUser?.isGroupChat ? (
            <p className={s.headerSubMembers}>
              {selectedUser.users?.length} members
            </p>
          ) : friend ? (
            isOnline ? (
              <p className={s.headerSubOnline}>Online</p>
            ) : (
              <p className={s.headerSubOffline}>
                Offline —{" "}
                {friend.lastActive ? format(friend.lastActive) : "Unknown"}
              </p>
            )
          ) : null}
        </div>

        {/* Header Actions */}
        <div className="ml-auto flex items-center gap-4 text-gray-500 mr-2">
          {((!isGroup && friend) || (isGroup && selectedChat?._id)) && (
            <>
              <button
                className="hover:text-brand-red transition-colors"
                onClick={() => {
                  if (isGroup) {
                    startGroupCall(selectedChat._id, chatName, "voice");
                  } else {
                    startCall(
                      friend._id,
                      friend.username || friend.fullName,
                      "voice",
                    );
                  }
                }}
                title="Cuộc gọi thoại"
              >
                <Phone className="size-5" />
              </button>
              <button
                className="hover:text-brand-red transition-colors"
                onClick={() => {
                  if (isGroup) {
                    startGroupCall(selectedChat._id, chatName, "video");
                  } else {
                    startCall(
                      friend._id,
                      friend.username || friend.fullName,
                      "video",
                    );
                  }
                }}
                title="Cuộc gọi video"
              >
                <Video className="size-5" />
              </button>
            </>
          )}
          <button
            className={`transition-colors p-1.5 rounded-md ${showSearchPanel ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "hover:text-brand-red"}`}
            onClick={toggleSearchPanel}
            title="Tìm kiếm tin nhắn"
          >
            <Search className="size-5" />
          </button>

          <div className="w-px h-6 bg-gray-200 dark:bg-slate-700 mx-1"></div>

          <button
            className={`transition-colors p-1.5 rounded-md ${showDetailsPanel ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" : "hover:text-brand-red"}`}
            onClick={toggleDetailsPanel}
            title="Thu gọn/Mở rộng Thông tin hội thoại"
          >
            <PanelRightClose className="size-5" />
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className={s.messagesList}>
        {messages.map((message) => {
          const isMe = message.senderId._id === authUser._id;
          return (
            <div
              key={message._id}
              className={isMe ? s.messageRowMe : s.messageRowOther}
            >
              <div className={`${s.messageBubbleWrap} group`}>
                {/* Other user avatar */}
                {!isMe && (
                  <div className={s.senderAvatar}>
                    {message.senderId.profilePic ? (
                      <img
                        src={message.senderId.profilePic}
                        alt="avatar"
                        className="size-full object-cover"
                      />
                    ) : (
                      message.senderId.username.charAt(0).toUpperCase()
                    )}
                  </div>
                )}

                {/* Actions (mine) */}
                {isMe && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 mr-2 relative">
                    {activeReactionId === message._id && (
                      <div className="absolute z-50 -top-10 right-0 bg-white dark:bg-slate-800 shadow-lg border border-gray-200 dark:border-slate-700 rounded-full px-2 py-1 flex gap-2">
                        {REACTION_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              reactToMessage(message._id, emoji);
                              setActiveReactionId(null);
                            }}
                            className="hover:scale-125 transition-transform text-lg"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() =>
                        setActiveReactionId(
                          activeReactionId === message._id ? null : message._id,
                        )
                      }
                      className="p-1 text-gray-400 hover:text-brand-red"
                    >
                      <Smile className="size-4" />
                    </button>
                    <button
                      onClick={() => setReplyingTo(message)}
                      className="p-1 text-gray-400 hover:text-brand-red"
                    >
                      <Reply className="size-4" />
                    </button>
                    <button
                      onClick={() =>
                        useChatStore.getState().deleteMessage(message._id)
                      }
                      className="p-1 text-gray-400 hover:text-red-500"
                      title="Delete message"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                        <line x1="10" x2="10" y1="11" y2="17" />
                        <line x1="14" x2="14" y1="11" y2="17" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Bubble Container */}
                <div className="flex flex-col relative max-w-[70%]">
                  {/* Sender Name for Groups */}
                  {!isMe && selectedChat?.isGroupChat && (
                    <span className="text-xs text-gray-500 mb-1 ml-1 font-medium">
                      {selectedChat.nicknames?.[message.senderId._id] ||
                        message.senderId.username}
                    </span>
                  )}

                  {/* Bubble */}
                  <div className={isMe ? s.bubbleMe : s.bubbleOther}>
                    {/* Reply Preview */}
                    {message.replyTo && (
                      <div className="mb-2 p-2 bg-black/10 dark:bg-white/10 rounded border-l-4 border-brand-red text-xs opacity-90 cursor-pointer">
                        <p className="font-semibold mb-0.5">
                          {message.replyTo.senderId?.username || "User"}
                        </p>
                        <p className="truncate line-clamp-1">
                          {message.replyTo.messageType === "text"
                            ? message.replyTo.text
                            : `[${message.replyTo.messageType}]`}
                        </p>
                      </div>
                    )}

                    {message.messageType === "image" && message.image && (
                      <img
                        src={message.image}
                        alt="Attachment"
                        className={s.msgImage}
                      />
                    )}
                    {message.messageType === "gif" && message.image && (
                      <img src={message.image} alt="GIF" className={s.msgGif} />
                    )}
                    {message.messageType === "audio" && message.audio && (
                      <audio
                        controls
                        src={message.audio}
                        className="max-w-[200px] sm:max-w-[250px] outline-none h-10 rounded-full"
                      />
                    )}
                    {message.text && (
                      <p className={s.msgText}>{message.text}</p>
                    )}
                  </div>

                  {/* Reaction Badges */}
                  {message.reactions &&
                    Object.keys(message.reactions).length > 0 && (
                      <div
                        className={`absolute -bottom-3 ${isMe ? "right-2" : "left-2"} flex gap-1 bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 rounded-full px-1.5 py-0.5 text-[11px] z-10`}
                      >
                        {Object.entries(message.reactions).map(
                          ([emoji, users]) => (
                            <span
                              key={emoji}
                              onClick={() => reactToMessage(message._id, emoji)}
                              className="cursor-pointer hover:scale-110"
                              title={
                                users.length > 0
                                  ? `${users.length} reactions`
                                  : ""
                              }
                            >
                              {emoji}{" "}
                              {users.length > 1 && (
                                <span className="ml-0.5 text-gray-500">
                                  {users.length}
                                </span>
                              )}
                            </span>
                          ),
                        )}
                      </div>
                    )}
                </div>

                {/* Actions (other) */}
                {!isMe && (
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 ml-2 relative">
                    <button
                      onClick={() => setReplyingTo(message)}
                      className="p-1 text-gray-400 hover:text-brand-red"
                    >
                      <Reply className="size-4" />
                    </button>
                    <button
                      onClick={() =>
                        setActiveReactionId(
                          activeReactionId === message._id ? null : message._id,
                        )
                      }
                      className="p-1 text-gray-400 hover:text-brand-red"
                    >
                      <Smile className="size-4" />
                    </button>
                    {activeReactionId === message._id && (
                      <div className="absolute z-50 -top-10 left-0 bg-white dark:bg-slate-800 shadow-lg border border-gray-200 dark:border-slate-700 rounded-full px-2 py-1 flex gap-2">
                        {REACTION_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              reactToMessage(message._id, emoji);
                              setActiveReactionId(null);
                            }}
                            className="hover:scale-125 transition-transform text-lg"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Timestamp */}
              <div className={isMe ? s.messageTimeMe : s.messageTimeOther}>
                <time>{format(message.createdAt)}</time>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {typingUserId && (
          <div className={s.typingWrap}>
            <div className={s.typingAvatar} />
            <div className={s.typingBubble}>
              <span className="loading loading-dots loading-sm text-gray-400 dark:text-gray-500" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <MessageInput />
    </div>
  );
};

export default ChatArea;
