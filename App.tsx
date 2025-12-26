
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

type GiftingOccasion = 'General' | 'Ramadan' | 'New Hire' | 'Anniversary' | 'Client Appreciation';

const OCCASIONS: Record<GiftingOccasion, { emoji: string; color: string; bg: string; items: Record<string, number> }> = {
  'General': { emoji: '🎁', color: 'text-amber-600', bg: 'bg-amber-50', items: { mango: 2, pineapple: 1, apple: 4 } },
  'Ramadan': { emoji: '🌙', color: 'text-amber-700', bg: 'bg-amber-100', items: { dates: 5, nuts: 3, orange: 6 } },
  'New Hire': { emoji: '🚀', color: 'text-teal-600', bg: 'bg-teal-50', items: { banana: 5, blueberry: 1, apple: 4, avocado: 2 } },
  'Anniversary': { emoji: '🎂', color: 'text-rose-600', bg: 'bg-rose-50', items: { strawberry: 2, grape: 1, mango: 2 } },
  'Client Appreciation': { emoji: '🤝', color: 'text-blue-600', bg: 'bg-blue-50', items: { pineapple: 1, dates: 2, nuts: 2, orange: 4 } }
};

const GURU_MESSAGES = [
  "Consulting the wise old vines...",
  "Squeezing out fresh ideas...",
  "Checking the ripeness of the web...",
  "Whispering to the pineapples...",
  "Stomping the grapes for wisdom...",
];

