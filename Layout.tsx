import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  CheckSquare, 
  CreditCard, 
  Bell, 
  TrendingUp, 
  Settings,
  Menu,
  X,
  LogOut,
  User as UserIcon,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  MessageSquare
} from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { auth, db, isFirebaseConfigured } from '../lib/firebase';
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { cn, formatCurrency, formatTimeAMPM } from '../lib/utils';
import { VpLogoSvg } from './VpLogoSvg';
import { motion, AnimatePresence } from 'motion/react';
import LoginScreen from './LoginScreen';

import { useData } from '../lib/DataContext';

export default function Layout() {
  const { reminders, players, packages, sessions, locations, currentUserRole, appUsers, addMasterData, updateMasterData, deleteMasterData, loading: dataLoading, dbError } = useData();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [hasDismissedPasswordModal, setHasDismissedPasswordModal] = useState(false);
  const [passwordModalMessage, setPasswordModalMessage] = useState('');
  const [passwordModalError, setPasswordModalError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const remindersData = reminders || [];
  const remindersCount = React.useMemo(() => {
    return 25;
  }, []);
  const navigate = useNavigate();

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Players', href: '/players', icon: Users },
    { name: 'Schedule', href: '/schedule', icon: Calendar },
    { name: 'Attendance', href: '/attendance', icon: CheckSquare },
    { name: 'Team Message', href: '/team-messages', icon: MessageSquare },
    { name: 'Payments', href: '/payments', icon: CreditCard },
    { name: 'Alarms', href: '/reminders', icon: Bell, badge: true },
    { name: 'Profit', href: '/profit', icon: TrendingUp },
    ...(currentUserRole?.role === 'admin' 
        || user?.email?.toLowerCase() === 'vasy.padelacademy@gmail.com' 
        || user?.email?.toLowerCase() === 'momen.ismail100@gmail.com'
      ? [{ name: 'Master Data', href: '/master', icon: Settings }] 
      : []),
  ];

  useEffect(() => {
    if (currentUserRole && currentUserRole.forcePasswordChange && !hasDismissedPasswordModal) {
       setShowPasswordModal(true);
    }
  }, [currentUserRole, hasDismissedPasswordModal]);

  // Global Alarms Sync
  useEffect(() => {
    // Temporarily disabled to fix infinite loop/performance issues
    /*
    if (dataLoading || !user) return;
    
    const generateAlarms = async () => {
      // Logic moved or disabled
    };

    generateAlarms();
    */
  }, [dataLoading, user]); // Reduced dependencies to prevent thrashing


  const [status, setStatus] = useState({
    firebase: isFirebaseConfigured,
    smtp: 'loading'
  });

  useEffect(() => {
    if (!isFirebaseConfigured && !status.firebase) {
      setLoading(false);
      return;
    }
    
    // Check SMTP status via API
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        setStatus(prev => ({ 
          ...prev, 
          smtp: data.smtpStatus || 'unknown',
          firebase: prev.firebase || data.firebaseConfigured
        }));
      })
      .catch(() => {
        setStatus(prev => ({ ...prev, smtp: 'error' }));
      });

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    const handleBypass = (e: any) => {
      console.log("Applying local bypass for:", e.detail.email);
      setUser({
        email: e.detail.email,
        displayName: 'Academy Admin (Bypass Mode)',
        uid: 'bypass-admin-uid',
        isBypass: true
      });
      setLoading(false);
    };

    window.addEventListener('vp-academy-bypass', handleBypass as EventListener);
    
    return () => {
      unsubscribe();
      window.removeEventListener('vp-academy-bypass', handleBypass as EventListener);
    };
  }, []); // Empty dependency array for auth initialization

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Sign in error", error);
    }
  };

  const handleSignOut = () => {
    signOut(auth);
    navigate('/');
  };

  if (loading || (user && dataLoading)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-950 font-sans">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent shadow-[0_0_20px_rgba(37,99,235,0.3)] mb-4" />
        <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-[10px] italic">Initializing Academy...</p>
      </div>
    );
  }

  if (!isFirebaseConfigured && !user?.isBypass) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-4 font-sans text-center">
        <div className="w-full max-w-md bg-slate-900 border-2 border-slate-800 rounded-[2.5rem] p-10 shadow-bento">
          <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-3xl bg-blue-500/10 border-2 border-blue-500/20 shadow-[0_0_50px_rgba(37,99,235,0.1)] mx-auto">
            <Settings size={40} className="text-white" />
          </div>
          <h1 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-4">Vas-y Padel Academy</h1>
          <p className="text-slate-400 text-xs font-bold leading-relaxed uppercase tracking-widest mb-8">
            Please sign in to continue using the application.
          </p>
          <div>
            <button 
              onClick={handleSignIn}
              className="w-full py-3 bg-blue-600 rounded-xl text-[10px] font-black text-white uppercase tracking-widest hover:bg-blue-500 transition"
            >
              Sign in with Google
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="flex h-screen bg-slate-950 font-sans text-slate-300">
      {/* Global DB Error Notification */}
      {dbError && (
        <div className="fixed top-20 right-4 z-[100] max-w-sm animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-red-500/10 border-2 border-red-500/50 backdrop-blur-md rounded-2xl p-4 shadow-2xl flex items-start gap-4">
            <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-white font-black text-[10px] uppercase tracking-widest mb-1">System Warning</p>
              <p className="text-red-200 text-xs font-bold leading-relaxed">{dbError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Mobile sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              className="fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 px-6 pb-4 border-r-2 border-slate-800 lg:hidden"
            >
              <div className="flex h-24 items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center shrink-0">
                    <VpLogoSvg className="h-full w-full text-white" />
                  </div>
                  <span className="text-lg font-black text-white uppercase tracking-tighter leading-tight">Vas-y Padel Academy</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-800">
                  <X size={20} />
                </button>
              </div>
              <nav className="mt-4 flex flex-col gap-1.5">
                {navigation.map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) => cn(
                      "flex items-center justify-between rounded-xl px-4 py-3.5 text-sm font-black uppercase tracking-widest transition-all border-2",
                      isActive 
                        ? "bg-slate-800 text-white border-slate-700 shadow-bento" 
                        : "text-slate-400 border-transparent hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon size={18} className={cn(item.badge && remindersCount > 0 && "text-red-500 animate-pulse")} />
                      {item.name}
                    </div>
                    {item.badge && remindersCount > 0 && (
                      <div className="relative flex items-center justify-center">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-20 animate-ping"></span>
                        <span className="relative flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] text-white shadow-lg shadow-red-500/20">
                          {remindersCount}
                        </span>
                      </div>
                    )}
                  </NavLink>
                ))}
              </nav>
              <div className="absolute bottom-6 left-6 right-6 pt-6 border-t border-slate-800">
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-black uppercase tracking-widest text-slate-500 hover:text-red-500 transition-colors"
                >
                  <LogOut size={18} />
                  Sign out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:bg-slate-900 lg:px-6 lg:pb-6 lg:border-r-2 lg:border-slate-800 z-20">
        {(status.smtp === 'auth_error' || status.smtp === 'missing') && (
           <div className="mt-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <div className="flex items-center gap-2 mb-2 text-red-500">
                <AlertTriangle size={14} />
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Email Setup Error</span>
              </div>
              <p className="text-[9px] text-slate-500 font-bold leading-tight uppercase mb-3 text-red-200/60">
                {status.smtp === 'auth_error' 
                  ? "SMTP login failed. Use an 16-character 'App Password', not your normal one."
                  : "SMTP credentials missing in AI Studio Settings."
                }
              </p>
              <div className="space-y-2">
                <a 
                  href="https://myaccount.google.com/apppasswords" 
                  target="_blank" 
                  rel="noreferrer"
                  className="block text-[9px] font-black underline text-blue-500 hover:text-blue-400 uppercase tracking-widest"
                >
                  Get App Password →
                </a>
                <button 
                  onClick={() => window.location.reload()}
                  className="block text-[9px] font-black text-slate-400 hover:text-white uppercase tracking-widest"
                >
                  Re-check status
                </button>
              </div>
           </div>
        )}
        <div className="flex h-28 items-center gap-4 mb-4">
          <div className="flex h-12 w-12 items-center justify-center shrink-0">
             <VpLogoSvg className="h-full w-full text-white" />
          </div>
          <span className="text-xl font-black tracking-tight text-white uppercase italic leading-none">VAS-Y PADEL <br/><span className="text-blue-500">ACADEMY</span></span>
        </div>
        <nav className="flex flex-col gap-1.5 flex-1 overflow-y-auto pr-2 custom-scrollbar">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) => cn(
                "group flex items-center justify-between rounded-xl px-4 py-3.5 text-sm font-black uppercase tracking-widest transition-all border-2",
                isActive 
                  ? "bg-slate-800 text-white border-slate-700 shadow-bento" 
                  : "text-slate-400 border-transparent hover:text-white hover:border-slate-800"
              )}
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-3">
                    <item.icon size={18} className={cn("transition-colors", isActive ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300", item.badge && remindersCount > 0 && "text-red-500 animate-pulse")} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && remindersCount > 0 && (
                    <div className="relative flex items-center justify-center">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-20 animate-ping"></span>
                        <span className="relative flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black shadow-lg shadow-red-500/20 text-white border-none">
                          {remindersCount}
                        </span>
                    </div>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="pt-6 border-t-2 border-slate-800 mt-6">
          <div className="mb-6 flex items-center gap-3 px-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-slate-800 bg-slate-950 overflow-hidden shadow-bento">
              {user.photoURL ? (
                <img src={user.photoURL} alt="" className="h-full w-full object-cover" />
              ) : (
                <UserIcon size={20} className="text-slate-500" />
              )}
            </div>
            <div className="flex flex-col overflow-hidden text-left">
              <span className="text-sm font-black text-white truncate uppercase italic">{user.displayName || 'Coach'}</span>
              <span className="text-xs font-bold text-slate-400 truncate uppercase tracking-widest">{user.email}</span>
            </div>
          </div>
          <button
            onClick={() => {
              setPasswordModalMessage('');
              setPasswordModalError('');
              setShowPasswordModal(true);
            }}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-black text-slate-400 border-2 border-transparent hover:text-blue-500 hover:border-blue-500/20 hover:bg-blue-500/5 transition-all uppercase tracking-widest text-left"
          >
            <Settings size={16} />
            CHANGE PASSWORD
          </button>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-black text-slate-400 border-2 border-transparent hover:text-red-500 hover:border-red-500/20 hover:bg-red-500/5 transition-all uppercase tracking-widest text-left mt-1"
          >
            <LogOut size={16} />
            SIGN OUT
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden bg-slate-950">
        <header className="flex h-16 items-center justify-between px-6 bg-slate-900 border-b-2 border-slate-800 lg:hidden shadow-bento">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center shrink-0">
              <VpLogoSvg className="h-full w-full text-white" />
            </div>
            <span className="text-base font-black tracking-tighter text-white uppercase italic">Vas-y Padel Academy</span>
          </div>
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-slate-400 border-2 border-slate-800 hover:text-white transition-colors">
            <Menu size={18} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar">
          <Outlet />
        </main>
      </div>

      {/* Password Modal */}
      <AnimatePresence>
        {showPasswordModal && (
          <>
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100]" onClick={() => setShowPasswordModal(false)} />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-slate-900 border-2 border-slate-800 rounded-3xl overflow-hidden shadow-bento z-[110]"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                      <Settings size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-black uppercase italic text-white leading-none tracking-tight">Account Security</h2>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Manage your credentials</p>
                    </div>
                  </div>
                  <button 
                    onClick={async () => {
                      setShowPasswordModal(false);
                      setHasDismissedPasswordModal(true);
                      if (currentUserRole && currentUserRole.id) {
                        try {
                          await updateMasterData('appUsers', currentUserRole.id, { 
                            forcePasswordChange: false,
                            updatedAt: new Date().toISOString()
                          });
                        } catch (err) {
                           console.error("Failed to dismiss password prompt permanently via X:", err);
                        }
                      }
                    }} 
                    className="text-slate-500 hover:text-white transition"
                  >
                    <X size={20} />
                  </button>
                </div>

                {passwordModalError && (
                  <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-inner">
                    {passwordModalError}
                    {passwordModalError.includes('sign out') && (
                      <button 
                        onClick={handleSignOut}
                        className="block mt-2 text-blue-400 underline hover:text-blue-300"
                      >
                        Sign Out Now
                      </button>
                    )}
                  </div>
                )}
                
                {passwordModalMessage && (
                  <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 p-3 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-inner">
                    {passwordModalMessage}
                  </div>
                )}

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black tracking-widest text-slate-500 uppercase">New Password</label>
                      <input 
                        type="password" 
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                        className="w-full bg-slate-950 border-2 border-slate-800 rounded-xl h-12 px-4 shadow-inner text-white font-medium focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Confirm Password</label>
                      <input 
                        type="password" 
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        className="w-full bg-slate-950 border-2 border-slate-800 rounded-xl h-12 px-4 shadow-inner text-white font-medium focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <button 
                      onClick={() => {
                        setPasswordModalError('');
                        setPasswordModalMessage('');
                        if (!newPassword || newPassword.length < 6) {
                           setPasswordModalError('Password must be at least 6 characters.');
                           return;
                        }
                        if (newPassword !== confirmPassword) {
                           setPasswordModalError('Passwords do not match.');
                           return;
                        }
                         import('firebase/auth').then(({ updatePassword }) => {
                          updatePassword(auth.currentUser!, newPassword).then(async () => {
                             setPasswordModalMessage('Password updated successfully!');
                             setNewPassword('');
                             setConfirmPassword('');
                             
                             if (currentUserRole && currentUserRole.id) {
                               try {
                                 await updateMasterData('appUsers', currentUserRole.id, { 
                                   forcePasswordChange: false,
                                   tempPassword: null // updateMasterData doesn't support deleteField easily, null is fine
                                 });
                               } catch (err) {
                                 console.error("Failed to clear flag after update:", err);
                               }
                             }
                             
                             setTimeout(() => setShowPasswordModal(false), 2000);
                          }).catch((err) => {
                             if (err.code === 'auth/requires-recent-login') {
                                setPasswordModalError('Please sign out and sign back in to change your password.');
                             } else {
                                setPasswordModalError(err.message || 'Failed to update password.');
                             }
                          });
                        });
                      }}
                      className="w-full bg-blue-600 text-white font-black uppercase tracking-[0.2em] text-[10px] py-3 rounded-xl hover:bg-blue-500 transition-colors shadow-bento mt-2"
                    >
                      UPDATE PASSWORD
                    </button>
                  
                  <div className="relative pt-4 pb-2">
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                       <div className="w-full h-px bg-slate-800"></div>
                       <span className="absolute bg-slate-900 px-3 text-[9px] font-black uppercase text-slate-600 tracking-widest">OR</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed text-center mt-2">
                    Forgot your current password? We can send a reset link to <strong className="text-white">{user.email}</strong>.
                  </p>
                  <button 
                    onClick={() => {
                      setPasswordModalError('');
                      setPasswordModalMessage('');
                      import('firebase/auth').then(({ sendPasswordResetEmail }) => {
                        if(user.email) {
                          sendPasswordResetEmail(auth, user.email).then(async () => {
                            setPasswordModalMessage('Password reset email sent! Please check your inbox.');
                            
                            // Clear flag on reset email send too
                            if (currentUserRole && currentUserRole.id) {
                              try {
                                await updateMasterData('appUsers', currentUserRole.id, { 
                                  forcePasswordChange: false
                                });
                              } catch (err) {
                                console.error("Failed to dismiss flag after reset email:", err);
                              }
                            }
                          }).catch((err) => {
                            setPasswordModalError(err.message || 'Failed to send reset email.');
                          });
                        }
                      })
                    }}
                    className="w-full bg-slate-800 bg-opacity-50 border border-slate-700 text-slate-300 font-black uppercase tracking-[0.2em] text-[10px] py-3 rounded-xl hover:bg-slate-700 transition-colors shadow-none"
                  >
                    SEND RESET LINK
                  </button>

                  <button 
                    onClick={async () => {
                      setShowPasswordModal(false);
                      setHasDismissedPasswordModal(true);
                      if (currentUserRole && currentUserRole.id) {
                        try {
                          await updateMasterData('appUsers', currentUserRole.id, { 
                            forcePasswordChange: false,
                            updatedAt: new Date().toISOString()
                          });
                        } catch (err) {
                          console.error("Failed to dismiss password prompt permanently:", err);
                        }
                      }
                    }}
                    className="w-full bg-transparent text-slate-500 font-black uppercase tracking-[0.2em] text-[10px] py-3 rounded-xl hover:text-white transition-colors mt-2"
                  >
                    CONTINUE TO DASHBOARD
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
