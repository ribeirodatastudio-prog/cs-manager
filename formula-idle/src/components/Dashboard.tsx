import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { Play } from 'lucide-react';
import GaragePanel from './GaragePanel';
import TimingTower from './TimingTower';
import TrackMap from './TrackMap';
import { QualifyingView } from './QualifyingView';
import { RaceControlView } from './RaceControlView';
import { DebugInspector } from './DebugInspector';

const Dashboard = () => {
  const { gameState, actions, season, economy, getPlayerTeam } = useGame();
  const playerTeam = getPlayerTeam();
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  // Manual trigger for HQ -> Qualy
  const handleStartQualifying = () => {
      actions.startQualifying();
  };

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-200 overflow-hidden font-mono">
      {/* Top Bar */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
             <span className="text-xs text-slate-500 uppercase">Team</span>
             <span className="font-bold text-race-gold">{playerTeam?.name}</span>
          </div>
          <div className="flex flex-col">
             <span className="text-xs text-slate-500 uppercase">Season Race</span>
             <span className="font-bold">{season.raceNumber} / {season.totalRaces}</span>
          </div>
          <div className="flex flex-col">
             <span className="text-xs text-slate-500 uppercase">Funds</span>
             <span className="font-bold text-emerald-400">{economy.points.toLocaleString()} PTS</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
           {gameState === 'HQ' && (
             <button
                onClick={handleStartQualifying}
                className="flex items-center gap-2 px-4 py-2 rounded transition-colors text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg"
              >
                <Play size={16} />
                <span className="text-sm font-bold">START QUALIFYING</span>
              </button>
           )}
           {gameState !== 'HQ' && (
              <div className="px-4 py-2 bg-slate-800 rounded text-sm text-gray-400 border border-slate-700">
                 MANUAL DEBUG MODE
              </div>
           )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 grid grid-cols-12 gap-1 p-1 overflow-hidden">
        {/* Left: Garage (3 cols) */}
        <section className="col-span-3 bg-slate-900/50 border border-slate-800 rounded overflow-hidden flex flex-col">
          <GaragePanel />
        </section>

        {/* Center: View Switcher (5 cols) */}
        <section className="col-span-5 bg-slate-900/50 border border-slate-800 rounded overflow-hidden flex flex-col relative">
           {gameState === 'QUALIFYING' ? (
              <QualifyingView />
           ) : gameState === 'RACE' ? (
              <RaceControlView onSelectDriver={setSelectedDriverId} selectedDriverId={selectedDriverId} />
           ) : (
              <TimingTower />
           )}
        </section>

        {/* Right: Debug/Map (4 cols) */}
        <section className="col-span-4 bg-slate-900/50 border border-slate-800 rounded overflow-hidden flex flex-col">
           {gameState === 'QUALIFYING' || gameState === 'RACE' ? (
              <DebugInspector driverId={selectedDriverId} />
           ) : (
              <TrackMap />
           )}
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
