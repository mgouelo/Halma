// Edge Function `delete-account` : suppression du compte de l'utilisateur,
// depuis l'application (obligatoire sur l'App Store et Google Play).
//
// POST sans corps, avec le jeton de l'utilisateur (`Authorization: Bearer …`,
// ajouté par `supabase.functions.invoke`). On ne supprime que le compte du
// jeton : aucun identifiant n'est lu dans la demande. La logique est dans
// src/online/account.ts (testée avec Jest).

import { createClient } from '@supabase/supabase-js';

import { deleteAccount, type AccountStore } from '../../../src/online/account.ts';
import { ONLINE_ERROR_STATUS } from '../../../src/online/errors.ts';
import { createSupabaseStore } from '../../../src/online/supabase-store.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Variables fournies automatiquement par Supabase à chaque Edge Function.
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const accounts: AccountStore = {
  async playingRooms(userId) {
    const { data: seats, error } = await admin.from('room_players').select('room_id').eq('user_id', userId);
    if (error) throw error;
    const ids = (seats ?? []).map((s: { room_id: string }) => s.room_id);
    if (ids.length === 0) return [];
    const { data: rooms, error: roomsError } = await admin.from('rooms').select('id').in('id', ids).eq('status', 'playing');
    if (roomsError) throw roomsError;
    return (rooms ?? []).map((r: { id: string }) => r.id);
  },
  async deleteUser(userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
  },
};

function reply(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function authenticate(request: Request): Promise<string | null> {
  const token = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error ? null : (data.user?.id ?? null);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return reply({ ok: false, code: 'bad_request', message: 'Méthode non autorisée.' }, 405);
  const result = await deleteAccount(await authenticate(request), accounts, createSupabaseStore(admin));
  return reply(result, result.ok ? 200 : ONLINE_ERROR_STATUS[result.code]);
});
