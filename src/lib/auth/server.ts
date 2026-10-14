import { getSupabase } from '@/lib/supabase';

export function adminGate(): string {
  const gate = process.env.APP_ADMIN_GATE;
  if (!gate) throw new Error('APP_ADMIN_GATE is not set');
  return gate;
}

export async function callAuthRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}
