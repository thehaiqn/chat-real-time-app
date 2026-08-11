import React, { useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import styles from '../styles/NotificationToggle.module.css';

const NotificationToggle = ({ isMuted, onToggle }) => {
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onToggle();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.infoGroup}>
        <div className={`${styles.iconWrapper} ${isMuted ? styles.iconWrapperMuted : styles.iconWrapperUnmuted}`}>
          {isMuted ? <BellOff className="size-5" /> : <Bell className="size-5" />}
        </div>
        <div>
          <p className={styles.title}>Notifications</p>
          <p className={styles.subtitle}>
            {isMuted ? 'Currently muted' : 'Enabled'}
          </p>
        </div>
      </div>
      
      <button 
        onClick={handleToggle}
        disabled={loading}
        className={`${styles.toggleBtn} ${isMuted ? styles.toggleBtnMuted : styles.toggleBtnUnmuted}`}
      >
        {loading ? (
          <span className={`${styles.thumb} ${styles.thumbLoading} ${isMuted ? styles.thumbMuted : ''}`}>
            <Loader2 className={styles.spinner} />
          </span>
        ) : (
          <span
            className={`${styles.thumb} ${isMuted ? styles.thumbMuted : ''}`}
          />
        )}
      </button>
    </div>
  );
};

export default NotificationToggle;
