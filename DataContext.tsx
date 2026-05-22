import React, { useState, useEffect, createContext, useContext } from 'react';
import { onAuthStateChanged, createUserWithEmailAndPassword, signOut as signOutSecondary } from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc,
  query, 
  where,
  orderBy,
  serverTimestamp,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { db, auth, secondaryAuth, handleFirestoreError, isFirebaseConfigured, config as firebaseConfig, getFirebaseDiagnostics } from './firebase';
import { 
  PackageType, 
  Location, 
  Level, 
  PricingScheme, 
  Group,
  Player, 
  Package, 
  Session, 
  Payment, 
  Reminder,
  AppUser,
  Evaluation,
  SkillScore,
  TeamMessage
} from '../types';

enum OperationType {
  LIST = 'list',
  WRITE = 'write',
  DELETE = 'delete'
}

interface DataContextType {
  packageTypes: PackageType[];
  locations: Location[];
  levels: Level[];
  pricingSchemes: PricingScheme[];
  groups: Group[];
  players: Player[];
  packages: Package[];
  sessions: Session[];
  payments: Payment[];
  reminders: Reminder[];
  evaluations: Evaluation[];
  appUsers: AppUser[];
  teamMessages: TeamMessage[];
  currentUserRole: AppUser | null;
  loading: boolean;
  dbError: string | null;
  activeDbId: string;
  switchDatabase: (id: string) => void;
  addMasterData: (collectionName: string, data: any) => Promise<void>;
  updateMasterData: (collectionName: string, id: string, data: any) => Promise<void>;
  deleteMasterData: (collectionName: string, id: string) => Promise<void>;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  filterType: string;
  setFilterType: (val: string) => void;
  locationFilter: string;
  setLocationFilter: (val: string) => void;
  levelFilter: string;
  setLevelFilter: (val: string) => void;
  groupFilter: string;
  setGroupFilter: (val: string) => void;
  playerStatusFilter: 'all' | 'active' | 'inactive';
  setPlayerStatusFilter: (val: 'all' | 'active' | 'inactive') => void;
  sessionStatusFilter: string;
  setSessionStatusFilter: (val: string) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
  // Initialize state from localStorage if available
  const [allPackageTypes, setAllPackageTypes] = useState<PackageType[]>(() => JSON.parse(localStorage.getItem('cache_packageTypes') || '[]'));
  const [allLocations, setAllLocations] = useState<Location[]>(() => JSON.parse(localStorage.getItem('cache_locations') || '[]'));
  const [allLevels, setAllLevels] = useState<Level[]>(() => JSON.parse(localStorage.getItem('cache_levels') || '[]'));
  const [allGroups, setAllGroups] = useState<Group[]>(() => JSON.parse(localStorage.getItem('cache_groups') || '[]'));
  const [allPricingSchemes, setAllPricingSchemes] = useState<PricingScheme[]>(() => JSON.parse(localStorage.getItem('cache_pricingSchemes') || '[]'));
  const [allPlayers, setAllPlayers] = useState<Player[]>(() => JSON.parse(localStorage.getItem('cache_players') || '[]'));
  const [allPackages, setAllPackages] = useState<Package[]>(() => JSON.parse(localStorage.getItem('cache_packages') || '[]'));
  const [allSessions, setAllSessions] = useState<Session[]>(() => JSON.parse(localStorage.getItem('cache_sessions') || '[]'));
  const [allPayments, setAllPayments] = useState<Payment[]>(() => JSON.parse(localStorage.getItem('cache_payments') || '[]'));
  const [allReminders, setAllReminders] = useState<Reminder[]>(() => JSON.parse(localStorage.getItem('cache_reminders') || '[]'));
  const [allEvaluations, setAllEvaluations] = useState<Evaluation[]>(() => JSON.parse(localStorage.getItem('cache_evaluations') || '[]'));
  const [allAppUsers, setAllAppUsers] = useState<AppUser[]>(() => JSON.parse(localStorage.getItem('cache_appUsers') || '[]'));
  const [allTeamMessages, setAllTeamMessages] = useState<TeamMessage[]>(() => JSON.parse(localStorage.getItem('cache_teamMessages') || '[]'));
  const [currentUserRole, setCurrentUserRole] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [activeDbId, setActiveDbId] = useState<string>(firebaseConfig.firestoreDatabaseId || '(default)');

  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [playerStatusFilter, setPlayerStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [sessionStatusFilter, setSessionStatusFilter] = useState('all');

  useEffect(() => {
    if (firebaseConfig.firestoreDatabaseId) {
      setActiveDbId(firebaseConfig.firestoreDatabaseId);
    }
  }, []);

  const [isAuthInitialized, setIsAuthInitialized] = useState(false);
  const isAuthInitializedRef = React.useRef(false);

  // Sync state to localStorage - Only update if Auth is initialized and loading is false
  useEffect(() => { if(isAuthInitialized && !loading) localStorage.setItem('cache_packageTypes', JSON.stringify(allPackageTypes)); }, [allPackageTypes, isAuthInitialized, loading]);
  useEffect(() => { if(isAuthInitialized && !loading) localStorage.setItem('cache_locations', JSON.stringify(allLocations)); }, [allLocations, isAuthInitialized, loading]);
  useEffect(() => { if(isAuthInitialized && !loading) localStorage.setItem('cache_levels', JSON.stringify(allLevels)); }, [allLevels, isAuthInitialized, loading]);
  useEffect(() => { if(isAuthInitialized && !loading) localStorage.setItem('cache_groups', JSON.stringify(allGroups)); }, [allGroups, isAuthInitialized, loading]);
  useEffect(() => { if(isAuthInitialized && !loading) localStorage.setItem('cache_pricingSchemes', JSON.stringify(allPricingSchemes)); }, [allPricingSchemes, isAuthInitialized, loading]);
  useEffect(() => { if(isAuthInitialized && !loading) localStorage.setItem('cache_players', JSON.stringify(allPlayers)); }, [allPlayers, isAuthInitialized, loading]);
  useEffect(() => { if(isAuthInitialized && !loading) localStorage.setItem('cache_packages', JSON.stringify(allPackages)); }, [allPackages, isAuthInitialized, loading]);
  useEffect(() => { if(isAuthInitialized && !loading) localStorage.setItem('cache_sessions', JSON.stringify(allSessions)); }, [allSessions, isAuthInitialized, loading]);
  useEffect(() => { if(isAuthInitialized && !loading) localStorage.setItem('cache_payments', JSON.stringify(allPayments)); }, [allPayments, isAuthInitialized, loading]);
  useEffect(() => { if(isAuthInitialized && !loading) localStorage.setItem('cache_reminders', JSON.stringify(allReminders)); }, [allReminders, isAuthInitialized, loading]);
  useEffect(() => { if(isAuthInitialized && !loading) localStorage.setItem('cache_evaluations', JSON.stringify(allEvaluations)); }, [allEvaluations, isAuthInitialized, loading]);
  useEffect(() => { if(isAuthInitialized && !loading) localStorage.setItem('cache_appUsers', JSON.stringify(allAppUsers)); }, [allAppUsers, isAuthInitialized, loading]);
  useEffect(() => { if(isAuthInitialized && !loading) localStorage.setItem('cache_teamMessages', JSON.stringify(allTeamMessages)); }, [allTeamMessages, isAuthInitialized, loading]);

  const switchDatabase = (id: string) => {
    setActiveDbId(id);
    setLoading(true);
    window.location.reload(); 
  };

  useEffect(() => {
    // Database override logic removed to ensure stability
  }, []);

  // Filtered views based on RBAC
  const packageTypes = allPackageTypes || [];
  const levels = allLevels || [];
  const pricingSchemes = allPricingSchemes || [];
  const appUsers = allAppUsers || [];
  const teamMessages = allTeamMessages || [];

  const locations = React.useMemo(() => {
    const list = allLocations || [];
    if (currentUserRole?.role === 'coach' && currentUserRole.locationIds?.length) {
      const locIdsSet = new Set(currentUserRole.locationIds);
      return list.filter(l => l && l.id && locIdsSet.has(l.id));
    }
    return list;
  }, [allLocations, currentUserRole]);

  const groups = React.useMemo(() => {
    const list = allGroups || [];
    if (currentUserRole?.role === 'coach' && currentUserRole.locationIds?.length) {
      const locIdsSet = new Set(currentUserRole.locationIds);
      return list.filter(g => g && g.locationId && locIdsSet.has(g.locationId));
    }
    return list;
  }, [allGroups, currentUserRole]);

  const players = React.useMemo(() => {
    const list = allPlayers || [];
    if (currentUserRole?.role === 'coach' && currentUserRole.locationIds?.length) {
      const locIdsSet = new Set(currentUserRole.locationIds);
      return list.filter(p => p && p.locationId && locIdsSet.has(p.locationId));
    }
    return list;
  }, [allPlayers, currentUserRole]);

  const packages = React.useMemo(() => {
    const playerList = players || [];
    const pkgList = allPackages || [];
    const playerIdsSet = new Set(playerList.map(p => p.id).filter(Boolean));
    return pkgList.filter(pkg => pkg && pkg.playerId && playerIdsSet.has(pkg.playerId));
  }, [allPackages, players]);

  const sessions = React.useMemo(() => {
    const playerList = players || [];
    const pkgList = packages || [];
    const sessList = allSessions || [];
    const playerIdsSet = new Set(playerList.map(p => p.id).filter(Boolean));
    const packageIdsSet = new Set(pkgList.map(pkg => pkg.id).filter(Boolean));
    return sessList.filter(s => s && s.playerId && s.packageId && playerIdsSet.has(s.playerId) && packageIdsSet.has(s.packageId));
  }, [allSessions, players, packages]);

  const payments = React.useMemo(() => {
    const playerList = players || [];
    const pkgList = packages || [];
    const payList = allPayments || [];
    const playerIdsSet = new Set(playerList.map(p => p.id).filter(Boolean));
    const packageIdsSet = new Set(pkgList.map(pkg => pkg.id).filter(Boolean));
    return payList.filter(pay => pay && pay.playerId && pay.packageId && playerIdsSet.has(pay.playerId) && packageIdsSet.has(pay.packageId));
  }, [allPayments, players, packages]);

  const reminders = React.useMemo(() => {
    const playerList = players || [];
    const remList = allReminders || [];
    const playerIdsSet = new Set(playerList.map(p => p.id).filter(Boolean));
    return remList.filter(rem => rem && (!rem.playerId || playerIdsSet.has(rem.playerId)));
  }, [allReminders, players]);

  const evaluations = React.useMemo(() => {
    const playerList = players || [];
    const evalList = allEvaluations || [];
    const playerIdsSet = new Set(playerList.map(p => p.id).filter(Boolean));
    return evalList.filter(ev => ev && ev.playerId && playerIdsSet.has(ev.playerId));
  }, [allEvaluations, players]);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      setDbError("DATABASE NOT CONFIGURED: Please go to 'Settings' > 'Firebase' and set up your project to enable cloud storage.");
      return;
    }
    
