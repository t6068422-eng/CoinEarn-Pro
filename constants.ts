
import { Task, Game, AppSettings } from './types';

export const ADMIN_EMAIL = 't6068422@gmail.com';
export const ADMIN_PASSWORD = 'Aass1122@';

export const INITIAL_TASKS: Task[] = [
  { id: '1', title: 'Follow on Twitter', description: 'Follow our official handle for news.', category: 'Twitter', reward: 50, link: 'https://twitter.com', isActive: true },
  { id: '2', title: 'Join Telegram', description: 'Stay updated with our community.', category: 'Telegram', reward: 75, link: 'https://t.me', isActive: true },
  { id: '3', title: 'Watch YouTube Video', description: 'Learn how to maximize your earnings.', category: 'YouTube', reward: 100, link: 'https://youtube.com', isActive: true },
];

export const INITIAL_GAMES: Game[] = [
  { id: 'memory', name: 'Memory Match', baseReward: 10, timeBonus: 5, maxReward: 100, icon: '🧠' },
  { id: 'clicker', name: 'Coin Clicker', baseReward: 5, timeBonus: 10, maxReward: 150, icon: '🖱️' },
];

export const INITIAL_SETTINGS: AppSettings = {
  dailyBonusAmount: 20,
  referralBonusAmount: 100,
  minWithdrawal: 1000,
  isWithdrawalEnabled: false,
  adCodes: {
    main: [],
    tasks: [],
    games: [],
    daily: []
  }
};

export const CATEGORIES = ['YouTube', 'Telegram', 'Twitter', 'Website', 'Other'];
