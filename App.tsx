
import React, { useState } from 'react';
import { VideoInterface } from './components/VideoInterface';
import { ModeConfig, ModeType } from './types';
import { 
  Sparkles, Mic, BookOpen, Wind, 
  Briefcase, Sun, Heart, Video, Smartphone, 
  GraduationCap, Search, Mic2, User, FileText, ChevronDown, ChevronUp
} from 'lucide-react';

const MODES: ModeConfig[] = [
  {
    id: ModeType.INTERVIEW,
    label: 'Interview Me',
    description: 'The AI acts as a podcast host interviewing you about your life or work.',
    systemInstruction: 'You are a charismatic and curious podcast host. You are interviewing the user via video. Ask short, engaging, open-ended questions one at a time. React enthusiastically to their answers. If there is a script provided, follow its structure.',
    color: 'bg-flow-purple'
  },
  {
    id: ModeType.TOPIC_DEEP_DIVE,
    label: 'Topic Deep Dive',
    description: 'Pick a topic and the AI will explore it with you.',
    systemInstruction: 'You are an expert researcher helping the user explore a specific topic. Ask probing, detailed questions. If they struggle, offer a prompt based on the topic or their script.',
    color: 'bg-flow-blue'
  },
  {
    id: ModeType.TUTORIAL_GUIDE,
    label: 'Tutorial Assistant',
    description: 'Create a tutorial while the AI reminds you what to cover next.',
    systemInstruction: 'You are a video production assistant. The user is recording a tutorial. Listen to what they explain. If they pause or miss a point in their script, suggest the next logical step.',
    color: 'bg-flow-green'
  }
];

interface Template {
  id: string;
  label: string;
  icon: any;
  mode: ModeType;
  topic: string;
  script?: string;
  color: string;
}

const TEMPLATES: Template[] = [
  { id: 'interview', label: 'Job Interview', icon: Briefcase, mode: ModeType.INTERVIEW, topic: 'Product Manager Interview', color: 'text-blue-500' },
  { id: 'diary', label: 'Daily Diary', icon: BookOpen, mode: ModeType.INTERVIEW, topic: 'Daily Reflection', color: 'text-pink-500' },
  { id: 'gratitude', label: 'Gratitude', icon: Sun, mode: ModeType.TOPIC_DEEP_DIVE, topic: 'What I am grateful for', color: 'text-amber-500' },
  { id: 'app-demo', label: 'App Demo', icon: Smartphone, mode: ModeType.TUTORIAL_GUIDE, topic: 'App Onboarding Flow', script: '1. Introduction to the app\n2. The main problem we solve\n3. Features walkthrough\n4. Conclusion and call to action', color: 'text-indigo-500' },
  { id: 'vlog', label: 'Daily Vlog', icon: Video, mode: ModeType.INTERVIEW, topic: 'Day in my life', color: 'text-purple-500' },
];

export default function App() {
  const [activeModeId, setActiveModeId] = useState<ModeType>(ModeType.INTERVIEW);
  const [topic, setTopic] = useState<string>("");
  const [script, setScript] = useState<string>("");
  const [showScriptInput, setShowScriptInput] = useState<boolean>(false);

  const activeMode = MODES.find(m => m.id === activeModeId) || MODES[0];

  const handleTemplateClick = (template: Template) => {
    setActiveModeId(template.mode);
    setTopic(template.topic);
    if (template.script) {
      setScript(template.script);
      setShowScriptInput(true);
    }
  };

  return (
    <div className="min-h-screen bg-flow-bg text-flow-dark font-sans selection:bg-flow-pink selection:text-white">
      <header className="py-8 px-12 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-flow-pink to-flow-purple flex items-center justify-center shadow-lg shadow-flow-pink/20">
            <Wind className="text-white" size={20} />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight">Flow</h1>
            <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">Interactive Video Journal</p>
          </div>
        </div>
      </header>

      <main className="px-8 pb-12 max-w-7xl mx-auto">
        <div className="mb-6 flex gap-4 justify-center">
           {MODES.map((mode) => (
             <button
                key={mode.id}
                onClick={() => setActiveModeId(mode.id)}
                className={`flex items-center gap-3 px-6 py-3 rounded-2xl transition-all border-2 ${mode.id === activeModeId ? 'bg-white border-flow-purple shadow-lg scale-105' : 'bg-white/50 border-transparent text-gray-500'}`}
             >
                <div className="text-sm font-bold">{mode.label}</div>
             </button>
           ))}
        </div>

        <div className="mb-8">
             <VideoInterface mode={activeMode} topic={topic} script={script} />
        </div>

        <div className="max-w-3xl mx-auto space-y-6">
            <div className="relative group">
                <input 
                   type="text" 
                   value={topic}
                   onChange={(e) => setTopic(e.target.value)}
                   placeholder="Enter your topic..."
                   className="w-full px-6 py-4 bg-white border-2 border-transparent focus:border-flow-purple rounded-xl outline-none text-flow-dark shadow-sm transition-all"
                />
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <button 
                onClick={() => setShowScriptInput(!showScriptInput)}
                className="w-full px-6 py-4 flex items-center justify-between text-sm font-bold text-gray-600 hover:bg-gray-50 transition"
              >
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-flow-purple" />
                  <span>{script ? 'Edit Script' : 'Add a Script'}</span>
                </div>
                {showScriptInput ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              
              {showScriptInput && (
                <div className="p-6 border-t border-gray-100 animate-in slide-in-from-top-2 duration-200">
                  <textarea 
                    value={script}
                    onChange={(e) => setScript(e.target.value)}
                    placeholder="Paste your script here... The AI will help you stay on track and you can view this on a teleprompter while recording."
                    className="w-full h-40 font-serif p-4 bg-flow-bg/50 rounded-xl border border-gray-200 focus:border-flow-purple outline-none resize-none transition-all leading-relaxed"
                  />
                  <p className="text-[10px] text-gray-400 mt-2 uppercase font-bold tracking-widest">
                    AI Director Mode active when script is provided
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 justify-center">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleTemplateClick(t)}
                  className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${topic === t.topic ? 'bg-flow-purple border-flow-purple text-white shadow-md' : 'bg-white border-gray-200 text-gray-500 hover:border-flow-purple'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
        </div>
      </main>
    </div>
  );
}
