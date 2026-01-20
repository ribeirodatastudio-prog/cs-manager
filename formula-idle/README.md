# Formula Idle Manager

A text-based, math-heavy incremental idle game managing a Racing Team.

## Core Mechanics

### 1. The Grid (Data & Economy)
- **Grid Size:** 20 Teams / 40 Drivers.
- **Stats Distribution:** Logarithmic Curve.
  - **Rank 1 Team:** 200 Total Stats (per driver).
  - **Rank 20 Team:** 20 Total Stats (per driver).
  - Formula: `StatTotal = Min + (Max - Min) * ((TotalTeams - Rank) / (TotalTeams - 1)) ^ DistributionFactor`.
- **Drivers:** 2 per team. Intra-team variance of 1.01x to 1.10x.
- **Stats:** Cornering, Overtaking, Braking, Instincts, Acceleration, Consistency, Pace.
- **Economy:**
  - Base Cost: 1.
  - Growth: `Cost * 1.05 ^ Level`.
  - Currency: Points (40 for 1st, 1 for 40th).

### 2. Simulation Engine

#### Track Generation
- **Segments:** 13-28 random segments.
- **Types:** Low/Med/High Speed Corners, Short/Med/Long Straights.
- **Constraints:** Must have 1 Long Straight.
- **Laps:** `Clamp(Round(1000 / Segments), 50, 80)`.
- **Difficulty:** Random 0.5x - 1.5x of highest tier stats.
- **Sectors:** Track is divided into 3 equal sectors for timing.

#### Math & Logic

**1. Segment Time Calculation**
For each segment of the track:
- **Base Time:** Fixed per type (e.g., Long Straight = 12s, High Speed Corner = 3s).
- **Driver Score:** `Sum(Stat * Weight) * InstinctsMultiplier`.
  - Weights depend on segment type (e.g., Corners need Cornering/Braking, Straights need Pace/Acceleration).
  - `InstinctsMultiplier = 1 + (Instincts ^ 0.6) / 50`.
- **Result:** `SegmentTime = BaseTime * (TrackDifficulty / DriverScore) ^ 0.8`.

**2. Qualifying**
- Sum of all Segment Times.
- Broken down into 3 Sectors.

**3. Race Lap Simulation**
- **Base Pace:** Recalculated from segments (matches Qualifying).
- **Consistency Variance:**
  - `VariancePercent = 200 / (Consistency + 50)`.
  - `Multiplier = Random(1 - Variance%, 1 + Variance%)`.
  - `LapTime = BasePace * Multiplier`.
- **Traffic & Overtaking:**
  - **Trigger:** Gap to car ahead < 3.0s AND CurrentRank > ExpectedRank (Qualy Pace).
  - **Overtaking Check:** Performed on Straights (Short/Med/Long).
    - `AttackScore = OvertakingStat * SegmentWeight * Random(0.8, 1.2)`.
    - `DefendScore = OpponentInstincts * Random(0.8, 1.2)`.
    - **Success:** `Attack > Defend`.
  - **Dirty Air Penalty:** If overtake fails (Stuck), `LapTime *= 1.15` (+15% penalty).

## Tech Stack
- React (Vite)
- Tailwind CSS
- Recharts
