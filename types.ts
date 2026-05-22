export type SessionStatus = 'Scheduled' | 'Attended' | 'Absent' | 'Exceptional Regret' | 'Regret' | 'Cancelled' | 'Compensated' | 'Hold';

export interface PackageType {
  id?: string;
  name: string;
  code: string;
}

export interface Location {
  id?: string;
  name: string;
  gps?: string;
  governorate?: string;
  district?: string;
}

export interface Level {
  id?: string;
  name: string;
}

export interface Group {
  id?: string;
  name: string;
  code: string;
  color?: string;
  isActive?: boolean;
}

export interface PricingScheme {
  id?: string;
  effectiveMonth: string; // YYYY-MM
  packageTypeCode: string;
  numSessions: number;
  sessionValue: number;
  sessionCost?: number;
}

export interface PlayerNote {
  date: string;
  time: string;
  note: string;
}

export interface Player {
  id?: string;
  name: string;
  levelId: string;
  locationId: string;
  groupId?: string;
  groupAssignments?: { groupId: string, isActive: boolean }[];
  packageTypeCode: string;
  numSessions: number;
  email?: string;
  phone?: string;
  ownerId?: string;
  tag?: string;
  notes?: string;
  playerNotes?: PlayerNote[];
  hasParent?: boolean;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  isActive?: boolean;
}

export interface Package {
  id?: string;
  playerId: string;
  packageTypeCode: string;
  numSessions: number;
  startDate: string;
  totalDue: number; // Final amount after discount
  paidAmount: number;
  status: 'Paid' | 'Partially Paid' | 'Not Paid' | 'Free';
  effectiveMonth: string;
  note?: string;
  baseAmount?: number; // Original amount before discount
  discountType?: 'percent' | 'value';
  discountValue?: number;
  discountAmount?: number;
  createdAt?: string;
}

export interface Session {
  id?: string;
  packageId: string;
  playerId: string;
  date: string;
  startTime: string;
  status: SessionStatus;
  locationId: string;
  comment?: string;
  sessionIndex: string; // e.g. G2-1
  sessionTypeCode?: string; // e.g. G2, PVT, G3
  value: number;
  discount: number;
  cost?: number;
}

export interface Payment {
  id?: string;
  packageId: string;
  playerId: string;
  amount: number;
  date: string;
  method: 'Bank' | 'Cash';
  note?: string;
  timestamp: number;
  addedBy?: string;
}

export interface SkillScore {
  skillId: string;
  passed: boolean;
}

export interface Evaluation {
  id?: string;
  playerId: string;
  locationId?: string;
  date: string;
  level: string; // The level being tested (e.g. "Beginner 1")
  skillScores: SkillScore[];
  totalSkillsCount: number;
  passedSkillsCount: number;
  percentage: number;
  coachId?: string;
  coachName?: string;
  note?: string;
  ownerId?: string;
}

export interface Reminder {
  id?: string;
  type: 'SessionLeft' | 'FinancialPending' | 'Conflict' | 'Custom';
  relatedId: string; // packageId, playerId, or conflictKey
  playerId?: string; // Link to specific player for filtering
  status: 'Unread' | 'Read' | 'Dismissed';
  message: string;
  category: 'Renew' | 'Financial' | 'Conflict' | 'General';
  dueDays?: number;
  expectingDate?: string;
  createdAt: number;
}

export interface AppUser {
  id?: string;
  email: string;
  name: string;
  role: 'admin' | 'coach' | 'visitor';
  locationIds?: string[];
  ownerId?: string; // The tenant ID this user belongs to
  forcePasswordChange?: boolean;
  isActive?: boolean;
}

export interface AutomationLog {
  id?: string;
  targetDate: string;
  timestamp: string;
  playersCount: number;
  groupsCount: number;
  sessionsCount: number;
  status: 'success' | 'error' | 'idle';
  error?: string;
  message?: string;
}

export interface TeamMessage {
  id?: string;
  subject: string;
  body: string;
  imageUrl?: string;
  recipientType: 'all_active_groups' | 'specific_active_players';
  recipientGroupIds?: string[];
  recipientPlayerIds?: string[];
  ownerId?: string;
  createdAt: string;
}
