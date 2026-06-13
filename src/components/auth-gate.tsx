'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Truck, Lock, Receipt } from 'lucide-react';

const APP_PIN = 'jm2026';
const STORAGE_KEY = 'jm_auth';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') setAuthenticated(true);
    setChecking(false);
  }, []);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (pin === APP_PIN) {
      localStorage.setItem(STORAGE_KEY, 'true');
      setAuthenticated(true);
      setError('');
    } else {
      setError('Wrong password');
      setPin('');
    }
  }

  if (checking) return null;

  if (authenticated) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-8 pb-6 px-6">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-full mb-3">
              <Truck className="h-7 w-7 text-blue-600" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">JM Transport</h1>
            <p className="text-sm text-gray-500 mt-1">Enter password to continue</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="password"
                placeholder="Password"
                value={pin}
                onChange={(e) => { setPin(e.target.value); setError(''); }}
                className="pl-10"
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            <Button type="submit" className="w-full">Login</Button>
          </form>
          <div className="mt-4 pt-4 border-t text-center">
            <Link href="/submit" className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium">
              <Receipt className="h-4 w-4" />
              Submit an Expense
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY);
  window.location.reload();
}
