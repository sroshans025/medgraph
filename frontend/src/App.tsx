import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { Upload } from './pages/Upload';
import { Analysis } from './pages/Analysis';
import { KnowledgeGraph } from './pages/KnowledgeGraph';
import { History } from './pages/History';
import { apiService } from './services/api';
import type { DiagnosticResult, Report } from './services/api';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeCase, setActiveCase] = useState<DiagnosticResult | null>(null);
  const [history, setHistory] = useState<DiagnosticResult[]>([]);

  // 1. Initial hydration: Load timeline case history on mount
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await apiService.getHistory();
        setHistory(data);
      } catch (e) {
        console.error('Failed to load history list:', e);
      }
    };
    fetchHistory();
  }, []);

  // 2. Callback when scan analysis finishes successfully
  const handleAnalysisComplete = (result: DiagnosticResult) => {
    setActiveCase(result);
    setHistory((prev) => [result, ...prev]);
    setActiveTab('analysis');
  };

  // 3. Callback when active case is chosen from dashboard or history
  const handleSelectCase = async (caseId: string) => {
    try {
      const detailedCase = await apiService.getCase(caseId);
      setActiveCase(detailedCase);
      setActiveTab('analysis');
    } catch (e) {
      console.error('Failed to load case detail:', e);
    }
  };

  // 4. Submit revised draft report version to DB
  const handleSaveReport = async (editedReport: Report, notes: string) => {
    if (!activeCase) return;
    try {
      const updatedCase = await apiService.updateReport(
        activeCase.case_id,
        editedReport,
        notes
      );
      
      // Update active state and sync history list
      setActiveCase(updatedCase);
      setHistory((prev) => 
        prev.map(c => c.case_id === updatedCase.case_id ? updatedCase : c)
      );
    } catch (e) {
      console.error('Failed to save report revision:', e);
      throw e;
    }
  };

  // Switch rendering of pages components based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            history={history}
            onSelectCase={handleSelectCase}
            onNavigateToUpload={() => setActiveTab('upload')}
          />
        );
      case 'upload':
        return <Upload onAnalysisComplete={handleAnalysisComplete} />;
      case 'analysis':
        return activeCase ? (
          <Analysis 
            activeCase={activeCase} 
            onSaveReport={handleSaveReport} 
          />
        ) : null;
      case 'graph':
        return activeCase ? <KnowledgeGraph activeCase={activeCase} /> : null;
      case 'history':
        return <History history={history} onSelectCase={handleSelectCase} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex bg-[#060913] text-gray-100 min-h-screen">
      {/* Navigation Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        hasActiveCase={!!activeCase} 
      />

      {/* Main Workspace Frame */}
      <main className="flex-1 overflow-y-auto px-10 py-8 max-w-7xl mx-auto w-full">
        {renderContent()}
      </main>
    </div>
  );
};

export default App;
