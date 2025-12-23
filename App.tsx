
import React, { useState, useMemo, useEffect } from 'react';
import { FRUITS } from './constants';
import { Frequency, BoxItem } from './types';
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
  "Balancing the vitamins..."
];

const App: React.FC = () => {
  const [box, setBox] = useState<Record<string, number>>({});
  const [frequency, setFrequency] = useState<Frequency>(Frequency.WEEKLY);
  const [teamSize, setTeamSize] = useState<number>(10);
  const [mood, setMood] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [deliveryDate, setDeliveryDate] = useState<string>(() => {
    const today = new Date();
    today.setDate(today.getDate() + 1); // Default to tomorrow
    return today.toISOString().split('T')[0];
  });
  const [isGuruLoading, setIsGuruLoading] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [guruMessage, setGuruMessage] = useState<string | null>(null);
  const [step, setStep] = useState<number>(1); // 1: Builder, 2: Checkout, 3: Success
  const [cartPopping, setCartPopping] = useState(false);

  // Cycle loading messages
  useEffect(() => {
    let interval: any;
    if (isGuruLoading) {
      interval = setInterval(() => {
        setLoadingMsgIdx(prev => (prev + 1) % GURU_MESSAGES.length);
      }, 2000);
    } else {
      setLoadingMsgIdx(0);
    }
    return () => clearInterval(interval);
  }, [isGuruLoading]);

  // Delivery multipliers for total upfront payment calculation
  const frequencyMultiplier = useMemo(() => {
    switch (frequency) {
      case Frequency.ONE_OFF: return 1;
      case Frequency.DAILY: return 20; // 20 working days
      case Frequency.WEEKLY: return 4;  // 4 weeks
      case Frequency.BI_WEEKLY: return 2; // Every 2 weeks
      case Frequency.MONTHLY: return 1;
      case Frequency.BI_MONTHLY: return 1; // 1 delivery every 2 months
      default: return 1;
    }
  }, [frequency]);

  const totalFruits = useMemo(() => {
    return Object.values(box).reduce((acc: number, curr: number) => acc + curr, 0);
  }, [box]);

  // Trigger pop animation on footer cart when item count changes
  useEffect(() => {
    if (totalFruits >= 0) {
      setCartPopping(true);
      const timer = setTimeout(() => setCartPopping(false), 300);
      return () => clearTimeout(timer);
    }
  }, [totalFruits]);

  const boxPrice = useMemo(() => {
    return Object.entries(box).reduce((acc: number, [id, qty]: [string, number]) => {
      const fruit = FRUITS.find(f => f.id === id);
      return acc + (fruit?.price || 0) * qty;
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
    setIsGuruLoading(true);
    setGuruMessage(null);
    const result = await getFruitRecommendation(teamSize, mood || "Productive & Creative");
    if (result) {
      const newBox: Record<string, number> = {};
      result.recommendations.forEach((rec: any) => {
        const fruit = FRUITS.find(f => f.name.toLowerCase().includes(rec.fruitName.toLowerCase()));
        if (fruit) {
          newBox[fruit.id] = rec.quantity;
        }
      });
      setBox(newBox);
      setGuruMessage(result.guruMessage);
    }
    setIsGuruLoading(false);
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
            created_at: new Date().toISOString()
          }
        ]);

      if (error) {
        console.error('Supabase Error:', error);
      }
    } catch (err) {
      console.error('Failed to save to Supabase:', err);
    } finally {
      setIsSaving(false);
      setStep(3);
      setBox({});
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
    if (!deliveryDate) {
      alert('Please pick a delivery date! 🗓️');
      return;
    }

    const handler = window.PaystackPop.setup({
      key: 'pk_live_83d783d7d55fc07e6b09430647aa64466ee5cf4a',
      email: email,
      amount: totalPrice * 100, // Paystack amount is in kobo
      currency: 'NGN',
      metadata: {
        custom_fields: [
          { display_name: "Company Name", variable_name: "company_name", value: companyName },
          { display_name: "Delivery Address", variable_name: "delivery_address", value: deliveryAddress },
          { display_name: "Preferred Delivery Date", variable_name: "delivery_date", value: deliveryDate },
          { display_name: "Office Mood", variable_name: "office_mood", value: mood },
          { display_name: "Team Size", variable_name: "team_size", value: teamSize },
          { display_name: "Order Type", variable_name: "order_type", value: frequency === Frequency.ONE_OFF ? "One-Off Purchase" : "Subscription" },
          { display_name: "Frequency", variable_name: "frequency", value: frequency },
          { display_name: "Deliveries Paid", variable_name: "deliveries_paid", value: frequencyMultiplier }
        ]
      },
      callback: function(response: any) {
        saveOrderToSupabase(response.reference);
      },
      onClose: function() {
        alert('Transaction cancelled. Your team is still hungry for vitamins! 🍎');
      }
    });

    handler.openIframe();
  };

  return (
    <div className="min-h-screen pb-32 relative">
      <header className="pt-12 pb-8 px-6 text-center overflow-hidden">
        <div className="absolute top-4 left-4 w-24 h-24 bg-yellow-200 rounded-full blur-3xl opacity-50 -z-10 animate-pulse"></div>
        <div className="absolute top-20 right-10 w-32 h-32 bg-red-200 rounded-full blur-3xl opacity-50 -z-10"></div>
        
        <h1 className="font-cartoon text-5xl md:text-7xl text-[#332111] mb-2 tracking-tight drop-shadow-sm cursor-pointer" onClick={() => setStep(1)}>
          Office<span className="text-orange-500">Fruits</span>
        </h1>
        <p className="text-[#5c4a38] text-lg font-medium">Delightfully fresh boxes for your dream team in Nigeria.</p>
      </header>

      <main className="max-w-6xl mx-auto px-6 relative z-10">
        {step === 1 ? (
          <div className="space-y-12">
            <section className="bg-orange-50 p-8 rounded-[40px] cartoon-border relative overflow-hidden group">
              {/* Playful Guru Loading Overlay */}
              {isGuruLoading && (
                <div className="absolute inset-0 z-40 bg-orange-50/90 flex flex-col items-center justify-center animate-in fade-in duration-300">
                  <div className="relative w-24 h-24 mb-6">
                    <div className="absolute inset-0 text-5xl flex items-center justify-center animate-bounce">🧙‍♂️</div>
                    <div className="absolute inset-0 animate-spin-slow">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 text-3xl animate-orbit" style={{ animationDelay: '0s' }}>🍎</div>
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 text-3xl animate-orbit" style={{ animationDelay: '-1s' }}>🍌</div>
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 text-3xl animate-orbit" style={{ animationDelay: '-2s' }}>🍍</div>
                    </div>
                  </div>
                  <p className="font-cartoon text-xl text-orange-800 animate-pulse text-center px-4">
                    {GURU_MESSAGES[loadingMsgIdx]}
                  </p>
                </div>
              )}

              <div className="absolute -right-8 -bottom-8 opacity-10 pointer-events-none transform rotate-12 transition-transform group-hover:rotate-45">
                <span className="text-9xl">🥭</span>
              </div>
              
              <div className="max-w-2xl">
                <h2 className="font-cartoon text-3xl mb-4 text-[#332111] flex items-center gap-2">
                  Fruit Guru Suggestion <span className="animate-float">✨</span>
                </h2>
                <div className="flex flex-col md:flex-row gap-4 mb-4">
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Team Size</label>
                    <input 
                      type="number" 
                      value={teamSize} 
                      onChange={(e) => setTeamSize(Number(e.target.value))}
                      className="w-full p-4 rounded-2xl border-2 border-[#332111] font-cartoon focus:outline-none focus:ring-2 focus:ring-orange-200"
                    />
                  </div>
                  <div className="flex-[2]">
                    <label className="block text-sm font-bold text-gray-700 mb-1 ml-1">Office Mood</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Brainstorming session, Friday fun..." 
                      value={mood}
                      onChange={(e) => setMood(e.target.value)}
                      className="w-full p-4 rounded-2xl border-2 border-[#332111] focus:outline-none focus:ring-2 focus:ring-orange-200"
                    />
                  </div>
                </div>
                <button 
                  onClick={askGuru}
                  disabled={isGuruLoading}
                  className="cartoon-button bg-yellow-400 px-8 py-4 rounded-2xl font-cartoon text-lg text-[#332111] disabled:opacity-50 relative overflow-hidden group/btn"
                >
                  <span className="relative z-10">{isGuruLoading ? 'Guru is Thinking...' : 'Ask the Guru! ✨'}</span>
                  <div className="absolute inset-0 bg-yellow-300 translate-y-full group-hover/btn:translate-y-0 transition-transform"></div>
                </button>
                
                {guruMessage && (
                  <div className="mt-6 p-4 bg-white rounded-2xl border-2 border-orange-200 italic text-orange-800 animate-in fade-in slide-in-from-top-2 duration-500 relative">
                    <div className="absolute -top-3 left-6 bg-white px-2 text-[10px] font-black uppercase text-orange-400 tracking-tighter">Guru says:</div>
                    "{guruMessage}"
                  </div>
                )}
              </div>
            </section>

            <section>
              <div className="flex justify-between items-end mb-8">
                <h2 className="font-cartoon text-4xl text-[#332111]">Pick Your Fruits</h2>
                <p className="text-sm font-bold text-gray-500">Available Fresh Today 🌿</p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
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
          /* ... Rest of step 2 and step 3 remains same ... */
          <div className="bg-white p-8 md:p-12 rounded-[40px] cartoon-border max-w-2xl mx-auto animate-in zoom-in-95 duration-300 relative">
            {isSaving && (
              <div className="absolute inset-0 bg-white/80 z-50 flex flex-col items-center justify-center rounded-[40px]">
                <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="font-cartoon text-xl text-[#332111]">Securing your vitamins...</p>
              </div>
            )}
            
            <h2 className="font-cartoon text-4xl mb-8 text-center text-[#332111]">Checkout Details</h2>
            
            <div className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block font-cartoon text-lg text-[#332111] flex items-center gap-2">
                    Company Name
                  </label>
                  <div className="relative group">
                    <input 
                      type="text" 
                      placeholder="e.g. Acme Inc" 
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full p-4 pl-14 rounded-2xl border-2 border-[#332111] font-medium focus:outline-none focus:ring-2 focus:ring-orange-200 transition-all shadow-sm"
                      required
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center border border-[#332111] group-focus-within:bg-blue-200 transition-colors">
                      <span className="text-lg">🏢</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block font-cartoon text-lg text-[#332111] flex items-center gap-2">
                    Work Email
                  </label>
                  <div className="relative group">
                    <input 
                      type="email" 
                      placeholder="yourname@office.com" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full p-4 pl-14 rounded-2xl border-2 border-[#332111] font-medium focus:outline-none focus:ring-2 focus:ring-orange-200 transition-all shadow-sm"
                      required
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center border border-[#332111] group-focus-within:bg-purple-200 transition-colors">
                      <span className="text-lg">📧</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block font-cartoon text-lg text-[#332111] flex items-center gap-2">
                  Delivery Address
                </label>
                <div className="relative group">
                  <textarea 
                    placeholder="Street address, floor, office number..." 
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full p-4 pl-14 rounded-2xl border-2 border-[#332111] font-medium focus:outline-none focus:ring-2 focus:ring-orange-200 min-h-[100px] transition-all shadow-sm"
                    required
                  />
                  <div className="absolute left-3 top-4 w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center border border-[#332111] group-focus-within:bg-green-200 transition-colors">
                    <span className="text-lg">📍</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block font-cartoon text-lg text-[#332111] flex items-center gap-2">
                  Preferred First Delivery Date
                </label>
                <div className="relative group">
                  <input 
                    type="date" 
                    value={deliveryDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="w-full p-4 pl-14 rounded-2xl border-2 border-[#332111] font-medium focus:outline-none focus:ring-2 focus:ring-orange-200 transition-all shadow-sm"
                    required
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center border border-[#332111] group-focus-within:bg-yellow-200 transition-colors">
                    <span className="text-lg">🗓️</span>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-gray-50 rounded-3xl border-2 border-[#332111] border-dashed">
                <h3 className="font-cartoon text-xl mb-4 border-b-2 border-gray-200 pb-2 flex justify-between items-center">
                  <span className="flex items-center gap-2">🧺 Your Fruit Box</span>
                  <span className="text-sm font-sans text-gray-400 font-bold">₦{boxPrice.toLocaleString()} / delivery</span>
                </h3>
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {Object.entries(box).map(([id, qty]) => {
                    const fruit = FRUITS.find(f => f.id === id);
                    return (
                      <div key={id} className="flex justify-between items-center text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{fruit?.emoji}</span>
                          <span className="font-bold text-[#332111]">{fruit?.name}</span>
                        </div>
                        <span className="font-cartoon text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-200">x{qty}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-cartoon text-xl mb-3 text-[#332111]">Order Schedule</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.values(Frequency).map(f => (
                    <button
                      key={f}
                      onClick={() => setFrequency(f)}
                      className={`p-3 rounded-xl border-2 font-bold text-sm transition-all ${
                        frequency === f 
                          ? 'bg-[#332111] text-white border-[#332111] scale-105 shadow-md' 
                          : 'bg-white text-[#332111] border-[#332111] hover:bg-orange-50'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-orange-600 mt-2 font-bold uppercase tracking-tighter text-center">
                  {frequency === Frequency.ONE_OFF 
                    ? '✨ Just this once, no commitment' 
                    : `✨ We'll pre-bill you for ${frequencyMultiplier} juicy deliveries`}
                </p>
              </div>

              <div className="bg-orange-100 p-6 rounded-3xl border-2 border-[#332111] flex justify-between items-center shadow-inner relative overflow-hidden">
                <div className="absolute right-[-10px] bottom-[-10px] text-6xl opacity-10 rotate-12 pointer-events-none">💰</div>
                <div className="relative z-10">
                  <p className="text-xs uppercase font-black text-orange-800 tracking-widest">
                    {frequency === Frequency.ONE_OFF ? 'Amount Due' : 'Upfront Payment'}
                  </p>
                  <p className="font-cartoon text-4xl text-[#332111]">₦{totalPrice.toLocaleString()}</p>
                </div>
                <div className="text-right relative z-10">
                  <p className="text-xs uppercase font-black text-gray-500 tracking-widest">{frequencyMultiplier} Delivery</p>
                  <p className="text-sm font-bold text-gray-700">{frequency === Frequency.ONE_OFF ? 'Single' : `${frequency}`}</p>
                </div>
              </div>

              <button 
                className="w-full bg-green-500 hover:bg-green-600 text-white font-cartoon text-2xl py-6 rounded-3xl cartoon-button transition-colors flex flex-col items-center justify-center gap-1 shadow-lg group"
                onClick={handlePlaceSubscription}
                disabled={isSaving}
              >
                <div className="flex items-center gap-2 group-hover:scale-110 transition-transform">
                  <span>Pay with Paystack</span>
                  <span>🚀</span>
                </div>
                <span className="text-xs opacity-80 uppercase tracking-widest font-sans font-bold">
                  {frequency === Frequency.ONE_OFF ? 'Safe & Secure Checkout' : 'Secure Pre-payment'}
                </span>
              </button>
              
              <button 
                className="w-full text-[#332111] font-bold text-sm hover:underline hover:text-orange-600 transition-colors"
                onClick={() => setStep(1)}
              >
                ← Back to customizer
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white p-12 rounded-[40px] cartoon-border max-w-xl mx-auto text-center animate-in zoom-in-95 duration-500">
             <div className="text-8xl mb-6 animate-bounce">🎊</div>
             <h2 className="font-cartoon text-4xl mb-4 text-[#332111]">Order Confirmed!</h2>
             <p className="text-lg text-gray-600 mb-8 leading-relaxed">
               {frequency === Frequency.ONE_OFF ? (
                 <>Success! <b>{companyName}</b>, your one-off fruit box is on its way!</>
               ) : (
                 <>Success! <b>{companyName}</b> is officially subscribed! We've received your upfront payment for <b>{frequencyMultiplier}</b> deliveries.</>
               )}
               <br/><br/>
               First delivery scheduled for: <span className="font-bold text-green-600">{new Date(deliveryDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
               <br/><br/>
               Delivery will be sent to: <br/>
               <span className="italic text-orange-600">"{deliveryAddress}"</span>
               <br/><br/>
               Records saved! Check <b>{email}</b> for receipt.
             </p>
             <button 
                className="cartoon-button bg-orange-500 text-white font-cartoon text-xl px-12 py-4 rounded-3xl"
                onClick={() => {
                  setStep(1);
                  setCompanyName('');
                  setDeliveryAddress('');
                  setBox({});
                  setFrequency(Frequency.WEEKLY);
                }}
              >
                Build Another Box! 🧺
              </button>
          </div>
        )}
      </main>

      {step === 1 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] max-w-lg z-50">
          <div className="bg-white cartoon-border p-4 flex items-center justify-between rounded-3xl shadow-2xl">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-2xl transition-all duration-300 ${cartPopping ? 'animate-pop' : 'animate-bounce-subtle'}`}>
                📦
              </div>
              <div>
                <p className="font-cartoon text-lg leading-none">₦{boxPrice.toLocaleString()}</p>
                <p className="text-xs font-bold text-gray-500">{totalFruits} items per delivery</p>
              </div>
            </div>
            <button 
              onClick={() => setStep(2)}
              disabled={totalFruits === 0}
              className="bg-orange-500 text-white font-cartoon px-8 py-3 rounded-2xl cartoon-button disabled:opacity-50"
            >
              Checkout
            </button>
          </div>
        </div>
      )}

      <div className="fixed -z-20 inset-0 pointer-events-none overflow-hidden select-none">
        <div className="absolute top-10 left-[10%] text-6xl opacity-[0.05] animate-float">🍍</div>
        <div className="absolute top-24 right-[15%] text-4xl opacity-[0.07] animate-float" style={{animationDelay: '0.5s'}}>🍎</div>
        <div className="absolute top-60 left-[25%] text-5xl opacity-[0.04] animate-float" style={{animationDelay: '1.2s'}}>🍌</div>
        <div className="absolute bottom-20 left-[12%] text-7xl opacity-[0.05] animate-float" style={{animationDelay: '1.8s'}}>🍉</div>
        <div className="absolute bottom-40 right-[8%] text-6xl opacity-[0.07] animate-float" style={{animationDelay: '1s'}}>🍐</div>
      </div>
    </div>
  );
};

export default App;
