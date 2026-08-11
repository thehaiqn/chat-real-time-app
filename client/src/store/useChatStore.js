import { create } from 'zustand';
import { axiosInstance } from '../lib/axios.js';
import { useAuthStore } from './useAuthStore.js';

export const useChatStore = create((set, get) => ({
  messages: [],
  selectedUser: null,   // the other user (1-on-1) or group chat object
  selectedChat: null,   // always the full Chat document (theme, nicknames, etc.)
  selectedChatId: null,
  isMessagesLoading: false,
  typingUserId: null,
  replyingTo: null,
  showDetailsPanel: true,
  showSearchPanel: false,

  toggleDetailsPanel: () => set((state) => ({ showDetailsPanel: !state.showDetailsPanel, showSearchPanel: false })),
  toggleSearchPanel: () => set((state) => ({ showSearchPanel: !state.showSearchPanel, showDetailsPanel: false })),
  setShowSearchPanel: (show) => set({ showSearchPanel: show }),
  setReplyingTo: (message) => set({ replyingTo: message }),

  /* Moves a chat to the top of the sidebar list and updates its latestMessage preview.
     Called optimistically after send AND reactively on incoming socket messages. */
  syncChatToTop: (chatId, latestMessage) => {
    set((state) => {
      const idx = state.chats.findIndex(c => c._id === chatId);
      
      if (idx === -1) {
        // If the chat doesn't exist locally but the message contains the populated chatId object
        if (latestMessage.chatId && typeof latestMessage.chatId === 'object' && latestMessage.chatId._id) {
          const newChat = {
            ...latestMessage.chatId,
            latestMessage,
            updatedAt: new Date().toISOString(),
          };
          return { chats: [newChat, ...state.chats] };
        }
        return state; // Still unknown, cannot construct chat
      }

      const updated = {
        ...state.chats[idx],
        latestMessage,
        updatedAt: new Date().toISOString(),
      };
      const rest = state.chats.filter((_, i) => i !== idx);
      return { chats: [updated, ...rest] };
    });
  },

  setSelectedUser: async (selected) => {
    set({ selectedUser: selected });
    
    // If selected is a chat object (has _id and users array)
    if (selected.users) {
      set({ selectedChatId: selected._id, selectedChat: selected });
      get().getMessages(selected._id);
    } 
    // If selected is just a user (from search), create/access chat first
    else if (selected._id) {
       try {
         const { data } = await axiosInstance.post('/chat', { userId: selected._id });
         set({ selectedChatId: data._id, selectedChat: data });
         get().getMessages(data._id);
       } catch (error) {
         console.log(error);
       }
    }
  },

  getMessages: async (chatId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${chatId}`);
      set({ messages: res.data });
      
      const socket = useAuthStore.getState().socket;
      if (socket) {
        socket.emit('join chat', chatId);
      }
    } catch (error) {
      console.log('Error in getMessages:', error);
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  searchMessages: async (chatId, query) => {
    try {
      const res = await axiosInstance.get(`/messages/search/${chatId}?q=${query}`);
      return res.data;
    } catch (error) {
      console.log('Error searching messages:', error);
      throw error.response?.data?.error || 'Failed to search messages';
    }
  },

  sendMessage: async (messageData) => {
    const { selectedChatId, messages, replyingTo } = get();
    if (!selectedChatId) return;

    try {
      const payload = { ...messageData, chatId: selectedChatId };
      if (replyingTo) {
        payload.replyTo = replyingTo._id;
      }
      
      const res = await axiosInstance.post('/messages/send', payload);
      set({ messages: [...messages, res.data], replyingTo: null });
      // Optimistically sync sidebar preview immediately for the sender
      get().syncChatToTop(selectedChatId, res.data);
    } catch (error) {
      console.log('Error sending message:', error);
      throw error.response?.data?.error || 'Failed to send message';
    }
  },

  reactToMessage: async (messageId, emoji) => {
    try {
      const res = await axiosInstance.post(`/messages/${messageId}/react`, { emoji });
      
      // Update local state optimistically or wait for socket event. Let's update locally first.
      set((state) => {
        const updatedMessages = state.messages.map(msg => {
          if (msg._id === messageId) {
            return { ...msg, reactions: res.data.reactions };
          }
          return msg;
        });
        return { messages: updatedMessages };
      });
    } catch (error) {
      console.log('Error reacting to message:', error);
      throw error.response?.data?.error || 'Failed to react';
    }
  },

  deleteMessage: async (messageId) => {
    try {
      await axiosInstance.delete(`/messages/${messageId}`);
      const { messages } = get();
      set({ messages: messages.filter((msg) => msg._id !== messageId) });
    } catch (error) {
      console.log('Error deleting message:', error);
      throw error.response?.data?.error || 'Failed to delete message';
    }
  },

  deleteChat: async (chatId) => {
    try {
      await axiosInstance.delete(`/chat/${chatId}`);
      set({ selectedUser: null, selectedChatId: null, messages: [] });
      get().fetchChats();
    } catch (error) {
      console.log('Error deleting chat:', error);
      throw error.response?.data?.error || 'Failed to delete chat';
    }
  },

  chats: [],
  setChats: (chats) => set({ chats }),
  
  fetchChats: async () => {
    try {
      const { data } = await axiosInstance.get('/chat');
      set({ chats: data });
    } catch (error) {
      console.log('Error fetching chats:', error);
    }
  },

  updateGroupSettings: async (chatId, settingsData) => {
    try {
      const res = await axiosInstance.put(`/chat/${chatId}/settings`, settingsData);
      // Update both selectedUser and selectedChat so theme is always available
      set({ selectedUser: res.data, selectedChat: res.data });
      get().fetchChats();
      
      const socket = useAuthStore.getState().socket;
      if (socket && settingsData.chatName) {
        socket.emit('update-group-name', { chatId, newName: settingsData.chatName });
      }
    } catch (error) {
      console.log('Error updating group settings:', error);
      throw error.response?.data?.error || 'Failed to update settings';
    }
  },

  updateChatTheme: async (chatId, themeUrl) => {
    try {
      const res = await axiosInstance.patch(`/chat/${chatId}/theme`, { theme: themeUrl });
      set({ selectedUser: res.data, selectedChat: res.data });
      get().fetchChats();
    } catch (error) {
      console.log('Error updating chat theme:', error);
      throw error.response?.data?.error || 'Failed to update theme';
    }
  },

  updateNickname: async (chatId, userId, nickname) => {
    try {
      const res = await axiosInstance.patch(`/chat/${chatId}/nickname`, { userId, nickname });
      set({ selectedUser: res.data, selectedChat: res.data });
      get().fetchChats();
    } catch (error) {
      console.log('Error updating nickname:', error);
      throw error.response?.data?.error || 'Failed to update nickname';
    }
  },

  addMember: async (chatId, userId) => {
    try {
      const res = await axiosInstance.post(`/chat/${chatId}/member`, { userId });
      set({ selectedUser: res.data });
      get().fetchChats();
    } catch (error) {
      console.log('Error adding member:', error);
      throw error.response?.data?.error || 'Failed to add member';
    }
  },

  muteChat: async (chatId, duration) => {
    try {
      const res = await axiosInstance.patch(`/chat/${chatId}/mute`, { duration });
      set({ selectedUser: res.data, selectedChat: res.data });
      get().fetchChats();
    } catch (error) {
      console.log('Error muting chat:', error);
      throw error.response?.data?.error || 'Failed to mute chat';
    }
  },

  togglePinChat: async (chatId) => {
    try {
      const res = await axiosInstance.patch(`/chat/${chatId}/pin`);
      set({ selectedUser: res.data, selectedChat: res.data });
      get().fetchChats();
    } catch (error) {
      console.log('Error pinning chat:', error);
      throw error.response?.data?.error || 'Failed to pin chat';
    }
  },

  leaveGroup: async (chatId) => {
    try {
      await axiosInstance.post(`/chat/${chatId}/leave`);
      set({ selectedUser: null, selectedChatId: null, messages: [] });
      get().fetchChats();
    } catch (error) {
      console.log('Error leaving group:', error);
      throw error.response?.data?.error || 'Failed to leave group';
    }
  },

  kickMember: async (chatId, userId) => {
    try {
      const res = await axiosInstance.delete(`/chat/${chatId}/member/${userId}`);
      set({ selectedUser: res.data, selectedChat: res.data });
      get().fetchChats(); // Refresh sidebar list
    } catch (error) {
      console.log('Error kicking member:', error);
      throw error.response?.data?.error || 'Failed to kick member';
    }
  },

  joinGroup: async (chatId) => {
    try {
      const res = await axiosInstance.post(`/chat/${chatId}/join`);
      set({ selectedUser: res.data, selectedChatId: res.data._id });
      get().fetchChats();
      get().getMessages(res.data._id);
    } catch (error) {
      console.log('Error joining group:', error);
      throw error.response?.data?.error || 'Failed to join group';
    }
  },

  subscribeToMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.on('newMessage', (newMessage) => {
      const incomingChatId = newMessage.chatId?._id ?? newMessage.chatId;

      // 1. Always sync sidebar for any chat (even if not active)
      get().syncChatToTop(incomingChatId, newMessage);

      // --- NOTIFICATION LOGIC ---
      const authUser = useAuthStore.getState().authUser;
      if (newMessage.senderId?._id !== authUser?._id && newMessage.senderId !== authUser?._id) {
        const chat = get().chats.find(c => c._id === incomingChatId);
        let isMuted = false;
        
        if (chat && chat.mutedUntil) {
          const mutedUntilMap = chat.mutedUntil || {};
          const mutedUntil = mutedUntilMap[authUser?._id];
          if (mutedUntil && new Date() < new Date(mutedUntil)) {
            isMuted = true;
          }
        }
        
        if (!isMuted && useAuthStore.getState().messageSounds) {
          // Play a simple beep using Web Audio API
          try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.3);
            osc.stop(ctx.currentTime + 0.3);
          } catch (error) {
            console.log('Audio playback failed', error);
          }
        }
      }

      // 2. Append to messages list only if this is the active chat
      if (incomingChatId === get().selectedChatId) {
        set((state) => {
          if (state.messages.some(m => m._id === newMessage._id)) return state;
          return { messages: [...state.messages, newMessage] };
        });
      }
    });

    socket.on('messageDeleted', (deletedMessageId) => {
      set((state) => ({
        messages: state.messages.filter((msg) => msg._id !== deletedMessageId)
      }));
    });
    
    socket.on('messageReacted', ({ messageId, reactions }) => {
      set((state) => {
        const updatedMessages = state.messages.map(msg => {
          if (msg._id === messageId) {
            return { ...msg, reactions };
          }
          return msg;
        });
        return { messages: updatedMessages };
      });
    });
    
    socket.on('typing', () => {
       set({ typingUserId: true });
    });

    socket.on('stopTyping', () => {
       set({ typingUserId: null });
    });

    socket.on('group-name-updated', ({ chatId, newName }) => {
      // Update the chat name in the sidebar list
      set((state) => ({
        chats: state.chats.map(c =>
          c._id === chatId ? { ...c, chatName: newName } : c
        ),
      }));
      const { selectedUser } = get();
      if (selectedUser && selectedUser._id === chatId) {
         set({ selectedUser: { ...selectedUser, chatName: newName } });
      }
    });

    socket.on('group-updated', (updatedChat) => {
      set((state) => ({
        chats: state.chats.map(c => c._id === updatedChat._id ? updatedChat : c),
      }));
      const { selectedChatId } = get();
      if (selectedChatId === updatedChat._id) {
        set({ selectedUser: updatedChat, selectedChat: updatedChat });
      }
    });

    socket.on('nickname-updated', (updatedChat) => {
      set((state) => ({
        chats: state.chats.map(c => c._id === updatedChat._id ? updatedChat : c),
      }));
      const { selectedChatId } = get();
      if (selectedChatId === updatedChat._id) {
        set({ selectedUser: updatedChat, selectedChat: updatedChat });
      }
    });

    socket.on('user-profile-updated', (updatedUser) => {
      set((state) => {
        const updatedChats = state.chats.map(chat => {
          if (chat.users) {
            const friendIndex = chat.users.findIndex(u => u._id === updatedUser._id);
            if (friendIndex >= 0) {
              const newUsers = [...chat.users];
              newUsers[friendIndex] = { ...newUsers[friendIndex], ...updatedUser };
              return { ...chat, users: newUsers };
            }
          }
          return chat;
        });

        let nextSelectedUser = state.selectedUser;
        if (nextSelectedUser && nextSelectedUser.users) {
           const friendIndex = nextSelectedUser.users.findIndex(u => u._id === updatedUser._id);
           if (friendIndex >= 0) {
              const newUsers = [...nextSelectedUser.users];
              newUsers[friendIndex] = { ...newUsers[friendIndex], ...updatedUser };
              nextSelectedUser = { ...nextSelectedUser, users: newUsers };
           }
        }

        return { chats: updatedChats, selectedUser: nextSelectedUser, selectedChat: nextSelectedUser };
      });
    });

    socket.on('member-kicked', ({ chatId }) => {
      set((state) => ({
        chats: state.chats.filter(c => c._id !== chatId),
      }));
      const { selectedChatId } = get();
      if (selectedChatId === chatId) {
        set({ selectedUser: null, selectedChat: null, selectedChatId: null, messages: [] });
      }
    });

    socket.on('chat-deleted', (chatId) => {
      set((state) => ({
        chats: state.chats.filter(c => c._id !== chatId),
      }));
      const { selectedChatId } = get();
      if (selectedChatId === chatId) {
        set({ selectedUser: null, selectedChat: null, selectedChatId: null, messages: [] });
      }
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if(socket) {
      socket.off('newMessage');
      socket.off('messageDeleted');
      socket.off('typing');
      socket.off('stopTyping');
      socket.off('group-name-updated');
      socket.off('group-updated');
      socket.off('member-added');
      socket.off('user-profile-updated');
      socket.off('member-kicked');
      socket.off('chat-deleted');
      socket.off('nickname-updated');
    }
  },
}));
