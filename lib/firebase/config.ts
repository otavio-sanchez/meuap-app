import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, type Persistence } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyDqbg3HIRcqs0rcppMnK9clTDA01x7vD6w',
  authDomain: 'meuap-9dc42.firebaseapp.com',
  projectId: 'meuap-9dc42',
  storageBucket: 'meuap-9dc42.firebasestorage.app',
  messagingSenderId: '1010314231648',
  appId: '1:1010314231648:web:bcda80dc48d9f9f4582805',
};

// getReactNativePersistence foi removido no Firebase 12.
// Adaptador customizado usando AsyncStorage para manter sessão entre restarts.
const asyncStoragePersistence: Persistence = {
  type: 'LOCAL',
  async _isAvailable() { return true; },
  async _set(key: string, value: string) { await AsyncStorage.setItem(key, value); },
  async _get(key: string) { return AsyncStorage.getItem(key); },
  async _remove(key: string) { await AsyncStorage.removeItem(key); },
  _addListener(_key: string, _listener: unknown) {},
  _removeListener(_key: string, _listener: unknown) {},
} as unknown as Persistence;

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: asyncStoragePersistence,
});

// persistentLocalCache não é suportado via JS SDK no React Native —
// memoryLocalCache + experimentalForceLongPolling dá estabilidade offline.
export const db = initializeFirestore(app, {
  localCache: memoryLocalCache(),
  experimentalForceLongPolling: true,
});
export const storage = getStorage(app);

export default app;