const App: React.FC = () => {
  const [viewMode, setViewMode] = useState<'subscription' | 'gifting'>('subscription');
  const [occasion, setOccasion] = useState<GiftingOccasion>('General');
  const [box, setBox] = useState<Record<string, number>>({});
  const [frequency, setFrequency] = useState<Frequency>(Frequency.WEEKLY);
  const [teamSize, setTeamSize] = useState<number>(10);
  const [mood, setMood] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [note, setNote] = useState<string>('');
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
  const [isBulkGift, setIsBulkGift] = useState(false);
  const [includeBranding, setIncludeBranding] = useState(false);

  useEffect(() => {
    let interval: any;
    if (isGuruLoading) {
      interval = setInterval(() => {
        setLoadingMsgIdx(prev => (prev + 1) % GURU_MESSAGES.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [isGuruLoading]);

  const totalFruits = useMemo(() => {
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
    return Object.entries(box).reduce((acc: number, [id, qty]: [string, any]) => {
      const fruit = FRUITS.find(f => f.id === id);
      return acc + (fruit?.price || 0) * (Number(qty) || 0);
    }, 0);
  }, [box]);

  const frequencyMultiplier = useMemo(() => {
    if (viewMode === 'gifting') return 1;
    switch (frequency) {
      case Frequency.ONE_OFF: return 1;
      case Frequency.DAILY: return 20;
      case Frequency.WEEKLY: return 4;
      case Frequency.BI_WEEKLY: return 2;
      case Frequency.MONTHLY: return 1;
      case Frequency.BI_MONTHLY: return 1;
      default: return 1;
    }
  }, [frequency, viewMode]);

  const totalPrice = useMemo(() => {
    return (boxPrice * frequencyMultiplier) + (includeBranding ? 5000 : 0);
  }, [boxPrice, frequencyMultiplier, includeBranding]);

  const handleAdd = (id: string) => setBox(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  const handleRemove = (id: string) => setBox(prev => {
    const currentQty = prev[id] || 0;
    if (currentQty <= 1) {
      const { [id]: _, ...rest } = prev;
      return rest;
    }
    return { ...prev, [id]: currentQty - 1 };
  });

  const askGuru = async () => {
    if (isGuruLoading) return;
    setIsGuruLoading(true);
    setGuruMessage(null);
    try {
      const guruMood = viewMode === 'gifting' ? `${occasion} Gifting for ${teamSize} people` : mood || "Productive & Creative";
      const result = await getFruitRecommendation(teamSize, guruMood);
      if (result) {
        const newBox: Record<string, number> = {};
        result.recommendations.forEach((rec: any) => {
          const fruit = FRUITS.find(f => f.name.toLowerCase().includes(rec.fruitName.toLowerCase()));
          if (fruit) newBox[fruit.id] = rec.quantity;
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

  const loadOccasionPreset = (occ: GiftingOccasion) => {
    setOccasion(occ);
    setBox(OCCASIONS[occ].items);
    setGuruMessage(`The ${occ} set is curated to bring the perfect energy and joy for this specific milestone! ✨`);
  };

const handlePlaceOrder = async () => {
  if (!email || !email.includes('@')) {
    alert('Please enter a valid work email');
    return;
  }

  if (!companyName.trim() || !deliveryAddress.trim()) {
    alert('Company name and delivery address are required');
    return;
  }

  if (Object.keys(box).length === 0) {
    alert('Please add fruits to your box');
    return;
  }

  try {
    setIsSaving(true);

    // 1️⃣ SAVE ORDER TO SUPABASE
    const { data, error } = await supabase
      .from('orders')
      .insert([
        {
          company_name: companyName,
          email,
          delivery_address: deliveryAddress,
          delivery_date: deliveryDate,
          box_items: box,
          total_price: totalPrice,
          frequency,
          team_size: teamSize,
          note,
          order_type: viewMode,
          is_bulk: isBulkGift,
          has_branding: includeBranding,
          status: 'pending_whatsapp'
        }
      ])
      .select()
      .single();

    if (error) throw error;

    // 2️⃣ BUILD WHATSAPP MESSAGE
    const fruitSummary = Object.entries(box)
      .map(([id, qty]) => {
        const fruit = FRUITS.find(f => f.id === id);
        return `• ${fruit?.emoji} ${fruit?.name} × ${qty}`;
      })
      .join('\n');

    const message = `
OFFICEFRUITS ORDER 🍎

Company: ${companyName}
Email: ${email}
Team Size: ${teamSize}
Order ID: ${data.id}

Fruits:
${fruitSummary}

Total: ₦${totalPrice.toLocaleString()}

Delivery Address:
${deliveryAddress}

Note:
${note || 'None'}
`;

    // 3️⃣ OPEN WHATSAPP
    const whatsappNumber = '2347080770160';
    const whatsappURL = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

    window.open(whatsappURL, '_blank');

    // 4️⃣ SUCCESS SCREEN
    setStep(3);

  } catch (err) {
    console.error(err);
    alert('Something went wrong. Please try again.');
  } finally {
    setIsSaving(false);
  }
};

  return (
    <div className={`min-h-screen pb-40 relative transition-colors duration-500 ${viewMode === 'gifting' ? OCCASIONS[occasion].bg : 'bg-[#fff9f0]'}`}>
      
      {/* View Mode Toggle - Improved for Mobile */}
      <nav className="fixed top-4 left-0 right-0 z-[60] px-4 flex justify-center">
        <div className="bg-white/90 backdrop-blur-md rounded-full cartoon-border p-1 flex gap-1 shadow-xl">
          <button 
            onClick={() => { setViewMode('subscription'); setStep(1); }}
            className={`px-4 md:px-6 py-2 rounded-full font-cartoon text-xs md:text-sm transition-all ${viewMode === 'subscription' ? 'bg-orange-500 text-white shadow-inner' : 'text-gray-500'}`}
          >
            Office Subs
          </button>
          <button 
            onClick={() => { setViewMode('gifting'); setStep(1); }}
            className={`px-4 md:px-6 py-2 rounded-full font-cartoon text-xs md:text-sm transition-all ${viewMode === 'gifting' ? 'bg-amber-600 text-white shadow-inner' : 'text-gray-500'}`}
          >
            Corporate Gifts ✨
          </button>
        </div>
      </nav>

      <header className="pt-24 md:pt-32 pb-8 md:pb-12 px-6 text-center">
        <h1 className="font-cartoon text-5xl md:text-8xl text-[#332111] mb-2 md:mb-4 tracking-tight drop-shadow-lg cursor-pointer transition-transform hover:scale-105" onClick={() => {setStep(1); setBox({});}}>
          {viewMode === 'subscription' ? 'Office' : 'Gift'}<span className={viewMode === 'subscription' ? 'text-orange-500' : 'text-amber-600'}>Fruits</span>
        </h1>
        <p className="text-[#5c4a38] text-sm md:text-xl font-bold tracking-tight">
          {viewMode === 'subscription' ? 'Vitamins delivered to your workstation. 🍏' : 'Premium corporate gifting made easy. 🎁'}
        </p>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 relative z-10">
        {step === 1 ? (
          <div className="space-y-12 md:space-y-16 animate-in fade-in duration-700">
            
            {/* Concierge Section */}
            <section className={`${viewMode === 'gifting' ? 'bg-white border-amber-300' : 'bg-white border-[#332111]'} p-6 md:p-12 rounded-[40px] md:rounded-[50px] cartoon-border relative overflow-hidden shadow-lg transition-colors`}>
              {isGuruLoading && (
                <div className="absolute inset-0 z-50 bg-white/95 flex flex-col items-center justify-center p-6 text-center animate-in fade-in">
                  <div className="relative w-32 h-32 md:w-40 md:h-40 mb-6 flex items-center justify-center">
                    <div className="text-6xl md:text-8xl animate-bounce-fruit">{viewMode === 'gifting' ? '🎁' : '🧙‍♂️'}</div>
                    <div className="absolute inset-0 animate-spin-slow">
                      <span className="absolute top-0 left-1/2 -translate-x-1/2 text-3xl animate-orbit">🍊</span>
                    </div>
                  </div>
                  <h3 className="font-cartoon text-lg md:text-2xl text-orange-600 animate-pulse">{GURU_MESSAGES[loadingMsgIdx]}</h3>
                </div>
              )}

              <div className="max-w-3xl mx-auto space-y-8">
                <h2 className="font-cartoon text-3xl md:text-4xl text-[#332111] flex items-center gap-3">
                  {viewMode === 'gifting' ? 'Gift Concierge' : 'Fruit Guru'} 🪄
                </h2>

                {viewMode === 'gifting' && (
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400">Select Occasion</label>
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(OCCASIONS) as GiftingOccasion[]).map(occ => (
                        <button 
                          key={occ}
                          onClick={() => loadOccasionPreset(occ)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border-2 ${occasion === occ ? 'bg-[#332111] text-white border-[#332111]' : 'bg-white text-gray-600 border-gray-100 hover:border-amber-200'}`}
                        >
                          {OCCASIONS[occ].emoji} {occ}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400">Team Size</label>
                    <input type="number" value={teamSize} onChange={(e) => setTeamSize(Math.max(1, Number(e.target.value)))} className="w-full font-cartoon" />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400">Mood / Details</label>
                    <input type="text" placeholder="e.g. Energy Burst" value={mood} onChange={(e) => setMood(e.target.value)} className="w-full font-bold" />
                  </div>
                </div>

                <button onClick={askGuru} className={`w-full cartoon-button ${viewMode === 'gifting' ? 'bg-amber-600 text-white' : 'bg-yellow-400 text-[#332111]'} py-4 rounded-2xl font-cartoon text-xl md:text-2xl`}>
                  Generate Box 🪄
                </button>

                {guruMessage && !isGuruLoading && (
                  <div className="mt-6 p-6 bg-orange-50/50 rounded-3xl border-2 border-dashed border-orange-200 animate-in zoom-in-95">
                    <p className="text-lg md:text-xl text-orange-900 font-bold italic leading-tight">"{guruMessage}"</p>
                  </div>
                )}
              </div>
            </section>

            {/* Orchard Grid - 2 cols on mobile */}
            <section className="space-y-8">
              <h2 className="font-cartoon text-4xl md:text-5xl text-[#332111] text-center md:text-left">The Orchard</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-8">
                {FRUITS.map(fruit => (
                  <FruitCard key={fruit.id} fruit={fruit} quantity={box[fruit.id] || 0} onAdd={handleAdd} onRemove={handleRemove} isGiftMode={viewMode === 'gifting'} />
                ))}
              </div>
            </section>
          </div>
        ) : step === 2 ? (
          <div className="bg-white p-6 md:p-16 rounded-[40px] md:rounded-[60px] cartoon-border max-w-3xl mx-auto space-y-10 animate-in zoom-in-95">
            <div className="text-center">
              <h2 className="font-cartoon text-4xl md:text-5xl">{viewMode === 'gifting' ? 'Gift Details 💝' : 'Final Step! 🍏'}</h2>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mt-2">Securing your office joy</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <input placeholder="Company Name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="w-full font-bold" />
              <input placeholder="Work Email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full font-bold" />
            </div>

            {viewMode === 'gifting' && (
              <div className="p-5 bg-amber-50 rounded-3xl border-2 border-amber-200 border-dashed space-y-4">
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={isBulkGift} onChange={(e) => setIsBulkGift(e.target.checked)} className="w-5 h-5" />
                    <span className="text-sm font-bold text-amber-900">Multi-Address (Remote Teams)</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={includeBranding} onChange={(e) => setIncludeBranding(e.target.checked)} className="w-5 h-5" />
                    <span className="text-sm font-bold text-amber-900">Custom Branding (+₦5,000)</span>
                  </label>
                </div>
              </div>
            )}

            <textarea placeholder="Delivery Address..." value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className="w-full font-bold min-h-[100px]" />
            <textarea placeholder="Handwritten Note..." value={note} onChange={(e) => setNote(e.target.value)} className="w-full font-bold min-h-[100px] border-amber-400" />

            <div className="bg-gray-50 p-6 rounded-3xl border-2 border-dashed border-gray-300">
               <h3 className="font-cartoon text-xl mb-4">Basket Summary</h3>
               <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-2">
                 {Object.entries(box).map(([id, qty]) => {
                   const f = FRUITS.find(item => item.id === id);
                   return (
                     <div key={id} className="flex justify-between items-center text-sm bg-white p-2 rounded-xl border">
                       <span>{f?.emoji} {f?.name}</span>
                       <span className="font-cartoon text-orange-600">x{qty}</span>
                     </div>
                   );
                 })}
               </div>
            </div>

            <div className={`p-8 rounded-[35px] cartoon-border ${viewMode === 'gifting' ? 'bg-amber-100' : 'bg-orange-100'} flex flex-col md:flex-row justify-between items-center gap-4`}>
              <div className="text-center md:text-left">
                <p className="text-[10px] font-black uppercase text-gray-500">Total Upfront</p>
                <p className="font-cartoon text-4xl md:text-5xl">₦{totalPrice.toLocaleString()}</p>
              </div>
              <button onClick={handlePlaceSubscription} className={`w-full md:w-auto px-12 py-5 rounded-2xl font-cartoon text-xl text-white cartoon-button ${viewMode === 'gifting' ? 'bg-amber-600' : 'bg-green-500'}`}>
                Pay Now 🚀
              </button>
            </div>
            
            <button className="w-full text-[10px] font-black uppercase text-gray-400" onClick={() => setStep(1)}>← Back to Catalog</button>
          </div>
        ) : (
          <div className="bg-white p-12 rounded-[50px] cartoon-border max-w-xl mx-auto text-center animate-in zoom-in-95">
             <div className="text-7xl mb-6">🎉</div>
             <h2 className="font-cartoon text-4xl mb-4">Order Placed!</h2>
             <p className="font-bold text-gray-600 mb-8">Vitamins and joy are on their way to <b>{companyName}</b>.</p>
             <button className="cartoon-button bg-orange-500 text-white font-cartoon text-xl px-12 py-4 rounded-2xl" onClick={() => {setStep(1); setBox({});}}>Build More Joy!</button>
          </div>
        )}
      </main>

      {/* Cart Bar - Improved for Mobile */}
      {step === 1 && (
        <div className="fixed bottom-6 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:max-w-md z-50">
          <div className="bg-white/95 backdrop-blur-md cartoon-border p-3 md:p-4 flex items-center justify-between rounded-[30px] shadow-2xl">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all ${cartPopping ? 'animate-pop bg-orange-200' : 'bg-orange-100'}`}>
                {viewMode === 'gifting' ? '🎁' : '📦'}
              </div>
              <div>
                <p className="font-cartoon text-lg md:text-xl leading-none">₦{totalPrice.toLocaleString()}</p>
                <p className="text-[9px] font-black uppercase text-gray-400 mt-1">{totalFruits} items</p>
              </div>
            </div>
            <button onClick={() => setStep(2)} disabled={totalFruits === 0} className={`font-cartoon px-6 py-3 rounded-xl cartoon-button text-sm disabled:opacity-50 ${viewMode === 'gifting' ? 'bg-amber-600 text-white' : 'bg-[#332111] text-white'}`}>
              Review Box
            </button>
          </div>
        </div>
      )}

      {/* Occasion-specific Floating elements */}
      <div className="fixed -z-20 inset-0 pointer-events-none overflow-hidden select-none opacity-10">
        <div className="absolute top-[10%] left-[10%] text-6xl animate-float">{viewMode === 'subscription' ? '🍎' : OCCASIONS[occasion].emoji}</div>
        <div className="absolute bottom-[20%] right-[15%] text-7xl animate-float" style={{animationDelay: '1s'}}>{viewMode === 'subscription' ? '🍌' : '✨'}</div>
      </div>
    </div>
  );
};

export default App;
