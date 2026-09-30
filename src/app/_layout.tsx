import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider } from '@/auth/auth-context';
import { Colors } from '@/constants/theme';

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.paper },
        }}>
        {/* Accueil, profil, classements… avec la barre de navigation du bas. */}
        <Stack.Screen name="(main)" options={{ title: 'Halma' }} />
        {/* Par-dessus, sans la barre : parties, rooms, connexion et inscription. */}
        <Stack.Screen name="game" options={{ title: 'Partie' }} />
        <Stack.Screen name="room/[id]" options={{ title: 'Room' }} />
        <Stack.Screen name="sign-in" options={{ title: 'Connexion' }} />
        <Stack.Screen name="sign-up" options={{ title: 'Inscription' }} />
        <Stack.Screen name="upgrade" options={{ title: 'Garder ton compte' }} />
      </Stack>
    </AuthProvider>
  );
}
