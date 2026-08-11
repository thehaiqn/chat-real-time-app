import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { LogOut, MessageSquare } from 'lucide-react';
import s from '../styles/Navbar.module.css';

const Navbar = () => {
  const { authUser, logout } = useAuthStore();

  return (
    <header className={s.header}>
      <div className={s.inner}>
        <div className={s.row}>

          {/* Brand */}
          <Link to="/" className={s.brand}>
            <div className={s.brandIcon}>
              <MessageSquare className="w-5 h-5 text-brand-red" />
            </div>
            <h1 className={s.brandName}>ChatApp</h1>
          </Link>

          {/* Right controls */}
          <div className={s.controls}>            {authUser && (
              <>
                <span className={s.username}>{authUser.username}</span>
                <button className={s.logoutBtn} onClick={logout}>
                  <LogOut className="w-5 h-5" />
                  <span className={s.logoutLabel}>Logout</span>
                </button>
              </>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};

export default Navbar;
