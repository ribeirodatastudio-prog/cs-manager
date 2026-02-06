import React, { useState, useEffect } from 'react';
import { Bot } from '@/lib/engine/Bot';
import { MatchState, BuyStrategy } from '@/lib/engine/types';
import { TeamEconomyManager } from '@/lib/engine/TeamEconomyManager';
import { TeamSide, ECONOMY } from '@/lib/engine/constants';
import { Tactic } from '@/lib/engine/TacticsManager';
import { TACTIC_ROLES } from '@/lib/engine/tacticRoles';

interface SituationRoomProps {
  bots: Bot[];
  matchState: MatchState;
  onConfirm: (tStrategy: BuyStrategy, tTactic: Tactic, ctStrategy: BuyStrategy, ctTactic: Tactic, roleOverrides: Record<string, string>) => void;
}

const BUY_STRATEGIES: BuyStrategy[] = ["FULL", "FORCE", "HALF", "ECO", "BONUS", "HERO"];
const T_TACTICS: Tactic[] = ["DEFAULT", "RUSH_A", "RUSH_B", "EXECUTE_A", "EXECUTE_B", "SPLIT_A", "SPLIT_B", "CONTACT_A", "CONTACT_B"];
const CT_TACTICS: Tactic[] = ["STANDARD", "AGGRESSIVE_PUSH", "GAMBLE_STACK_A", "GAMBLE_STACK_B", "RETAKE_SETUP"];

