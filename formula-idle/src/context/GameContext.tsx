import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { type Team, initializeSeason } from '../engine/grid';
import { type Track, generateTrack } from '../engine/track';
import { calculateQualifyingPace, simulateLap, type LapAnalysis } from '../engine/race';
import { calculateStatCost } from '../engine/mathUtils';

export type GameState = 'START' | 'HQ' | 'QUALIFYING' | 'RACE' | 'RESULTS';

interface RaceResult {
  driverId: string;
  driverName: string;
  teamName: string;
  totalTime: number;
  gapToLeader: number;
  lapsCompleted: number;
  lastLapTime: number;
  rank: number;
  penalty: boolean; // Just for visual feedback
  status: 'Running' | 'Finished';
}

interface GameContextType {
  gameState: GameState;
  setGameState: (state: GameState) => void;

  grid: Team[];
  playerTeamId: string | null;
  getPlayerTeam: () => Team | null;

  currentTrack: Track | null;

  economy: {
    points: number;
  };

  season: {
    raceNumber: number;
    totalRaces: number;
    standings: {
      drivers: Record<string, number>;
      teams: Record<string, number>;
    };
  };

  raceData: {
    currentLap: number;
    results: RaceResult[];
    qualifyingResults: { driverId: string; time: number; sectors: [number, number, number] }[];
    isRaceFinished: boolean;
  };

  debugData: Record<string, LapAnalysis>;

