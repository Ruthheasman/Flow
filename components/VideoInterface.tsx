
import React, { useEffect, useRef, useState } from 'react';
import { 
  Video as VideoIcon, Volume2, VolumeX, CheckCircle, Award, 
  Lightbulb, X, Loader2, Settings, Maximize2, Zap, Copy, 
  Share2, FileText, Type as TypeIcon, Play, Pause, RotateCcw, 
  ChevronRight, FastForward
} from 'lucide-react';
import { ModeConfig, SessionFeedback } from '../types';
import { useGeminiLive } from '../hooks/useGeminiLive';

interface VideoInterfaceProps {
  mode: ModeConfig;
  topic: string;
  script?: string;
}

export const VideoInterface: React.FC<VideoInterfaceProps> = ({ mode, topic, script }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [hasPermissions, setHasPermissions] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [showSaveNotification, setShowSaveNotification] = useState<boolean>(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
  
  // Teleprompter State
  const [showScript, setShowScript] = useState<boolean>(false);
  const [scriptFontSize, setScriptFontSize] = useState<number>(32);
  const [scrollSpeed, setScrollSpeed] = useState<number>(2); // 1-10 scale
  const [scrollOffset, setScrollOffset] = useState<number>(0);
  const [isAutoScrolling, setIsAutoScrolling] = useState<boolean>(false);
  
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<SessionFeedback | null>(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const scrollIntervalRef = useRef<number | null>(null);
  
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
    topic,
    script
  });

  // Handle auto-scrolling logic
  useEffect(() => {
    if (isAutoScrolling && showScript) {
      scrollIntervalRef.current = window.setInterval(() => {
        setScrollOffset(prev => prev + (scrollSpeed * 0.5));
      }, 30);
    } else {
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    }
    return () => {
      if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    };
  }, [isAutoScrolling, scrollSpeed, showScript]);

  useEffect(() => {
    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: { ideal: 1920 }, height: { ideal: 1080 } }, 
          audio: true 
        });
        setMediaStream(stream);
        setHasPermissions(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        setHasPermissions(false);
      }
    };
    setupCamera();
    return () => {
      if (mediaStream) mediaStream.getTracks().forEach(track => track.stop());
    };
  }, []);

  const startRecording = () => {
    if (!mediaStream) return;
    chunksRef.current = [];
    setFeedback(null);
    setShowFeedbackModal(false);

    // Prioritize MP4 if supported (Safari), then high-quality WebM
    const supportedTypes = [
      'video/mp4',
      'video/webm; codecs=vp9',
      'video/webm; codecs=vp8',
      'video/webm'
    ];
    const mimeType = supportedTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';

    try {
      const recorder = new MediaRecorder(mediaStream, { mimeType, videoBitsPerSecond: 2500000 });
      recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      recorder.onstop = () => {
        if (Date.now() - startTimeRef.current < 1000) return;
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Adjust extension based on the actual recorded mimeType
        const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
        a.download = `Flow-Recording-${new Date().getTime()}.${extension}`;
        a.click();
        setShowSaveNotification(true);
        setTimeout(() => setShowSaveNotification(false), 3000);
      };
      recorder.start();
      startTimeRef.current = Date.now();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      
      // Auto-start teleprompter if script is active
      if (script && script.trim().length > 0) {
        setShowScript(true);
        setIsAutoScrolling(true);
      }
    } catch (err) {}
  };

  const stopRecording = async () => {
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setIsAutoScrolling(false);
    disconnect(); 
    setIsAnalyzing(true);
    try {
        const report = await generateSessionReport();
        if (report) {
            setFeedback(report);
            setShowFeedbackModal(true);
        }
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleToggleSession = () => {
    if (isRecording) stopRecording();
    else {
      if (!hasPermissions) return;
      connect();
      startRecording();
    }
  };

  return (
    <div className="relative w-full max-w-5xl mx-auto aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl ring-8 ring-white/50 group">
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-start z-10 pointer-events-none">
        <div className="flex flex-col gap-2">
           <div className="flex gap-2">
              {isConnected && (
                <div className="bg-red-500/90 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider animate-pulse shadow-lg flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full"></div>Live
                </div>
              )}
              {isRecording && (
                <div className="bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-white/10 flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>REC
                </div>
              )}
           </div>
        </div>
        <div className="bg-black/20 backdrop-blur-md text-white px-4 py-2 rounded-full flex items-center gap-2 text-sm font-medium border border-white/10">
          <div className={`w-2 h-2 rounded-full ${mode.color}`}></div>{mode.label}
        </div>
      </div>

      {/* Teleprompter Script Overlay */}
      {showScript && script && (
        <div className="absolute inset-0 z-30 flex flex-col items-center pointer-events-none bg-black/20 backdrop-blur-[2px]">
          {/* Reading Guide Marker */}
          <div className="absolute top-[35%] left-0 w-full h-[100px] bg-white/5 border-y border-white/20 z-10 flex items-center justify-between px-4 pointer-events-none">
             <ChevronRight className="text-flow-pink" size={32} />
             <ChevronRight className="text-flow-pink rotate-180" size={32} />
          </div>

          <div className="w-full max-w-3xl h-full flex flex-col items-center pointer-events-auto overflow-hidden">
            {/* Controls Bar for Teleprompter */}
            <div className="mt-4 flex items-center gap-4 bg-black/60 backdrop-blur-xl px-6 py-2 rounded-full border border-white/20 z-40">
              <button onClick={() => setIsAutoScrolling(!isAutoScrolling)} className="text-white hover:text-flow-purple transition p-1">
                {isAutoScrolling ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
              </button>
              <button onClick={() => setScrollOffset(0)} className="text-white hover:text-flow-purple transition p-1">
                <RotateCcw size={18} />
              </button>
              <div className="h-4 w-px bg-white/20 mx-2" />
              <div className="flex items-center gap-3">
                <FastForward size={14} className="text-white/40" />
                <input 
                  type="range" 
                  min="0.5" 
                  max="8" 
                  step="0.5"
                  value={scrollSpeed}
                  onChange={(e) => setScrollSpeed(parseFloat(e.target.value))}
                  className="w-24 accent-flow-purple cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                />
                <span className="text-[10px] font-bold text-white w-4">{scrollSpeed}x</span>
              </div>
              <div className="h-4 w-px bg-white/20 mx-2" />
              <div className="flex items-center gap-2">
                <button onClick={() => setScriptFontSize(Math.max(16, scriptFontSize - 4))} className="text-white hover:text-flow-purple transition"><TypeIcon size={14} /></button>
                <button onClick={() => setScriptFontSize(Math.min(64, scriptFontSize + 4))} className="text-white hover:text-flow-purple transition"><TypeIcon size={20} /></button>
              </div>
              <button onClick={() => setShowScript(false)} className="ml-4 text-white/60 hover:text-white transition"><X size={18} /></button>
            </div>

            {/* The actual scrolling area */}
            <div className="flex-1 w-full overflow-hidden relative mt-8">
                <div 
                  className="w-full px-12 font-serif text-white font-bold transition-transform duration-300 ease-linear text-center leading-[1.4]"
                  style={{ 
                    transform: `translateY(calc(35% - ${scrollOffset}px))`,
                    fontSize: `${scriptFontSize}px`,
                    textShadow: '0 2px 10px rgba(0,0,0,0.8)'
                  }}
                >
                  {script.split('\n').map((line, i) => (
                    <p key={i} className="mb-12 last:mb-[100vh]">{line}</p>
                  ))}
                </div>
            </div>
          </div>
        </div>
      )}

      {/* Insight Card */}
      <div className={`absolute right-8 top-32 z-40 max-w-xs w-full transition-all duration-700 transform ${activeInsight ? 'translate-x-0 opacity-100' : 'translate-x-20 opacity-0 pointer-events-none'}`}>
        <div className="bg-white/10 backdrop-blur-xl border border-white/30 p-5 rounded-2xl shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-flow-purple to-flow-pink"></div>
           <div className="flex items-center gap-2 mb-2 text-flow-blue">
              <Zap size={16} className="animate-pulse" /><span className="text-xs font-bold uppercase tracking-widest">Live Insight</span>
           </div>
           <h3 className="text-white font-serif text-xl font-bold mb-2">{activeInsight?.title}</h3>
           <p className="text-white/90 text-sm leading-relaxed">{activeInsight?.content}</p>
        </div>
      </div>

      {/* Central Prompt (Only visible if not reading script) */}
      <div className={`absolute inset-0 flex items-center justify-center pointer-events-none p-12 z-20 transition-all duration-500 transform ${isConnected && !showScript ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
        <div className="bg-white/20 backdrop-blur-xl border border-white/30 rounded-[2rem] p-10 shadow-2xl text-center relative max-w-3xl w-full">
            <h2 className={`font-serif text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)] leading-tight transition-all duration-300 min-h-[120px] flex items-center justify-center ${currentPrompt.length > 120 ? 'text-xl' : 'text-3xl'}`}>
               "{currentPrompt}"
            </h2>
        </div>
      </div>

      {isAnalyzing && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50 text-white">
            <Loader2 className="w-12 h-12 animate-spin mb-4 text-flow-purple" />
            <h3 className="text-2xl font-serif">Analyzing session...</h3>
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && feedback && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-8">
           <div className="bg-white rounded-3xl max-w-2xl w-full max-h-full overflow-y-auto shadow-2xl p-8">
                 <div className="flex justify-between items-start mb-6">
                    <h3 className="text-2xl font-serif font-bold">Session Report</h3>
                    <button onClick={() => setShowFeedbackModal(false)} className="p-2 hover:bg-gray-100 rounded-full"><X className="text-gray-400" /></button>
                 </div>
                 <div className="flex items-center gap-6 mb-8 bg-flow-bg p-6 rounded-2xl">
                    <div className="text-3xl font-bold text-flow-purple">{feedback.score}</div>
                    <p className="text-gray-600 text-sm leading-relaxed">{feedback.summary}</p>
                 </div>
                 <div className="grid md:grid-cols-2 gap-6 mb-8 text-sm">
                    <div><h4 className="font-bold text-emerald-600 mb-2">Strengths</h4><ul className="space-y-1">{feedback.strengths.map((s, i) => <li key={i}>• {s}</li>)}</ul></div>
                    <div><h4 className="font-bold text-flow-pink mb-2">Tips</h4><ul className="space-y-1">{feedback.tips.map((t, i) => <li key={i}>• {t}</li>)}</ul></div>
                 </div>
                 <button onClick={() => setShowFeedbackModal(false)} className="w-full bg-flow-dark text-white py-3 rounded-full">New Session</button>
           </div>
        </div>
      )}

      {/* Bottom Controls */}
      <div className={`absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/60 via-black/30 to-transparent z-40 transition-opacity duration-300 ${showFeedbackModal ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <button onClick={() => setIsAudioEnabled(!isAudioEnabled)} className={`flex items-center gap-2 px-5 py-3 rounded-full transition-all backdrop-blur-md border font-medium ${isAudioEnabled ? 'bg-white/10 border-white/20 text-white' : 'bg-red-500/20 border-red-500/50 text-red-100'}`}>
               {isAudioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
               <span className="text-sm">{isAudioEnabled ? 'AI Voice On' : 'Silent'}</span>
            </button>
            {script && (
              <button onClick={() => setShowScript(!showScript)} className={`flex items-center gap-2 px-5 py-3 rounded-full transition-all backdrop-blur-md border font-medium ${showScript ? 'bg-flow-purple/20 border-flow-purple/50 text-flow-purple shadow-lg shadow-flow-purple/20' : 'bg-white/10 border-white/20 text-white'}`}>
                 <FileText size={18} />
                 <span className="text-sm">Teleprompter</span>
              </button>
            )}
          </div>
          <button onClick={handleToggleSession} disabled={(isConnecting && !isRecording) || isAnalyzing} className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-2xl border-4 absolute left-1/2 transform -translate-x-1/2 bottom-6 ${isRecording ? 'bg-white border-red-500 text-red-500' : 'bg-red-500 border-white/30 text-white'}`}>
              {(isConnecting && !isRecording) || isAnalyzing ? <Loader2 className="animate-spin" /> : <div className={`w-8 h-8 bg-current ${isRecording ? 'rounded-md' : 'rounded-full'}`} />}
          </button>
          <div className="flex gap-4 text-white/80">
            <button className="p-3 rounded-full bg-white/10 hover:bg-white/20 transition"><Settings size={20} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