export const SituationRoom: React.FC<SituationRoomProps> = ({ bots, matchState, onConfirm }) => {
  const [activeTab, setActiveTab] = useState<TeamSide>(TeamSide.T);
  const [tStrategy, setTStrategy] = useState<BuyStrategy>("FULL");
  const [ctStrategy, setCtStrategy] = useState<BuyStrategy>("FULL");
  const [tTactic, setTTactic] = useState<Tactic>("DEFAULT");
  const [ctTactic, setCtTactic] = useState<Tactic>("STANDARD");

  // Mapping: Role Name -> Bot ID
  // specific for each side to persist state when switching tabs
  const [tAssignments, setTAssignments] = useState<Record<string, string>>({});
  const [ctAssignments, setCtAssignments] = useState<Record<string, string>>({});

  // Economy Stats State
  const [stats, setStats] = useState({
      totalBank: 0,
      estimatedSpend: 0,
      minNextRound: 0
  });

  const activeBots = bots.filter(b => b.side === activeTab && b.status === "ALIVE");
  const activeStrategy = activeTab === TeamSide.T ? tStrategy : ctStrategy;
  const setStrategy = activeTab === TeamSide.T ? setTStrategy : setCtStrategy;
  const activeTactic = activeTab === TeamSide.T ? tTactic : ctTactic;
  const setTactic = activeTab === TeamSide.T ? setTTactic : setCtTactic;
  const activeAssignments = activeTab === TeamSide.T ? tAssignments : ctAssignments;
  const setAssignments = activeTab === TeamSide.T ? setTAssignments : setCtAssignments;
  const AVAILABLE_TACTICS = activeTab === TeamSide.T ? T_TACTICS : CT_TACTICS;

  // Initialize Default Assignments (Random fill)
  useEffect(() => {
     // Initial fill for T
     const tBots = bots.filter(b => b.side === TeamSide.T && b.status === "ALIVE");
     const tRoles = TACTIC_ROLES["DEFAULT"];
     const initialT: Record<string, string> = {};
     tRoles.forEach((r, i) => {
         if (tBots[i]) initialT[r.name] = tBots[i].id;
     });
     setTAssignments(initialT);

     // Initial fill for CT
     const ctBots = bots.filter(b => b.side === TeamSide.CT && b.status === "ALIVE");
     const ctRoles = TACTIC_ROLES["STANDARD"];
     const initialCt: Record<string, string> = {};
     ctRoles.forEach((r, i) => {
         if (ctBots[i]) initialCt[r.name] = ctBots[i].id;
     });
     setCtAssignments(initialCt);
  }, [bots]); // Only on mount/bots change

  // Handle Tactic Change (Smart Persistence)
  const handleTacticChange = (newTactic: Tactic) => {
      setTactic(newTactic);

      const newRoles = TACTIC_ROLES[newTactic];
      const newAssignments: Record<string, string> = {};
      const assignedBotIds = new Set<string>();

      // 1. Persist by Exact Role Name Match
      // Get current bot-to-role mapping
      const currentBotToRole: Record<string, string> = {}; // BotID -> RoleName
      Object.entries(activeAssignments).forEach(([role, botId]) => {
          currentBotToRole[botId] = role;
      });

      // For each new role, see if we can find a bot that HAD this role
      newRoles.forEach(role => {
          // Find bot who had this role name
          const previousBotId = Object.keys(currentBotToRole).find(bid => currentBotToRole[bid] === role.name);
          if (previousBotId && !assignedBotIds.has(previousBotId)) {
              newAssignments[role.name] = previousBotId;
              assignedBotIds.add(previousBotId);
          }
      });

      // 2. Persist by "Assignment Index" (Stability fallback)
      // If we switched tactics, and roles are different, try to keep Bot A in Slot 1, Bot B in Slot 2...
      // This prevents complete shuffle.
      const unassignedRoles = newRoles.filter(r => !newAssignments[r.name]);
      const unassignedBots = activeBots.filter(b => !assignedBotIds.has(b.id));

      unassignedRoles.forEach((role, idx) => {
           if (unassignedBots[idx]) {
               newAssignments[role.name] = unassignedBots[idx].id;
               assignedBotIds.add(unassignedBots[idx].id);
           }
      });

      setAssignments(newAssignments);
  };

  // Calculate Economy when inputs change
  useEffect(() => {
      // Create BotID -> RoleName map for economy calculation (role affects buy logic?)
      // Currently Economy doesn't strictly depend on role except maybe AWP?
      // But let's pass it anyway.
      const overrides: Record<string, string> = {};
      Object.entries(activeAssignments).forEach(([roleName, botId]) => {
          // We need to map the "Tactic Role Name" to the "Behavior" (Bot.roundRole)
          // The Tactic Role Definition contains the behavior mapping.
          const roleDef = TACTIC_ROLES[activeTactic].find(r => r.name === roleName);
          if (roleDef) {
              overrides[botId] = roleDef.behavior;
          }
      });

      const sideBots = bots.filter(b => b.side === activeTab);
      // Update bots with temporary roles for calculation
      sideBots.forEach(b => {
          if (overrides[b.id]) b.roundRole = overrides[b.id];
      });

      const lossBonus = matchState.lossBonus[activeTab];
      const calculated = TeamEconomyManager.calculateEconomyStats(sideBots, activeTab, activeStrategy, lossBonus);
      setStats(calculated);

  }, [activeTab, tStrategy, ctStrategy, activeAssignments, bots, matchState, activeTactic]);

  const handleAssignmentChange = (roleName: string, botId: string) => {
      setAssignments(prev => {
          const next = { ...prev };

          // If this bot was assigned elsewhere, unassign them there
          const existingRole = Object.keys(next).find(r => next[r] === botId);
          if (existingRole) {
              delete next[existingRole];
          }

          if (botId === "") {
              delete next[roleName];
          } else {
              next[roleName] = botId;
          }
          return next;
      });
  };

  const validateAssignments = () => {
      const tRoles = TACTIC_ROLES[tTactic];
      const ctRoles = TACTIC_ROLES[ctTactic];

      const tValid = tRoles.every(r => tAssignments[r.name]);
      const ctValid = ctRoles.every(r => ctAssignments[r.name]);

      return tValid && ctValid;
  };

  const handleConfirm = () => {
      // Build final overrides map: BotID -> Role Name
      // We pass the SPECIFIC ROLE NAME (e.g. "Anchor A") to the system.
      // TacticsManager will decode this to behavior/zone.
      const overrides: Record<string, string> = {};

      Object.entries(tAssignments).forEach(([role, botId]) => overrides[botId] = role);
      Object.entries(ctAssignments).forEach(([role, botId]) => overrides[botId] = role);

      onConfirm(tStrategy, tTactic, ctStrategy, ctTactic, overrides);
  };

  const currentRoles = TACTIC_ROLES[activeTactic] || [];

  return (
    <div className="fixed inset-0 z-[100] bg-gray-900/95 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-5xl bg-gray-800 border border-gray-700 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">

        {/* Header */}
        <div className="bg-gray-900 p-4 border-b border-gray-700 flex justify-between items-center">
             <div>
                 <h1 className="text-xl font-bold text-white tracking-wider">SITUATION ROOM</h1>
                 <p className="text-xs text-gray-400">Round {matchState.round} Planning Phase</p>
             </div>
             <div className="flex gap-2">
                 <button
                    onClick={() => setActiveTab(TeamSide.T)}
                    className={`px-4 py-2 rounded font-bold ${activeTab === TeamSide.T ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                 >
                    TERRORISTS
                 </button>
                 <button
                    onClick={() => setActiveTab(TeamSide.CT)}
                    className={`px-4 py-2 rounded font-bold ${activeTab === TeamSide.CT ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}
                 >
                    COUNTER-TERRORISTS
                 </button>
             </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 grid grid-cols-12 gap-6">

             {/* Left: Strategy & Economy (3 Cols) */}
             <div className="col-span-3 space-y-6">
                 {/* Strategy Selector */}
                 <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                     <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase">Buy Strategy</h3>
                     <div className="grid grid-cols-2 gap-2">
                         {BUY_STRATEGIES.map(strat => (
                             <button
                                key={strat}
                                onClick={() => setStrategy(strat)}
                                className={`px-2 py-2 text-sm rounded transition-colors ${activeStrategy === strat
                                    ? (activeTab === TeamSide.T ? 'bg-yellow-600 text-white' : 'bg-blue-600 text-white')
                                    : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
                             >
                                {strat}
                             </button>
                         ))}
                     </div>
                 </div>

                 {/* Tactic Selector */}
                 <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600">
                     <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase">Tactic</h3>
                     <select
                        value={activeTactic}
                        onChange={(e) => handleTacticChange(e.target.value as Tactic)}
                        className="w-full bg-gray-600 text-white p-2 rounded border border-gray-500"
                     >
                        {AVAILABLE_TACTICS.map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                     </select>
                 </div>

                 {/* Economy Stats */}
                 <div className="bg-gray-700/50 p-4 rounded-lg border border-gray-600 space-y-3">
                     <h3 className="text-sm font-semibold text-gray-300 mb-1 uppercase">Projected Economy</h3>

                     <div className="flex justify-between items-center">
                         <span className="text-gray-400 text-sm">Total Bank:</span>
                         <span className="text-green-400 font-mono font-bold">${stats.totalBank}</span>
                     </div>
                     <div className="flex justify-between items-center">
                         <span className="text-gray-400 text-sm">Est. Spend:</span>
                         <span className="text-red-400 font-mono font-bold">-${stats.estimatedSpend}</span>
                     </div>
                     <div className="h-px bg-gray-600 my-2"></div>
                     <div className="flex justify-between items-center">
                         <span className="text-gray-400 text-sm">Min Next Round:</span>
                         <span className={`font-mono font-bold ${stats.minNextRound < 2000 ? 'text-red-500' : 'text-yellow-400'}`}>
                             ${stats.minNextRound}
                         </span>
                     </div>
                 </div>
             </div>

             {/* Right: Role Assignments (9 Cols) */}
             <div className="col-span-9 bg-gray-700/30 rounded-lg border border-gray-600 overflow-hidden flex flex-col">
                 <div className="bg-gray-700 p-3 border-b border-gray-600">
                    <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wide">Tactical Role Assignments</h3>
                    <p className="text-xs text-gray-400 mt-1">Assign each active player to a specific tactical role required by the <strong>{activeTactic}</strong> protocol.</p>
                 </div>

                 <div className="overflow-auto flex-1">
                     <table className="w-full text-left">
                         <thead className="bg-gray-800 text-gray-400 text-xs uppercase sticky top-0">
                             <tr>
                                 <th className="p-3 w-1/4">Role</th>
                                 <th className="p-3 w-1/3">Description</th>
                                 <th className="p-3 w-1/4">Assigned Agent</th>
                                 <th className="p-3 w-1/6">Status</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-600">
                             {currentRoles.map((roleDef, idx) => {
                                 const assignedBotId = activeAssignments[roleDef.name];
                                 const assignedBot = activeBots.find(b => b.id === assignedBotId);

                                 return (
                                     <tr key={roleDef.name} className="hover:bg-gray-700/50">
                                         <td className="p-3 align-middle">
                                             <div className="font-bold text-white text-sm">{roleDef.name}</div>
                                             <div className="text-xs text-gray-500 font-mono mt-0.5">{roleDef.behavior}</div>
                                         </td>
                                         <td className="p-3 align-middle text-sm text-gray-300">
                                             {roleDef.description}
                                         </td>
                                         <td className="p-3 align-middle">
                                             <select
                                                value={assignedBotId || ""}
                                                onChange={(e) => handleAssignmentChange(roleDef.name, e.target.value)}
                                                className={`w-full text-sm rounded px-2 py-2 border focus:outline-none focus:border-blue-500 ${!assignedBotId ? 'border-red-500 bg-red-900/20 text-red-200' : 'bg-gray-800 border-gray-600 text-white'}`}
                                             >
                                                 <option value="">-- Select Agent --</option>
                                                 {activeBots.map(bot => {
                                                     // Hide bots assigned to OTHER roles to prevent duplicates,
                                                     // UNLESS it's the bot currently assigned to this role
                                                     const isAssignedElsewhere = Object.entries(activeAssignments).some(([r, bid]) => bid === bot.id && r !== roleDef.name);
                                                     if (isAssignedElsewhere) return null;

                                                     return (
                                                         <option key={bot.id} value={bot.id}>
                                                             {bot.player.name} (${bot.player.inventory?.money})
                                                         </option>
                                                     );
                                                 })}
                                                 {assignedBot && (
                                                     <option value={assignedBot.id}>{assignedBot.player.name} (${assignedBot.player.inventory?.money})</option>
                                                 )}
                                             </select>
                                         </td>
                                         <td className="p-3 align-middle">
                                             {assignedBot ? (
                                                 <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-900 text-green-300">
                                                     Ready
                                                 </span>
                                             ) : (
                                                 <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-900 text-red-300">
                                                     Required
                                                 </span>
                                             )}
                                         </td>
                                     </tr>
                                 );
                             })}
                         </tbody>
                     </table>
                 </div>
             </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-900 p-4 border-t border-gray-700 flex justify-between items-center">
             <div className="text-sm text-gray-400">
                 {validateAssignments()
                    ? <span className="text-green-500 flex items-center gap-2">✓ All roles assigned successfully</span>
                    : <span className="text-red-500 flex items-center gap-2">⚠ Please assign all roles for both teams before confirming</span>
                 }
             </div>
             <button
                onClick={handleConfirm}
                disabled={!validateAssignments()}
                className={`font-bold py-3 px-8 rounded shadow-lg transform transition-transform ${validateAssignments() ? 'bg-green-600 hover:bg-green-700 hover:scale-105 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
             >
                CONFIRM STRATEGY & START ROUND
             </button>
        </div>
      </div>
    </div>
  );
};
