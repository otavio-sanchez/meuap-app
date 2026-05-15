// Metro resolves firebase/auth to the React Native bundle (dist/rn/index.js)
// via unstable_conditionNames in metro.config.js, which exports
// getReactNativePersistence. The browser TS types don't include it,
// so we augment the module here.
import { Persistence } from 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  }): Persistence;
}
