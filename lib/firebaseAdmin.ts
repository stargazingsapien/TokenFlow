import { applicationDefault, cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

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
