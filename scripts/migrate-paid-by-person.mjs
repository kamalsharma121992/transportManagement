import { createClient } from '@supabase/supabase-js';

const s = createClient(
  'https://cnvqqqqzgkjvdnqmcdwy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNudnFxcXF6Z2tqdmRucW1jZHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNzI4MzcsImV4cCI6MjA5Njk0ODgzN30.pYvqQc-xdcV0dQJ31LIcteZ2zuPzohVHtpEAeSo1q1A'
);

async function migrate() {
  // For vehicle expenses: person = who paid → move to paid_by_person, clear person
  // Vehicle expenses don't have a "to whom" — they're fuel, maintenance etc.
  console.log('=== Migrating vehicle expenses: person → paid_by_person ===');

  const { data: vehicleExp } = await s.from('expenses')
    .select('id, person')
    .eq('expense_type', 'vehicle')
    .not('person', 'is', null)
    .neq('person', '');

  console.log(`  Found ${vehicleExp.length} vehicle expenses with person field`);

  // Update each: set paid_by_person = person, clear person (no recipient for vehicle expenses)
  for (const row of vehicleExp) {
    await s.from('expenses')
      .update({ paid_by_person: row.person, person: null })
      .eq('id', row.id);
  }
  console.log(`  ✓ Moved ${vehicleExp.length} rows`);

  // For operational/personal/other expenses from Expense Grid:
  // person = to whom money was given (correct, keep it)
  // paid_by_person = unknown for most, but paid_by is JM transport
  // We don't know which partner paid for these, so leave paid_by_person null
  console.log('\n=== Operational/personal expenses: person stays as "to whom" ===');
  const { data: opExp } = await s.from('expenses')
    .select('id, person')
    .neq('expense_type', 'vehicle');
  console.log(`  ${opExp.length} rows — person field kept as recipient`);

  // Verify
  console.log('\n=== Verification ===');
  const { data: sample } = await s.from('expenses')
    .select('expense_type, person, paid_by_person, category, amount')
    .limit(5)
    .eq('expense_type', 'vehicle')
    .not('paid_by_person', 'is', null);
  console.log('Sample vehicle expenses:');
  sample.forEach(r => console.log(`  ${r.category} ₹${r.amount} | paid_by_person: ${r.paid_by_person} | person: ${r.person}`));

  const { data: sample2 } = await s.from('expenses')
    .select('expense_type, person, paid_by_person, category, amount')
    .limit(5)
    .eq('expense_type', 'operational');
  console.log('\nSample operational expenses:');
  sample2.forEach(r => console.log(`  ${r.category} ₹${r.amount} | paid_by_person: ${r.paid_by_person} | person: ${r.person}`));

  console.log('\n✅ Migration complete');
}

migrate().catch(console.error);
