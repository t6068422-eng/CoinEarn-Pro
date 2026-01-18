
import React from 'react';

interface LayoutProps {
  children: React.ReactNode;
  userCoins: number;
  onAdminClick: () => void;
  isAdmin?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, userCoins, onAdminClick, isAdmin }) => {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 glass px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center text-xl font-bold text-black coin-spin">
            $
          </div>
          <span className="text-xl font-bold tracking-tight text-white">CoinEarn <span className="text-yellow-500">Pro</span></span>
        </div>
        
        {!isAdmin && (
          <div className="flex items-center gap-4">
            <div className="bg-slate-800 rounded-full px-4 py-2 flex items-center gap-2 border border-slate-700">
              <span className="text-yellow-500 font-bold">🪙 {userCoins.toLocaleString()}</span>
            </div>
          </div>
        )}

        {isAdmin && (
          <div className="bg-red-500/20 text-red-400 px-4 py-1 rounded-full text-xs font-bold border border-red-500/30 uppercase tracking-widest">
            Admin Panel
          </div>
        )}
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-6xl">
        {children}
      </main>

      <footer className="py-12 mt-auto border-t border-slate-800/50">
        <div className="container mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-slate-500 text-sm">
            © 2024 CoinEarn Pro. All rights reserved.
          </div>
          <button 
            onClick={onAdminClick}
            className="text-slate-600 hover:text-slate-400 text-xs font-medium transition-colors"
          >
            Admin Access
          </button>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
