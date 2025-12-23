
import React, { useState, useEffect, useRef } from 'react';
import { Fruit } from '../types';

interface FruitCardProps {
  fruit: Fruit;
  quantity: number;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}

const FruitCard: React.FC<FruitCardProps> = ({ fruit, quantity, onAdd, onRemove }) => {
  const [animationType, setAnimationType] = useState<'none' | 'add' | 'remove'>('none');
  const [bursts, setBursts] = useState<{id: number, x: number, y: number}[]>([]);
  const prevQuantity = useRef(quantity);

  useEffect(() => {
    if (quantity !== prevQuantity.current) {
      const type = quantity > prevQuantity.current ? 'add' : 'remove';
      setAnimationType(type);
      
      if (type === 'add') {
        // Create a small visual burst effect
        const newBurst = { id: Date.now(), x: Math.random() * 40 - 20, y: Math.random() * -20 };
        setBursts(prev => [...prev, newBurst]);
        setTimeout(() => setBursts(prev => prev.filter(b => b.id !== newBurst.id)), 500);
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
    onRemove(fruit.id);
  };

  return (
    <div className={`p-4 rounded-3xl cartoon-border bg-white transition-all flex flex-col items-center gap-2 group relative overflow-hidden ${animationType === 'add' ? 'bg-orange-50' : ''}`}>
      {/* Burst particles for "Add" feedback */}
      {bursts.map(burst => (
        <div 
          key={burst.id}
          className="absolute pointer-events-none text-2xl animate-fly-up z-20"
          style={{ 
            left: `calc(50% + ${burst.x}px)`, 
            top: `calc(30% + ${burst.y}px)` 
          }}
        >
          {fruit.emoji}
        </div>
      ))}

      <div className={`w-20 h-20 rounded-full ${fruit.color} flex items-center justify-center text-4xl mb-2 relative transition-transform
        ${animationType === 'add' ? 'animate-jello scale-110' : animationType === 'remove' ? 'animate-wobble' : 'animate-float'} 
        group-hover:scale-110`}>
        {fruit.emoji}
        {/* Glow effect when adding */}
        {animationType === 'add' && (
          <div className="absolute inset-0 bg-white rounded-full opacity-50 animate-ping"></div>
        )}
      </div>

      <h3 className={`font-cartoon text-lg text-[#332111] transition-colors ${animationType === 'add' ? 'text-orange-600' : ''}`}>
        {fruit.name}
      </h3>
      <p className="text-xs text-gray-500 text-center px-2">{fruit.description}</p>
      <p className="font-bold text-green-600">₦{fruit.price.toLocaleString()}</p>
      
      <div className={`flex items-center gap-4 mt-4 bg-gray-100 p-2 rounded-2xl border-2 border-[#332111] transition-transform ${animationType !== 'none' ? 'scale-105' : ''}`}>
        <button 
          onClick={handleRemove}
          className="w-10 h-10 flex items-center justify-center font-bold text-2xl hover:text-red-500 hover:scale-125 transition-all active:scale-90"
          aria-label="Remove"
        >
          -
        </button>
        <div className="relative min-w-[2rem] flex justify-center">
          <span className={`font-cartoon text-2xl text-center transition-all duration-300 ${animationType === 'add' ? 'scale-150 text-orange-500' : animationType === 'remove' ? 'scale-75 text-red-500' : 'scale-100 text-[#332111]'}`}>
            {quantity}
          </span>
        </div>
        <button 
          onClick={handleAdd}
          className="w-10 h-10 flex items-center justify-center font-bold text-2xl hover:text-green-500 hover:scale-125 transition-all active:scale-90"
          aria-label="Add"
        >
          +
        </button>
      </div>
    </div>
  );
};

export default FruitCard;
