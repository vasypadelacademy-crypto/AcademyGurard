import * as React from 'react';
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { DataProvider } from './lib/DataContext';
import MasterData from './pages/MasterData';
import Players from './pages/Players';
import Dashboard from './pages/Dashboard';
import Schedule from './pages/Schedule';
import Payments from './pages/Payments';
import Reminders from './pages/Reminders';
import Profit from './pages/Profit';
import PlayerDetail from './pages/PlayerDetail';
import PlayerReport from './pages/PlayerReport';
import TeamMessages from './pages/TeamMessages';

// Simplified ErrorBoundary using property-based approach or just a wrapper for now
const SimpleErrorFallback = ({ error }: { error: any }) => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-8 text-center font-sans">
    <div className="mb-6 rounded-full bg-red-500/20 p-4 text-red-500">
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    </div>
    <h1 className="mb-4 text-2xl font-black text-white uppercase italic">System Alert</h1>
    <p className="max-w-md text-sm font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
      An unexpected condition occurred.
    </p>
    <button 
      onClick={() => window.location.reload()}
      className="mt-8 rounded-xl bg-blue-600 px-8 py-3 text-[10px] font-black text-white uppercase tracking-widest hover:bg-blue-500"
    >
      Retry
    </button>
  </div>
);

export default function App() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Prevent escape key issues if any
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  return (
    <DataProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
             <Route path="/" element={<Dashboard />} />
             <Route path="/players" element={<Players />} />
             <Route path="/players/:id" element={<PlayerDetail />} />
             <Route path="/schedule" element={<Schedule defaultView="week" defaultGroupBy="group" />} />
             <Route path="/attendance" element={<Schedule defaultView="list" defaultGroupBy="group" />} />
             <Route path="/team-messages" element={<TeamMessages />} />
             <Route path="/payments" element={<Payments />} />
             <Route path="/reminders" element={<Reminders />} />
             <Route path="/profit" element={<Profit />} />
             <Route path="/master" element={<MasterData />} />
             <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
          <Route path="/players/:id/report" element={<PlayerReport />} />
        </Routes>
      </BrowserRouter>
    </DataProvider>
  );
}
