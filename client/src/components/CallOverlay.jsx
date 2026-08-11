import { useEffect, useRef, useState } from 'react';
import { useCallStore } from '../store/useCallStore';
import { Phone, Video, PhoneOff, Mic, MicOff, VideoOff, Camera, X } from 'lucide-react';

const RemoteVideo = ({ stream, name, isVoice }) => {
  const videoRef = useRef();
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);
  
  if (isVoice) {
    return (
      <div className="flex flex-col items-center justify-center p-4 bg-slate-900 rounded-xl border border-slate-800">
        <div className={`size-24 md:size-32 bg-slate-800 rounded-full flex items-center justify-center text-4xl md:text-5xl font-bold text-gray-400 border-2 border-brand-red animate-pulse`}>
           {name?.charAt(0).toUpperCase()}
        </div>
        <p className="mt-4 text-white font-medium">{name}</p>
        <audio ref={videoRef} autoPlay />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[200px] bg-black rounded-xl overflow-hidden border border-slate-700">
      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-contain" />
      <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-md text-white text-sm">
        {name}
      </div>
    </div>
  );
};

const CallOverlay = () => {
  const { 
    callState, 
    incomingCall, 
    callType, 
    callerName, 
    localStream, 
    remoteStream, 
    acceptCall, 
    endCall,
    endGroupCall,
    isGroupCall,
    remoteStreams,
    groupParticipants
  } = useCallStore();

  const localVideoRef = useRef();
  const remoteVideoRef = useRef();

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'voice');

  useEffect(() => {
    if (callState === 'idle') {
      setIsMuted(false);
      setIsVideoOff(false);
    } else if (callState === 'calling' || callState === 'receiving') {
      setIsVideoOff(callType === 'voice');
    }
  }, [callState, callType]);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = async () => {
    if (isVideoOff && callType === 'voice') {
      try {
        await useCallStore.getState().enableCamera();
        setIsVideoOff(false);
      } catch (err) {
        // failed to get camera, do nothing
      }
    } else {
      if (localStream) {
        localStream.getVideoTracks().forEach(track => {
          track.enabled = !track.enabled;
        });
        setIsVideoOff(!isVideoOff);
      }
    }
  };

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callState]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream && !isGroupCall) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, callState, isGroupCall]);

  if (callState === 'idle') return null;

  const handleEndCall = () => {
    if (isGroupCall) {
      endGroupCall();
    } else {
      endCall();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center text-white">
      
      {/* Receiving Call UI */}
      {callState === 'receiving' && (
        <div className="bg-gradient-to-b from-[#1a73e8] to-[#1557b0] rounded-2xl shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-300 w-[320px] h-[440px] relative overflow-hidden border border-white/10">
          
          {/* Decorative Background Elements */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-[-20%] left-[-20%] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-48 h-48 bg-white/10 rounded-full blur-2xl"></div>
          </div>

          <button 
            onClick={handleEndCall}
            className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10 bg-black/10 hover:bg-black/20 rounded-full p-1.5"
          >
            <X className="size-5" />
          </button>

          <div className="mt-16 mb-6 relative">
            {/* Ripple effect */}
            <div className="absolute inset-0 bg-white/20 rounded-full animate-ping opacity-75"></div>
            
            <div className="size-28 bg-white/10 rounded-full flex items-center justify-center p-2 relative z-10 backdrop-blur-sm border border-white/20">
              <div className="size-full bg-blue-500 rounded-full flex items-center justify-center text-5xl font-bold text-white shadow-inner">
                {callerName?.charAt(0)?.toUpperCase() || 'U'}
              </div>
            </div>
          </div>
          
          <h2 className="text-2xl font-bold mb-1 text-white drop-shadow-md">{callerName}</h2>
          <p className="text-white/80 mb-10 text-sm font-medium">
            Cuộc gọi {incomingCall?.type === 'voice' ? 'thoại' : 'video'} đến...
          </p>
          
          <div className="flex gap-14 mt-auto mb-10 z-10">
            <button 
              onClick={handleEndCall} 
              className="size-16 rounded-full bg-[#ff3b30] hover:bg-[#ff453a] flex items-center justify-center transition-transform hover:scale-110 shadow-lg shadow-red-500/40"
            >
              <Phone className="size-7 text-white rotate-[135deg]" />
            </button>
            <button 
              onClick={acceptCall} 
              className="size-16 rounded-full bg-[#34c759] hover:bg-[#32d74b] flex items-center justify-center transition-transform hover:scale-110 shadow-lg shadow-green-500/40 animate-bounce"
            >
              {incomingCall?.type === 'video' ? <Video className="size-7 text-white" /> : <Phone className="size-7 text-white" />}
            </button>
          </div>
        </div>
      )}

      {/* Calling / Active Call UI */}
      {(callState === 'calling' || callState === 'active') && (
        <div className="w-full h-full relative flex flex-col">
          
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/60 to-transparent z-10">
            <div>
              <h2 className="text-2xl font-bold">{isGroupCall ? 'Group Call' : callerName}</h2>
              <p className="text-gray-300">{callState === 'calling' ? 'Calling...' : '00:00'}</p>
            </div>
          </div>

          {/* Video Streams Area */}
          <div className="flex-1 relative bg-slate-950 p-4 sm:p-16 pt-24 pb-32 flex items-center justify-center">
            
            {isGroupCall ? (
              <div className={`w-full h-full grid gap-4 max-w-7xl mx-auto ${Object.keys(remoteStreams).length > 0 ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
                {/* Local Video */}
                <div className="relative w-full h-full min-h-[200px] bg-slate-900 rounded-xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col items-center justify-center">
                  {localStream && !isVideoOff ? (
                    <video 
                      ref={localVideoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className="w-full h-full object-contain mirror"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="size-24 bg-slate-800 rounded-full flex items-center justify-center">
                        <Camera className="size-8 text-gray-500" />
                      </div>
                      {callType === 'voice' && <p className="mt-4 text-white font-medium">You</p>}
                    </div>
                  )}
                  {callType === 'video' && <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-md text-white text-sm">You</div>}
                </div>

                {/* Remote Videos */}
                {Object.entries(remoteStreams).map(([userId, stream]) => (
                  <RemoteVideo 
                    key={userId} 
                    stream={stream} 
                    name={groupParticipants[userId]?.name || 'Unknown'} 
                    isVoice={callType === 'voice'} 
                  />
                ))}
              </div>
            ) : (
              /* EXISTING 1-on-1 UI */
              <>
                {callType === 'video' ? (
                  <>
                    {/* Remote Video */}
                    {callState === 'active' ? (
                      <div className="w-full h-full max-w-6xl max-h-[80vh] rounded-2xl overflow-hidden bg-black shadow-2xl ring-1 ring-slate-800">
                        <video 
                          ref={remoteVideoRef} 
                          autoPlay 
                          playsInline 
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center flex-col gap-4">
                        <div className="size-32 bg-slate-800 rounded-full flex items-center justify-center text-5xl font-bold text-gray-400">
                          {callerName?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                      </div>
                    )}

                    {/* Local Video (PiP) */}
                    <div className="absolute bottom-24 right-6 w-32 h-48 sm:w-48 sm:h-72 bg-slate-800 rounded-xl overflow-hidden shadow-2xl border-2 border-slate-700 z-10">
                      {localStream ? (
                        <video 
                          ref={localVideoRef} 
                          autoPlay 
                          playsInline 
                          muted 
                          className="w-full h-full object-cover mirror"
                          style={{ transform: 'scaleX(-1)' }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Camera className="size-8 text-gray-500" />
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  /* Voice Call UI */
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="flex flex-col items-center">
                      <div className={`size-40 bg-slate-800 rounded-full flex items-center justify-center text-6xl font-bold shadow-2xl border-4 ${callState === 'active' ? 'border-brand-red animate-pulse' : 'border-slate-700'}`}>
                        {callerName?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      {/* Hidden audio element for remote stream in voice calls */}
                      {callState === 'active' && (
                        <audio ref={remoteVideoRef} autoPlay />
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Controls Footer */}
          <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-center gap-6 bg-gradient-to-t from-black/80 to-transparent z-10">
            <button 
              onClick={toggleMute}
              className={`size-14 rounded-full flex items-center justify-center transition-colors backdrop-blur-md border border-slate-700 ${isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-800 hover:bg-slate-700'}`}>
              {isMuted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
            </button>
            <button 
              onClick={handleEndCall} 
              className="size-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-colors shadow-lg shadow-red-500/20"
            >
              <PhoneOff className="size-6" />
            </button>
            <button 
              onClick={toggleVideo}
              className={`size-14 rounded-full flex items-center justify-center transition-colors backdrop-blur-md border border-slate-700 ${isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-slate-800 hover:bg-slate-700'}`}>
              {isVideoOff ? <VideoOff className="size-6" /> : <Video className="size-6" />}
            </button>
          </div>

        </div>
      )}

    </div>
  );
};

export default CallOverlay;
