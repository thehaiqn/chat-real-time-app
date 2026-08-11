import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema(
  {
    chatName: {
      type: String,
      trim: true,
    },
    isGroupChat: {
      type: Boolean,
      default: false,
    },
    users: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    latestMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
    },
    groupAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    nicknames: {
      type: Map,
      of: String,
      default: {},
    },
    groupAvatar: {
      type: String,
      default: '',
    },
    theme: {
      type: String,
      default: 'default',
    },
    mutedUntil: {
      type: Map,
      of: Date,
      default: {},
    },
    clearedHistory: {
      type: Map,
      of: Date,
      default: {},
    },
    pinnedBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    permissions: {
      canChangeNameAvatar: { type: Boolean, default: true },
      canPinMessages: { type: Boolean, default: true },
      canCreateNotes: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

export default mongoose.model('Chat', chatSchema);
