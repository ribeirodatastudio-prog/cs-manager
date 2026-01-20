import { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback, type ReactNode } from 'react';
import { type Team, initializeSeason, type Driver } from '../engine/grid';
import { type Track, generateTrack } from '../engine/track';
import { calculateQualifyingPace, simulateLap, type LapAnalysis } from '../engine/race';
import { STAT_NAMES } from '../engine/data';
import { calculateStatCost } from '../engine/mathUtils';
import { processTeamEvolution } from '../engine/evolution';

export type GameState = 'START' | 'HQ' | 'QUALIFYING' | 'RACE' | 'RESULTS';

interface RaceResult {
  driverId: string;
  driverName: string;
  flag: string;
  teamName: string;
  totalTime: number;
  gapToLeader: number;
  gapToAhead: number; // For UI and future calculations
  lapsCompleted: number;
  lastLapTime: number;
  bestLapTime: number;
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

  turnReport: string[];

  actions: {
    startNewGame: (teamName: string, driver1Name: string, driver2Name: string) => void;
    startQualifying: () => void;
    startRace: () => void;
    simulateTick: () => void; // Simulates one lap for everyone
    completeRace: () => void; // Instantly finish (Simulate Now)
    nextRace: () => void;
    upgradeStat: (driverId: string, statName: string) => void;
    hardReset: () => void;
  };
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const STORAGE_KEY = 'formula-idle-save-v2';

export const GameProvider = ({ children }: { children: ReactNode }) => {
  // Load saved data once on mount
  const [initialData] = useState(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
           return JSON.parse(saved);
        }
      }
    } catch (e) {
      console.error("Failed to load save", e);
    }
    return {};
  });

  // State
  const [gameState, setGameState] = useState<GameState>(initialData.gameState || 'START');
  const [grid, setGrid] = useState<Team[]>(initialData.grid || []);
  const [playerTeamId, setPlayerTeamId] = useState<string | null>(initialData.playerTeamId || null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(initialData.currentTrack || null);
  const [points, setPoints] = useState(initialData.points || 0);
  const [raceNumber, setRaceNumber] = useState(initialData.raceNumber || 1);
  const [standings, setStandings] = useState<{ drivers: Record<string, number>; teams: Record<string, number> }>(initialData.standings || { drivers: {}, teams: {} });
  const [debugData, setDebugData] = useState<Record<string, LapAnalysis>>({});
  const [turnReport, setTurnReport] = useState<string[]>([]);

  const [raceData, setRaceData] = useState<{
    currentLap: number;
    results: RaceResult[];
    qualifyingResults: { driverId: string; time: number; sectors: [number, number, number] }[];
    isRaceFinished: boolean;
  }>(initialData.raceData || {
    currentLap: 0,
    results: [],
    qualifyingResults: [],
    isRaceFinished: false,
  });

  // Derived State (Memoized instead of Effect)
  const driverMap = useMemo(() => {
    const newMap = new Map<string, Driver>();
    grid.forEach(team => {
      team.drivers.forEach(driver => {
        newMap.set(driver.id, driver);
      });
    });
    return newMap;
  }, [grid]);

  // Refs for stable access in actions
  const gridRef = useRef(grid);
  const driverMapRef = useRef(driverMap);
  const playerTeamIdRef = useRef(playerTeamId);
  const currentTrackRef = useRef(currentTrack);
  const pointsRef = useRef(points);
  const standingsRef = useRef(standings);
  const raceDataRef = useRef(raceData);

  // Sync refs
  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { driverMapRef.current = driverMap; }, [driverMap]);
  useEffect(() => { playerTeamIdRef.current = playerTeamId; }, [playerTeamId]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { pointsRef.current = points; }, [points]);
  useEffect(() => { standingsRef.current = standings; }, [standings]);
  useEffect(() => { raceDataRef.current = raceData; }, [raceData]);

  // Persistence: Save on change (debounced or on key events)
  useEffect(() => {
    if (gameState === 'START') return;
    const data = {
      gameState, grid, playerTeamId, currentTrack, points, raceNumber, raceData, standings
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [gameState, grid, playerTeamId, currentTrack, points, raceNumber, raceData, standings]);

  const getPlayerTeam = useCallback(() => {
    return grid.find(t => t.id === playerTeamId) || null;
  }, [grid, playerTeamId]);

  // Stable helper using refs
  const handleRaceFinish = useCallback((results: RaceResult[]) => {
      const currentGrid = gridRef.current;
      const currentPlayerTeamId = playerTeamIdRef.current;
      const currentStandings = standingsRef.current;

      const playerTeam = currentGrid.find(t => t.id === currentPlayerTeamId);
      let earnedPoints = 0;

      const newDriverStandings = { ...currentStandings.drivers };
      const newTeamStandings = { ...currentStandings.teams };

      // Find fastest lap
      let fastestLapTime = Infinity;
      let fastestDriverId: string | null = null;

      results.forEach(r => {
        if (r.bestLapTime > 0 && r.bestLapTime < fastestLapTime) {
          fastestLapTime = r.bestLapTime;
          fastestDriverId = r.driverId;
        }
      });

      results.forEach(r => {
         // Championship Points: 41 - Rank
         let champPts = 41 - r.rank;

         // Currency Points: (41 - Rank) / 10
         let moneyPts = (41 - r.rank) / 10;
         if (moneyPts < 0.1) moneyPts = 0.1;

         // Bonus for fastest lap
         if (r.driverId === fastestDriverId) {
            champPts += 0.1;
            moneyPts += 0.1;
         }

         if (playerTeam?.drivers.some(d => d.id === r.driverId)) {
            earnedPoints += moneyPts;
         }

         // Update Standings (Championship Points)
         if (newDriverStandings[r.driverId] !== undefined) {
            newDriverStandings[r.driverId] += champPts;
         } else {
            newDriverStandings[r.driverId] = champPts;
         }

         const driver = currentGrid.flatMap(t => t.drivers).find(d => d.id === r.driverId);
         if (driver) {
             if (newTeamStandings[driver.teamId] !== undefined) {
                 newTeamStandings[driver.teamId] += champPts;
             } else {
                 newTeamStandings[driver.teamId] = champPts;
             }
         }
      });

      // Team Evolution
      const evolution = processTeamEvolution(currentGrid);
      setGrid(evolution.newGrid);
      setTurnReport(evolution.logs);

      setStandings({ drivers: newDriverStandings, teams: newTeamStandings });
      setPoints((p: number) => p + earnedPoints);
      setGameState('RESULTS');
  }, []);

  const actions = useMemo(() => ({
    startNewGame: (teamName: string, driver1Name: string, driver2Name: string) => {
      const newGrid = initializeSeason();
      // Replace Rank 20 with Player
      const playerTeam = newGrid[newGrid.length - 1];
      playerTeam.name = teamName;
      playerTeam.id = 'player-team';

      // Override stats to Level 1 for Player
      playerTeam.drivers.forEach(driver => {
        const newStats: any = {};
        STAT_NAMES.forEach(stat => newStats[stat] = 1);
        driver.stats = newStats;
        driver.totalStats = STAT_NAMES.length;
      });
      playerTeam.totalStats = STAT_NAMES.length * playerTeam.drivers.length;

      if (playerTeam.drivers.length > 0) playerTeam.drivers[0].name = driver1Name;
      if (playerTeam.drivers.length > 1) playerTeam.drivers[1].name = driver2Name;
      playerTeam.drivers.forEach(d => d.teamId = playerTeam.id);

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
      const track = currentTrackRef.current;
      const grid = gridRef.current;
      if (!track) return;

      const qResults = grid.flatMap(team => team.drivers).map(driver => {
        const result = calculateQualifyingPace(driver, track);
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
          flag: d.flag || '🏳️',
          teamName: grid.find(t => t.id === d.teamId)?.name || '',
          totalTime: 0,
          gapToLeader: 0,
          gapToAhead: 0,
          lapsCompleted: 0,
          lastLapTime: 0,
          bestLapTime: Infinity,
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
      setRaceData(prev => {
        const staggeredResults = prev.results.map(r => {
           // We use the qualifying result order to determine the grid slot
           const qualyIndex = prev.qualifyingResults.findIndex(q => q.driverId === r.driverId);
           const startRank = qualyIndex + 1;
           const stagger = (startRank - 1) * 0.5;

           return {
              ...r,
              totalTime: stagger,
              gapToLeader: stagger,
              gapToAhead: startRank === 1 ? 0 : 0.5
           };
        });

        return {
           ...prev,
           results: staggeredResults.sort((a, b) => a.rank - b.rank)
        };
      });
      setGameState('RACE');
    },

    simulateTick: () => {
      const track = currentTrackRef.current;
      const raceData = raceDataRef.current;
      const driverMap = driverMapRef.current;

      if (!track || raceData.isRaceFinished) return;

      const prev = raceData;
      const nextLap = prev.currentLap + 1;
      const isLastLap = nextLap > track.laps;

      const currentStandings = [...prev.results].sort((a, b) => {
          if (prev.currentLap === 0) return a.rank - b.rank;
          return a.totalTime - b.totalTime;
      });

      // OPTIMIZATION: O(N) lookup maps for the loop
      const qualifyingLookup = new Map<string, { time: number, rank: number }>();
      prev.qualifyingResults.forEach((q, index) => {
         qualifyingLookup.set(q.driverId, { time: q.time, rank: index + 1 });
      });

      const standingsIndexMap = new Map<string, number>();
      currentStandings.forEach((s, index) => {
         standingsIndexMap.set(s.driverId, index);
      });

      const newDebugData: Record<string, LapAnalysis> = {};

      const newResults = prev.results.map(r => {
         if (r.status === 'Finished') return r;

         const driver = driverMap.get(r.driverId);
         if (!driver) return r;

         const qData = qualifyingLookup.get(r.driverId);
         const qTime = qData?.time || 300;

         const myIndex = standingsIndexMap.get(r.driverId);
         const carAhead = (myIndex !== undefined && myIndex > 0) ? currentStandings[myIndex - 1] : null;

         let conditions = null;
         if (carAhead) {
            const carAheadDriver = driverMap.get(carAhead.driverId);
            const gap = r.totalTime - carAhead.totalTime;
            const currentRank = (myIndex ?? 0) + 1;
            const expectedRank = qData?.rank || 0;

            conditions = {
              gapToAhead: gap < 0 ? 0 : gap,
              carAheadInstincts: carAheadDriver?.stats.Instincts || 0,
              currentRank,
              expectedRank
            };
         }

         const lapResult = simulateLap(driver, track, qTime, conditions);

         // Store Debug Data
         newDebugData[driver.id] = lapResult.analysis;

         const lapTime = lapResult.lapTime;

         const actualLapTime = lapResult.lapTime;

         return {
           ...r,
           totalTime: r.totalTime + lapTime,
           lastLapTime: actualLapTime,
           bestLapTime: (actualLapTime < r.bestLapTime) ? actualLapTime : r.bestLapTime,
           lapsCompleted: nextLap,
           penalty: !lapResult.overtakeSuccess && (conditions?.gapToAhead || 10) < 3.0 && (conditions?.currentRank || 0) > (conditions?.expectedRank || 0)
         };
      });

      setDebugData(newDebugData);

      const finishedResults = newResults.map(r => {
         if (r.lapsCompleted >= track.laps) {
            return { ...r, status: 'Finished' as const };
         }
         return r;
      });

      const sortedResults = [...finishedResults].sort((a, b) => a.totalTime - b.totalTime);

      const leader = sortedResults[0];
      const finalResults = sortedResults.map((r, idx) => {
         const carAhead = idx > 0 ? sortedResults[idx - 1] : null;
         const gapToAhead = carAhead ? r.totalTime - carAhead.totalTime : 0;

         return {
            ...r,
            rank: idx + 1,
            gapToLeader: r.totalTime - leader.totalTime,
            gapToAhead
         };
      });

      const allFinished = finalResults.every(r => r.status === 'Finished');

      setRaceData({
         ...prev,
         results: finalResults,
         currentLap: isLastLap ? track.laps : nextLap,
         isRaceFinished: allFinished
      });

      if (allFinished) {
        handleRaceFinish(finalResults);
      }
    },

    completeRace: () => {
       handleRaceFinish(raceDataRef.current.results);
    },

    nextRace: () => {
      setRaceNumber((n: number) => n + 1);
      setCurrentTrack(generateTrack());
      setGameState('HQ');
    },

    upgradeStat: (driverId: string, statName: string) => {
       const currentPoints = pointsRef.current;
       setGrid(prevGrid => prevGrid.map(team => ({
          ...team,
          drivers: team.drivers.map(d => {
             if (d.id !== driverId) return d;

             const currentVal = (d.stats as any)[statName];

             if (statName === 'Consistency' && currentVal >= 100) return d;

             const cost = calculateStatCost(currentVal);

             if (currentPoints >= cost) {
                setPoints((p: number) => p - cost);
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
    },

    hardReset: () => {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    }
  }), [handleRaceFinish]);

  const value = useMemo(() => ({
    gameState, setGameState, grid, playerTeamId, getPlayerTeam, currentTrack,
    economy: { points },
    season: { raceNumber, totalRaces: 40, standings },
    raceData,
    debugData,
    turnReport,
    actions
  }), [gameState, grid, playerTeamId, getPlayerTeam, currentTrack, points, raceNumber, standings, raceData, debugData, turnReport, actions]);

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) throw new Error("useGame must be used within GameProvider");
  return context;
};
