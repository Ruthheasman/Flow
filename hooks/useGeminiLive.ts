
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
  isTeleprompterActive: boolean;
  topic: string;
  script?: string;
}

const insightCardTool: FunctionDeclaration = {
  name: 'createInsightCard',
  description: 'Display a visual card with a short title and fact/summary.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      content: { type: Type.STRING },
    },
    required: ['title', 'content'],
  },
};

export const useGeminiLive = ({ videoElementRef, selectedMode, isAudioEnabled, isTeleprompterActive, topic, script }: UseGeminiLiveProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState<string>("Ready to record...");
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
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const historyRef = useRef<{role: 'user' | 'model', text: string}[]>([]);
  
  const isSendingFrame = useRef(false);

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
    for (const source of sourcesRef.current) {
      try { source.stop(); } catch (e) {}
    }
    sourcesRef.current.clear();
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close().catch(() => {});
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close().catch(() => {});
      outputAudioContextRef.current = null;
    }
    sessionRef.current = null;
    setIsConnected(false);
    setIsConnecting(false);
    setActiveInsight(null);
  }, []);

  // Strict mute handling for Teleprompter sessions
  useEffect(() => {
    if (gainNodeRef.current && outputAudioContextRef.current) {
      const shouldMute = !isAudioEnabled || isTeleprompterActive;
      const targetGain = shouldMute ? 0 : 1;
      gainNodeRef.current.gain.setTargetAtTime(targetGain, outputAudioContextRef.current.currentTime, 0.05);
    }
  }, [isAudioEnabled, isTeleprompterActive]);

  const connect = async () => {
    if (!process.env.API_KEY || isConnecting || isConnected) return;

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
      gainNode.gain.value = (isAudioEnabled && !isTeleprompterActive) ? 1 : 0;
      gainNode.connect(outputCtx.destination);
      gainNodeRef.current = gainNode;

      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;
      nextStartTimeRef.current = 0;

      const stream = videoElementRef.current?.srcObject as MediaStream;
      if (!stream) throw new Error("Video stream not initialized");

      let finalSystemInstruction = selectedMode.systemInstruction;
      if (topic) finalSystemInstruction += `\n\nTOPIC: "${topic}".`;
      
      if (script && script.trim().length > 0) {
        finalSystemInstruction += `\n\nTELEPROMPTER MODE IS ACTIVE. THE USER IS READING A SCRIPT.
        CRITICAL: DO NOT INTERRUPT. DO NOT SPEAK. 
        Only observe and transcribe. You are a silent recorder right now. 
        If and only if the user stops reading and asks you a direct question, you may answer briefly.`;
      }

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
            // Throttled to 2 seconds per frame to significantly reduce browser overhead during recording
            videoIntervalRef.current = window.setInterval(() => {
              if (videoElementRef.current && ctx && !isSendingFrame.current && videoElementRef.current.readyState >= 2) {
                isSendingFrame.current = true;
                canvas.width = 320; 
                canvas.height = 180;
                ctx.drawImage(videoElementRef.current, 0, 0, canvas.width, canvas.height);
                
                const dataUrl = canvas.toDataURL('image/jpeg', 0.4);
                const base64 = dataUrl.split(',')[1];
                
                sessionPromise.then(session => {
                  session.sendRealtimeInput({ media: { mimeType: 'image/jpeg', data: base64 } });
                }).catch(() => {}).finally(() => {
                  isSendingFrame.current = false;
                });
              }
            }, 2000); 
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'createInsightCard') {
                  const args = fc.args as any;
                  // Only show insights if teleprompter is OFF to avoid distraction
                  if (!isTeleprompterActive) {
                    setActiveInsight({
                      id: Math.random().toString(36).substr(2, 9),
                      title: args.title,
                      content: args.content,
                      timestamp: Date.now()
                    });
                    setTimeout(() => setActiveInsight(null), 8000);
                  }
                  sessionPromise.then(session => session.sendToolResponse({
                    functionResponses: { id: fc.id, name: fc.name, response: { result: "ok" } }
                  }));
                }
              }
            }

            if (message.serverContent?.interrupted) {
              for (const source of sourcesRef.current) {
                try { source.stop(); } catch (e) {}
              }
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
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
               // DO NOT update UI prompt if teleprompter is active (prevents flicker and script obstruction)
               if (!isTeleprompterActive) {
                 setCurrentPrompt(prev => (prev === "Listening..." ? text : (prev + text).slice(-300)));
               }
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
              source.onended = () => sourcesRef.current.delete(source);
              source.start(startTime);
              nextStartTimeRef.current = startTime + audioBuffer.duration;
              sourcesRef.current.add(source);
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
