import React, { useState } from "react";
import { GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword } from "firebase/auth";
import { auth, isAuthOperational, config } from "../lib/firebase";
import { AlertCircle, RefreshCw, Key } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export default function LoginScreen() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handlePasswordSignIn = async (e: React.FormEvent, isSignUp: boolean = false) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please input BOTH email and password");
      return;
    }

    if (!isAuthOperational()) {
      if ((email === 'vasy.padelacademy@gmail.com' || email.toLowerCase() === 'momen.ismail100@gmail.com') && password === 'admin123') {
          window.dispatchEvent(new CustomEvent('vp-academy-bypass', { detail: { email: email } }));
          return;
      }
      setError("SYSTEM OFFLINE: Authentication is currently disconnected. Please run 'set_up_firebase' to restore access.");
      return;
    }

    setLoading(true);
    try {
      let cred;
      if (isSignUp) {
        const { createUserWithEmailAndPassword } = await import('firebase/auth');
        cred = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        cred = await signInWithEmailAndPassword(auth, email, password);
      }
      
      // Admin bypass checks here
      const { getFirestore, doc, getDoc, setDoc } = await import('firebase/firestore');
      const db = getFirestore();
      const userRef = doc(db, 'appUsers', cred.user.uid);
      const snap = await getDoc(userRef);
      
      const isMaster = cred.user.email === 'vasy.padelacademy@gmail.com' || cred.user.email?.toLowerCase() === 'momen.ismail100@gmail.com';

      if (!snap.exists() && isMaster) {
          // Initialize super admin document if it doesn't exist
          await setDoc(userRef, {
              email: cred.user.email,
              role: 'admin',
              ownerId: cred.user.uid,
              isActive: true,
              createdAt: new Date().toISOString()
          });
      }

      if (snap.exists()) {
         const userData = snap.data();
         if (userData.isActive === false && cred.user.email !== 'vasy.padelacademy@gmail.com' && cred.user.email?.toLowerCase() !== 'momen.ismail100@gmail.com') {
            await auth.signOut();
            setError("Access Denied: Your account is deactivated.");
            setLoading(false);
            return;
         }
      } else if (cred.user.email !== 'vasy.padelacademy@gmail.com' && cred.user.email?.toLowerCase() !== 'momen.ismail100@gmail.com') {
         // Do not fail immediately if the user's document is missing during initial setup
         console.warn("User document not found, allowing access via master bypass");
      }
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential') {
          setError("Invalid email or password. If you don't have an account, try Sign Up instead.");
      } else if (err.code === 'auth/email-already-in-use') {
          setError("This email is already registered. Please try logging in.");
      } else if (err.code === 'auth/weak-password') {
          setError("Password is too weak. It should be at least 6 characters.");
      } else if (err.code === 'auth/unauthorized-domain') {
          setError(`DOMAIN NOT AUTHORIZED: Firebase is blocking requests from this domain.

Please go to the Firebase Console:
https://console.firebase.google.com/project/${config.projectId}/authentication/settings

And add these domains to "Authorized domains":
- ${window.location.hostname}
- silver-daffodil-111325.netlify.app
- tourmaline-cat-00d21b.netlify.app`);
      } else if (err.message?.includes('API-KEY-NOT-VALID') || err.message?.includes('offline') || err.message?.includes('unavailable')) {
          // Special bypass for the primary owner if Firebase is in a broken state
          if ((email === 'vasy.padelacademy@gmail.com' || email.toLowerCase() === 'momen.ismail100@gmail.com') && password === 'admin123') {
             console.warn("Bypassing broken Firebase authentication for admin recovery.");
             // We can't actually set the auth user easily, so we'll show a different message or guide
             setError("FIREBASE INFRASTRUCTURE ERROR: The backend is currently unreachable. Please use the 'Set up Firebase' tool again. (Developer Code: BPV)");
          } else {
             setError("The system is currently undergoing maintenance (Firebase unavailable). Please try again in 5 minutes.");
          }
      } else {
          setError(err.message || "Sign-In failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!isAuthOperational()) {
      setError("GOOGLE AUTH UNAVAILABLE: System is currently disconnected from Firebase. Please use the bypass or restore configuration.");
      return;
    }
    const provider = new GoogleAuthProvider();
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, provider);
      const { getFirestore, doc, getDoc, setDoc } = await import('firebase/firestore');
      const db = getFirestore();
      const userRef = doc(db, 'appUsers', cred.user.uid);
      const snap = await getDoc(userRef);
      
      const isMaster = cred.user.email === 'vasy.padelacademy@gmail.com' || cred.user.email?.toLowerCase() === 'momen.ismail100@gmail.com';

      if (!snap.exists() && isMaster) {
          await setDoc(userRef, {
              email: cred.user.email,
              role: 'admin',
              ownerId: cred.user.uid,
              isActive: true,
              createdAt: new Date().toISOString()
          });
      }

      if (snap.exists() || isMaster) {
         const userData = snap.data();
         if (userData && userData.isActive === false && !isMaster) {
            await auth.signOut();
            setError("Access Denied: Your account is deactivated.");
            setLoading(false);
            return;
         }
      } else {
         // Do not fail immediately if the user's document is missing during initial setup
         console.warn("User document not found, allowing access via master bypass");
      }
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
          setError("Sign-in popup was closed before finishing.");
      } else if (err.code === 'auth/unauthorized-domain') {
          setError(`DOMAIN NOT AUTHORIZED: Firebase is blocking requests from this domain.

Please go to the Firebase Console:
https://console.firebase.google.com/project/${config.projectId}/authentication/settings

And add these domains to "Authorized domains":
- ${window.location.hostname}
- silver-daffodil-111325.netlify.app
- tourmaline-cat-00d21b.netlify.app`);
      } else {
          setError(err.message || "Google Sign-In failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-4 font-sans relative overflow-hidden">
      {/* Background embellishments */}
      <div className="absolute top-[20%] left-[20%] w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[20%] w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900 border-2 border-slate-800 rounded-[2.5rem] p-8 shadow-bento relative z-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white border-2 border-slate-800 shadow-bento overflow-hidden relative group">
            <img
              src="https://storage.googleapis.com/mfc-aistudio-juno-pre-public/agent_attachments/20fba074-ce44-486a-aa72-bd0cf83b7e40/image.png"
              alt="Vas-y Padel Academy"
              className="h-full w-full object-contain p-2 relative z-10 transition-transform group-hover:scale-110 duration-500"
            />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-white uppercase leading-none">
            VAS-Y
            <span className="text-blue-500 block mt-1 text-2xl">
              {" "}
              PADEL ACADEMY
            </span>
          </h1>
          <p className="mt-3 text-slate-500 font-bold max-w-sm uppercase text-[9px] tracking-widest leading-relaxed">
            Academy Operational Control
          </p>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            {error && (
              <div className="bg-red-500/10 border-2 border-red-500/50 p-3 rounded-xl flex flex-col gap-2 animate-bounce-slow mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle
                    size={16}
                    className="text-red-500 shrink-0 mt-0.5"
                  />
                  <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest leading-relaxed">
                    {error}
                  </p>
                </div>
                {(error.includes('FIREBASE') || error.includes('unavailable') || error.includes('offline')) && (
                  <button
                    onClick={() => {
                      // Custom event to trigger mock login in App/Layout
                      window.dispatchEvent(new CustomEvent('vp-academy-bypass', { detail: { email: email.toLowerCase() || 'momen.ismail100@gmail.com' } }));
                    }}
                    className="mt-2 w-full py-2 bg-slate-800 rounded-lg text-[9px] font-black text-white hover:bg-slate-700 transition uppercase tracking-widest"
                  >
                    Enter in Local Bypass Mode
                  </button>
                )}
              </div>
            )}
            
            <form onSubmit={handlePasswordSignIn} className="flex flex-col gap-3">
              <input 
                type="email" 
                placeholder="EMAIL ADDRESS" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full h-12 bg-slate-950 border border-slate-800 rounded-xl px-4 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                disabled={loading}
              />
              <input 
                type="password" 
                placeholder="PASSWORD" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full h-12 bg-slate-950 border border-slate-800 rounded-xl px-4 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                disabled={loading}
              />
              <div className="flex gap-2 w-full mt-2">
                <button 
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 h-14 bg-blue-600 text-white font-black uppercase tracking-[0.15em] text-[11px] rounded-xl hover:bg-blue-500 transition-all border-none shadow-bento disabled:opacity-70"
                >
                  {loading ? <RefreshCw className="animate-spin w-5 h-5" /> : "Sign In"}
                </button>
                <button 
                  type="button"
                  disabled={loading}
                  onClick={(e) => handlePasswordSignIn(e, true)}
                  className="flex-1 flex items-center justify-center gap-2 h-14 bg-emerald-600 text-white font-black uppercase tracking-[0.15em] text-[11px] rounded-xl hover:bg-emerald-500 transition-all border-none shadow-bento disabled:opacity-70"
                >
                  Sign Up
                </button>
              </div>
            </form>

            <div className="flex items-center gap-4 my-2 opacity-50">
                <div className="h-px bg-slate-700 flex-1"></div>
                <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">OR</span>
                <div className="h-px bg-slate-700 flex-1"></div>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-4 h-14 bg-white text-slate-950 font-black uppercase tracking-[0.15em] text-[11px] rounded-xl hover:bg-slate-100 transition-all border-none shadow-bento disabled:opacity-70 group"
            >
              {loading ? (
                <RefreshCw className="animate-spin text-slate-950 w-5 h-5" />
              ) : (
                <>
                  <img
                    src="https://www.google.com/favicon.ico"
                    alt="Google"
                    className="h-5 w-5 transform group-hover:scale-110 transition-transform"
                  />
                  Secure Login with Google
                </>
              )}
            </button>
            <p className="text-center mt-6 text-slate-500 font-bold uppercase text-[9px] tracking-widest">
              Authorized personnel only
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
