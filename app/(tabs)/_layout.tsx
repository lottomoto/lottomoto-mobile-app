import { Tabs } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { HapticTab } from '@/components/haptic-tab';
import { Home, ShoppingCart, BarChart3, User } from 'lucide-react-native';
import { Colors } from '@/constants/theme';
import { saveLastTab } from '@/lib/auth';

export default function TabLayout() {
  const activeTab = useRef('index');

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState === 'background') {
        await saveLastTab(activeTab.current);
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <Tabs
      screenListeners={{
        state: (e) => {
          const state = e.data?.state;
          if (state?.index != null) {
            const route = state.routes[state.index];
            if (route?.name) activeTab.current = route.name;
          }
        },
      }}
      screenOptions={{
        tabBarActiveTintColor: Colors.navy,
        tabBarInactiveTintColor: Colors.grayDark,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.grayLight,
          height: 85,
          paddingBottom: 20,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerShown: false,
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color }) => (
            <Home size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="vendre"
        options={{
          title: 'Vendre',
          tabBarIcon: ({ color }) => (
            <ShoppingCart size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="rapports"
        options={{
          title: 'Rapports',
          tabBarIcon: ({ color }) => (
            <BarChart3 size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profil"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => (
            <User size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
