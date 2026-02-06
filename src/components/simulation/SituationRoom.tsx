import React, { useState, useEffect } from 'react';
import { Bot } from '@/lib/engine/Bot';
import { MatchState, BuyStrategy } from '@/lib/engine/types';
import { TeamEconomyManager } from '@/lib/engine/TeamEconomyManager';
import { TeamSide, WEAPONS } from '@/lib/engine/constants';
import { Tactic } from '@/lib/engine/TacticsManager';
import { TACTIC_ROLES } from '@/lib/engine/tacticRoles';

interface SituationRoomProps {
  bots: Bot[];
  matchState: MatchState;
  onConfirm: (tStrategy: BuyStrategy, tTactic: Tactic, ctStrategy: BuyStrategy, ctTactic: Tactic, roleOverrides: Record<string, string>, buyOverrides: Record<string, BuyStrategy>) => void;
}

const BUY_STRATEGIES: BuyStrategy[] = ["FULL", "FORCE", "HALF", "ECO", "BONUS", "HERO"];
const T_TACTICS: Tactic[] = ["DEFAULT", "RUSH_A", "RUSH_B", "EXECUTE_A", "EXECUTE_B", "SPLIT_A", "SPLIT_B", "CONTACT_A", "CONTACT_B"];
const CT_TACTICS: Tactic[] = ["STANDARD", "AGGRESSIVE_PUSH", "GAMBLE_STACK_A", "GAMBLE_STACK_B", "RETAKE_SETUP"];