    setDbError(null); // Clear error if configured

    let unsubscribes: (() => void)[] = [];
    
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      const wasInitialized = isAuthInitializedRef.current;
      isAuthInitializedRef.current = true;
      setIsAuthInitialized(true);
      // Check for bypass user (set via custom event in Layout/LoginScreen)
      // Note: DataContext doesn't have direct access to Layout state, but can check current role
      
      console.log("[DataContext] onAuthStateChanged user:", user ? user.email : "null");

      // Cleanup previous listeners
      unsubscribes.forEach(u => u());
      unsubscribes = [];

      if (user) {
        // ... (rest of the if block)
        console.log("[Auth Debug] User authenticated:", user.email, user.uid);
        console.log("[Auth Debug] Setting loading(true)");
        setLoading(true);

        try {
          // ...
          const token = await user.getIdTokenResult(true);
          // ...
          const isMasterEmail = user.email?.toLowerCase() === 'vasy.padelacademy@gmail.com' || user.email?.toLowerCase() === 'momen.ismail100@gmail.com';
          let targetOwnerId = user.uid;
          let currentRole: AppUser = {
             email: user.email || '',
             name: user.displayName || 'Owner',
             role: isMasterEmail ? 'admin' : 'visitor',
             ownerId: user.uid
          };
          
          console.log("[Auth Debug] Fetching appUsers doc...");

          const userDocRef = doc(db, 'appUsers', user.uid);
          const userEmailDocRef = user.email ? doc(db, 'appUsers', user.email) : null;
          
          const fetchWithRetry = async (ref: any, retries = 3, delay = 1000): Promise<any> => {
            console.log(`[Auth Debug] Fetching doc ref: ${ref.path}, attempt: ${4-retries}`);
            try {
                return await getDoc(ref);
            } catch (err: any) {
                if (retries > 0 && (err.code === 'unavailable' || err.message?.includes('offline'))) {
                    console.warn(`[DataContext] Fetch failed, retrying in ${delay}ms...`, err);
                    await new Promise(r => setTimeout(r, delay));
                    return fetchWithRetry(ref, retries - 1, delay * 2);
                }
                throw err;
            }
          };
          
          try {
            let userSnap = await fetchWithRetry(userDocRef);
            
            if (!userSnap.exists() && userEmailDocRef) {
              console.log("[Auth Debug] UID doc not found, checking email...");
              userSnap = await fetchWithRetry(userEmailDocRef);
              
              if (userSnap.exists()) {
                console.log("User found by email doc, migrating to UID doc...");
                const data = userSnap.data();
                await setDoc(userDocRef, data);
              }
            }

            if (userSnap.exists()) {
              console.log("[Auth Debug] Doc exists, data:", userSnap.data());
              const userData = userSnap.data() as AppUser;
              targetOwnerId = userData.ownerId || user.uid;
              currentRole = { id: userSnap.id, email: user.email || '', ...userData };
              
              if (isMasterEmail && currentRole.role !== 'admin') {
                currentRole.role = 'admin';
                try {
                  await updateDoc(userDocRef, { role: 'admin' });
                } catch (e) {}
              }
            } else if (isMasterEmail) {
              console.log("[Auth Debug] Creating master admin doc...");
              try {
                await setDoc(userDocRef, {
                    email: user.email,
                    name: user.displayName || 'Admin',
                    role: 'admin',
                    ownerId: user.uid
                });
              } catch (e) {}
              currentRole.id = user.uid;
            } else {
                console.log("[Auth Debug] User doc not found and not master email. Defaulting to visitor.");
            }
          } catch (docErr: any) {
            console.warn("DataContext: Accessing appUsers doc failed (likely offline). Continuing with local role default.", docErr);
          }

          setCurrentUserRole(currentRole);
          console.log("[Auth Debug] Current user role set:", currentRole);

          const collectionsToSync = [
            { name: 'packageTypes', setter: setAllPackageTypes },
            { name: 'locations', setter: setAllLocations },
            { name: 'levels', setter: setAllLevels },
            { name: 'pricingSchemes', setter: setAllPricingSchemes },
            { name: 'groups', setter: setAllGroups },
            { name: 'players', setter: setAllPlayers },
            { name: 'packages', setter: setAllPackages },
            { name: 'sessions', setter: setAllSessions },
            { name: 'payments', setter: setAllPayments },
            { name: 'reminders', setter: setAllReminders },
            { name: 'evaluations', setter: setAllEvaluations },
            { name: 'appUsers', setter: setAllAppUsers },
            { name: 'teamMessages', setter: setAllTeamMessages }
          ];
          
          let initializedCount = 0;
          const newUnsubscribes = collectionsToSync.map(col => {
            let q;
            if (currentRole.role === 'admin' || isMasterEmail) {
              q = collection(db, col.name);
            } else {
              q = query(collection(db, col.name), where('ownerId', '==', targetOwnerId));
            }

            return onSnapshot(q, (snapshot) => {
              const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              col.setter(data as any);
              console.log(`[DataContext] Sync ${col.name}: ${data.length} items`);
              
              if (!isAuthInitializedRef.current) {
                initializedCount++;
                if (initializedCount >= 6) {
                  setLoading(false);
                }
              }
            }, (error) => {
              console.error(`[DataContext] Snapshot error for ${col.name}:`, error);
              if (error.message?.includes('permission-denied')) {
                setDbError(`Access denied to ${col.name}`);
              }
            });
          });
          
          setLoading(false);
          const loadTimeout = setTimeout(() => {
            setLoading(false);
          }, 10000);

          unsubscribes = [...newUnsubscribes, () => clearTimeout(loadTimeout)];
        } catch (authError) {
          console.error("[Auth Debug] Auth initialization error:", authError);
          setLoading(false);
        }
      } else {
        console.log("[Auth Debug] No user, setting loading(false)", wasInitialized);
        setLoading(false);
      }
    });

    const handleBypass = (e: any) => {
      console.log("[DataContext] Applying bypass for:", e.detail.email);
      setIsAuthInitialized(true);
      setCurrentUserRole({
        email: e.detail.email,
        name: 'Academy Admin (Bypass)',
        role: 'admin',
        ownerId: 'bypass-admin-uid'
      });
      setLoading(false);
    };

    window.addEventListener('vp-academy-bypass', handleBypass as EventListener);

    return () => {
      unsubscribeAuth();
      unsubscribes.forEach(u => u());
      window.removeEventListener('vp-academy-bypass', handleBypass as EventListener);
    };
  }, [isFirebaseConfigured]);

  const addMasterData = async (collectionName: string, data: any) => {
    if (currentUserRole?.role === 'visitor') {
       throw new Error(JSON.stringify({ error: "Missing or insufficient permissions: Read-only user." }));
    }
    try {
      if (!auth.currentUser && currentUserRole?.ownerId === 'bypass-admin-uid') {
        // In bypass mode but no auth user, we can't write to REAL firestore
        throw new Error(JSON.stringify({ error: "LOCAL BYPASS MODE: Real database writes are disabled because you are not authenticated with Google. Please login properly to save data." }));
      }
      
      if (!auth.currentUser) {
        throw new Error(JSON.stringify({ error: "No authenticated user. Please sign in to save data." }));
      }
      if (!currentUserRole) {
        throw new Error(JSON.stringify({ error: "Your user role has not been loaded yet. Please wait a moment or refresh the page." }));
      }
      
      const payload = {
        ...data,
        ownerId: currentUserRole.ownerId || auth.currentUser.uid,
        createdAt: serverTimestamp(),
        addedBy: currentUserRole.name || auth.currentUser.email
      };
      
      console.log(`Adding to ${collectionName}:`, payload, "CurrentUser:", auth.currentUser?.uid);
      if (collectionName === 'appUsers' && data.email) {
         if (data.password) {
            try {
               await createUserWithEmailAndPassword(secondaryAuth, data.email, data.password);
               await signOutSecondary(secondaryAuth);
            } catch (e: any) {
               console.error("Auth error", e);
               throw new Error(JSON.stringify({ error: e.message || 'Failed to create user in Auth.' }));
            }
         }
         const { password, ...payloadWithoutPassword } = payload;
         
         // Keep password in Firestore only if it's a temporary one that needs to be changed
         const finalPayload = {
           ...payloadWithoutPassword,
           forcePasswordChange: true,
           tempPassword: password // Store temp password for admin visibility
         };
         
         await setDoc(doc(db, 'appUsers', data.email), finalPayload);
         return { id: data.email };
      } else {
         const docRef = await addDoc(collection(db, collectionName), payload);
         return docRef;
      }
    } catch (e) {
      console.error(`Error adding to ${collectionName}:`, e);
      handleFirestoreError(e, OperationType.WRITE, collectionName);
    }
  };

  const updateMasterData = async (collectionName: string, id: string, data: any) => {
    if (currentUserRole?.role === 'visitor') {
       throw new Error(JSON.stringify({ error: "Missing or insufficient permissions: Read-only user." }));
    }
    try {
      if (!auth.currentUser) {
        throw new Error(JSON.stringify({ error: "No authenticated user. Please sign in to save data." }));
      }
      if (!currentUserRole) {
        throw new Error(JSON.stringify({ error: "Your user role has not been loaded yet. Please wait a moment or refresh the page." }));
      }
      
      // Separate system fields out to avoid overwriting them with current user info accidentally
      const { id: _, ownerId, createdAt, updatedAt: ____, ...rest } = data;
      
      const payload: any = {
        ...rest,
        updatedAt: serverTimestamp(),
        updatedBy: currentUserRole.name || auth.currentUser.email
      };

      // Only include ownerId/createdAt if they were explicitly provided (usually they shouldn't be for updates)
      // This ensures we don't accidentally override the original ownerId with the admin's UID
      if (ownerId !== undefined) payload.ownerId = ownerId;
      if (createdAt !== undefined) payload.createdAt = createdAt;

      console.log(`Updating ${collectionName}/${id}:`, payload);
      await setDoc(doc(db, collectionName, id), payload, { merge: true });
    } catch (e) {
      console.error(`Error updating ${collectionName}/${id}:`, e);
      handleFirestoreError(e, OperationType.WRITE, `${collectionName}/${id}`);
    }
  };

  const deleteMasterData = async (collectionName: string, id: string) => {
    if (currentUserRole?.role === 'visitor') {
       throw new Error(JSON.stringify({ error: "Missing or insufficient permissions: Read-only user." }));
    }
    try {
      if (!id) {
        console.error(`Delete failed: No ID provided for ${collectionName}`);
        return;
      }
      console.log(`Attempting to delete ${collectionName}/${id}`);
      await deleteDoc(doc(db, collectionName, id));
      console.log(`Successfully deleted ${collectionName}/${id}`);
    } catch (e) {
      console.error(`Error deleting from ${collectionName}:`, e);
      handleFirestoreError(e, OperationType.DELETE, `${collectionName}/${id}`);
    }
  };

  return (
    <DataContext.Provider value={{ 
      packageTypes, 
      locations, 
      levels, 
      pricingSchemes, 
      groups, 
      players, 
      packages, 
      sessions, 
      payments, 
      reminders, 
      evaluations,
      appUsers, 
      teamMessages,
      currentUserRole, 
      loading,
      dbError,
      activeDbId,
      switchDatabase,
      addMasterData, updateMasterData, deleteMasterData,
      searchTerm, setSearchTerm,
      filterType, setFilterType,
      locationFilter, setLocationFilter,
      levelFilter, setLevelFilter,
      groupFilter, setGroupFilter,
      playerStatusFilter, setPlayerStatusFilter,
      sessionStatusFilter, setSessionStatusFilter
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
