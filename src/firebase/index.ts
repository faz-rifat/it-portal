'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore, 
  Firestore, 
  memoryLocalCache
} from 'firebase/firestore';

/**
 * Strict Singleton for Firebase Services.
 * Forces memoryLocalCache and long polling to resolve stability issues in cloud/proxy environments.
 */
let app: FirebaseApp;
let firestore: Firestore;

export function initializeFirebase() {
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
    // STABILITY FIX: Forced memory cache and long polling
    firestore = initializeFirestore(app, {
      localCache: memoryLocalCache(),
      experimentalForceLongPolling: true,
    });
  } else {
    app = getApp();
    try {
      firestore = getFirestore(app);
    } catch (e) {
      firestore = initializeFirestore(app, {
        localCache: memoryLocalCache(),
        experimentalForceLongPolling: true,
      });
    }
  }

  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore: firestore,
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
