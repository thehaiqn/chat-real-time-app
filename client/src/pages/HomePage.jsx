import { useState } from 'react';
import { useChatStore } from '../store/useChatStore';
import Sidebar from '../components/Sidebar';
import ChatArea from '../components/ChatArea';
import DetailsPanel from '../components/DetailsPanel';
import SearchPanel from '../components/SearchPanel';
import FriendsManagement from '../components/FriendsManagement';
import SettingsDashboard from '../components/SettingsDashboard';
import { MessageSquare } from 'lucide-react';

const HomePage = () => {
  const { selectedUser, showDetailsPanel, showSearchPanel } = useChatStore();
  const [activeView, setActiveView] = useState('chat'); // 'chat', 'friends', 'settings'

  return (
    <div className="flex-1 w-full flex overflow-hidden bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-sans">
      
      {/* Column 1: Sidebar & Chat List */}
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      
      {/* Column 2 & 3: Chat Area and Details */}
      {activeView === 'chat' && (
        !selectedUser ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800">
            <div className="flex flex-col items-center group cursor-default text-center">
              <div className="size-20 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center group-hover:bg-red-100 dark:group-hover:bg-red-900/40 transition-all duration-300 shadow-sm">
                <MessageSquare className="size-10 text-brand-red" />
              </div>
              <h2 className="text-3xl font-bold mt-6 text-black dark:text-white tracking-tight">Your Messages</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-2 max-w-sm font-medium">
                Select a conversation from the sidebar or start a new chat to connect with friends.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Column 2: Main Chat Area */}
            <ChatArea />
            
            {/* Column 3: Right Panels */}
            {showSearchPanel ? <SearchPanel /> : (showDetailsPanel && <DetailsPanel />)}
          </>
        )
      )}

      {activeView === 'friends' && <FriendsManagement />}
      {activeView === 'settings' && <SettingsDashboard />}
    </div>
  );
};

export default HomePage;
