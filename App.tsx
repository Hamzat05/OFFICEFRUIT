
import React, { useState, useMemo, useEffect } from 'react';
import { FRUITS } from './constants';
import { Frequency } from './types';
import FruitCard from './components/FruitCard';
import { getFruitRecommendation } from './services/geminiService';
import { supabase } from './services/supabaseClient';

declare global {
  interface Window {
    PaystackPop: any;
  }
}

const GURU_MESSAGES = [
  "Consulting the wise old vines...",
  "Squeezing out fresh ideas...",
  "Checking the ripeness of the web...",
  "Whispering to the pineapples...",
  "Stomping the grapes for wisdom...",
  "Balancing the vitamins...",
  "Peeling back the layers of productivity..."
];

const App: React.FC = () => {
  const [box, setBox] = useState<Record<string, number>>({});
  const [frequency, setFrequency] = useState<Frequency>(Frequency.WEEKLY);
  const [teamSize, setTeamSize] = useState<number>(10);
  const [mood, setMood] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [note, setNote] = useState<string>(''); // New state for the custom note
  const [deliveryDate, setDeliveryDate] = useState<string>(() => {
    const today = new Date();
    today.setDate(today.getDate() + 1);
    return today.toISOString().split('T')[0];
  });
  
  const [isGuruLoading, setIsGuruLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [guruMessage, setGuruMessage] = useState<string | null>(null);
  const [step, setStep] = useState<number>(1); 
  const [cartPopping, setCartPopping] = useState(false);

  // Loading message rotation
  useEffect(() => {
    let interval: any;
    if (isGuruLoading) {
      interval = setInterval(() => {
        setLoadingMsgIdx(prev => (prev + 1) % GURU_MESSAGES.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isGuruLoading]);

  const frequencyMultiplier = useMemo(() => {
    switch (frequency) {
      case Frequency.ONE_OFF: return 1;
      case Frequency.DAILY: return 20;
      case Frequency.WEEKLY: return 4;
      case Frequency.BI_WEEKLY: return 2;
      case Frequency.MONTHLY: return 1;
      case Frequency.BI_MONTHLY: return 1;
      default: return 1;
    }
  }, [frequency]);

  const totalFruits = useMemo(() => {
    // Explicitly cast to any[] then map/reduce to ensure TypeScript knows these are numbers
    return Object.values(box).reduce((acc: number, curr: any) => acc + (Number(curr) || 0), 0);
  }, [box]);

  useEffect(() => {
    if (totalFruits > 0) {
      setCartPopping(true);
      const timer = setTimeout(() => setCartPopping(false), 300);
      return () => clearTimeout(timer);
    }
  }, [totalFruits]);

  const boxPrice = useMemo(() => {
    // Fix: Explicitly type entries to handle environments where they are inferred as unknown
    return Object.entries(box).reduce((acc: number, [id, qty]: [string, any]) => {
      const fruit = FRUITS.find(f => f.id === id);
      return acc + (fruit?.price || 0) * (Number(qty) || 0);
    }, 0);
  }, [box]);

  const totalPrice = useMemo(() => {
    return boxPrice * frequencyMultiplier;
  }, [boxPrice, frequencyMultiplier]);

  const handleAdd = (id: string) => {
    setBox(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  const handleRemove = (id: string) => {
    setBox(prev => {
      const currentQty = prev[id] || 0;
      if (currentQty <= 0) return prev;
      const newQty = currentQty - 1;
      if (newQty <= 0) {
        const { [id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [id]: newQty };
    });
  };

  const askGuru = async () => {
    if (isGuruLoading) return;
    setIsGuruLoading(true);
    setGuruMessage(null);
    try {
      const result = await getFruitRecommendation(teamSize, mood || "Productive & Creative");
      if (result) {
        const newBox: Record<string, number> = {};
        result.recommendations.forEach((rec: any) => {
          const fruit = FRUITS.find(f => 
            f.name.toLowerCase().includes(rec.fruitName.toLowerCase()) ||
            rec.fruitName.toLowerCase().includes(f.name.toLowerCase())
          );
          if (fruit) {
            newBox[fruit.id] = rec.quantity;
          }
        });
        setBox(newBox);
        setGuruMessage(result.guruMessage);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGuruLoading(false);
    }
  };

  const saveOrderToSupabase = async (reference: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('orders')
        .insert([
          {
            company_name: companyName,
            email: email,
            delivery_address: deliveryAddress,
            delivery_date: deliveryDate,
            box_items: box,
            total_price: totalPrice,
            frequency: frequency,
            team_size: teamSize,
            paystack_reference: reference,
            status: 'paid',
            note: note, // Include the personalized note in the database record
            created_at: new Date().toISOString()
          }
        ]);
      if (error) console.error('Supabase Error:', error);
    } catch (err) {
      console.error('Failed to save to Supabase:', err);
    } finally {
      setIsSaving(false);
      setStep(3);
    }
  };

  const handlePlaceSubscription = () => {
    if (!email || !email.includes('@')) {
      alert('Please enter a valid work email! 📧');
      return;
    }
    if (!companyName.trim()) {
      alert('Please enter your company or office name! 🏢');
      return;
    }
    if (!deliveryAddress.trim()) {
      alert('Please enter a delivery address! 📍');
      return;
    }

    const handler = window.PaystackPop.setup({
      key: 'pk_live_83d783d7d55fc07e6b09430647aa64466ee5cf4a',
      email: email,
      amount: totalPrice * 100,
      currency: 'NGN',
      callback: (response: any) => saveOrderToSupabase(response.reference),
      onClose: () => alert('Transaction cancelled. Your team is still hungry for vitamins! 🍎')
    });
    handler.openIframe();
  };

  return (
    <div className="min-h-screen pb-32 relative selection:bg-orange-200">
      <header className="pt-16 pb-12 px-6 text-center overflow-hidden">
        <div className="absolute top-10 left-[5%] w-32 h-32 bg-yellow-200 rounded-full blur-3xl opacity-40 -z-10 animate-pulse"></div>
        <div className="absolute top-40 right-[10%] w-48 h-48 bg-orange-200 rounded-full blur-3xl opacity-40 -z-10"></div>
        <h1 className="font-cartoon text-6xl md:text-8xl text-[#332111] mb-4 tracking-tight drop-shadow-lg cursor-pointer transition-transform hover:scale-105 active:scale-95" onClick={() => setStep(1)}>
          Office<span className="text-orange-500">Fruits</span>
        </h1>
        <p className="text-[#5c4a38] text-xl font-bold tracking-tight">Vitamins delivered straight to your workstation. 🍏</p>
      </header>

      <main className="max-w-6xl mx-auto px-6 relative z-10">
        {step === 1 ? (
          <div className="space-y-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <section className="bg-orange-50 p-8 md:p-12 rounded-[50px] cartoon-border relative overflow-hidden group">
              {/* Playful Guru Loading Overlay */}
              {isGuruLoading && (
                <div className="absolute inset-0 z-50 bg-orange-50/95 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300">
                  <div className="relative w-40 h-40 mb-8 flex items-center justify-center">
                    <div className="text-8xl animate-bounce-fruit">🧙‍♂️</div>
                    <div className="absolute inset-0 animate-spin-slow pointer-events-none">
                      <span className="absolute top-0 left-1/2 -translate-x-1/2 text-4xl animate-orbit" style={{ animationDelay: '0s' }}>🍎</span>
                      <span className="absolute top-0 left-1/2 -translate-x-1/2 text-4xl animate-orbit" style={{ animationDelay: '-1.3s' }}>🍌</span>
                      <span className="absolute top-0 left-1/2 -translate-x-1/2 text-4xl animate-orbit" style={{ animationDelay: '-2.6s' }}>🍍</span>
                    </div>
                  </div>
                  <h3 className="font-cartoon text-2xl text-orange-600 mb-2 animate-pulse">
                    {GURU_MESSAGES[loadingMsgIdx]}
                  </h3>
                  <p className="text-orange-800/60 font-bold uppercase tracking-widest text-xs">Awaiting the fruity prophecy...</p>
                </div>
              )}

              <div className="max-w-3xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="font-cartoon text-4xl text-[#332111] flex items-center gap-3">
                    Fruit Guru <span className="animate-float">✨</span>
                  </h2>
                  <div className="hidden md:block bg-white px-4 py-1 rounded-full border-2 border-[#332111] text-xs font-black uppercase tracking-tighter">AI Powered Recommendation</div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div className="space-y-2">
                    <label className="block text-sm font-black text-[#332111] uppercase tracking-wider ml-1">Team Size</label>
                    <input 
                      type="number" 
                      min="1"
                      value={teamSize} 
                      onChange={(e) => setTeamSize(Math.max(1, Number(e.target.value)))} 
                      className="w-full font-cartoon text-xl" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-black text-[#332111] uppercase tracking-wider ml-1">Office Mood</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Brainstorming, High Energy, Chilly" 
                      value={mood} 
                      onChange={(e) => setMood(e.target.value)} 
                      className="w-full font-bold placeholder:text-gray-300" 
                    />
                  </div>
                </div>
                
                <button 
                  onClick={askGuru} 
                  disabled={isGuruLoading} 
                  className="w-full md:w-auto cartoon-button bg-yellow-400 hover:bg-yellow-300 px-12 py-5 rounded-2xl font-cartoon text-2xl text-[#332111] disabled:opacity-50 relative group/btn overflow-hidden"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Ask the Guru! 🪄
                  </span>
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform"></div>
                </button>

                {guruMessage && !isGuruLoading && (
                  <div className="mt-10 p-8 bg-white rounded-[32px] border-4 border-orange-200 relative animate-in zoom-in-95 duration-500">
                    <div className="absolute -top-4 left-10 bg-[#332111] text-white px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest">
                      Prophecy
                    </div>
                    <p className="text-2xl text-orange-900 font-bold italic leading-tight">
                      "{guruMessage}"
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {/* Fix: Explicitly type entries and use a safe comparison to resolve 'unknown' operator error on line 278 */}
                      {Object.entries(box).map(([id, qty]: [string, any]) => {
                        const f = FRUITS.find(fruit => fruit.id === id);
                        return (qty as number) > 0 ? (
                          <span key={id} className="bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-xs font-bold border border-orange-200">
                            {f?.emoji} {f?.name} x{qty}
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="space-y-10">
              <div className="flex flex-col md:flex-row justify-between items-center md:items-end gap-4">
                <div className="text-center md:text-left">
                  <h2 className="font-cartoon text-5xl text-[#332111] mb-2">The Orchard</h2>
                  <p className="text-gray-500 font-bold">Pick your favorites or let the Guru decide. 🌿</p>
                </div>
                <div className="flex bg-white p-2 rounded-2xl border-2 border-[#332111] text-xs font-black uppercase overflow-hidden">
                  <div className="px-4 py-2 bg-green-100 text-green-700 rounded-xl">Freshly Sourced</div>
                  <div className="px-4 py-2">Premium Grade</div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
                {FRUITS.map(fruit => (
                  <FruitCard 
                    key={fruit.id} 
                    fruit={fruit} 
                    quantity={box[fruit.id] || 0} 
                    onAdd={handleAdd} 
                    onRemove={handleRemove} 
                  />
                ))}
              </div>
            </section>
          </div>
        ) : step === 2 ? (
          <div className="bg-white p-8 md:p-16 rounded-[60px] cartoon-border max-w-3xl mx-auto animate-in zoom-in-95 duration-500 relative">
            {isSaving && (
              <div className="absolute inset-0 bg-white/90 z-50 flex flex-col items-center justify-center rounded-[60px]">
                <div className="w-20 h-20 border-8 border-orange-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                <p className="font-cartoon text-3xl text-[#332111]">Securing the harvest...</p>
              </div>
            )}
            
            <div className="text-center mb-12">
              <h2 className="font-cartoon text-5xl text-[#332111] mb-2">Final Step! 🍏</h2>
              <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">Let's get this box to your team</p>
            </div>

            <div className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <label className="block text-sm font-black text-[#332111] uppercase tracking-wider ml-1">Office Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Creative Hub" 
                    value={companyName} 
                    onChange={(e) => setCompanyName(e.target.value)} 
                    className="w-full font-bold" 
                    required 
                  />
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-black text-[#332111] uppercase tracking-wider ml-1">Work Email</label>
                  <input 
                    type="email" 
                    placeholder="hi@office.com" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    className="w-full font-bold" 
                    required 
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-black text-[#332111] uppercase tracking-wider ml-1">Delivery HQ</label>
                <textarea 
                  placeholder="Street, Building, Floor..." 
                  value={deliveryAddress} 
                  onChange={(e) => setDeliveryAddress(e.target.value)} 
                  className="w-full font-bold min-h-[120px] resize-none" 
                  required 
                />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-black text-[#332111] uppercase tracking-wider ml-1">Handwritten Note (Optional) 📝</label>
                <textarea 
                  placeholder="A message for the team or delivery instructions... ✍️" 
                  value={note} 
                  onChange={(e) => setNote(e.target.value)} 
                  className="w-full font-bold min-h-[100px] resize-none text-orange-800" 
                />
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-black text-[#332111] uppercase tracking-wider ml-1">First Drop Date</label>
                <input 
                  type="date" 
                  value={deliveryDate} 
                  min={new Date().toISOString().split('T')[0]} 
                  onChange={(e) => setDeliveryDate(e.target.value)} 
                  className="w-full font-bold" 
                  required 
                />
              </div>

              <div className="p-8 bg-gray-50 rounded-[40px] border-4 border-[#332111] border-dashed">
                <h3 className="font-cartoon text-2xl mb-6 border-b-4 border-gray-200 pb-2 flex justify-between items-center">
                  <span>🧺 Box Content</span>
                  <span className="text-lg text-orange-500">₦{boxPrice.toLocaleString()}</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 max-h-60 overflow-y-auto pr-4 custom-scrollbar">
                  {/* Fix: Explicitly type entries to handle environments where they are inferred as unknown */}
                  {Object.entries(box).map(([id, qty]: [string, any]) => {
                    const fruit = FRUITS.find(f => f.id === id);
                    return (
                      <div key={id} className="flex justify-between items-center text-sm bg-white p-3 rounded-2xl border-2 border-gray-100">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{fruit?.emoji}</span>
                          <span className="font-black text-[#332111]">{fruit?.name}</span>
                        </div>
                        <span className="font-cartoon text-orange-600 bg-orange-50 px-4 py-1 rounded-full border border-orange-200">x{qty}</span>
                      </div>
                    );
                  })}
                </div>
                {note && (
                  <div className="mt-6 pt-4 border-t-2 border-gray-100">
                    <p className="text-[10px] uppercase font-black text-gray-400 mb-1">Your Note:</p>
                    <p className="text-xs italic text-gray-600 font-bold">"{note}"</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-black text-[#332111] uppercase tracking-wider text-center">Delivery Frequency</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {Object.values(Frequency).map(f => (
                    <button 
                      key={f} 
                      onClick={() => setFrequency(f)} 
                      className={`py-4 rounded-2xl border-4 font-cartoon text-sm transition-all shadow-[4px_4px_0px_#332111] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${
                        frequency === f 
                        ? 'bg-[#332111] text-white border-[#332111]' 
                        : 'bg-white text-[#332111] border-[#332111] hover:bg-orange-50'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-orange-100 p-10 rounded-[40px] border-4 border-[#332111] flex flex-col md:flex-row justify-between items-center gap-6 shadow-[8px_8px_0px_#332111]">
                <div className="text-center md:text-left">
                  <p className="text-xs uppercase font-black text-orange-800 tracking-widest mb-1">Total Upfront Amount</p>
                  <p className="font-cartoon text-6xl text-[#332111]">₦{totalPrice.toLocaleString()}</p>
                </div>
                <div className="text-center md:text-right bg-white/40 px-6 py-4 rounded-3xl border-2 border-[#332111]/10">
                  <p className="text-xs uppercase font-black text-gray-600 tracking-widest mb-1">Coverage</p>
                  <p className="text-xl font-cartoon text-[#332111]">{frequencyMultiplier} {frequencyMultiplier === 1 ? 'Delivery' : 'Deliveries'}</p>
                  <p className="text-[10px] font-black uppercase text-gray-400 mt-1">{frequency} Schedule</p>
                </div>
              </div>

              <button 
                className="w-full bg-green-500 hover:bg-green-400 text-white font-cartoon text-3xl py-8 rounded-[35px] cartoon-button shadow-xl flex items-center justify-center gap-4 group/pay" 
                onClick={handlePlaceSubscription} 
                disabled={isSaving}
              >
                <span>Pay Now</span>
                <span className="group-hover/pay:translate-x-2 transition-transform">🚀</span>
              </button>
              
              <button 
                className="w-full text-gray-400 font-black uppercase tracking-widest text-xs hover:text-[#332111] transition-colors" 
                onClick={() => setStep(1)}
              >
                ← Edit your fruit box
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white p-16 md:p-24 rounded-[70px] cartoon-border max-w-2xl mx-auto text-center animate-in zoom-in-95 duration-700 shadow-2xl">
             <div className="text-9xl mb-8 animate-bounce-fruit inline-block">🎉</div>
             <h2 className="font-cartoon text-6xl mb-6 text-[#332111]">You're All Set!</h2>
             <div className="space-y-6 text-xl text-gray-600 font-bold mb-12">
               <p>The harvest is ready! 🧺</p>
               <div className="bg-orange-50 p-6 rounded-3xl border-2 border-orange-100 text-orange-800 italic">
                 <p className="mb-2">"Welcome to the OfficeFruits family, <b>{companyName}</b>! We've locked in your upfront payment for <b>{frequencyMultiplier}</b> {frequency.toLowerCase()} deliveries."</p>
                 {note && <p className="text-sm mt-4 text-orange-600/80 border-t border-orange-200 pt-4">Your Note: "{note}"</p>}
               </div>
               <p className="text-sm">Receipt sent to: <b>{email}</b></p>
             </div>
             <button 
                className="cartoon-button bg-orange-500 hover:bg-orange-400 text-white font-cartoon text-2xl px-16 py-6 rounded-[30px] transition-transform hover:scale-105" 
                onClick={() => { setStep(1); setBox({}); setNote(''); }}
              >
                Build More Joy! 🧺
              </button>
          </div>
        )}
      </main>

      {step === 1 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-xl z-50">
          <div className="bg-white/95 backdrop-blur-sm cartoon-border p-5 flex items-center justify-between rounded-[35px] shadow-[0_20px_50px_rgba(0,0,0,0.2)]">
            <div className="flex items-center gap-5">
              <div className={`w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center text-3xl transition-all duration-300 ${cartPopping ? 'animate-pop scale-125 bg-orange-200' : 'animate-bounce-subtle'}`}>
                📦
              </div>
              <div>
                <p className="font-cartoon text-2xl leading-none text-[#332111]">₦{boxPrice.toLocaleString()}</p>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-1">{totalFruits} items in box</p>
              </div>
            </div>
            <button 
              onClick={() => setStep(2)} 
              disabled={totalFruits === 0} 
              className="bg-[#332111] text-white font-cartoon px-10 py-4 rounded-2xl cartoon-button disabled:opacity-50 disabled:grayscale transition-all hover:bg-orange-600"
            >
              Order Now
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Floating Background Elements */}
      <div className="fixed -z-20 inset-0 pointer-events-none overflow-hidden select-none opacity-20">
        <div className="absolute top-[5%] left-[5%] text-7xl animate-float" style={{animationDuration: '6s'}}>🍍</div>
        <div className="absolute top-[20%] right-[10%] text-6xl animate-float" style={{animationDuration: '8s', animationDelay: '1s'}}>🍎</div>
        <div className="absolute top-[45%] left-[15%] text-5xl animate-float" style={{animationDuration: '7s', animationDelay: '2s'}}>🍌</div>
        <div className="absolute bottom-[15%] left-[8%] text-8xl animate-float" style={{animationDuration: '9s', animationDelay: '0.5s'}}>🍉</div>
        <div className="absolute bottom-[25%] right-[12%] text-6xl animate-float" style={{animationDuration: '5s', animationDelay: '1.5s'}}>🍐</div>
        <div className="absolute top-[60%] right-[20%] text-5xl animate-float" style={{animationDuration: '10s', animationDelay: '3s'}}>🥭</div>
      </div>
    </div>
  );
};

export default App;
