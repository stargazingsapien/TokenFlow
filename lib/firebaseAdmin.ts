import { applicationDefault, cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

let adminApp: ReturnType<typeof getApp> | null = null;
if (projectId) {
  try {
    if (getApps().length) {
      adminApp = getApp();
    } else if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson) as Parameters<typeof cert>[0];
      adminApp = initializeApp({ credential: cert(serviceAccount), projectId });
    } else {
      adminApp = initializeApp({ credential: applicationDefault(), projectId });
    }
  } catch {
    adminApp = null;
  }
}

export const firestoreAdmin = adminApp ? getFirestore(adminApp) : null;
export const firebaseAuthAdmin = adminApp ? getAuth(adminApp) : null;
export const firebaseMessagingAdmin = adminApp ? getMessaging(adminApp) : null;
