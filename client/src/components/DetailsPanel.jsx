import { useState, useRef, useEffect } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import {
  BellOff,
  Palette,
  Smile,
  Users,
  UserPlus,
  Search,
  LogOut,
  QrCode,
  Edit2,
  Check,
  Copy,
  Image as ImageIcon,
  ShieldAlert,
  Trash2,
  Mail,
  Phone,
  Video,
  User,
  X,
  Pin,
  Bell,
  Settings,
  Lock,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Link as LinkIcon,
  File as FileIcon
} from "lucide-react";
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { QRCodeSVG } from "qrcode.react";
import NotificationToggle from "./NotificationToggle";
import s from "../styles/DetailsPanel.module.css";
import CreateGroupModal from "./CreateGroupModal";

const DetailsPanel = () => {
  const {
    selectedUser,
    deleteChat,
    muteChat,
    updateNickname,
    updateGroupSettings,
    updateChatTheme,
    addMember,
    leaveGroup,
    kickMember,
    setSelectedUser,
    selectedChatId,
    togglePinChat,
    messages,
  } = useChatStore();

  const { authUser, friends, blockUser, addFriend, unfriendUser } =
    useAuthStore();

  /* ---- local modal state ---- */
  const [showMuteModal, setShowMuteModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberId, setNewMemberId] = useState("");
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [editingNicknames, setEditingNicknames] = useState({});
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showGroupManagementModal, setShowGroupManagementModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  
  // Storage view state
  const [showStorageView, setShowStorageView] = useState(false);
  const [storageTab, setStorageTab] = useState('media'); // 'media', 'files', 'links'
  const [expandedSections, setExpandedSections] = useState({
    media: true,
    files: false,
    links: false
  });

  const [localMuted, setLocalMuted] = useState(false);
  const [localPermissions, setLocalPermissions] = useState({
    canChangeNameAvatar: true,
    canPinMessages: true,
    canCreateNotes: true,
  });

  useEffect(() => {
    if (selectedUser) {
      const mutedUntilMap = selectedUser.mutedUntil || {};
      const mutedUntil = mutedUntilMap[useAuthStore.getState().authUser?._id];
      const isMuted = mutedUntil && new Date(mutedUntil) > new Date();
      setLocalMuted(isMuted);

      if (selectedUser.isGroupChat) {
        setLocalPermissions({
          canChangeNameAvatar: selectedUser.permissions?.canChangeNameAvatar ?? true,
          canPinMessages: selectedUser.permissions?.canPinMessages ?? true,
          canCreateNotes: selectedUser.permissions?.canCreateNotes ?? true,
        });
      }
    }
  }, [selectedUser]);

  const fileInputRef = useRef(null);

  if (!selectedUser) return null;

  /* ---- helpers ---- */
  const getDisplayName = (chat, member) => {
    return chat?.nicknames?.[member._id] || member.username;
  };

  /* ---- derived values ---- */
  const isGroup = selectedUser.isGroupChat;
  const name = isGroup ? selectedUser.chatName : selectedUser.username;
  const pic = isGroup ? selectedUser.groupAvatar : selectedUser.profilePic;
  const isAdmin = isGroup && selectedUser.groupAdmin?._id === authUser?._id;
  const friendId = isGroup
    ? null
    : selectedUser.users
      ? selectedUser.users.find((u) => u._id !== authUser?._id)?._id
      : selectedUser._id;
  const isFriend = !isGroup && friends.some((f) => f._id === friendId);

  const mutedUntilMap = selectedUser.mutedUntil || {};
  const mutedUntil = mutedUntilMap[authUser?._id];
  const isMuted = mutedUntil && new Date(mutedUntil) > new Date();
  const isPinned = selectedUser.pinnedBy?.includes(authUser?._id);
  const inviteLink = `${window.location.origin}/join-group/${selectedUser._id}`;
  
  const canChangeNameAvatar = selectedUser.permissions?.canChangeNameAvatar !== false;
  const showEditName = isAdmin || canChangeNameAvatar;

  const handleToggleMute = async () => {
    if (localMuted) {
      setLocalMuted(false); // Optimistic UI switch
      await muteChat(selectedChatId, null);
    } else {
      setLocalMuted(true); // Optimistic UI switch
      setShowMuteModal(true);
    }
  };

  const handleMute = (hours) => {
    let duration = null;
    if (hours > 0) {
      duration = hours * 60 * 60 * 1000;
    } else if (hours === -1) {
      duration = -1;
    }
    muteChat(selectedChatId, duration);
    setShowMuteModal(false);
  };

  const handleAddMember = () => {
    if (!newMemberId) return;
    addMember(selectedChatId, newMemberId);
    setShowAddMemberModal(false);
    setNewMemberId("");
  };

  const handleKickMember = async (userId) => {
    if (window.confirm("Are you sure you want to kick this member?")) {
      await kickMember(selectedChatId, userId);
    }
  };

  const handleBlock = async () => {
    if (friendId) {
      await blockUser(friendId);
      setSelectedUser(null);
    }
  };

  const handleLeaveGroup = async () => {
    if (isAdmin) {
      if (
        !window.confirm(
          "You are the Admin. Leaving will transfer Admin rights to another member. Confirm?",
        )
      ) {
        return;
      }
    } else {
      if (!window.confirm("Are you sure you want to leave this group?")) {
        return;
      }
    }
    await leaveGroup(selectedChatId);
  };

  const handleUpdateGroupSettings = async (e) => {
    try {
      if (!newGroupName.trim()) return;
      await updateGroupSettings(selectedChatId, { chatName: newGroupName });
      setShowRenameModal(false);
      setNewGroupName("");
    } catch (error) {
      console.log("Error updating group name:", error);
    }
  };

  const handleUpdatePermissions = async (newPermissions) => {
    setLocalPermissions(newPermissions); // optimistic UI
    try {
      await updateGroupSettings(selectedChatId, { permissions: newPermissions });
    } catch (error) {
      console.log("Error updating permissions:", error);
      // Revert on error could be added here
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateGroupSettings(selectedChatId, { groupAvatar: reader.result });
      setShowThemeModal(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveNickname = (userId) => {
    const nick = editingNicknames[userId];
    if (nick === undefined) return;
    updateNickname(selectedChatId, userId, nick);
    setEditingNicknames((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(inviteLink);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const closeMuteModal = () => {
    setShowMuteModal(false);
    setLocalMuted(isMuted); // Revert if user cancels
  };
  const closeNicknameModal = () => {
    setShowNicknameModal(false);
    setEditingNicknames({});
  };
  const closeRenameModal = () => setShowRenameModal(false);
  const closeInviteModal = () => setShowInviteModal(false);
  const closeThemeModal = () => setShowThemeModal(false);
  const closeAddMemberModal = () => setShowAddMemberModal(false);
  const closeGroupManagementModal = () => setShowGroupManagementModal(false);

  /* ---- non-group friends filtered for add-member list ---- */
  const eligibleFriends = friends.filter(
    (f) => !selectedUser.users?.some((u) => u._id === f._id),
  );

  /* ---- Extract Media from messages ---- */
  const extractMedia = () => {
    const images = [];
    const links = [];
    const urlRegex = /(https?:\/\/[^\s]+)/g;

    messages.forEach(msg => {
      // images
      if (msg.image) {
        images.push(msg);
      } else if (msg.messageType === 'image') {
        images.push(msg); // fallback
      }
      
      // links
      if (msg.text) {
        const found = msg.text.match(urlRegex);
        if (found) {
          found.forEach(link => {
            links.push({ ...msg, linkUrl: link });
          });
        }
      }
    });

    return { images, links };
  };

  const { images, links } = extractMedia();

  // Group images by date
  const groupedImages = images.reduce((acc, img) => {
    const dateStr = format(new Date(img.createdAt), 'dd MMMM yyyy', { locale: vi });
    const key = `Ngày ${dateStr}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(img);
    return acc;
  }, {});

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  /* ==================================================================
     RENDER
     ================================================================== */
  if (showStorageView) {
    return (
      <div className={`${s.panel} bg-white flex flex-col h-full absolute inset-0 z-50`}>
        <div className="flex items-center p-4 border-b border-gray-100">
          <button onClick={() => setShowStorageView(false)} className="mr-4 hover:bg-gray-100 p-2 rounded-full transition-colors">
            <ChevronLeft className="size-5" />
          </button>
          <h2 className="text-lg font-bold flex-1 text-center">Kho lưu trữ</h2>
          <button className="text-brand-red text-sm font-medium p-2">Chọn</button>
        </div>

        <div className="flex border-b border-gray-100">
          <button 
            className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${storageTab === 'media' ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setStorageTab('media')}
          >
            Ảnh/Video
          </button>
          <button 
            className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${storageTab === 'files' ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setStorageTab('files')}
          >
            Files
          </button>
          <button 
            className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${storageTab === 'links' ? 'border-brand-red text-brand-red' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            onClick={() => setStorageTab('links')}
          >
            Links
          </button>
        </div>

        <div className="p-3 flex gap-2 border-b border-gray-50">
          <select className="bg-gray-100 rounded-full px-3 py-1.5 text-xs font-medium text-gray-700 outline-none">
            <option>Người gửi</option>
          </select>
          <select className="bg-gray-100 rounded-full px-3 py-1.5 text-xs font-medium text-gray-700 outline-none">
            <option>Ngày gửi</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50 p-2">
          {storageTab === 'media' && (
            images.length === 0 ? (
              <div className="text-center text-gray-500 mt-10 text-sm">Chưa có Ảnh/Video được chia sẻ trong hội thoại này</div>
            ) : (
              Object.entries(groupedImages).map(([dateLabel, imgs]) => (
                <div key={dateLabel} className="bg-white rounded-lg shadow-sm mb-3 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-50">
                    <h3 className="text-sm font-bold text-gray-800">{dateLabel}</h3>
                  </div>
                  <div className="p-2 grid grid-cols-4 gap-1">
                    {imgs.map(img => (
                      <div key={img._id} className="aspect-square bg-gray-100 rounded cursor-pointer hover:opacity-80 transition-opacity">
                        <img src={img.image} alt="shared" className="w-full h-full object-cover rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )
          )}

          {storageTab === 'files' && (
            <div className="text-center text-gray-500 mt-10 text-sm">
              Chưa có File được chia sẻ trong hội thoại này
            </div>
          )}

          {storageTab === 'links' && (
            links.length === 0 ? (
              <div className="text-center text-gray-500 mt-10 text-sm">Chưa có Link được chia sẻ trong hội thoại này</div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm">
                {links.map((linkMsg, idx) => (
                  <div key={idx} className="p-3 border-b border-gray-50 hover:bg-gray-50 flex flex-col gap-1 cursor-pointer">
                    <span className="text-brand-red text-sm font-medium line-clamp-1">{linkMsg.linkUrl}</span>
                    <span className="text-xs text-gray-500 flex justify-between">
                      <span>{linkMsg.senderId?.username}</span>
                      <span>{format(new Date(linkMsg.createdAt), 'dd/MM/yyyy')}</span>
                    </span>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`${s.panel} relative`}>
      {/* ── Header ── */}
      <div className={s.header}>
        <div className={s.avatarContainer}>
          {pic ? (
            <img src={pic} alt={name} className={s.avatarImage} />
          ) : (
            name?.charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex items-center gap-2 justify-center w-full relative">
          <h3 className={s.userName}>{name}</h3>
          {isGroup && showEditName && (
            <button onClick={() => setShowRenameModal(true)} className={s.editNameIcon} title="Change Group Name">
              <Edit2 className="size-4" />
            </button>
          )}
        </div>

        {/* ── Action Row (Zalo-style) ── */}
        <div className={s.actionRow}>
          <button onClick={handleToggleMute} className={s.actionItem}>
            <div className={s.actionIconWrapper}>
              {localMuted ? <BellOff className="size-5" /> : <Bell className="size-5" />}
            </div>
            <span className={s.actionLabel}>{localMuted ? "Bật thông báo" : "Tắt thông báo"}</span>
          </button>

          <button onClick={() => togglePinChat(selectedChatId)} className={s.actionItem}>
            <div className={s.actionIconWrapper}>
              <Pin className="size-5" fill={isPinned ? "currentColor" : "none"} />
            </div>
            <span className={s.actionLabel}>{isPinned ? "Bỏ ghim" : "Ghim hội thoại"}</span>
          </button>

          {isGroup && (
            <button onClick={() => setShowAddMemberModal(true)} className={s.actionItem}>
              <div className={s.actionIconWrapper}>
                <UserPlus className="size-5" />
              </div>
              <span className={s.actionLabel}>Thêm thành viên</span>
            </button>
          )}

          {isGroup && isAdmin && (
            <button onClick={() => setShowGroupManagementModal(true)} className={s.actionItem}>
              <div className={s.actionIconWrapper}>
                <Settings className="size-5" />
              </div>
              <span className={s.actionLabel}>Quản lý nhóm</span>
            </button>
          )}
          
          {!isGroup && friendId && (
            <button onClick={() => setShowCreateGroupModal(true)} className={s.actionItem}>
              <div className={s.actionIconWrapper}>
                <UserPlus className="size-5" />
              </div>
              <span className={s.actionLabel}>Tạo nhóm trò chuyện</span>
            </button>
          )}
        </div>

        {!isGroup && selectedUser.bio && (
          <div className="mt-4 flex flex-col items-center">
            <p className="text-sm text-gray-500 text-center mb-2">
              {selectedUser.bio}
            </p>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className={s.contentSection}>
        {/* User Information */}
        {!isGroup && (
          <section className="mb-4">
            <h4 className={s.sectionTitle}>Thông tin người dùng</h4>
            <div className="bg-white rounded-xl p-4 flex flex-col gap-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <Mail className="size-4 text-gray-500" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                    EMAIL
                  </span>
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {selectedUser?.email}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <Phone className="size-4 text-gray-500" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                    ĐIỆN THOẠI
                  </span>
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {selectedUser?.phone ||
                      selectedUser?.phoneNumber ||
                      "Chưa cập nhật"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                  <User className="size-4 text-gray-500" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
                    GIỚI TÍNH
                  </span>
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {selectedUser?.gender === 'male' || selectedUser?.gender === 'Male' 
                      ? 'Nam' 
                      : selectedUser?.gender === 'female' || selectedUser?.gender === 'Female' 
                        ? 'Nữ' 
                        : (selectedUser?.gender || "Chưa cập nhật")}
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Customize Chat (Group Only) */}
        {isGroup && (
          <section>
            <h4 className={s.sectionTitle}>Tùy chỉnh đoạn chat</h4>
            <div className={s.buttonList}>
              {showEditName && (
                <button
                  onClick={() => setShowThemeModal(true)}
                  className={s.btnAction}
                >
                  <span className={s.iconWrap}>
                    <Palette className="size-4" />
                  </span>
                  Đổi chủ đề / Ảnh nền
                </button>
              )}

              <button
                onClick={() => setShowNicknameModal(true)}
                className={s.btnAction}
              >
                <span className={s.iconWrap}>
                  <Smile className="size-4" />
                </span>
                Chỉnh sửa biệt danh
              </button>

              <button
                onClick={() => setShowInviteModal(true)}
                className={s.btnActionInvite}
              >
                <span className={s.iconWrapDanger}>
                  <QrCode className="size-4" />
                </span>
                Lấy mã QR mời
              </button>
            </div>
          </section>
        )}


        {/* Shared Media Accordions */}
        <section className="mb-4">
          <h4 className={s.sectionTitle}>Kho lưu trữ đa phương tiện</h4>
          
          {/* Media Accordion */}
          <div className="bg-white border-b border-gray-100 rounded-t-xl overflow-hidden">
            <button 
              className="w-full flex items-center justify-between py-3 px-4 hover:bg-gray-50 transition-colors"
              onClick={() => toggleSection('media')}
            >
              <h4 className="text-[15px] font-semibold text-slate-800">Ảnh/Video</h4>
              {expandedSections.media ? <ChevronDown className="size-5 text-gray-500" /> : <ChevronRight className="size-5 text-gray-500" />}
            </button>
            
            {expandedSections.media && (
              <div className="px-4 pb-4">
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {images.slice(0, 8).map(img => (
                    <div key={img._id} className="aspect-square bg-gray-100 rounded-md overflow-hidden cursor-pointer hover:opacity-80 transition-opacity border border-gray-200">
                      <img src={img.image} alt="shared" className="w-full h-full object-cover" />
                    </div>
                  ))}
                  {images.length === 0 && (
                    <div className="col-span-4 text-center py-4 text-sm text-gray-400">
                      Chưa có ảnh/video
                    </div>
                  )}
                </div>
                {images.length > 0 && (
                  <button 
                    onClick={() => {
                      setStorageTab('media');
                      setShowStorageView(true);
                    }}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-sm transition-colors"
                  >
                    Xem tất cả
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Files Accordion */}
          <div className="bg-white border-b border-gray-100">
            <button 
              className="w-full flex items-center justify-between py-3 px-4 hover:bg-gray-50 transition-colors"
              onClick={() => toggleSection('files')}
            >
              <h4 className="text-[15px] font-semibold text-slate-800">File</h4>
              {expandedSections.files ? <ChevronDown className="size-5 text-gray-500" /> : <ChevronRight className="size-5 text-gray-500" />}
            </button>
            {expandedSections.files && (
              <div className="px-4 pb-4">
                <div className="text-center py-6 text-sm text-gray-500 bg-gray-50 rounded-lg">
                  Chưa có File được chia sẻ trong hội thoại này
                </div>
              </div>
            )}
          </div>

          {/* Links Accordion */}
          <div className="bg-white border-b border-gray-100 rounded-b-xl overflow-hidden shadow-sm">
            <button 
              className="w-full flex items-center justify-between py-3 px-4 hover:bg-gray-50 transition-colors"
              onClick={() => toggleSection('links')}
            >
              <h4 className="text-[15px] font-semibold text-slate-800">Link</h4>
              {expandedSections.links ? <ChevronDown className="size-5 text-gray-500" /> : <ChevronRight className="size-5 text-gray-500" />}
            </button>
            {expandedSections.links && (
              <div className="px-4 pb-4">
                {links.length === 0 ? (
                  <div className="text-center py-6 text-sm text-gray-500 bg-gray-50 rounded-lg">
                    Chưa có Link được chia sẻ trong hội thoại này
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 mb-3">
                    {links.slice(0, 3).map((linkMsg, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 rounded-lg flex flex-col gap-1">
                        <span className="text-brand-red text-sm font-medium line-clamp-1">{linkMsg.linkUrl}</span>
                      </div>
                    ))}
                  </div>
                )}
                {links.length > 0 && (
                  <button 
                    onClick={() => {
                      setStorageTab('links');
                      setShowStorageView(true);
                    }}
                    className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-sm transition-colors"
                  >
                    Xem tất cả
                  </button>
                )}
              </div>
            )}
          </div>

        </section>

        {/* Members / Privacy */}
        <section>
          <h4 className={s.sectionTitle}>
            {isGroup ? "Chat Members" : "Privacy & Support"}
          </h4>
          <div className={s.buttonList}>
            {isGroup ? (
              <>
                {/* ── Inline Members List ── */}
                <div className={s.membersList}>
                  {selectedUser.users?.map((member) => {
                    const isAdminMember =
                      selectedUser.groupAdmin?._id === member._id ||
                      selectedUser.groupAdmin === member._id;
                    return (
                      <div key={member._id} className={s.memberRow}>
                        {/* Avatar */}
                        <div className={s.memberAvatarSm}>
                          {member.profilePic ? (
                            <img
                              src={member.profilePic}
                              alt={member.username}
                              className={s.memberAvatarSmImg}
                            />
                          ) : (
                            member.username?.charAt(0).toUpperCase()
                          )}
                        </div>

                        {/* Info */}
                        <div className={s.memberInfo}>
                          <p className={s.memberName}>
                            {getDisplayName(selectedUser, member)}
                          </p>
                          <p className={s.memberUsername}>@{member.username}</p>
                        </div>

                        {/* Admin badge */}
                        {isAdminMember && (
                          <span className={s.adminBadge}>Admin</span>
                        )}

                        {/* Kick button */}
                        {isAdmin && !isAdminMember && (
                          <button
                            onClick={() => handleKickMember(member._id)}
                            className="ml-auto p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Kick Member"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>



                <button
                  onClick={handleLeaveGroup}
                  className={`${s.btnActionDanger} mt-2`}
                >
                  <span className={s.iconWrapDanger}>
                    <LogOut className="size-4" />
                  </span>
                  Leave Group
                </button>

                <button
                  onClick={() => deleteChat(selectedChatId)}
                  className={`${s.btnActionDanger} mt-2`}
                >
                  <span className={s.iconWrapDanger}>
                    <Trash2 className="size-4" />
                  </span>
                  Delete Group
                </button>
              </>
            ) : (
              <>
                {isFriend ? (
                  <button
                    onClick={() => unfriendUser(friendId)}
                    className={s.btnActionDanger}
                  >
                    <span className={s.iconWrapDanger}>
                      <UserPlus className="size-4" />
                    </span>
                    Unfriend
                  </button>
                ) : (
                  <button
                    onClick={() => addFriend(friendId)}
                    className={s.btnAction}
                  >
                    <span className={s.iconWrap}>
                      <UserPlus className="size-4" />
                    </span>
                    Add Friend
                  </button>
                )}

                <button onClick={handleBlock} className={s.btnActionDanger}>
                  <span className={s.iconWrapDanger}>
                    <ShieldAlert className="size-4" />
                  </span>
                  Block
                </button>

                <button
                  onClick={() => deleteChat(selectedChatId)}
                  className={s.btnActionDanger}
                >
                  <span className={s.iconWrapDanger}>
                    <Trash2 className="size-4" />
                  </span>
                  Delete Chat
                </button>
              </>
            )}
          </div>
        </section>
      </div>

      {/* ==============================================================
          MODALS
          ============================================================== */}

      {/* 1 ── Mute Notifications */}
      {showMuteModal && (
        <div className={s.modalOverlay}>
          <div className={s.modalBoxSm}>
            <button onClick={closeMuteModal} className={s.modalCloseBtn}>
              <X className="size-5" />
            </button>
            <h3 className={s.modalTitle}>Mute Notifications</h3>
            <p className={s.muteDescription}>
              How long do you want to mute notifications for this chat?
            </p>
            <div className="space-y-1">
              {[
                { label: "For 15 minutes", hours: 0.25 },
                { label: "For 1 hour", hours: 1 },
                { label: "For 8 hours", hours: 8 },
                { label: "For 24 hours", hours: 24 },
                { label: "Until I change it", hours: -1 },
              ].map(({ label, hours }) => (
                <button
                  key={label}
                  onClick={() => handleMute(hours)}
                  className={s.muteOption}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className={s.modalActionsRow} style={{ marginTop: "1.5rem" }}>
              <button onClick={closeMuteModal} className={s.btnGhost}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2 ── Edit Nicknames */}
      {showNicknameModal && (
        <div className={s.modalOverlay}>
          <div className={s.modalBoxFlush}>
            <div className={s.modalHeader}>
              <h3 className={s.modalTitle}>Edit Nicknames</h3>
              <button onClick={closeNicknameModal} className={s.btnDoneInline}>
                Done
              </button>
            </div>

            <div className={s.modalBody}>
              {selectedUser.users?.map((user) => {
                const currentNickname =
                  selectedUser.nicknames?.[user._id] || "";
                const isEditing = editingNicknames[user._id] !== undefined;
                return (
                  <div key={user._id} className={s.memberItem}>
                    {/* Avatar + name/input */}
                    <div className="flex items-center gap-3">
                      <div className={s.memberAvatar}>
                        {user.profilePic ? (
                          <img
                            src={user.profilePic}
                            className="size-full object-cover"
                            alt="avatar"
                          />
                        ) : (
                          <span className={s.memberAvatarText}>
                            {user.username.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        {isEditing ? (
                          <input
                            autoFocus
                            type="text"
                            className={`input input-sm input-bordered ${s.formInputSm}`}
                            value={editingNicknames[user._id]}
                            onChange={(e) =>
                              setEditingNicknames({
                                ...editingNicknames,
                                [user._id]: e.target.value,
                              })
                            }
                          />
                        ) : (
                          <>
                            <p className={s.memberName}>
                              {currentNickname || user.username}
                            </p>
                            {currentNickname && (
                              <p className={s.memberSubtext}>
                                @{user.username}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* Save / Edit toggle */}
                    {isEditing ? (
                      <button
                        onClick={() => handleSaveNickname(user._id)}
                        className={s.nicknameSaveBtn}
                      >
                        <Check className="size-5" />
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          setEditingNicknames({
                            ...editingNicknames,
                            [user._id]: currentNickname || user.username,
                          })
                        }
                        className={s.nicknameEditBtn}
                      >
                        <Edit2 className="size-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className={s.modalFooter}>
              <button onClick={closeNicknameModal} className={s.btnDoneBlock}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3 ── Rename Group */}
      {showRenameModal && (
        <div className={s.modalOverlay}>
          <div className={s.modalBox}>
            <button onClick={closeRenameModal} className={s.modalCloseBtn}>
              <X className="size-5" />
            </button>
            <h3 className={s.modalTitle} style={{ marginBottom: "1rem" }}>
              Change Group Name
            </h3>
            <input
              type="text"
              className={`input input-bordered ${s.formInput}`}
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              autoFocus
            />
            <div className={s.modalActionsRow}>
              <button onClick={closeRenameModal} className={s.btnGhost}>
                Cancel
              </button>
              <button onClick={handleUpdateGroupSettings} className={s.btnSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4 ── Invite / QR Code */}
      {showInviteModal && (
        <div className={s.modalOverlay}>
          <div className={s.modalBox}>
            <button onClick={closeInviteModal} className={s.modalCloseBtn}>
              <X className="size-5" />
            </button>

            <div className="text-center mb-6">
              <h3 className={s.inviteTitle}>Invite Friends</h3>
              <p className={s.inviteSubtitle}>Scan QR or copy link to join.</p>
            </div>

            <div className={s.qrWrapper}>
              <QRCodeSVG
                value={inviteLink}
                size={200}
                bgColor="#ffffff"
                fgColor="#000000"
                className="rounded-lg"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteLink}
                className={`input input-bordered ${s.inviteTextInput}`}
              />
              <button
                onClick={copyToClipboard}
                className={isCopied ? s.copyBtnSuccess : s.copyBtn}
              >
                {isCopied ? (
                  <Check className="size-5" />
                ) : (
                  <Copy className="size-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5 ── Theme / Avatar */}
      {showThemeModal && (
        <div className={s.modalOverlay}>
          <div className={s.modalBox}>
            <button onClick={closeThemeModal} className={s.modalCloseBtn}>
              <X className="size-5" />
            </button>
            <h3 className={s.modalTitle} style={{ marginBottom: "1rem" }}>
              Update Theme / Avatar
            </h3>

            <div className="space-y-4 mb-6">
              {/* Group Avatar upload — groups only */}
              {isGroup && (
                <>
                  <div>
                    <p className={s.sectionLabel}>Group Avatar</p>
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className={`${s.uploadBtn} flex-1`}
                      >
                        <ImageIcon className={s.uploadIcon} />
                        <span>Upload Image</span>
                      </button>
                      <button
                        onClick={() => {
                          updateGroupSettings(selectedChatId, {
                            groupAvatar: "",
                          });
                          closeThemeModal();
                        }}
                        className="p-3 border border-red-200 text-red-500 rounded-xl hover:bg-red-50 transition-colors flex items-center justify-center bg-white"
                        title="Remove Avatar"
                      >
                        <Trash2 className="size-5" />
                      </button>
                    </div>
                  </div>
                  <div className={s.dividerLabel + " divider"}>AND</div>
                </>
              )}

              {/* Background theme upload — all chats */}
              <div>
                <p className={s.sectionLabel}>Chat Background</p>
                <input
                  type="file"
                  accept="image/*"
                  id="themeInput"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      updateChatTheme(selectedChatId, reader.result);
                      closeThemeModal();
                    };
                    reader.readAsDataURL(file);
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      document.getElementById("themeInput").click()
                    }
                    className={`${s.uploadBtn} flex-1`}
                  >
                    <ImageIcon className={s.uploadIcon} />
                    <span>Upload Background</span>
                  </button>
                  <button
                    onClick={() => {
                      updateChatTheme(selectedChatId, "default");
                      closeThemeModal();
                    }}
                    className="p-3 border border-red-200 text-red-500 rounded-xl hover:bg-red-50 transition-colors flex items-center justify-center bg-white"
                    title="Remove Background"
                  >
                    <Trash2 className="size-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className={s.modalActionsRow}>
              <button onClick={closeThemeModal} className={s.btnGhost}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6 ── Add Member */}
      {showAddMemberModal && (
        <div className={s.modalOverlay}>
          <div className={s.modalBoxSm}>
            <button onClick={closeAddMemberModal} className={s.modalCloseBtn}>
              <X className="size-5" />
            </button>
            <h3 className={s.modalTitle} style={{ marginBottom: "1rem" }}>
              Add Member
            </h3>
            {/* Modal Body is skipped as it continues below... */}

            <div className={s.searchWrapper}>
              <Search className={s.searchIcon} />
              <input
                type="text"
                placeholder="Search friends…"
                className={s.formInputSearch}
              />
            </div>

            <div className={s.memberScrollList}>
              {eligibleFriends.length === 0 ? (
                <p className={s.emptyState}>
                  All friends are already in this group.
                </p>
              ) : (
                eligibleFriends.map((friend) => (
                  <div
                    key={friend._id}
                    className={s.radioItem}
                    onClick={() => setNewMemberId(friend._id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={s.radioAvatar}>
                        {friend.profilePic ? (
                          <img
                            src={friend.profilePic}
                            className="size-full object-cover"
                            alt="avatar"
                          />
                        ) : (
                          <span className={s.radioAvatarText}>
                            {friend.username.charAt(0)}
                          </span>
                        )}
                      </div>
                      <p className={s.memberName}>{friend.username}</p>
                    </div>
                    <input
                      type="radio"
                      name="member"
                      checked={newMemberId === friend._id}
                      onChange={() => {}}
                      className="radio radio-error radio-sm"
                    />
                  </div>
                ))
              )}
            </div>

            <div className={s.modalActionsRow}>
              <button onClick={closeAddMemberModal} className={s.btnGhost}>
                Cancel
              </button>
              <button
                onClick={handleAddMember}
                disabled={!newMemberId}
                className={s.btnSave}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 7 ── Group Management Modal */}
      {showGroupManagementModal && (
        <div className={s.modalOverlay}>
          <div className={s.modalBoxFlush}>
            <div className={s.modalHeaderBack}>
              <button onClick={closeGroupManagementModal} className={s.btnBack}>
                <ChevronLeft className="size-6" />
              </button>
              <h3 className={s.modalTitleCenter}>Quản lý nhóm</h3>
            </div>

            <div className={s.adminLockBanner}>
              <Lock className="size-4" />
              Tính năng chỉ dành cho quản trị viên
            </div>

            <div className={s.permissionsSection}>
              <h4 className={s.permissionsTitle}>Cho phép các thành viên trong nhóm:</h4>

              <div className="space-y-1">
                <label className={s.permissionRow}>
                  <span className={s.permissionLabel}>Thay đổi tên & ảnh đại diện của nhóm</span>
                  <input
                    type="checkbox"
                    className={s.zaloCheckbox}
                    checked={localPermissions.canChangeNameAvatar}
                    onChange={(e) => handleUpdatePermissions({ ...localPermissions, canChangeNameAvatar: e.target.checked })}
                  />
                </label>

                <label className={s.permissionRow}>
                  <span className={s.permissionLabel}>Ghim tin nhắn, ghi chú, bình chọn lên đầu hội thoại</span>
                  <input
                    type="checkbox"
                    className={s.zaloCheckbox}
                    checked={localPermissions.canPinMessages}
                    onChange={(e) => handleUpdatePermissions({ ...localPermissions, canPinMessages: e.target.checked })}
                  />
                </label>

                <label className={s.permissionRow}>
                  <span className={s.permissionLabel}>Tạo mới ghi chú, nhắc hẹn</span>
                  <input
                    type="checkbox"
                    className={s.zaloCheckbox}
                    checked={localPermissions.canCreateNotes}
                    onChange={(e) => handleUpdatePermissions({ ...localPermissions, canCreateNotes: e.target.checked })}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Group Modal (for 1-on-1 chats) ── */}
      <CreateGroupModal 
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        initialSelectedFriends={friendId ? [friendId] : []}
        onGroupCreated={(newChat) => {
          setShowCreateGroupModal(false);
          // Optional: handle switching to new chat or selecting it
        }}
      />

    </div>
  );
};

export default DetailsPanel;
