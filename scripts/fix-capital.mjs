import { createClient } from '@supabase/supabase-js';
const s = createClient(
  'https://cnvqqqqzgkjvdnqmcdwy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNudnFxcXF6Z2tqdmRucW1jZHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNzI4MzcsImV4cCI6MjA5Njk0ODgzN30.pYvqQc-xdcV0dQJ31LIcteZ2zuPzohVHtpEAeSo1q1A'
);

const missing = [
  { date: '2026-05-19', contributor: 'Kamal', contribution_type: 'Cash', value: 50000, description: 'To Bimal' },
  { date: '2026-05-19', contributor: 'Kamal', contribution_type: 'Cash', value: 10000, description: 'To Mohit' },
  { date: '2026-05-23', contributor: 'Kamal', contribution_type: 'Cash', value: 31000, description: 'To Bimal' },
  { date: '2026-05-27', contributor: 'Mohit', contribution_type: 'Cash', value: 3500, description: 'to home expense' },
  { date: '2026-06-03', contributor: 'Kamal', contribution_type: 'Cash', value: 145500, description: 'for tyre' },
  { date: '2026-06-03', contributor: 'Kamal', contribution_type: 'Cash', value: 4500, description: 'Diesel' },
  { date: '2026-06-03', contributor: 'Kamal', contribution_type: 'Cash', value: 58000, description: 'insurance' },
  { date: '2026-06-03', contributor: 'Kamal', contribution_type: 'Cash', value: 10000, description: 'advance to driver' },
];

const { error } = await s.from('capital_contributions').insert(missing);
if (error) console.error('ERROR:', error.message);
else console.log(`✓ Added ${missing.length} missing capital contributions`);

// Verify
const { data } = await s.from('capital_contributions').select('contributor, value');
const total = data.reduce((sum, r) => sum + Number(r.value), 0);
const byPerson = {};
data.forEach(r => { byPerson[r.contributor] = (byPerson[r.contributor] || 0) + Number(r.value); });

console.log(`\nTotal: ₹${total} (expected: ₹542755)`);
console.log(`Rows: ${data.length} (expected: 27)`);  // We'll have 28 due to Bimal/Mohit having separate entries
console.log(`Match: ${total === 542755 ? '✓' : '✗ diff=' + (542755 - total)}`);
console.log('\nBy contributor:');
for (const [name, amt] of Object.entries(byPerson)) {
  console.log(`  ${name}: ₹${amt}`);
}
