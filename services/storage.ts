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

const safeGet = (key: string, defaultValue: string): string => {
  try {
    return localStorage.getItem(key) || defaultValue;
  } catch (e) {
    console.warn('Storage access failed:', e);
    return defaultValue;
  }
};

const safeSet = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn('Storage write failed:', e);
  }
};

export const StorageService = {
  getUsers: (): UserProfile[] => JSON.parse(safeGet(KEYS.USERS, '[]')),
  setUsers: (users: UserProfile[]) => safeSet(KEYS.USERS, JSON.stringify(users)),
  getTasks: (): Task[] => JSON.parse(safeGet(KEYS.TASKS, JSON.stringify(INITIAL_TASKS))),
  setTasks: (tasks: Task[]) => safeSet(KEYS.TASKS, JSON.stringify(tasks)),
  getCoupons: (): Coupon[] => JSON.parse(safeGet(KEYS.COUPONS, '[]')),
  setCoupons: (coupons: Coupon[]) => safeSet(KEYS.COUPONS, JSON.stringify(coupons)),
  getWithdrawals: (): WithdrawalRequest[] => JSON.parse(safeGet(KEYS.WITHDRAWALS, '[]')),
  setWithdrawals: (withdrawals: WithdrawalRequest[]) => safeSet(KEYS.WITHDRAWALS, JSON.stringify(withdrawals)),
  getSettings: (): AppSettings => JSON.parse(safeGet(KEYS.SETTINGS, JSON.stringify(INITIAL_SETTINGS))),
  setSettings: (settings: AppSettings) => safeSet(KEYS.SETTINGS, JSON.stringify(settings)),
  isWelcomed: (ip: string): boolean => {
    const welcomed = JSON.parse(safeGet(KEYS.WELCOMED, '[]'));
    return welcomed.includes(ip);
  },
  setWelcomed: (ip: string) => {
    const welcomed = JSON.parse(safeGet(KEYS.WELCOMED, '[]'));
    if (!welcomed.includes(ip)) {
      welcomed.push(ip);
      safeSet(KEYS.WELCOMED, JSON.stringify(welcomed));
    }
  }
};