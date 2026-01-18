
import React, { useState, useEffect, useCallback } from 'react';

interface GameProps {
  onComplete: (score: number, timeSpent: number) => void;
  onClose: () => void;
  gameType: 'memory' | 'clicker';
}

export const MemoryGame: React.FC<GameProps> = ({ onComplete, onClose }) => {
  const [cards, setCards] = useState<{ id: number, emoji: string, flipped: boolean, matched: boolean }[]>([]);
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [startTime] = useState(Date.now());

  const emojis = ['🪙', '💎', '💰', '💵', '💳', '🏦', '💹', '📈'];

  useEffect(() => {
    const deck = [...emojis, ...emojis]
      .sort(() => Math.random() - 0.5)
      .map((emoji, idx) => ({ id: idx, emoji, flipped: false, matched: false }));
    setCards(deck);
  }, []);

  const handleFlip = (id: number) => {
    if (flipped.length === 2 || cards[id].flipped || cards[id].matched) return;
    
    const newCards = [...cards];
    newCards[id].flipped = true;
    setCards(newCards);
    setFlipped([...flipped, id]);

    if (flipped.length === 1) {
      setMoves(m => m + 1);
      const firstId = flipped[0];
      if (newCards[firstId].emoji === newCards[id].emoji) {
        newCards[firstId].matched = true;
        newCards[id].matched = true;
        setCards(newCards);
        setFlipped([]);
        
        if (newCards.every(c => c.matched)) {
          const timeSpent = Math.floor((Date.now() - startTime) / 1000);
          onComplete(10, timeSpent);
        }
      } else {
        setTimeout(() => {
          newCards[firstId].flipped = false;
          newCards[id].flipped = false;
          setCards(newCards);
          setFlipped([]);
        }, 1000);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 flex items-center justify-center p-4">
      <div className="glass max-w-md w-full p-6 rounded-3xl relative overflow-hidden">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
        <h2 className="text-2xl font-bold mb-2">Memory Match</h2>
        <p className="text-slate-400 mb-6">Find all pairs. Moves: {moves}</p>
        
        <div className="grid grid-cols-4 gap-3">
          {cards.map((card) => (
            <div 
              key={card.id}
              onClick={() => handleFlip(card.id)}
              className={`aspect-square flex items-center justify-center text-2xl rounded-xl cursor-pointer transition-all duration-300 transform ${card.flipped || card.matched ? 'bg-indigo-600 rotate-y-180' : 'bg-slate-800'}`}
            >
              {card.flipped || card.matched ? card.emoji : '?'}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const ClickerGame: React.FC<GameProps> = ({ onComplete, onClose }) => {
  const [clicks, setClicks] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isActive, setIsActive] = useState(false);
  const [startTime, setStartTime] = useState(0);

  useEffect(() => {
    let interval: any;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(t => t - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      const timeSpent = Math.floor((Date.now() - startTime) / 1000);
      onComplete(clicks, timeSpent);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, clicks, startTime]);

  const handleStart = () => {
    setIsActive(true);
    setStartTime(Date.now());
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/95 flex items-center justify-center p-4">
      <div className="glass max-w-md w-full p-6 rounded-3xl text-center relative overflow-hidden">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">✕</button>
        <h2 className="text-2xl font-bold mb-2">Coin Clicker</h2>
        <p className="text-slate-400 mb-6">Click as many coins as you can in 30 seconds!</p>
        
        <div className="mb-8">
          <div className="text-5xl font-black text-yellow-500 mb-2">{clicks}</div>
          <div className="text-xl font-medium text-indigo-400">Time Left: {timeLeft}s</div>
        </div>

        {!isActive ? (
          <button 
            onClick={handleStart}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 rounded-2xl font-bold text-lg transition-colors shadow-lg shadow-indigo-500/20"
          >
            START GAME
          </button>
        ) : (
          <button 
            onClick={() => setClicks(c => c + 1)}
            className="w-48 h-48 mx-auto bg-yellow-500 rounded-full border-8 border-yellow-600 shadow-2xl active:scale-95 transition-transform flex items-center justify-center text-6xl select-none"
          >
            🪙
          </button>
        )}
      </div>
    </div>
  );
};
