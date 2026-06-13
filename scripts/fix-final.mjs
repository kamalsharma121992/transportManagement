import { createClient } from '@supabase/supabase-js';

const s = createClient(
  'https://cnvqqqqzgkjvdnqmcdwy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNudnFxcXF6Z2tqdmRucW1jZHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNzI4MzcsImV4cCI6MjA5Njk0ODgzN30.pYvqQc-xdcV0dQJ31LIcteZ2zuPzohVHtpEAeSo1q1A'
);

async function fix() {
  // 1. Add back Bimal's 4 personal expenses (deleted wrongly earlier)
  console.log('=== Adding Bimal personal expenses ===');
  const bimalPersonal = [
    { date: '2026-06-05', expense_type: 'personal', person: 'Bimal', category: 'Other', amount: 110, paid_by: 'JM transport', status: 'Paid' },
    { date: '2026-06-08', expense_type: 'personal', person: 'Bimal', category: 'Other', amount: 160, paid_by: 'JM transport', status: 'Paid' },
    { date: '2026-06-09', expense_type: 'personal', person: 'Bimal', category: 'Other', amount: 3290, paid_by: 'JM transport', status: 'Paid' },
    { date: '2026-06-10', expense_type: 'personal', person: 'Bimal', category: 'Other', amount: 600, paid_by: 'JM transport', status: 'Paid' },
  ];
  const { error: e1 } = await s.from('expenses').insert(bimalPersonal);
  if (e1) console.error('  ERROR:', e1.message);
  else console.log('  ✓ Added 4 Bimal personal expenses (₹4,160)');

  // 2. Verify totals match Expense Grid spreadsheet
  console.log('\n=== Verifying Expense Grid totals ===');
  const { data } = await s.from('expenses')
    .select('person, amount')
    .neq('expense_type', 'vehicle');

  const totals = {};
  data.forEach(r => {
    const p = r.person || 'Unknown';
    totals[p] = (totals[p] || 0) + Number(r.amount);
  });

  const expected = {
    'Babu Khan': 17490,
    'Janu Khan': 7000,
    'Laxman': 11000,
    'Mahesh': 200,
    'Mohit': 509,
    'Bimal': 4160,
    'Kamal': 4310,
    'Bimal/Mohit/Mahesh': 39834,
  };

  for (const [person, exp] of Object.entries(expected)) {
    const actual = totals[person] || 0;
    const match = actual === exp ? '✓' : '✗ MISMATCH';
    console.log(`  ${match} ${person}: DB=₹${actual} Expected=₹${exp}`);
  }

  const { count } = await s.from('expenses').select('*', { count: 'exact', head: true });
  console.log(`\nTotal expenses in DB: ${count}`);
  console.log('\n✅ Done');
}

fix().catch(console.error);
