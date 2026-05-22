export interface Skill {
  id: string;
  level: string;
  description: string;
  order: number;
}

export const SKILL_MATRIX: Skill[] = [
  // Beginner 1
  { id: 'b1-rules', level: 'Beginner 1', description: 'Know rules', order: 1 },
  { id: 'b1-grips', level: 'Beginner 1', description: 'Basic grips (continental)', order: 2 },
  { id: 'b1-forehand-backhand', level: 'Beginner 1', description: 'Simple flat forehand & backhand', order: 3 },
  { id: 'b1-serve', level: 'Beginner 1', description: 'Basic serve (underhand)', order: 4 },
  { id: 'b1-positioning', level: 'Beginner 1', description: 'Court positioning basics', order: 5 },
  
  // Beginner 2
  { id: 'b2-consistency', level: 'Beginner 2', description: 'Improve consistency', order: 6 },
  { id: 'b2-volleys', level: 'Beginner 2', description: 'Introduce volleys', order: 7 },
  { id: 'b2-lob', level: 'Beginner 2', description: 'Learn lob', order: 8 },
  { id: 'b2-teamwork', level: 'Beginner 2', description: 'Basic teamwork - positioning', order: 9 },
  { id: 'b2-construction', level: 'Beginner 2', description: 'Simple point construction', order: 10 },
  
  // Low-Intermediate 3
  { id: 'li3-serve-return', level: 'Low-Intermediate 3', description: 'Better serve & return', order: 11 },
  { id: 'li3-pos-after', level: 'Low-Intermediate 3', description: 'Positioning after shot', order: 12 },
  { id: 'li3-lob-eff', level: 'Low-Intermediate 3', description: 'Using lob effectively', order: 13 },
  { id: 'li3-bandeja-intro', level: 'Low-Intermediate 3', description: 'Introduction to bandeja', order: 14 },
  { id: 'li3-wall', level: 'Low-Intermediate 3', description: 'Wall rebounds', order: 15 },
  
  // Low-Intermediate 4
  { id: 'li4-bandeja-rel', level: 'Low-Intermediate 4', description: 'Reliable bandeja', order: 16 },
  { id: 'li4-def-lob', level: 'Low-Intermediate 4', description: 'Defensive lobs', order: 17 },
  { id: 'li4-better-pos', level: 'Low-Intermediate 4', description: 'Better positioning', order: 18 },
  { id: 'li4-team-comm', level: 'Low-Intermediate 4', description: 'Teamwork & communication', order: 19 },
  
  // Intermediate 5
  { id: 'i5-off-volley', level: 'Intermediate 5', description: 'Offensive volleys', order: 20 },
  { id: 'i5-vibora-intro', level: 'Intermediate 5', description: 'Vibora introduction', order: 21 },
  { id: 'i5-chiquita', level: 'Intermediate 5', description: 'Chiquita shots', order: 22 },
  { id: 'i5-transitions', level: 'Intermediate 5', description: 'Better transitions defense-attack', order: 23 },
  
  // Intermediate 6
  { id: 'i6-vibora-mast', level: 'Intermediate 6', description: 'Mastering vibora', order: 24 },
  { id: 'i6-bajada-intro', level: 'Intermediate 6', description: 'Bajada introduction', order: 25 },
  { id: 'i6-tactical', level: 'Intermediate 6', description: 'Tactical shot selection', order: 26 },
  { id: 'i6-def-agg', level: 'Intermediate 6', description: 'Defending against aggressive players', order: 27 },
  
  // Advanced 7
  { id: 'a7-power-serve', level: 'Advanced 7', description: 'Powerful serves', order: 28 },
  { id: 'a7-ganchos', level: 'Advanced 7', description: 'Ganchos', order: 29 },
  { id: 'a7-switch', level: 'Advanced 7', description: 'Switch plays', order: 30 },
  { id: 'a7-wall-adv', level: 'Advanced 7', description: 'Advanced wall use', order: 31 },
  { id: 'a7-anticipate', level: 'Advanced 7', description: 'Anticipate opponent moves', order: 32 },
  
  // Advanced 8
  { id: 'a8-rulo', level: 'Advanced 8', description: 'Rulo (topspin bandeja)', order: 33 },
  { id: 'a8-tactical-full', level: 'Advanced 8', description: 'Full tactical awareness', order: 34 },
  { id: 'a8-counter', level: 'Advanced 8', description: 'Counter-attacks', order: 35 },
  { id: 'a8-off-lob', level: 'Advanced 8', description: 'Offensive lobs', order: 36 },
  { id: 'a8-intensity', level: 'Advanced 8', description: 'High-intensity play', order: 37 },
];

export const LEVELS = [
  'Beginner 1',
  'Beginner 2',
  'Low-Intermediate 3',
  'Low-Intermediate 4',
  'Intermediate 5',
  'Intermediate 6',
  'Advanced 7',
  'Advanced 8'
];

export type BadgeType = 'Bronze' | 'Silver' | 'Silver+' | 'Gold' | 'Gold+' | 'Platinum' | 'Diamond' | 'Diamond+';

export const BADGE_MAPPING: Record<string, BadgeType> = {
  'Beginner 1': 'Bronze',
  'Beginner 2': 'Silver',
  'Low-Intermediate 3': 'Silver+',
  'Low-Intermediate 4': 'Gold',
  'Intermediate 5': 'Gold+',
  'Intermediate 6': 'Platinum',
  'Advanced 7': 'Diamond',
  'Advanced 8': 'Diamond+'
};
