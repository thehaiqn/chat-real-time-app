import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Search, UserPlus, Ban } from 'lucide-react';
import { axiosInstance } from '../lib/axios';
import styles from '../styles/FriendsManagement.module.css';

const FriendsManagement = () => {
  const { friends, fetchFriends, blockUser, addFriend } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  useEffect(() => {
    const searchUsers = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      try {
        const res = await axiosInstance.get(`/users/search?query=${searchQuery}`);
        setSearchResults(res.data);
      } catch (error) {
        console.log(error);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      searchUsers();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const handleAddFriend = async (userId) => {
    await addFriend(userId);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleBlockFriend = async (userId) => {
    if(window.confirm('Are you sure you want to block this user?')) {
        await blockUser(userId);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Friends Management</h1>
        <p className={styles.subtitle}>Find new friends or manage your existing connections.</p>
      </div>

      <div className={styles.content}>
        {/* Search for new friends */}
        <section>
          <h2 className={styles.sectionTitle}>Find Friends</h2>
          <div className={styles.searchWrapper}>
            <div className={styles.searchIconWrapper}>
              <Search className={styles.searchIcon} />
            </div>
            <input
              type="text"
              placeholder="Search by username or email..."
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {searchQuery && (
            <div className={styles.searchResults}>
              {searchResults.map((user) => (
                <div key={user._id} className={styles.searchResultCard}>
                  <div className={styles.avatar}>
                     {user.profilePic ? <img src={user.profilePic} className={styles.avatarImg} alt="avatar" /> : user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className={styles.userInfo}>
                    <p className={styles.username}>{user.username}</p>
                    <p className={styles.userEmail}>{user.email}</p>
                  </div>
                  <button 
                    onClick={() => handleAddFriend(user._id)}
                    className={styles.addBtn}
                  >
                    <UserPlus className="size-5" />
                  </button>
                </div>
              ))}
              {searchResults.length === 0 && <p className={styles.noUsers}>No users found.</p>}
            </div>
          )}
        </section>

        <hr className={styles.divider} />

        {/* Existing Friends Grid */}
        <section>
          <h2 className={styles.sectionTitle}>Your Friends ({friends.length})</h2>
          {friends.length === 0 ? (
            <div className={styles.emptyFriendsBox}>
              <p className={styles.emptyFriendsText}>You haven't added any friends yet.</p>
            </div>
          ) : (
            <div className={styles.friendsGrid}>
              {friends.map((friend) => (
                <div key={friend._id} className={styles.friendCard}>
                  <div className={styles.friendAvatar}>
                     {friend.profilePic ? <img src={friend.profilePic} className={styles.avatarImg} alt="avatar" /> : friend.username.charAt(0).toUpperCase()}
                  </div>
                  <h3 className={styles.friendName}>{friend.username}</h3>
                  <p className={styles.friendEmail}>{friend.email}</p>
                  
                  <div className={styles.friendActions}>
                    <button 
                      onClick={() => handleBlockFriend(friend._id)}
                      className={styles.blockBtn}
                    >
                      <Ban className="size-4" /> Block
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default FriendsManagement;
