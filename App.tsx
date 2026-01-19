
import React, { useState, useEffect, useMemo, useRef } from 'react';
import Layout from './components/Layout';
import { MemoryGame, ClickerGame } from './components/Games';
import { StorageService } from './services/storage';
import { UserProfile, Task, Coupon, WithdrawalRequest, AppSettings } from './types';
import { ADMIN_EMAIL, ADMIN_PASSWORD, CATEGORIES } from './constants';

const AdDisplay: React.FC<{ codes?: string[], className?: string }> = ({ codes, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (codes && codes.length > 0 && containerRef.current) {
      containerRef.current.innerHTML = '';
      codes.forEach(html => {
        if (!html || html.trim() === '') return;
        try {
          const wrapper = document.createElement('div');
          wrapper.className = 'ad-slot-wrapper mb-4 last:mb-0 w-full flex justify-center';
          const range = document.createRange();
          const fragment = range.createContextualFragment(html);
          wrapper.appendChild(fragment);
          containerRef.current?.appendChild(wrapper);
        } catch (err) {
          console.error("Ad injection failed", err);
        }
      });
    }
  }, [codes]);

  if (!codes || codes.length === 0) return null;

  return (
    <div 
      ref={containerRef} 
      className={`ad-container my-6 flex flex-col items-center gap-4 ${className}`}
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
  const [pendingSettings, setPendingSettings] = useState<AppSettings>(settings);
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
    setPendingSettings(settings);
  }, [settings]);

  useEffect(() => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      navigator.storage.estimate().then(estimate => {
        if (estimate.quota && estimate.quota < 120000000) setIsIncognito(true);
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
        if (refCodeFromUrl) window.history.replaceState({}, document.title, window.location.pathname);
      })
      .catch(() => {
        const mockIp = '127.0.0.1';
        setIp(mockIp);
        const allUsers = StorageService.getUsers();
        let user = allUsers.find(u => u.ip === mockIp) || {
            ip: mockIp, coins: 100, tasksCompleted: [], couponsClaimed: [], lastDailyBonus: null, referralCode: 'MOCK-REF', referredBy: null, totalReferrals: 0, isBlocked: false, joinedAt: new Date().toISOString()
        };
        if (!allUsers.find(u => u.ip === mockIp)) allUsers.push(user);
        setCurrentUser(user);
        setUsers(allUsers);
      });

    setTasks(StorageService.getTasks());
    setCoupons(StorageService.getCoupons());
    setWithdrawals(StorageService.getWithdrawals());
  }, []);

  useEffect(() => {
    let interval: any;
    if (isTaskPending && taskTimer > 0) {
      interval = setInterval(() => setTaskTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isTaskPending, taskTimer]);

  const handleAdminLogin = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (formData.get('email') === ADMIN_EMAIL && formData.get('password') === ADMIN_PASSWORD) {
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
    const updatedUser = { ...currentUser, coins: currentUser.coins + task.reward, tasksCompleted: [...currentUser.tasksCompleted, task.id] };
    setCurrentUser(updatedUser);
    setIsTaskPending(null);
    setTaskTimer(0);
    const allUsers = StorageService.getUsers();
    const idx = allUsers.findIndex(u => u.ip === updatedUser.ip);
    if (idx !== -1) { allUsers[idx] = updatedUser; StorageService.setUsers(allUsers); setUsers(allUsers); }
    alert(`Success! ${task.reward} coins added.`);
  };

  const claimCoupon = (code: string) => {
    const coupon = coupons.find(c => c.code === code.trim().toUpperCase());
    if (!coupon || !currentUser || new Date(coupon.expiryDate) < new Date() || currentUser.couponsClaimed.includes(coupon.id) || coupon.usedCount >= coupon.usageLimit) {
      alert('Invalid, expired or already used coupon'); return;
    }
    const updatedUser = { ...currentUser, coins: currentUser.coins + coupon.reward, couponsClaimed: [...currentUser.couponsClaimed, coupon.id] };
    setCurrentUser(updatedUser);
    const updatedCoupons = coupons.map(c => c.id === coupon.id ? { ...c, usedCount: c.usedCount + 1 } : c);
    setCoupons(updatedCoupons);
    StorageService.setCoupons(updatedCoupons);
    const allUsers = StorageService.getUsers();
    const idx = allUsers.findIndex(u => u.ip === updatedUser.ip);
    if (idx !== -1) { allUsers[idx] = updatedUser; StorageService.setUsers(allUsers); setUsers(allUsers); }
    alert(`Success! ${coupon.reward} coins added.`);
  };

  const claimDailyBonus = () => {
    if (!currentUser || currentUser.lastDailyBonus === new Date().toDateString()) return;
    const updatedUser = { ...currentUser, coins: currentUser.coins + settings.dailyBonusAmount, lastDailyBonus: new Date().toDateString() };
    setCurrentUser(updatedUser);
    const allUsers = StorageService.getUsers();
    const idx = allUsers.findIndex(u => u.ip === updatedUser.ip);
    if (idx !== -1) { allUsers[idx] = updatedUser; StorageService.setUsers(allUsers); setUsers(allUsers); }
    alert(`Daily bonus of ${settings.dailyBonusAmount} coins claimed!`);
  };

  const submitWithdrawal = (address: string, amount: number) => {
    if (!currentUser || amount < settings.minWithdrawal || amount > currentUser.coins) {
      alert(`Invalid request. Minimum: ${settings.minWithdrawal}`); return;
    }
    const newRequest: WithdrawalRequest = { id: Math.random().toString(36).substring(7), ip: currentUser.ip, amount, walletAddress: address, status: 'pending', createdAt: new Date().toISOString() };
    const updatedWd = [...withdrawals, newRequest];
    setWithdrawals(updatedWd);
    StorageService.setWithdrawals(updatedWd);
    const updatedUser = { ...currentUser, coins: currentUser.coins - amount };
    setCurrentUser(updatedUser);
    const allUsers = StorageService.getUsers();
    const idx = allUsers.findIndex(u => u.ip === updatedUser.ip);
    if (idx !== -1) { allUsers[idx] = updatedUser; StorageService.setUsers(allUsers); setUsers(allUsers); }
    alert('Withdrawal request submitted!');
  };

  const saveTasks = (newTasks: Task[]) => { setTasks(newTasks); StorageService.setTasks(newTasks); };
  const saveCoupons = (newCoupons: Coupon[]) => { setCoupons(newCoupons); StorageService.setCoupons(newCoupons); };
  
  const handleSettingsSave = () => {
    setSettings(pendingSettings);
    StorageService.setSettings(pendingSettings);
    alert("Settings saved successfully!");
  };

  const updateWithdrawalStatus = (id: string, status: 'approved' | 'rejected') => {
    const updatedWd = withdrawals.map(w => {
      if (w.id === id) {
        if (status === 'rejected') {
          const allUsers = StorageService.getUsers();
          const userIdx = allUsers.findIndex(u => u.ip === w.ip);
          if (userIdx !== -1) { allUsers[userIdx].coins += w.amount; StorageService.setUsers(allUsers); setUsers(allUsers); if (currentUser && currentUser.ip === w.ip) setCurrentUser({ ...allUsers[userIdx] }); }
        }
        return { ...w, status };
      }
      return w;
    });
    setWithdrawals(updatedWd);
    StorageService.setWithdrawals(updatedWd);
  };

  const blockUser = (ipToBlock: string) => {
    const updated = users.map(u => u.ip === ipToBlock ? { ...u, isBlocked: !u.isBlocked } : u);
    setUsers(updated); StorageService.setUsers(updated);
    if (ipToBlock === ip) setCurrentUser(updated.find(u => u.ip === ip) || null);
  };

  const addAdSlot = (slot: string) => {
    setPendingSettings(prev => ({
      ...prev,
      adCodes: {
        ...prev.adCodes,
        [slot]: [...(prev.adCodes[slot] || []), ""]
      }
    }));
  };

  const updateAdSlot = (slot: string, index: number, value: string) => {
    const updatedCodes = [...(pendingSettings.adCodes[slot] || [])];
    updatedCodes[index] = value;
    setPendingSettings(prev => ({
      ...prev,
      adCodes: { ...prev.adCodes, [slot]: updatedCodes }
    }));
  };

  const removeAdSlot = (slot: string, index: number) => {
    const updatedCodes = [...(pendingSettings.adCodes[slot] || [])].filter((_, i) => i !== index);
    setPendingSettings(prev => ({
      ...prev,
      adCodes: { ...prev.adCodes, [slot]: updatedCodes }
    }));
  };

  if (isIncognito) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
        <div className="max-w-md glass p-12 rounded-3xl border-red-500/30">
          <div className="text-6xl mb-6">🕵️‍♂️</div>
          <h1 className="text-3xl font-bold mb-4">Incognito Detected</h1>
          <p className="text-slate-400 mb-8">Please disable incognito mode to use this app.</p>
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
          <h1 className="text-3xl font-bold mb-4">Blocked</h1>
          <p className="text-slate-400">Your access has been restricted by the administrator.</p>
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
            <p className="text-slate-400 mb-8">Start completing tasks and earning rewards today.</p>
            <button onClick={() => setShowWelcome(false)} className="w-full py-4 bg-indigo-600 rounded-2xl font-bold">LET'S START!</button>
          </div>
        </div>
      )}

      {activeGame === 'memory' && (
        <MemoryGame 
          onClose={() => setActiveGame(null)} 
          gameType="memory"
          onComplete={(score, time) => {
            const reward = 20 + Math.floor(time / 10);
            const updatedUser = { ...currentUser!, coins: currentUser!.coins + reward };
            setCurrentUser(updatedUser);
            const allUsers = StorageService.getUsers();
            const idx = allUsers.findIndex(u => u.ip === updatedUser.ip);
            if (idx !== -1) { allUsers[idx] = updatedUser; StorageService.setUsers(allUsers); setUsers(allUsers); }
            setActiveGame(null);
            alert(`You earned ${reward} coins!`);
          }}
        />
      )}
      {activeGame === 'clicker' && (
        <ClickerGame 
          onClose={() => setActiveGame(null)} 
          gameType="clicker"
          onComplete={(score) => {
            const reward = Math.min(score, 50);
            const updatedUser = { ...currentUser!, coins: currentUser!.coins + reward };
            setCurrentUser(updatedUser);
            const allUsers = StorageService.getUsers();
            const idx = allUsers.findIndex(u => u.ip === updatedUser.ip);
            if (idx !== -1) { allUsers[idx] = updatedUser; StorageService.setUsers(allUsers); setUsers(allUsers); }
            setActiveGame(null);
            alert(`You earned ${reward} coins!`);
          }}
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
        <div className="space-y-8 animate-in fade-in duration-500">
          <AdDisplay codes={settings.adCodes.main} />
          
          <div className="flex overflow-x-auto pb-4 gap-2 no-scrollbar">
            {(['tasks', 'games', 'coupons', 'bonus', 'referrals', 'withdraw'] as const)
              .filter(tab => tab !== 'withdraw' || settings.isWithdrawalEnabled)
              .map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`flex-shrink-0 px-6 py-3 rounded-full font-semibold transition-all ${activeTab === tab ? 'bg-indigo-600 text-white' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'}`}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {activeTab === 'tasks' && (
            <div className="space-y-6">
              <AdDisplay codes={settings.adCodes.tasks} />
              <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <h2 className="text-2xl font-bold">Available Tasks</h2>
                <input type="text" placeholder="Search tasks..." className="bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2 w-full md:w-auto" value={taskSearch} onChange={(e) => setTaskSearch(e.target.value)} />
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {tasks.filter(t => t.isActive && (t.title.toLowerCase().includes(taskSearch.toLowerCase()) || t.category.toLowerCase().includes(taskSearch.toLowerCase()))).length === 0 ? (
                  <div className="col-span-full py-20 text-center text-slate-500">No tasks available right now.</div>
                ) : tasks.filter(t => t.isActive && (t.title.toLowerCase().includes(taskSearch.toLowerCase()) || t.category.toLowerCase().includes(taskSearch.toLowerCase()))).map(task => {
                  const isCompleted = currentUser?.tasksCompleted.includes(task.id);
                  const isPending = isTaskPending === task.id;
                  return (
                    <div key={task.id} className={`glass rounded-3xl p-6 border transition-all ${isCompleted ? 'opacity-60 border-emerald-500/20' : 'border-slate-800'}`}>
                      <div className="flex justify-between items-start mb-4">
                        <span className="bg-indigo-500/10 text-indigo-400 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">{task.category}</span>
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
                          className={`w-full py-3 rounded-xl font-bold transition-all ${isPending ? (taskTimer > 0 ? 'bg-slate-700' : 'bg-emerald-600') : 'bg-indigo-600 shadow-lg shadow-indigo-600/20 hover:scale-[1.02]'}`}
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
              <AdDisplay codes={settings.adCodes.games} />
              <div className="grid md:grid-cols-2 gap-8">
                <div className="glass rounded-3xl p-8 text-center card-3d">
                  <div className="text-6xl mb-4">🧠</div>
                  <h3 className="text-2xl font-bold mb-2">Memory Match</h3>
                  <p className="text-slate-400 mb-6">Match cards to win instant coins.</p>
                  <button onClick={() => setActiveGame('memory')} className="w-full py-4 bg-indigo-600 rounded-2xl font-bold">PLAY NOW</button>
                </div>
                <div className="glass rounded-3xl p-8 text-center card-3d">
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
              <div className="glass p-8 rounded-3xl shadow-2xl border border-slate-700">
                <h2 className="text-2xl font-bold mb-6 text-center">Redeem Coupon</h2>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const code = new FormData(e.currentTarget).get('code') as string;
                  claimCoupon(code);
                  e.currentTarget.reset();
                }} className="space-y-4">
                  <input name="code" required placeholder="Enter Coupon Code" className="w-full bg-slate-900 rounded-2xl p-5 text-center text-xl font-mono border border-slate-800 focus:border-indigo-500 outline-none" />
                  <button type="submit" className="w-full py-4 bg-indigo-600 rounded-2xl font-bold text-lg hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20">REDEEM</button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'bonus' && (
            <div className="max-w-xl mx-auto py-10 text-center">
              <AdDisplay codes={settings.adCodes.daily} />
              <div className="glass p-10 rounded-3xl shadow-2xl border border-slate-700">
                <div className="text-6xl mb-4">🎁</div>
                <h2 className="text-2xl font-bold mb-2">Daily Bonus</h2>
                <div className="text-4xl font-black text-yellow-500 mb-6">🪙 {settings.dailyBonusAmount}</div>
                <button 
                  onClick={claimDailyBonus}
                  disabled={currentUser?.lastDailyBonus === new Date().toDateString()}
                  className="w-full py-5 bg-indigo-600 disabled:bg-slate-800 disabled:text-slate-500 rounded-2xl font-bold text-xl transition-all shadow-lg shadow-indigo-600/20"
                >
                  {currentUser?.lastDailyBonus === new Date().toDateString() ? 'ALREADY CLAIMED' : 'CLAIM BONUS'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'referrals' && (
            <div className="max-w-xl mx-auto py-10">
              <div className="glass p-8 rounded-3xl space-y-6 shadow-2xl border border-slate-700">
                <h2 className="text-2xl font-bold text-center">Refer & Earn</h2>
                <p className="text-slate-400 text-center text-sm">Share your link and get <span className="text-yellow-500 font-bold">{settings.referralBonusAmount} coins</span>!</p>
                <div className="flex gap-2">
                  <input readOnly value={referralLink} className="flex-1 bg-slate-900 rounded-xl px-4 py-3 font-mono text-[10px] md:text-xs overflow-hidden border border-slate-800" />
                  <button onClick={() => { navigator.clipboard.writeText(referralLink); setCopyFeedback(true); setTimeout(()=>setCopyFeedback(false), 2000); }} className="px-6 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700">{copyFeedback ? 'COPIED' : 'COPY'}</button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-900/50 p-4 rounded-2xl text-center border border-slate-800">
                    <div className="text-slate-500 text-[10px] uppercase font-bold mb-1 tracking-wider">Referrals</div>
                    <div className="text-2xl font-bold">{currentUser?.totalReferrals || 0}</div>
                  </div>
                  <div className="bg-slate-900/50 p-4 rounded-2xl text-center border border-slate-800">
                    <div className="text-slate-500 text-[10px] uppercase font-bold mb-1 tracking-wider">Coins Earned</div>
                    <div className="text-2xl font-bold text-yellow-500">🪙 {(currentUser?.totalReferrals || 0) * settings.referralBonusAmount}</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'withdraw' && settings.isWithdrawalEnabled && (
            <div className="max-w-2xl mx-auto py-10">
              <div className="glass p-8 rounded-3xl shadow-2xl border border-slate-700">
                <h2 className="text-2xl font-bold mb-6 text-center">Withdraw Coins</h2>
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  submitWithdrawal(fd.get('address') as string, parseInt(fd.get('amount') as string));
                  e.currentTarget.reset();
                }} className="space-y-4">
                  <input name="address" required placeholder="Wallet Address (0x...)" className="w-full bg-slate-900 rounded-xl p-3 border border-slate-800" />
                  <input name="amount" type="number" required placeholder={`Amount (Min ${settings.minWithdrawal})`} className="w-full bg-slate-900 rounded-xl p-3 border border-slate-800" />
                  <button type="submit" className="w-full py-4 bg-indigo-600 rounded-xl font-bold shadow-lg shadow-indigo-600/20">REQUEST WITHDRAWAL</button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'admin' && isAdminAuth && (
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8 animate-in slide-in-from-left duration-500">
          <aside className="glass p-4 rounded-3xl h-fit border border-slate-800 shadow-2xl">
            {(['dashboard', 'users', 'tasks', 'coupons', 'withdrawals', 'settings'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveAdminTab(tab)} className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-all mb-1 ${activeAdminTab === tab ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'text-slate-400 hover:bg-slate-800'}`}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
            <button onClick={() => { setIsAdminAuth(false); setView('user'); }} className="w-full text-left px-4 py-3 text-red-400 mt-6 font-medium hover:bg-red-950/20 rounded-xl">Logout</button>
          </aside>
          
          <section className="space-y-8 pb-20">
            {activeAdminTab === 'dashboard' && (
              <div className="grid md:grid-cols-4 gap-4">
                <div className="glass p-6 rounded-3xl border border-slate-800"><div className="text-slate-500 text-[10px] mb-1 uppercase tracking-widest font-bold">Total Users</div><div className="text-3xl font-black">{users.length}</div></div>
                <div className="glass p-6 rounded-3xl border border-slate-800"><div className="text-slate-500 text-[10px] mb-1 uppercase tracking-widest font-bold">Issued Coins</div><div className="text-3xl font-black text-yellow-500">{users.reduce((acc, u) => acc + u.coins, 0).toLocaleString()}</div></div>
                <div className="glass p-6 rounded-3xl border border-slate-800"><div className="text-slate-500 text-[10px] mb-1 uppercase tracking-widest font-bold">Pending WD</div><div className="text-3xl font-black text-orange-500">{withdrawals.filter(w => w.status === 'pending').length}</div></div>
                <div className="glass p-6 rounded-3xl border border-slate-800"><div className="text-slate-500 text-[10px] mb-1 uppercase tracking-widest font-bold">Total Tasks</div><div className="text-3xl font-black text-emerald-500">{users.reduce((acc, u) => acc + u.tasksCompleted.length, 0)}</div></div>
              </div>
            )}

            {activeAdminTab === 'users' && (
              <div className="glass rounded-3xl overflow-hidden border border-slate-800 shadow-xl">
                <table className="w-full text-left">
                  <thead className="bg-slate-800/50"><tr><th className="p-4 text-xs font-bold uppercase text-slate-400">IP / Referral</th><th className="p-4 text-xs font-bold uppercase text-slate-400">Balance</th><th className="p-4 text-xs font-bold uppercase text-slate-400 text-right">Actions</th></tr></thead>
                  <tbody>
                    {users.length === 0 ? <tr><td colSpan={3} className="p-10 text-center text-slate-500">No users yet.</td></tr> : users.map(u => (
                      <tr key={u.ip} className="border-t border-slate-800/50">
                        <td className="p-4 text-xs">
                          <div className="font-mono">{u.ip}</div>
                          <div className="text-slate-500 mt-1">Ref: {u.referralCode}</div>
                        </td>
                        <td className="p-4 font-bold text-yellow-500">{u.coins.toLocaleString()}</td>
                        <td className="p-4 text-right">
                          <button onClick={() => blockUser(u.ip)} className={`px-4 py-2 rounded-lg text-[10px] font-bold ${u.isBlocked ? 'bg-emerald-600' : 'bg-red-600'}`}>
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
                <div className="glass p-6 rounded-3xl border border-slate-800 shadow-xl">
                  <h3 className="text-lg font-bold mb-4">New Task</h3>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const newTask: Task = { id: Math.random().toString(36).substring(7), title: fd.get('title') as string, reward: parseInt(fd.get('reward') as string), link: fd.get('link') as string, category: fd.get('category') as string, description: fd.get('description') as string, isActive: true };
                    saveTasks([...tasks, newTask]); e.currentTarget.reset(); alert("Task added!");
                  }} className="grid md:grid-cols-2 gap-4">
                    <input name="title" placeholder="Title" required className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-sm" />
                    <input name="reward" type="number" placeholder="Coins Reward" required className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-sm" />
                    <input name="link" placeholder="Link" required className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-sm" />
                    <select name="category" className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-sm">{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select>
                    <textarea name="description" placeholder="Short description..." className="md:col-span-2 bg-slate-900 rounded-xl p-3 border border-slate-800 h-20 text-sm" />
                    <button type="submit" className="md:col-span-2 py-3 bg-indigo-600 rounded-xl font-bold">ADD TASK</button>
                  </form>
                </div>
                <div className="glass rounded-3xl overflow-hidden border border-slate-800 shadow-xl">
                  <table className="w-full text-left">
                    <thead className="bg-slate-800/50"><tr><th className="p-4 text-xs font-bold uppercase text-slate-400">Task</th><th className="p-4 text-xs font-bold uppercase text-slate-400">Reward</th><th className="p-4 text-xs font-bold uppercase text-slate-400 text-right">Actions</th></tr></thead>
                    <tbody>
                      {tasks.length === 0 ? <tr><td colSpan={3} className="p-10 text-center text-slate-500">No tasks.</td></tr> : tasks.map(t => (
                        <tr key={t.id} className="border-t border-slate-800/50">
                          <td className="p-4 text-sm font-medium">{t.title}</td>
                          <td className="p-4 font-bold text-yellow-500">{t.reward}</td>
                          <td className="p-4 text-right flex justify-end gap-2">
                            <button onClick={() => saveTasks(tasks.map(tk => tk.id === t.id ? { ...tk, isActive: !tk.isActive } : tk))} className="text-[10px] bg-slate-800 px-3 py-1.5 rounded-lg">{t.isActive ? 'Disable' : 'Enable'}</button>
                            <button onClick={() => saveTasks(tasks.filter(tk => tk.id !== t.id))} className="text-[10px] bg-red-900/50 text-red-400 px-3 py-1.5 rounded-lg">Del</button>
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
                <div className="glass p-6 rounded-3xl border border-slate-800 shadow-xl">
                  <h3 className="text-lg font-bold mb-4">New Coupon</h3>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const newCoupon: Coupon = { id: Math.random().toString(36).substring(7), code: (fd.get('code') as string).toUpperCase().trim(), reward: parseInt(fd.get('reward') as string), usageLimit: parseInt(fd.get('limit') as string), expiryDate: fd.get('expiry') as string, usedCount: 0 };
                    saveCoupons([...coupons, newCoupon]); e.currentTarget.reset(); alert("Coupon created!");
                  }} className="grid md:grid-cols-2 gap-4">
                    <input name="code" placeholder="WELCOME50" required className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-sm font-mono" />
                    <input name="reward" type="number" placeholder="Coins" required className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-sm" />
                    <input name="limit" type="number" placeholder="Max Uses" required className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-sm" />
                    <input name="expiry" type="date" required className="bg-slate-900 rounded-xl p-3 border border-slate-800 text-white text-sm" />
                    <button type="submit" className="md:col-span-2 py-3 bg-indigo-600 rounded-xl font-bold">CREATE COUPON</button>
                  </form>
                </div>
                <div className="glass rounded-3xl overflow-hidden border border-slate-800 shadow-xl">
                  <table className="w-full text-left">
                    <thead className="bg-slate-800/50"><tr><th className="p-4 text-xs font-bold uppercase text-slate-400">Code</th><th className="p-4 text-xs font-bold uppercase text-slate-400">Uses</th><th className="p-4 text-xs font-bold uppercase text-slate-400 text-right">Actions</th></tr></thead>
                    <tbody>
                      {coupons.length === 0 ? <tr><td colSpan={3} className="p-10 text-center text-slate-500">No coupons.</td></tr> : coupons.map(c => (
                        <tr key={c.id} className="border-t border-slate-800/50">
                          <td className="p-4 font-mono font-bold text-indigo-400">{c.code}</td>
                          <td className="p-4 text-xs">{c.usedCount} / {c.usageLimit}</td>
                          <td className="p-4 text-right"><button onClick={() => saveCoupons(coupons.filter(cp => cp.id !== c.id))} className="text-[10px] bg-red-900/50 text-red-400 px-3 py-1.5 rounded-lg">Del</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeAdminTab === 'withdrawals' && (
              <div className="glass rounded-3xl overflow-hidden border border-slate-800 shadow-xl">
                <table className="w-full text-left">
                  <thead className="bg-slate-800/50"><tr><th className="p-4 text-xs font-bold uppercase text-slate-400">IP</th><th className="p-4 text-xs font-bold uppercase text-slate-400">Amount</th><th className="p-4 text-xs font-bold uppercase text-slate-400">Status</th><th className="p-4 text-xs font-bold uppercase text-slate-400 text-right">Actions</th></tr></thead>
                  <tbody>
                    {withdrawals.length === 0 ? <tr><td colSpan={4} className="p-10 text-center text-slate-500">No requests.</td></tr> : withdrawals.map(w => (
                      <tr key={w.id} className="border-t border-slate-800/50">
                        <td className="p-4 text-xs font-mono">{w.ip}</td>
                        <td className="p-4 font-bold text-orange-400">{w.amount}</td>
                        <td className="p-4"><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${w.status === 'pending' ? 'bg-orange-500/20 text-orange-400' : w.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>{w.status}</span></td>
                        <td className="p-4 text-right">{w.status === 'pending' && <div className="flex gap-1 justify-end"><button onClick={() => updateWithdrawalStatus(w.id, 'approved')} className="bg-emerald-600 text-[9px] px-2 py-1 rounded">Approve</button><button onClick={() => updateWithdrawalStatus(w.id, 'rejected')} className="bg-red-600 text-[9px] px-2 py-1 rounded">Reject</button></div>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeAdminTab === 'settings' && (
              <div className="glass p-8 rounded-3xl space-y-8 border border-slate-800 shadow-2xl">
                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <h3 className="font-bold border-b border-slate-800 pb-2 text-indigo-400 tracking-wide uppercase text-xs">System Parameters</h3>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-widest">Daily Bonus</label>
                      <input type="number" value={pendingSettings.dailyBonusAmount} onChange={(e) => setPendingSettings({ ...pendingSettings, dailyBonusAmount: parseInt(e.target.value) || 0 })} className="w-full bg-slate-900 rounded-xl p-3 border border-slate-800 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-widest">Referral Bonus</label>
                      <input type="number" value={pendingSettings.referralBonusAmount} onChange={(e) => setPendingSettings({ ...pendingSettings, referralBonusAmount: parseInt(e.target.value) || 0 })} className="w-full bg-slate-900 rounded-xl p-3 border border-slate-800 text-sm" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1 uppercase tracking-widest">Min Withdraw</label>
                      <input type="number" value={pendingSettings.minWithdrawal} onChange={(e) => setPendingSettings({ ...pendingSettings, minWithdrawal: parseInt(e.target.value) || 0 })} className="w-full bg-slate-900 rounded-xl p-3 border border-slate-800 text-sm" />
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <input type="checkbox" checked={pendingSettings.isWithdrawalEnabled} onChange={(e) => setPendingSettings({ ...pendingSettings, isWithdrawalEnabled: e.target.checked })} className="w-4 h-4 rounded bg-slate-900 border-slate-800" id="en-wd" />
                      <label htmlFor="en-wd" className="text-sm font-bold">Allow Withdrawals</label>
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <h3 className="font-bold border-b border-slate-800 pb-2 text-indigo-400 tracking-wide uppercase text-xs">Ad Codes Management</h3>
                    
                    {Object.keys(pendingSettings.adCodes).map(slot => (
                      <div key={slot} className="space-y-3 bg-slate-900/50 p-4 rounded-2xl border border-slate-800">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{slot} Section</label>
                          <button onClick={() => addAdSlot(slot)} className="text-[10px] bg-indigo-600 px-2 py-1 rounded-lg font-bold">Add Slot</button>
                        </div>
                        
                        {(pendingSettings.adCodes[slot] || []).map((code, idx) => (
                          <div key={idx} className="space-y-2 relative group">
                            <textarea 
                              value={code} 
                              onChange={(e) => updateAdSlot(slot, idx, e.target.value)}
                              className="w-full bg-slate-950 rounded-xl p-3 border border-slate-800 text-[10px] font-mono h-24 focus:border-indigo-500 outline-none"
                              placeholder="Paste HTML ad code here..."
                            />
                            <button onClick={() => removeAdSlot(slot, idx)} className="absolute -top-1 -right-1 bg-red-600 p-1 rounded-full text-[8px] hover:scale-110 transition-transform">✕</button>
                          </div>
                        ))}
                        
                        {pendingSettings.adCodes[slot].length === 0 && <div className="text-[9px] text-slate-600 italic">No ads configured for this slot.</div>}
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="pt-6 border-t border-slate-800 text-right">
                   <button onClick={handleSettingsSave} className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold shadow-xl shadow-indigo-600/20 transition-all hover:-translate-y-1">SAVE ALL SETTINGS</button>
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
