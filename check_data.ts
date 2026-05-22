import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkData() {
  const collections = ['packageTypes', 'players', 'packages'];
  for (const col of collections) {
    const snapshot = await getDocs(collection(db, col));
    console.log(`--- ${col} (${snapshot.size} docs) ---`);
    snapshot.forEach(doc => {
      console.log(doc.id, '=>', doc.data());
    });
  }
}

checkData();
