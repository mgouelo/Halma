import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { Colors } from '@/constants/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.paper },
        }}>
        <Stack.Screen name="index" options={{ title: 'Halma' }} />
        <Stack.Screen name="game" options={{ title: 'Partie à deux' }} />
      </Stack>
    </>
  );
}
