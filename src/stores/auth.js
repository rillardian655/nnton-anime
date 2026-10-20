import { ref, computed } from 'vue';
import { authLogin, authMe, authLogout, verifyInvite, claimInvite, getAuthToken, setAuthToken } from '../api.js';

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

export async function checkAuth() {
  authLoading.value = true;
  try {
    const token = getAuthToken();
    if (token) {
      const user = await authMe();
      if (user) {
        currentUser.value = user;
      } else {
        currentUser.value = null;
        setAuthToken('');
      }
    } else {
      currentUser.value = null;
    }
  } catch (err) {
    console.warn('Auth check error:', err);
    currentUser.value = null;
  } finally {
    authLoading.value = false;
  }
}

export async function loginUser(username, password) {
  const result = await authLogin(username, password);
  currentUser.value = result.user;
  showLoginModal.value = false;
  return result;
}

export async function logoutUser() {
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
