import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://cnvqqqqzgkjvdnqmcdwy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNudnFxcXF6Z2tqdmRucW1jZHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNzI4MzcsImV4cCI6MjA5Njk0ODgzN30.pYvqQc-xdcV0dQJ31LIcteZ2zuPzohVHtpEAeSo1q1A'
);

async function fix() {
  console.log('=== Step 1: Add drivers to partners table ===');
  const driverPartners = [
    { name: 'Babu Khan' },
    { name: 'Janu Khan' },
    { name: 'Laxman' },
    { name: 'Pratap Ram' },
  ];
  const { error: pErr } = await supabase.from('partners').upsert(driverPartners, { onConflict: 'name' });
  if (pErr) console.error('  ERROR:', pErr.message);
  else console.log('  ✓ Added drivers to partners');

  console.log('\n=== Step 2: Fix "Bimal/Mohit/Mahesh" → "Bimal" in expenses ===');
  const { data: toFix, error: fetchErr } = await supabase
    .from('expenses')
    .select('id')
    .eq('person', 'Bimal/Mohit/Mahesh');

  if (fetchErr) {
    console.error('  ERROR fetching:', fetchErr.message);
  } else if (toFix && toFix.length > 0) {
    const ids = toFix.map(r => r.id);
    const { error: updErr } = await supabase
      .from('expenses')
      .update({ person: 'Bimal' })
      .in('id', ids);
    if (updErr) console.error('  ERROR updating:', updErr.message);
    else console.log(`  ✓ Updated ${ids.length} rows: "Bimal/Mohit/Mahesh" → "Bimal"`);
  } else {
    console.log('  ✓ No "Bimal/Mohit/Mahesh" rows found (already fixed)');
  }

  console.log('\n=== Step 3: Import Expense Grid data (money given to people) ===');
  // This is the Expense Grid sheet — tracks daily allowances/advances given to individuals
  // Columns: Date, Babu Khan, Bimal, Bimal/Mohit/Mahesh(shared), Janu Khan, Laxman, Mahesh, Misc, Mohit, Office Expense
  // The "Bimal/Mohit/Mahesh" column = shared expenses already in daily_expenses → skip
  // The individual columns = advances/allowances given TO that person

  const gridData = [
    // date, person, amount, category
    // Babu Khan
    ['2026-06-01', 'Babu Khan', 10000, 'Advance'],
    ['2026-06-02', 'Babu Khan', 1500, 'Daily Allowance'],
    ['2026-06-03', 'Babu Khan', 490, 'Daily Allowance'],
    ['2026-06-04', 'Babu Khan', 500, 'Daily Allowance'],
    ['2026-06-05', 'Babu Khan', 500, 'Daily Allowance'],
    ['2026-06-07', 'Babu Khan', 1000, 'Daily Allowance'],
    ['2026-06-08', 'Babu Khan', 1000, 'Daily Allowance'],
    ['2026-06-10', 'Babu Khan', 1000, 'Daily Allowance'],
    ['2026-06-11', 'Babu Khan', 500, 'Daily Allowance'],
    ['2026-06-13', 'Babu Khan', 1000, 'Daily Allowance'],

    // Bimal
    ['2026-06-05', 'Bimal', 110, 'Daily Allowance'],
    ['2026-06-08', 'Bimal', 160, 'Daily Allowance'],
    ['2026-06-09', 'Bimal', 3290, 'Daily Allowance'],
    ['2026-06-10', 'Bimal', 600, 'Daily Allowance'],

    // Janu Khan
    ['2026-06-02', 'Janu Khan', 1500, 'Daily Allowance'],
    ['2026-06-04', 'Janu Khan', 500, 'Daily Allowance'],
    ['2026-06-05', 'Janu Khan', 500, 'Daily Allowance'],
    ['2026-06-07', 'Janu Khan', 1000, 'Daily Allowance'],
    ['2026-06-08', 'Janu Khan', 1000, 'Daily Allowance'],
    ['2026-06-10', 'Janu Khan', 1000, 'Daily Allowance'],
    ['2026-06-12', 'Janu Khan', 500, 'Daily Allowance'],
    ['2026-06-13', 'Janu Khan', 1000, 'Daily Allowance'],

    // Laxman
    ['2026-06-03', 'Laxman', 500, 'Daily Allowance'],
    ['2026-06-04', 'Laxman', 500, 'Daily Allowance'],
    ['2026-06-05', 'Laxman', 6000, 'Advance'],
    ['2026-06-06', 'Laxman', 500, 'Daily Allowance'],
    ['2026-06-07', 'Laxman', 500, 'Daily Allowance'],
    ['2026-06-08', 'Laxman', 2000, 'Daily Allowance'],
    ['2026-06-10', 'Laxman', 1000, 'Daily Allowance'],

    // Mahesh
    ['2026-06-03', 'Mahesh', 200, 'Daily Allowance'],

    // Mohit
    ['2026-06-04', 'Mohit', 349, 'Daily Allowance'],
    ['2026-06-08', 'Mohit', 160, 'Daily Allowance'],

    // Misc
    ['2026-06-06', 'Kamal', 1150, 'Other'],

    // Office Expense
    ['2026-06-06', 'Kamal', 660, 'Other'],
  ];

  // Check which already exist (the 3 daily allowances from old daily_expenses: Janu Khan 12/06, Babu Khan 13/06, Janu Khan 13/06)
  // Those are already in expenses table, so filter them out
  const existingCheck = await supabase
    .from('expenses')
    .select('date, person, category, amount')
    .in('category', ['Daily Allowance', 'Advance']);

  const existingSet = new Set(
    (existingCheck.data || []).map(e => `${e.date}|${e.person}|${e.amount}`)
  );

  const newRows = gridData
    .filter(([date, person, amount]) => !existingSet.has(`${date}|${person}|${amount}`))
    .map(([date, person, amount, category]) => ({
      date,
      expense_type: 'operational',
      person,
      category,
      amount,
      description: category === 'Advance' ? 'Advance payment' : '',
      paid_by: 'JM transport',
      status: 'Paid',
    }));

  if (newRows.length > 0) {
    const { error: insErr } = await supabase.from('expenses').insert(newRows);
    if (insErr) console.error('  ERROR inserting grid data:', insErr.message);
    else console.log(`  ✓ Inserted ${newRows.length} expense grid records`);
  } else {
    console.log('  ✓ All grid data already exists');
  }

  // Verify counts
  console.log('\n=== Summary ===');
  const { count: expCount } = await supabase.from('expenses').select('*', { count: 'exact', head: true });
  const { count: partnerCount } = await supabase.from('partners').select('*', { count: 'exact', head: true });
  console.log(`  Total expenses: ${expCount}`);
  console.log(`  Total partners: ${partnerCount}`);

  console.log('\n✅ Done!');
}

fix().catch(console.error);
