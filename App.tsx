
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import Layout from './components/Layout';
import { MemoryGame, ClickerGame } from './components/Games';
import { StorageService } from './services/storage';
import { UserProfile, Task, Coupon, WithdrawalRequest, AppSettings } from './types';
import { ADMIN_EMAIL, ADMIN_PASSWORD, CATEGORIES } from './constants';

// Ad Component to safely render admin-provided ad codes
const AdDisplay: React.FC<{ html?: string, className?: string }> = ({ html, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (html && containerRef.current) {
      // Clear previous and inject new content
      containerRef.current.innerHTML = '';
      const range = document.createRange();
      const fragment = range.createContextualFragment(html);
      containerRef.current.appendChild(fragment);
    }
  }, [html]);

  if (!html || html.trim() === '') return null;

  return (
    <div 
      ref={containerRef} 
      className={`ad-container my-4 p-2 glass rounded-xl overflow-hidden flex justify-center items-center text-xs text-slate-500 min-h-[50px] ${className}`}
    />
  );
};

const App: React.FC = () => {
  // State
  const [view, setView] = useState<'user' | 'admin' | 'admin-login'>('user');
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [ip, setIp] = useState<string>('');
  const [isIncognito, setIsIncognito] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  
  // Data State
  const [tasks, setTasks] = useState<Task[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [settings, setSettings] = useState<AppSettings>(StorageService.getSettings());
  const [users, setUsers] = useState<UserProfile[]>([]);

  // UI State
  const [activeTab, setActiveTab] = useState<'tasks' | 'games' | 'bonus' | 'withdraw' | 'referrals' | 'coupons'>('tasks');
  const [activeAdminTab, setActiveAdminTab] = useState<'dashboard' | 'users' | 'tasks' | 'coupons' | 'withdrawals' | 'settings'>('dashboard');
  const [taskSearch, setTaskSearch] = useState('');
  const [activeGame, setActiveGame] = useState<'memory' | 'clicker' | null>(null);
  const [isTaskPending, setIsTaskPending] = useState<string | null>(null);
  const [taskTimer, setTaskTimer] = useState(0);

  // Referral Link
  const referralLink = useMemo(() => {
    return `${window.location.origin}${window.location.pathname}?ref=${currentUser?.referralCode}`;
  }, [currentUser?.referralCode]);

  // Initialize
  useEffect(() => {
    // Check Incognito (approximate)
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then(estimate => {
        if (estimate.quota && estimate.quota < 120000000) {
          setIsIncognito(true);
        }
      });
    }

    // Parse Referral Code from URL
    const urlParams = new URLSearchParams(window.location.search);
    const refCodeFromUrl = urlParams.get('ref');

    // Fetch IP and Initialize User
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => {
        setIp(data.ip);
        const allUsers = StorageService.getUsers();
        let user = allUsers.find(u => u.ip === data.ip);
        
        if (!user) {
          // New User Detected
          user = {
            ip: data.ip,
            coins: 0,
            tasksCompleted: [],
            couponsClaimed: [],
            lastDailyBonus: null,
            referralCode: `REF-${Math.random().toString(36).substring(7).toUpperCase()}`,
            referredBy: null,
            totalReferrals: 0,
            isBlocked: false,
            joinedAt: new Date().toISOString()
          };

          // Handle Referral Logic
          if (refCodeFromUrl) {
            const referrer = allUsers.find(u => u.referralCode === refCodeFromUrl);
            if (referrer && referrer.ip !== data.ip) {
              referrer.coins += settings.referralBonusAmount;
              referrer.totalReferrals += 1;
              user.referredBy = referrer.ip;
              
              const rIdx = allUsers.findIndex(u => u.ip === referrer.ip);
              allUsers[rIdx] = referrer;
            }
          }

          allUsers.push(user);
          StorageService.setUsers(allUsers);
        }
        
        setCurrentUser(user);
        setUsers(allUsers);

        if (!StorageService.isWelcomed(data.ip)) {
          setShowWelcome(true);
          StorageService.setWelcomed(data.ip);
        }

        // Cleanup URL query params for a cleaner look after processing referral
        if (refCodeFromUrl) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      })
      .catch(() => {
        const mockIp = '127.0.0.1';
        setIp(mockIp);
        const allUsers = StorageService.getUsers();
        let user = allUsers.find(u => u.ip === mockIp);
        if (!user) {
          user = {
            ip: mockIp,
            coins: 100,
            tasksCompleted: [],
            couponsClaimed: [],
            lastDailyBonus: null,
            referralCode: 'MOCK-REF',
            referredBy: null,
            totalReferrals: 0,
            isBlocked: false,
            joinedAt: new Date().toISOString()
          };
          allUsers.push(user);
          StorageService.setUsers(allUsers);
        }
        setCurrentUser(user);
        setUsers(allUsers);
      });

    setTasks(StorageService.getTasks());
    setCoupons(StorageService.getCoupons());
    setWithdrawals(StorageService.getWithdrawals());
  }, []);

  // Sync state to storage
  useEffect(() => {
    if (currentUser) {
      const allUsers = StorageService.getUsers();
      const idx = allUsers.findIndex(u => u.ip === currentUser.ip);
      if (idx !== -1) {
        allUsers[idx] = currentUser;
        StorageService.setUsers(allUsers);
        setUsers(allUsers);
      }
    }
  }, [currentUser]);

  // Task Timer Logic
  useEffect(() => {
    let interval: any;
    if (isTaskPending && taskTimer > 0) {
      interval = setInterval(() => {
        setTaskTimer(t => t - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTaskPending, taskTimer]);

  // Handlers
  const handleAdminLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      setIsAdminAuth(true);
      setView('admin');
    } else {
      alert('Invalid admin credentials');
    }
  };

  const claimTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !currentUser || currentUser.tasksCompleted.includes(taskId)) return;

    setIsTaskPending(taskId);
    setTaskTimer(20);
    window.open(task.link, '_blank');
  };

  const finalizeTask = () => {
    if (!isTaskPending || !currentUser) return;
    const task = tasks.find(t => t.id === isTaskPending);
    if (!task) return;

    setCurrentUser(prev => prev ? ({
      ...prev,
      coins: prev.coins + task.reward,
      tasksCompleted: [...prev.tasksCompleted, task.id]
    }) : null);
    
    setIsTaskPending(null);
    setTaskTimer(0);
    alert(`Success! ${task.reward} coins added.`);
  };

  const claimCoupon = (code: string) => {
    const coupon = coupons.find(c => c.code === code.trim().toUpperCase());
    if (!coupon || !currentUser) {
      alert('Incorrect or expired coupon');
      return;
    }

    const expiryDate = new Date(coupon.expiryDate);
    if (expiryDate < new Date()) {
      alert('Coupon has expired');
      return;
    }

    if (currentUser.couponsClaimed.includes(coupon.id)) {
      alert('You have already used this coupon');
      return;
    }
    if (coupon.usedCount >= coupon.usageLimit) {
      alert('Coupon usage limit reached');
      return;
    }

    setCurrentUser(prev => prev ? ({
      ...prev,
      coins: prev.coins + coupon.reward,
      couponsClaimed: [...prev.couponsClaimed, coupon.id]
    }) : null);

    setCoupons(prev => prev.map(c => c.id === coupon.id ? { ...c, usedCount: c.usedCount + 1 } : c));
    alert(`Success! ${coupon.reward} coins added.`);
  };

  const claimDailyBonus = () => {
    if (!currentUser) return;
    const today = new Date().toDateString();
    if (currentUser.lastDailyBonus === today) {
      alert('Bonus already claimed today');
      return;
    }

    setCurrentUser(prev => prev ? ({
      ...prev,
      coins: prev.coins + settings.dailyBonusAmount,
      lastDailyBonus: today
    }) : null);
    alert(`Daily bonus of ${settings.dailyBonusAmount} coins claimed!`);
  };

  const submitWithdrawal = (address: string, amount: number) => {
    if (!currentUser) return;
    if (amount < settings.minWithdrawal) {
      alert(`Minimum withdrawal is ${settings.minWithdrawal} coins`);
      return;
    }
    if (amount > currentUser.coins) {
      alert('Insufficient balance');
      return;
    }

    const newRequest: WithdrawalRequest = {
      id: Math.random().toString(36).substring(7),
      ip: currentUser.ip,
      amount,
      walletAddress: address,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    setWithdrawals(prev => [...prev, newRequest]);
    setCurrentUser(prev => prev ? ({ ...prev, coins: prev.coins - amount }) : null);
    StorageService.setWithdrawals([...withdrawals, newRequest]);
    alert('Withdrawal request submitted!');
  };

  // Admin CRUD
  const saveTasks = (newTasks: Task[]) => {
    setTasks(newTasks);
    StorageService.setTasks(newTasks);
  };

  const saveCoupons = (newCoupons: Coupon[]) => {
    setCoupons(newCoupons);
    StorageService.setCoupons(newCoupons);
  };

  const saveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    StorageService.setSettings(newSettings);
  };

  const updateWithdrawalStatus = (id: string, status: 'approved' | 'rejected') => {
    const updated = withdrawals.map(w => {
      if (w.id === id) {
        if (status === 'rejected') {
          const user = users.find(u => u.ip === w.ip);
          if (user) {
            user.coins += w.amount;
            StorageService.setUsers([...users]);
          }
        }
        return { ...w, status };
      }
      return w;
    });
    setWithdrawals(updated);
    StorageService.setWithdrawals(updated);
  };

  const blockUser = (ipToBlock: string) => {
    const updated = users.map(u => u.ip === ipToBlock ? { ...u, isBlocked: !u.isBlocked } : u);
    setUsers(updated);
    StorageService.setUsers(updated);
    if (ipToBlock === ip) {
      setCurrentUser(updated.find(u => u.ip === ip) || null);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  // Render Logic
  if (isIncognito) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-md glass p-12 rounded-3xl border-red-500/30">
          <div className="text-6xl mb-6">🕵️‍♂️</div>
          <h1 className="text-3xl font-bold mb-4">Incognito Detected</h1>
          <p className="text-slate-400 mb-8">Please disable incognito mode to use this app and earn coins securely.</p>
          <button onClick={() => window.location.reload()} className="px-8 py-3 bg-indigo-600 rounded-xl font-bold">Try Again</button>
        </div>
      </div>
    );
  }

  if (currentUser?.isBlocked) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-md glass p-12 rounded-3xl border-red-500/30">
          <div className="text-6xl mb-6">🚫</div>
          <h1 className="text-3xl font-bold mb-4">Access Restricted</h1>
          <p className="text-slate-400">Your IP has been blocked by the administrator due to policy violations.</p>
        </div>
      </div>
    );
  }

  return (
    <Layout 
      userCoins={currentUser?.coins || 0} 
      onAdminClick={() => setView('admin-login')}
      isAdmin={view === 'admin'}
    >
      {/* Welcome Modal */}
      {showWelcome && (
        <div className="fixed inset-0 z-[200] bg-slate-950/90 flex items-center justify-center p-6 text-center">
          <div className="max-w-md glass p-10 rounded-3xl animate-in zoom-in duration-300">
            <div className="w-20 h-20 bg-yellow-500 rounded-full mx-auto flex items-center justify-center text-4xl mb-6 coin-spin shadow-xl shadow-yellow-500/20">
              🪙
            </div>
            <h1 className="text-3xl font-bold mb-4">Welcome to CoinEarn Pro!</h1>
            <p className="text-slate-400 mb-8">Start completing tasks, playing fun games, and referring friends to earn real virtual rewards.</p>
            <button 
              onClick={() => setShowWelcome(false)}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 rounded-2xl font-bold text-lg transition-all"
            >
              LET'S START!
            </button>
          </div>
        </div>
      )}

      {/* Game Overlays */}
      {activeGame === 'memory' && (
        <MemoryGame 
          onClose={() => setActiveGame(null)} 
          onComplete={(score, time) => {
            const reward = 20 + Math.floor(time / 10);
            setCurrentUser(p => p ? ({ ...p, coins: p.coins + reward }) : null);
            alert(`Puzzle complete! Earned ${reward} coins.`);
            setActiveGame(null);
          }}
          gameType="memory"
        />
      )}
      {activeGame === 'clicker' && (
        <ClickerGame 
          onClose={() => setActiveGame(null)} 
          onComplete={(score) => {
            const reward = Math.min(score, 50);
            setCurrentUser(p => p ? ({ ...p, coins: p.coins + reward }) : null);
            alert(`Game over! You clicked ${score} times and earned ${reward} coins.`);
            setActiveGame(null);
          }}
          gameType="clicker"
        />
      )}

      {/* Views */}
      {view === 'admin-login' && (
        <div className="max-w-md mx-auto mt-20 glass p-8 rounded-3xl">
          <h2 className="text-2xl font-bold mb-6 text-center">Admin Login</h2>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Email Address</label>
              <input name="email" type="email" required className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="admin@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Password</label>
              <input name="password" type="password" required className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="••••••••" />
            </div>
            <button type="submit" className="w-full py-3 bg-indigo-600 rounded-xl font-bold hover:bg-indigo-700 transition-colors">Login to Panel</button>
            <button type="button" onClick={() => setView('user')} className="w-full text-slate-500 text-sm">Cancel</button>
          </form>
        </div>
      )}

      {view === 'user' && (
        <div className="space-y-8">
          <AdDisplay html={settings.adCodes.main} />

          {/* Main User Navigation */}
          <div className="flex overflow-x-auto pb-4 gap-2 scrollbar-hide no-scrollbar">
            {(['tasks', 'games', 'coupons', 'bonus', 'referrals', 'withdraw'] as const)
              .filter(tab => tab !== 'withdraw' || settings.isWithdrawalEnabled)
              .map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-shrink-0 px-6 py-3 rounded-full font-semibold transition-all ${activeTab === tab ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'}`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'tasks' && (
            <div className="space-y-6">
              <AdDisplay html={settings.adCodes.tasks} />
              <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <h2 className="text-2xl font-bold">Available Tasks</h2>
                <div className="relative w-full md:w-64">
                  <input 
                    type="text" 
                    placeholder="Search tasks..." 
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                  />
                  <span className="absolute left-3 top-2.5 opacity-40">🔍</span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tasks.filter(t => t.isActive && (t.title.toLowerCase().includes(taskSearch.toLowerCase()) || t.category.toLowerCase().includes(taskSearch.toLowerCase()))).map(task => {
                  const isCompleted = currentUser?.tasksCompleted.includes(task.id);
                  const isCurrentlyPending = isTaskPending === task.id;
                  
                  return (
                    <div key={task.id} className={`card-3d glass rounded-3xl p-6 border transition-all ${isCompleted ? 'opacity-60 border-emerald-500/20' : 'border-slate-800'}`}>
                      <div className="flex justify-between items-start mb-4">
                        <span className="bg-indigo-500/10 text-indigo-400 text-xs font-bold px-3 py-1 rounded-full border border-indigo-500/20 uppercase">
                          {task.category}
                        </span>
                        <div className="flex items-center gap-1 text-yellow-500 font-bold">
                          🪙 {task.reward}
                        </div>
                      </div>
                      <h3 className="text-xl font-bold mb-2">{task.title}</h3>
                      <p className="text-slate-400 text-sm mb-6 line-clamp-2">{task.description}</p>
                      
                      {isCompleted ? (
                        <div className="w-full py-3 bg-emerald-500/10 text-emerald-400 rounded-xl text-center font-bold border border-emerald-500/20">
                          COMPLETED ✓
                        </div>
                      ) : isCurrentlyPending ? (
                        <button 
                          disabled={taskTimer > 0}
                          onClick={finalizeTask}
                          className={`w-full py-3 rounded-xl font-bold transition-all ${taskTimer > 0 ? 'bg-slate-700 text-slate-400 cursor-wait' : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20'}`}
                        >
                          {taskTimer > 0 ? `Wait ${taskTimer}s...` : 'CLAIM REWARD'}
                        </button>
                      ) : (
                        <button 
                          onClick={() => claimTask(task.id)}
                          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/20"
                        >
                          COMPLETE TASK
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'games' && (
            <div className="space-y-6">
              <AdDisplay html={settings.adCodes.games} />
              <h2 className="text-2xl font-bold">Earning Games</h2>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="glass rounded-3xl overflow-hidden group">
                  <div className="h-48 bg-indigo-600/20 flex items-center justify-center text-7xl group-hover:scale-110 transition-transform">🧠</div>
                  <div className="p-8">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-2xl font-bold">Memory Match</h3>
                      <div className="text-yellow-500 font-bold">Up to 🪙 100</div>
                    </div>
                    <p className="text-slate-400 mb-6">Test your brain and match identical cards to win instant coins.</p>
                    <button onClick={() => setActiveGame('memory')} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 rounded-2xl font-bold">PLAY NOW</button>
                  </div>
                </div>
                <div className="glass rounded-3xl overflow-hidden group">
                  <div className="h-48 bg-yellow-600/20 flex items-center justify-center text-7xl group-hover:scale-110 transition-transform">🖱️</div>
                  <div className="p-8">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-2xl font-bold">Coin Clicker</h3>
                      <div className="text-yellow-500 font-bold">Up to 🪙 50</div>
                    </div>
                    <p className="text-slate-400 mb-6">Speed is key! Click as many coins as possible in 30 seconds.</p>
                    <button onClick={() => setActiveGame('clicker')} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 rounded-2xl font-bold">PLAY NOW</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'coupons' && (
            <div className="max-w-xl mx-auto space-y-8 py-10">
              <div className="text-center">
                <div className="text-6xl mb-4">🎟️</div>
                <h2 className="text-3xl font-bold mb-2">Redeem Coupon</h2>
                <p className="text-slate-400">Enter a special code to get instant coins.</p>
              </div>
              <div className="glass p-8 rounded-3xl border-indigo-500/30">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const code = new FormData(e.currentTarget).get('code') as string;
                  claimCoupon(code);
                  e.currentTarget.reset();
                }} className="space-y-4">
                  <input 
                    name="code"
                    type="text" 
                    placeholder="Enter Coupon Code" 
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-5 text-center text-xl font-mono uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 rounded-2xl font-bold text-lg shadow-xl shadow-indigo-500/30">
                    REDEEM NOW
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'bonus' && (
            <div className="max-w-xl mx-auto space-y-8 py-10 text-center">
              <AdDisplay html={settings.adCodes.daily} />
              <div>
                <div className="text-7xl mb-4 animate-bounce">🎁</div>
                <h2 className="text-3xl font-bold mb-2">Daily Bonus</h2>
                <p className="text-slate-400">Come back every 24 hours to claim free coins!</p>
              </div>
              
              <div className="glass p-10 rounded-3xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-slate-800">
                  <div className={`h-full bg-indigo-500 transition-all duration-1000 ${currentUser?.lastDailyBonus === new Date().toDateString() ? 'w-full' : 'w-0'}`}></div>
                </div>
                
                <div className="text-4xl font-black text-yellow-500 mb-6">
                  🪙 {settings.dailyBonusAmount}
                </div>
                
                {currentUser?.lastDailyBonus === new Date().toDateString() ? (
                  <div className="space-y-4">
                    <div className="py-4 bg-emerald-500/10 text-emerald-400 rounded-2xl font-bold border border-emerald-500/20 text-xl">
                      ALREADY CLAIMED TODAY!
                    </div>
                    <p className="text-slate-500 text-sm">Check back tomorrow for more.</p>
                  </div>
                ) : (
                  <button 
                    onClick={claimDailyBonus}
                    className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 rounded-2xl font-bold text-xl shadow-2xl shadow-indigo-500/40 transform hover:scale-105 active:scale-95 transition-all"
                  >
                    CLAIM BONUS
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'referrals' && (
            <div className="max-w-xl mx-auto space-y-8 py-10">
              <div className="text-center">
                <div className="text-6xl mb-4">🤝</div>
                <h2 className="text-3xl font-bold mb-2">Referral Program</h2>
                <p className="text-slate-400">Invite friends and earn <span className="text-yellow-500 font-bold">🪙 {settings.referralBonusAmount}</span> per join.</p>
              </div>

              <div className="glass p-8 rounded-3xl space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-500 mb-2">Share Your Unique Link</label>
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <input 
                        readOnly
                        value={referralLink}
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 font-mono text-xs text-indigo-400 overflow-hidden text-ellipsis"
                      />
                      <button 
                        onClick={handleCopyLink}
                        className={`px-6 rounded-xl font-bold transition-all whitespace-nowrap ${copyFeedback ? 'bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700'}`}
                      >
                        {copyFeedback ? 'COPIED!' : 'COPY'}
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <a 
                        href={`https://twitter.com/intent/tweet?text=Join%20CoinEarn%20Pro%20and%20start%20earning%20coins!%20${encodeURIComponent(referralLink)}`}
                        target="_blank"
                        className="flex items-center justify-center gap-2 py-3 bg-[#1DA1F2] hover:bg-[#1A91DA] rounded-xl font-bold text-sm transition-colors"
                      >
                        Share on Twitter
                      </a>
                      <a 
                        href={`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=Join%20CoinEarn%20Pro%20and%20start%20earning%20coins!`}
                        target="_blank"
                        className="flex items-center justify-center gap-2 py-3 bg-[#0088cc] hover:bg-[#0077b5] rounded-xl font-bold text-sm transition-colors"
                      >
                        Share Telegram
                      </a>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                    <div className="text-slate-500 text-xs mb-1 uppercase font-bold">Total Referrals</div>
                    <div className="text-2xl font-bold">{currentUser?.totalReferrals || 0}</div>
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                    <div className="text-slate-500 text-xs mb-1 uppercase font-bold">Earned Coins</div>
                    <div className="text-2xl font-bold text-yellow-500">🪙 {(currentUser?.totalReferrals || 0) * settings.referralBonusAmount}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'withdraw' && settings.isWithdrawalEnabled && (
            <div className="max-w-2xl mx-auto space-y-8 py-10">
              <div className="text-center">
                <div className="text-6xl mb-4">💳</div>
                <h2 className="text-3xl font-bold mb-2">Withdraw Rewards</h2>
                <p className="text-slate-400">Send your earned coins to your Trust Wallet.</p>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                <div className="glass p-8 rounded-3xl space-y-6 h-fit">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Available Balance</span>
                      <span className="text-white font-bold">🪙 {currentUser?.coins.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">Minimum Withdrawal</span>
                      <span className="text-white font-bold">🪙 {settings.minWithdrawal.toLocaleString()}</span>
                    </div>
                  </div>

                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const address = formData.get('address') as string;
                    const amount = parseInt(formData.get('amount') as string);
                    submitWithdrawal(address, amount);
                    e.currentTarget.reset();
                  }} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Trust Wallet Address</label>
                      <input name="address" required placeholder="0x..." className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-1">Amount to Withdraw</label>
                      <input name="amount" type="number" min={settings.minWithdrawal} required placeholder="1000" className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <button type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold shadow-xl shadow-indigo-500/30">
                      REQUEST WITHDRAWAL
                    </button>
                  </form>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-bold">Recent Requests</h3>
                  <div className="space-y-3">
                    {withdrawals.filter(w => w.ip === ip).slice(0, 5).map(req => (
                      <div key={req.id} className="glass p-4 rounded-2xl border border-slate-800 flex justify-between items-center">
                        <div>
                          <div className="text-yellow-500 font-bold">🪙 {req.amount}</div>
                          <div className="text-slate-500 text-xs truncate max-w-[120px]">{req.walletAddress}</div>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${req.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' : req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                          {req.status}
                        </span>
                      </div>
                    ))}
                    {withdrawals.filter(w => w.ip === ip).length === 0 && (
                      <div className="text-center py-10 text-slate-500 text-sm italic">No withdrawal history yet.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'admin' && isAdminAuth && (
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8 mt-4">
          <aside className="glass p-4 rounded-3xl h-fit sticky top-24">
            <div className="space-y-1">
              {(['dashboard', 'users', 'tasks', 'coupons', 'withdrawals', 'settings'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveAdminTab(tab)}
                  className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-all ${activeAdminTab === tab ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-slate-800'}`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
              <button onClick={() => { setIsAdminAuth(false); setView('user'); }} className="w-full text-left px-4 py-3 rounded-xl font-medium text-red-400 hover:bg-red-500/10 mt-6 border border-transparent hover:border-red-500/20">
                Exit Admin
              </button>
            </div>
          </aside>

          <section className="space-y-8">
            {activeAdminTab === 'dashboard' && (
              <div className="space-y-8">
                <h2 className="text-3xl font-bold">Admin Overview</h2>
                <div className="grid md:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Users', value: users.length, color: 'indigo' },
                    { label: 'Total Coins Issued', value: users.reduce((acc, u) => acc + u.coins, 0), color: 'yellow' },
                    { label: 'Pending Withdrawals', value: withdrawals.filter(w => w.status === 'pending').length, color: 'orange' },
                    { label: 'Total Tasks', value: users.reduce((acc, u) => acc + u.tasksCompleted.length, 0), color: 'emerald' },
                  ].map((stat, i) => (
                    <div key={i} className="glass p-6 rounded-3xl border-slate-800">
                      <div className="text-slate-500 text-sm font-bold mb-1 uppercase tracking-wider">{stat.label}</div>
                      <div className={`text-3xl font-black text-${stat.color}-500`}>{stat.value.toLocaleString()}</div>
                    </div>
                  ))}
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="glass p-8 rounded-3xl h-[400px]">
                    <h3 className="text-xl font-bold mb-6">User Growth</h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={[
                        { name: 'Mon', users: 12 },
                        { name: 'Tue', users: 19 },
                        { name: 'Wed', users: 34 },
                        { name: 'Thu', users: 45 },
                        { name: 'Fri', users: 67 },
                        { name: 'Sat', users: 89 },
                        { name: 'Sun', users: users.length },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="name" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b' }} />
                        <Bar dataKey="users" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="glass p-8 rounded-3xl h-[400px]">
                    <h3 className="text-xl font-bold mb-6">Activity Trends</h3>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={[
                        { name: '10 AM', activity: 400 },
                        { name: '12 PM', activity: 3000 },
                        { name: '2 PM', activity: 2000 },
                        { name: '4 PM', activity: 2780 },
                        { name: '6 PM', activity: 1890 },
                        { name: '8 PM', activity: 2390 },
                        { name: '10 PM', activity: 3490 },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="name" stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b' }} />
                        <Line type="monotone" dataKey="activity" stroke="#fbbf24" strokeWidth={3} dot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {activeAdminTab === 'users' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">User Management</h2>
                  <div className="text-sm text-slate-500">{users.length} Users Tracked</div>
                </div>
                <div className="glass rounded-3xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-800/50 text-slate-400 text-xs uppercase font-bold">
                      <tr>
                        <th className="px-6 py-4">IP Address</th>
                        <th className="px-6 py-4">Coins</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {users.map(u => (
                        <tr key={u.ip} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4 font-mono text-sm">{u.ip}</td>
                          <td className="px-6 py-4 font-bold text-yellow-500">🪙 {u.coins}</td>
                          <td className="px-6 py-4">
                            <span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase border ${u.isBlocked ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                              {u.isBlocked ? 'Blocked' : 'Active'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => blockUser(u.ip)} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${u.isBlocked ? 'bg-emerald-600 text-white' : 'bg-red-600/10 text-red-500 border border-red-600/20 hover:bg-red-600 hover:text-white'}`}>
                              {u.isBlocked ? 'UNBLOCK' : 'BLOCK'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeAdminTab === 'tasks' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Task Management</h2>
                  <button onClick={() => {
                    const newTask: Task = {
                      id: Math.random().toString(36).substring(7),
                      title: 'New Task',
                      description: 'Task Description',
                      category: 'Website',
                      reward: 50,
                      link: 'https://',
                      isActive: true
                    };
                    saveTasks([...tasks, newTask]);
                  }} className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold">+ NEW TASK</button>
                </div>
                <div className="grid gap-4">
                  {tasks.map((task, idx) => (
                    <div key={task.id} className="glass p-6 rounded-3xl flex flex-col md:flex-row gap-6 items-start md:items-center">
                      <div className="flex-1 grid md:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                        <input className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-sm" value={task.title} onChange={(e) => {
                          const updated = [...tasks];
                          updated[idx].title = e.target.value;
                          saveTasks(updated);
                        }} />
                        <select className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-sm" value={task.category} onChange={(e) => {
                          const updated = [...tasks];
                          updated[idx].category = e.target.value;
                          saveTasks(updated);
                        }}>
                          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input type="number" className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-sm" value={task.reward} onChange={(e) => {
                          const updated = [...tasks];
                          updated[idx].reward = parseInt(e.target.value);
                          saveTasks(updated);
                        }} />
                        <input className="bg-slate-900 border border-slate-800 rounded-xl p-2 text-sm" value={task.link} onChange={(e) => {
                          const updated = [...tasks];
                          updated[idx].link = e.target.value;
                          saveTasks(updated);
                        }} />
                      </div>
                      <div className="flex gap-2">
                         <button onClick={() => {
                            const updated = [...tasks];
                            updated[idx].isActive = !updated[idx].isActive;
                            saveTasks(updated);
                          }} className={`p-3 rounded-xl border ${task.isActive ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-slate-800 text-slate-500'}`}>
                          {task.isActive ? 'Active' : 'Hidden'}
                        </button>
                        <button onClick={() => saveTasks(tasks.filter(t => t.id !== task.id))} className="p-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl">Delete</button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-end pt-4">
                    <button onClick={() => { StorageService.setTasks(tasks); alert('All tasks saved!'); }} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 rounded-2xl font-bold">SAVE ALL TASKS</button>
                  </div>
                </div>
              </div>
            )}

            {activeAdminTab === 'coupons' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">Coupon Management</h2>
                <div className="glass p-8 rounded-3xl space-y-4">
                  <h3 className="text-lg font-bold">Create Coupon</h3>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const newCoupon: Coupon = {
                      id: Math.random().toString(36).substring(7),
                      code: (fd.get('code') as string).toUpperCase(),
                      reward: parseInt(fd.get('reward') as string),
                      usageLimit: parseInt(fd.get('limit') as string),
                      usedCount: 0,
                      expiryDate: new Date(fd.get('expiry') as string).toISOString()
                    };
                    saveCoupons([...coupons, newCoupon]);
                    e.currentTarget.reset();
                  }} className="grid md:grid-cols-5 gap-4 items-end">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Code</label>
                      <input name="code" required className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Coins</label>
                      <input name="reward" type="number" required className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Limit</label>
                      <input name="limit" type="number" required className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Expiry</label>
                      <input name="expiry" type="date" required className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-sm" />
                    </div>
                    <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 h-[38px] rounded-lg font-bold text-sm">CREATE</button>
                  </form>
                </div>
                <div className="glass rounded-3xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-800/50 text-slate-400 uppercase text-[10px] font-bold">
                      <tr>
                        <th className="px-6 py-4">Code</th>
                        <th className="px-6 py-4">Reward</th>
                        <th className="px-6 py-4">Usage</th>
                        <th className="px-6 py-4">Expiry</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {coupons.map((c) => (
                        <tr key={c.id}>
                          <td className="px-6 py-4 font-mono font-bold text-indigo-400">{c.code}</td>
                          <td className="px-6 py-4 font-bold text-yellow-500">🪙 {c.reward}</td>
                          <td className="px-6 py-4">{c.usedCount} / {c.usageLimit}</td>
                          <td className="px-6 py-4 text-xs">{new Date(c.expiryDate).toLocaleDateString()}</td>
                          <td className="px-6 py-4 text-right">
                             <button onClick={() => saveCoupons(coupons.filter(x => x.id !== c.id))} className="text-red-500 hover:text-red-300 font-bold">DELETE</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeAdminTab === 'withdrawals' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">Withdrawal Requests</h2>
                <div className="glass rounded-3xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-800/50 text-slate-400 text-xs uppercase font-bold">
                      <tr>
                        <th className="px-6 py-4">User IP</th>
                        <th className="px-6 py-4">Amount</th>
                        <th className="px-6 py-4">Wallet</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {withdrawals.map(req => (
                        <tr key={req.id}>
                          <td className="px-6 py-4 font-mono text-sm">{req.ip}</td>
                          <td className="px-6 py-4 font-bold text-yellow-500">🪙 {req.amount}</td>
                          <td className="px-6 py-4 text-xs font-mono truncate max-w-[150px]">{req.walletAddress}</td>
                          <td className="px-6 py-4"><span className={`text-[10px] px-2 py-1 rounded-full font-bold uppercase border ${req.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>{req.status}</span></td>
                          <td className="px-6 py-4 text-right">
                            {req.status === 'pending' && (
                              <div className="flex gap-2 justify-end">
                                <button onClick={() => updateWithdrawalStatus(req.id, 'approved')} className="px-3 py-1 bg-emerald-600 text-white rounded text-xs font-bold">APPROVE</button>
                                <button onClick={() => updateWithdrawalStatus(req.id, 'rejected')} className="px-3 py-1 bg-red-600 text-white rounded text-xs font-bold">REJECT</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeAdminTab === 'settings' && (
              <div className="space-y-8 max-w-2xl">
                <h2 className="text-2xl font-bold">System Settings</h2>
                <div className="glass p-8 rounded-3xl space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-2">Daily Bonus</label>
                      <input type="number" value={settings.dailyBonusAmount} onChange={(e) => saveSettings({ ...settings, dailyBonusAmount: parseInt(e.target.value) })} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-2">Referral Reward</label>
                      <input type="number" value={settings.referralBonusAmount} onChange={(e) => saveSettings({ ...settings, referralBonusAmount: parseInt(e.target.value) })} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-500 mb-2">Min Withdrawal</label>
                      <input type="number" value={settings.minWithdrawal} onChange={(e) => saveSettings({ ...settings, minWithdrawal: parseInt(e.target.value) })} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3" />
                    </div>
                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-3 cursor-pointer bg-slate-900 p-3 rounded-xl border border-slate-800 w-full">
                        <input type="checkbox" checked={settings.isWithdrawalEnabled} onChange={(e) => saveSettings({ ...settings, isWithdrawalEnabled: e.target.checked })} className="w-5 h-5 accent-indigo-500" />
                        <span className="text-sm font-bold">Withdrawals ON</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-500 mb-4 uppercase tracking-widest">Ad Management</h3>
                    <div className="space-y-4">
                      {['main', 'tasks', 'games', 'daily'].map(area => (
                        <div key={area}>
                          <label className="block text-xs font-bold text-slate-600 mb-1 uppercase">{area} Area HTML</label>
                          <textarea placeholder="Ad script code..." rows={3} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono" value={settings.adCodes[area]} onChange={(e) => saveSettings({ ...settings, adCodes: { ...settings.adCodes, [area]: e.target.value } })} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                    <button onClick={() => { StorageService.setSettings(settings); alert('Settings Saved!'); }} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 rounded-2xl font-bold">SAVE ALL SETTINGS</button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </Layout>
  );
};

export default App;
