import React, { useState } from 'react';
import { VideoInterface } from './components/VideoInterface';
import { ModeConfig, ModeType } from './types';
import { 
  Sparkles, Mic, BookOpen, Wind, 
  Briefcase, Sun, Heart, Video, Smartphone, 
  GraduationCap, Search, Mic2, User 
} from 'lucide-react';

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

interface Template {
  id: string;
  label: string;
  icon: any;
  mode: ModeType;
  topic: string;
  color: string;
}

const TEMPLATES: Template[] = [
  { id: 'interview', label: 'Job Interview', icon: Briefcase, mode: ModeType.INTERVIEW, topic: 'Job Interview Practice', color: 'text-blue-500' },
  { id: 'diary', label: 'Daily Diary', icon: BookOpen, mode: ModeType.INTERVIEW, topic: 'My Daily Reflection', color: 'text-pink-500' },
  { id: 'gratitude', label: 'Gratitude', icon: Sun, mode: ModeType.TOPIC_DEEP_DIVE, topic: 'Gratitude Journal', color: 'text-amber-500' },
  { id: 'dating', label: 'Dating Bio', icon: Heart, mode: ModeType.INTERVIEW, topic: 'Dating App Video Profile', color: 'text-rose-500' },
  { id: 'vlog', label: 'Daily Vlog', icon: Video, mode: ModeType.INTERVIEW, topic: 'Daily Vlog Update', color: 'text-purple-500' },
  { id: 'app-demo', label: 'App Demo', icon: Smartphone, mode: ModeType.TUTORIAL_GUIDE, topic: 'App Demonstration', color: 'text-indigo-500' },
  { id: 'teach', label: 'Teach Subject', icon: GraduationCap, mode: ModeType.TUTORIAL_GUIDE, topic: 'Teaching a Lesson', color: 'text-emerald-500' },
  { id: 'deep-dive', label: 'Deep Dive', icon: Search, mode: ModeType.TOPIC_DEEP_DIVE, topic: 'Deep Topic Discussion', color: 'text-cyan-500' },
  { id: 'speaking', label: 'Public Speaking', icon: Mic2, mode: ModeType.TOPIC_DEEP_DIVE, topic: 'Public Speaking Practice', color: 'text-orange-500' },
  { id: 'life-story', label: 'Life Story', icon: User, mode: ModeType.INTERVIEW, topic: 'My Life Story', color: 'text-teal-500' },
];

export default function App() {
  const [activeModeId, setActiveModeId] = useState<ModeType>(ModeType.INTERVIEW);
  const [topic, setTopic] = useState<string>("");

  const activeMode = MODES.find(m => m.id === activeModeId) || MODES[0];

  const handleTemplateClick = (template: Template) => {
    setActiveModeId(template.mode);
    setTopic(template.topic);
  };

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
        <div className="mb-6 overflow-x-auto pb-2 no-scrollbar">
           <div className="flex gap-4 md:justify-center min-w-max px-1">
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

        {/* Main Video Interface - Moved Up */}
        <div className="mb-8">
             <VideoInterface mode={activeMode} topic={topic} />
        </div>

        {/* Input and Templates - Moved Down */}
        <div className="flex flex-col-reverse md:flex-col gap-8 max-w-5xl mx-auto">
            
            {/* Topic Input */}
            <div className="max-w-xl mx-auto w-full">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-flow-pink to-flow-purple rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-200"></div>
                <input 
                   type="text" 
                   value={topic}
                   onChange={(e) => setTopic(e.target.value)}
                   placeholder={activeModeId === ModeType.INTERVIEW ? "e.g. My career history..." : activeModeId === ModeType.TUTORIAL_GUIDE ? "e.g. How to bake a cake..." : "e.g. Quantum Physics..."}
                   className="relative w-full px-6 py-4 bg-white border-2 border-transparent focus:border-flow-purple rounded-xl outline-none text-flow-dark placeholder-gray-400 font-medium shadow-sm transition-all"
                />
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 pointer-events-none">
                   <Sparkles size={16} />
                </div>
              </div>
              <p className="text-center text-xs text-gray-400 mt-2 font-medium">
                Customize the topic above or choose a template below
              </p>
            </div>

            {/* Context Description & Quick Start Templates */}
            <div>
                <div className="text-center mb-6 max-w-2xl mx-auto">
                    <p className="text-gray-500 text-sm bg-white/50 inline-block px-4 py-2 rounded-full backdrop-blur-sm">{activeMode.description}</p>
                </div>

                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center gap-2 mb-4 justify-center md:justify-start">
                     <Sparkles size={14} className="text-flow-purple" />
                     <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Quick Start Templates</h3>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {TEMPLATES.map((template) => {
                      const isSelected = topic === template.topic && activeModeId === template.mode;
                      return (
                        <button
                          key={template.id}
                          onClick={() => handleTemplateClick(template)}
                          className={`
                            flex flex-col items-center justify-center p-3 rounded-xl border transition-all duration-200 hover:shadow-md group
                            ${isSelected
                              ? 'bg-white border-flow-purple ring-1 ring-flow-purple shadow-sm' 
                              : 'bg-white/60 border-transparent hover:bg-white hover:border-gray-200'
                            }
                          `}
                        >
                          <div className={`mb-2 p-2 rounded-full bg-gray-50 group-hover:scale-110 transition-transform duration-200 ${template.color}`}>
                            <template.icon size={18} />
                          </div>
                          <span className={`text-xs font-bold text-center leading-tight ${isSelected ? 'text-flow-dark' : 'text-gray-500'}`}>
                            {template.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
            </div>
        </div>

      </main>
    </div>
  );
}