// Edge Function `game-action` : seule porte d'écriture des parties en ligne.
//
// POST { action: 'start' | 'move' | 'tick' | 'resign', roomId, … } avec le jeton
// de l'utilisateur (`Authorization: Bearer …`, ajouté par `supabase.functions.invoke`).
// La décision est prise par src/online/server.ts, qui valide chaque coup avec le
// moteur src/game : le même code que l'application, importé tel quel.

import { createClient } from '@supabase/supabase-js';

import { ONLINE_ERROR_STATUS } from '../../../src/online/errors.ts';
import { handleGameRequest } from '../../../src/online/server.ts';
import { createSupabaseStore } from '../../../src/online/supabase-store.ts';
import type { GameResponse } from '../../../src/online/types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Variables fournies automatiquement par Supabase à chaque Edge Function.
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const store = createSupabaseStore(admin);

function reply(body: GameResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Identifiant de l'utilisateur du jeton, ou null s'il est absent ou invalide. */
async function authenticate(request: Request): Promise<string | null> {
  const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error ? null : (data.user?.id ?? null);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') {
    return reply({ ok: false, code: 'bad_request', message: 'Méthode non autorisée.' }, 405);
  }
  const userId = await authenticate(request);
  const body = await request.json().catch(() => null);
  const response = await handleGameRequest(body, userId, store);
  return reply(response, response.ok ? 200 : ONLINE_ERROR_STATUS[response.code]);
});
