import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';
import toast from 'react-hot-toast';

// Configuration for WebRTC
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
  ],
};

let peerConnection = null;
let localStreamInstance = null;
let groupPeers = {}; // { userId: RTCPeerConnection }

export const useCallStore = create((set, get) => ({
  callState: 'idle', // 'idle', 'calling', 'receiving', 'active'
  incomingCall: null, // { from: userId, name: string, signal: any, type: 'video' | 'voice' }
  callType: 'video', // 'video' | 'voice'
  remoteStream: null,
  localStream: null,
  callerName: '',
  remoteUserId: null, // Who we are calling or receiving call from

  // Group Call State
  isGroupCall: false,
  activeGroupChatId: null,
  remoteStreams: {}, // { [userId]: MediaStream }
  groupParticipants: {}, // { [userId]: { name, profilePic, hasVideo } }

  setCallState: (state) => set({ callState: state }),
  setIncomingCall: (callInfo) => set({ incomingCall: callInfo }),
  
  initializeCallListeners: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    // Avoid duplicate listeners
    socket.off("call-received");
    socket.off("call-accepted");
    socket.off("ice-candidate");
    socket.off("call-ended");

    socket.on("call-received", async (data) => {
      // data: { signal, from, name, type }
      if (get().callState !== 'idle') {
        // Already in a call, ignore or send busy (for now, ignore)
        return;
      }
      set({ 
        callState: 'receiving', 
        incomingCall: data, 
        callType: data.type,
        callerName: data.name,
        remoteUserId: data.from,
        isGroupCall: false
      });
    });

    socket.on("call-accepted", async (signal) => {
      set({ callState: 'active' });
      if (peerConnection) {
        try {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(signal));
        } catch (e) {
          console.error("Error setting remote description on call-accepted", e);
        }
      }
    });

    socket.on("ice-candidate", async (candidate) => {
      if (peerConnection) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding ice candidate', e);
        }
      }
    });

    socket.on("call-ended", () => {
      get().endCall(false); // false means don't emit end-call again
    });

    // --- Group Call Listeners ---
    socket.on("group-call-started", (data) => {
      if (get().callState !== 'idle') return;
      set({ 
        callState: 'receiving', 
        incomingCall: {
          from: data.from,
          name: data.name,
          type: data.type,
          chatId: data.chatId,
          isGroup: true
        },
        callType: data.type,
        callerName: data.name,
        remoteUserId: data.from,
        isGroupCall: true,
        activeGroupChatId: data.chatId
      });
    });

    socket.on("user-joined-group-call", async (data) => {
      const { isGroupCall, callType, localStream } = get();
      if (!isGroupCall) return;
      const authUser = useAuthStore.getState().authUser;

      try {
        const pc = new RTCPeerConnection(configuration);
        if (localStream) {
          localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
        }

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            socket.emit("group-ice-candidate", { to: data.from, from: authUser._id, candidate: e.candidate });
          }
        };

        pc.ontrack = (e) => {
          set((state) => ({
            remoteStreams: { ...state.remoteStreams, [data.from]: e.streams[0] }
          }));
        };

        set((state) => ({
          groupParticipants: { ...state.groupParticipants, [data.from]: { name: data.name } }
        }));
        groupPeers[data.from] = pc;

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        socket.emit("group-offer", {
          to: data.from,
          from: authUser._id,
          name: authUser.username || authUser.fullName,
          type: callType,
          signal: offer
        });
      } catch (err) {
        console.error("Error creating group offer", err);
      }
    });

    socket.on("group-offer-received", async (data) => {
      const { isGroupCall, localStream } = get();
      if (!isGroupCall) return;
      const authUser = useAuthStore.getState().authUser;

      try {
        const pc = new RTCPeerConnection(configuration);
        if (localStream) {
          localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
        }

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            socket.emit("group-ice-candidate", { to: data.from, from: authUser._id, candidate: e.candidate });
          }
        };

        pc.ontrack = (e) => {
          set((state) => ({
            remoteStreams: { ...state.remoteStreams, [data.from]: e.streams[0] }
          }));
        };

        set((state) => ({
          groupParticipants: { ...state.groupParticipants, [data.from]: { name: data.name } }
        }));
        groupPeers[data.from] = pc;

        await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        socket.emit("group-answer", {
          to: data.from,
          from: authUser._id,
          signal: answer
        });
      } catch (err) {
        console.error("Error handling group offer", err);
      }
    });

    socket.on("group-answer-received", async (data) => {
      const pc = groupPeers[data.from];
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.signal));
        } catch (e) {
          console.error("Error setting group remote description", e);
        }
      }
    });

    socket.on("group-ice-candidate-received", async (data) => {
      const pc = groupPeers[data.from];
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (e) {
          console.error("Error adding group ice candidate", e);
        }
      }
    });

    socket.on("user-left-group-call", (data) => {
      get().removePeer(data.from);
    });
  },

  startCall: async (remoteUserId, name, type = 'video') => {
    set({ callState: 'calling', callType: type, callerName: name, remoteUserId, isGroupCall: false });
    const socket = useAuthStore.getState().socket;
    const authUser = useAuthStore.getState().authUser;

    const createBlackVideoTrack = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d");
        const drawBlack = () => {
          ctx.fillStyle = "black";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          requestAnimationFrame(drawBlack);
        };
        drawBlack();
        const stream = canvas.captureStream ? canvas.captureStream(15) : null;
        return stream ? stream.getVideoTracks()[0] : null;
      } catch (e) {
        console.warn("Could not create black video track", e);
        return null;
      }
    };

    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: type === 'video', 
          audio: true 
        });
        if (type === 'voice') {
          const blackTrack = createBlackVideoTrack();
          if (blackTrack) {
            blackTrack.enabled = false;
            stream.addTrack(blackTrack);
          }
        }
      } catch (err) {
        console.warn("Could not access camera, falling back to audio only", err);
        if (type === 'video') {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            const blackTrack = createBlackVideoTrack();
            if (blackTrack) stream.addTrack(blackTrack);
          } catch (audioErr) {
            toast.error("Microphone is required for calling.");
            throw audioErr;
          }
        } else {
          toast.error("Microphone is required for a voice call.");
          throw err;
        }
      }

      localStreamInstance = stream;
      set({ localStream: stream });

      peerConnection = new RTCPeerConnection(configuration);

      // Add local tracks to peer connection
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            to: remoteUserId,
            candidate: event.candidate,
          });
        }
      };

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        set({ remoteStream: event.streams[0] });
      };

      // Create offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      socket.emit("call-user", {
        userToCall: remoteUserId,
        signalData: offer,
        from: authUser._id,
        name: authUser.username || authUser.fullName,
        type
      });

    } catch (err) {
      console.error("Error starting call:", err);
      get().endCall();
    }
  },

  acceptCall: async () => {
    const { incomingCall } = get();
    if (!incomingCall) return;

    if (incomingCall.isGroup) {
      get().joinGroupCall(incomingCall.chatId, incomingCall.type);
      return;
    }

    set({ callState: 'active' });
    const socket = useAuthStore.getState().socket;
    const authUser = useAuthStore.getState().authUser;

    const createBlackVideoTrack = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d");
        const drawBlack = () => {
          ctx.fillStyle = "black";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          requestAnimationFrame(drawBlack);
        };
        drawBlack();
        const stream = canvas.captureStream ? canvas.captureStream(15) : null;
        return stream ? stream.getVideoTracks()[0] : null;
      } catch (e) {
        console.warn("Could not create black video track", e);
        return null;
      }
    };

    try {
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: incomingCall.type === 'video', 
          audio: true 
        });
        if (incomingCall.type === 'voice') {
          const blackTrack = createBlackVideoTrack();
          if (blackTrack) {
            blackTrack.enabled = false;
            stream.addTrack(blackTrack);
          }
        }
      } catch (err) {
        console.warn("Could not access camera, falling back to audio only", err);
        if (incomingCall.type === 'video') {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            const blackTrack = createBlackVideoTrack();
            if (blackTrack) stream.addTrack(blackTrack);
          } catch (audioErr) {
            toast.error("Microphone is required to answer the call.");
            throw audioErr;
          }
        } else {
          toast.error("Microphone is required for a voice call.");
          throw err;
        }
      }

      localStreamInstance = stream;
      set({ localStream: stream });

      peerConnection = new RTCPeerConnection(configuration);

      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            to: incomingCall.from,
            candidate: event.candidate,
          });
        }
      };

      peerConnection.ontrack = (event) => {
        set({ remoteStream: event.streams[0] });
      };

      await peerConnection.setRemoteDescription(new RTCSessionDescription(incomingCall.signal));
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      socket.emit("answer-call", {
        to: incomingCall.from,
        signal: answer
      });

    } catch (err) {
      console.error("Error accepting call:", err);
      get().endCall();
    }
  },

  endCall: (emitEvent = true) => {
    const { remoteUserId, incomingCall } = get();
    const socket = useAuthStore.getState().socket;
    
    // Determine the peer to send end-call to
    const peerId = remoteUserId || incomingCall?.from;

    if (emitEvent && peerId && socket) {
      socket.emit("end-call", { to: peerId });
    }

    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }

    if (localStreamInstance) {
      localStreamInstance.getTracks().forEach(track => track.stop());
      localStreamInstance = null;
    }

    set({
      callState: 'idle',
      incomingCall: null,
      remoteStream: null,
      localStream: null,
      callerName: '',
      remoteUserId: null,
      isGroupCall: false,
      activeGroupChatId: null,
      remoteStreams: {},
      groupParticipants: {}
    });
  },

  // --- Group Call Methods ---
  startGroupCall: async (chatId, chatName, type = 'video') => {
    set({ 
      callState: 'active', 
      callType: type, 
      isGroupCall: true,
      activeGroupChatId: chatId,
      remoteStreams: {},
      groupParticipants: {}
    });
    const socket = useAuthStore.getState().socket;
    const authUser = useAuthStore.getState().authUser;

    const createBlackVideoTrack = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d");
        const drawBlack = () => {
          ctx.fillStyle = "black";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          requestAnimationFrame(drawBlack);
        };
        drawBlack();
        const stream = canvas.captureStream ? canvas.captureStream(15) : null;
        return stream ? stream.getVideoTracks()[0] : null;
      } catch (e) {
        return null;
      }
    };

    try {
      let stream = await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true });
      if (type === 'voice') {
        const blackTrack = createBlackVideoTrack();
        if (blackTrack) {
          blackTrack.enabled = false;
          stream.addTrack(blackTrack);
        }
      }
      localStreamInstance = stream;
      set({ localStream: stream });
      
      socket.emit("start-group-call", {
        chatId,
        type,
        from: authUser._id,
        name: authUser.username || authUser.fullName
      });
      
      // Emitting join to let others know we are ready to receive offers
      socket.emit("join-group-call", {
        chatId,
        from: authUser._id,
        name: authUser.username || authUser.fullName
      });
      
    } catch (err) {
      console.error("Error starting group call:", err);
      toast.error("Microphone is required for calling.");
      get().endCall();
    }
  },

  joinGroupCall: async (chatId, type = 'video') => {
    set({ 
      callState: 'active', 
      callType: type, 
      isGroupCall: true,
      activeGroupChatId: chatId,
      remoteStreams: {},
      groupParticipants: {}
    });
    const socket = useAuthStore.getState().socket;
    const authUser = useAuthStore.getState().authUser;

    const createBlackVideoTrack = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 480;
        const ctx = canvas.getContext("2d");
        const drawBlack = () => {
          ctx.fillStyle = "black";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          requestAnimationFrame(drawBlack);
        };
        drawBlack();
        const stream = canvas.captureStream ? canvas.captureStream(15) : null;
        return stream ? stream.getVideoTracks()[0] : null;
      } catch (e) {
        return null;
      }
    };

    try {
      let stream = await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true });
      if (type === 'voice') {
        const blackTrack = createBlackVideoTrack();
        if (blackTrack) {
          blackTrack.enabled = false;
          stream.addTrack(blackTrack);
        }
      }
      localStreamInstance = stream;
      set({ localStream: stream });
      
      socket.emit("join-group-call", {
        chatId,
        from: authUser._id,
        name: authUser.username || authUser.fullName
      });
      
    } catch (err) {
      console.error("Error joining group call:", err);
      toast.error("Microphone is required for calling.");
      get().endCall();
    }
  },

  removePeer: (userId) => {
    if (groupPeers[userId]) {
      groupPeers[userId].close();
      delete groupPeers[userId];
    }
    set((state) => {
      const newRemoteStreams = { ...state.remoteStreams };
      delete newRemoteStreams[userId];
      const newGroupParticipants = { ...state.groupParticipants };
      delete newGroupParticipants[userId];
      return {
        remoteStreams: newRemoteStreams,
        groupParticipants: newGroupParticipants
      };
    });
  },

  endGroupCall: () => {
    const { activeGroupChatId } = get();
    const socket = useAuthStore.getState().socket;
    const authUser = useAuthStore.getState().authUser;

    if (activeGroupChatId && socket) {
      socket.emit("leave-group-call", { chatId: activeGroupChatId, from: authUser._id });
    }

    Object.values(groupPeers).forEach(pc => pc.close());
    groupPeers = {};

    if (localStreamInstance) {
      localStreamInstance.getTracks().forEach(track => track.stop());
      localStreamInstance = null;
    }

    set({
      callState: 'idle',
      isGroupCall: false,
      activeGroupChatId: null,
      remoteStreams: {},
      groupParticipants: {},
      localStream: null
    });
  },

  enableCamera: async () => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const newVideoTrack = newStream.getVideoTracks()[0];
      
      const { localStream } = get();
      const oldVideoTrack = localStream?.getVideoTracks()[0];
      
      if (localStream) {
        if (oldVideoTrack) {
          localStream.removeTrack(oldVideoTrack);
          oldVideoTrack.stop();
        }
        localStream.addTrack(newVideoTrack);
      }
      
      if (peerConnection) {
        const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(newVideoTrack);
        } else {
          peerConnection.addTrack(newVideoTrack, localStream);
        }
      }
      
      set({ callType: 'video' });
    } catch (err) {
      console.error("Failed to enable camera", err);
      toast.error("Could not access camera.");
      throw err;
    }
  }
}));
