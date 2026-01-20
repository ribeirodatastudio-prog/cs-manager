import { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback, type ReactNode } from 'react';
import { type Team, initializeSeason, type Driver } from '../engine/grid';
import { type Track, generateTrack } from '../engine/track';
import { calculateQualifyingPace, runFullRaceSimulation, type LapAnalysis, type LapSnapshot, type RaceResultSnapshot } from '../engine/race';
import { STAT_NAMES, CAR_STAT_NAMES, ECONOMY } from '../engine/data';
import { calculateStatCost } from '../engine/mathUtils';
import { processTeamEvolution } from '../engine/evolution';

export type GameState = 'START' | 'HQ' | 'QUALIFYING' | 'RACE' | 'RESULTS';

// Use types from race engine
export type FeedMessage = {
  id: string;
  lap: number;
  driverId: string;
  driverName: string;
  type: 'positive' | 'negative' | 'neutral';
  message: string;
  color: string;
};

// Alias locally for compatibility
type RaceResult = RaceResultSnapshot;

interface GameContextType {
  gameState: GameState;
  setGameState: (state: GameState) => void;

  grid: Team[];
  playerTeamId: string | null;
  getPlayerTeam: () => Team | null;

  currentTrack: Track | null;

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

  // Automation State
  isRacePaused: boolean;
  raceSpeed: number;

  debugData: Record<string, LapAnalysis>;

  turnReport: string[];
  teamRadio: FeedMessage[];

