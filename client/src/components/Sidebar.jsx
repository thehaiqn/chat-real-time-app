import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useChatStore } from '../store/useChatStore';
import {
  Search,
  UserPlus,
  Users,
  MessageCircle,
  Settings,
  CheckCheck,
  MessageSquare,
  Plus,
  BellOff,
  Pin,
} from 'lucide-react';
import { axiosInstance } from '../lib/axios';
import CreateGroupModal from './CreateGroupModal';
import s from '../styles/Sidebar.module.css';

const ChatCard = ({ chat, selectedUser, authUser, onlineUsers, setSelectedUser }) => {
  const isSelected =
    selectedUser?._id === chat._id ||
    (!chat.isGroupChat && selectedUser?._id === chat.users?.find(u => u._id !== authUser?._id)?._id);
    
  const getChatName = () => {
    if (chat.isGroupChat) return chat.chatName;
    const friend = chat.users?.find(u => u._id !== authUser?._id);
    if (!friend) return 'Unknown User';
    return chat.nicknames?.[friend._id] || friend.username;
  };

  const getChatPic = () => {
    if (chat.isGroupChat) return null;
    const friend = chat.users?.find(u => u._id !== authUser?._id);
    return friend?.profilePic || null;
  };

  const chatName = getChatName();
  const pic = getChatPic();
  const otherUser = chat.users?.find(u => u._id !== authUser?._id);
  const isOtherOnline = !chat.isGroupChat && onlineUsers.includes(otherUser?._id);

  const clearedAt = chat.clearedHistory?.[authUser?._id];
  let hasValidLatestMessage = !!chat.latestMessage;
  let isCleared = false;
  if (clearedAt) {
    if (!hasValidLatestMessage || new Date(chat.latestMessage.createdAt) <= new Date(clearedAt)) {
      hasValidLatestMessage = false;
      isCleared = true;
    }
  }

  return (
    <button
      onClick={() => {
        const toSelect = chat.isGroupChat
          ? chat
          : chat.users?.find(u => u._id !== authUser?._id);
        setSelectedUser(toSelect);
      }}
      className={isSelected ? s.chatItemSelected : s.chatItem}
    >
      {/* Avatar */}
      <div className={s.chatAvatarWrap}>
        <div className={s.chatAvatar}>
          {pic
            ? <img src={pic} alt={chatName} className={s.chatAvatarImg} />
            : chatName.charAt(0).toUpperCase()}
        </div>
        {isOtherOnline && <div className={s.onlineDot} />}
      </div>

      {/* Info */}
      <div className={s.chatInfo}>
        <div className={s.chatInfoTop}>
          <p className={s.chatName}>
            {chatName}
            {chat.mutedBy?.includes(authUser?._id) && <BellOff className="size-3 inline-ml-1 ml-1 text-gray-400" />}
            {chat.pinnedBy?.includes(authUser?._id) && <Pin className="size-3 inline-block ml-1 text-gray-400" fill="currentColor" />}
          </p>
          {hasValidLatestMessage && chat.latestMessage?.createdAt && (
            <span className={s.chatTime}>{new Date(chat.latestMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          )}
        </div>
        <div className={s.chatPreview}>
          {hasValidLatestMessage && chat.latestMessage?.senderId === authUser?._id && (
            <CheckCheck className="size-3.5 text-blue-500 shrink-0" />
          )}
          <p className={s.chatPreviewText}>
            {hasValidLatestMessage 
              ? (chat.latestMessage?.text || (chat.latestMessage?.image ? 'Sent an image' : 'Started a conversation'))
              : (isCleared ? 'Chat history cleared' : 'Click to start messaging')}
          </p>
        </div>
      </div>
    </button>
  );
};

const Sidebar = ({ activeView, setActiveView }) => {
  const { friends, fetchFriends, onlineUsers, logout } = useAuthStore();
  const { setSelectedUser, selectedUser, chats, fetchChats, setChats } = useChatStore();

  const [searchQuery,     setSearchQuery]     = useState('');
  const [searchResults,   setSearchResults]   = useState([]);
  const [activeTab,       setActiveTab]       = useState('all'); // all | groups | friends
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  useEffect(() => {
    fetchFriends();
    fetchChats();
  }, [fetchFriends, fetchChats]);

  /* ---- Tab filter ---- */
  const authUser = useAuthStore.getState().authUser;

  const baseFilteredChats = chats.filter((chat) => {
    if (activeTab === 'friends') return false; // Handled separately below
    
    const clearedAt = chat.clearedHistory?.[authUser?._id];
    let hasValidLatestMessage = !!chat.latestMessage;
    
    let isClearedAndNoNewMessage = false;
    if (clearedAt) {
      if (!hasValidLatestMessage) {
        isClearedAndNoNewMessage = true;
      } else if (new Date(chat.latestMessage.createdAt) <= new Date(clearedAt)) {
        isClearedAndNoNewMessage = true;
        hasValidLatestMessage = false;
      }
    }

    // Hide chat if it was cleared and has no new messages
    if (isClearedAndNoNewMessage && activeTab === 'all') return false;
    
    if (activeTab === 'groups') return chat.isGroupChat;
    return true; // 'all'
  });

  const getChatName = (chat) => {
    if (chat.isGroupChat) return chat.chatName;
    const friend = chat.users?.find(u => u._id !== authUser?._id);
    if (!friend) return 'Unknown User';
    return chat.nicknames?.[friend._id] || friend.username;
  };

  const getChatPic = (chat) => {
    if (chat.isGroupChat) return null;
    const friend = chat.users?.find(u => u._id !== authUser?._id);
    return friend?.profilePic || null;
  };

  // Local search filter and pinned sorting
  const filteredChats = baseFilteredChats
    .filter(chat => getChatName(chat).toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const aPinned = a.pinnedBy?.includes(authUser?._id) ? 1 : 0;
      const bPinned = b.pinnedBy?.includes(authUser?._id) ? 1 : 0;
      return bPinned - aPinned;
    });

  const handleCreateChat = async (userId) => {
    try {
      const { data } = await axiosInstance.post('/chat', { userId });
      setSearchQuery('');
      setSearchResults([]);
      fetchChats();
      setSelectedUser(data.users.find(u => u._id === userId) || data);
    } catch (err) {
      console.log(err);
    }
  };

  // getChatName, getChatPic moved up

  return (
    <div className={s.root}>

      {/* ── Icon Rail ── */}
      <div className={s.rail}>
        <div className={s.railLogo}>
          <MessageSquare className="size-5" />
        </div>

        <div className={s.railNavList}>
          <button
            onClick={() => setActiveView('chat')}
            className={activeView === 'chat' ? s.railNavBtnActive : s.railNavBtn}
          >
            <MessageCircle className="size-6" />
          </button>
          <button
            onClick={() => setActiveView('friends')}
            className={activeView === 'friends' ? s.railNavBtnActive : s.railNavBtn}
          >
            <Users className="size-6" />
          </button>
          <button
            onClick={() => setActiveView('settings')}
            className={activeView === 'settings' ? s.railNavBtnActive : s.railNavBtn}
          >
            <Settings className="size-6" />
          </button>
        </div>


      </div>

      {/* ── Chat List Panel ── */}
      {activeView === 'chat' && (
        <div className={s.chatPanel}>

          {/* Header */}
          <div className={s.chatPanelHeader}>
            <h2 className={s.chatPanelTitle}>Messages</h2>

            {/* Search */}
            <div className={s.searchWrap}>
              <div className={s.searchIcon}>
                <Search className="size-5 text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                placeholder="Search or start new chat"
                className={s.searchInput}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Tab bar */}
            <div className={s.tabBar}>
              {['all', 'groups', 'friends'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={activeTab === tab ? s.tabActive : s.tab}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Create Group button */}
            {activeTab === 'groups' && (
              <button onClick={() => setShowCreateGroup(true)} className={s.createGroupBtn}>
                <Plus className="size-4" /> Create Group
              </button>
            )}
          </div>

          {/* List */}
          <div className={s.listWrap}>
            {/* Chat list */}
            <div className={s.chatListWrap}>
                {activeTab !== 'friends' && filteredChats.map(chat => (
                  <ChatCard 
                    key={chat._id || Math.random()} 
                    chat={chat} 
                    selectedUser={selectedUser}
                    authUser={authUser}
                    onlineUsers={onlineUsers}
                    setSelectedUser={setSelectedUser}
                  />
                ))}

                {/* ── FRIENDS LIST ('friends' Tab) ── */}
                {activeTab === 'friends' && friends
                  .filter(friend => friend.username.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(friend => {
                    const isOnline = onlineUsers.includes(friend._id);
                    return (
                      <button
                        key={friend._id}
                        onClick={() => handleCreateChat(friend._id)}
                        className={s.chatItem}
                      >
                        {/* Avatar */}
                        <div className={s.chatAvatarWrap}>
                          <div className={s.chatAvatar}>
                            {friend.profilePic
                              ? <img src={friend.profilePic} alt={friend.username} className={s.chatAvatarImg} />
                              : friend.username.charAt(0).toUpperCase()}
                          </div>
                          {isOnline && <div className={s.onlineDot} />}
                        </div>

                        {/* Info */}
                        <div className={s.chatInfo}>
                          <div className={s.chatInfoTop}>
                            <p className={s.chatName}>{friend.username}</p>
                          </div>
                          <div className={s.chatPreview}>
                            <p className={s.chatPreviewText}>Click to start messaging</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
          </div>

        </div>
      )}

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onGroupCreated={(newChat) => {
          setChats([newChat, ...chats]);
          setSelectedUser(newChat);
        }}
      />
    </div>
  );
};

export default Sidebar;
