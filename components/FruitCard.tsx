
import React, { useState, useEffect, useRef } from 'react';
import { Fruit } from '../types';

interface FruitCardProps {
  fruit: Fruit;
  quantity: number;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  isGiftMode?: boolean;
}

const FruitCard: React.FC<FruitCardProps> = ({ fruit, quantity, onAdd, onRemove, isGiftMode }) => {
  const [animationType, setAnimationType] = useState<'none' | 'add' | 'remove'>('none');
  const [bursts, setBursts] = useState<{id: number, x: number, rotate: number}[]>([]);
  const prevQuantity = useRef(quantity);

  const isPremiumGift = fruit.id === 'dates' || fruit.id === 'nuts' || fruit.id === 'pineapple' || fruit.id === 'mango';

  useEffect(() => {
    if (quantity !== prevQuantity.current) {
      const type = (quantity || 0) > (prevQuantity.current || 0) ? 'add' : 'remove';
      setAnimationType(type);
      
      if (type === 'add') {
        const newBursts = Array.from({ length: 3 }).map((_, i) => ({
          id: Date.now() + i,
          x: (i - 1) * 30,
          rotate: (i - 1) * 20
        }));
        setBursts(prev => [...prev, ...newBursts]);
        setTimeout(() => setBursts(prev => prev.filter(b => !newBursts.find(nb => nb.id === b.id))), 600);
      }

      const timer = setTimeout(() => setAnimationType('none'), 600);
      prevQuantity.current = quantity;
      return () => clearTimeout(timer);
    }
  }, [quantity]);

  const handleAdd = () => {
    onAdd(fruit.id);
  };

  const handleRemove = () => {
    if (quantity > 0) {
      onRemove(fruit.id);
    }
  };

  const isSelected = quantity > 0;

  return (
    <div className={`p-4 rounded-3xl cartoon-border transition-all duration-300 flex flex-col items-center gap-2 group relative overflow-hidden cursor-pointer
      ${isSelected ? (isPremiumGift ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-200 shadow-lg' : 'bg-orange-50 border-orange-500 ring-2 ring-orange-200 shadow-lg') : 'bg-white border-[#332111]'} 
      ${isPremiumGift && isGiftMode ? 'border-amber-400 border-dashed' : ''}
      ${animationType === 'add' ? 'animate-pop' : ''}
      hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)]`}>
      
      {isPremiumGift && isGiftMode && (
        <div className="absolute top-2 left-2 bg-amber-500 text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-full z-10 shadow-sm">
          Premium Gift
        </div>
      )}

      <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none ${fruit.color}`}></div>
      
      {bursts.map(burst => (
        <div 
          key={burst.id}
          className="absolute pointer-events-none text-xl animate-fly-up-burst z-20"
          style={{ 
            left: `50%`, 
            top: `30%`,
            '--tw-translate-x': `${burst.x}px`,
            transform: `rotate(${burst.rotate}deg)`
          } as any}
        >
          {fruit.emoji}
        </div>
      ))}

      <div className={`w-20 h-20 rounded-full ${fruit.color} flex items-center justify-center text-4xl mb-2 relative transition-transform duration-300
        ${animationType === 'add' ? 'animate-squash-stretch' : animationType === 'remove' ? 'animate-implode' : 'animate-float'} 
        group-hover:scale-110 group-hover:rotate-6 shadow-inner`}>
        {fruit.emoji}
        {animationType === 'add' && (
          <div className="absolute inset-0 bg-white rounded-full opacity-50 animate-ping"></div>
        )}
      </div>

      <h3 className={`font-cartoon text-lg text-[#332111] transition-colors duration-300 ${isSelected ? (isPremiumGift ? 'text-amber-700' : 'text-orange-600') : 'group-hover:text-orange-500'}`}>
        {fruit.name}
      </h3>
      <p className="text-xs text-gray-500 text-center px-2 line-clamp-2 h-8 transition-colors group-hover:text-gray-700">{fruit.description}</p>
      <p className={`font-bold text-lg transition-transform group-hover:scale-110 ${isPremiumGift ? 'text-amber-700' : 'text-green-600'}`}>₦{fruit.price.toLocaleString()}</p>
      
      <div className={`flex items-center gap-4 mt-4 bg-gray-100 p-2 rounded-2xl border-2 border-[#332111] transition-all duration-300 
        ${isSelected ? 'bg-white shadow-sm' : 'opacity-80 group-hover:opacity-100 group-hover:bg-white'}`}>
        <button 
          onClick={(e) => { e.stopPropagation(); handleRemove(); }}
          disabled={!isSelected}
          className={`w-10 h-10 flex items-center justify-center font-bold text-2xl transition-all active:scale-90 
            ${isSelected ? 'text-red-500 hover:scale-125 hover:rotate-[-10deg]' : 'text-gray-300 cursor-not-allowed'}`}
          aria-label="Remove"
        >
          -
        </button>
        <div className="relative min-w-[2rem] flex justify-center">
          <span className={`font-cartoon text-2xl text-center transition-all duration-300 
            ${animationType === 'add' ? (isPremiumGift ? 'scale-125 text-amber-500' : 'scale-125 text-orange-500') : animationType === 'remove' ? 'scale-75 text-red-500' : 'scale-100 text-[#332111]'}
            ${!isSelected ? 'text-gray-400' : ''}`}>
            {quantity || 0}
          </span>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); handleAdd(); }}
          className={`w-10 h-10 flex items-center justify-center font-bold text-2xl hover:scale-125 hover:rotate-[10deg] transition-all active:scale-90 ${isPremiumGift ? 'text-amber-600' : 'text-green-500'}`}
          aria-label="Add"
        >
          +
        </button>
      </div>
      
      {isSelected && (
        <div className={`absolute top-2 right-2 ${isPremiumGift ? 'bg-amber-600' : 'bg-orange-500'} text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 border-white shadow-sm animate-pop`}>
          ✓
        </div>
      )}
    </div>
  );
};

export default FruitCard;
