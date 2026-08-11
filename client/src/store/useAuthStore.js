import { create } from 'zustand';
import { axiosInstance } from '../lib/axios.js';
import io from 'socket.io-client';

const BASE_URL = 'http://localhost:5000';

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,
  friends: [],
  blockedUsers: [],
  messageSounds: true,
  setMessageSounds: (val) => set({ messageSounds: val }),

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get('/auth/check');
      set({ authUser: res.data });
      get().connectSocket();
    } catch (error) {
      console.log('Error in checkAuth:', error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post('/auth/signup', data);
      set({ authUser: res.data });
      get().connectSocket();
    } catch (error) {
      throw error.response?.data?.error || error.message || 'Signup failed';
    } finally {
      set({ isSigningUp: false });
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post('/auth/login', data);
      set({ authUser: res.data });
      get().connectSocket();
    } catch (error) {
      throw error.response?.data?.error || error.message || 'Login failed';
    } finally {
      set({ isLoggingIn: false });
    }
  },

  socialLogin: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post('/auth/social', data);
      set({ authUser: res.data });
      get().connectSocket();
    } catch (error) {
      throw error.response?.data?.error || error.message || 'Social login failed';
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post('/auth/logout');
      set({ authUser: null });
      get().disconnectSocket();
    } catch (error) {
      console.log(error);
    }
  },

  fetchFriends: async () => {
    try {
      const res = await axiosInstance.get('/users/friends');
      set({ friends: res.data });
    } catch (error) {
      console.log('Error fetching friends:', error);
    }
  },

  addFriend: async (friendId) => {
    try {
      const res = await axiosInstance.post('/users/add-friend', { friendId });
      set((state) => {
        // Prevent duplicates
        if (state.friends.some((f) => f._id === res.data.newFriend._id)) return state;
        return { friends: [...state.friends, res.data.newFriend] };
      });
    } catch (error) {
      console.log('Error adding friend:', error);
    }
  },

  unfriendUser: async (friendId) => {
    try {
      await axiosInstance.post('/users/unfriend', { friendId });
      get().fetchFriends();
    } catch (error) {
      console.log('Error unfriending user:', error);
    }
  },

  fetchBlockedUsers: async () => {
    try {
      const res = await axiosInstance.get('/users/blocked');
      set({ blockedUsers: res.data });
    } catch (error) {
      console.log('Error fetching blocked users:', error);
    }
  },

  blockUser: async (userIdToBlock) => {
    try {
      await axiosInstance.patch('/users/block', { userIdToBlock });
      get().fetchBlockedUsers();
      get().fetchFriends();
    } catch (error) {
      console.log('Error blocking user:', error);
    }
  },

  unblockUser: async (userIdToUnblock) => {
    try {
      await axiosInstance.post('/users/unblock', { userIdToUnblock });
      get().fetchBlockedUsers();
    } catch (error) {
      console.log('Error unblocking user:', error);
    }
  },

  updateProfile: async (profileData) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put('/users/profile', profileData);
      set({ authUser: res.data });
      return res.data;
    } catch (error) {
      console.log('Error updating profile:', error);
      throw error.response?.data?.error || 'Failed to update profile';
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  updatePassword: async (oldPassword, newPassword) => {
    try {
      await axiosInstance.put('/users/password', { oldPassword, newPassword });
    } catch (error) {
      console.log('Error updating password:', error);
      throw error.response?.data?.error;
    }
  },

  connectSocket: () => {
    const { authUser } = get();
    if (!authUser || get().socket?.connected) return;

    if (get().socket) {
      get().socket.disconnect();
    }

    const socket = io(BASE_URL, {
      query: { userId: authUser._id },
    });
    socket.connect();
    set({ socket: socket });

    socket.on('getOnlineUsers', (userIds) => {
      set({ onlineUsers: userIds });
    });

    socket.on('new-friend-added', (newFriend) => {
      set((state) => {
        if (state.friends.some((f) => f._id === newFriend._id)) return state;
        return { friends: [...state.friends, newFriend] };
      });
    });
  },

  disconnectSocket: () => {
    if (get().socket) {
      get().socket.off('getOnlineUsers');
      get().socket.off('new-friend-added');
      get().socket.disconnect();
    }
    set({ socket: null, onlineUsers: [] });
  },
}));
