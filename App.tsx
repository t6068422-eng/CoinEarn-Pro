
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

// Fixed the missing implementation and added export default App
const App: React.FC = () => {
  const [view, setView] = useState<'user' | 'admin' | 'admin-login'>('user');
  const [isAdminAuth, setIsAdminAuth] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [ip, setIp] = useState<string>('');
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

  // Initial user loading and registration
  useEffect(() => {
    const init = async () => {
      // Mocking IP retrieval for local storage simulation
      const mockIp = '127.0.0.1';
      setIp(mockIp);

      const allUsers = StorageService.getUsers();
      setUsers(allUsers);
      
      let user = allUsers.find(u => u.ip === mockIp);
      
      if (!user) {
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');
        let referredBy = null;
        
        if (refCode) {
          const referrer = allUsers.find(u => u.referralCode === refCode);
          if (referrer) {
            referredBy = referrer.referralCode;
            referrer.coins += settings.referralBonusAmount;
            referrer.totalReferrals += 1;
            StorageService.setUsers([...allUsers]);
          }
        }

        user = {
          ip: mockIp,
          coins: 0,
          tasksCompleted: [],
          couponsClaimed: [],
          lastDailyBonus: null,
          referralCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
          referredBy,
          totalReferrals: 0,
          isBlocked: false,
          joinedAt: new Date().toISOString(),
        };
        
        const newUsers = [...StorageService.getUsers(), user];
        StorageService.setUsers(newUsers);
        setUsers(newUsers);
      }
      
      setCurrentUser(user);
      setTasks(StorageService.getTasks());
      setCoupons(StorageService.getCoupons());
      setWithdrawals(StorageService.getWithdrawals());

      if (!StorageService.isWelcomed(mockIp)) {
        setShowWelcome(true);
      }
    };
    init();
  }, [settings.referralBonusAmount]);

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

  const handleDailyBonus = () => {
    if (!currentUser) return;
    const now = new Date();
    const last = currentUser.lastDailyBonus ? new Date(currentUser.lastDailyBonus) : null;
    
    if (last && now.getTime() - last.getTime() < 24 * 60 * 60 * 1000) {
      alert('Bonus already claimed today!');
      return;
    }

    updateCurrentUser({
      coins: currentUser.coins + settings.dailyBonusAmount,
      lastDailyBonus: now.toISOString()
    });
    alert(`Success! You earned ${settings.dailyBonusAmount} coins.`);
  };

  const handleTaskComplete = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !currentUser || currentUser.tasksCompleted.includes(taskId)) return;

    setIsTaskPending(taskId);
    setTaskTimer(10); // 10 second timer to simulate validation
    window.open(task.link, '_blank');

    const interval = setInterval(() => {
      setTaskTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          updateCurrentUser({
            coins: currentUser.coins + task.reward,
            tasksCompleted: [...currentUser.tasksCompleted, taskId]
          });
          setIsTaskPending(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleGameComplete = (baseReward: number, timeSpent: number) => {
    if (!currentUser) return;
    const game = INITIAL_GAMES.find(g => g.id === activeGame);
    if (!game) return;

    const timeBonus = Math.floor(timeSpent / 60) * game.timeBonus;
    const totalReward = Math.min(baseReward + timeBonus, game.maxReward);

    updateCurrentUser({ coins: currentUser.coins + totalReward });
    setActiveGame(null);
    alert(`Game over! You earned ${totalReward} coins.`);
  };

  const handleCouponRedeem = (code: string) => {
    if (!currentUser) return;
    const coupon = coupons.find(c => c.code.toUpperCase() === code.toUpperCase());
    
    if (!coupon) {
      alert('Invalid coupon code!');
      return;
    }
    if (coupon.usedCount >= coupon.usageLimit) {
      alert('Coupon usage limit reached!');
      return;
    }
    if (currentUser.couponsClaimed.includes(coupon.id)) {
      alert('You have already claimed this coupon!');
      return;
    }
    if (new Date(coupon.expiryDate) < new Date()) {
      alert('Coupon has expired!');
      return;
    }

    coupon.usedCount += 1;
    StorageService.setCoupons([...coupons]);
    setCoupons([...coupons]);

    updateCurrentUser({
      coins: currentUser.coins + coupon.reward,
      couponsClaimed: [...currentUser.couponsClaimed, coupon.id]
    });
    alert(`Success! ${coupon.reward} coins added to your balance.`);
  };

  const handleWithdrawal = (address: string, amount: number) => {
    if (!currentUser) return;
    if (amount < settings.minWithdrawal) {
      alert(`Minimum withdrawal is ${settings.minWithdrawal} coins.`);
      return;
    }
    if (currentUser.coins < amount) {
      alert('Insufficient balance!');
      return;
    }

    const request: WithdrawalRequest = {
      id: Math.random().toString(36).substring(7),
      ip: currentUser.ip,
      amount,
      walletAddress: address,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    const updatedWithdrawals = [request, ...withdrawals];
    StorageService.setWithdrawals(updatedWithdrawals);
    setWithdrawals(updatedWithdrawals);
    
    updateCurrentUser({ coins: currentUser.coins - amount });
    alert('Withdrawal request submitted successfully!');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  if (view === 'admin-login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <form 
          className="glass p-8 rounded-3xl w-full max-w-sm"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            if (formData.get('email') === ADMIN_EMAIL && formData.get('password') === ADMIN_PASSWORD) {
              setIsAdminAuth(true);
              setView('admin');
            } else {
              alert('Invalid credentials');
            }
          }}
        >
          <h2 className="text-2xl font-bold mb-6 text-center">Admin Login</h2>
          <input name="email" type="email" placeholder="Email" className="w-full bg-slate-800 border-slate-700 rounded-xl px-4 py-3 mb-4 text-white" required />
          <input name="password" type="password" placeholder="Password" className="w-full bg-slate-800 border-slate-700 rounded-xl px-4 py-3 mb-6 text-white" required />
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 py-3 rounded-xl font-bold">Login</button>
          <button type="button" onClick={() => setView('user')} className="w-full mt-4 text-slate-400 text-sm">Back to User App</button>
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
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Header Stats */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass p-6 rounded-3xl bg-gradient-to-br from-indigo-600/20 to-transparent border-indigo-500/20">
              <h3 className="text-slate-400 text-sm font-medium mb-1">Balance</h3>
              <div className="text-3xl font-bold text-white flex items-center gap-2">
                <span className="text-yellow-500">🪙</span> {currentUser?.coins.toLocaleString()}
              </div>
            </div>
            <div className="glass p-6 rounded-3xl bg-gradient-to-br from-emerald-600/20 to-transparent border-emerald-500/20">
              <h3 className="text-slate-400 text-sm font-medium mb-1">Referrals</h3>
              <div className="text-3xl font-bold text-white flex items-center gap-2">
                <span className="text-blue-500">👥</span> {currentUser?.totalReferrals || 0}
              </div>
            </div>
            <div className="glass p-6 rounded-3xl bg-gradient-to-br from-purple-600/20 to-transparent border-purple-500/20">
              <h3 className="text-slate-400 text-sm font-medium mb-1">Tasks Done</h3>
              <div className="text-3xl font-bold text-white flex items-center gap-2">
                <span className="text-purple-500">✅</span> {currentUser?.tasksCompleted.length || 0}
              </div>
            </div>
          </section>

          <AdDisplay codes={settings.adCodes.main} />

          {/* Main Navigation */}
          <nav className="flex overflow-x-auto gap-2 p-1 bg-slate-900/50 rounded-2xl border border-slate-800 scrollbar-hide">
            {[
              { id: 'tasks', label: 'Tasks', icon: '📝' },
              { id: 'games', label: 'Games', icon: '🎮' },
              { id: 'bonus', label: 'Daily Bonus', icon: '🎁' },
              { id: 'referrals', label: 'Referrals', icon: '🤝' },
              { id: 'coupons', label: 'Coupons', icon: '🎟️' },
              { id: 'withdraw', label: 'Withdraw', icon: '💸' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 min-w-fit flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                  activeTab === tab.id 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                    : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="min-h-[400px]">
            {activeTab === 'tasks' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                  <h2 className="text-2xl font-bold">Available Tasks</h2>
                  <input 
                    type="text" 
                    placeholder="Search tasks..." 
                    className="bg-slate-800 border-slate-700 rounded-xl px-4 py-2 w-full md:w-64"
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tasks.filter(t => t.isActive && !currentUser?.tasksCompleted.includes(t.id) && t.title.toLowerCase().includes(taskSearch.toLowerCase())).map(task => (
                    <div key={task.id} className="glass p-6 rounded-3xl border border-slate-800 hover:border-indigo-500/50 transition-colors flex flex-col">
                      <div className="flex justify-between items-start mb-4">
                        <span className="px-3 py-1 bg-slate-800 rounded-full text-xs font-bold text-slate-400 uppercase tracking-wider">{task.category}</span>
                        <div className="text-yellow-500 font-bold">+{task.reward} 🪙</div>
                      </div>
                      <h3 className="text-lg font-bold mb-2">{task.title}</h3>
                      <p className="text-slate-400 text-sm mb-6 flex-1">{task.description}</p>
                      <button 
                        onClick={() => handleTaskComplete(task.id)}
                        disabled={isTaskPending !== null}
                        className={`w-full py-3 rounded-xl font-bold transition-all ${
                          isTaskPending === task.id ? 'bg-slate-700 cursor-not-allowed' : 'bg-slate-800 hover:bg-indigo-600'
                        }`}
                      >
                        {isTaskPending === task.id ? `Verifying... ${taskTimer}s` : 'Start Task'}
                      </button>
                    </div>
                  ))}
                </div>
                {tasks.filter(t => t.isActive && !currentUser?.tasksCompleted.includes(t.id)).length === 0 && (
                  <div className="text-center py-20 text-slate-500 bg-slate-900/20 rounded-3xl border border-dashed border-slate-800">
                    No tasks available at the moment. Check back later!
                  </div>
                )}
                <AdDisplay codes={settings.adCodes.tasks} />
              </div>
            )}

            {activeTab === 'games' && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <h2 className="text-2xl font-bold">Earn by Playing</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {INITIAL_GAMES.map(game => (
                    <div key={game.id} className="glass p-8 rounded-3xl flex flex-col md:flex-row items-center gap-8 border border-slate-800 hover:border-indigo-500/50 transition-all group">
                      <div className="text-7xl bg-slate-800 w-24 h-24 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">{game.icon}</div>
                      <div className="flex-1 text-center md:text-left">
                        <h3 className="text-2xl font-bold mb-2">{game.name}</h3>
                        <p className="text-slate-400 mb-4">Earn up to <span className="text-yellow-500 font-bold">{game.maxReward} coins</span> per session.</p>
                        <button 
                          onClick={() => setActiveGame(game.id as any)}
                          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-bold"
                        >
                          Play Now
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <AdDisplay codes={settings.adCodes.games} />
              </div>
            )}

            {activeTab === 'bonus' && (
              <div className="max-w-md mx-auto py-12 text-center animate-in fade-in zoom-in-95 duration-300">
                <div className="text-8xl mb-6">🎁</div>
                <h2 className="text-3xl font-bold mb-4">Daily Bonus</h2>
                <p className="text-slate-400 mb-8">Come back every 24 hours to claim your free reward!</p>
                <div className="glass p-8 rounded-3xl border-2 border-indigo-500/30">
                  <div className="text-5xl font-black text-yellow-500 mb-2">+{settings.dailyBonusAmount}</div>
                  <div className="text-slate-400 text-sm mb-6">COINS AVAILABLE</div>
                  <button 
                    onClick={handleDailyBonus}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 rounded-2xl font-bold text-lg shadow-lg shadow-indigo-500/20"
                  >
                    Claim Reward
                  </button>
                </div>
                <AdDisplay codes={settings.adCodes.daily} className="mt-8" />
              </div>
            )}

            {activeTab === 'referrals' && (
              <div className="space-y-8 animate-in fade-in duration-300">
                <div className="glass p-8 rounded-3xl text-center max-w-2xl mx-auto">
                  <h2 className="text-3xl font-bold mb-4">Invite & Earn</h2>
                  <p className="text-slate-400 mb-8">Share your referral link and earn <span className="text-yellow-500 font-bold">{settings.referralBonusAmount} coins</span> for every friend who joins!</p>
                  
                  <div className="flex flex-col md:flex-row gap-4 items-stretch">
                    <div className="flex-1 bg-slate-800 border border-slate-700 rounded-2xl px-6 py-4 text-left font-mono text-indigo-400 overflow-hidden text-ellipsis whitespace-nowrap">
                      {referralLink}
                    </div>
                    <button 
                      onClick={() => copyToClipboard(referralLink)}
                      className={`px-8 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
                        copyFeedback ? 'bg-emerald-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      {copyFeedback ? '✓ Copied' : 'Copy Link'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'coupons' && (
              <div className="max-w-md mx-auto py-12 text-center animate-in fade-in duration-300">
                <h2 className="text-3xl font-bold mb-8">Redeem Coupon</h2>
                <form 
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const input = e.currentTarget.querySelector('input') as HTMLInputElement;
                    handleCouponRedeem(input.value);
                    input.value = '';
                  }}
                >
                  <input 
                    type="text" 
                    placeholder="Enter coupon code" 
                    className="w-full bg-slate-800 border-slate-700 rounded-2xl px-6 py-4 text-center text-xl font-bold uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal"
                    required
                  />
                  <button type="submit" className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 rounded-2xl font-bold text-lg">
                    Apply Code
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'withdraw' && (
              <div className="max-w-md mx-auto py-12 animate-in fade-in duration-300">
                <h2 className="text-3xl font-bold mb-2 text-center">Withdraw Coins</h2>
                <p className="text-slate-400 mb-8 text-center">Minimum withdrawal: <span className="text-white font-bold">{settings.minWithdrawal} 🪙</span></p>
                
                <form 
                  className="glass p-8 rounded-3xl space-y-6"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    handleWithdrawal(formData.get('address') as string, Number(formData.get('amount')));
                    e.currentTarget.reset();
                  }}
                >
                  {!settings.isWithdrawalEnabled && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl text-yellow-500 text-sm font-medium">
                      ⚠️ Withdrawals are currently disabled by the administrator.
                    </div>
                  )}
                  <div>
                    <label className="block text-slate-400 text-sm mb-2">Wallet Address (USDT TRC-20 / etc.)</label>
                    <input name="address" type="text" placeholder="Enter your address" className="w-full bg-slate-800 border-slate-700 rounded-xl px-4 py-3" required disabled={!settings.isWithdrawalEnabled} />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-sm mb-2">Amount (Coins)</label>
                    <input name="amount" type="number" min={settings.minWithdrawal} placeholder="0" className="w-full bg-slate-800 border-slate-700 rounded-xl px-4 py-3" required disabled={!settings.isWithdrawalEnabled} />
                  </div>
                  <button 
                    type="submit" 
                    disabled={!settings.isWithdrawalEnabled}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-500 rounded-xl font-bold text-lg"
                  >
                    Request Withdrawal
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Admin View */
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Administrator Panel</h1>
            <button onClick={() => setView('user')} className="text-slate-400 hover:text-white flex items-center gap-2">
              <span>←</span> Return to App
            </button>
          </div>

          <nav className="flex gap-2 p-1 bg-slate-900 rounded-2xl border border-slate-800 overflow-x-auto">
            {['dashboard', 'users', 'tasks', 'coupons', 'withdrawals', 'settings'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveAdminTab(tab as any)}
                className={`px-6 py-2 rounded-xl font-semibold capitalize whitespace-nowrap ${
                  activeAdminTab === tab ? 'bg-indigo-600' : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>

          <div className="min-h-[500px]">
            {activeAdminTab === 'dashboard' && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { label: 'Total Users', value: users.length, color: 'text-blue-500' },
                  { label: 'Total Coins', value: users.reduce((acc, u) => acc + u.coins, 0), color: 'text-yellow-500' },
                  { label: 'Pending Withdraws', value: withdrawals.filter(w => w.status === 'pending').length, color: 'text-orange-500' },
                  { label: 'Tasks Completed', value: users.reduce((acc, u) => acc + u.tasksCompleted.length, 0), color: 'text-emerald-500' },
                ].map(stat => (
                  <div key={stat.label} className="glass p-6 rounded-3xl">
                    <div className="text-slate-400 text-sm mb-1">{stat.label}</div>
                    <div className={`text-3xl font-bold ${stat.color}`}>{stat.value.toLocaleString()}</div>
                  </div>
                ))}
              </div>
            )}

            {activeAdminTab === 'users' && (
              <div className="glass rounded-3xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-900/50">
                    <tr>
                      <th className="px-6 py-4 text-slate-400 text-xs font-bold uppercase">IP Address</th>
                      <th className="px-6 py-4 text-slate-400 text-xs font-bold uppercase">Coins</th>
                      <th className="px-6 py-4 text-slate-400 text-xs font-bold uppercase">Referrals</th>
                      <th className="px-6 py-4 text-slate-400 text-xs font-bold uppercase">Joined</th>
                      <th className="px-6 py-4 text-slate-400 text-xs font-bold uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {users.map(u => (
                      <tr key={u.ip} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-6 py-4 font-mono text-indigo-400">{u.ip}</td>
                        <td className="px-6 py-4 font-bold">{u.coins.toLocaleString()}</td>
                        <td className="px-6 py-4">{u.totalReferrals}</td>
                        <td className="px-6 py-4 text-slate-400 text-sm">{new Date(u.joinedAt).toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${u.isBlocked ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                            {u.isBlocked ? 'Blocked' : 'Active'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeAdminTab === 'settings' && (
              <div className="max-w-2xl mx-auto glass p-8 rounded-3xl space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-slate-400 text-sm mb-2">Daily Bonus Amount</label>
                    <input 
                      type="number" 
                      className="w-full bg-slate-800 border-slate-700 rounded-xl px-4 py-2"
                      value={pendingSettings.dailyBonusAmount}
                      onChange={(e) => setPendingSettings({...pendingSettings, dailyBonusAmount: Number(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-sm mb-2">Referral Bonus Amount</label>
                    <input 
                      type="number" 
                      className="w-full bg-slate-800 border-slate-700 rounded-xl px-4 py-2"
                      value={pendingSettings.referralBonusAmount}
                      onChange={(e) => setPendingSettings({...pendingSettings, referralBonusAmount: Number(e.target.value)})}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-sm mb-2">Min. Withdrawal</label>
                    <input 
                      type="number" 
                      className="w-full bg-slate-800 border-slate-700 rounded-xl px-4 py-2"
                      value={pendingSettings.minWithdrawal}
                      onChange={(e) => setPendingSettings({...pendingSettings, minWithdrawal: Number(e.target.value)})}
                    />
                  </div>
                  <div className="flex items-center gap-4 pt-8">
                    <input 
                      type="checkbox" 
                      id="enable-withdraw"
                      checked={pendingSettings.isWithdrawalEnabled}
                      onChange={(e) => setPendingSettings({...pendingSettings, isWithdrawalEnabled: e.target.checked})}
                    />
                    <label htmlFor="enable-withdraw" className="text-sm font-bold">Enable Withdrawals</label>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold border-b border-slate-800 pb-2">Advertising Codes (HTML)</h3>
                  {Object.keys(pendingSettings.adCodes).map(key => (
                    <div key={key}>
                      <label className="block text-slate-400 text-sm mb-2 capitalize">{key} Ad Slots (one per line)</label>
                      <textarea 
                        className="w-full bg-slate-800 border-slate-700 rounded-xl px-4 py-2 h-24 font-mono text-xs"
                        placeholder="<div>...</div>"
                        value={pendingSettings.adCodes[key].join('\n')}
                        onChange={(e) => {
                          const codes = e.target.value.split('\n').filter(l => l.trim() !== '');
                          setPendingSettings({
                            ...pendingSettings,
                            adCodes: { ...pendingSettings.adCodes, [key]: codes }
                          });
                        }}
                      />
                    </div>
                  ))}
                </div>

                <button 
                  onClick={() => {
                    StorageService.setSettings(pendingSettings);
                    setSettings(pendingSettings);
                    alert('Settings saved successfully!');
                  }}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold"
                >
                  Save Changes
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Game Modals */}
      {activeGame === 'memory' && (
        <MemoryGame 
          gameType="memory" 
          onComplete={handleGameComplete} 
          onClose={() => setActiveGame(null)} 
        />
      )}
      {activeGame === 'clicker' && (
        <ClickerGame 
          gameType="clicker" 
          onComplete={handleGameComplete} 
          onClose={() => setActiveGame(null)} 
        />
      )}

      {/* Welcome Modal */}
      {showWelcome && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="glass max-w-sm w-full p-8 rounded-3xl text-center space-y-6">
            <div className="text-6xl">👋</div>
            <h2 className="text-2xl font-bold">Welcome to CoinEarn!</h2>
            <p className="text-slate-400">Start completing tasks and playing games to earn real crypto rewards.</p>
            <button 
              onClick={() => {
                setShowWelcome(false);
                StorageService.setWelcomed(ip);
              }}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 rounded-2xl font-bold"
            >
              Get Started
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;
