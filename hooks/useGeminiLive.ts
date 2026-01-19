
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { base64ToUint8Array, float32To16BitPCM, arrayBufferToBase64, decodeAudioData } from '../utils/audio';
import { ModeConfig, SessionFeedback, InsightCard } from '../types';

const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-12-2025';
const ANALYSIS_MODEL_NAME = 'gemini-3-flash-preview';

interface UseGeminiLiveProps {
  videoElementRef: React.RefObject<HTMLVideoElement>;
  selectedMode: ModeConfig;
  isAudioEnabled: boolean;
  topic: string;
  script?: string;
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

export const useGeminiLive = ({ videoElementRef, selectedMode, isAudioEnabled, topic, script }: UseGeminiLiveProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState<string>("Press Start to begin your session...");
  const [activeInsight, setActiveInsight] = useState<InsightCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<any>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const videoIntervalRef = useRef<number | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  const historyRef = useRef<{role: 'user' | 'model', text: string}[]>([]);
  
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
      inputAudioContextRef.current.close().catch(console.error);
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close().catch(console.error);
      outputAudioContextRef.current = null;
      gainNodeRef.current = null;
    }
    sessionRef.current = null;
    setIsConnected(false);
    setIsConnecting(false);
    setActiveInsight(null);
  }, []);

  useEffect(() => {
    if (gainNodeRef.current && outputAudioContextRef.current) {
      const targetGain = isAudioEnabled ? 1 : 0;
      gainNodeRef.current.gain.setTargetAtTime(targetGain, outputAudioContextRef.current.currentTime, 0.1);
    }
  }, [isAudioEnabled]);

  const connect = async () => {
    if (!process.env.API_KEY) {
      setError("API Key not found.");
      return;
    }
    if (isConnecting || isConnected) return;

    setIsConnecting(true);
    setError(null);
    historyRef.current = [];

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

      if (inputCtx.state === 'suspended') await inputCtx.resume();
      if (outputCtx.state === 'suspended') await outputCtx.resume();
      
      const gainNode = outputCtx.createGain();
      gainNode.gain.value = isAudioEnabled ? 1 : 0;
      gainNode.connect(outputCtx.destination);
      gainNodeRef.current = gainNode;

      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;
      nextStartTimeRef.current = 0;

      const stream = videoElementRef.current?.srcObject as MediaStream;
      if (!stream) throw new Error("Video stream not initialized");

      let finalSystemInstruction = selectedMode.systemInstruction;
      if (topic) {
        finalSystemInstruction += `\n\nTOPIC: "${topic}".`;
      }
      if (script && script.trim().length > 0) {
        finalSystemInstruction += `\n\nUSER SCRIPT: The user has written the following script to follow during this recording: "${script}". Your job is to act as a Director. If they get stuck, deviate significantly, or miss a key point from this script, gently nudge them back on track or ask about the next part of the script.`;
      }
      finalSystemInstruction += `\n\nVISUAL TOOLS: Use 'createInsightCard' to highlight key concepts.`;

      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        callbacks: {
          onopen: () => {
            setIsConnected(true);
            setIsConnecting(false);
            setCurrentPrompt("Listening...");

            const source = inputCtx.createMediaStreamSource(stream);
            sourceRef.current = source;
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            
            processor.onaudioprocess = (e) => {
              if (!sessionRef.current) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmData = float32To16BitPCM(inputData);
              const base64Data = arrayBufferToBase64(pcmData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: { mimeType: 'audio/pcm;rate=16000', data: base64Data } });
              }).catch(() => {});
            };

            source.connect(processor);
            processor.connect(inputCtx.destination);

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            videoIntervalRef.current = window.setInterval(() => {
              if (videoElementRef.current && ctx && sessionRef.current) {
                canvas.width = 320; 
                canvas.height = 180;
                ctx.drawImage(videoElementRef.current, 0, 0, canvas.width, canvas.height);
                const base64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
                sessionPromise.then(session => {
                  session.sendRealtimeInput({ media: { mimeType: 'image/jpeg', data: base64 } });
                }).catch(() => {});
              }
            }, 1000); 
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.toolCall) {
              const responses = [];
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'createInsightCard') {
                  const args = fc.args as any;
                  setActiveInsight({
                    id: Math.random().toString(36).substr(2, 9),
                    title: args.title,
                    content: args.content,
                    timestamp: Date.now()
                  });
                  setTimeout(() => setActiveInsight(null), 8000);
                  responses.push({ id: fc.id, name: fc.name, response: { result: "Card shown" } });
                }
              }
              if (responses.length > 0) {
                 sessionPromise.then(session => session.sendToolResponse({ functionResponses: responses }));
              }
            }

            if (message.serverContent?.inputTranscription) {
               const text = message.serverContent.inputTranscription.text;
               if (text) {
                   const last = historyRef.current[historyRef.current.length - 1];
                   if (last?.role === 'user') last.text += text;
                   else historyRef.current.push({ role: 'user', text });
               }
            }

            if (message.serverContent?.outputTranscription) {
               const text = message.serverContent.outputTranscription.text || "";
               setCurrentPrompt(prev => {
                 if (prev === "Listening...") return text;
                 return (prev + text).slice(-300);
               });
               const last = historyRef.current[historyRef.current.length - 1];
               if (last?.role === 'model') last.text += text;
               else historyRef.current.push({ role: 'model', text });
            }

            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current && gainNodeRef.current) {
              const ctx = outputAudioContextRef.current;
              const audioData = base64ToUint8Array(base64Audio);
              const audioBuffer = await decodeAudioData(audioData, ctx, 24000, 1);
              const startTime = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(gainNodeRef.current); 
              source.start(startTime);
              nextStartTimeRef.current = startTime + audioBuffer.duration;
            }
          },
          onclose: () => cleanup(),
          onerror: () => cleanup()
        },
        config: {
          responseModalities: [Modality.AUDIO], 
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
          systemInstruction: finalSystemInstruction,
          tools: [{ functionDeclarations: [insightCardTool] }],
          outputAudioTranscription: {},
          inputAudioTranscription: {}, 
        }
      });
      sessionRef.current = sessionPromise;
    } catch (err: any) {
      setError(err.message || "Failed to connect");
      cleanup();
    }
  };

  const disconnect = () => {
    cleanup();
    setCurrentPrompt("Session ended.");
  };

  const generateSessionReport = async (): Promise<SessionFeedback | null> => {
      if (historyRef.current.length === 0) return null;
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const transcript = historyRef.current.map(entry => `${entry.role.toUpperCase()}: ${entry.text}`).join('\n');
      try {
        const response = await ai.models.generateContent({
            model: ANALYSIS_MODEL_NAME,
            contents: `Analyze this transcript. Topic: ${topic}, Script: ${script || 'N/A'}\nTranscript:\n${transcript}`,
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
        return response.text ? JSON.parse(response.text) : null;
      } catch (e) {
          return null;
      }
  };

  return { connect, disconnect, generateSessionReport, isConnected, isConnecting, currentPrompt, activeInsight, error };
};
