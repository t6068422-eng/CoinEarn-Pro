
import { UserProfile, Task, Coupon, WithdrawalRequest, AppSettings } from '../types';
import { INITIAL_TASKS, INITIAL_SETTINGS } from '../constants';

const KEYS = {
  USERS: 'ce_users',
  TASKS: 'ce_tasks',
  COUPONS: 'ce_coupons',
  WITHDRAWALS: 'ce_withdrawals',
  SETTINGS: 'ce_settings',
  WELCOMED: 'ce_welcomed'
};

export const StorageService = {
  getUsers: (): UserProfile[] => JSON.parse(localStorage.getItem(KEYS.USERS) || '[]'),
  setUsers: (users: UserProfile[]) => localStorage.setItem(KEYS.USERS, JSON.stringify(users)),
  
  getTasks: (): Task[] => JSON.parse(localStorage.getItem(KEYS.TASKS) || JSON.stringify(INITIAL_TASKS)),
  setTasks: (tasks: Task[]) => localStorage.setItem(KEYS.TASKS, JSON.stringify(tasks)),
  
  getCoupons: (): Coupon[] => JSON.parse(localStorage.getItem(KEYS.COUPONS) || '[]'),
  setCoupons: (coupons: Coupon[]) => localStorage.setItem(KEYS.COUPONS, JSON.stringify(coupons)),
  
  getWithdrawals: (): WithdrawalRequest[] => JSON.parse(localStorage.getItem(KEYS.WITHDRAWALS) || '[]'),
  setWithdrawals: (withdrawals: WithdrawalRequest[]) => localStorage.setItem(KEYS.WITHDRAWALS, JSON.stringify(withdrawals)),
  
  getSettings: (): AppSettings => JSON.parse(localStorage.getItem(KEYS.SETTINGS) || JSON.stringify(INITIAL_SETTINGS)),
  setSettings: (settings: AppSettings) => localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings)),

  isWelcomed: (ip: string): boolean => {
    const welcomed = JSON.parse(localStorage.getItem(KEYS.WELCOMED) || '[]');
    return welcomed.includes(ip);
  },
  setWelcomed: (ip: string) => {
    const welcomed = JSON.parse(localStorage.getItem(KEYS.WELCOMED) || '[]');
    if (!welcomed.includes(ip)) {
      welcomed.push(ip);
      localStorage.setItem(KEYS.WELCOMED, JSON.stringify(welcomed));
    }
  }
};
