import React, { useEffect, useRef, useState } from 'react';
import { Video as VideoIcon, Volume2, VolumeX, CheckCircle, Award, Lightbulb, X, Loader2, Settings, Maximize2, Zap, Copy, Share2 } from 'lucide-react';
import { ModeConfig, SessionFeedback } from '../types';
import { useGeminiLive } from '../hooks/useGeminiLive';

interface VideoInterfaceProps {
  mode: ModeConfig;
  topic: string;
}

export const VideoInterface: React.FC<VideoInterfaceProps> = ({ mode, topic }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [hasPermissions, setHasPermissions] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [showSaveNotification, setShowSaveNotification] = useState<boolean>(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
  const [copySuccess, setCopySuccess] = useState<boolean>(false);
  
  // Feedback State
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<SessionFeedback | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  
  // Initialize Gemini Live Hook
  const { 
    connect, 
    disconnect, 
    generateSessionReport,
    isConnected, 
    isConnecting, 
    currentPrompt,
    activeInsight,
    error 
  } = useGeminiLive({ 
    videoElementRef: videoRef, 
    selectedMode: mode,
    isAudioEnabled,
    topic
  });

  // Setup Camera on Mount
  useEffect(() => {
    const setupCamera = async () => {
      try {
        // Request high definition video if available
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, 
          audio: true 
        });
        setMediaStream(stream);
        setHasPermissions(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setHasPermissions(false);
      }
    };
    setupCamera();

    return () => {
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle Recording Logic
  const startRecording = () => {
    if (!mediaStream) return;
    
    chunksRef.current = [];
    setFeedback(null);
    setShowFeedbackModal(false);
    
    let mimeType = 'video/webm';
    if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9')) {
      mimeType = 'video/webm; codecs=vp9';
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      mimeType = 'video/mp4';
    }

    try {
      const options: MediaRecorderOptions = {
        mimeType,
        videoBitsPerSecond: 2500000, 
        audioBitsPerSecond: 128000
      };

      const recorder = new MediaRecorder(mediaStream, options);
      
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const duration = Date.now() - startTimeRef.current;
        
        // Discard recordings shorter than 1 second (prevents saving on immediate errors)
        if (duration < 1000) {
            console.warn("Recording discarded: duration too short.");
            chunksRef.current = [];
            return;
        }

        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.style.display = 'none';
        a.href = url;
        const date = new Date();
        const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        a.download = `Flow-Recording-${timestamp}.${mimeType === 'video/mp4' ? 'mp4' : 'webm'}`;
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        setShowSaveNotification(true);
        setTimeout(() => setShowSaveNotification(false), 3000);
        chunksRef.current = [];
      };

      recorder.start();
      startTimeRef.current = Date.now();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error("Failed to start recording:", err);
    }
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);

    // Trigger Analysis
    // We disconnect LIVE first to stop streaming, but we keep the hook state alive enough to run analysis if needed
    disconnect(); 
    
    // Only run analysis if the recording was substantial (longer than 5s) to save API calls on false starts
    // However, we rely on generateSessionReport returning null if history is empty.
    setIsAnalyzing(true);
    
    try {
        const report = await generateSessionReport();
        if (report) {
            setFeedback(report);
            setShowFeedbackModal(true);
        }
    } catch (e) {
        console.error("Failed to generate report", e);
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleToggleSession = () => {
    if (isRecording) {
      stopRecording();
    } else {
      if (!hasPermissions) {
          alert("Please allow camera and microphone access to use this app.");
          return;
      }
      connect();
      startRecording();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Watch for AI errors
  useEffect(() => {
    if (error && isRecording) {
      stopRecording();
    }
  }, [error, isRecording]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore keys when user is interacting with form inputs
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

      switch (event.code) {
        case 'Space':
          event.preventDefault(); // Prevent page scrolling
          // Respect disabled state conditions
          if (!isAnalyzing && !(isConnecting && !isRecording) && hasPermissions) {
            handleToggleSession();
          }
          break;
        case 'KeyM':
          setIsAudioEnabled(prev => !prev);
          break;
        case 'KeyS':
          console.log("Settings shortcut triggered");
          // Logic to open settings would go here
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleSession, isAnalyzing, isConnecting, isRecording, hasPermissions, setIsAudioEnabled]);

  return (
    <div className="relative w-full max-w-5xl mx-auto aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl ring-8 ring-white/50 group">
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted 
        className="w-full h-full object-cover transform scale-x-[-1]" 
      />

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-10">
        <div className="flex flex-col gap-2">
           <div className="flex gap-2">
              {isConnected && (
                <div className="flex items-center gap-2 bg-red-500/90 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse shadow-lg">
                  <div className="w-2 h-2 bg-white rounded-full"></div>
                  Live Session
                </div>
              )}
              
              {isRecording && (
                <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-white/10">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                  REC
                </div>
              )}
           </div>
           
           {isRecording && <span className="text-white/80 font-mono text-sm ml-1">Recording in HD</span>}
        </div>

        <div className="flex gap-3">
          <div className="bg-black/20 backdrop-blur-md text-white px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium border border-white/10">
            <div className={`w-2 h-2 rounded-full ${mode.color}`}></div>
            {mode.label}
          </div>
        </div>
      </div>

      {/* Insight Card Overlay (Right Side) */}
      <div className={`
        absolute right-8 top-32 z-20 max-w-xs w-full transition-all duration-700 transform ease-out
        ${activeInsight ? 'translate-x-0 opacity-100' : 'translate-x-20 opacity-0 pointer-events-none'}
      `}>
        <div className="bg-white/10 backdrop-blur-xl border border-white/30 p-5 rounded-2xl shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-flow-purple to-flow-pink"></div>
           <div className="flex items-center gap-2 mb-2 text-flow-blue">
              <Zap size={16} className="animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest">Live Insight</span>
           </div>
           <h3 className="text-white font-serif text-xl font-bold mb-2 drop-shadow-sm">{activeInsight?.title}</h3>
           <p className="text-white/90 text-sm leading-relaxed">{activeInsight?.content}</p>
        </div>
      </div>

      {/* Central Prompt Overlay (Hidden during loading/analysis if not connected) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-12">
        <div className={`
          relative max-w-3xl w-full transition-all duration-500 ease-in-out transform 
          ${isConnected ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}
        `}>
          <div className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-[2rem] p-10 shadow-2xl text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-50"></div>
            <div className={`
              inline-block px-3 py-1 rounded-full text-white text-[10px] font-bold tracking-widest uppercase mb-6 shadow-sm
              ${isAudioEnabled ? 'bg-flow-purple/80' : 'bg-gray-500/80'}
            `}>
               {isAudioEnabled ? 'AI Voice Active' : 'Silent Mode • Read Below'}
            </div>
            
            {/* Dynamic font sizing based on length */}
            <h2 className={`
               font-serif text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] leading-tight transition-all duration-300 min-h-[120px] flex items-center justify-center
               ${currentPrompt.length > 120 ? 'text-lg md:text-xl lg:text-2xl' : currentPrompt.length > 50 ? 'text-xl md:text-2xl lg:text-3xl' : 'text-2xl md:text-3xl lg:text-4xl'}
            `}>
               "{currentPrompt}"
            </h2>

            {isConnected && isAudioEnabled && (
               <div className="mt-6 flex justify-center items-center gap-1 h-8">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-1 bg-white/90 rounded-full animate-[bounce_1s_infinite]" style={{ animationDelay: `${i * 0.1}s`, height: '40%' }}></div>
                  ))}
               </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Analysis Loading Overlay */}
      {isAnalyzing && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 text-white">
            <Loader2 className="w-12 h-12 animate-spin mb-4 text-flow-purple" />
            <h3 className="text-2xl font-serif">Analyzing your session...</h3>
            <p className="text-white/60 mt-2">Generating your personalized report card</p>
        </div>
      )}

      {/* Feedback Report Modal */}
      {showFeedbackModal && feedback && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 md:p-8">
           <div className="bg-white rounded-3xl max-w-2xl w-full max-h-full overflow-y-auto shadow-2xl animate-in fade-in zoom-in duration-300">
              <div className="p-6 md:p-8">
                 <div className="flex justify-between items-start mb-6">
                    <div>
                       <h3 className="text-2xl font-serif font-bold text-flow-dark">Session Report</h3>
                       <p className="text-gray-500 text-sm">AI Analysis & Feedback</p>
                    </div>
                    <button 
                      onClick={() => setShowFeedbackModal(false)}
                      className="p-2 hover:bg-gray-100 rounded-full transition"
                    >
                       <X className="text-gray-400" />
                    </button>
                 </div>

                 {/* Score Card */}
                 <div className="flex items-center gap-6 mb-8 bg-flow-bg p-6 rounded-2xl border border-flow-purple/20">
                    <div className="relative w-24 h-24 flex-shrink-0 flex items-center justify-center">
                        <svg className="transform -rotate-90 w-24 h-24">
                            <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-200" />
                            <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={276} strokeDashoffset={276 - (276 * feedback.score / 100)} className="text-flow-purple transition-all duration-1000 ease-out" />
                        </svg>
                        <span className="absolute text-2xl font-bold text-flow-purple">{feedback.score}</span>
                    </div>
                    <div>
                        <h4 className="font-bold text-lg mb-1">Overall Score</h4>
                        <p className="text-gray-600 text-sm leading-relaxed">{feedback.summary}</p>
                    </div>
                 </div>

                 <div className="grid md:grid-cols-2 gap-6 mb-8">
                    {/* Strengths */}
                    <div>
                       <div className="flex items-center gap-2 mb-3 text-emerald-600 font-bold">
                          <Award size={18} />
                          <h4>Strengths</h4>
                       </div>
                       <ul className="space-y-2">
                          {feedback.strengths.map((strength, i) => (
                             <li key={i} className="bg-emerald-50 p-3 rounded-xl text-sm text-emerald-800 border border-emerald-100">
                                {strength}
                             </li>
                          ))}
                       </ul>
                    </div>

                    {/* Tips */}
                    <div>
                       <div className="flex items-center gap-2 mb-3 text-flow-pink font-bold">
                          <Lightbulb size={18} />
                          <h4>Tips for Improvement</h4>
                       </div>
                       <ul className="space-y-2">
                          {feedback.tips.map((tip, i) => (
                             <li key={i} className="bg-red-50 p-3 rounded-xl text-sm text-red-800 border border-red-100">
                                {tip}
                             </li>
                          ))}
                       </ul>
                    </div>
                 </div>

                 {/* Video Description */}
                 <div className="bg-gray-50 rounded-xl p-5 border border-gray-100 mb-6">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 text-flow-purple font-bold">
                            <Share2 size={18} />
                            <h4>Suggested Social Description</h4>
                        </div>
                        <button 
                            onClick={() => copyToClipboard(feedback.videoDescription)}
                            className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-flow-dark transition"
                        >
                            {copySuccess ? <CheckCircle size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            {copySuccess ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-gray-200 text-sm text-gray-600 whitespace-pre-wrap font-mono leading-relaxed">
                        {feedback.videoDescription}
                    </div>
                 </div>
                 
                 <div className="text-center">
                     <button 
                        onClick={() => setShowFeedbackModal(false)}
                        className="bg-flow-dark text-white px-8 py-3 rounded-full font-medium hover:bg-black transition shadow-lg hover:shadow-xl"
                     >
                        Start New Session
                     </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Notification Toast */}
      {showSaveNotification && (
        <div className="absolute top-24 left-1/2 transform -translate-x-1/2 bg-emerald-500/90 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-xl z-40 flex items-center gap-2 animate-bounce">
          <CheckCircle size={20} />
          <span className="font-medium">Recording saved to device</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm flex items-center gap-2">
          <X size={16} />
          {error}
        </div>
      )}

      {/* Bottom Controls */}
      <div className={`
          absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/60 via-black/30 to-transparent z-20 transition-opacity duration-300
          ${showFeedbackModal ? 'opacity-0 pointer-events-none' : 'opacity-100'}
      `}>
        <div className="flex items-center justify-between">
          
          {/* Left Tools */}
          <div className="flex gap-3">
            <button 
              onClick={() => setIsAudioEnabled(!isAudioEnabled)}
              title={`Toggle Silent Mode (M)`}
              className={`
                flex items-center gap-2 px-5 py-3 rounded-full transition-all duration-200 backdrop-blur-md border font-medium shadow-lg
                ${isAudioEnabled 
                  ? 'bg-white/10 border-white/20 text-white hover:bg-white/20' 
                  : 'bg-red-500/20 border-red-500/50 text-red-100 hover:bg-red-500/30'
                }
              `}
            >
               {isAudioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
               <span className="text-sm">{isAudioEnabled ? 'AI Voice On' : 'Silent Mode'}</span>
            </button>
          </div>

          {/* Main Action Button */}
          <div className="flex items-center gap-6 absolute left-1/2 transform -translate-x-1/2 bottom-6">
             <button 
                onClick={handleToggleSession}
                title="Start/Stop Recording (Space)"
                disabled={(isConnecting && !isRecording) || isAnalyzing} 
                className={`
                  w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 transform hover:scale-105 shadow-2xl border-4
                  ${isRecording 
                    ? 'bg-white border-red-500 text-red-500 ring-4 ring-red-500/30' 
                    : 'bg-red-500 border-white/30 text-white hover:bg-red-400'
                  }
                  ${((isConnecting && !isRecording) || isAnalyzing) ? 'opacity-50 cursor-wait' : ''}
                  ${!hasPermissions ? 'opacity-30 cursor-not-allowed' : ''}
                `}
             >
                {(isConnecting && !isRecording) || isAnalyzing ? (
                  <Loader2 className="w-8 h-8 animate-spin" />
                ) : isRecording ? (
                  <div className="w-8 h-8 bg-current rounded-md" /> 
                ) : (
                  <div className="w-8 h-8 bg-current rounded-full" /> 
                )}
             </button>
          </div>

          {/* Right Tools */}
          <div className="flex gap-4 text-white/80">
            <button 
              className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition backdrop-blur-md"
              title="Settings (S)"
            >
               <Settings size={20} />
            </button>
            <button className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition backdrop-blur-md">
               <Maximize2 size={20} />
            </button>
          </div>
        </div>
        
        {!hasPermissions && (
            <div className="text-center text-white/60 text-sm mt-2">
                Please allow camera and microphone access to continue.
            </div>
        )}
      </div>
    </div>
  );
}