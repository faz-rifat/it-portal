/**
 * Proxies to the central Firebase initialization to ensure a single instance.
 */
import { initializeFirebase } from '@/firebase';

export const { auth, firestore: db } = initializeFirebase();