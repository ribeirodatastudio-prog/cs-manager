import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { Play, Pause, FastForward } from 'lucide-react';
import GaragePanel from './GaragePanel';
import TimingTower from './TimingTower';
import TrackMap from './TrackMap';
import { QualifyingView } from './QualifyingView';
import { RaceControlView } from './RaceControlView';
import { DebugInspector } from './DebugInspector';
import { PostRaceSummary } from './PostRaceSummary';
import { TeamRadioFeed } from './TeamRadioFeed';

const Dashboard = () => {
  const { gameState, actions, season, economy, getPlayerTeam, isRacePaused, raceSpeed } = useGame();
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
           {gameState === 'RACE' && (
              <div className="flex items-center gap-2">
                 <button
                    onClick={actions.togglePause}
                    className={`flex items-center gap-2 px-4 py-2 rounded transition-colors text-white shadow-lg font-bold ${isRacePaused ? 'bg-green-600 hover:bg-green-500' : 'bg-amber-600 hover:bg-amber-500'}`}
                 >
                    {isRacePaused ? <Play size={16} /> : <Pause size={16} />}
                    <span>{isRacePaused ? "RESUME" : "PAUSE"}</span>
                 </button>
                 <button
                    onClick={() => {
                        const nextSpeed = raceSpeed === 1 ? 2 : raceSpeed === 2 ? 10 : 1;
                        actions.setRaceSpeed(nextSpeed);
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded transition-colors text-white bg-slate-700 hover:bg-slate-600 shadow-lg font-bold min-w-[100px] justify-center"
                 >
                    <FastForward size={16} />
                    <span>{raceSpeed}x</span>
                 </button>
              </div>
           )}
           {gameState !== 'HQ' && gameState !== 'RACE' && (
              <div className="px-4 py-2 bg-slate-800 rounded text-sm text-gray-400 border border-slate-700">
                 MANUAL DEBUG MODE
              </div>
           )}
           <button
              onClick={actions.hardReset}
              className="px-4 py-2 rounded transition-colors text-white bg-red-600 hover:bg-red-500 shadow-lg font-bold text-xs"
           >
              HARD RESET
           </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 grid grid-cols-12 gap-1 p-1 overflow-hidden">
        {/* Left: Garage (2 cols) */}
        <section className="col-span-2 bg-slate-900/50 border border-slate-800 rounded overflow-hidden flex flex-col">
          <GaragePanel />
        </section>

        {/* Center: View Switcher (6 cols) */}
        <section className="col-span-6 bg-slate-900/50 border border-slate-800 rounded overflow-hidden flex flex-col relative">
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
           {gameState === 'RACE' ? (
              <TeamRadioFeed />
           ) : gameState === 'QUALIFYING' ? (
              <DebugInspector driverId={selectedDriverId} />
           ) : (
              <TrackMap />
           )}
        </section>
      </main>

      {gameState === 'RESULTS' && <PostRaceSummary />}
    </div>
  );
};

export default Dashboard;
