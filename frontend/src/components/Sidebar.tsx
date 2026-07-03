import React from 'react';
import { 
  LayoutDashboard, 
  UploadCloud, 
  Activity, 
  Share2, 
  History, 
  ActivitySquare
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  hasActiveCase: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  hasActiveCase 
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'upload', label: 'Upload Scan', icon: UploadCloud },
    { 
      id: 'analysis', 
      label: 'Analysis View', 
      icon: Activity, 
      disabled: !hasActiveCase 
    },
    { 
      id: 'graph', 
      label: 'Clinical Graph', 
      icon: Share2, 
      disabled: !hasActiveCase 
    },
    { id: 'history', label: 'Case History', icon: History },
  ];

  return (
    <aside className="w-64 bg-[#090e1a] border-r border-white/5 flex flex-col h-screen sticky top-0">
      {/* Branding Header */}
      <div className="h-20 flex items-center px-6 gap-3 border-b border-white/5 bg-[#0b101f]">
        <ActivitySquare className="h-8 w-8 text-purple-500 animate-pulse" />
        <div>
          <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-purple-300 to-cyan-400 bg-clip-text text-transparent">
            MedGraph AI
          </h1>
          <p className="text-[10px] text-gray-500 tracking-wider uppercase font-semibold">
            Decision Support
          </p>
        </div>
      </div>

      {/* Nav Menu */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isDisabled = item.disabled;

          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && setActiveTab(item.id)}
              disabled={isDisabled}
              className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-purple-600/20 border border-purple-500/30 text-white shadow-lg shadow-purple-500/5'
                  : isDisabled
                  ? 'opacity-30 cursor-not-allowed text-gray-600'
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Icon className={`h-5 w-5 ${isActive ? 'text-purple-400' : 'text-gray-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User Footer Panel */}
      <div className="p-4 border-t border-white/5 bg-[#0b101f] flex items-center gap-3.5">
        <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-purple-600 to-cyan-400 flex items-center justify-center font-bold text-sm text-white shadow-inner">
          DR
        </div>
        <div>
          <p className="text-xs font-semibold text-white">Dr. Clinician</p>
          <p className="text-[10px] text-purple-400 font-medium">Attending Radiologist</p>
        </div>
      </div>
    </aside>
  );
};
