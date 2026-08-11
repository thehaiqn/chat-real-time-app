import { useState, useRef, useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';
import { useAuthStore } from '../store/useAuthStore';
import { Paperclip, Smile, Calendar, Send, X, FileImage, Mic, Square } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import axios from 'axios';
import styles from '../styles/MessageInput.module.css';

const MessageInput = () => {
  const [text, setText] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [audioPreview, setAudioPreview] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifs, setGifs] = useState([]);
  const [gifSearch, setGifSearch] = useState('');

  // Audio Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

  const fileInputRef = useRef(null);
  const { sendMessage, selectedChatId, replyingTo, setReplyingTo, selectedChat } = useChatStore();
  const { socket, authUser } = useAuthStore();
  const typingTimeoutRef = useRef(null);

  // Close popovers on click outside
  const emojiRef = useRef(null);
  const gifRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiRef.current && !emojiRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
      if (gifRef.current && !gifRef.current.contains(event.target)) {
        setShowGifPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result;
          setAudioPreview(base64Audio);
        };
        // Stop all tracks to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Cannot access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      // Clear chunks so we don't send anything
      mediaRecorderRef.current.onstop = () => {
        const stream = mediaRecorderRef.current.stream;
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      clearInterval(timerIntervalRef.current);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onEmojiClick = (emojiObject) => {
    setText((prev) => prev + emojiObject.emoji);
  };

  const searchGifs = async () => {
    if (!gifSearch) return;
    try {
      const res = await axios.get(`https://api.giphy.com/v1/gifs/search?api_key=GlVGYHqcV29w5hApsaHwzJ0R7gJc1Xp0&q=${gifSearch}&limit=8`);
      setGifs(res.data.data);
    } catch (err) {
      console.log('Error fetching GIFs', err);
    }
  };

  const sendGif = async (gifUrl) => {
    setShowGifPicker(false);
    try {
      await sendMessage({
        image: gifUrl,
        messageType: 'gif'
      });
    } catch (error) {
      console.log(error);
    }
  };

  const handleTyping = (e) => {
    setText(e.target.value);
    if (socket && selectedChatId) {
      socket.emit('typing', selectedChatId);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stopTyping', selectedChatId);
      }, 2000);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && !imagePreview && !audioPreview) return;

    if (socket && selectedChatId) {
       socket.emit('stopTyping', selectedChatId);
    }

    try {
      await sendMessage({
        text: text.trim(),
        image: imagePreview,
        audio: audioPreview,
        messageType: audioPreview ? 'audio' : (imagePreview ? 'image' : 'text')
      });

      setText('');
      removeImage();
      setAudioPreview(null);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <div className={styles.container}>
      {imagePreview && (
        <div className={styles.imagePreviewWrapper}>
          <div className={styles.imagePreviewInner}>
            <img
              src={imagePreview}
              alt="Preview"
              className={styles.previewImage}
            />
            <button
              onClick={removeImage}
              className={styles.removeImageBtn}
              type="button"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {audioPreview && (
        <div className="mb-3 flex items-center gap-3 p-2 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 w-max animate-in slide-in-from-bottom-2">
          <audio src={audioPreview} controls className="h-10 w-[250px]" />
          <button
            onClick={() => setAudioPreview(null)}
            className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded-full text-gray-500 transition-colors"
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <div className={styles.emojiPickerPopover} ref={emojiRef}>
          <EmojiPicker onEmojiClick={onEmojiClick} />
        </div>
      )}

      {/* GIF Picker Popover */}
      {showGifPicker && (
        <div className={styles.gifPickerPopover} ref={gifRef}>
          <div className={styles.gifSearchRow}>
            <input 
              type="text" 
              className={styles.gifSearchInput} 
              placeholder="Search Giphy..." 
              value={gifSearch}
              onChange={(e) => setGifSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchGifs()}
            />
            <button className={styles.gifSearchBtn} onClick={searchGifs}>Search</button>
          </div>
          <div className={styles.gifGrid}>
             {gifs.map(gif => (
               <img 
                 key={gif.id} 
                 src={gif.images.fixed_height_small.url} 
                 className={styles.gifImage} 
                 onClick={() => sendGif(gif.images.original.url)}
                 alt="gif"
               />
             ))}
             {gifs.length === 0 && <p className={styles.noGifs}>No GIFs found</p>}
          </div>
        </div>
      )}

      {/* Reply Preview Box */}
      {replyingTo && (
        <div className={styles.replyPreview}>
          <div className={styles.replyContent}>
            <span className={styles.replySender}>
              Replying to {replyingTo.senderId?.username || 'User'}
            </span>
            <span className={styles.replyText}>
              {replyingTo.messageType === 'text' ? replyingTo.text : `[${replyingTo.messageType}]`}
            </span>
          </div>
          <button 
            type="button" 
            onClick={() => setReplyingTo(null)}
            className={styles.replyCloseBtn}
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSendMessage} className={styles.inputForm}>
        
        {/* Left Icons */}
        <div className={styles.leftIcons}>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageChange}
          />
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="size-5" />
          </button>

          <button
            type="button"
            className={`${styles.iconBtn} ${showEmojiPicker ? styles.iconBtnActive : ''}`}
            onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowGifPicker(false); }}
          >
            <Smile className="size-5" />
          </button>

          <button
            type="button"
            className={`${styles.iconBtn} ${styles.gifBtnText} ${showGifPicker ? styles.iconBtnActive : ''}`}
            onClick={() => { setShowGifPicker(!showGifPicker); setShowEmojiPicker(false); setGifs([]); setGifSearch(''); }}
          >
            GIF
          </button>
          
          <div className="relative">
            <button
              type="button"
              className={`${styles.iconBtn} ${styles.calendarBtn}`}
            >
              <Calendar className="size-5" />
              <input 
                type="date"
                className={styles.calendarInput}
                onChange={(e) => {
                  if (e.target.value) {
                    setText((prev) => prev + (prev ? ' ' : '') + new Date(e.target.value).toLocaleDateString() + ' ');
                  }
                }}
              />
            </button>
          </div>

          {/* Mic Button */}
          <button
            type="button"
            className={`${styles.iconBtn} ${isRecording ? 'text-red-500 animate-pulse' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
            title={isRecording ? "Stop & Preview" : "Record Voice Message"}
          >
            {isRecording ? <Square className="size-5" /> : <Mic className="size-5" />}
          </button>
        </div>

        {/* Input Field or Recording UI */}
        {isRecording ? (
          <div className="flex-1 flex items-center justify-between px-4 text-red-500 font-medium">
            <div className="flex items-center gap-2 animate-pulse">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500"></div>
              <span>Recording {formatTime(recordingTime)}</span>
            </div>
            <button type="button" onClick={cancelRecording} className="text-gray-500 hover:text-red-500 transition-colors text-sm">Cancel</button>
          </div>
        ) : (
          <input
            type="text"
            className={styles.textInput}
            placeholder="Type your message here or @AI..."
            value={text}
            onChange={handleTyping}
          />
        )}
        
        {/* Send Button */}
        <button
          type="submit"
          className={styles.sendBtn}
          disabled={!text.trim() && !imagePreview && !audioPreview && !isRecording}
          onClick={isRecording ? (e) => { e.preventDefault(); stopRecording(); } : undefined}
        >
          <Send className={`size-5 ${styles.sendIcon}`} />
        </button>
      </form>
    </div>
  );
};

export default MessageInput;
