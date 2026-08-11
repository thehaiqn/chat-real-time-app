import { useState } from 'react';
import { useChatStore } from '../store/useChatStore';
import { Search, X, ChevronDown, Calendar, User as UserIcon } from 'lucide-react';
import { format } from 'date-fns';

const SearchPanel = () => {
  const { setShowSearchPanel, searchMessages, selectedChatId } = useChatStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e) => {
    if (e.key === 'Enter' && searchQuery.trim() && selectedChatId) {
      setIsSearching(true);
      setHasSearched(true);
      try {
        const results = await searchMessages(selectedChatId, searchQuery);
        setSearchResults(results);
      } catch (error) {
        console.error(error);
      } finally {
        setIsSearching(false);
      }
    }
  };

  const highlightText = (text, highlight) => {
    if (!text) return null;
    if (!highlight.trim()) {
      return <span>{text}</span>;
    }
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <span>
        {parts.map((part, index) => 
          part.toLowerCase() === highlight.toLowerCase() ? (
            <strong key={index} className="text-blue-600 font-bold bg-blue-50 px-0.5 rounded">
              {part}
            </strong>
          ) : (
            <span key={index}>{part}</span>
          )
        )}
      </span>
    );
  };

  return (
    <div className="w-[350px] min-w-[350px] max-w-[350px] h-full bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 flex flex-col shadow-lg z-20">
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-800 relative">
        <h2 className="text-[17px] font-bold text-gray-800 dark:text-gray-100 mx-auto">Tìm kiếm trong trò chuyện</h2>
        <button 
          onClick={() => setShowSearchPanel(false)}
          className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-500 transition-colors absolute right-3"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
        {/* Search Input */}
        <div className="relative flex items-center bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 focus-within:border-brand-red focus-within:ring-1 focus-within:ring-brand-red transition-all">
          <Search className="size-4 text-gray-400 mr-2" />
          <input 
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-sm text-gray-800 dark:text-gray-200"
            placeholder="Tìm kiếm..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
          />
          {searchQuery && (
            <button 
              onClick={() => { setSearchQuery(''); setSearchResults([]); setHasSearched(false); }}
              className="text-xs text-gray-400 hover:text-gray-600 font-medium ml-2"
            >
              Xóa
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 mr-1">Lọc theo:</span>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-md hover:bg-gray-200 transition-colors">
            <UserIcon className="size-3.5" />
            Người gửi
            <ChevronDown className="size-3 ml-0.5" />
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-md hover:bg-gray-200 transition-colors">
            <Calendar className="size-3.5" />
            Ngày gửi
            <ChevronDown className="size-3 ml-0.5" />
          </button>
        </div>

        {/* Results List */}
        <div className="mt-2 flex flex-col gap-0">
          {(hasSearched || searchResults.length > 0) && (
            <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-2">Tin nhắn</h3>
          )}
          
          {isSearching && (
            <div className="text-center py-10">
              <span className="loading loading-spinner text-brand-red"></span>
            </div>
          )}

          {!isSearching && hasSearched && searchResults.length === 0 && (
            <div className="text-center py-10 text-sm text-gray-500">
              Không tìm thấy kết quả nào.
            </div>
          )}

          {!isSearching && searchResults.map(msg => (
            <div key={msg._id} className="py-3 border-b border-gray-100 dark:border-slate-800 flex gap-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer px-2 -mx-2 rounded-lg transition-colors">
              
              {/* Avatar */}
              <div className="size-10 rounded-full overflow-hidden shrink-0 bg-gray-200 flex items-center justify-center text-gray-500 font-bold">
                {msg.senderId?.profilePic ? (
                  <img src={msg.senderId.profilePic} alt="avatar" className="size-full object-cover" />
                ) : (
                  msg.senderId?.username?.charAt(0).toUpperCase()
                )}
              </div>

              {/* Message Info */}
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex justify-between items-center mb-0.5">
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">
                    {msg.senderId?.username || 'User'}
                  </span>
                  <span className="text-[10px] text-gray-400 shrink-0 ml-2">
                    {format(new Date(msg.createdAt), 'dd/MM')}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-snug">
                  {highlightText(msg.text, searchQuery)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SearchPanel;
