import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AuthProvider } from '@/auth/auth-context';
import { Colors } from '@/constants/theme';
import { useAppFonts } from '@/hooks/use-app-fonts';

// L'écran de démarrage reste affiché jusqu'au chargement de la police.
SplashScreen.preventAutoHideAsync().catch(() => {});

/** Écran de secours en cas d'erreur inattendue dans n'importe quel écran. */
export { ErrorScreen as ErrorBoundary } from '@/components/error-screen';

export default function RootLayout() {
  const fontsReady = useAppFonts();
  useEffect(() => {
    if (fontsReady) SplashScreen.hideAsync().catch(() => {});
  }, [fontsReady]);
  if (!fontsReady) return null;

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
