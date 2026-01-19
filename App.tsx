import React, { useState, useEffect, useMemo, useRef } from 'react';
import Layout from './components/Layout';
import { MemoryGame, ClickerGame } from './components/Games';
import { StorageService } from './services/storage';
import { UserProfile, Task, Coupon, WithdrawalRequest, AppSettings } from './types';
import { ADMIN_EMAIL, ADMIN_PASSWORD, CATEGORIES, INITIAL_GAMES } from './constants';

const AdContainer: React.FC<{ codes: string[] }> = ({ codes }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && codes.length > 0) {
      containerRef.current.innerHTML = '';
      codes.forEach(code => {
        if (!code.trim()) return;
        const wrapper = document.createElement('div');
        wrapper.className = 'my-4 w-full flex justify-center';
        try {
          const range = document.createRange();
          const fragment = range.createContextualFragment(code);
          wrapper.appendChild(fragment);
          containerRef.current?.appendChild(wrapper);
        } catch (e) {
          console.error("Failed to inject ad code", e);
        }
      });
    }
  }, [codes]);

  if (codes.length === 0) return null;
  return <div ref={containerRef} className="ad-wrapper w-full flex flex-col items-center" />;
};

const App: React.FC = () => {
  const [view, setView] = useState<'user' | 'admin' | 'admin-login'>('user');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [ip, setIp] = useState<string>('');
  const [showWelcome, setShowWelcome] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  
  // App States
  const [tasks, setTasks] = useState<Task[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [settings, setSettings] = useState<AppSettings>(StorageService.getSettings());
  const [users, setUsers] = useState<UserProfile[]>([]);
  
  // Admin Temp States
  const [pendingSettings, setPendingSettings] = useState<AppSettings>(settings);

  // User UI States
  const [activeTab, setActiveTab] = useState<'tasks' | 'games' | 'bonus' | 'withdraw' | 'referrals'>('tasks');
  const [activeAdminTab, setActiveAdminTab] = useState<'dashboard' | 'users' | 'tasks' | 'withdrawals' | 'ads' | 'settings'>('dashboard');
  const [activeGame, setActiveGame] = useState<'memory' | 'clicker' | null>(null);
  const [isTaskPending, setIsTaskPending] = useState<string | null>(null);
  const [taskTimer, setTaskTimer] = useState(0);

  const referralLink = useMemo(() => {
    return `${window.location.origin}${window.location.pathname}?ref=${currentUser?.referralCode || ''}`;
  }, [currentUser?.referralCode]);

  useEffect(() => {
    const init = () => {
      const storedIp = localStorage.getItem('ce_cached_ip') || 'user-' + Math.random().toString(36).substring(2, 7);
      localStorage.setItem('ce_cached_ip', storedIp);
      setIp(storedIp);

      const allUsers = StorageService.getUsers();
      let user = allUsers.find(u => u.ip === storedIp);
      
      const currentSettings = StorageService.getSettings();
      setSettings(currentSettings);
      setPendingSettings(currentSettings);

      if (!user) {
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');
        let referredBy = null;
        
        if (refCode) {
          const referrer = allUsers.find(u => u.referralCode === refCode);
          if (referrer) {
            referredBy = referrer.referralCode;
            referrer.coins += currentSettings.referralBonusAmount;
            referrer.totalReferrals += 1;
          }
        }

        user = {
          ip: storedIp,
          coins: 100,
          tasksCompleted: [],
          couponsClaimed: [],
          lastDailyBonus: null,
          referralCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
          referredBy,
          totalReferrals: 0,
          isBlocked: false,
          joinedAt: new Date().toISOString(),
        };
        allUsers.push(user);
        StorageService.setUsers(allUsers);
      }
      
      setCurrentUser(user);
      setUsers(allUsers);
      setTasks(StorageService.getTasks());
      setWithdrawals(StorageService.getWithdrawals());

      if (!StorageService.isWelcomed(storedIp)) {
        setShowWelcome(true);
      }
    };
    init();
  }, []);

  const updateCurrentUser = (updates: Partial<UserProfile>) => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, ...updates };
    setCurrentUser(updatedUser);
    const allUsers = StorageService.getUsers();
    const index = allUsers.findIndex(u => u.ip === currentUser.ip);
    if (index !== -1) {
      allUsers[index] = updatedUser;
      StorageService.setUsers(allUsers);
      setUsers(allUsers);
    }
  };

  const handleTaskComplete = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !currentUser || currentUser.tasksCompleted.includes(taskId)) return;
    
    setIsTaskPending(taskId);
    setTaskTimer(15);
    window.open(task.link, '_blank');
    
    const interval = setInterval(() => {
      setTaskTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          updateCurrentUser({
            coins: (currentUser.coins || 0) + task.reward,
            tasksCompleted: [...(currentUser.tasksCompleted || []), taskId]
          });
          setIsTaskPending(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // --- Admin Logic ---
  const handleWithdrawalAction = (id: string, status: 'approved' | 'rejected') => {
    const updated = withdrawals.map(w => w.id === id ? { ...w, status } : w);
    setWithdrawals(updated);
    StorageService.setWithdrawals(updated);
  };

  const handleBlockUser = (userIp: string) => {
    const updatedUsers = users.map(u => u.ip === userIp ? { ...u, isBlocked: !u.isBlocked } : u);
    setUsers(updatedUsers);
    StorageService.setUsers(updatedUsers);
    if (currentUser?.ip === userIp) {
      setCurrentUser(prev => prev ? { ...prev, isBlocked: !prev.isBlocked } : null);
    }
  };

  const handleAddTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newTask: Task = {
      id: Math.random().toString(36).substring(7),
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      category: formData.get('category') as string,
      reward: Number(formData.get('reward')),
      link: formData.get('link') as string,
      isActive: true,
    };
    const updated = [...tasks, newTask];
    setTasks(updated);
    StorageService.setTasks(updated);
    e.currentTarget.reset();
  };

  const handleDeleteTask = (id: string) => {
    const updated = tasks.filter(t => t.id !== id);
    setTasks(updated);
    StorageService.setTasks(updated);
  };

  const handleAddAd = (section: string) => {
    const currentCodes = pendingSettings.adCodes[section] || [];
    const newSettings = {
      ...pendingSettings,
      adCodes: {
        ...pendingSettings.adCodes,
        [section]: [...currentCodes, ""]
      }
    };
    setPendingSettings(newSettings);
  };

  const handleUpdateAd = (section: string, index: number, value: string) => {
    const currentCodes = [...(pendingSettings.adCodes[section] || [])];
    currentCodes[index] = value;
    const newSettings = {
      ...pendingSettings,
      adCodes: {
        ...pendingSettings.adCodes,
        [section]: currentCodes
      }
    };
    setPendingSettings(newSettings);
  };

  const handleDeleteAd = (section: string, index: number) => {
    const currentCodes = [...(pendingSettings.adCodes[section] || [])];
    currentCodes.splice(index, 1);
    const newSettings = {
      ...pendingSettings,
      adCodes: {
        ...pendingSettings.adCodes,
        [section]: currentCodes
      }
    };
    setPendingSettings(newSettings);
  };

  const saveSettings = () => {
    setSettings(pendingSettings);
    StorageService.setSettings(pendingSettings);
    alert('Settings and Ads saved successfully!');
  };

  if (currentUser?.isBlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="glass p-12 rounded-3xl max-w-md">
          <div className="text-6xl mb-6">🚫</div>
          <h1 className="text-2xl font-black mb-2 uppercase">Banned</h1>
          <p className="text-slate-400">This account is blocked for policy violations.</p>
        </div>
      </div>
    );
  }

  if (view === 'admin-login') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <form 
          className="glass p-10 rounded-3xl w-full max-w-sm"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            if (formData.get('email') === ADMIN_EMAIL && formData.get('password') === ADMIN_PASSWORD) {
              setView('admin');
            } else {
              alert('Unauthorized');
            }
          }}
        >
          <h2 className="text-xl font-bold mb-6 text-center">Admin Console</h2>
          <input name="email" type="email" placeholder="Email" className="w-full bg-slate-900 border border-slate-800 rounded-xl px-5 py-3 mb-4 outline-none focus:ring-2 focus:ring-indigo-500" required />
          <input name="password" type="password" placeholder="Passkey" className="w-full bg-slate-900 border border-slate-800 rounded-xl px-5 py-3 mb-6 outline-none focus:ring-2 focus:ring-indigo-500" required />
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 py-3 rounded-xl font-bold transition-all">Authenticate</button>
          <button type="button" onClick={() => setView('user')} className="w-full mt-4 text-slate-500 hover:text-white transition-colors text-sm">Cancel</button>
        </form>
      </div>
    );
  }

  return (
    <Layout 
      userCoins={currentUser?.coins || 0} 
      onAdminClick={() => setView('admin-login')}
      isAdmin={view === 'admin'}
    >
      {view === 'user' ? (
        <div className="space-y-8 animate-in fade-in duration-500">
          <AdContainer codes={settings.adCodes.main || []} />
          
          <header className="text-center py-6">
            <h1 className="text-4xl md:text-5xl font-black mb-2 tracking-tight">Level Up Your <span className="text-yellow-500">Earnings</span></h1>
            <p className="text-slate-400">The most transparent coin-farming platform.</p>
          </header>

          <nav className="flex overflow-x-auto gap-2 p-1 glass rounded-2xl no-scrollbar">
            {[
              { id: 'tasks', label: 'Tasks', icon: '⚡' },
              { id: 'games', label: 'Games', icon: '🎮' },
              { id: 'bonus', label: 'Daily', icon: '🎁' },
              { id: 'referrals', label: 'Refer', icon: '🤝' },
              ...(settings.isWithdrawalEnabled ? [{ id: 'withdraw' as const, label: 'Withdraw', icon: '🏦' }] : []),
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap btn-hover ${
                  activeTab === tab.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-white/5'
                }`}
              >
                <span>{tab.icon}</span> {tab.label}
              </button>
            ))}
          </nav>

          <div className="tab-content min-h-[400px]">
            {activeTab === 'tasks' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tasks.filter(t => t.isActive && !currentUser?.tasksCompleted.includes(t.id)).map(task => (
                    <div key={task.id} className="glass p-6 rounded-2xl flex flex-col hover:border-indigo-500/30 transition-all border border-transparent">
                      <div className="flex justify-between items-start mb-4">
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-1 rounded font-black uppercase tracking-wider">{task.category}</span>
                        <span className="text-yellow-500 font-bold">+{task.reward} 🪙</span>
                      </div>
                      <h3 className="text-lg font-bold mb-2">{task.title}</h3>
                      <p className="text-slate-400 text-sm mb-6 flex-1 leading-relaxed">{task.description}</p>
                      <button 
                        onClick={() => handleTaskComplete(task.id)}
                        disabled={isTaskPending !== null}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 rounded-xl font-bold transition-all btn-hover"
                      >
                        {isTaskPending === task.id ? `Verifying (${taskTimer}s)` : 'Claim Coins'}
                      </button>
                    </div>
                  ))}
                </div>
                <AdContainer codes={settings.adCodes.tasks || []} />
              </div>
            )}

            {activeTab === 'games' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {INITIAL_GAMES.map(game => (
                    <div key={game.id} className="glass p-8 rounded-3xl flex items-center gap-6">
                      <div className="text-6xl bg-slate-900/50 w-24 h-24 flex items-center justify-center rounded-2xl">{game.icon}</div>
                      <div>
                        <h3 className="text-xl font-bold mb-1">{game.name}</h3>
                        <p className="text-slate-400 text-sm mb-4 italic">Potential: {game.maxReward} coins</p>
                        <button 
                          onClick={() => setActiveGame(game.id as any)}
                          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-bold transition-all btn-hover"
                        >
                          Launch
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <AdContainer codes={settings.adCodes.games || []} />
              </div>
            )}

            {activeTab === 'bonus' && (
              <div className="max-w-md mx-auto py-10 text-center">
                <div className="glass p-10 rounded-3xl">
                  <div className="text-7xl mb-6">🎁</div>
                  <h2 className="text-2xl font-bold mb-2">Daily Loot Box</h2>
                  <p className="text-slate-400 mb-8">Secure {settings.dailyBonusAmount} coins every 24 hours.</p>
                  <button 
                    onClick={() => {
                      const now = new Date();
                      const last = currentUser?.lastDailyBonus ? new Date(currentUser.lastDailyBonus) : null;
                      if (last && now.getTime() - last.getTime() < 24 * 60 * 60 * 1000) {
                        alert('On cooldown. Try again later.');
                        return;
                      }
                      updateCurrentUser({
                        coins: (currentUser?.coins || 0) + settings.dailyBonusAmount,
                        lastDailyBonus: now.toISOString()
                      });
                      alert('Success! Reward added.');
                    }}
                    className="w-full py-4 bg-yellow-500 hover:bg-yellow-600 text-black font-black rounded-xl transition-all btn-hover"
                  >
                    COLLECT NOW
                  </button>
                </div>
                <AdContainer codes={settings.adCodes.daily || []} />
              </div>
            )}

            {activeTab === 'referrals' && (
              <div className="max-w-xl mx-auto py-10">
                <div className="glass p-8 rounded-3xl text-center">
                  <div className="text-6xl mb-4">🤝</div>
                  <h2 className="text-2xl font-bold mb-2">Build Your Crew</h2>
                  <p className="text-slate-400 mb-6 italic">Earn {settings.referralBonusAmount} coins for every user invited.</p>
                  <div className="flex flex-col gap-3">
                    <div className="bg-slate-950 px-4 py-3 rounded-xl border border-slate-800 text-sm font-mono text-indigo-400 break-all select-all">
                      {referralLink}
                    </div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(referralLink);
                        setCopyFeedback(true);
                        setTimeout(() => setCopyFeedback(false), 2000);
                      }}
                      className={`py-3 rounded-xl font-bold transition-all btn-hover ${copyFeedback ? 'bg-emerald-600 text-white' : 'bg-indigo-600 text-white'}`}
                    >
                      {copyFeedback ? '✓ Link Copied' : 'Copy Invitation Link'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'withdraw' && settings.isWithdrawalEnabled && (
              <div className="max-w-md mx-auto py-10">
                <div className="glass p-8 rounded-3xl">
                  <h2 className="text-2xl font-bold mb-2">Withdrawal Vault</h2>
                  <p className="text-sm text-slate-500 mb-6">Minimum threshold: <span className="text-white font-bold">{settings.minWithdrawal} 🪙</span></p>
                  <form className="space-y-4" onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const amount = Number(fd.get('amount'));
                    if (amount < settings.minWithdrawal) { alert('Below minimum!'); return; }
                    if ((currentUser?.coins || 0) < amount) { alert('Insufficient balance!'); return; }
                    const req: WithdrawalRequest = {
                      id: Math.random().toString(36).substring(7),
                      ip, amount, walletAddress: fd.get('wallet') as string,
                      status: 'pending', createdAt: new Date().toISOString()
                    };
                    const updated = [req, ...withdrawals];
                    setWithdrawals(updated);
                    StorageService.setWithdrawals(updated);
                    updateCurrentUser({ coins: (currentUser?.coins || 0) - amount });
                    e.currentTarget.reset();
                    alert('Queue request success!');
                  }}>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Network Address</label>
                      <input name="wallet" placeholder="0x..." className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Coin Amount</label>
                      <input name="amount" type="number" min={settings.minWithdrawal} placeholder="Amount" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-indigo-500" required />
                    </div>
                    <button type="submit" className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold transition-all btn-hover">Process Payout</button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* --- ADMIN INTERFACE --- */
        <div className="flex flex-col md:flex-row gap-6 animate-in slide-in-from-left duration-300">
          <aside className="w-full md:w-64 glass p-4 rounded-3xl h-fit">
            <h3 className="text-slate-500 uppercase text-[10px] font-black tracking-widest mb-4 px-2">Administrator</h3>
            <div className="space-y-1">
              {[
                { id: 'dashboard', label: 'Dashboard' },
                { id: 'users', label: 'User Data' },
                { id: 'tasks', label: 'Tasks' },
                { id: 'withdrawals', label: 'Withdrawals' },
                { id: 'ads', label: 'Ads Manager' },
                { id: 'settings', label: 'Settings' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveAdminTab(tab.id as any)}
                  className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-all ${
                    activeAdminTab === tab.id ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button onClick={() => setView('user')} className="w-full mt-8 py-3 bg-red-500/10 text-red-400 font-bold rounded-xl hover:bg-red-500/20">Exit Session</button>
          </aside>

          <section className="flex-1 space-y-6">
            {activeAdminTab === 'dashboard' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="glass p-6 rounded-2xl">
                  <div className="text-slate-400 text-xs font-bold mb-1">Total Users</div>
                  <div className="text-3xl font-black">{users.length}</div>
                </div>
                <div className="glass p-6 rounded-2xl">
                  <div className="text-slate-400 text-xs font-bold mb-1">Pending Requests</div>
                  <div className="text-3xl font-black">{withdrawals.filter(w => w.status === 'pending').length}</div>
                </div>
                <div className="glass p-6 rounded-2xl">
                  <div className="text-slate-400 text-xs font-bold mb-1">Task Count</div>
                  <div className="text-3xl font-black">{tasks.length}</div>
                </div>
              </div>
            )}

            {activeAdminTab === 'users' && (
              <div className="glass rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Identifier (IP)</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Balance</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {users.map(u => (
                        <tr key={u.ip} className="hover:bg-white/5">
                          <td className="px-6 py-4 font-mono">{u.ip}</td>
                          <td className="px-6 py-4 font-bold text-yellow-500">{u.coins}</td>
                          <td className="px-6 py-4">
                            <button onClick={() => handleBlockUser(u.ip)} className={`px-3 py-1 rounded text-[10px] font-black uppercase ${u.isBlocked ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                              {u.isBlocked ? 'Unblock' : 'Block'}
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
                <div className="glass p-6 rounded-2xl">
                  <h3 className="font-bold mb-4">Deploy New Task</h3>
                  <form onSubmit={handleAddTask} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <input name="title" placeholder="Task Title" className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-sm outline-none focus:border-indigo-500" required />
                    <input name="description" placeholder="Short Description" className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-sm outline-none focus:border-indigo-500" required />
                    <input name="reward" type="number" placeholder="Coin Reward" className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-sm outline-none focus:border-indigo-500" required />
                    <input name="link" placeholder="Destination Link" className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-sm outline-none focus:border-indigo-500" required />
                    <select name="category" className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-sm outline-none">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button type="submit" className="bg-indigo-600 rounded-lg font-bold text-sm h-full hover:bg-indigo-700 transition-colors">Add Task</button>
                  </form>
                </div>
                <div className="glass rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500">Title</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500">Payout</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {tasks.map(t => (
                        <tr key={t.id} className="hover:bg-white/5">
                          <td className="px-6 py-4 font-medium">{t.title}</td>
                          <td className="px-6 py-4 font-bold text-yellow-500">{t.reward} 🪙</td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => handleDeleteTask(t.id)} className="text-red-400 font-bold hover:scale-110 transition-transform">✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeAdminTab === 'withdrawals' && (
              <div className="glass rounded-2xl overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500">IP</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500">Amount</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500">Wallet</th>
                      <th className="px-6 py-4 text-xs font-bold text-slate-500">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {withdrawals.map(w => (
                      <tr key={w.id} className="hover:bg-white/5">
                        <td className="px-6 py-4 font-mono text-xs">{w.ip}</td>
                        <td className="px-6 py-4 font-black text-yellow-500">{w.amount}</td>
                        <td className="px-6 py-4 font-mono text-xs max-w-[100px] truncate">{w.walletAddress}</td>
                        <td className="px-6 py-4 flex gap-2">
                          {w.status === 'pending' ? (
                            <>
                              <button onClick={() => handleWithdrawalAction(w.id, 'approved')} className="text-emerald-400 font-black uppercase text-[10px]">Approve</button>
                              <button onClick={() => handleWithdrawalAction(w.id, 'rejected')} className="text-red-400 font-black uppercase text-[10px]">Reject</button>
                            </>
                          ) : (
                            <span className={`text-[10px] font-black uppercase ${w.status === 'approved' ? 'text-emerald-500' : 'text-red-500'}`}>{w.status}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeAdminTab === 'ads' && (
              <div className="space-y-6">
                <div className="glass p-6 rounded-2xl">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">Ad Slot Manager</h3>
                    <button onClick={saveSettings} className="bg-emerald-600 px-6 py-2 rounded-xl font-bold hover:bg-emerald-700 transition-colors">Commit Ads</button>
                  </div>
                  <div className="space-y-8">
                    {Object.keys(pendingSettings.adCodes).map(section => (
                      <div key={section} className="space-y-4 p-4 border border-slate-800 rounded-xl bg-slate-900/30">
                        <div className="flex justify-between items-center">
                          <h4 className="font-bold capitalize text-indigo-400">{section} Section</h4>
                          <button onClick={() => handleAddAd(section)} className="bg-indigo-600 px-3 py-1 rounded text-xs font-bold hover:bg-indigo-500 transition-colors">+ New Ad Space</button>
                        </div>
                        <div className="space-y-3">
                          {(pendingSettings.adCodes[section] || []).map((code, idx) => (
                            <div key={idx} className="relative group">
                              <textarea 
                                value={code}
                                onChange={(e) => handleUpdateAd(section, idx, e.target.value)}
                                placeholder="Paste HTML Ad Code Here..."
                                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono h-24 focus:border-indigo-500 transition-colors outline-none shadow-inner"
                              />
                              <button 
                                onClick={() => handleDeleteAd(section, idx)}
                                className="absolute -top-2 -right-2 bg-red-600 text-[8px] p-2 rounded-full hover:scale-110 transition-transform shadow-lg"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeAdminTab === 'settings' && (
              <div className="glass p-8 rounded-2xl max-w-lg space-y-6">
                <h3 className="text-xl font-bold">Core Parameters</h3>
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-xs text-slate-500 font-black uppercase tracking-widest block">Withdrawal Section Status</label>
                    <div 
                      onClick={() => setPendingSettings({...pendingSettings, isWithdrawalEnabled: !pendingSettings.isWithdrawalEnabled})}
                      className={`w-14 h-8 rounded-full relative transition-all cursor-pointer shadow-inner ${pendingSettings.isWithdrawalEnabled ? 'bg-indigo-600' : 'bg-slate-800'}`}
                    >
                      <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md ${pendingSettings.isWithdrawalEnabled ? 'left-7' : 'left-1'}`} />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-black uppercase block mb-1">Min. Payout (Coins)</label>
                    <input type="number" value={pendingSettings.minWithdrawal} onChange={e => setPendingSettings({...pendingSettings, minWithdrawal: Number(e.target.value)})} className="w-full bg-slate-950 p-3 rounded-lg border border-slate-800 outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 font-black uppercase block mb-1">Daily Reward</label>
                    <input type="number" value={pendingSettings.dailyBonusAmount} onChange={e => setPendingSettings({...pendingSettings, dailyBonusAmount: Number(e.target.value)})} className="w-full bg-slate-950 p-3 rounded-lg border border-slate-800 outline-none" />
                  </div>
                  <button onClick={saveSettings} className="w-full py-4 bg-indigo-600 rounded-xl font-bold hover:bg-indigo-700 transition-all">Update System</button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {activeGame === 'memory' && <MemoryGame gameType="memory" onComplete={(score, time) => {
        updateCurrentUser({ coins: (currentUser?.coins || 0) + 20 });
        setActiveGame(null);
        alert('Reward Distributed!');
      }} onClose={() => setActiveGame(null)} />}
      
      {activeGame === 'clicker' && <ClickerGame gameType="clicker" onComplete={(score) => {
        updateCurrentUser({ coins: (currentUser?.coins || 0) + Math.min(score, 50) });
        setActiveGame(null);
        alert('Reward Distributed!');
      }} onClose={() => setActiveGame(null)} />}

      {showWelcome && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl flex items-center justify-center p-6 text-center animate-in zoom-in duration-300">
          <div className="glass p-12 rounded-3xl max-w-sm">
            <div className="text-7xl mb-6">🚀</div>
            <h2 className="text-3xl font-black mb-4">You're In</h2>
            <p className="text-slate-400 mb-10 leading-relaxed font-medium">Earn virtual fortune by completing tasks. First 100 coins are on the house.</p>
            <button onClick={() => { setShowWelcome(false); StorageService.setWelcomed(ip); }} className="w-full py-4 bg-indigo-600 rounded-xl font-bold shadow-2xl shadow-indigo-600/20 active:scale-95 transition-all">Start Session</button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;