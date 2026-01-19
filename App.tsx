import React, { useState, useEffect, useMemo, useRef } from 'react';
import Layout from './components/Layout';
import { MemoryGame, ClickerGame } from './components/Games';
import { StorageService } from './services/storage';
import { UserProfile, Task, Coupon, WithdrawalRequest, AppSettings } from './types';
import { ADMIN_EMAIL, ADMIN_PASSWORD, CATEGORIES, INITIAL_GAMES } from './constants';

const AdDisplay: React.FC<{ codes?: string[], className?: string }> = ({ codes, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (codes && codes.length > 0 && containerRef.current) {
      containerRef.current.innerHTML = '';
      codes.forEach(html => {
        if (!html || html.trim() === '') return;
        try {
          const wrapper = document.createElement('div');
          wrapper.className = 'ad-slot-wrapper mb-6 last:mb-0 w-full flex justify-center';
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
      className={`ad-container my-8 flex flex-col items-center gap-6 ${className}`}
    />
  );
};

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
    return `${window.location.origin}${window.location.pathname}?ref=${currentUser?.referralCode || ''}`;
  }, [currentUser?.referralCode]);

  useEffect(() => {
    setPendingSettings(settings);
  }, [settings]);

  useEffect(() => {
    const init = async () => {
      try {
        let storedIp: string;
        try {
          storedIp = localStorage.getItem('ce_cached_ip') || 'user-' + Math.random().toString(36).substring(2, 7);
          localStorage.setItem('ce_cached_ip', storedIp);
        } catch {
          storedIp = 'anonymous-' + Math.random().toString(36).substring(2, 7);
        }
        setIp(storedIp);

        const allUsers = StorageService.getUsers();
        let user = allUsers.find(u => u.ip === storedIp);
        
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
        setCoupons(StorageService.getCoupons());
        setWithdrawals(StorageService.getWithdrawals());

        if (!StorageService.isWelcomed(storedIp)) {
          setShowWelcome(true);
        }
      } catch (error) {
        console.error("Critical initialization failure:", error);
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

  const handleSettingsSave = () => {
    setSettings(pendingSettings);
    StorageService.setSettings(pendingSettings);
    alert('Global settings updated successfully!');
  };

  const addAdSlot = (section: string) => {
    const currentCodes = pendingSettings.adCodes[section] || [];
    setPendingSettings({
      ...pendingSettings,
      adCodes: { ...pendingSettings.adCodes, [section]: [...currentCodes, ""] }
    });
  };

  const removeAdSlot = (section: string, index: number) => {
    const currentCodes = [...(pendingSettings.adCodes[section] || [])];
    currentCodes.splice(index, 1);
    setPendingSettings({
      ...pendingSettings,
      adCodes: { ...pendingSettings.adCodes, [section]: currentCodes }
    });
  };

  if (view === 'admin-login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
        <form 
          className="glass p-10 rounded-[2.5rem] w-full max-w-sm border-white/10 shadow-2xl animate-in zoom-in-95 duration-500"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            if (formData.get('email') === ADMIN_EMAIL && formData.get('password') === ADMIN_PASSWORD) {
              setIsAdminAuth(true);
              setView('admin');
            } else {
              alert('Access Denied: Invalid Credentials');
            }
          }}
        >
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl mx-auto mb-6 flex items-center justify-center text-3xl shadow-lg shadow-indigo-600/30">🔐</div>
          <h2 className="text-2xl font-bold mb-6 text-center tracking-tight">Admin Terminal</h2>
          <input name="email" type="email" placeholder="Email Address" className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-5 py-4 mb-4 text-white focus:border-indigo-500 transition-colors" required />
          <input name="password" type="password" placeholder="Passkey" className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-5 py-4 mb-6 text-white focus:border-indigo-500 transition-colors" required />
          <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 py-4 rounded-2xl font-bold shadow-xl shadow-indigo-600/20 transition-transform active:scale-95">Authorize Access</button>
          <button type="button" onClick={() => setView('user')} className="w-full mt-6 text-slate-500 text-sm hover:text-slate-300 transition-colors">Return to Dashboard</button>
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
        <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
          
          <section className="relative py-12 flex flex-col items-center text-center overflow-hidden">
            <div className="hero-glow"></div>
            <div className="floating coin-3d-scene mb-8">
              <div className="coin-3d-model">$</div>
            </div>
            <h1 className="text-5xl md:text-7xl font-black mb-4 tracking-tighter">
              Earn <span className="bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 to-orange-500">Virtual Fortune</span>
            </h1>
            <p className="text-slate-400 text-lg max-w-xl mx-auto mb-10 leading-relaxed font-medium">
              Complete high-reward tasks, dominate fun games, and build your digital empire one coin at a time.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
              {[
                { label: 'Available Coins', value: currentUser?.coins.toLocaleString() || '0', icon: '🪙', color: 'text-yellow-500' },
                { label: 'Active Tasks', value: tasks.filter(t => t.isActive).length, icon: '⚡', color: 'text-indigo-400' },
                { label: 'Network Points', value: currentUser?.totalReferrals || 0, icon: '👥', color: 'text-emerald-400' },
              ].map(stat => (
                <div key={stat.label} className="glass p-6 rounded-[2rem] border-white/5 card-3d">
                  <div className="text-3xl mb-2">{stat.icon}</div>
                  <div className={`text-3xl font-black ${stat.color}`}>{stat.value}</div>
                  <div className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </section>

          <AdDisplay codes={settings.adCodes.main} />

          <nav className="sticky top-20 z-40 flex overflow-x-auto gap-2 p-2 glass rounded-[2rem] border-white/5 no-scrollbar mx-auto w-fit max-w-full shadow-2xl backdrop-blur-2xl">
            {[
              { id: 'tasks', label: 'Tasks', icon: '📝' },
              { id: 'games', label: 'Play Zone', icon: '🎮' },
              { id: 'bonus', label: 'Daily', icon: '🎁' },
              { id: 'referrals', label: 'Team', icon: '🤝' },
              { id: 'coupons', label: 'Coupons', icon: '🎟️' },
              { id: 'withdraw', label: 'Vault', icon: '💸' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] font-bold transition-all whitespace-nowrap ${
                  activeTab === tab.id 
                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 scale-105' 
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="text-xl">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="min-h-[500px]">
            {activeTab === 'tasks' && (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
                  <h2 className="text-3xl font-black tracking-tight">Earning Opportunities</h2>
                  <div className="relative w-full md:w-80">
                    <input 
                      type="text" 
                      placeholder="Search jobs..." 
                      className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 focus:border-indigo-500 outline-none transition-colors"
                      value={taskSearch}
                      onChange={(e) => setTaskSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {tasks.filter(t => t.isActive && !currentUser?.tasksCompleted.includes(t.id) && t.title.toLowerCase().includes(taskSearch.toLowerCase())).map(task => (
                    <div key={task.id} className="glass p-8 rounded-[2.5rem] border-white/5 card-3d flex flex-col">
                      <div className="flex justify-between items-start mb-6">
                        <span className="px-4 py-1.5 bg-indigo-600/10 rounded-full text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">{task.category}</span>
                        <div className="text-yellow-500 font-black text-xl">+{task.reward} 🪙</div>
                      </div>
                      <h3 className="text-2xl font-bold mb-3 tracking-tight">{task.title}</h3>
                      <p className="text-slate-500 text-sm mb-8 flex-1 leading-relaxed">{task.description}</p>
                      <button 
                        onClick={() => handleTaskComplete(task.id)}
                        disabled={isTaskPending !== null}
                        className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
                          isTaskPending === task.id ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 active:scale-95'
                        }`}
                      >
                        {isTaskPending === task.id ? `Verifying... ${taskTimer}s` : 'Initialize Task'}
                      </button>
                    </div>
                  ))}
                </div>
                <AdDisplay codes={settings.adCodes.tasks} />
              </div>
            )}

            {activeTab === 'games' && (
              <div className="space-y-10 animate-in fade-in duration-500">
                <h2 className="text-3xl font-black tracking-tight">Gaming Arcade</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {INITIAL_GAMES.map(game => (
                    <div key={game.id} className="glass p-10 rounded-[3rem] flex flex-col md:flex-row items-center gap-10 border-white/5 card-3d group">
                      <div className="text-8xl bg-slate-900/50 w-32 h-32 rounded-[2rem] flex items-center justify-center group-hover:rotate-12 transition-transform shadow-inner">{game.icon}</div>
                      <div className="flex-1 text-center md:text-left">
                        <h3 className="text-3xl font-black mb-3">{game.name}</h3>
                        <p className="text-slate-500 mb-8 font-medium italic">High stakes fun. Potential: <span className="text-yellow-500 font-bold">{game.maxReward} coins</span></p>
                        <button 
                          onClick={() => setActiveGame(game.id as any)}
                          className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-600/20 transition-all active:scale-95"
                        >
                          Launch Game
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <AdDisplay codes={settings.adCodes.games} />
              </div>
            )}

            {activeTab === 'bonus' && (
              <div className="max-w-md mx-auto py-12 text-center animate-in zoom-in-95 duration-500">
                <div className="floating text-9xl mb-8">🎁</div>
                <h2 className="text-4xl font-black mb-4">Daily Drops</h2>
                <p className="text-slate-500 mb-10 font-medium">Free rewards waiting for you every single day. Persistence pays off.</p>
                <div className="glass p-12 rounded-[3rem] border-2 border-indigo-500/20 shadow-2xl card-3d">
                  <div className="text-6xl font-black text-yellow-500 mb-2">+{settings.dailyBonusAmount}</div>
                  <div className="text-slate-500 text-xs font-black uppercase tracking-[0.3em] mb-10">Coins Loot</div>
                  <button 
                    onClick={() => {
                        const now = new Date();
                        const last = currentUser?.lastDailyBonus ? new Date(currentUser.lastDailyBonus) : null;
                        if (last && now.getTime() - last.getTime() < 24 * 60 * 60 * 1000) {
                          alert('Bonus on cooldown! Check back later.');
                          return;
                        }
                        updateCurrentUser({
                          coins: (currentUser?.coins || 0) + settings.dailyBonusAmount,
                          lastDailyBonus: now.toISOString()
                        });
                        alert('Loot secured! Reward added.');
                    }}
                    className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 rounded-[2rem] font-black text-xl shadow-2xl shadow-indigo-600/40 active:scale-95 transition-all"
                  >
                    Claim Loot
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'referrals' && (
              <div className="max-w-2xl mx-auto py-12 animate-in fade-in duration-500">
                <div className="glass p-12 rounded-[3.5rem] text-center border-white/5 shadow-2xl card-3d">
                  <div className="text-7xl mb-6">👑</div>
                  <h2 className="text-4xl font-black mb-4">Expand the Empire</h2>
                  <p className="text-slate-500 mb-10 font-medium leading-relaxed">Commission your network. Earn <span className="text-yellow-500 font-bold">{settings.referralBonusAmount} coins</span> for every citizen you bring to the platform.</p>
                  
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 bg-slate-950/50 border border-slate-800 rounded-3xl px-8 py-5 text-left font-mono text-indigo-400 overflow-hidden text-ellipsis whitespace-nowrap shadow-inner">
                      {referralLink}
                    </div>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(referralLink);
                        setCopyFeedback(true);
                        setTimeout(() => setCopyFeedback(false), 2000);
                      }}
                      className={`px-10 py-5 rounded-3xl font-black uppercase tracking-widest transition-all shadow-2xl ${
                        copyFeedback ? 'bg-emerald-600 text-white shadow-emerald-600/20' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/30'
                      }`}
                    >
                      {copyFeedback ? '✓ Linked' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'withdraw' && (
              <div className="max-w-md mx-auto py-12 animate-in fade-in duration-500">
                <div className="glass p-12 rounded-[3.5rem] border-white/5 shadow-2xl card-3d">
                  <h2 className="text-3xl font-black mb-2 text-center">Coin Extraction</h2>
                  <p className="text-slate-500 mb-10 text-center font-bold">Threshold: <span className="text-white">{settings.minWithdrawal} 🪙</span></p>
                  
                  <form 
                    className="space-y-6"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      const amount = Number(fd.get('amount'));
                      if (amount < settings.minWithdrawal) {
                        alert('Below threshold!'); return;
                      }
                      if ((currentUser?.coins || 0) < amount) {
                        alert('Insufficient funds!'); return;
                      }
                      const request: WithdrawalRequest = {
                        id: Math.random().toString(36).substring(7),
                        ip: ip,
                        amount,
                        walletAddress: fd.get('address') as string,
                        status: 'pending',
                        createdAt: new Date().toISOString()
                      };
                      setWithdrawals([request, ...withdrawals]);
                      StorageService.setWithdrawals([request, ...withdrawals]);
                      updateCurrentUser({ coins: (currentUser?.coins || 0) - amount });
                      e.currentTarget.reset();
                      alert('Extraction request queued.');
                    }}
                  >
                    {!settings.isWithdrawalEnabled && (
                      <div className="bg-orange-500/10 border border-orange-500/20 p-5 rounded-3xl text-orange-400 text-xs font-black uppercase tracking-widest text-center">
                        Vault Lock Engaged
                      </div>
                    )}
                    <div className="space-y-4">
                      <input name="address" type="text" placeholder="Wallet Address (0x...)" className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 outline-none focus:border-indigo-500 transition-colors" required disabled={!settings.isWithdrawalEnabled} />
                      <input name="amount" type="number" min={settings.minWithdrawal} placeholder="Amount to Extract" className="w-full bg-slate-900/50 border border-slate-800 rounded-2xl px-6 py-4 outline-none focus:border-indigo-500 transition-colors" required disabled={!settings.isWithdrawalEnabled} />
                    </div>
                    <button 
                      type="submit" 
                      disabled={!settings.isWithdrawalEnabled}
                      className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-800 disabled:text-slate-600 rounded-[2rem] font-black uppercase tracking-[0.2em] shadow-2xl shadow-indigo-600/30 active:scale-95 transition-all"
                    >
                      Extract Funds
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-10 animate-in slide-in-from-left duration-500">
          <aside className="glass p-6 rounded-[2.5rem] h-fit border-white/5 shadow-2xl sticky top-28">
            <div className="px-4 py-4 mb-6">
              <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">System Status</div>
              <div className="text-emerald-400 font-bold flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span> Operational
              </div>
            </div>
            <div className="space-y-1">
              {(['dashboard', 'users', 'tasks', 'coupons', 'withdrawals', 'settings'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveAdminTab(tab)}
                  className={`w-full text-left px-5 py-4 rounded-2xl font-bold capitalize transition-all ${
                    activeAdminTab === tab ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-slate-400 hover:bg-white/5'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <button onClick={() => setView('user')} className="w-full mt-10 text-red-400 hover:bg-red-500/10 px-5 py-4 rounded-2xl font-bold transition-all">Close Terminal</button>
          </aside>
          
          <section className="space-y-8 pb-20">
            {activeAdminTab === 'settings' && (
              <div className="glass p-12 rounded-[3rem] space-y-10 border-white/5 shadow-2xl animate-in fade-in duration-500">
                <div className="flex justify-between items-center border-b border-slate-800 pb-8">
                  <h2 className="text-3xl font-black tracking-tight">System Configuration</h2>
                  <button 
                    onClick={handleSettingsSave}
                    className="px-10 py-4 bg-emerald-600 hover:bg-emerald-700 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-emerald-600/20 transition-all active:scale-95"
                  >
                    Commit Changes
                  </button>
                </div>
                
                <div className="grid md:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <h3 className="text-indigo-400 font-black uppercase tracking-widest text-xs">Core Rewards</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block mb-2">Daily Bonus (Coins)</label>
                        <input type="number" value={pendingSettings.dailyBonusAmount} onChange={(e) => setPendingSettings({...pendingSettings, dailyBonusAmount: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 font-mono focus:border-indigo-500 outline-none" />
                      </div>
                      <div>
                        <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block mb-2">Referral Reward (Coins)</label>
                        <input type="number" value={pendingSettings.referralBonusAmount} onChange={(e) => setPendingSettings({...pendingSettings, referralBonusAmount: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 font-mono focus:border-indigo-500 outline-none" />
                      </div>
                      <div>
                        <label className="text-slate-500 text-[10px] font-bold uppercase tracking-widest block mb-2">Min. Withdrawal Threshold</label>
                        <input type="number" value={pendingSettings.minWithdrawal} onChange={(e) => setPendingSettings({...pendingSettings, minWithdrawal: Number(e.target.value)})} className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 font-mono focus:border-indigo-500 outline-none" />
                      </div>
                      <div className="flex items-center gap-4 pt-4">
                        <div 
                          onClick={() => setPendingSettings({...pendingSettings, isWithdrawalEnabled: !pendingSettings.isWithdrawalEnabled})}
                          className={`w-14 h-8 rounded-full relative transition-all cursor-pointer ${pendingSettings.isWithdrawalEnabled ? 'bg-indigo-600' : 'bg-slate-800'}`}
                        >
                          <div className={`absolute top-1 w-6 h-6 bg-white rounded-full transition-all shadow-md ${pendingSettings.isWithdrawalEnabled ? 'left-7' : 'left-1'}`} />
                        </div>
                        <span className="text-sm font-bold uppercase tracking-widest">Global Payouts</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-8">
                    <h3 className="text-indigo-400 font-black uppercase tracking-widest text-xs">Multi-Ad Placement</h3>
                    {Object.keys(pendingSettings.adCodes).map(section => (
                      <div key={section} className="p-6 bg-slate-950/50 rounded-[2rem] border border-slate-800 space-y-4 shadow-inner">
                        <div className="flex justify-between items-center">
                          <label className="text-slate-400 font-black uppercase tracking-widest text-[10px]">{section} Section</label>
                          <button onClick={() => addAdSlot(section)} className="bg-indigo-600 text-[9px] px-3 py-1.5 rounded-xl font-black uppercase tracking-widest hover:bg-indigo-500 transition-colors">Add Slot</button>
                        </div>
                        {(pendingSettings.adCodes[section] || []).map((code, idx) => (
                          <div key={idx} className="relative group">
                            <textarea 
                              value={code} 
                              onChange={(e) => {
                                const newCodes = [...(pendingSettings.adCodes[section] || [])];
                                newCodes[idx] = e.target.value;
                                setPendingSettings({...pendingSettings, adCodes: {...pendingSettings.adCodes, [section]: newCodes}});
                              }}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-[10px] font-mono h-24 focus:border-indigo-500 outline-none shadow-sm"
                              placeholder="<div id='ad-code'></div>"
                            />
                            <button onClick={() => removeAdSlot(section, idx)} className="absolute -top-2 -right-2 bg-red-600 text-[8px] p-1.5 rounded-full hover:scale-110 transition-transform shadow-lg">✕</button>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {activeAdminTab === 'dashboard' && (
              <div className="grid md:grid-cols-4 gap-6 animate-in fade-in duration-500">
                 {[
                  { label: 'Network Population', value: users.length, color: 'text-indigo-400' },
                  { label: 'Circulating Coins', value: users.reduce((acc, u) => acc + (u.coins || 0), 0).toLocaleString(), color: 'text-yellow-500' },
                  { label: 'Vault Queue', value: withdrawals.filter(w => w.status === 'pending').length, color: 'text-orange-400' },
                  { label: 'Operation Volume', value: users.reduce((acc, u) => acc + (u.tasksCompleted?.length || 0), 0), color: 'text-emerald-400' },
                ].map(stat => (
                  <div key={stat.label} className="glass p-8 rounded-[2.5rem] border-white/5 shadow-xl">
                    <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-2">{stat.label}</div>
                    <div className={`text-4xl font-black ${stat.color}`}>{stat.value}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {activeGame === 'memory' && (
        <MemoryGame 
          gameType="memory" 
          onComplete={(score, time) => {
            if (currentUser) {
              const reward = Math.min(10 + Math.floor(time / 5), 50);
              updateCurrentUser({ coins: currentUser.coins + reward });
              alert(`Game complete! Reward: ${reward} coins.`);
            }
            setActiveGame(null);
          }} 
          onClose={() => setActiveGame(null)} 
        />
      )}
      {activeGame === 'clicker' && (
        <ClickerGame 
          gameType="clicker" 
          onComplete={(score) => {
            if (currentUser) {
              const reward = Math.min(score, 50);
              updateCurrentUser({ coins: currentUser.coins + reward });
              alert(`Game over! You clicked ${score} times. Reward: ${reward} coins.`);
            }
            setActiveGame(null);
          }} 
          onClose={() => setActiveGame(null)} 
        />
      )}

      {showWelcome && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-500">
          <div className="glass max-w-md w-full p-12 rounded-[3.5rem] border-white/10 text-center shadow-2xl card-3d">
            <div className="floating text-8xl mb-8">✨</div>
            <h2 className="text-4xl font-black mb-4 tracking-tighter">Enter the Pro Era</h2>
            <p className="text-slate-400 mb-10 font-medium text-lg leading-relaxed">Welcome to CoinEarn Pro. Your journey from enthusiast to digital elite starts now.</p>
            <button 
              onClick={() => {
                setShowWelcome(false);
                StorageService.setWelcomed(ip);
              }}
              className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 rounded-[2rem] font-black text-xl uppercase tracking-widest shadow-2xl shadow-indigo-600/30 active:scale-95 transition-all"
            >
              Begin Session
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default App;