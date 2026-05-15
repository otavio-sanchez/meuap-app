import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase/config';

interface ErrorReport {
  message: string;
  stack?: string;
  context?: string;
  userId?: string;
  timestamp: unknown;
}

export async function reportError(error: unknown, context?: string, userId?: string): Promise<void> {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const report: ErrorReport = {
      message: err.message,
      stack: err.stack,
      context,
      userId,
      timestamp: serverTimestamp(),
    };
    await addDoc(collection(db, 'error_logs'), report);
  } catch {
    // silently fail — never throw from error reporter
  }
}
