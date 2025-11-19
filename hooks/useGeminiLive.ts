import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { base64ToUint8Array, float32To16BitPCM, arrayBufferToBase64, decodeAudioData } from '../utils/audio';
import { ModeConfig, SessionFeedback, InsightCard } from '../types';

const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-09-2025';
const ANALYSIS_MODEL_NAME = 'gemini-2.5-flash';

interface UseGeminiLiveProps {
  videoElementRef: React.RefObject<HTMLVideoElement>;
  selectedMode: ModeConfig;
  isAudioEnabled: boolean;
  topic: string;
}

// Tool Declaration for Insight Cards
const insightCardTool: FunctionDeclaration = {
  name: 'createInsightCard',
  description: 'Display a visual card on the user\'s screen with a short title and fact/summary to support what is being discussed. Use this when the user mentions a specific term, concept, or historical event that warrants a visual highlight.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: 'The short, punchy title for the card (e.g., "Quantum Entanglement", "1984").',
      },
      content: {
        type: Type.STRING,
        description: 'A brief, 1-sentence definition or interesting fact about the title.',
      },
    },
    required: ['title', 'content'],
  },
};

export const useGeminiLive = ({ videoElementRef, selectedMode, isAudioEnabled, topic }: UseGeminiLiveProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState<string>("Press Start to begin your session...");
  const [activeInsight, setActiveInsight] = useState<InsightCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs to keep track of session and audio context without triggering re-renders
  const sessionRef = useRef<any>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const videoIntervalRef = useRef<number | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // History tracking for analysis
  const historyRef = useRef<{role: 'user' | 'model', text: string}[]>([]);
  
  // Helper to cleanup resources
  const cleanup = useCallback(() => {
    if (videoIntervalRef.current) {
      window.clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
      gainNodeRef.current = null;
    }
    if (sessionRef.current) {
       sessionRef.current = null;
    }
    setIsConnected(false);
    setIsConnecting(false);
    setActiveInsight(null);
  }, []);

  // Handle Audio Toggle dynamically
  useEffect(() => {
    if (gainNodeRef.current && outputAudioContextRef.current) {
      const targetGain = isAudioEnabled ? 1 : 0;
      gainNodeRef.current.gain.setTargetAtTime(targetGain, outputAudioContextRef.current.currentTime, 0.1);
    }
  }, [isAudioEnabled]);

  const connect = async () => {
    if (!process.env.API_KEY) {
      setError("API Key not found. Please check your environment configuration.");
      return;
    }
    if (isConnecting || isConnected) return;

    setIsConnecting(true);
    setError(null);
    historyRef.current = []; // Reset history

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // 1. Setup Audio Contexts
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // Setup Gain Node for Volume Control (Mute/Unmute)
      const gainNode = outputCtx.createGain();
      gainNode.gain.value = isAudioEnabled ? 1 : 0;
      gainNode.connect(outputCtx.destination);
      gainNodeRef.current = gainNode;

      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;
      nextStartTimeRef.current = 0;

      // 2. Get Media Stream (Audio & Video)
      const stream = videoElementRef.current?.srcObject as MediaStream;
      if (!stream) {
        throw new Error("Video stream not initialized");
      }

      // 3. Prepare System Instruction with Topic
      let finalSystemInstruction = selectedMode.systemInstruction;
      if (topic && topic.trim().length > 0) {
        finalSystemInstruction += `\n\nIMPORTANT SESSION CONTEXT:\nThe user has specified the following topic/goal for this session: "${topic}".\nEnsure your questions, prompts, and guidance are strictly grounded in this topic.`;
      }
      finalSystemInstruction += `\n\nVISUAL TOOLS: You have access to a 'createInsightCard' tool. Use it proactively to display visual summaries, definitions, or key facts on the user's screen when they mention something interesting. This enhances the video production value.`;

      // 4. Initialize Session
      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Connection Opened");
            setIsConnected(true);
            setIsConnecting(false);
            setCurrentPrompt("Listening...");

            // Start Audio Streaming
            const source = inputCtx.createMediaStreamSource(stream);
            sourceRef.current = source;
            
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmData = float32To16BitPCM(inputData);
              const base64Data = arrayBufferToBase64(pcmData);
              
              sessionPromise.then(session => {
                session.sendRealtimeInput({
                  media: {
                    mimeType: 'audio/pcm;rate=16000',
                    data: base64Data
                  }
                });
              });
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);

            // Start Video Streaming (1 FPS)
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            videoIntervalRef.current = window.setInterval(() => {
              if (videoElementRef.current && ctx) {
                canvas.width = videoElementRef.current.videoWidth * 0.25; 
                canvas.height = videoElementRef.current.videoHeight * 0.25;
                ctx.drawImage(videoElementRef.current, 0, 0, canvas.width, canvas.height);
                
                const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
                
                sessionPromise.then(session => {
                    session.sendRealtimeInput({
                        media: {
                            mimeType: 'image/jpeg',
                            data: base64
                        }
                    });
                });
              }
            }, 1000); 
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Tool Calls (Insight Cards)
            if (message.toolCall) {
              const responses = [];
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'createInsightCard') {
                  const args = fc.args as any;
                  console.log("Insight Card Triggered:", args);
                  setActiveInsight({
                    id: Math.random().toString(36).substr(2, 9),
                    title: args.title,
                    content: args.content,
                    timestamp: Date.now()
                  });

                  // Hide card automatically after 10 seconds
                  setTimeout(() => {
                     setActiveInsight(prev => {
                        // Only clear if it's the same card (check logic could be stricter)
                        if (prev && prev.title === args.title) return null;
                        return prev;
                     });
                  }, 10000);
                  
                  responses.push({
                    id: fc.id,
                    name: fc.name,
                    response: { result: "Card displayed successfully" }
                  });
                }
              }
              
              // Send response back to model so it continues flow
              if (responses.length > 0) {
                 sessionPromise.then(session => {
                    session.sendToolResponse({
                       functionResponses: responses
                    });
                 });
              }
            }

            // Handle Input Transcription (User)
            if (message.serverContent?.inputTranscription) {
               const text = message.serverContent.inputTranscription.text;
               if (text) {
                   const lastEntry = historyRef.current[historyRef.current.length - 1];
                   if (lastEntry && lastEntry.role === 'user') {
                       lastEntry.text += text;
                   } else {
                       historyRef.current.push({ role: 'user', text });
                   }
               }
            }

            // Handle Output Transcription (AI)
            if (message.serverContent?.outputTranscription) {
               const text = message.serverContent?.outputTranscription?.text || "";
               
               setCurrentPrompt(prev => {
                 if (prev === "Listening...") return text;
                 return prev + text;
               });

               if (text) {
                   const lastEntry = historyRef.current[historyRef.current.length - 1];
                   if (lastEntry && lastEntry.role === 'model') {
                       lastEntry.text += text;
                   } else {
                       historyRef.current.push({ role: 'model', text });
                   }
               }
            }

            if (message.serverContent?.turnComplete) {
               console.log("Turn complete");
               setTimeout(() => setCurrentPrompt(""), 3000); 
            }

            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current && gainNodeRef.current) {
              const ctx = outputAudioContextRef.current;
              const audioData = base64ToUint8Array(base64Audio);
              const audioBuffer = await decodeAudioData(audioData, ctx, 24000, 1);
              
              const now = ctx.currentTime;
              const startTime = Math.max(nextStartTimeRef.current, now);
              
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(gainNodeRef.current); 
              source.start(startTime);
              
              nextStartTimeRef.current = startTime + audioBuffer.duration;
            }
          },
          onclose: () => {
            console.log("Session Closed");
            cleanup();
          },
          onerror: (e) => {
            console.error("Session Error", e);
            setError("Connection failed. Please check your network.");
            cleanup();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO], 
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } 
          },
          systemInstruction: finalSystemInstruction,
          tools: [{ functionDeclarations: [insightCardTool] }],
          outputAudioTranscription: { },
          inputAudioTranscription: { }, 
        }
      });

      sessionRef.current = sessionPromise;

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to connect");
      setIsConnecting(false);
      setIsConnected(false);
    }
  };

  const disconnect = () => {
    cleanup();
    setCurrentPrompt("Session ended.");
  };

  // New function to analyze the session history
  const generateSessionReport = async (): Promise<SessionFeedback | null> => {
      if (historyRef.current.length === 0) return null;

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const transcript = historyRef.current.map(entry => `${entry.role.toUpperCase()}: ${entry.text}`).join('\n');
      
      try {
        const response = await ai.models.generateContent({
            model: ANALYSIS_MODEL_NAME,
            contents: `Analyze this transcript of a video practice session. 
            Mode context: ${selectedMode.description}
            User defined topic: ${topic || 'None'}
            
            Transcript:
            ${transcript}
            
            Provide feedback in JSON format with:
            - score (0-100) based on clarity, confidence, and content relevance to the topic.
            - summary (one sentence summary of what was discussed)
            - videoDescription (a complete, engaging video description suitable for YouTube, including emojis and hashtags)
            - strengths (array of 3 strings)
            - tips (array of 3 strings for improvement)
            `,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        score: { type: Type.NUMBER },
                        summary: { type: Type.STRING },
                        videoDescription: { type: Type.STRING },
                        strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                        tips: { type: Type.ARRAY, items: { type: Type.STRING } }
                    }
                }
            }
        });
        
        if (response.text) {
            return JSON.parse(response.text) as SessionFeedback;
        }
        return null;

      } catch (e) {
          console.error("Analysis failed", e);
          return null;
      }
  };

  return {
    connect,
    disconnect,
    generateSessionReport,
    isConnected,
    isConnecting,
    currentPrompt,
    activeInsight,
    error
  };
};