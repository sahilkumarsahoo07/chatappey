import { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  MessageSquare, Video, Lock, Phone, Image as ImageIcon, Users, 
  Smile, Mic, Paperclip, CheckCircle2, ChevronRight,
  ShieldCheck, Globe, Heart, ArrowRight, Laptop, Smartphone,
  Monitor, Star, Play, MicOff, Camera, MonitorOff,
  Timer, MapPin, Palette, QrCode, FileText, Settings, Layers, BellOff,
  BarChart2, MonitorUp, Cloud, Megaphone, Moon, MessageCircle, Link as LinkIcon,
  Bot, PenTool, CalendarClock, Folder, Map, Contact, Ghost, Hash, ImagePlus
} from 'lucide-react';

const LandingPage = () => {
  const [activeFaq, setActiveFaq] = useState(-1);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans antialiased selection:bg-indigo-500/20 relative overflow-x-hidden">
      
      {/* VIBRANT GLOSSY MESH GRADIENTS */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-300/30 rounded-full mix-blend-multiply filter blur-[120px] opacity-70"></div>
        <div className="absolute top-[20%] right-[-10%] w-[600px] h-[600px] bg-purple-300/30 rounded-full mix-blend-multiply filter blur-[120px] opacity-70"></div>
        <div className="absolute bottom-[-10%] left-[20%] w-[700px] h-[700px] bg-pink-300/20 rounded-full mix-blend-multiply filter blur-[150px] opacity-70"></div>
        <div className="absolute top-[60%] right-[10%] w-[400px] h-[400px] bg-amber-300/20 rounded-full mix-blend-multiply filter blur-[100px] opacity-60"></div>
      </div>

      {/* GLASSMORPHISM NAVBAR */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/70 backdrop-blur-xl border-b border-white/50 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 md:px-12 h-20 flex items-center justify-between">
          <div className="flex items-center gap-12">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-[14px] bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25 group-hover:scale-105 transition-all duration-300">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-black tracking-tight text-slate-900">
                Chatappey
              </span>
            </Link>

            {/* Nav Items */}
            <div className="hidden lg:flex items-center gap-8 text-sm font-bold text-slate-600">
              <a href="#features" className="hover:text-indigo-600 transition-colors">Features</a>
              <a href="#calling" className="hover:text-indigo-600 transition-colors">Calls</a>
              <a href="#security" className="hover:text-indigo-600 transition-colors">Privacy</a>
              <a href="#faq" className="hover:text-indigo-600 transition-colors">FAQ</a>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/login" className="text-slate-600 hover:text-indigo-600 text-sm font-bold transition-colors">Log in</Link>
            <Link to="/signup" className="h-10 px-6 rounded-xl bg-slate-900 text-white hover:bg-indigo-600 text-xs font-black flex items-center gap-1.5 shadow-lg shadow-slate-900/10 hover:shadow-indigo-600/25 transition-all">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      <main className="relative z-10 pt-24">
        
        {/* HERO SECTION */}
        <section className="max-w-7xl mx-auto px-6 md:px-12 pt-16 pb-20 lg:pt-28 lg:pb-24 relative">
          <div className="grid lg:grid-cols-12 gap-16 items-center relative z-10">
            
            {/* Left Column: Heading Copy */}
            <div className="lg:col-span-6 text-left space-y-8">
              <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/80 backdrop-blur-md border border-indigo-100 text-indigo-600 shadow-sm shadow-indigo-100">
                <ShieldCheck className="w-4 h-4 text-indigo-500" />
                <span className="text-[10.5px] font-black tracking-widest uppercase">End-to-End Encrypted</span>
              </div>

              <h1 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter leading-[1.05] text-slate-900">
                Message privately.<br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500">
                  Connect freely.
                </span>
              </h1>

              <p className="text-base md:text-lg text-slate-600 leading-relaxed max-w-xl font-medium">
                Simple, reliable, and secure messaging and calling for free, available on phones and web all over the world. Keep your conversations private, always.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
                <Link to="/signup" className="h-14 px-8 rounded-2xl bg-indigo-600 text-white hover:bg-indigo-500 font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/30 hover:-translate-y-0.5 transition-all w-full sm:w-auto">
                  Open Web App
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <a href="#features" className="h-14 px-8 rounded-2xl bg-white/70 backdrop-blur-xl hover:bg-white text-slate-900 font-bold text-sm flex items-center justify-center gap-2 border border-slate-200 shadow-sm hover:shadow-md transition-all w-full sm:w-auto">
                  Explore Features
                </a>
              </div>

              <div className="flex items-center gap-4 pt-8">
                <div className="flex -space-x-3">
                  <img src="https://i.pravatar.cc/100?img=4" alt="user" className="w-10 h-10 rounded-full border-2 border-slate-50 shadow-sm" />
                  <img src="https://i.pravatar.cc/100?img=5" alt="user" className="w-10 h-10 rounded-full border-2 border-slate-50 shadow-sm" />
                  <img src="https://i.pravatar.cc/100?img=1" alt="user" className="w-10 h-10 rounded-full border-2 border-slate-50 shadow-sm" />
                  <img src="https://i.pravatar.cc/100?img=3" alt="user" className="w-10 h-10 rounded-full border-2 border-slate-50 shadow-sm" />
                </div>
                <p className="text-xs font-bold text-slate-500">
                  Join over <span className="text-slate-900 font-black">2 Million</span> users globally.
                </p>
              </div>
            </div>

            {/* Right Column: Chat Application Mockup */}
            <div className="lg:col-span-6 relative">
              <div className="relative rounded-[2rem] bg-white/80 backdrop-blur-2xl border border-white shadow-2xl shadow-indigo-900/10 overflow-hidden min-h-[560px] flex">
                
                {/* Mockup Sidebar */}
                <div className="w-[35%] bg-slate-50/50 border-r border-slate-200/60 hidden md:flex flex-col">
                  {/* Search Header */}
                  <div className="h-16 flex items-center px-4 border-b border-slate-200/60 bg-white/40 backdrop-blur-md">
                    <div className="w-full h-9 bg-white border border-slate-200 rounded-xl px-3 flex items-center">
                      <span className="text-xs text-slate-400 font-bold">Search chats...</span>
                    </div>
                  </div>
                  {/* Chat List */}
                  <div className="p-2 space-y-1 overflow-y-auto">
                    {/* Active Chat */}
                    <div className="p-3 bg-indigo-50 rounded-xl flex gap-3 items-center cursor-pointer shadow-sm border border-indigo-100/50">
                      <div className="relative shrink-0">
                        <img src="https://i.pravatar.cc/150?img=32" alt="Sarah" className="w-10 h-10 rounded-full shadow-sm" />
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-sm text-slate-900 truncate">Sarah Jenkins</span>
                          <span className="text-[10px] text-indigo-600 font-black shrink-0">12:42 PM</span>
                        </div>
                        <p className="text-xs text-indigo-900/60 font-semibold truncate">Are we still on for tomorrow? ☕</p>
                      </div>
                    </div>
                    {/* Inactive Chat 1 */}
                    <div className="p-3 hover:bg-slate-100 rounded-xl flex gap-3 items-center cursor-pointer transition-colors">
                      <div className="relative shrink-0">
                        <img src="https://i.pravatar.cc/150?img=11" alt="Design Team" className="w-10 h-10 rounded-full shadow-sm" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-sm text-slate-700 truncate">Design Team 🎨</span>
                          <span className="text-[10px] text-slate-400 font-bold shrink-0">Yesterday</span>
                        </div>
                        <p className="text-xs text-slate-500 font-medium truncate">Marcus: I uploaded the new assets!</p>
                      </div>
                    </div>
                    {/* Inactive Chat 2 */}
                    <div className="p-3 hover:bg-slate-100 rounded-xl flex gap-3 items-center cursor-pointer transition-colors">
                      <div className="relative shrink-0">
                        <img src="https://i.pravatar.cc/150?img=68" alt="Alex" className="w-10 h-10 rounded-full shadow-sm" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-sm text-slate-700 truncate">Alex Rivera</span>
                          <span className="text-[10px] text-slate-400 font-bold shrink-0">Tuesday</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-blue-500 shrink-0" />
                          <p className="text-xs text-slate-500 font-medium truncate">Sounds like a plan!</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mockup Chat View */}
                <div className="flex-1 flex flex-col bg-slate-50/30 relative">
                  {/* Chat Header */}
                  <div className="h-16 flex justify-between items-center px-6 border-b border-slate-200/60 bg-white/60 backdrop-blur-md absolute top-0 w-full z-10">
                    <div className="flex items-center gap-3">
                      <img src="https://i.pravatar.cc/150?img=32" alt="Sarah" className="w-9 h-9 rounded-full shadow-sm" />
                      <div>
                        <div className="font-black text-sm text-slate-900">Sarah Jenkins</div>
                        <div className="text-[10px] text-green-500 font-bold">Online</div>
                      </div>
                    </div>
                    <div className="flex gap-4 text-slate-400">
                      <Video className="w-5 h-5 cursor-pointer hover:text-indigo-600 transition-colors" />
                      <Phone className="w-5 h-5 cursor-pointer hover:text-indigo-600 transition-colors" />
                    </div>
                  </div>

                  {/* Chat Messages */}
                  <div className="flex-1 px-6 pt-24 pb-20 overflow-y-auto flex flex-col gap-4">
                    <div className="text-center text-[10px] font-bold text-slate-400 my-2 uppercase tracking-widest bg-slate-100/50 rounded-full px-3 py-1 self-center">Today</div>
                    
                    {/* Receiver Bubble */}
                    <div className="flex gap-2 max-w-[85%] animate-fade-in-up">
                      <img src="https://i.pravatar.cc/150?img=32" alt="Sarah" className="w-6 h-6 rounded-full self-end shadow-sm" />
                      <div className="bg-white border border-slate-100 p-3 px-4 rounded-2xl rounded-bl-sm shadow-sm text-sm text-slate-700 font-medium">
                        Hey! I just saw the new design prototypes. They look amazing! 😍
                        <div className="text-[9px] text-slate-400 font-bold mt-1 text-right">12:40 PM</div>
                      </div>
                    </div>
                    
                    {/* Sender Bubble */}
                    <div className="flex max-w-[85%] ml-auto justify-end animate-fade-in-up" style={{animationDelay: '0.1s'}}>
                      <div className="bg-indigo-600 text-white p-3 px-4 rounded-2xl rounded-br-sm shadow-sm shadow-indigo-600/20 text-sm font-medium">
                        Thanks Sarah! Did you check out the new responsive layouts?
                        <div className="flex justify-end items-center gap-1 mt-1">
                          <span className="text-[9px] text-indigo-200 font-bold">12:41 PM</span>
                          <CheckCircle2 className="w-3 h-3 text-indigo-300" />
                        </div>
                      </div>
                    </div>

                    {/* Receiver Bubble */}
                    <div className="flex gap-2 max-w-[85%] animate-fade-in-up" style={{animationDelay: '0.2s'}}>
                      <img src="https://i.pravatar.cc/150?img=32" alt="Sarah" className="w-6 h-6 rounded-full self-end shadow-sm" />
                      <div className="bg-white border border-slate-100 p-3 px-4 rounded-2xl rounded-bl-sm shadow-sm text-sm text-slate-700 font-medium">
                        Are we still on for tomorrow? ☕
                        <div className="text-[9px] text-slate-400 font-bold mt-1 text-right">12:42 PM</div>
                      </div>
                    </div>
                  </div>

                  {/* Input Area */}
                  <div className="absolute bottom-0 w-full p-4 bg-white/70 backdrop-blur-md border-t border-slate-200/60 flex items-center gap-3">
                    <Smile className="w-6 h-6 text-slate-400 cursor-pointer hover:text-indigo-600 transition-colors" />
                    <Paperclip className="w-6 h-6 text-slate-400 cursor-pointer hover:text-indigo-600 transition-colors" />
                    <div className="flex-1 bg-white border border-slate-200 shadow-inner rounded-full h-10 px-4 flex items-center">
                      <span className="text-sm text-slate-400 font-medium">Message...</span>
                    </div>
                    <div className="w-10 h-10 shrink-0 rounded-full bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-600/20 text-white cursor-pointer hover:bg-indigo-500 transition-colors">
                      <Mic className="w-4.5 h-4.5" />
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </section>

        {/* PLATFORMS BANNER */}
        <section className="border-y border-white/40 bg-white/30 backdrop-blur-md py-8">
          <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 text-slate-500 font-black uppercase tracking-widest text-[11px]">
            <span className="flex items-center gap-2 hover:text-slate-800 transition-colors"><Monitor className="w-5 h-5" /> Web Browser</span>
            <span className="flex items-center gap-2 hover:text-slate-800 transition-colors"><Laptop className="w-5 h-5" /> Desktop App</span>
            <span className="flex items-center gap-2 hover:text-slate-800 transition-colors"><Smartphone className="w-5 h-5" /> Mobile Devices</span>
            <span className="flex items-center gap-2 hover:text-slate-800 transition-colors"><Globe className="w-5 h-5" /> Works Anywhere</span>
          </div>
        </section>

        {/* CORE FEATURES BENTO SECTION */}
        <section id="features" className="py-24 relative">
          <div className="max-w-7xl mx-auto px-6 md:px-12 space-y-12">
            
            <div className="text-center max-w-2xl mx-auto space-y-4">
              <h2 className="text-[10.5px] font-black tracking-widest uppercase text-indigo-500">Core Experience</h2>
              <h3 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 leading-tight">Everything you need to stay connected.</h3>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Feature 1 */}
              <div className="bg-white/70 backdrop-blur-xl border border-white shadow-xl shadow-slate-200/40 p-8 rounded-[2rem] text-left hover:-translate-y-1 transition-transform">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 mb-6 shadow-sm border border-emerald-100">
                  <Lock className="w-6 h-6" />
                </div>
                <h4 className="font-black text-xl text-slate-900 mb-3">End-to-end encrypted</h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                  Your personal messages and calls are secured. Only you and the person you're talking to can read or listen to them.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="bg-white/70 backdrop-blur-xl border border-white shadow-xl shadow-slate-200/40 p-8 rounded-[2rem] text-left hover:-translate-y-1 transition-transform">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-600 mb-6 shadow-sm border border-purple-100">
                  <Video className="w-6 h-6" />
                </div>
                <h4 className="font-black text-xl text-slate-900 mb-3">Voice & Video Calls</h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                  Catch up securely with crystal clear voice and video calls, even on slow connections, across any device.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="bg-white/70 backdrop-blur-xl border border-white shadow-xl shadow-slate-200/40 p-8 rounded-[2rem] text-left hover:-translate-y-1 transition-transform">
                <div className="w-12 h-12 rounded-2xl bg-pink-50 flex items-center justify-center text-pink-500 mb-6 shadow-sm border border-pink-100">
                  <Users className="w-6 h-6" />
                </div>
                <h4 className="font-black text-xl text-slate-900 mb-3">Group Connections</h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                  Whether it's planning an outing with friends or staying on top of work, group chats keep you connected effortlessly.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="bg-white/70 backdrop-blur-xl border border-white shadow-xl shadow-slate-200/40 p-8 rounded-[2rem] text-left hover:-translate-y-1 transition-transform">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 mb-6 shadow-sm border border-amber-100">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <h4 className="font-black text-xl text-slate-900 mb-3">Share rich media</h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">
                  Send photos, videos, and voice memos instantly. Share moments that matter without compromising quality.
                </p>
              </div>

            </div>
          </div>
        </section>

        {/* DEEP DIVE: VOICE & VIDEO CALLING */}
        <section id="calling" className="py-24 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-6 md:px-12 grid lg:grid-cols-12 gap-16 items-center">
            
            <div className="lg:col-span-5 text-left space-y-6">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-sm mb-4">
                <Video className="w-7 h-7" />
              </div>
              <h3 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 leading-tight">
                High-quality calls.<br/> Anywhere.
              </h3>
              <p className="text-base text-slate-600 font-medium leading-relaxed max-w-md">
                Experience crystal-clear voice and HD video calls. Whether you're calling across the street or across the globe, our optimized WebRTC engines ensure your connection is reliable and fast, completely free of charge.
              </p>
              <ul className="space-y-4 pt-4">
                {['Works seamlessly on slow internet connections', 'Support for up to 32 participants per group call', 'End-to-end encrypted transmission streams'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm font-bold text-slate-700">
                    <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:col-span-7">
              {/* Glossy Video Call Widget Mockup */}
              <div className="bg-white/80 backdrop-blur-2xl border border-white shadow-2xl shadow-indigo-900/10 p-4 rounded-[2rem]">
                <div className="grid grid-cols-2 gap-3 h-[400px]">
                  {/* Participant 1 */}
                  <div className="bg-indigo-100 rounded-2xl relative overflow-hidden flex items-center justify-center">
                    <img src="https://i.pravatar.cc/400?img=68" alt="Person" className="object-cover w-full h-full opacity-90 mix-blend-luminosity" />
                    <div className="absolute bottom-3 left-3 bg-black/40 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/20">Alex Rivera</div>
                  </div>
                  {/* Participant 2 */}
                  <div className="bg-pink-100 rounded-2xl relative overflow-hidden flex items-center justify-center">
                    <img src="https://i.pravatar.cc/400?img=32" alt="Person" className="object-cover w-full h-full opacity-90 mix-blend-luminosity" />
                    <div className="absolute bottom-3 left-3 bg-black/40 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/20">Sarah Jenkins</div>
                  </div>
                  {/* Participant 3 */}
                  <div className="bg-emerald-100 rounded-2xl relative overflow-hidden flex items-center justify-center">
                    <img src="https://i.pravatar.cc/400?img=11" alt="Person" className="object-cover w-full h-full opacity-90 mix-blend-luminosity" />
                    <div className="absolute bottom-3 left-3 bg-black/40 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/20">Marcus Dean</div>
                    <div className="absolute top-3 right-3 bg-red-500/80 text-white p-1.5 rounded-full backdrop-blur-md"><MicOff className="w-3 h-3" /></div>
                  </div>
                  {/* Participant 4 (You) */}
                  <div className="bg-slate-200 rounded-2xl relative overflow-hidden flex items-center justify-center border-2 border-indigo-500">
                    <img src="https://i.pravatar.cc/400?img=59" alt="Person" className="object-cover w-full h-full opacity-90 mix-blend-luminosity" />
                    <div className="absolute bottom-3 left-3 bg-black/40 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/20">You</div>
                  </div>
                </div>
                
                {/* Call Controls */}
                <div className="flex items-center justify-center gap-4 mt-6 mb-2">
                  <button className="w-12 h-12 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"><Mic className="w-5 h-5" /></button>
                  <button className="w-12 h-12 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 transition-colors"><Camera className="w-5 h-5" /></button>
                  <button className="w-14 h-14 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center text-white transition-colors shadow-lg shadow-red-500/30"><Phone className="w-6 h-6 rotate-[135deg]" /></button>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* 8-WIDGET TOOLKIT BENTO SECTION */}
        <section className="py-24 relative overflow-hidden bg-slate-100/50">
          <div className="max-w-7xl mx-auto px-6 md:px-12 space-y-12">
            
            <div className="text-center max-w-2xl mx-auto space-y-4">
              <h2 className="text-[10.5px] font-black tracking-widest uppercase text-indigo-500">The Ultimate Toolkit</h2>
              <h3 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 leading-tight">Everything you need. <br/> Nothing you don't.</h3>
            </div>

            <div className="grid grid-cols-12 gap-6">
              
              {/* Widget 1: Disappearing Messages (Col 4) */}
              <div className="col-span-12 md:col-span-4 bg-white/80 backdrop-blur-xl border border-white shadow-xl shadow-slate-200/50 rounded-[2rem] p-8 flex flex-col hover:-translate-y-1 transition-transform group overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-slate-900 rounded-full blur-[60px] opacity-10 group-hover:opacity-20 transition-opacity"></div>
                <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white mb-6 shadow-md z-10">
                  <Timer className="w-6 h-6" />
                </div>
                <h4 className="font-black text-xl text-slate-900 mb-2 z-10">Disappearing Messages</h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed z-10">
                  Set messages to disappear after 24 hours, 7 days, or 90 days. Leave no trace behind.
                </p>
                <div className="mt-8 bg-slate-50 border border-slate-200 rounded-xl p-3 flex justify-between items-center z-10">
                  <span className="text-xs font-bold text-slate-600">Message Timer</span>
                  <span className="text-xs font-black text-indigo-600 bg-indigo-100 px-2 py-1 rounded-md">24 Hours</span>
                </div>
              </div>

              {/* Widget 2: Voice Notes (Col 8) */}
              <div className="col-span-12 md:col-span-8 bg-white/80 backdrop-blur-xl border border-white shadow-xl shadow-slate-200/50 rounded-[2rem] p-8 flex flex-col justify-between hover:-translate-y-1 transition-transform group overflow-hidden relative">
                <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-indigo-500 rounded-full blur-[80px] opacity-10 group-hover:opacity-20 transition-opacity"></div>
                <div className="z-10">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-6 border border-indigo-100">
                    <Mic className="w-6 h-6" />
                  </div>
                  <h4 className="font-black text-2xl text-slate-900 mb-2">Expressive Voice Notes</h4>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-sm">
                    Sometimes text isn't enough. Send high-fidelity voice notes with playback speed controls and hands-free recording.
                  </p>
                </div>
                
                {/* Voice Note Player Mockup */}
                <div className="mt-8 bg-slate-900 p-4 rounded-2xl flex items-center gap-4 z-10 w-full max-w-lg shadow-lg shadow-slate-900/20">
                  <button className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white shrink-0 hover:scale-105 transition-transform">
                    <Play className="w-4 h-4 ml-0.5 fill-current" />
                  </button>
                  <div className="flex-1 flex gap-1 items-end h-8">
                    {[10,20,30,50,80,100,70,40,60,90,100,60,30,20,10,30,50,40,20].map((h, i) => (
                      <div key={i} className="flex-1 bg-indigo-400 rounded-full" style={{ height: `${h}%`, opacity: i < 8 ? 1 : 0.3 }}></div>
                    ))}
                  </div>
                  <img src="https://i.pravatar.cc/100?img=32" alt="User Avatar" className="w-10 h-10 rounded-full border-2 border-slate-700 shrink-0" />
                </div>
              </div>

              {/* Widget 3: Live Location (Col 4) */}
              <div className="col-span-12 md:col-span-4 bg-white/80 backdrop-blur-xl border border-white shadow-xl shadow-slate-200/50 rounded-[2rem] p-8 flex flex-col hover:-translate-y-1 transition-transform group overflow-hidden relative">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500 rounded-full blur-[60px] opacity-10 group-hover:opacity-20 transition-opacity"></div>
                 <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 mb-6 border border-emerald-100 z-10">
                   <MapPin className="w-6 h-6" />
                 </div>
                 <h4 className="font-black text-xl text-slate-900 mb-2 z-10">Live Location</h4>
                 <p className="text-sm text-slate-500 font-medium leading-relaxed z-10">
                   Share your real-time location securely with friends. Perfect for meetups.
                 </p>
                 <div className="mt-6 bg-slate-100 h-28 rounded-xl relative overflow-hidden z-10 border border-slate-200 flex items-center justify-center">
                    <div className="absolute inset-0 opacity-30" style={{backgroundImage: 'radial-gradient(circle at center, #94a3b8 1px, transparent 1px)', backgroundSize: '12px 12px'}}></div>
                    <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/40 relative z-10 animate-pulse">
                      <div className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center overflow-hidden">
                        <img src="https://i.pravatar.cc/100?img=5" alt="Location Avatar" />
                      </div>
                    </div>
                 </div>
              </div>

              {/* Widget 4: Custom Themes (Col 4) */}
              <div className="col-span-12 md:col-span-4 bg-white/80 backdrop-blur-xl border border-white shadow-xl shadow-slate-200/50 rounded-[2rem] p-8 flex flex-col hover:-translate-y-1 transition-transform group overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500 rounded-full blur-[60px] opacity-10 group-hover:opacity-20 transition-opacity"></div>
                <div className="w-12 h-12 rounded-2xl bg-pink-50 flex items-center justify-center text-pink-500 mb-6 border border-pink-100 z-10">
                   <Palette className="w-6 h-6" />
                 </div>
                 <h4 className="font-black text-xl text-slate-900 mb-2 z-10">Beautiful Themes</h4>
                 <p className="text-sm text-slate-500 font-medium leading-relaxed z-10">
                   Personalize your chats. Choose from stunning light and dark themes tailored to your style.
                 </p>
                 <div className="mt-8 flex gap-3 z-10">
                    {['bg-slate-900', 'bg-indigo-500', 'bg-pink-500', 'bg-emerald-500'].map((color, i) => (
                      <div key={i} className={`w-10 h-10 rounded-full ${color} shadow-md border-2 border-white cursor-pointer hover:scale-110 transition-transform ${i===1 ? 'ring-2 ring-indigo-300 ring-offset-2' : ''}`}></div>
                    ))}
                 </div>
              </div>

              {/* Widget 5: Web Linking (Col 4) */}
              <div className="col-span-12 md:col-span-4 bg-white/80 backdrop-blur-xl border border-white shadow-xl shadow-slate-200/50 rounded-[2rem] p-8 flex flex-col hover:-translate-y-1 transition-transform group overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500 rounded-full blur-[60px] opacity-10 group-hover:opacity-20 transition-opacity"></div>
                <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 mb-6 border border-amber-100 z-10">
                   <QrCode className="w-6 h-6" />
                 </div>
                 <h4 className="font-black text-xl text-slate-900 mb-2 z-10">Multi-Device Sync</h4>
                 <p className="text-sm text-slate-500 font-medium leading-relaxed z-10">
                   Scan a QR code to securely link your account to your computer browser in seconds.
                 </p>
                 <div className="mt-6 flex justify-between items-center bg-white border border-slate-200 rounded-xl p-4 shadow-sm z-10">
                   <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center"><QrCode className="w-6 h-6 text-slate-400" /></div>
                   <div className="w-8 h-8 rounded-full bg-slate-900 flex items-center justify-center"><ArrowRight className="w-4 h-4 text-white" /></div>
                   <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center border border-indigo-100"><Monitor className="w-6 h-6 text-indigo-500" /></div>
                 </div>
              </div>

              {/* Widget 6: Group Controls (Col 4) */}
              <div className="col-span-12 md:col-span-4 bg-white/80 backdrop-blur-xl border border-white shadow-xl shadow-slate-200/50 rounded-[2rem] p-8 flex flex-col hover:-translate-y-1 transition-transform group overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full blur-[60px] opacity-10 group-hover:opacity-20 transition-opacity"></div>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 mb-6 border border-blue-100 z-10">
                   <Settings className="w-6 h-6" />
                 </div>
                 <h4 className="font-black text-xl text-slate-900 mb-2 z-10">Granular Group Controls</h4>
                 <p className="text-sm text-slate-500 font-medium leading-relaxed z-10">
                   Keep your communities organized. Set permissions on who can send messages or edit info.
                 </p>
                 <div className="mt-6 space-y-2 z-10">
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-700">Allow members to post</span>
                      <div className="w-8 h-4 bg-indigo-500 rounded-full relative"><div className="w-3 h-3 bg-white rounded-full absolute right-0.5 top-0.5"></div></div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg flex justify-between items-center opacity-70">
                      <span className="text-xs font-bold text-slate-700">Approve new members</span>
                      <div className="w-8 h-4 bg-slate-300 rounded-full relative"><div className="w-3 h-3 bg-white rounded-full absolute left-0.5 top-0.5"></div></div>
                    </div>
                 </div>
              </div>

              {/* Widget 7: File Sharing (Col 4) */}
              <div className="col-span-12 md:col-span-4 bg-white/80 backdrop-blur-xl border border-white shadow-xl shadow-slate-200/50 rounded-[2rem] p-8 flex flex-col hover:-translate-y-1 transition-transform group overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500 rounded-full blur-[60px] opacity-10 group-hover:opacity-20 transition-opacity"></div>
                <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500 mb-6 border border-orange-100 z-10">
                   <FileText className="w-6 h-6" />
                 </div>
                 <h4 className="font-black text-xl text-slate-900 mb-2 z-10">Share Documents</h4>
                 <p className="text-sm text-slate-500 font-medium leading-relaxed z-10">
                   Send PDFs, spreadsheets, and zip files up to 2GB directly in your chats securely.
                 </p>
                 <div className="mt-8 flex gap-3 z-10">
                   <div className="w-14 h-16 bg-red-50 border border-red-100 rounded-lg flex flex-col items-center justify-center gap-1 shadow-sm"><FileText className="w-5 h-5 text-red-500"/><span className="text-[9px] font-bold text-red-600">PDF</span></div>
                   <div className="w-14 h-16 bg-blue-50 border border-blue-100 rounded-lg flex flex-col items-center justify-center gap-1 shadow-sm"><FileText className="w-5 h-5 text-blue-500"/><span className="text-[9px] font-bold text-blue-600">DOC</span></div>
                   <div className="w-14 h-16 bg-emerald-50 border border-emerald-100 rounded-lg flex flex-col items-center justify-center gap-1 shadow-sm"><Layers className="w-5 h-5 text-emerald-500"/><span className="text-[9px] font-bold text-emerald-600">ZIP</span></div>
                 </div>
              </div>

              {/* Widget 8: Reactions (Col 4) */}
              <div className="col-span-12 md:col-span-4 bg-white/80 backdrop-blur-xl border border-white shadow-xl shadow-slate-200/50 rounded-[2rem] p-8 flex flex-col hover:-translate-y-1 transition-transform group overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500 rounded-full blur-[60px] opacity-10 group-hover:opacity-20 transition-opacity"></div>
                <div className="w-12 h-12 rounded-2xl bg-yellow-50 flex items-center justify-center text-yellow-600 mb-6 border border-yellow-100 z-10">
                   <Smile className="w-6 h-6" />
                 </div>
                 <h4 className="font-black text-xl text-slate-900 mb-2 z-10">Reactions & Stickers</h4>
                 <p className="text-sm text-slate-500 font-medium leading-relaxed z-10">
                   Quickly reply with a wide range of emojis and animated stickers to express yourself without typing.
                 </p>
                 <div className="mt-8 bg-slate-50 border border-slate-200 rounded-full px-4 py-3 flex justify-between z-10 relative">
                   <span className="text-xl hover:scale-125 cursor-pointer transition-transform">👍</span>
                   <span className="text-xl hover:scale-125 cursor-pointer transition-transform">❤️</span>
                   <span className="text-xl hover:scale-125 cursor-pointer transition-transform">😂</span>
                   <span className="text-xl hover:scale-125 cursor-pointer transition-transform">😮</span>
                   <span className="text-xl hover:scale-125 cursor-pointer transition-transform">😢</span>
                   <span className="text-xl hover:scale-125 cursor-pointer transition-transform">🙏</span>
                 </div>
              </div>

            </div>
          </div>
        </section>

        {/* 10-WIDGET NEXT-LEVEL COMMUNICATION SECTION */}
        <section className="py-24 relative overflow-hidden bg-slate-50">
          <div className="max-w-7xl mx-auto px-6 md:px-12 space-y-12">
            
            <div className="text-center max-w-2xl mx-auto space-y-4">
              <h2 className="text-[10.5px] font-black tracking-widest uppercase text-indigo-500">Advanced Features</h2>
              <h3 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 leading-tight">Next-level communication.</h3>
            </div>

            <div className="grid grid-cols-12 gap-6">
              
              {/* Widget 1: Chat Translation (Col 4) */}
              <div className="col-span-12 md:col-span-4 bg-white/80 backdrop-blur-xl border border-white shadow-xl shadow-slate-200/40 rounded-[2rem] p-8 flex flex-col hover:-translate-y-1 transition-transform group">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 mb-6 border border-indigo-100">
                  <Globe className="w-6 h-6" />
                </div>
                <h4 className="font-black text-xl text-slate-900 mb-2">Real-time Translation</h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">Break language barriers instantly. Translate incoming messages into your native language with a single tap.</p>
                <div className="mt-auto bg-slate-100 p-4 rounded-2xl flex flex-col gap-2 relative">
                  <div className="text-xs font-medium text-slate-700 bg-white p-2 rounded-lg border border-slate-200 shadow-sm self-start">Bonjour, comment ça va?</div>
                  <div className="text-[10px] font-bold text-indigo-500 flex items-center gap-1 self-start ml-2"><Globe className="w-3 h-3"/> Translated to English</div>
                  <div className="text-xs font-medium text-slate-700 bg-indigo-50 p-2 rounded-lg border border-indigo-100 shadow-sm self-start">Hello, how are you?</div>
                </div>
              </div>

              {/* Widget 2: Read Receipts (Col 4) */}
              <div className="col-span-12 md:col-span-4 bg-white/80 backdrop-blur-xl border border-white shadow-xl shadow-slate-200/40 rounded-[2rem] p-8 flex flex-col hover:-translate-y-1 transition-transform group">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-500 mb-6 border border-blue-100">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="font-black text-xl text-slate-900 mb-2">Detailed Read Receipts</h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">Know exactly when your message is delivered and read. Complete visibility into your chat status.</p>
                <div className="mt-auto space-y-3">
                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-600">Sent</span>
                    <CheckCircle2 className="w-4 h-4 text-slate-400" />
                  </div>
                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-600">Delivered</span>
                    <div className="flex -space-x-1"><CheckCircle2 className="w-4 h-4 text-slate-400" /><CheckCircle2 className="w-4 h-4 text-slate-400" /></div>
                  </div>
                  <div className="flex items-center justify-between bg-blue-50 p-3 rounded-xl border border-blue-200 shadow-sm">
                    <span className="text-xs font-black text-blue-700">Read</span>
                    <div className="flex -space-x-1"><CheckCircle2 className="w-4 h-4 text-blue-500" /><CheckCircle2 className="w-4 h-4 text-blue-500" /></div>
                  </div>
                </div>
              </div>

              {/* Widget 3: Chat Polls (Col 4) */}
              <div className="col-span-12 md:col-span-4 bg-white/80 backdrop-blur-xl border border-white shadow-xl shadow-slate-200/40 rounded-[2rem] p-8 flex flex-col hover:-translate-y-1 transition-transform group">
                <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-purple-500 mb-6 border border-purple-100">
                  <BarChart2 className="w-6 h-6" />
                </div>
                <h4 className="font-black text-xl text-slate-900 mb-2">Interactive Polls</h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">Make group decisions easily. Create polls directly in your chats to gather opinions fast.</p>
                <div className="mt-auto bg-slate-100 p-4 rounded-2xl">
                  <div className="text-xs font-bold text-slate-800 mb-3">Where should we eat tonight?</div>
                  <div className="space-y-2">
                    <div className="relative h-8 bg-white rounded-lg overflow-hidden border border-slate-200 flex items-center px-3">
                      <div className="absolute left-0 top-0 bottom-0 bg-purple-200 w-[70%]"></div>
                      <span className="relative z-10 text-[11px] font-bold text-slate-800">🍕 Pizza (7)</span>
                    </div>
                    <div className="relative h-8 bg-white rounded-lg overflow-hidden border border-slate-200 flex items-center px-3">
                      <div className="absolute left-0 top-0 bottom-0 bg-slate-200 w-[30%]"></div>
                      <span className="relative z-10 text-[11px] font-bold text-slate-800">🍣 Sushi (3)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2 */}
              {/* Widget 4: Screen Sharing (Col 7) */}
              <div className="col-span-12 md:col-span-7 bg-white/80 backdrop-blur-xl border border-white shadow-xl shadow-slate-200/40 rounded-[2rem] p-8 flex flex-col justify-between hover:-translate-y-1 transition-transform group relative overflow-hidden">
                <div className="absolute right-0 bottom-0 w-64 h-64 bg-cyan-500 rounded-full blur-[80px] opacity-10"></div>
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-cyan-50 flex items-center justify-center text-cyan-500 mb-6 border border-cyan-100">
                    <MonitorUp className="w-6 h-6" />
                  </div>
                  <h4 className="font-black text-2xl text-slate-900 mb-2">High-Res Screen Sharing</h4>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-sm">
                    Share your screen during voice and video calls. Perfect for presenting documents, troubleshooting, or watching videos together.
                  </p>
                </div>
                <div className="mt-8 bg-slate-900 rounded-2xl p-2 relative shadow-lg shadow-slate-900/20 overflow-hidden h-40">
                  <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
                    <BarChart2 className="w-16 h-16 text-cyan-400 opacity-20" />
                    <span className="absolute bottom-4 text-cyan-400 font-bold text-xs bg-black/40 px-3 py-1 rounded-full backdrop-blur-md border border-cyan-500/30">You are sharing your screen</span>
                  </div>
                  <div className="absolute top-2 right-2 w-20 h-28 bg-slate-700 border-2 border-slate-900 rounded-xl overflow-hidden">
                     <img src="https://i.pravatar.cc/100?img=32" alt="Webcam" className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>

              {/* Widget 5: Cloud Backup (Col 5) */}
              <div className="col-span-12 md:col-span-5 bg-white/80 backdrop-blur-xl border border-white shadow-xl shadow-slate-200/40 rounded-[2rem] p-8 flex flex-col hover:-translate-y-1 transition-transform group">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500 mb-6 border border-emerald-100">
                  <Cloud className="w-6 h-6" />
                </div>
                <h4 className="font-black text-xl text-slate-900 mb-2">Seamless Cloud Backup</h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">Never lose a memory. Securely back up your entire chat history and media to your preferred cloud storage provider.</p>
                <div className="mt-auto bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-xs font-bold text-emerald-800">Backing up chats...</span>
                    <span className="text-xl font-black text-emerald-600">78%</span>
                  </div>
                  <div className="h-2 w-full bg-emerald-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 w-[78%] rounded-full relative overflow-hidden">
                      <div className="absolute inset-0 bg-white/30 animate-pulse"></div>
                    </div>
                  </div>
                  <div className="text-[10px] font-bold text-emerald-600/70 mt-2">1.2 GB of 1.5 GB uploaded</div>
                </div>
              </div>

              {/* Row 3 */}
              {/* Widget 6: Starred Messages (Col 4) */}
              <div className="col-span-12 md:col-span-4 bg-white/80 backdrop-blur-xl border border-white shadow-xl shadow-slate-200/40 rounded-[2rem] p-8 flex flex-col hover:-translate-y-1 transition-transform group">
                <div className="w-12 h-12 rounded-2xl bg-yellow-50 flex items-center justify-center text-yellow-500 mb-6 border border-yellow-100">
                  <Star className="w-6 h-6 fill-current" />
                </div>
                <h4 className="font-black text-xl text-slate-900 mb-2">Starred Messages</h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">Bookmark important addresses, links, or messages to easily find them later in a dedicated folder.</p>
                <div className="mt-auto bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col gap-2 relative">
                  <div className="absolute -top-3 -right-3 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg shadow-yellow-400/30 text-white animate-bounce"><Star className="w-4 h-4 fill-current"/></div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saved Message</span>
                  <p className="text-xs font-bold text-slate-800 leading-relaxed">"The gate code is 4829# and the spare key is under the blue pot."</p>
                </div>
              </div>

              {/* Widget 7: Broadcast Lists (Col 4) */}
              <div className="col-span-12 md:col-span-4 bg-white/80 backdrop-blur-xl border border-white shadow-xl shadow-slate-200/40 rounded-[2rem] p-8 flex flex-col hover:-translate-y-1 transition-transform group">
                <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center text-orange-500 mb-6 border border-orange-100">
                  <Megaphone className="w-6 h-6" />
                </div>
                <h4 className="font-black text-xl text-slate-900 mb-2">Broadcast Lists</h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">Send announcements to multiple people at once, while keeping their replies entirely private.</p>
                <div className="mt-auto bg-orange-50 border border-orange-100 rounded-2xl p-4 flex flex-col items-center justify-center">
                  <div className="flex -space-x-3 mb-3">
                    <img src="https://i.pravatar.cc/100?img=1" alt="Avatar" className="w-8 h-8 rounded-full border-2 border-orange-50" />
                    <img src="https://i.pravatar.cc/100?img=2" alt="Avatar" className="w-8 h-8 rounded-full border-2 border-orange-50" />
                    <img src="https://i.pravatar.cc/100?img=3" alt="Avatar" className="w-8 h-8 rounded-full border-2 border-orange-50" />
                    <img src="https://i.pravatar.cc/100?img=4" alt="Avatar" className="w-8 h-8 rounded-full border-2 border-orange-50" />
                    <div className="w-8 h-8 rounded-full bg-orange-200 border-2 border-orange-50 flex items-center justify-center text-[10px] font-black text-orange-700">+12</div>
                  </div>
                  <div className="bg-white px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-700 shadow-sm border border-orange-100 flex items-center gap-2">
                    <Megaphone className="w-3 h-3 text-orange-500" /> Sending to 16 contacts
                  </div>
                </div>
              </div>

              {/* Widget 8: Dark Mode Preview (Col 4) */}
              <div className="col-span-12 md:col-span-4 bg-white/80 backdrop-blur-xl border border-white shadow-xl shadow-slate-200/40 rounded-[2rem] p-8 flex flex-col hover:-translate-y-1 transition-transform group">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white mb-6 border border-slate-700">
                  <Moon className="w-6 h-6" />
                </div>
                <h4 className="font-black text-xl text-slate-900 mb-2">True Dark Mode</h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">Give your eyes a rest. Switch to a beautifully crafted dark mode that saves battery on OLED screens.</p>
                <div className="mt-auto bg-slate-900 rounded-2xl p-4 shadow-inner border border-slate-800">
                  <div className="flex justify-between items-center mb-4">
                    <div className="text-xs font-bold text-slate-300">Appearance</div>
                    <div className="w-10 h-5 bg-indigo-500 rounded-full relative"><div className="w-4 h-4 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div></div>
                  </div>
                  <div className="bg-slate-800 p-2 rounded-lg text-[10px] font-medium text-slate-400">Wow, this dark mode looks incredibly sleek! 🌙</div>
                </div>
              </div>

              {/* Row 4 */}
              {/* Widget 9: Animated Typing Indicators (Col 5) */}
              <div className="col-span-12 md:col-span-5 bg-white/80 backdrop-blur-xl border border-white shadow-xl shadow-slate-200/40 rounded-[2rem] p-8 flex flex-col hover:-translate-y-1 transition-transform group relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500 rounded-full blur-[80px] opacity-10"></div>
                 <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center text-rose-500 mb-6 border border-rose-100 z-10">
                  <MessageCircle className="w-6 h-6" />
                </div>
                <h4 className="font-black text-xl text-slate-900 mb-2 z-10">Real-time Typing Indicators</h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6 z-10">Know when your friends are replying. Smooth, non-intrusive typing indicators bring conversations to life.</p>
                <div className="mt-auto bg-slate-100 p-4 rounded-2xl z-10 w-max border border-slate-200">
                  <div className="flex items-center gap-1 text-slate-400">
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></div>
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
                  </div>
                </div>
              </div>

              {/* Widget 10: Rich Link Previews (Col 7) */}
              <div className="col-span-12 md:col-span-7 bg-white/80 backdrop-blur-xl border border-white shadow-xl shadow-slate-200/40 rounded-[2rem] p-8 flex flex-col hover:-translate-y-1 transition-transform group relative overflow-hidden">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 mb-6 border border-indigo-100 z-10">
                  <LinkIcon className="w-6 h-6" />
                </div>
                <div className="flex flex-col md:flex-row gap-8 items-start">
                  <div className="flex-1 z-10">
                    <h4 className="font-black text-2xl text-slate-900 mb-2">Rich URL Previews</h4>
                    <p className="text-sm text-slate-500 font-medium leading-relaxed">
                      Instantly see what a link is about before you click. We automatically generate beautiful, informative preview cards for websites, tweets, and videos directly inside your chats.
                    </p>
                  </div>
                  <div className="w-full md:w-64 bg-slate-50 rounded-xl border border-slate-200 overflow-hidden shadow-md z-10 shrink-0 group-hover:shadow-lg transition-shadow">
                    <div className="h-24 bg-gradient-to-br from-indigo-500 to-purple-500 relative">
                      <div className="absolute inset-0 flex items-center justify-center opacity-20"><Globe className="w-12 h-12 text-white" /></div>
                    </div>
                    <div className="p-3 bg-white">
                      <div className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">Example.com</div>
                      <div className="text-xs font-bold text-slate-800 mb-1 leading-tight">Check out our new stunning redesign</div>
                      <div className="text-[10px] text-slate-500 leading-tight">Explore the beautifully crafted interface designed for modern users.</div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* 10-WIDGET FULLY CUSTOM SECTION */}
        <section className="py-24 relative overflow-hidden bg-white">
          <div className="max-w-7xl mx-auto px-6 md:px-12 space-y-12">
            
            <div className="text-center max-w-2xl mx-auto space-y-4">
              <h2 className="text-[10.5px] font-black tracking-widest uppercase text-indigo-500">Unmatched Power</h2>
              <h3 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 leading-tight">Beyond ordinary messaging.</h3>
            </div>

            <div className="grid grid-cols-12 gap-6">
              
              {/* Widget 1: AI Chat Assistant (Col 5) */}
              <div className="col-span-12 md:col-span-5 bg-slate-50 border border-slate-200 rounded-[2rem] p-8 flex flex-col hover:-translate-y-1 transition-transform group relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-indigo-500/5 to-purple-500/5 z-0"></div>
                <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 mb-6 border border-indigo-200 z-10">
                  <Bot className="w-6 h-6" />
                </div>
                <h4 className="font-black text-xl text-slate-900 mb-2 z-10">AI Chat Assistant</h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6 z-10">Summarize long chats, translate instantly, or draft replies using our built-in intelligence.</p>
                <div className="mt-auto flex flex-col gap-3 z-10">
                  <div className="bg-indigo-600 text-white text-xs font-medium p-3 rounded-2xl rounded-tr-sm self-end shadow-md">@AI summarize the last 50 messages.</div>
                  <div className="bg-white border border-slate-200 text-slate-800 text-xs font-medium p-3 rounded-2xl rounded-tl-sm self-start shadow-sm flex flex-col gap-2 relative">
                    <div className="absolute -left-2 -top-2 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center border-2 border-white"><Bot className="w-3 h-3 text-white"/></div>
                    <span className="font-bold text-indigo-500 text-[10px] ml-2">Assistant</span>
                    <span>Here's the summary:<br/>• Sarah booked the flights<br/>• Dinner is at 8 PM<br/>• John is bringing the cake</span>
                  </div>
                </div>
              </div>

              {/* Widget 2: Instant Video Notes (Col 7) */}
              <div className="col-span-12 md:col-span-7 bg-slate-900 border border-slate-800 rounded-[2rem] p-8 flex flex-col md:flex-row justify-between hover:-translate-y-1 transition-transform group relative overflow-hidden text-white">
                <div className="absolute right-0 bottom-0 w-64 h-64 bg-cyan-500 rounded-full blur-[100px] opacity-20"></div>
                <div className="relative z-10 flex-1 md:pr-8">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 flex items-center justify-center text-cyan-400 mb-6 border border-cyan-500/30">
                    <Video className="w-6 h-6" />
                  </div>
                  <h4 className="font-black text-2xl mb-2">Instant Video Notes</h4>
                  <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-sm">
                    Sometimes voice isn't enough. Tap and hold to record an instant circular video note to share moments perfectly.
                  </p>
                </div>
                <div className="mt-8 md:mt-0 flex items-center justify-center z-10">
                   <div className="relative w-40 h-40 rounded-full border-4 border-cyan-500 overflow-hidden shadow-2xl shadow-cyan-500/30">
                      <img src="https://i.pravatar.cc/200?img=12" alt="Video Note" className="w-full h-full object-cover" />
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-2 border border-white/10">
                        <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                        <span className="text-[10px] font-bold">0:14</span>
                      </div>
                   </div>
                </div>
              </div>

              {/* Row 2 */}
              {/* Widget 3: Media Editor Tools (Col 4) */}
              <div className="col-span-12 md:col-span-4 bg-slate-50 border border-slate-200 rounded-[2rem] p-8 flex flex-col hover:-translate-y-1 transition-transform group">
                <div className="w-12 h-12 rounded-2xl bg-pink-100 flex items-center justify-center text-pink-600 mb-6 border border-pink-200">
                  <PenTool className="w-6 h-6" />
                </div>
                <h4 className="font-black text-xl text-slate-900 mb-2">Built-in Media Editor</h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">Crop, draw, blur sensitive information, and add text or stickers before sending photos.</p>
                <div className="mt-auto bg-slate-200 rounded-2xl p-2 h-32 relative overflow-hidden">
                  <img src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&h=200&fit=crop" alt="Editor" className="w-full h-full object-cover rounded-xl" />
                  <div className="absolute top-4 right-4 flex flex-col gap-2 bg-black/60 backdrop-blur-md p-1.5 rounded-xl border border-white/20">
                     <div className="w-6 h-6 hover:bg-white/20 rounded-lg flex items-center justify-center text-white"><PenTool className="w-3 h-3"/></div>
                     <div className="w-6 h-6 hover:bg-white/20 rounded-lg flex items-center justify-center text-white font-black text-xs">T</div>
                     <div className="w-6 h-6 hover:bg-white/20 rounded-lg flex items-center justify-center text-white"><Smile className="w-3 h-3"/></div>
                  </div>
                </div>
              </div>

              {/* Widget 4: Scheduled Messages (Col 4) */}
              <div className="col-span-12 md:col-span-4 bg-slate-50 border border-slate-200 rounded-[2rem] p-8 flex flex-col hover:-translate-y-1 transition-transform group">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 mb-6 border border-emerald-200">
                  <CalendarClock className="w-6 h-6" />
                </div>
                <h4 className="font-black text-xl text-slate-900 mb-2">Schedule Messages</h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">Never forget a birthday again. Write now, pick a date and time, and we'll deliver it automatically.</p>
                <div className="mt-auto space-y-2">
                  <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm text-xs font-medium text-slate-800">
                    Happy Birthday! 🎉 Hope you have an amazing day!
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold p-2 rounded-lg flex items-center gap-2 w-max">
                    <CalendarClock className="w-3 h-3" /> Scheduled for Tomorrow, 09:00 AM
                  </div>
                </div>
              </div>

              {/* Widget 5: Chat Folders (Col 4) */}
              <div className="col-span-12 md:col-span-4 bg-slate-50 border border-slate-200 rounded-[2rem] p-8 flex flex-col hover:-translate-y-1 transition-transform group">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 mb-6 border border-amber-200">
                  <Folder className="w-6 h-6 fill-current" />
                </div>
                <h4 className="font-black text-xl text-slate-900 mb-2">Chat Folders</h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">Separate your work, family, and social circles. Create custom tabs to keep your inbox hyper-organized.</p>
                <div className="mt-auto bg-white border border-slate-200 rounded-xl p-2 shadow-sm flex gap-2 overflow-x-hidden">
                  <div className="bg-amber-100 text-amber-800 font-bold text-[10px] px-3 py-1.5 rounded-full whitespace-nowrap">All Chats</div>
                  <div className="bg-slate-100 text-slate-600 font-bold text-[10px] px-3 py-1.5 rounded-full whitespace-nowrap">Work <span className="bg-amber-500 text-white px-1.5 rounded-full ml-1">3</span></div>
                  <div className="bg-slate-100 text-slate-600 font-bold text-[10px] px-3 py-1.5 rounded-full whitespace-nowrap">Family</div>
                </div>
              </div>

              {/* Row 3 */}
              {/* Widget 6: Advanced Location Tracker (Col 7) */}
              <div className="col-span-12 md:col-span-7 bg-slate-50 border border-slate-200 rounded-[2rem] p-8 flex flex-col justify-between hover:-translate-y-1 transition-transform group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-green-500 rounded-full blur-[80px] opacity-10"></div>
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center text-green-600 mb-6 border border-green-200 z-10 relative">
                    <Map className="w-6 h-6" />
                  </div>
                  <h4 className="font-black text-2xl text-slate-900 mb-2 z-10 relative">Live Location Tracking</h4>
                  <p className="text-sm text-slate-500 font-medium leading-relaxed max-w-md z-10 relative">
                    Share your real-time movement with friends or family. Perfect for meetups, safety, or just letting them know you're almost there.
                  </p>
                </div>
                <div className="mt-8 bg-slate-200 rounded-2xl h-40 relative overflow-hidden shadow-inner border border-slate-300">
                  <div className="absolute inset-0 opacity-40 bg-[url('https://www.transparenttextures.com/patterns/cartographer.png')]"></div>
                  <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-1.5 bg-green-500/30 rounded-full overflow-hidden">
                    <div className="h-full w-[60%] bg-green-500 rounded-full"></div>
                  </div>
                  <div className="absolute left-[58%] top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center">
                    <div className="bg-white p-1 rounded-full shadow-lg shadow-black/20 mb-1 z-10 relative">
                      <img src="https://i.pravatar.cc/100?img=5" alt="Avatar" className="w-8 h-8 rounded-full" />
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full flex items-center justify-center"><MapPin className="w-2 h-2 text-white"/></div>
                    </div>
                    <div className="bg-slate-900 text-white text-[9px] font-bold px-2 py-1 rounded-md whitespace-nowrap shadow-md">ETA: 4 mins</div>
                  </div>
                </div>
              </div>

              {/* Widget 7: Rich Contact Cards (Col 5) */}
              <div className="col-span-12 md:col-span-5 bg-slate-50 border border-slate-200 rounded-[2rem] p-8 flex flex-col hover:-translate-y-1 transition-transform group">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 mb-6 border border-blue-200">
                  <Contact className="w-6 h-6" />
                </div>
                <h4 className="font-black text-xl text-slate-900 mb-2">Rich Contact Cards</h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">Share complete contact profiles securely within chats. Add them to your phonebook with a single tap.</p>
                <div className="mt-auto bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-4">
                    <img src="https://i.pravatar.cc/100?img=8" alt="Contact" className="w-12 h-12 rounded-full" />
                    <div>
                      <div className="font-bold text-slate-900 text-sm">Michael Scott</div>
                      <div className="text-[10px] font-medium text-slate-500">Regional Manager</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-blue-50 text-blue-600 font-bold text-[10px] py-2 rounded-lg text-center cursor-pointer hover:bg-blue-100 transition-colors">Add Contact</div>
                    <div className="flex-1 bg-slate-100 text-slate-700 font-bold text-[10px] py-2 rounded-lg text-center cursor-pointer hover:bg-slate-200 transition-colors">Message</div>
                  </div>
                </div>
              </div>

              {/* Row 4 */}
              {/* Widget 8: Ghost Mode (Col 4) */}
              <div className="col-span-12 md:col-span-4 bg-slate-900 border border-slate-800 rounded-[2rem] p-8 flex flex-col hover:-translate-y-1 transition-transform group text-white">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center text-slate-300 mb-6 border border-slate-700">
                  <Ghost className="w-6 h-6" />
                </div>
                <h4 className="font-black text-xl mb-2">Ghost Mode</h4>
                <p className="text-sm text-slate-400 font-medium leading-relaxed mb-6">Need complete privacy? Freeze your 'last seen', hide your online status, and read messages invisibly.</p>
                <div className="mt-auto bg-slate-800 p-4 rounded-xl border border-slate-700">
                  <div className="flex justify-between items-center">
                    <div className="text-xs font-bold text-slate-200 flex items-center gap-2"><Ghost className="w-3 h-3 text-slate-400"/> Invisible Status</div>
                    <div className="w-10 h-5 bg-indigo-500 rounded-full relative"><div className="w-4 h-4 bg-white rounded-full absolute right-0.5 top-0.5 shadow-sm"></div></div>
                  </div>
                </div>
              </div>

              {/* Widget 9: Community Channels (Col 4) */}
              <div className="col-span-12 md:col-span-4 bg-slate-50 border border-slate-200 rounded-[2rem] p-8 flex flex-col hover:-translate-y-1 transition-transform group">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600 mb-6 border border-purple-200">
                  <Hash className="w-6 h-6" />
                </div>
                <h4 className="font-black text-xl text-slate-900 mb-2">Community Channels</h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">Host massive communities. Organize topics into sub-channels like Slack or Discord, but much simpler.</p>
                <div className="mt-auto bg-white border border-slate-200 p-3 rounded-xl shadow-sm flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 p-2 rounded-lg"><Hash className="w-3 h-3"/> announcements</div>
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:bg-slate-50 p-2 rounded-lg transition-colors cursor-pointer"><Hash className="w-3 h-3 text-slate-400"/> general-chat</div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-600 hover:bg-slate-50 p-2 rounded-lg transition-colors cursor-pointer">
                    <div className="flex items-center gap-2"><Hash className="w-3 h-3 text-slate-400"/> events</div>
                    <div className="bg-rose-500 text-white text-[9px] px-1.5 rounded-full">2</div>
                  </div>
                </div>
              </div>

              {/* Widget 10: Call Backgrounds (Col 4) */}
              <div className="col-span-12 md:col-span-4 bg-slate-50 border border-slate-200 rounded-[2rem] p-8 flex flex-col hover:-translate-y-1 transition-transform group overflow-hidden relative">
                <div className="w-12 h-12 rounded-2xl bg-rose-100 flex items-center justify-center text-rose-600 mb-6 border border-rose-200 z-10 relative">
                  <ImagePlus className="w-6 h-6" />
                </div>
                <h4 className="font-black text-xl text-slate-900 mb-2 z-10 relative">Call Backgrounds</h4>
                <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6 z-10 relative">Hide a messy room instantly. Blur your background or upload custom images during video calls.</p>
                <div className="mt-auto h-32 rounded-2xl relative overflow-hidden border border-slate-200 z-10 shadow-sm">
                   <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=300&fit=crop')] bg-cover bg-center blur-sm scale-110"></div>
                   <div className="absolute inset-0 flex items-center justify-center">
                     <img src="https://i.pravatar.cc/200?img=47" alt="Person" className="h-full object-cover rounded-2xl" />
                   </div>
                   <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-md px-2 py-1 rounded-md text-[9px] font-bold text-white flex items-center gap-1">
                     <MonitorOff className="w-2 h-2" /> Blur Active
                   </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* SECURITY HIGHLIGHT SECTION */}
        <section id="security" className="py-24 relative">
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <div className="bg-slate-900 rounded-[3rem] p-12 md:p-16 flex flex-col md:flex-row items-center justify-between gap-12 shadow-2xl shadow-slate-900/20 relative overflow-hidden">
              
              {/* Background accent */}
              <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-[100px] pointer-events-none"></div>

              <div className="md:w-1/2 space-y-6 relative z-10 text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/10 text-white">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] font-black tracking-widest uppercase">Privacy First</span>
                </div>
                <h3 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-tight">
                  Speak freely. <br/> We can't hear you.
                </h3>
                <p className="text-slate-400 font-medium leading-relaxed max-w-md">
                  Chatappey secures your conversations with advanced end-to-end encryption. Your messages and calls stay between you and the people you choose. Nobody in between can read them.
                </p>
                <Link to="/signup" className="inline-flex items-center gap-2 text-white font-bold hover:text-indigo-400 transition-colors pt-4">
                  Learn about our security <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="md:w-1/2 flex justify-center relative z-10">
                <div className="w-64 h-64 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-full flex items-center justify-center p-2 shadow-2xl shadow-indigo-500/30">
                  <div className="w-full h-full bg-slate-900 rounded-full flex flex-col items-center justify-center border-4 border-slate-900 text-center px-8 space-y-2 relative overflow-hidden">
                    <Lock className="w-10 h-10 text-emerald-400 mb-2" />
                    <span className="text-white font-black tracking-tight text-lg leading-tight">Secured Chat</span>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">AES-256</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* TESTIMONIALS SECTION */}
        <section className="py-24 relative">
          <div className="max-w-7xl mx-auto px-6 md:px-12 space-y-12">
            
            <div className="text-center max-w-2xl mx-auto space-y-4">
              <h2 className="text-[10.5px] font-black tracking-widest uppercase text-indigo-500">Wall of Love</h2>
              <h3 className="text-4xl font-black tracking-tighter text-slate-900">Loved by teams & families</h3>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                { name: "Emily R.", role: "Designer", text: "The cleanest messaging app I've ever used. The video calls connect instantly and never lag, even when I'm on public wifi.", rating: 5, avatar: "https://i.pravatar.cc/150?img=44" },
                { name: "David T.", role: "Developer", text: "Knowing that everything is fully end-to-end encrypted by default gives me complete peace of mind. It's my go-to for secure team chats.", rating: 5, avatar: "https://i.pravatar.cc/150?img=53" },
                { name: "Jessica W.", role: "Photographer", text: "I share massive photo albums with my clients here. The media sharing doesn't compress my photos into pixelated messes like other apps do.", rating: 5, avatar: "https://i.pravatar.cc/150?img=16" }
              ].map((testimonial, i) => (
                <div key={i} className="bg-white/80 backdrop-blur-xl border border-white shadow-xl shadow-slate-200/40 p-8 rounded-[2rem] text-left hover:-translate-y-2 transition-transform">
                  <div className="flex gap-1 mb-6">
                    {[...Array(testimonial.rating)].map((_, j) => <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />)}
                  </div>
                  <p className="text-sm text-slate-600 font-medium leading-relaxed mb-8">"{testimonial.text}"</p>
                  <div className="flex items-center gap-3">
                    <img src={testimonial.avatar} alt={testimonial.name} className="w-10 h-10 rounded-full border border-slate-200" />
                    <div>
                      <div className="font-bold text-slate-900 text-sm">{testimonial.name}</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{testimonial.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ ACCORDION SECTION */}
        <section id="faq" className="py-24 relative">
          <div className="max-w-3xl mx-auto px-6 space-y-12">
            
            <div className="text-center space-y-4">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Frequently Asked Questions</h2>
              <p className="text-sm text-slate-500 font-medium">Everything you need to know about getting started.</p>
            </div>

            <div className="space-y-4 text-left">
              {[
                { q: "Is the app completely free to use?", a: "Yes, downloading and using the app for messaging and calling is completely free over your internet connection." },
                { q: "Can I use it on multiple devices?", a: "Absolutely! You can log into your account via the Web application on your laptop while keeping your session active on your phone." },
                { q: "How secure is my data?", a: "We utilize AES-256 end-to-end encryption. Your messages are encrypted on your device and decrypted only on the recipient's device." },
                { q: "Do you compress my photos?", a: "We apply light, lossless compression by default to save your data, but you can always toggle 'HD Quality' to send original resolution images." }
              ].map((faq, i) => (
                <div key={i} className="bg-white/70 backdrop-blur-xl border border-white shadow-md shadow-slate-200/40 rounded-2xl overflow-hidden">
                  <button 
                    onClick={() => setActiveFaq(activeFaq === i ? -1 : i)}
                    className="w-full flex justify-between items-center p-5 font-black text-sm text-slate-800 focus:outline-none hover:bg-white/50 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${activeFaq === i ? 'rotate-90' : ''}`} />
                  </button>
                  {activeFaq === i && (
                    <div className="px-5 pb-5 pt-1">
                      <p className="text-sm text-slate-600 font-medium leading-relaxed border-t border-slate-100 pt-4 animate-scale-in">
                        {faq.a}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

          </div>
        </section>

        {/* BOTTOM CTA BANNER */}
        <section className="py-12 mb-12 relative px-6 md:px-12">
          <div className="max-w-5xl mx-auto bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-[3rem] p-12 md:p-16 text-center shadow-2xl shadow-indigo-600/30 border border-white/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-3xl pointer-events-none"></div>
            
            <h3 className="text-4xl md:text-5xl font-black text-white tracking-tighter mb-6 relative z-10">
              Ready to start chatting?
            </h3>
            <p className="text-indigo-100 font-medium max-w-lg mx-auto mb-10 relative z-10">
              Join millions of users who trust Chatappey for their daily secure communication needs.
            </p>
            <Link to="/signup" className="inline-flex h-14 px-10 rounded-2xl bg-white text-indigo-600 hover:bg-indigo-50 font-black text-sm items-center justify-center gap-2 shadow-xl shadow-black/10 hover:shadow-2xl hover:shadow-black/20 hover:-translate-y-1 transition-all relative z-10">
              Create Free Account <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>

      </main>

      {/* MODERN FOOTER */}
      <footer className="bg-white border-t border-slate-200 pt-20 pb-10 px-6 md:px-12 relative z-10 mt-auto">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-8 mb-16">
          
          {/* Brand Column */}
          <div className="md:col-span-12 lg:col-span-4 flex flex-col items-start">
            <Link to="/" className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-black tracking-tight text-slate-900">Chatappey</span>
            </Link>
            <p className="text-sm font-medium text-slate-500 leading-relaxed max-w-sm mb-8">
              The next-generation secure messaging platform built for modern teams and communities. Communicate freely without compromise.
            </p>
            <div className="flex gap-3">
              {['Twitter', 'LinkedIn', 'GitHub', 'Instagram'].map(social => (
                <a key={social} href="#" className="w-10 h-10 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center hover:bg-slate-900 hover:border-slate-900 hover:text-white transition-all text-xs font-black text-slate-600 shadow-sm">
                  {social.charAt(0)}
                </a>
              ))}
            </div>
          </div>

          {/* Links Columns */}
          <div className="md:col-span-4 lg:col-span-2 lg:col-start-6">
            <h5 className="font-black text-slate-900 mb-6">Product</h5>
            <ul className="space-y-4 text-sm font-medium text-slate-500">
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Features</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Security</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Business</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Download Mac</a></li>
            </ul>
          </div>

          <div className="md:col-span-4 lg:col-span-2">
            <h5 className="font-black text-slate-900 mb-6">Resources</h5>
            <ul className="space-y-4 text-sm font-medium text-slate-500">
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Community</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Developers</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Status</a></li>
            </ul>
          </div>

          <div className="md:col-span-4 lg:col-span-2">
            <h5 className="font-black text-slate-900 mb-6">Legal</h5>
            <ul className="space-y-4 text-sm font-medium text-slate-500">
              <li><Link to="/privacy" className="hover:text-indigo-600 transition-colors">Privacy Policy</Link></li>
              <li><Link to="/terms" className="hover:text-indigo-600 transition-colors">Terms of Service</Link></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Cookie Policy</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Guidelines</a></li>
            </ul>
          </div>

        </div>
        
        {/* Bottom Bar */}
        <div className="max-w-7xl mx-auto pt-8 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-slate-400 font-bold text-xs order-3 md:order-1">
            © {new Date().getFullYear()} Chatappey Inc. All rights reserved.
          </p>
          
          <div className="bg-slate-50 border border-slate-200 px-4 py-2 rounded-full flex items-center justify-center order-1 md:order-2">
            <span className="text-slate-500 font-bold text-[10px] tracking-widest uppercase">Created by <span className="text-slate-900">Sahil Kumar Sahoo</span></span>
          </div>

          <div className="order-2 md:order-3">
            <a href="mailto:chatappey@gmail.com" className="inline-flex items-center gap-2 text-[11px] font-black text-white bg-slate-900 hover:bg-indigo-600 transition-colors px-5 py-2.5 rounded-full shadow-lg shadow-slate-900/20">
              Contact Developer
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default LandingPage;
