
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import Layout from './components/Layout';
import { MemoryGame, ClickerGame } from './components/Games';
import { StorageService } from './services/storage';
import { UserProfile, Task, Coupon, WithdrawalRequest, AppSettings } from './types';
import { ADMIN_EMAIL, ADMIN_PASSWORD, CATEGORIES } from './constants';

const AdDisplay: React.FC<{ html?: string, className?: string }> = ({ html, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (html && containerRef.current) {
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
  const [view, setView] = useState<'user' | 'admin' | 'admin-login'>('user');
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [ip, setIp] = useState<string>('');
  const [isIncognito, setIsIncognito] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [settings, setSettings] = useState<AppSettings>(StorageService.getSettings());
  const [users, setUsers] = useState<UserProfile[]>([]);

  const [activeTab, setActiveTab] = useState<'tasks' | 'games' | 'bonus' | 'withdraw' | 'referrals' | 'coupons'>('tasks');
  const [activeAdminTab, setActiveAdminTab] = useState<'dashboard' | 'users' | 'tasks' | 'coupons' | 'withdrawals' | 'settings'>('dashboard');
  const [taskSearch, setTaskSearch] = useState('');
  const [activeGame, setActiveGame] = useState<'memory' | 'clicker' | null>(null);
  const [isTaskPending, setIsTaskPending] = useState<string | null>(null);
  const [taskTimer, setTaskTimer] = useState(0);

  const referralLink = useMemo(() => {
    return `${window.location.origin}${window.location.pathname}?ref=${currentUser?.referralCode}`;
  }, [currentUser?.referralCode]);

  useEffect(() => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then(estimate => {
        if (estimate.quota && estimate.quota < 120000000) {
          setIsIncognito(true);
        }
      });
    }

    const urlParams = new URLSearchParams(window.location.search);
    const refCodeFromUrl = urlParams.get('ref');

    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => {
        setIp(data.ip);
        const allUsers = StorageService.getUsers();
        let user = allUsers.find(u => u.ip === data.ip);
        
        if (!user) {
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

  useEffect(() => {
    let interval: any;
    if (isTaskPending && taskTimer > 0) {
      interval = setInterval(() => {
        setTaskTimer(t => t - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTaskPending, taskTimer]);

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
    const updated = [...withdrawals, newRequest];
    setWithdrawals(updated);
    setCurrentUser(prev => prev ? ({ ...prev, coins: prev.coins - amount }) : null);
    StorageService.setWithdrawals(updated);
    alert('Withdrawal request submitted!');
  };

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
          const allUsers = StorageService.getUsers();
          const userIdx = allUsers.findIndex(u => u.ip === w.ip);
          if (userIdx !== -1) {
            allUsers[userIdx].coins += w.amount;
            StorageService.setUsers(allUsers);
            setUsers(allUsers);
            if (currentUser && currentUser.ip === w.ip) {
              setCurrentUser({ ...allUsers[userIdx] });
            }
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
      {showWelcome && (
        <div className="fixed inset-0 z-[200] bg-slate-950/90 flex items-center justify-center p-6 text-center">
          <div className="max-w-md glass p-10 rounded-3xl">
            <div className="w-20 h-20 bg-yellow-500 rounded-full mx-auto flex items-center justify-center text-4xl mb-6 coin-spin">🪙</div>
            <h1 className="text-3xl font-bold mb-4">Welcome to CoinEarn Pro!</h1>
            <p className="text-slate-400 mb-8">Start completing tasks, playing fun games, and referring friends to earn rewards.</p>
            <button onClick={() => setShowWelcome(false)} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 rounded-2xl font-bold">LET'S START!</button>
          </div>
        </div>
      )}

      {activeGame === 'memory' && (
        <MemoryGame 
          onClose={() => setActiveGame(null)} 
          onComplete={(score, time) => {
            const reward = 20 + Math.floor(time / 10);
            setCurrentUser(p => p ? ({ ...p, coins: p.coins + reward }) : null);
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
            setActiveGame(null);
          }}
          gameType="clicker"
        />
      )}

      {view === 'admin-login' && (
        <div className="max-w-md mx-auto mt-20 glass p-8 rounded-3xl">
          <h2 className="text-2xl font-bold mb-6 text-center">Admin Login</h2>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <input name="email" type="email" required className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3" placeholder="admin@example.com" />
            <input name="password" type="password" required className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3" placeholder="••••••••" />
            <button type="submit" className="w-full py-3 bg-indigo-600 rounded-xl font-bold">Login</button>
            <button type="button" onClick={() => setView('user')} className="w-full text-slate-500 text-sm">Cancel</button>
          </form>
        </div>
      )}

      {view === 'user' && (
        <div className="space-y-8">
          <AdDisplay html={settings.adCodes.main} />
          <div className="flex overflow-x-auto pb-4 gap-2 scrollbar-hide no-scrollbar">
            {(['tasks', 'games', 'coupons', 'bonus', 'referrals', 'withdraw'] as const)
              .filter(tab => tab !== 'withdraw' || settings.isWithdrawalEnabled)
              .map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-shrink-0 px-6 py-3 rounded-full font-semibold transition-all ${activeTab === tab ? 'bg-indigo-600 text-white' : 'bg-slate-800/50 text-slate-400'}`}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {activeTab === 'tasks' && (
            <div className="space-y-6">
              <AdDisplay html={settings.adCodes.tasks} />
              <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <h2 className="text-2xl font-bold">Available Tasks</h2>
                <input type="text" placeholder="Search tasks..." className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2" value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} />
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tasks.filter(t => t.isActive && (t.title.toLowerCase().includes(taskSearch.toLowerCase()) || t.category.toLowerCase().includes(taskSearch.toLowerCase()))).map(task => {
                  const isCompleted = currentUser?.tasksCompleted.includes(task.id);
                  const isPending = isTaskPending === task.id;
                  return (
                    <div key={task.id} className={`glass rounded-3xl p-6 border transition-all ${isCompleted ? 'opacity-60 border-emerald-500/20' : 'border-slate-800'}`}>
                      <div className="flex justify-between items-start mb-4">
                        <span className="bg-indigo-500/10 text-indigo-400 text-xs font-bold px-3 py-1 rounded-full">{task.category}</span>
                        <div className="text-yellow-500 font-bold">🪙 {task.reward}</div>
                      </div>
                      <h3 className="text-xl font-bold mb-2">{task.title}</h3>
                      <p className="text-slate-400 text-sm mb-6 line-clamp-2">{task.description}</p>
                      {isCompleted ? (
                        <div className="w-full py-3 bg-emerald-500/10 text-emerald-400 rounded-xl text-center font-bold">COMPLETED ✓</div>
                      ) : (
                        <button 
                          onClick={() => isPending ? finalizeTask() : claimTask(task.id)}
                          disabled={isPending && taskTimer > 0}
                          className={`w-full py-3 rounded-xl font-bold ${isPending ? (taskTimer > 0 ? 'bg-slate-700' : 'bg-emerald-600') : 'bg-indigo-600'}`}
                        >
                          {isPending ? (taskTimer > 0 ? `Wait ${taskTimer}s...` : 'CLAIM REWARD') : 'COMPLETE TASK'}
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
              <div className="grid md:grid-cols-2 gap-8">
                <div className="glass rounded-3xl p-8 text-center">
                  <div className="text-6xl mb-4">🧠</div>
                  <h3 className="text-2xl font-bold mb-2">Memory Match</h3>
                  <p className="text-slate-400 mb-6">Match cards to win instant coins.</p>
                  <button onClick={() => setActiveGame('memory')} className="w-full py-4 bg-indigo-600 rounded-2xl font-bold">PLAY NOW</button>
                </div>
                <div className="glass rounded-3xl p-8 text-center">
                  <div className="text-6xl mb-4">🖱️</div>
                  <h3 className="text-2xl font-bold mb-2">Coin Clicker</h3>
                  <p className="text-slate-400 mb-6">Click fast to earn coins.</p>
                  <button onClick={() => setActiveGame('clicker')} className="w-full py-4 bg-indigo-600 rounded-2xl font-bold">PLAY NOW</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'coupons' && (
            <div className="max-w-xl mx-auto py-10">
              <div className="glass p-8 rounded-3xl">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const code = new FormData(e.currentTarget).get('code') as string;
                  claimCoupon(code);
                  e.currentTarget.reset();
                }} className="space-y-4">
                  <input name="code" required placeholder="Enter Coupon Code" className="w-full bg-slate-900 rounded-2xl p-5 text-center text-xl font-mono" />
                  <button type="submit" className="w-full py-4 bg-indigo-600 rounded-2xl font-bold text-lg">REDEEM</button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'bonus' && (
            <div className="max-w-xl mx-auto py-10 text-center">
              <AdDisplay html={settings.adCodes.daily} />
              <div className="glass p-10 rounded-3xl">
                <div className="text-4xl font-black text-yellow-500 mb-6">🪙 {settings.dailyBonusAmount}</div>
                <button 
                  onClick={claimDailyBonus}
                  disabled={currentUser?.lastDailyBonus === new Date().toDateString()}
                  className="w-full py-5 bg-indigo-600 disabled:bg-slate-700 rounded-2xl font-bold text-xl"
                >
                  {currentUser?.lastDailyBonus === new Date().toDateString() ? 'ALREADY CLAIMED' : 'CLAIM BONUS'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'referrals' && (
            <div className="max-w-xl mx-auto py-10">
              <div className="glass p-8 rounded-3xl space-y-6">
                <div className="flex gap-2">
                  <input readOnly value={referralLink} className="flex-1 bg-slate-900 rounded-xl px-4 py-3 font-mono text-xs overflow-hidden" />
                  <button onClick={handleCopyLink} className="px-6 rounded-xl font-bold bg-slate-800">{copyFeedback ? 'COPIED' : 'COPY'}</button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900 p-4 rounded-2xl text-center">
                    <div className="text-slate-500 text-xs uppercase font-bold">Referrals</div>
                    <div className="text-2xl font-bold">{currentUser?.totalReferrals || 0}</div>
                  </div>
                  <div className="bg-slate-900 p-4 rounded-2xl text-center">
                    <div className="text-slate-500 text-xs uppercase font-bold">Earned</div>
                    <div className="text-2xl font-bold text-yellow-500">🪙 {(currentUser?.totalReferrals || 0) * settings.referralBonusAmount}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'withdraw' && settings.isWithdrawalEnabled && (
            <div className="max-w-2xl mx-auto py-10">
              <div className="glass p-8 rounded-3xl">
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  submitWithdrawal(fd.get('address') as string, parseInt(fd.get('amount') as string));
                  e.currentTarget.reset();
                }} className="space-y-4">
                  <input name="address" required placeholder="Trust Wallet Address (0x...)" className="w-full bg-slate-900 rounded-xl p-3" />
                  <input name="amount" type="number" required placeholder="Amount" className="w-full bg-slate-900 rounded-xl p-3" />
                  <button type="submit" className="w-full py-4 bg-indigo-600 rounded-xl font-bold">REQUEST WITHDRAWAL</button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'admin' && isAdminAuth && (
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8">
          <aside className="glass p-4 rounded-3xl h-fit">
            {(['dashboard', 'users', 'tasks', 'coupons', 'withdrawals', 'settings'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveAdminTab(tab)} className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-all ${activeAdminTab === tab ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800'}`}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
            <button onClick={() => { setIsAdminAuth(false); setView('user'); }} className="w-full text-left px-4 py-3 text-red-400 mt-6 font-medium">Exit Admin</button>
          </aside>
          
          <section className="space-y-8 pb-20">
            {activeAdminTab === 'dashboard' && (
              <div className="grid md:grid-cols-4 gap-4">
                <div className="glass p-6 rounded-3xl"><div className="text-slate-500 text-sm mb-1 uppercase">Total Users</div><div className="text-3xl font-black">{users.length}</div></div>
                <div className="glass p-6 rounded-3xl"><div className="text-slate-500 text-sm mb-1 uppercase">Total Coins</div><div className="text-3xl font-black text-yellow-500">{users.reduce((acc, u) => acc + u.coins, 0)}</div></div>
                <div className="glass p-6 rounded-3xl"><div className="text-slate-500 text-sm mb-1 uppercase">Pending WD</div><div className="text-3xl font-black text-orange-500">{withdrawals.filter(w => w.status === 'pending').length}</div></div>
                <div className="glass p-6 rounded-3xl"><div className="text-slate-500 text-sm mb-1 uppercase">Tasks Done</div><div className="text-3xl font-black text-emerald-500">{users.reduce((acc, u) => acc + u.tasksCompleted.length, 0)}</div></div>
              </div>
            )}

            {activeAdminTab === 'users' && (
              <div className="glass rounded-3xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-800/50">
                    <tr><th className="p-4">IP</th><th className="p-4">Coins</th><th className="p-4">Joined</th><th className="p-4">Actions</th></tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.ip} className="border-t border-slate-800/50">
                        <td className="p-4 font-mono text-xs">{u.ip}</td>
                        <td className="p-4 font-bold text-yellow-500">{u.coins}</td>
                        <td className="p-4 text-xs text-slate-500">{new Date(u.joinedAt).toLocaleDateString()}</td>
                        <td className="p-4">
                          <button onClick={() => blockUser(u.ip)} className={`px-4 py-2 rounded-lg text-xs font-bold ${u.isBlocked ? 'bg-emerald-600' : 'bg-red-600'}`}>
                            {u.isBlocked ? 'UNBLOCK' : 'BLOCK'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeAdminTab === 'tasks' && (
              <div className="space-y-6">
                <div className="glass p-6 rounded-3xl">
                  <h3 className="text-lg font-bold mb-4">Add New Task</h3>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const newTask: Task = {
                      id: Math.random().toString(36).substring(7),
                      title: fd.get('title') as string,
                      reward: parseInt(fd.get('reward') as string),
                      link: fd.get('link') as string,
                      category: fd.get('category') as string,
                      description: fd.get('description') as string,
                      isActive: true
                    };
                    saveTasks([...tasks, newTask]);
                    e.currentTarget.reset();
                  }} className="grid md:grid-cols-2 gap-4">
                    <input name="title" placeholder="Title" required className="bg-slate-900 rounded-xl p-3 border border-slate-800" />
                    <input name="reward" type="number" placeholder="Reward Coins" required className="bg-slate-900 rounded-xl p-3 border border-slate-800" />
                    <input name="link" placeholder="Task Link" required className="bg-slate-900 rounded-xl p-3 border border-slate-800" />
                    <select name="category" className="bg-slate-900 rounded-xl p-3 border border-slate-800">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <textarea name="description" placeholder="Description" className="md:col-span-2 bg-slate-900 rounded-xl p-3 border border-slate-800 h-20" />
                    <button type="submit" className="md:col-span-2 py-3 bg-indigo-600 rounded-xl font-bold">ADD TASK</button>
                  </form>
                </div>
                <div className="glass rounded-3xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-800/50"><tr><th className="p-4">Task</th><th className="p-4">Reward</th><th className="p-4">Status</th><th className="p-4">Actions</th></tr></thead>
                    <tbody>
                      {tasks.map(t => (
                        <tr key={t.id} className="border-t border-slate-800/50">
                          <td className="p-4 text-sm font-medium">{t.title}</td>
                          <td className="p-4 font-bold text-yellow-500">🪙 {t.reward}</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${t.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                              {t.isActive ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </td>
                          <td className="p-4 flex gap-2">
                            <button onClick={() => saveTasks(tasks.map(tk => tk.id === t.id ? { ...tk, isActive: !tk.isActive } : tk))} className="text-xs bg-slate-800 px-3 py-1 rounded-lg">Toggle</button>
                            <button onClick={() => saveTasks(tasks.filter(tk => tk.id !== t.id))} className="text-xs bg-red-900/50 text-red-400 px-3 py-1 rounded-lg">Del</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeAdminTab === 'coupons' && (
              <div className="space-y-6">
                <div className="glass p-6 rounded-3xl">
                  <h3 className="text-lg font-bold mb-4">Create Coupon</h3>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const newCoupon: Coupon = {
                      id: Math.random().toString(36).substring(7),
                      code: (fd.get('code') as string).toUpperCase(),
                      reward: parseInt(fd.get('reward') as string),
                      usageLimit: parseInt(fd.get('limit') as string),
                      expiryDate: fd.get('expiry') as string,
                      usedCount: 0
                    };
                    saveCoupons([...coupons, newCoupon]);
                    e.currentTarget.reset();
                  }} className="grid md:grid-cols-2 gap-4">
                    <input name="code" placeholder="CODE123" required className="bg-slate-900 rounded-xl p-3 border border-slate-800 font-mono" />
                    <input name="reward" type="number" placeholder="Reward Coins" required className="bg-slate-900 rounded-xl p-3 border border-slate-800" />
                    <input name="limit" type="number" placeholder="Usage Limit" required className="bg-slate-900 rounded-xl p-3 border border-slate-800" />
                    <input name="expiry" type="date" required className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-white" />
                    <button type="submit" className="md:col-span-2 py-3 bg-indigo-600 rounded-xl font-bold">CREATE COUPON</button>
                  </form>
                </div>
                <div className="glass rounded-3xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-slate-800/50"><tr><th className="p-4">Code</th><th className="p-4">Reward</th><th className="p-4">Uses</th><th className="p-4">Actions</th></tr></thead>
                    <tbody>
                      {coupons.map(c => (
                        <tr key={c.id} className="border-t border-slate-800/50">
                          <td className="p-4 font-mono font-bold">{c.code}</td>
                          <td className="p-4 text-yellow-500">{c.reward}</td>
                          <td className="p-4 text-xs">{c.usedCount} / {c.usageLimit}</td>
                          <td className="p-4">
                            <button onClick={() => saveCoupons(coupons.filter(cp => cp.id !== c.id))} className="text-xs bg-red-900/50 text-red-400 px-3 py-1 rounded-lg">Del</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeAdminTab === 'withdrawals' && (
              <div className="glass rounded-3xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-800/50"><tr><th className="p-4">User IP</th><th className="p-4">Amount</th><th className="p-4">Wallet</th><th className="p-4">Status</th><th className="p-4">Actions</th></tr></thead>
                  <tbody>
                    {withdrawals.sort((a,b) => a.status === 'pending' ? -1 : 1).map(w => (
                      <tr key={w.id} className="border-t border-slate-800/50">
                        <td className="p-4 text-xs font-mono">{w.ip}</td>
                        <td className="p-4 font-bold text-orange-400">{w.amount}</td>
                        <td className="p-4 text-[10px] font-mono">{w.walletAddress}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase ${w.status === 'pending' ? 'bg-orange-500/20 text-orange-400' : w.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                            {w.status}
                          </span>
                        </td>
                        <td className="p-4">
                          {w.status === 'pending' && (
                            <div className="flex gap-2">
                              <button onClick={() => updateWithdrawalStatus(w.id, 'approved')} className="bg-emerald-600 text-[10px] px-2 py-1 rounded">Approve</button>
                              <button onClick={() => updateWithdrawalStatus(w.id, 'rejected')} className="bg-red-600 text-[10px] px-2 py-1 rounded">Reject</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeAdminTab === 'settings' && (
              <div className="glass p-8 rounded-3xl space-y-8">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="font-bold border-b border-slate-800 pb-2">Earning Settings</h3>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Daily Bonus Amount</label>
                      <input type="number" value={settings.dailyBonusAmount} onChange={(e) => saveSettings({ ...settings, dailyBonusAmount: parseInt(e.target.value) || 0 })} className="w-full bg-slate-900 rounded-xl p-3 border border-slate-800" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Referral Bonus Amount</label>
                      <input type="number" value={settings.referralBonusAmount} onChange={(e) => saveSettings({ ...settings, referralBonusAmount: parseInt(e.target.value) || 0 })} className="w-full bg-slate-900 rounded-xl p-3 border border-slate-800" />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 block mb-1">Min Withdrawal</label>
                      <input type="number" value={settings.minWithdrawal} onChange={(e) => saveSettings({ ...settings, minWithdrawal: parseInt(e.target.value) || 0 })} className="w-full bg-slate-900 rounded-xl p-3 border border-slate-800" />
                    </div>
                    <div className="flex items-center gap-3 pt-4">
                      <input type="checkbox" checked={settings.isWithdrawalEnabled} onChange={(e) => saveSettings({ ...settings, isWithdrawalEnabled: e.target.checked })} className="w-5 h-5 rounded" id="wd-enable" />
                      <label htmlFor="wd-enable" className="font-bold">Enable Withdrawals</label>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="font-bold border-b border-slate-800 pb-2">Monetization Ad Codes</h3>
                    {Object.keys(settings.adCodes).map(key => (
                      <div key={key}>
                        <label className="text-xs text-slate-500 block mb-1 uppercase">{key} Ad Slot (HTML)</label>
                        <textarea 
                          value={settings.adCodes[key]} 
                          onChange={(e) => saveSettings({ ...settings, adCodes: { ...settings.adCodes, [key]: e.target.value } })}
                          className="w-full bg-slate-900 rounded-xl p-3 border border-slate-800 text-xs font-mono h-20"
                          placeholder="<script>...</script>"
                        />
                      </div>
                    ))}
                  </div>
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
