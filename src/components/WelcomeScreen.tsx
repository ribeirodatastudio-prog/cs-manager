import { useState } from 'react';
import { useGame } from '../context/GameContext';
import { Play, Shuffle } from 'lucide-react';
import { generateDriverName, generateRandomTeamName } from '../engine/grid';

const WelcomeScreen = () => {
  const { actions } = useGame();
  const [teamName, setTeamName] = useState('');
  const [driver1Name, setDriver1Name] = useState('');
  const [driver2Name, setDriver2Name] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (teamName.trim() && driver1Name.trim() && driver2Name.trim()) {
      actions.startNewGame(teamName, driver1Name, driver2Name);
    }
  };

  const randomizeTeam = () => setTeamName(generateRandomTeamName());
  const randomizeDriver1 = () => setDriver1Name(generateDriverName());
  const randomizeDriver2 = () => setDriver2Name(generateDriverName());

  const isValid = teamName.trim() !== '' && driver1Name.trim() !== '' && driver2Name.trim() !== '';

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
      <div className="max-w-md w-full p-8 bg-slate-900 border border-slate-800 rounded-lg shadow-2xl">
        <h1 className="text-4xl font-bold text-center mb-2 text-race-gold tracking-tighter">
          FORMULA IDLE
        </h1>
        <p className="text-center text-slate-400 mb-8 font-mono text-sm">
          TEAM PRINCIPAL SIMULATION
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wide">
              Team Name
            </label>
            <div className="flex gap-2">
                <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Enter Team Name..."
                className="flex-1 bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded focus:outline-none focus:border-race-purple transition-colors font-mono"
                />
                <button
                    type="button"
                    onClick={randomizeTeam}
                    className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded border border-slate-700 transition-colors"
                    title="Random Team Name"
                >
                    <Shuffle size={18} />
                </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wide">
                  Driver 1
                </label>
                <div className="flex gap-2">
                    <input
                    type="text"
                    value={driver1Name}
                    onChange={(e) => setDriver1Name(e.target.value)}
                    placeholder="Driver 1..."
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-3 rounded focus:outline-none focus:border-race-purple transition-colors font-mono text-sm"
                    />
                    <button
                        type="button"
                        onClick={randomizeDriver1}
                        className="px-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded border border-slate-700 transition-colors"
                        title="Random Driver Name"
                    >
                        <Shuffle size={16} />
                    </button>
                </div>
             </div>
             <div>
                <label className="block text-sm font-bold text-slate-300 mb-2 uppercase tracking-wide">
                  Driver 2
                </label>
                <div className="flex gap-2">
                    <input
                    type="text"
                    value={driver2Name}
                    onChange={(e) => setDriver2Name(e.target.value)}
                    placeholder="Driver 2..."
                    className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-3 rounded focus:outline-none focus:border-race-purple transition-colors font-mono text-sm"
                    />
                    <button
                        type="button"
                        onClick={randomizeDriver2}
                        className="px-2 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded border border-slate-700 transition-colors"
                        title="Random Driver Name"
                    >
                        <Shuffle size={16} />
                    </button>
                </div>
             </div>
          </div>

          <button
            type="submit"
            disabled={!isValid}
            className="w-full bg-race-purple hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded flex items-center justify-center gap-2 transition-all uppercase tracking-widest"
          >
            <Play size={20} />
            Establish Team
          </button>
        </form>
      </div>
    </div>
  );
};

export default WelcomeScreen;