  actions: {
    startNewGame: (teamName: string, driver1Name: string, driver2Name: string) => void;
    startQualifying: () => void;
    startRace: () => void;
    simulateTick: () => void; // Advances playback
    completeRace: () => void; // Instantly finish (Skip to end)
    nextRace: () => void;
    togglePause: () => void;
    setRaceSpeed: (speed: number) => void;
    upgradeStat: (driverId: string, statName: string) => void;
    upgradeCarStat: (statName: string) => void;
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

  // Initialize grid with migration for new fields
  const [grid, setGrid] = useState<Team[]>(() => {
    const g = initialData.grid || [];
    // Migration: Ensure new fields exist for old saves
    g.forEach((t: any) => {
        if (t.rdPoints === undefined) t.rdPoints = 0;
        t.drivers.forEach((d: any) => {
            if (d.experiencePoints === undefined) d.experiencePoints = 0;
        });
    });
    return g;
  });

  const [playerTeamId, setPlayerTeamId] = useState<string | null>(initialData.playerTeamId || null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(initialData.currentTrack || null);
  const [raceNumber, setRaceNumber] = useState(initialData.raceNumber || 1);
  const [standings, setStandings] = useState<{ drivers: Record<string, number>; teams: Record<string, number> }>(initialData.standings || { drivers: {}, teams: {} });
  const [debugData, setDebugData] = useState<Record<string, LapAnalysis>>({});
  const [turnReport, setTurnReport] = useState<string[]>([]);
  const [teamRadio, setTeamRadio] = useState<FeedMessage[]>([]);

  // Race History & Playback State
  const [raceHistory, setRaceHistory] = useState<LapSnapshot[]>(initialData.raceHistory || []);
  const [currentPlaybackLap, setCurrentPlaybackLap] = useState<number>(initialData.currentPlaybackLap || 0);

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

  const [isRacePaused, setIsRacePaused] = useState(false);
  const [raceSpeed, setRaceSpeed] = useState(1);

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
  const standingsRef = useRef(standings);
  const raceDataRef = useRef(raceData);
  const raceHistoryRef = useRef(raceHistory);
  const currentPlaybackLapRef = useRef(currentPlaybackLap);

  // Sync refs
  useEffect(() => { gridRef.current = grid; }, [grid]);
  useEffect(() => { driverMapRef.current = driverMap; }, [driverMap]);
  useEffect(() => { playerTeamIdRef.current = playerTeamId; }, [playerTeamId]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);
  useEffect(() => { standingsRef.current = standings; }, [standings]);
  useEffect(() => { raceDataRef.current = raceData; }, [raceData]);
  useEffect(() => { raceHistoryRef.current = raceHistory; }, [raceHistory]);
  useEffect(() => { currentPlaybackLapRef.current = currentPlaybackLap; }, [currentPlaybackLap]);

  // Persistence: Save on change (debounced or on key events)
  useEffect(() => {
    if (gameState === 'START') return;
    const data = {
      gameState, grid, playerTeamId, currentTrack, raceNumber, raceData, standings,
      raceHistory, currentPlaybackLap
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [gameState, grid, playerTeamId, currentTrack, raceNumber, raceData, standings, raceHistory, currentPlaybackLap]);

  const getPlayerTeam = useCallback(() => {
    return grid.find(t => t.id === playerTeamId) || null;
  }, [grid, playerTeamId]);

  // Stable helper using refs
  const handleRaceFinish = useCallback((results: RaceResult[]) => {
      const currentGrid = gridRef.current;
      const currentStandings = standingsRef.current;

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

      // Prepare new grid for point updates
      // We do a deep clone of stats to avoid mutation issues, though we are about to pass it to state.
      // But we also need to pass it to Team Evolution.
      // Let's create a clone first.
      const gridClone = currentGrid.map(t => ({
          ...t,
          drivers: t.drivers.map(d => ({ ...d })),
          car: { ...t.car } // Shallow clone car
      }));

      results.forEach(r => {
         // Championship Points: 41 - Rank
         let champPts = 41 - r.rank;

         // Currency Points: (41 - Rank) / 10
         let moneyPts = (41 - r.rank) / 10;
         if (moneyPts < 0.1) moneyPts = 0.1;

         // Bonus for fastest lap
         if (r.driverId === fastestDriverId) {
            champPts += 1.0;
            moneyPts += 0.1;
         }

         // Find driver in gridClone
         const team = gridClone.find(t => t.drivers.some(d => d.id === r.driverId));
         const driver = team?.drivers.find(d => d.id === r.driverId);

         if (driver && team) {
             driver.experiencePoints = (driver.experiencePoints || 0) + moneyPts;
             team.rdPoints = (team.rdPoints || 0) + moneyPts;
         }

         // Update Standings (Championship Points)
         if (newDriverStandings[r.driverId] !== undefined) {
            newDriverStandings[r.driverId] += champPts;
         } else {
            newDriverStandings[r.driverId] = champPts;
         }

         if (team) {
             if (newTeamStandings[team.id] !== undefined) {
                 newTeamStandings[team.id] += champPts;
             } else {
                 newTeamStandings[team.id] = champPts;
             }
         }
      });

      // Team Evolution
      let evolution = { newGrid: gridClone, logs: [] as string[] };
      try {
          const currentPlayerTeamId = playerTeamIdRef.current;
          evolution = processTeamEvolution(gridClone, currentPlayerTeamId);
      } catch (e) {
          console.error("Team Evolution failed", e);
      }
      setGrid(evolution.newGrid);
      setTurnReport(evolution.logs);

      setStandings({ drivers: newDriverStandings, teams: newTeamStandings });
      setGameState('RESULTS');
  }, []);

  const actions = useMemo(() => ({
    startNewGame: (teamName: string, driver1Name: string, driver2Name: string) => {
      const newGrid = initializeSeason();
      // Replace Rank 20 with Player
      const playerTeam = newGrid[newGrid.length - 1];
      playerTeam.name = teamName;
      playerTeam.id = 'player-team';

      // Override stats to Level 1 for Player Drivers
      playerTeam.drivers.forEach(driver => {
        const newStats: any = {};
        STAT_NAMES.forEach(stat => newStats[stat] = 1);
        driver.stats = newStats;
        driver.totalStats = STAT_NAMES.length;
        driver.experiencePoints = 0;
      });

      // Override stats to Level 1 for Player Car
      if (playerTeam.car) {
        const newCarStats: any = {};
        CAR_STAT_NAMES.forEach(stat => newCarStats[stat] = 1);
        playerTeam.car.stats = newCarStats;
        playerTeam.car.totalStats = CAR_STAT_NAMES.length;
        playerTeam.rdPoints = 0;
      }

      playerTeam.totalStats = (STAT_NAMES.length * playerTeam.drivers.length) + (playerTeam.car ? playerTeam.car.totalStats : 0);

      if (playerTeam.drivers.length > 0) playerTeam.drivers[0].name = driver1Name;
      if (playerTeam.drivers.length > 1) playerTeam.drivers[1].name = driver2Name;
      playerTeam.drivers.forEach(d => d.teamId = playerTeam.id);

      setGrid(newGrid);
      setPlayerTeamId(playerTeam.id);
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
        const team = grid.find(t => t.id === driver.teamId);
        // @ts-ignore
        const result = calculateQualifyingPace(driver, team?.car, track);
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
      setTeamRadio([]); // Clear feed
      const track = currentTrackRef.current;
      const grid = gridRef.current;
      const playerTeamId = playerTeamIdRef.current;
      const raceData = raceDataRef.current;

      if (!track) return;

      // Extract Qualifying Order (Driver IDs sorted by Qualy Time)
      // raceData.qualifyingResults is already sorted by time in startQualifying
      const qualifyingOrder = raceData.qualifyingResults.map(q => q.driverId);

      // 1. Run Full Simulation
      const history = runFullRaceSimulation(grid, track, playerTeamId, qualifyingOrder);

      setRaceHistory(history);
      setCurrentPlaybackLap(0);

      // Initialize UI with starting grid (staggered)
      // This logic was previously in startRace.
      // We can replicate the Stagger here for the visual start.
      // Or we can rely on the simulation's initial state if we had it.
      // Let's keep the existing stagger logic for the "Start Line" visual.

      setRaceData(prev => {
        const staggeredResults = prev.results.map(r => {
           const qualyIndex = prev.qualifyingResults.findIndex(q => q.driverId === r.driverId);
           const startRank = qualyIndex + 1;
           const stagger = (startRank - 1) * 0.5;

           return {
              ...r,
              totalTime: stagger,
              gapToLeader: stagger,
              gapToAhead: startRank === 1 ? 0 : 0.5,
              lapsCompleted: 0
           };
        });

        return {
           ...prev,
           results: staggeredResults.sort((a, b) => a.rank - b.rank),
           currentLap: 0,
           isRaceFinished: false
        };
      });

      setGameState('RACE');
    },

    simulateTick: () => {
      // Advances playback by one lap
      const history = raceHistoryRef.current;
      const currentLapIndex = currentPlaybackLapRef.current;
      const track = currentTrackRef.current;

      if (!track) return;
      if (currentLapIndex >= history.length) {
         // Already finished?
         if (!raceDataRef.current.isRaceFinished) {
            handleRaceFinish(raceDataRef.current.results);
         }
         return;
      }

      const nextLapIndex = currentLapIndex + 1; // 1-based lap number effectively
      // history[0] is Lap 1 results. history[currentLapIndex] is the NEXT result to show.

      const snapshot = history[currentLapIndex]; // Get next snapshot

      if (!snapshot) return;

      // Update Data
      setRaceData(prev => ({
        ...prev,
        currentLap: snapshot.lapNumber,
        results: snapshot.results,
        isRaceFinished: snapshot.lapNumber >= track.laps
      }));

      // Append Messages
      if (snapshot.messages && snapshot.messages.length > 0) {
        setTeamRadio(prev => [...snapshot.messages, ...prev].slice(0, 20));
      }

      setCurrentPlaybackLap(nextLapIndex);

      if (snapshot.lapNumber >= track.laps) {
         handleRaceFinish(snapshot.results);
      }
    },

    completeRace: () => {
       const history = raceHistoryRef.current;
       if (history.length === 0) return;

       const lastSnapshot = history[history.length - 1];

       setRaceData(prev => ({
           ...prev,
           currentLap: lastSnapshot.lapNumber,
           results: lastSnapshot.results,
           isRaceFinished: true
       }));

       setCurrentPlaybackLap(history.length);
       handleRaceFinish(lastSnapshot.results);
    },

    nextRace: () => {
      setRaceNumber((n: number) => n + 1);
      setCurrentTrack(generateTrack());
      setGameState('HQ');
      setIsRacePaused(false); // Reset pause state
      setRaceSpeed(1); // Reset speed
      setRaceHistory([]);
      setCurrentPlaybackLap(0);
    },

    togglePause: () => {
      setIsRacePaused(prev => !prev);
    },

    setRaceSpeed: (speed: number) => {
      setRaceSpeed(speed);
    },

    upgradeStat: (driverId: string, statName: string) => {
       setGrid(prevGrid => prevGrid.map(team => ({
          ...team,
          drivers: team.drivers.map(d => {
             if (d.id !== driverId) return d;

             const currentVal = (d.stats as any)[statName];

             if (statName === 'Consistency' && currentVal >= 100) return d;

             const cost = calculateStatCost(currentVal);
             const currentPoints = d.experiencePoints || 0;

             if (currentPoints >= cost) {
                return {
                   ...d,
                   experiencePoints: currentPoints - cost,
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

    upgradeCarStat: (statName: string) => {
      setGrid(prevGrid => prevGrid.map(team => {
        if (team.id !== playerTeamIdRef.current) return team;
        if (!team.car) return team;

        const currentVal = (team.car.stats as any)[statName];

        // ECONOMY.CAR_BASE_COST = 10, CAR_COST_EXPONENT = 1.15
        const cost = Math.floor(ECONOMY.CAR_BASE_COST * Math.pow(ECONOMY.CAR_COST_EXPONENT, currentVal - 1));
        const currentRdPoints = team.rdPoints || 0;

        if (currentRdPoints >= cost) {
          return {
            ...team,
            rdPoints: currentRdPoints - cost,
            car: {
              ...team.car,
              stats: {
                ...team.car.stats,
                [statName]: currentVal + 1
              },
              totalStats: team.car.totalStats + 1
            }
          };
        }
        return team;
      }));
    },

    hardReset: () => {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    }
  }), [handleRaceFinish]);

  const value = useMemo(() => ({
    gameState, setGameState, grid, playerTeamId, getPlayerTeam, currentTrack,
    season: { raceNumber, totalRaces: 40, standings },
    raceData,
    isRacePaused,
    raceSpeed,
    debugData,
    turnReport,
    teamRadio,
    actions
  }), [gameState, grid, playerTeamId, getPlayerTeam, currentTrack, raceNumber, standings, raceData, isRacePaused, raceSpeed, debugData, turnReport, teamRadio, actions]);

  // Race Timer Automation
  useEffect(() => {
    if (gameState !== 'RACE' || raceData.isRaceFinished || isRacePaused) return;

    const tick = () => {
      actions.simulateTick();
    };

    // User requested 15 seconds
    const intervalMs = 15000 / raceSpeed;
    const timer = setInterval(tick, intervalMs);

    return () => clearInterval(timer);
  }, [gameState, raceData.isRaceFinished, isRacePaused, raceSpeed, actions]);

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