  actions: {
    startNewGame: (teamName: string) => void;
    startQualifying: () => void;
    startRace: () => void;
    simulateTick: () => void; // Simulates one lap for everyone
    completeRace: () => void; // Instantly finish (Simulate Now)
    nextRace: () => void;
    upgradeStat: (driverId: string, statName: string) => void;
  };
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const STORAGE_KEY = 'formula-idle-save-v1';

export const GameProvider = ({ children }: { children: ReactNode }) => {
  // State
  const [gameState, setGameState] = useState<GameState>('START');
  const [grid, setGrid] = useState<Team[]>([]);
  const [playerTeamId, setPlayerTeamId] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [points, setPoints] = useState(0);
  const [raceNumber, setRaceNumber] = useState(1);
  const [standings, setStandings] = useState<{ drivers: Record<string, number>; teams: Record<string, number> }>({ drivers: {}, teams: {} });
  const [debugData, setDebugData] = useState<Record<string, LapAnalysis>>({});

  const [raceData, setRaceData] = useState<{
    currentLap: number;
    results: RaceResult[];
    qualifyingResults: { driverId: string; time: number; sectors: [number, number, number] }[];
    isRaceFinished: boolean;
  }>({
    currentLap: 0,
    results: [],
    qualifyingResults: [],
    isRaceFinished: false,
  });

  // Persistence: Load on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setGameState(data.gameState || 'START');
        setGrid(data.grid || []);
        setPlayerTeamId(data.playerTeamId || null);
        setCurrentTrack(data.currentTrack || null);
        setPoints(data.points || 0);
        setRaceNumber(data.raceNumber || 1);
        setStandings(data.standings || { drivers: {}, teams: {} });
        setRaceData(data.raceData || { currentLap: 0, results: [], qualifyingResults: [], isRaceFinished: false });
        // debugData is transient, no need to save/load heavily, but maybe useful. Ignoring for now to save space.
      } catch (e) {
        console.error("Failed to load save", e);
      }
    }
  }, []);

  // Persistence: Save on change (debounced or on key events)
  useEffect(() => {
    if (gameState === 'START') return;
    const data = {
      gameState, grid, playerTeamId, currentTrack, points, raceNumber, raceData, standings
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [gameState, grid, playerTeamId, currentTrack, points, raceNumber, raceData, standings]);

  const getPlayerTeam = () => grid.find(t => t.id === playerTeamId) || null;

  const actions = {
    startNewGame: (teamName: string) => {
      const newGrid = initializeSeason();
      // Replace Rank 20 with Player
      const playerTeam = newGrid[newGrid.length - 1];
      playerTeam.name = teamName;
      playerTeam.id = 'player-team';

      setGrid(newGrid);
      setPlayerTeamId(playerTeam.id);
      setPoints(0);
      setRaceNumber(1);

      // Init standings
      const initialDriverStandings: Record<string, number> = {};
      const initialTeamStandings: Record<string, number> = {};
      newGrid.forEach(t => {
        initialTeamStandings[t.id] = 0;
        t.drivers.forEach(d => initialDriverStandings[d.id] = 0);
      });
      setStandings({ drivers: initialDriverStandings, teams: initialTeamStandings });

      // Generate first track
      setCurrentTrack(generateTrack());

      setGameState('HQ');
    },

    startQualifying: () => {
      if (!currentTrack) return;

      const qResults = grid.flatMap(team => team.drivers).map(driver => {
        const result = calculateQualifyingPace(driver, currentTrack!);
        return { driverId: driver.id, time: result.totalTime, sectors: result.sectors };
      });

      qResults.sort((a, b) => a.time - b.time);

      setRaceData(prev => ({
        ...prev,
        qualifyingResults: qResults,
        currentLap: 0,
        results: grid.flatMap(team => team.drivers).map(d => ({
          driverId: d.id,
          driverName: d.name,
          teamName: grid.find(t => t.id === d.teamId)?.name || '',
          totalTime: 0,
          gapToLeader: 0,
          lapsCompleted: 0,
          lastLapTime: 0,
          rank: qResults.findIndex(q => q.driverId === d.id) + 1, // Start rank based on qualy
          penalty: false,
          status: 'Running'
        })),
        isRaceFinished: false
      }));

      setDebugData({}); // Clear debug data
      setGameState('QUALIFYING');
    },

    startRace: () => {
      setGameState('RACE');
    },

    simulateTick: () => {
      if (!currentTrack || raceData.isRaceFinished) return;

      // We need to capture debug data, so we can't just use setRaceData functional update directly
      // if we want to extract the analysis. But we can use a temp variable if we do it outside.
      // However, to keep it clean in React, we'll update debugData separately or use a slightly different pattern.
      // We will perform the logic first, then update both states.

      const prev = raceData;
      const nextLap = prev.currentLap + 1;
      const isLastLap = nextLap > currentTrack.laps;

      const currentStandings = [...prev.results].sort((a, b) => {
          if (prev.currentLap === 0) return a.rank - b.rank;
          return a.totalTime - b.totalTime;
      });

      const newDebugData: Record<string, LapAnalysis> = {};

      const newResults = prev.results.map(r => {
         if (r.status === 'Finished') return r;

         const driver = grid.flatMap(t => t.drivers).find(d => d.id === r.driverId);
         if (!driver) return r;

         const qTime = prev.qualifyingResults.find(q => q.driverId === r.driverId)?.time || 300;

         const myIndex = currentStandings.findIndex(s => s.driverId === r.driverId);
         const carAhead = myIndex > 0 ? currentStandings[myIndex - 1] : null;

         let conditions = null;
         if (carAhead) {
            const carAheadDriver = grid.flatMap(t => t.drivers).find(d => d.id === carAhead.driverId);
            const gap = r.totalTime - carAhead.totalTime;
            const currentRank = myIndex + 1;
            const expectedRank = prev.qualifyingResults.findIndex(q => q.driverId === r.driverId) + 1;

            conditions = {
              gapToAhead: gap < 0 ? 0 : gap,
              carAheadInstincts: carAheadDriver?.stats.Instincts || 0,
              currentRank,
              expectedRank
            };
         }

         const lapResult = simulateLap(driver, currentTrack!, qTime, conditions);

         // Store Debug Data
         newDebugData[driver.id] = lapResult.analysis;

         let lapTime = lapResult.lapTime;
         if (prev.currentLap === 0) {
            const startRank = prev.qualifyingResults.findIndex(q => q.driverId === r.driverId);
            lapTime += startRank * 0.2;
         }

         return {
           ...r,
           totalTime: r.totalTime + lapTime,
           lastLapTime: lapResult.lapTime,
           lapsCompleted: nextLap,
           penalty: !lapResult.overtakeSuccess && (conditions?.gapToAhead || 10) < 3.0 && (conditions?.currentRank || 0) > (conditions?.expectedRank || 0)
         };
      });

      setDebugData(newDebugData);

      const finishedResults = newResults.map(r => {
         if (r.lapsCompleted >= currentTrack.laps) {
            return { ...r, status: 'Finished' as const };
         }
         return r;
      });

      const sortedResults = [...finishedResults].sort((a, b) => a.totalTime - b.totalTime);

      const leader = sortedResults[0];
      const finalResults = sortedResults.map((r, idx) => ({
         ...r,
         rank: idx + 1,
         gapToLeader: r.totalTime - leader.totalTime
        }));

      const allFinished = finalResults.every(r => r.status === 'Finished');

      setRaceData({
         ...prev,
         results: finalResults,
         currentLap: isLastLap ? currentTrack.laps : nextLap,
         isRaceFinished: allFinished
      });
    },

    completeRace: () => {
       // Placeholder
    },

    nextRace: () => {
      const playerTeam = grid.find(t => t.id === playerTeamId);
      let earnedPoints = 0;

      // Update Standings
      const newDriverStandings = { ...standings.drivers };
      const newTeamStandings = { ...standings.teams };

      raceData.results.forEach(r => {
         const pts = 41 - r.rank;

         // Update Player Currency (Driver Points)
         if (playerTeam?.drivers.some(d => d.id === r.driverId)) {
            earnedPoints += pts;
         }

         // Update Championship Standings
         if (newDriverStandings[r.driverId] !== undefined) {
            newDriverStandings[r.driverId] += pts;
         }

         const driver = grid.flatMap(t => t.drivers).find(d => d.id === r.driverId);
         if (driver) {
             // Also update the Driver object in the grid?
             // Actually, grid state is separate. But for persistence we might want to.
             // But we have 'standings' state now.

             if (newTeamStandings[driver.teamId] !== undefined) {
                 newTeamStandings[driver.teamId] += pts;
             }
         }
      });

      setStandings({ drivers: newDriverStandings, teams: newTeamStandings });
      setPoints(p => p + earnedPoints);
      setRaceNumber(n => n + 1);
      setCurrentTrack(generateTrack());
      setGameState('HQ');
    },

    upgradeStat: (driverId: string, statName: string) => {
       setGrid(prevGrid => prevGrid.map(team => ({
          ...team,
          drivers: team.drivers.map(d => {
             if (d.id !== driverId) return d;

             const currentVal = (d.stats as any)[statName];
             const cost = calculateStatCost(currentVal);

             if (points >= cost) {
                setPoints(p => p - cost);
                return {
                   ...d,
                   stats: {
                      ...d.stats,
                      [statName]: currentVal + 1
                   },
                   totalStats: d.totalStats + 1
                };
             }
             return d;
          })
       })));
    }
  };

  return (
    <GameContext.Provider value={{
      gameState, setGameState, grid, playerTeamId, getPlayerTeam, currentTrack,
      economy: { points },
      season: { raceNumber, totalRaces: 40, standings },
      raceData,
      debugData,
      actions
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used within GameProvider");
  return context;
};
