import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { axiosInstance } from '../lib/axios';
import { X, Users, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import styles from '../styles/CreateGroupModal.module.css';

const CreateGroupModal = ({ isOpen, onClose, onGroupCreated, initialSelectedFriends = [] }) => {
  const { friends } = useAuthStore();
  const [groupName, setGroupName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState(initialSelectedFriends);
  const [isCreating, setIsCreating] = useState(false);

  // Re-sync if it changes (useful if modal stays mounted but initial changes)
  useEffect(() => {
    if (isOpen) {
      setSelectedFriends(initialSelectedFriends);
      setGroupName('');
    }
  }, [isOpen, initialSelectedFriends]);

  if (!isOpen) return null;

  const toggleFriend = (friendId) => {
    if (selectedFriends.includes(friendId)) {
      setSelectedFriends(selectedFriends.filter(id => id !== friendId));
    } else {
      setSelectedFriends([...selectedFriends, friendId]);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || selectedFriends.length === 0) return;
    
    setIsCreating(true);
    try {
      const { data } = await axiosInstance.post('/chat/group', {
        name: groupName,
        users: selectedFriends
      });
      onGroupCreated(data);
      onClose();
      setGroupName('');
      setSelectedFriends([]);
      toast.success('Group created successfully!');
    } catch (error) {
      console.log('Error creating group:', error);
      toast.error(error.response?.data?.error || error.response?.data?.message || 'Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalBox}>
        
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            <Users className={styles.titleIcon} /> Create Group Chat
          </h2>
          <button onClick={onClose} className={styles.closeBtn}>
            <X className="size-5" />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>Group Name</label>
            <input 
              type="text" 
              placeholder="E.g. Weekend Vibes"
              className={styles.textInput}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>

          <div>
            <label className={styles.inputLabel}>Select Members ({selectedFriends.length} selected)</label>
            
            {friends.length === 0 ? (
              <p className={styles.emptyFriends}>You have no friends to add.</p>
            ) : (
              <div className={styles.friendsList}>
                {friends.map(friend => (
                  <label key={friend._id} className={styles.friendItem}>
                    <input 
                      type="checkbox" 
                      className={`checkbox checkbox-sm ${styles.checkboxInput}`}
                      checked={selectedFriends.includes(friend._id)}
                      onChange={() => toggleFriend(friend._id)}
                    />
                    <div className={styles.friendAvatar}>
                      {friend.username.charAt(0).toUpperCase()}
                    </div>
                    <span className={styles.friendName}>{friend.username}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button onClick={onClose} className={styles.cancelBtn}>
            Cancel
          </button>
          <button 
            onClick={handleCreate}
            disabled={!groupName.trim() || selectedFriends.length === 0 || isCreating}
            className={styles.createBtn}
          >
            {isCreating ? <Loader2 className={styles.spinner} /> : 'Create Group'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default CreateGroupModal;
