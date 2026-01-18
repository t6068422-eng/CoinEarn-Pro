
export interface UserProfile {
  ip: string;
  coins: number;
  tasksCompleted: string[];
  couponsClaimed: string[];
  lastDailyBonus: string | null;
  referralCode: string;
  referredBy: string | null;
  totalReferrals: number;
  isBlocked: boolean;
  joinedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  reward: number;
  link: string;
  isActive: boolean;
}

export interface Coupon {
  id: string;
  code: string;
  reward: number;
  usageLimit: number;
  usedCount: number;
  expiryDate: string;
}

export interface Game {
  id: string;
  name: string;
  baseReward: number;
  timeBonus: number; // coins per minute
  maxReward: number;
  icon: string;
}

export interface WithdrawalRequest {
  id: string;
  ip: string;
  amount: number;
  walletAddress: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface AppSettings {
  dailyBonusAmount: number;
  referralBonusAmount: number;
  minWithdrawal: number;
  isWithdrawalEnabled: boolean;
  adCodes: Record<string, string>;
}

export interface AdminStats {
  totalUsers: number;
  totalCoinsIssued: number;
  totalCoinsWithdrawn: number;
  dailyActiveUsers: number[];
}
