import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import api from './api';

export interface VendeurUser {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  role: string;
}

async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem('device_id');
  if (!id) {
    id = uuidv4();
    await AsyncStorage.setItem('device_id', id);
  }
  return id;
}

export async function loginWithPin(username: string, pin: string): Promise<VendeurUser> {
  const deviceId = await getDeviceId();
  const { data } = await api.post('/auth/login/pin', { username, pin, deviceId });
  await AsyncStorage.setItem('access_token', data.access_token);
  await AsyncStorage.setItem('refresh_token', data.refresh_token);
  await AsyncStorage.setItem('user', JSON.stringify(data.user));
  await AsyncStorage.setItem('saved_username', username);
  return data.user;
}

export async function getStoredUser(): Promise<VendeurUser | null> {
  const raw = await AsyncStorage.getItem('user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function getSavedUsername(): Promise<string | null> {
  return AsyncStorage.getItem('saved_username');
}

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem('access_token');
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getToken();
  return !!token;
}

export async function logout(): Promise<void> {
  await AsyncStorage.removeItem('access_token');
  await AsyncStorage.removeItem('refresh_token');
  await AsyncStorage.removeItem('user');
}

export async function saveLastTab(tab: string): Promise<void> {
  await AsyncStorage.setItem('last_tab', tab);
}

export async function getLastTab(): Promise<string | null> {
  return AsyncStorage.getItem('last_tab');
}

export async function saveDraftFiche(data: any): Promise<void> {
  await AsyncStorage.setItem('draft_fiche', JSON.stringify(data));
}

export async function getDraftFiche(): Promise<any | null> {
  const raw = await AsyncStorage.getItem('draft_fiche');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function clearDraftFiche(): Promise<void> {
  await AsyncStorage.removeItem('draft_fiche');
}

export async function changePin(currentPin: string, newPin: string): Promise<void> {
  const username = await getSavedUsername();
  if (!username) throw new Error('Pas de username sauvegardé');

  await api.post('/auth/login/pin', { username, pin: currentPin });
  await api.patch('/vendeurs/me/pin', { pin: newPin });
}
