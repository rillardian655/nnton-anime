import { ref, computed } from 'vue';
import { authLogin, authMe, authLogout, verifyInvite, claimInvite, claimTicketOnly, getAuthToken, setAuthToken } from '../api.js';
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged,
  updateProfile 
} from '../firebase.js';

export const currentUser = ref(null);
export const authLoading = ref(true);
export const showLoginModal = ref(false);
export const showInviteModal = ref(false);
export const inviteData = ref(null);
export const inviteError = ref('');
export const activeInviteCode = ref('');

export const isAuthenticated = computed(() => !!currentUser.value);
export const isAdmin = computed(() => currentUser.value?.role === 'admin');

export function formatRemainingTime(seconds) {
  if (currentUser.value?.role === 'admin') return 'LIFETIME ACCESS';
  if (currentUser.value?.authProvider === 'firebase' || currentUser.value?.authProvider === 'google.com' || currentUser.value?.authProvider === 'password') {
    return 'VIP MEMBER';
  }
  if (!seconds || seconds <= 0) return 'Expired';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days} Hari ${hours} Jam`;
  }
  if (hours > 0) {
    return `${hours} Jam ${minutes} Mnt`;
  }
  return `${minutes} Menit`;
}

function mapFirebaseUser(user) {
  if (!user) return null;
  const providerId = user.providerData?.[0]?.providerId || 'firebase';
  const derivedName = user.displayName || user.email?.split('@')[0] || 'User';
  return {
    id: user.uid,
    username: derivedName,
    displayName: derivedName,
    email: user.email,
    photoURL: user.photoURL || null,
    role: 'user',
    remainingSeconds: 2592000,
    authProvider: providerId
  };
}

export async function checkAuth() {
  authLoading.value = true;
  try {
    // 1. Check local token first (e.g. admin or invite session)
    const token = getAuthToken();
    if (token) {
      const user = await authMe();
      if (user) {
        currentUser.value = user;
        authLoading.value = false;
        return;
      } else {
        setAuthToken('');
      }
    }

    // 2. Check Firebase Authentication state
    await new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
        if (fbUser && !currentUser.value) {
          currentUser.value = mapFirebaseUser(fbUser);
        }
        unsubscribe();
        resolve();
      }, () => resolve());
    });
  } catch (err) {
    console.warn('Auth check error:', err);
    currentUser.value = null;
  } finally {
    authLoading.value = false;
  }
}

// Sign In with Google via Firebase
export async function loginWithGoogle() {
  authLoading.value = true;
  try {
    const result = await signInWithPopup(auth, googleProvider);
    currentUser.value = mapFirebaseUser(result.user);
    showLoginModal.value = false;
    return currentUser.value;
  } catch (err) {
    console.error('Google Sign-In error:', err);
    throw err;
  } finally {
    authLoading.value = false;
  }
}

// Sign In with Email & Password via Firebase
export async function loginWithFirebaseEmail(email, password) {
  authLoading.value = true;
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    currentUser.value = mapFirebaseUser(result.user);
    showLoginModal.value = false;
    return currentUser.value;
  } catch (err) {
    console.error('Firebase Email Login error:', err);
    throw err;
  } finally {
    authLoading.value = false;
  }
}

// Register with Email & Password via Firebase
export async function registerWithFirebaseEmail(email, password, displayName) {
  authLoading.value = true;
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(result.user, { displayName });
    }
    currentUser.value = mapFirebaseUser({
      ...result.user,
      displayName: displayName || result.user.displayName
    });
    showLoginModal.value = false;
    return currentUser.value;
  } catch (err) {
    console.error('Firebase Register error:', err);
    throw err;
  } finally {
    authLoading.value = false;
  }
}

// Local Server / Admin Login (Legacy & Admin Dashboard)
export async function loginUser(username, password) {
  const result = await authLogin(username, password);
  currentUser.value = result.user;
  showLoginModal.value = false;
  return result;
}

export async function logoutUser() {
  if (currentUser.value?.authProvider) {
    try {
      await firebaseSignOut(auth);
    } catch (_) {}
  }
  await authLogout();
  currentUser.value = null;
}

export async function checkInviteUrl(code) {
  if (!code) return;
  activeInviteCode.value = code;
  inviteError.value = '';
  inviteData.value = null;
  showInviteModal.value = true;

  try {
    const res = await verifyInvite(code);
    if (res.valid) {
      inviteData.value = res;
    } else {
      inviteError.value = res.message || 'Link undangan tidak valid.';
    }
  } catch (err) {
    inviteError.value = 'Gagal memeriksa undangan: ' + err.message;
  }
}

export async function submitClaimInvite(username, password, displayName) {
  if (!activeInviteCode.value) throw new Error('Kode undangan tidak ditemukan.');
  const res = await claimInvite(activeInviteCode.value, username, password, displayName);
  currentUser.value = res.user;
  showInviteModal.value = false;
  inviteData.value = null;
  activeInviteCode.value = '';
  return res;
}

export async function loginWithTicketOnly(code) {
  const res = await claimTicketOnly(code);
  currentUser.value = res.user;
  showLoginModal.value = false;
  showInviteModal.value = false;
  inviteData.value = null;
  activeInviteCode.value = '';
  return res;
}
