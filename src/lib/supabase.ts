// Client Supabase, créé à la demande à partir des variables d'environnement
// Expo (voir .env.example). Sans elles, l'application reste jouable hors ligne
// et les comptes sont simplement indisponibles.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Expo ne remplace que les accès écrits en toutes lettres (`process.env.EXPO_PUBLIC_…`).
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** Vrai si l'URL et la clé publique Supabase sont définies. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let client: SupabaseClient | null = null;

/**
 * Client Supabase partagé. À n'appeler que côté client (effets, gestionnaires
 * d'événements) : pendant l'export web statique, il n'y a pas de stockage.
 */
export function getSupabase(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase n’est pas configuré : définis EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY (voir .env.example).',
    );
  }
  client ??= createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      // Pas de connexion par lien (magic link, OAuth) pour l'instant.
      detectSessionInUrl: false,
    },
  });
  return client;
}

/**
 * Client Supabase jetable, sans session enregistrée : sert à valider un lien
 * de confirmation ouvert sur un autre appareil que celui de l'inscription,
 * sans remplacer la session de cet appareil (ni en ouvrir une).
 */
export function createEphemeralSupabase(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) return getSupabase();
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
