import React, { useState } from 'react';
import { VideoInterface } from './components/VideoInterface';
import { ModeConfig, ModeType } from './types';
import { Sparkles, Mic, BookOpen, Wind } from 'lucide-react';

const MODES: ModeConfig[] = [
  {
    id: ModeType.INTERVIEW,
    label: 'Interview Me',
    description: 'The AI acts as a podcast host interviewing you about your life or work.',
    systemInstruction: 'You are a charismatic and curious podcast host. You are interviewing the user via video. Ask short, engaging, open-ended questions one at a time about what they are doing, their life, or their ideas. React enthusiastically to their answers before asking the next question. Keep the tone friendly and professional.',
    color: 'bg-flow-purple'
  },
  {
    id: ModeType.TOPIC_DEEP_DIVE,
    label: 'Topic Deep Dive',
    description: 'Pick a topic and the AI will grill you on the details.',
    systemInstruction: 'You are an expert researcher helping the user explore a specific topic. The user will mention a topic. Ask probing, detailed questions to help them flesh out their thoughts. If they struggle, offer a prompt to help them keep going.',
    color: 'bg-flow-blue'
  },
  {
    id: ModeType.TUTORIAL_GUIDE,
    label: 'Tutorial Assistant',
    description: 'Create a tutorial while the AI reminds you what to cover next.',
    systemInstruction: 'You are a video production assistant. The user is recording a tutorial. Listen to what they explain. If they pause for too long, suggest the next logical step or ask "What comes next?". Keep your interventions brief and helpful.',
    color: 'bg-flow-green'
  }
];

export default function App() {
  const [activeModeId, setActiveModeId] = useState<ModeType>(ModeType.INTERVIEW);

  const activeMode = MODES.find(m => m.id === activeModeId) || MODES[0];

  return (
    <div className="min-h-screen bg-flow-bg text-flow-dark font-sans selection:bg-flow-pink selection:text-white">
      
      {/* Header */}
      <header className="py-8 px-6 md:px-12 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-flow-pink to-flow-purple flex items-center justify-center shadow-lg shadow-flow-pink/20">
            <Wind className="text-white" size={20} />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight">Flow</h1>
            <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Interactive Video Journal</p>
          </div>
        </div>

        <a 
          href="#" 
          className="hidden md:block text-sm font-medium text-gray-500 hover:text-flow-dark transition"
        >
          My Archive
        </a>
      </header>

      <main className="px-4 md:px-8 pb-12 max-w-7xl mx-auto">
        
        {/* Mode Selector */}
        <div className="mb-8 overflow-x-auto pb-4">
           <div className="flex gap-4 md:justify-center min-w-max">
             {MODES.map((mode) => {
               const isActive = mode.id === activeModeId;
               const Icon = mode.id === ModeType.INTERVIEW ? Mic : mode.id === ModeType.TOPIC_DEEP_DIVE ? Sparkles : BookOpen;
               
               return (
                 <button
                    key={mode.id}
                    onClick={() => setActiveModeId(mode.id)}
                    className={`
                      relative flex items-center gap-3 px-6 py-3 rounded-2xl transition-all duration-300 border-2
                      ${isActive 
                        ? 'bg-white border-flow-purple shadow-lg scale-105 z-10' 
                        : 'bg-white/50 border-transparent hover:bg-white hover:border-gray-200 text-gray-500'
                      }
                    `}
                 >
                    <div className={`p-2 rounded-lg ${isActive ? 'bg-gray-100 text-flow-purple' : 'bg-gray-100 text-gray-400'}`}>
                       <Icon size={18} />
                    </div>
                    <div className="text-left">
                      <div className={`text-sm font-bold ${isActive ? 'text-flow-dark' : 'text-gray-500'}`}>{mode.label}</div>
                    </div>
                 </button>
               )
             })}
           </div>
        </div>

        {/* Context Description */}
        <div className="text-center mb-8 max-w-2xl mx-auto">
            <p className="text-gray-500">{activeMode.description}</p>
        </div>

        {/* Main Video Interface */}
        <VideoInterface mode={activeMode} />

      </main>
    </div>
  );
}