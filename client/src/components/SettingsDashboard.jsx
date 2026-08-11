import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { Camera, Shield, User, Bell, Ban, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import styles from '../styles/SettingsDashboard.module.css';

const SettingsDashboard = () => {
  const { authUser, updateAvatar, updateProfile, isUpdatingProfile, updatePassword, blockedUsers, fetchBlockedUsers, unblockUser, messageSounds, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');
  const fileInputRef = useRef(null);

  // Password state
  const [passwords, setPasswords] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [passMsg, setPassMsg] = useState({ type: '', text: '' });
  const [isUpdatingPass, setIsUpdatingPass] = useState(false);

  const [profileData, setProfileData] = useState({
    username: authUser?.username || '',
    email: authUser?.email || '',
    phoneNumber: authUser?.phoneNumber || '',
    gender: authUser?.gender || 'Other'
  });

  useEffect(() => {
    if (authUser) {
      setProfileData({
        username: authUser.username || '',
        email: authUser.email || '',
        phoneNumber: authUser.phoneNumber || '',
        gender: authUser.gender || 'Other'
      });
    }
  }, [authUser]);

  useEffect(() => {
    fetchBlockedUsers();
  }, [fetchBlockedUsers]);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = async () => {
      const base64Image = reader.result;
      try {
        await updateProfile({ profilePic: base64Image });
        toast.success('Profile picture updated successfully!');
      } catch (error) {
        toast.error('Failed to update profile picture');
      }
    };
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPassMsg({ type: '', text: '' });
    
    if (passwords.newPassword !== passwords.confirmPassword) {
      return setPassMsg({ type: 'error', text: 'New passwords do not match.' });
    }
    
    setIsUpdatingPass(true);
    try {
      await updatePassword(passwords.oldPassword, passwords.newPassword);
      setPassMsg({ type: 'success', text: 'Password updated successfully! Logging you out...' });
      toast.success('Password updated successfully! Please log in again.');
      setPasswords({ oldPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => logout(), 2000);
    } catch (error) {
      setPassMsg({ type: 'error', text: error || 'Failed to update password' });
    } finally {
      setIsUpdatingPass(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Manage your profile, security, and application preferences.</p>
      </div>

      <div className={styles.mainContent}>
        
        {/* Settings Navigation */}
        <div className={styles.sidebar}>
          <button 
            onClick={() => setActiveTab('profile')}
            className={`${styles.sidebarBtn} ${activeTab === 'profile' ? styles.sidebarBtnActive : styles.sidebarBtnInactive}`}
          >
            <User className="size-5" /> Profile Settings
          </button>
          <button 
            onClick={() => setActiveTab('security')}
            className={`${styles.sidebarBtn} ${activeTab === 'security' ? styles.sidebarBtnActive : styles.sidebarBtnInactive}`}
          >
            <Shield className="size-5" /> Security & Privacy
          </button>
          <button 
            onClick={() => setActiveTab('app')}
            className={`${styles.sidebarBtn} ${activeTab === 'app' ? styles.sidebarBtnActive : styles.sidebarBtnInactive}`}
          >
            <Bell className="size-5" /> App Settings
          </button>
        </div>

        {/* Settings Content */}
        <div className={styles.contentBox}>
          
          {/* PROFILE SETTINGS */}
          {activeTab === 'profile' && (
            <div className={styles.sectionGroup}>
              <h2 className={styles.sectionTitleWithMargin}>Profile Information</h2>
              
              <div className={styles.avatarSection}>
                <p className={styles.avatarLabel}>Profile Picture</p>
                <div className={styles.avatarWrapper}>
                  <div className={styles.avatarCircle}>
                    {authUser?.profilePic ? (
                      <img src={authUser.profilePic} alt="Profile" className={styles.avatarImg} />
                    ) : (
                      authUser?.username.charAt(0).toUpperCase()
                    )}
                  </div>
                  
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUpdatingProfile}
                    className={styles.cameraBtn}
                  >
                    {isUpdatingProfile ? <Loader2 className={styles.spinner} /> : <Camera className="size-5" />}
                  </button>
                  <input type="file" className="hidden" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" />
                </div>
                <p className={styles.avatarHint}>Click the camera icon to upload a new avatar.</p>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await updateProfile(profileData);
                  toast.success('Profile updated successfully!');
                } catch (error) {
                  toast.error(error.response?.data?.error || 'Failed to update profile');
                }
              }} className={styles.formGroup}>
                <div className={styles.inputField}>
                  <label className={styles.inputLabel}>Username</label>
                  <input type="text" name="username" value={profileData.username} onChange={e => setProfileData({...profileData, username: e.target.value})} className={styles.textInput} />
                </div>
                <div className={styles.inputField}>
                  <label className={styles.inputLabel}>Email Address</label>
                  <input type="email" name="email" value={profileData.email} onChange={e => setProfileData({...profileData, email: e.target.value})} className={styles.textInput} />
                </div>
                <div className={styles.inputField}>
                  <label className={styles.inputLabel}>Phone Number</label>
                  <input type="text" name="phoneNumber" value={profileData.phoneNumber} onChange={e => setProfileData({...profileData, phoneNumber: e.target.value})} className={styles.textInput} />
                </div>
                <div className={styles.inputField}>
                  <label className={styles.inputLabel}>Gender</label>
                  <select name="gender" value={profileData.gender} onChange={e => setProfileData({...profileData, gender: e.target.value})} className={styles.textInput}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                
                <button 
                  type="submit" 
                  disabled={isUpdatingProfile}
                  className={styles.submitBtn}
                >
                  {isUpdatingProfile ? <Loader2 className={styles.spinner} /> : 'Save Profile Changes'}
                </button>
              </form>
            </div>
          )}

          {/* SECURITY SETTINGS */}
          {activeTab === 'security' && (
            <div className={styles.sectionGroup}>
              
              {/* Change Password */}
              <div>
                <h2 className={styles.sectionTitleWithMargin}>Change Password</h2>
                <form onSubmit={handlePasswordSubmit} className={styles.formGroup}>
                  <div className={styles.inputField}>
                    <label className={styles.inputLabel}>Current Password</label>
                    <input 
                      type="password" 
                      required
                      value={passwords.oldPassword}
                      onChange={(e) => setPasswords({...passwords, oldPassword: e.target.value})}
                      className={styles.textInput} 
                    />
                  </div>
                  <div className={styles.inputField}>
                    <label className={styles.inputLabel}>New Password</label>
                    <input 
                      type="password" 
                      required
                      value={passwords.newPassword}
                      onChange={(e) => setPasswords({...passwords, newPassword: e.target.value})}
                      className={styles.textInput} 
                    />
                  </div>
                  <div className={styles.inputField}>
                    <label className={styles.inputLabel}>Confirm New Password</label>
                    <input 
                      type="password" 
                      required
                      value={passwords.confirmPassword}
                      onChange={(e) => setPasswords({...passwords, confirmPassword: e.target.value})}
                      className={styles.textInput} 
                    />
                  </div>

                  {passMsg.text && (
                    <p className={`${passMsg.type === 'error' ? styles.msgError : styles.msgSuccess}`}>
                      {passMsg.text}
                    </p>
                  )}

                  <button 
                    type="submit" 
                    disabled={isUpdatingPass}
                    className={styles.submitBtn}
                  >
                    {isUpdatingPass ? <Loader2 className={styles.spinner} /> : 'Update Password'}
                  </button>
                </form>
              </div>

              {/* Blocked Users */}
              <div>
                <h2 className={styles.sectionTitleWithMargin}>Manage Blocked Users</h2>
                {blockedUsers.length === 0 ? (
                  <p className={styles.emptyBlocked}>You haven't blocked anyone.</p>
                ) : (
                  <div className={styles.blockedList}>
                    {blockedUsers.map(user => (
                      <div key={user._id} className={styles.blockedItem}>
                        <div className={styles.blockedInfo}>
                          <div className={styles.blockedAvatar}>
                            {user.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className={styles.blockedName}>{user.username}</p>
                            <p className={styles.blockedEmail}>{user.email}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => unblockUser(user._id)}
                          className={styles.unblockBtn}
                        >
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* APP SETTINGS */}
          {activeTab === 'app' && (
            <div className={styles.sectionGroup}>
              <h2 className={styles.sectionTitleWithMargin}>App Preferences</h2>
              
              <div className={styles.formGroup}>
                <div className={styles.appSettingRow}>
                  <div className={styles.appSettingText}>
                    <p className={styles.appSettingTitle}>Desktop Notifications</p>
                    <p className={styles.appSettingSubtitle}>Receive alerts for new messages</p>
                  </div>
                  <input type="checkbox" className="toggle toggle-error bg-brand-red" defaultChecked />
                </div>
                
                <div className={styles.appSettingRow}>
                  <div className={styles.appSettingText}>
                    <p className={styles.appSettingTitle}>Message Sounds</p>
                    <p className={styles.appSettingSubtitle}>Play a sound on new messages</p>
                  </div>
                  <input 
                    type="checkbox" 
                    className="toggle toggle-error bg-brand-red" 
                    checked={messageSounds} 
                    onChange={(e) => useAuthStore.getState().setMessageSounds(e.target.checked)}
                  />
                </div>

                <div className={styles.appSettingRow}>
                  <div className={styles.appSettingText}>
                    <p className={styles.appSettingTitle}>Read Receipts</p>
                    <p className={styles.appSettingSubtitle}>Let others know when you read their messages</p>
                  </div>
                  <input type="checkbox" className="toggle toggle-error bg-brand-red" />
                </div>
              </div>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
};

export default SettingsDashboard;
