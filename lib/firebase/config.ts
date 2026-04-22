import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyDqbg3HIRcqs0rcppMnK9clTDA01x7vD6w',
  authDomain: 'meuap-9dc42.firebaseapp.com',
  projectId: 'meuap-9dc42',
  storageBucket: 'meuap-9dc42.firebasestorage.app',
  messagingSenderId: '1010314231648',
  appId: '1:1010314231648:web:bcda80dc48d9f9f4582805',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const db = getFirestore(app);

export default app;