export const SituationRoom: React.FC<SituationRoomProps> = ({ bots, matchState, onConfirm }) => {
  const [activeTab, setActiveTab] = useState<TeamSide>(TeamSide.T);

  // Team Strategies
  const [tStrategy, setTStrategy] = useState<BuyStrategy>("FULL");
  const [ctStrategy, setCtStrategy] = useState<BuyStrategy>("FULL");

  // Tactics
  const [tTactic, setTTactic] = useState<Tactic>("DEFAULT");
  const [ctTactic, setCtTactic] = useState<Tactic>("STANDARD");

  // Assignments: Role Name -> Bot ID
  // We keep this structure to easily check which ROLES are filled.
  const [tAssignments, setTAssignments] = useState<Record<string, string>>({});
  const [ctAssignments, setCtAssignments] = useState<Record<string, string>>({});

  // Buy Overrides: Bot ID -> Buy Strategy (or empty string for default)
  const [tBuyOverrides, setTBuyOverrides] = useState<Record<string, BuyStrategy>>({});
  const [ctBuyOverrides, setCtBuyOverrides] = useState<Record<string, BuyStrategy>>({});

  // Economy Stats State
  const [stats, setStats] = useState({
      totalBank: 0,
      estimatedSpend: 0,
      minNextRound: 0
  });

  const activeBots = bots.filter(b => b.side === activeTab); // All bots are ALIVE in this phase
  const activeStrategy = activeTab === TeamSide.T ? tStrategy : ctStrategy;
  const setStrategy = activeTab === TeamSide.T ? setTStrategy : setCtStrategy;
  const activeTactic = activeTab === TeamSide.T ? tTactic : ctTactic;
  const setTactic = activeTab === TeamSide.T ? setTTactic : setCtTactic;

  const activeAssignments = activeTab === TeamSide.T ? tAssignments : ctAssignments;
  const setAssignments = activeTab === TeamSide.T ? setTAssignments : setCtAssignments;

  const activeBuyOverrides = activeTab === TeamSide.T ? tBuyOverrides : ctBuyOverrides;
  const setBuyOverrides = activeTab === TeamSide.T ? setTBuyOverrides : setCtBuyOverrides;

  const AVAILABLE_TACTICS = activeTab === TeamSide.T ? T_TACTICS : CT_TACTICS;
  const currentRoles = TACTIC_ROLES[activeTactic] || [];

  // Reset Assignments on Mount (User Requirement: Start Unassigned)
  useEffect(() => {
      setTAssignments({});
      setCtAssignments({});
      setTBuyOverrides({});
      setCtBuyOverrides({});
  }, []); // Only on mount

  // Handle Tactic Change -> Reset Assignments for that side
  const handleTacticChange = (newTactic: Tactic) => {
      setTactic(newTactic);
      // Clear assignments because roles have changed completely
      setAssignments({});
  };

  // Calculate Economy when inputs change
  useEffect(() => {
      // 1. Resolve Roles for Calculation
      const roleOverrides: Record<string, string> = {};
      Object.entries(activeAssignments).forEach(([roleName, botId]) => {
          const roleDef = TACTIC_ROLES[activeTactic].find(r => r.name === roleName);
          if (roleDef) {
              roleOverrides[botId] = roleDef.behavior;
          }
      });

      // 2. Prepare Bots (clones with updated roles)
      // We don't want to mutate actual bots yet
      // TeamEconomyManager.calculateEconomyStats uses bots array but doesn't mutate it deep enough to persist?
      // Actually it creates dummies. But we need to set the `roundRole` on the bot objects passed to it.
      // Let's rely on the fact that we can pass overrides to calculateEconomyStats now!
      // Wait, I didn't update calculateEconomyStats to take ROLE overrides, only BUY overrides.
      // So I still need to temporarily set roundRole on the bots passed or update the Manager.
      // Updating the bot objects locally is fine since they are re-rendered/re-simulated.

      // Create shallow clones to avoid mutating props
      const sideBots = bots.filter(b => b.side === activeTab).map(b => {
          const clone = Object.assign(Object.create(Object.getPrototypeOf(b)), b);
          if (roleOverrides[b.id]) clone.roundRole = roleOverrides[b.id];
          return clone;
      });

      const lossBonus = matchState.lossBonus[activeTab];

      // Filter out empty overrides for calculation
      const validBuyOverrides: Record<string, BuyStrategy> = {};
      Object.entries(activeBuyOverrides).forEach(([bid, strat]) => {
          if (strat) validBuyOverrides[bid] = strat;
      });

      const calculated = TeamEconomyManager.calculateEconomyStats(sideBots, activeTab, activeStrategy, lossBonus, validBuyOverrides);
      setStats(calculated);

  }, [activeTab, tStrategy, ctStrategy, activeAssignments, activeBuyOverrides, bots, matchState, activeTactic]);

  const handleRoleSelect = (botId: string, roleName: string) => {
      setAssignments(prev => {
          const next = { ...prev };

          // If this bot had another role, remove it
          const oldRole = Object.keys(next).find(r => next[r] === botId);
          if (oldRole) delete next[oldRole];

          // If this role was assigned to someone else, remove them (or swap? let's just steal it)
          // User requirement: "Role should be removed from dropdown", implying uniqueness.
          // But if I select it here, I am claiming it.
          // If roleName is empty (unassign), just delete.

          if (roleName === "") {
               // Unassign
          } else {
               next[roleName] = botId;
          }
          return next;
      });
  };

  const handleBuyOverride = (botId: string, strategy: string) => {
      setBuyOverrides(prev => ({
          ...prev,
          [botId]: strategy as BuyStrategy // or undefined/empty
      }));
  };

  const validateAssignments = () => {
      const tRoles = TACTIC_ROLES[tTactic];
      const ctRoles = TACTIC_ROLES[ctTactic];

      // Check if every REQUIRED role has an assignment
      const tValid = tRoles.every(r => tAssignments[r.name]);
      const ctValid = ctRoles.every(r => ctAssignments[r.name]);

      return tValid && ctValid;
  };

  const handleConfirm = () => {
      // Build final overrides
      const roleOverrides: Record<string, string> = {};
      Object.entries(tAssignments).forEach(([role, botId]) => roleOverrides[botId] = role);
      Object.entries(ctAssignments).forEach(([role, botId]) => roleOverrides[botId] = role);

      // Merge Buy Overrides
      const finalBuyOverrides: Record<string, BuyStrategy> = {};
      Object.entries(tBuyOverrides).forEach(([bid, s]) => { if(s) finalBuyOverrides[bid] = s; });
      Object.entries(ctBuyOverrides).forEach(([bid, s]) => { if(s) finalBuyOverrides[bid] = s; });

      onConfirm(tStrategy, tTactic, ctStrategy, ctTactic, roleOverrides, finalBuyOverrides);
  };

  // Helper to render utility icons/text
  const renderUtility = (grenades: string[]) => {
      if (!grenades || grenades.length === 0) return <span className="text-gray-500">-</span>;
      return (
          <div className="flex gap-1">
              {grenades.map((g, i) => (
                  <div key={i} className="w-4 h-4 rounded bg-gray-600 border border-gray-500 flex items-center justify-center text-[10px] text-white" title={g}>
                      {g[0].toUpperCase()}
                  </div>
              ))}
          </div>
      );
  };

  return (
    <div className="fixed inset-0 z-[100] bg-gray-900/95 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-6xl bg-gray-800 border border-gray-700 rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">

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
                     <h3 className="text-sm font-semibold text-gray-300 mb-3 uppercase">Team Buy Strategy</h3>
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

             {/* Right: Player Assignments (9 Cols) */}
             <div className="col-span-9 bg-gray-700/30 rounded-lg border border-gray-600 overflow-hidden flex flex-col">
                 <div className="bg-gray-700 p-3 border-b border-gray-600">
                    <h3 className="text-sm font-bold text-gray-200 uppercase tracking-wide">Player Assignments</h3>
                    <p className="text-xs text-gray-400 mt-1">Assign roles and strategies for each operative.</p>
                 </div>

                 <div className="overflow-auto flex-1">
                     <table className="w-full text-left">
                         <thead className="bg-gray-800 text-gray-400 text-xs uppercase sticky top-0">
                             <tr>
                                 <th className="p-3">Player Name</th>
                                 <th className="p-3">Money</th>
                                 <th className="p-3">Current Loadout</th>
                                 <th className="p-3">Role Assignment</th>
                                 <th className="p-3">Buy Strategy</th>
                             </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-600">
                             {activeBots.map((bot) => {
                                 const assignedRole = Object.keys(activeAssignments).find(r => activeAssignments[r] === bot.id);
                                 const currentWeaponId = bot.player.inventory?.primaryWeapon || bot.player.inventory?.secondaryWeapon;
                                 const weaponName = currentWeaponId ? WEAPONS[currentWeaponId]?.name : "Knife";

                                 return (
                                     <tr key={bot.id} className="hover:bg-gray-700/50">
                                         <td className="p-3 align-middle font-bold text-white">
                                             {bot.player.name}
                                         </td>
                                         <td className="p-3 align-middle font-mono text-green-400">
                                             ${bot.player.inventory?.money}
                                         </td>
                                         <td className="p-3 align-middle">
                                             <div className="text-sm text-gray-300">{weaponName}</div>
                                             {renderUtility(bot.player.inventory?.grenades || [])}
                                         </td>
                                         <td className="p-3 align-middle">
                                             <select
                                                value={assignedRole || ""}
                                                onChange={(e) => handleRoleSelect(bot.id, e.target.value)}
                                                className={`w-full text-sm rounded px-2 py-2 border focus:outline-none focus:border-blue-500 ${!assignedRole ? 'border-yellow-600 bg-yellow-900/20 text-yellow-200' : 'bg-gray-800 border-gray-600 text-white'}`}
                                             >
                                                 <option value="">-- Unassigned --</option>
                                                 {currentRoles.map(role => {
                                                     // Only show if unassigned OR assigned to THIS bot
                                                     const isTaken = activeAssignments[role.name] && activeAssignments[role.name] !== bot.id;
                                                     if (isTaken) return null;

                                                     return (
                                                         <option key={role.name} value={role.name} title={role.description}>
                                                             {role.name}
                                                         </option>
                                                     );
                                                 })}
                                             </select>
                                             {assignedRole && (
                                                <div className="text-[10px] text-gray-500 mt-1 truncate max-w-[200px]">
                                                    {currentRoles.find(r => r.name === assignedRole)?.description}
                                                </div>
                                             )}
                                         </td>
                                         <td className="p-3 align-middle">
                                             <select
                                                 value={activeBuyOverrides[bot.id] || ""}
                                                 onChange={(e) => handleBuyOverride(bot.id, e.target.value)}
                                                 className="bg-gray-800 border-gray-600 text-white text-sm rounded px-2 py-2 focus:outline-none focus:border-blue-500"
                                             >
                                                 <option value="">Team Default ({activeStrategy})</option>
                                                 {BUY_STRATEGIES.map(s => (
                                                     <option key={s} value={s}>{s}</option>
                                                 ))}
                                             </select>
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
                    : <span className="text-red-500 flex items-center gap-2">⚠ Please assign roles to all players for both teams</span>
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
