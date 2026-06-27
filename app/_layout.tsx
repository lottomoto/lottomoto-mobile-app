import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import Toast from 'react-native-toast-message';
import { LDMLTheme } from '@/constants/theme';
import { logout } from '@/lib/auth';

export const unstable_settings = {
  anchor: 'login',
};

export default function RootLayout() {
  const appState = useRef(AppState.currentState);
  const router = useRouter();

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (appState.current.match(/active/) && nextState === 'background') {
        await logout();
      }
      if (appState.current.match(/background/) && nextState === 'active') {
        router.replace('/login');
      }
      appState.current = nextState;
    });
    return () => sub.remove();
  }, []);

  return (
    <ThemeProvider value={LDMLTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="light" />
      <Toast />
    </ThemeProvider>
  );
}
