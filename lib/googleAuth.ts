/**
 * Google OAuth Client IDs
 *
 * How to get these:
 * 1. Go to https://console.firebase.google.com → your project → Authentication → Sign-in method → Google → Enable
 * 2. Go to https://console.cloud.google.com → APIs & Services → Credentials
 * 3. Copy the "Web client (auto created by Google Service)" client ID → paste in WEB_CLIENT_ID
 * 4. For iOS: create an "iOS" OAuth client → paste in IOS_CLIENT_ID
 * 5. For Android: create an "Android" OAuth client → paste in ANDROID_CLIENT_ID
 *
 * The redirect URI to add in Google Cloud Console:
 *   https://auth.expo.io/@your-expo-username/lista-do-lar-app
 */

export const GOOGLE_WEB_CLIENT_ID = 'YOUR_WEB_CLIENT_ID.apps.googleusercontent.com';
export const GOOGLE_IOS_CLIENT_ID = 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com';
export const GOOGLE_ANDROID_CLIENT_ID = 'YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com';
