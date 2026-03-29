import React from 'react';

export function CommitTrail() {
  const commits = [
    { id: 'a3f9b2c', title: 'feat: llm_judge evaluator v3', badge: 'PROD', type: 'prod', active: true },
    { id: '7d1e4f8', title: 'fix: pareto weak dominance', badge: 'v2', type: 'test', active: false },
    { id: '2b8c3a1', title: 'init: prompt versioning engine', badge: 'v1', type: 'test', active: false },
  ];

  return (
    <div className="flex flex-col gap-0 pl-2 animate-[fadeUp_0.8s_0.4s_cubic-bezier(0.16,1,0.3,1)_both]">
      {commits.map((commit, i) => (
        <div key={commit.id} className="group flex items-center gap-3 py-2 relative">
          <div className="absolute left-[6px] top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-blue-900/50 to-transparent" />
          <div 
            className={`w-[13px] h-[13px] rounded-full border-2 relative z-10 shrink-0 transition-all duration-300
              ${commit.active 
                ? 'bg-cyan-400 border-cyan-400 shadow-[0_0_12px_rgba(56,200,240,0.7)]' 
                : 'border-blue-500 bg-[#0b1120] shadow-[0_0_8px_rgba(46,120,228,0.5)] group-hover:bg-blue-500 group-hover:shadow-[0_0_14px_rgba(46,120,228,0.8)]'
              }`} 
          />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-[0.72rem] text-[#6a7a99] truncate">
              <strong className="text-[#e8edf8] font-normal">{commit.title.split(': ')[0]}:</strong> {commit.title.split(': ')[1]}
            </span>
            <span className={`text-[0.6rem] px-1.5 py-0.5 rounded font-bold tracking-wider shrink-0
              ${commit.type === 'prod' 
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/25' 
                : 'bg-blue-500/10 text-blue-400 border border-blue-500/25'
              }`}
            >
              {commit.badge}
            </span>
            <span className="ml-auto text-[0.64rem] text-blue-500/70 font-mono tracking-wider">{commit.id}</span>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
