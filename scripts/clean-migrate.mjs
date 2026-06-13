import { createClient } from '@supabase/supabase-js';

const s = createClient(
  'https://cnvqqqqzgkjvdnqmcdwy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNudnFxcXF6Z2tqdmRucW1jZHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNzI4MzcsImV4cCI6MjA5Njk0ODgzN30.pYvqQc-xdcV0dQJ31LIcteZ2zuPzohVHtpEAeSo1q1A'
);

async function clean() {
  console.log('=== STEP 1: Delete all data ===');
  // Delete in FK order
  for (const table of ['banking_information', 'capital_contributions', 'expenses', 'trips', 'routes', 'vehicles', 'drivers', 'partners']) {
    const { error } = await s.from(table).delete().gte('id', 0);
    if (error) console.error(`  ERROR ${table}:`, error.message);
    else console.log(`  ✓ Cleared ${table}`);
  }

  console.log('\n=== STEP 2: Insert master data ===');

  // Partners: 2 entities + 4 JM partners + drivers + group
  const partners = [
    'JM transport', 'Mahesh',
    'Kamal', 'Subham', 'Bimal', 'Mohit',
    'Babu Khan', 'Janu Khan', 'Laxman', 'Pratap Ram',
    'Bimal/Mohit/Mahesh',
  ].map(name => ({ name }));
  let { error } = await s.from('partners').insert(partners);
  if (error) console.error('  ERROR partners:', error.message);
  else console.log(`  ✓ partners: ${partners.length}`);

  // Drivers
  const drivers = ['Pratap Ram', 'Laxman', 'Babu Khan', 'Janu Khan'].map(name => ({ name }));
  ({ error } = await s.from('drivers').insert(drivers));
  if (error) console.error('  ERROR drivers:', error.message);
  else console.log(`  ✓ drivers: ${drivers.length}`);

  // Vehicles
  const vehicles = [
    { vehicle_number: 'RJ43GA0834', vehicle_type: 'Truck', model: '4018', capacity_tons: 35 },
    { vehicle_number: 'RJ07GD6596', vehicle_type: 'Truck', model: '5525', capacity_tons: 42 },
    { vehicle_number: 'HR26CW7512', vehicle_type: 'Personal Car' },
  ];
  ({ error } = await s.from('vehicles').insert(vehicles));
  if (error) console.error('  ERROR vehicles:', error.message);
  else console.log(`  ✓ vehicles: ${vehicles.length}`);

  // Routes
  const routes = [
    { origin: 'washrey', destination: 'chirai', route_name: 'washrey-chirai', distance_km: 60, standard_rate_per_ton: 270 },
    { origin: 'khvda', destination: 'kandla', route_name: 'khavda-kandla', distance_km: 150, standard_rate_per_ton: 500 },
    { origin: 'kodol', destination: 'padna', route_name: 'kodol-padana', distance_km: 70, standard_rate_per_ton: 295 },
  ];
  ({ error } = await s.from('routes').insert(routes));
  if (error) console.error('  ERROR routes:', error.message);
  else console.log(`  ✓ routes: ${routes.length}`);

  console.log('\n=== STEP 3: Insert trips (27) ===');
  const trips = [
    { date:'2026-05-25', vehicle_number:'RJ07GD6596', route_name:'washrey-chirai', driver_name:'Pratap Ram', weight_tons:48.20, distance_km:120, rate_per_ton:275, total_revenue:13022, advance_paid:0, balance_due:0 },
    { date:'2026-05-27', vehicle_number:'RJ07GD6596', route_name:'washrey-chirai', driver_name:'Pratap Ram', weight_tons:50, distance_km:120, rate_per_ton:275, total_revenue:13499, advance_paid:0, balance_due:0 },
    { date:'2026-05-30', vehicle_number:'RJ07GD6596', route_name:'washrey-chirai', driver_name:'Pratap Ram', weight_tons:102.50, distance_km:240, rate_per_ton:275, total_revenue:27692, advance_paid:0, balance_due:0 },
    { date:'2026-05-30', vehicle_number:'RJ07GD6596', route_name:'washrey-chirai', driver_name:'Pratap Ram', weight_tons:50, distance_km:120, rate_per_ton:275, total_revenue:13766, advance_paid:0, balance_due:0 },
    { date:'2026-06-02', vehicle_number:'RJ07GD6596', route_name:'washrey-chirai', driver_name:'Laxman', weight_tons:50, distance_km:120, rate_per_ton:275, total_revenue:13752, advance_paid:0, balance_due:0 },
    { date:'2026-06-05', vehicle_number:'RJ43GA0834', route_name:'khavda-kandla', driver_name:'Laxman', weight_tons:34, distance_km:150, rate_per_ton:500, total_revenue:18684, advance_paid:0, balance_due:0 },
    { date:'2026-06-04', vehicle_number:'RJ07GD6596', route_name:'washrey-chirai', driver_name:'Babu Khan', weight_tons:50.72, distance_km:120, rate_per_ton:275, total_revenue:13948, advance_paid:0, balance_due:0 },
    { date:'2026-06-05', vehicle_number:'RJ07GD6596', route_name:'washrey-chirai', driver_name:'Babu Khan', weight_tons:54.16, distance_km:120, rate_per_ton:275, total_revenue:14894, advance_paid:0, balance_due:0 },
    { date:'2026-06-06', vehicle_number:'RJ07GD6596', route_name:'washrey-chirai', driver_name:'Janu Khan', weight_tons:52.15, distance_km:120, rate_per_ton:275, total_revenue:14341, advance_paid:0, balance_due:0 },
    { date:'2026-06-06', vehicle_number:'RJ07GD6596', route_name:'washrey-chirai', driver_name:'Janu Khan', weight_tons:53.52, distance_km:120, rate_per_ton:275, total_revenue:14718, advance_paid:0, balance_due:0 },
    { date:'2026-06-06', vehicle_number:'RJ07GD6596', route_name:'washrey-chirai', driver_name:'Babu Khan', weight_tons:52.98, distance_km:120, rate_per_ton:275, total_revenue:14569, advance_paid:0, balance_due:0 },
    { date:'2026-06-06', vehicle_number:'RJ43GA0834', route_name:'washrey-chirai', driver_name:'Laxman', weight_tons:34.65, distance_km:120, rate_per_ton:275, total_revenue:9528, advance_paid:0, balance_due:0 },
    { date:'2026-06-06', vehicle_number:'RJ07GD6596', route_name:'washrey-chirai', driver_name:'Babu Khan', weight_tons:52.94, distance_km:120, rate_per_ton:275, total_revenue:14561, advance_paid:0, balance_due:0 },
    { date:'2026-06-07', vehicle_number:'RJ07GD6596', route_name:'washrey-chirai', driver_name:'Janu Khan', weight_tons:52.94, distance_km:120, rate_per_ton:275, total_revenue:14561, advance_paid:0, balance_due:0 },
    { date:'2026-06-07', vehicle_number:'RJ07GD6596', route_name:'washrey-chirai', driver_name:'Babu Khan', weight_tons:52.94, distance_km:120, rate_per_ton:275, total_revenue:14561, advance_paid:0, balance_due:0 },
    { date:'2026-06-09', vehicle_number:'RJ43GA0834', route_name:'washrey-chirai', driver_name:'Laxman', weight_tons:35, distance_km:120, rate_per_ton:275, total_revenue:10000, advance_paid:0, balance_due:0 },
    { date:'2026-06-09', vehicle_number:'RJ43GA0834', route_name:'washrey-chirai', driver_name:'Laxman', weight_tons:35, distance_km:120, rate_per_ton:275, total_revenue:10605, advance_paid:0, balance_due:0 },
    { date:'2026-06-09', vehicle_number:'RJ43GA0834', route_name:'washrey-chirai', driver_name:'Laxman', weight_tons:34.99, distance_km:120, rate_per_ton:275, total_revenue:9622.25, advance_paid:0, balance_due:0 },
    { date:'2026-06-09', vehicle_number:'RJ07GD6596', route_name:'washrey-chirai', driver_name:'Babu Khan', weight_tons:50.78, distance_km:120, rate_per_ton:275, total_revenue:15908.75, advance_paid:0, balance_due:0 },
    { date:'2026-06-09', vehicle_number:'RJ07GD6596', route_name:'washrey-chirai', driver_name:'Janu Khan', weight_tons:57.85, distance_km:120, rate_per_ton:275, total_revenue:13964.50, advance_paid:0, balance_due:0 },
    { date:'2026-06-10', vehicle_number:'RJ07GD6596', route_name:'washrey-chirai', driver_name:'Babu Khan', weight_tons:53.23, distance_km:120, rate_per_ton:275, total_revenue:14638.25, advance_paid:0, balance_due:0 },
    { date:'2026-06-10', vehicle_number:'RJ07GD6596', route_name:'kodol-padana', driver_name:'Janu Khan', weight_tons:59.86, distance_km:140, rate_per_ton:295, total_revenue:17658, advance_paid:0, balance_due:0 },
    { date:'2026-06-10', vehicle_number:'RJ43GA0834', route_name:'kodol-padana', driver_name:'Laxman', weight_tons:36.08, distance_km:140, rate_per_ton:295, total_revenue:10643.60, advance_paid:0, balance_due:0 },
    { date:'2026-06-11', vehicle_number:'RJ43GA0834', route_name:'kodol-padana', driver_name:'Laxman', weight_tons:42.37, distance_km:140, rate_per_ton:295, total_revenue:12499.15, advance_paid:0, balance_due:0 },
    { date:'2026-06-12', vehicle_number:'RJ43GA0834', route_name:'kodol-padana', driver_name:'Laxman', weight_tons:37.85, distance_km:140, rate_per_ton:295, total_revenue:11165.75, advance_paid:0, balance_due:0 },
    { date:'2026-06-13', vehicle_number:'RJ43GA0834', route_name:'kodol-padana', driver_name:'Laxman', weight_tons:39.18, distance_km:140, rate_per_ton:295, total_revenue:11558.10, advance_paid:0, balance_due:0 },
    { date:'2026-06-13', vehicle_number:'RJ07GD6596', route_name:'kodol-padana', driver_name:'Babu Khan', weight_tons:56.52, distance_km:140, rate_per_ton:295, total_revenue:16673.40, advance_paid:0, balance_due:0 },
  ];
  ({ error } = await s.from('trips').insert(trips));
  if (error) console.error('  ERROR trips:', error.message);
  else console.log(`  ✓ trips: ${trips.length}`);

  console.log('\n=== STEP 4: Insert vehicle expenses (77) from Vehicle Expenses sheet ===');
  // paid_by_person = which JM partner paid, person = null (no recipient for vehicle expenses)
  const ve = [
    { date:'2026-05-13', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Others', amount:7500, description:'Mahindera First Choice Pyment', paid_by:'JM transport', paid_by_person:'Kamal', status:'Paid' },
    { date:'2026-05-18', expense_type:'vehicle', vehicle_number:'HR26CW7512', category:'Fuel (Diesel)', amount:2000, description:'BKN->GandhiDham', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-05-19', expense_type:'vehicle', vehicle_number:'HR26CW7512', category:'Fuel (Diesel)', amount:3707, description:'BKN->GandhiDham', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-05-19', expense_type:'vehicle', vehicle_number:'HR26CW7512', category:'Toll Taxes', amount:3103, description:'Toll Tax Pass', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-05-19', expense_type:'vehicle', vehicle_number:'HR26CW7512', category:'Fuel (Diesel)', amount:1000, description:'BKN->GandhiDham', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-05-19', expense_type:'vehicle', vehicle_number:'HR26CW7512', category:'Fuel (Diesel)', amount:472, description:'BKN->GandhiDham', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-05-18', expense_type:'vehicle', vehicle_number:'HR26CW7512', category:'Maintenance', amount:10800, description:'Tyre Changes', paid_by:'JM transport', paid_by_person:'Kamal', status:'Paid' },
    { date:'2026-05-20', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Others', amount:29000, description:'Parking charge', paid_by:'JM transport', paid_by_person:'Kamal', status:'Paid' },
    { date:'2026-05-20', expense_type:'vehicle', vehicle_number:'HR26CW7512', category:'Fuel (Diesel)', amount:4550, description:'In GandhiDham', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-05-20', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Others', amount:2500, description:'Keys making', paid_by:'JM transport', paid_by_person:'Kamal', status:'Paid' },
    { date:'2026-05-20', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Others', amount:800, description:'battery charge', paid_by:'JM transport', paid_by_person:'Kamal', status:'Paid' },
    { date:'2026-05-22', expense_type:'vehicle', vehicle_number:'HR26CW7512', category:'Fuel (Diesel)', amount:2000, description:'Krishna Petrolium', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-05-22', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Fuel (Diesel)', amount:2050, description:'Krishna Petrolium', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-05-22', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Fuel (Diesel)', amount:2050, description:'', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-05-23', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Insurance', amount:2000, description:'Gujarat tax', paid_by:'JM transport', paid_by_person:'Kamal', status:'Paid' },
    { date:'2026-05-23', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Others', amount:100, description:'Accessories', paid_by:'JM transport', paid_by_person:'Kamal', status:'Paid' },
    { date:'2026-05-23', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Others', amount:500, description:'washing', paid_by:'JM transport', paid_by_person:'Kamal', status:'Paid' },
    { date:'2026-05-23', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Others', amount:40, description:'Water', paid_by:'JM transport', paid_by_person:'Kamal', status:'Paid' },
    { date:'2026-05-23', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Others', amount:500, description:'Battery charge', paid_by:'JM transport', paid_by_person:'Kamal', status:'Paid' },
    { date:'2026-05-23', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Others', amount:300, description:'battery start', paid_by:'JM transport', paid_by_person:'Kamal', status:'Paid' },
    { date:'2026-05-23', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Maintenance', amount:100, description:'window fix', paid_by:'JM transport', paid_by_person:'Kamal', status:'Paid' },
    { date:'2026-05-22', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Fuel (Diesel)', amount:2100, description:'', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-05-24', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Maintenance', amount:12200, description:'Valve Gear Fix', paid_by:'JM transport', paid_by_person:'Bimal', status:'Paid' },
    { date:'2026-05-24', expense_type:'vehicle', vehicle_number:'HR26CW7512', category:'Fuel (Diesel)', amount:2000, description:'', paid_by:'JM transport', status:'Paid' },
    { date:'2026-05-24', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Maintenance', amount:320, description:'mistri', paid_by:'JM transport', paid_by_person:'Kamal', status:'Paid' },
    { date:'2026-05-25', expense_type:'vehicle', vehicle_number:'RJ43GA0834', category:'Others', amount:1800, description:'parking', paid_by:'JM transport', paid_by_person:'Kamal', status:'Paid' },
    { date:'2026-05-25', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Others', amount:360, description:'belt', paid_by:'JM transport', paid_by_person:'Kamal', status:'Paid' },
    { date:'2026-05-25', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Others', amount:1150, description:'chalni', paid_by:'JM transport', paid_by_person:'Mohit', status:'Paid' },
    { date:'2026-05-26', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Fuel (Diesel)', amount:9808, description:'RR petrolium', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-05-26', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Maintenance', amount:11000, description:'Truck maintaice', paid_by:'JM transport', paid_by_person:'Bimal', status:'Paid' },
    { date:'2026-05-27', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Fuel (Diesel)', amount:14712, description:'Reliable Pettrolium', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-05-29', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Maintenance', amount:2000, description:'Lathe Machine', paid_by:'JM transport', paid_by_person:'Mohit', status:'Paid' },
    { date:'2026-05-29', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Maintenance', amount:8900, description:'Truck Part', paid_by:'JM transport', paid_by_person:'Bimal', status:'Paid' },
    { date:'2026-05-30', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Fuel (Diesel)', amount:8000, description:'Jalyan Petrol Pump', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-06-02', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Fuel (Diesel)', amount:4904, description:'RR petrolium', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-06-03', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Others', amount:5000, description:'Gujarat tax', paid_by:'JM transport', paid_by_person:'Mohit', status:'Paid' },
    { date:'2026-06-03', expense_type:'vehicle', vehicle_number:'HR26CW7512', category:'Fuel (Diesel)', amount:3000, description:'Shree krishna', paid_by:'JM transport', status:'Paid' },
    { date:'2026-06-03', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Maintenance', amount:195000, description:'Tyre', paid_by:'JM transport', paid_by_person:'Mohit', status:'Paid' },
    { date:'2026-06-03', expense_type:'vehicle', vehicle_number:'RJ43GA0834', category:'Insurance', amount:53764, description:'Shri Ran', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-06-03', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Maintenance', amount:480, description:'Truck Part', paid_by:'JM transport', paid_by_person:'Mohit', status:'Paid' },
    { date:'2026-06-03', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Fuel (Diesel)', amount:3000, description:'Diesel trishul petrolium', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-06-03', expense_type:'vehicle', vehicle_number:'RJ43GA0834', category:'Fuel (Diesel)', amount:4500, description:'From Kamal for diesel', paid_by:'JM transport', paid_by_person:'Kamal', status:'Paid' },
    { date:'2026-06-03', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Fuel (Diesel)', amount:10093, description:'jay Murlidhar petrolium', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-06-03', expense_type:'vehicle', vehicle_number:'RJ43GA0834', category:'Fuel (Diesel)', amount:9892, description:'Khavda petrolium', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-06-04', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Fuel (Diesel)', amount:9808, description:'Jalyan Petrol Pump', paid_by:'JM transport', status:'Paid' },
    { date:'2026-06-05', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Fuel (Diesel)', amount:25000, description:'Jalyan Petrol Pump', paid_by:'JM transport', status:'Paid' },
    { date:'2026-06-05', expense_type:'vehicle', vehicle_number:'RJ43GA0834', category:'Maintenance', amount:2500, description:'weilding', paid_by:'JM transport', paid_by_person:'Mohit', status:'Paid' },
    { date:'2026-06-05', expense_type:'vehicle', vehicle_number:'RJ43GA0834', category:'Others', amount:900, description:'jhali', paid_by:'JM transport', paid_by_person:'Mohit', status:'Paid' },
    { date:'2026-06-06', expense_type:'vehicle', vehicle_number:'HR26CW7512', category:'Fuel (Diesel)', amount:2000, description:'krishna petrolium', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-06-06', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Maintenance', amount:500, description:'chakka to janu khan', paid_by:'JM transport', paid_by_person:'Mohit', status:'Paid' },
    { date:'2026-06-06', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Fuel (Diesel)', amount:9808, description:'', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-06-07', expense_type:'vehicle', vehicle_number:'RJ43GA0834', category:'Fuel (Diesel)', amount:19616, description:'rr petrolium', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-06-07', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Fuel (Diesel)', amount:19616, description:'reliable petrolium', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-06-07', expense_type:'vehicle', vehicle_number:'RJ43GA0834', category:'Maintenance', amount:8800, description:'oil filter change + labour', paid_by:'JM transport', paid_by_person:'Mohit', status:'Paid' },
    { date:'2026-06-07', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Maintenance', amount:5500, description:'Gas lek fix', paid_by:'JM transport', paid_by_person:'Mohit', status:'Paid' },
    { date:'2026-06-07', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Maintenance', amount:1150, description:'saman ka', paid_by:'JM transport', paid_by_person:'Mohit', status:'Paid' },
    { date:'2026-06-07', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Maintenance', amount:700, description:'labour', paid_by:'JM transport', paid_by_person:'Mohit', status:'Paid' },
    { date:'2026-06-09', expense_type:'vehicle', vehicle_number:'HR26CW7512', category:'Fuel (Diesel)', amount:2000, description:'diesel from yes bank', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-06-09', expense_type:'vehicle', vehicle_number:'HR26CW7512', category:'Maintenance', amount:1600, description:'car wash and maintenance', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-06-09', expense_type:'vehicle', vehicle_number:'RJ43GA0834', category:'Fuel (Diesel)', amount:2850, description:'', paid_by:'JM transport', paid_by_person:'Bimal', status:'Paid' },
    { date:'2026-06-09', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Fuel (Diesel)', amount:29424, description:'reliable petrolium', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-06-09', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Maintenance', amount:300, description:'tyre repair', paid_by:'JM transport', paid_by_person:'Mohit', status:'Paid' },
    { date:'2026-06-09', expense_type:'vehicle', vehicle_number:'RJ43GA0834', category:'Fuel (Diesel)', amount:9808, description:'rr petrolium', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-06-10', expense_type:'vehicle', vehicle_number:'RJ43GA0834', category:'Maintenance', amount:700, description:'kabani', paid_by:'JM transport', paid_by_person:'Mohit', status:'Paid' },
    { date:'2026-06-10', expense_type:'vehicle', vehicle_number:'RJ43GA0834', category:'Fuel (Diesel)', amount:2000, description:'krushna petrolium', paid_by:'JM transport', paid_by_person:'Bimal', status:'Paid' },
    { date:'2026-06-12', expense_type:'vehicle', vehicle_number:'HR26CW7512', category:'Fuel (Diesel)', amount:2000, description:'reliable petrolium', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-06-12', expense_type:'vehicle', vehicle_number:'HR26CW7512', category:'Fuel (Diesel)', amount:9808, description:'reliable petrolium', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-06-12', expense_type:'vehicle', vehicle_number:'RJ43GA0834', category:'Others', amount:5000, description:'gaadi name transfer', paid_by:'JM transport', paid_by_person:'Kamal', status:'Paid' },
    { date:'2026-06-12', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Fuel (Diesel)', amount:9808, description:'reliable petrolium', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-06-12', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Fuel (Diesel)', amount:9808, description:'reliable petrolium', paid_by:'JM transport', paid_by_person:'Subham', status:'Paid' },
    { date:'2026-06-13', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Others', amount:550, description:'Gaadi bhdne ke roj', paid_by:'JM transport', paid_by_person:'Mohit', status:'Paid' },
    { date:'2026-06-13', expense_type:'vehicle', vehicle_number:'RJ43GA0834', category:'Maintenance', amount:2400, description:'Parts Ka Gear Oil', paid_by:'JM transport', paid_by_person:'Mohit', status:'Paid' },
    { date:'2026-06-13', expense_type:'vehicle', vehicle_number:'RJ43GA0834', category:'Maintenance', amount:350, description:'mistery', paid_by:'JM transport', paid_by_person:'Mohit', status:'Paid' },
    { date:'2026-06-13', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Maintenance', amount:400, description:'mistery', paid_by:'JM transport', paid_by_person:'Mohit', status:'Paid' },
    { date:'2026-06-13', expense_type:'vehicle', vehicle_number:'RJ43GA0834', category:'Fuel (Diesel)', amount:4904, description:'Diesel', paid_by:'JM transport', paid_by_person:'Bimal', status:'Paid' },
    { date:'2026-06-13', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Fuel (Diesel)', amount:11769, description:'Diesel', paid_by:'JM transport', paid_by_person:'Bimal', status:'Paid' },
    { date:'2026-06-13', expense_type:'vehicle', vehicle_number:'RJ07GD6596', category:'Fuel (Diesel)', amount:19616, description:'Diesel', paid_by:'JM transport', paid_by_person:'Bimal', status:'Paid' },
  ];
  ({ error } = await s.from('expenses').insert(ve));
  if (error) console.error('  ERROR vehicle expenses:', error.message);
  else console.log(`  ✓ vehicle expenses: ${ve.length}`);

  console.log('\n=== STEP 5: Insert Daily Expenses sheet (34 Bimal/Mohit/Mahesh shared rows) ===');
  // Source: Daily Expenses sheet — person = Bimal/Mohit/Mahesh (shared group)
  // EXCLUDES the 3 driver allowance rows (already in Expense Grid)
  const daily = [
    { date:'2026-05-19', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Meals', amount:300, description:'In Gandhi Dham', paid_by:'JM transport' },
    { date:'2026-05-19', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Hotel Stay', amount:1600, description:'Rent Gandhidham', paid_by:'JM transport' },
    { date:'2026-05-20', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Meals', amount:300, description:'In Gandhi Dham', paid_by:'JM transport' },
    { date:'2026-05-23', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Rent', amount:23500, description:'room rent advance', paid_by:'JM transport' },
    { date:'2026-05-22', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Meals', amount:500, description:'lunch', paid_by:'JM transport' },
    { date:'2026-05-23', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Meals', amount:280, description:'lunch', paid_by:'JM transport' },
    { date:'2026-05-24', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Meals', amount:402, description:'Lunch', paid_by:'JM transport' },
    { date:'2026-05-25', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Meals', amount:470, description:'lunch', paid_by:'JM transport' },
    { date:'2026-05-25', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Supplies', amount:831, description:'Dmart bill', paid_by:'JM transport' },
    { date:'2026-05-25', expense_type:'personal', person:'Bimal/Mohit/Mahesh', category:'Personal Care', amount:400, description:'salon', paid_by:'JM transport' },
    { date:'2026-05-25', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Supplies', amount:173, description:'Dmart bill', paid_by:'JM transport' },
    { date:'2026-05-26', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Meals', amount:160, description:'Dinner', paid_by:'JM transport' },
    { date:'2026-05-27', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Rent', amount:265, description:'House expense', paid_by:'JM transport' },
    { date:'2026-05-27', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Meals', amount:400, description:'lunch', paid_by:'JM transport' },
    { date:'2026-05-30', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Rent', amount:240, description:'Room Expense', paid_by:'JM transport' },
    { date:'2026-05-31', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Rent', amount:150, description:'Room Expense', paid_by:'JM transport' },
    { date:'2026-05-31', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Meals', amount:210, description:'Breakfast', paid_by:'JM transport' },
    { date:'2026-05-31', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Meals', amount:200, description:'dinner', paid_by:'JM transport' },
    { date:'2026-05-31', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Supplies', amount:185, description:'lock', paid_by:'JM transport' },
    { date:'2026-05-31', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Meals', amount:50, description:'chai', paid_by:'JM transport' },
    { date:'2026-05-31', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Meals', amount:120, description:'cold drink', paid_by:'JM transport' },
    { date:'2026-06-03', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Rent', amount:1000, description:'Room expense', paid_by:'JM transport' },
    { date:'2026-06-02', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Meals', amount:456, description:'Swiggy se', paid_by:'JM transport' },
    { date:'2026-06-04', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Meals', amount:500, description:'lunch', paid_by:'JM transport' },
    { date:'2026-06-05', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Meals', amount:335, description:'dinner', paid_by:'JM transport' },
    { date:'2026-06-05', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Meals', amount:60, description:'tea', paid_by:'JM transport' },
    { date:'2026-06-06', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Supplies', amount:400, description:'in jhaka travels for utensils', paid_by:'JM transport' },
    { date:'2026-06-06', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Meals', amount:270, description:'dinner', paid_by:'JM transport' },
    { date:'2026-06-07', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Meals', amount:4900, description:'dmart bill', paid_by:'JM transport' },
    { date:'2026-06-07', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Supplies', amount:303, description:'blinkit for sabji', paid_by:'JM transport' },
    { date:'2026-06-09', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Meals', amount:150, description:'only bimal', paid_by:'JM transport' },
    { date:'2026-06-09', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Meals', amount:120, description:'fruits', paid_by:'JM transport' },
    { date:'2026-06-12', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Meals', amount:474, description:'blinkit order', paid_by:'JM transport' },
    { date:'2026-06-13', expense_type:'operational', person:'Bimal/Mohit/Mahesh', category:'Supplies', amount:130, description:'', paid_by:'JM transport' },
  ];
  ({ error } = await s.from('expenses').insert(daily));
  if (error) console.error('  ERROR daily expenses:', error.message);
  else console.log(`  ✓ daily expenses: ${daily.length}`);

  console.log('\n=== STEP 6: Insert Expense Grid data (money given to individuals) ===');
  // Source: Expense Grid sheet — person = to whom money was given
  const grid = [
    // Babu Khan (driver) — advance + daily allowances
    { date:'2026-06-01', expense_type:'operational', person:'Babu Khan', category:'Advance', amount:10000, description:'Advance payment', paid_by:'JM transport' },
    { date:'2026-06-02', expense_type:'operational', person:'Babu Khan', category:'Daily Allowance', amount:1500, paid_by:'JM transport' },
    { date:'2026-06-03', expense_type:'operational', person:'Babu Khan', category:'Daily Allowance', amount:490, paid_by:'JM transport' },
    { date:'2026-06-04', expense_type:'operational', person:'Babu Khan', category:'Daily Allowance', amount:500, paid_by:'JM transport' },
    { date:'2026-06-05', expense_type:'operational', person:'Babu Khan', category:'Daily Allowance', amount:500, paid_by:'JM transport' },
    { date:'2026-06-07', expense_type:'operational', person:'Babu Khan', category:'Daily Allowance', amount:1000, paid_by:'JM transport' },
    { date:'2026-06-08', expense_type:'operational', person:'Babu Khan', category:'Daily Allowance', amount:1000, paid_by:'JM transport' },
    { date:'2026-06-10', expense_type:'operational', person:'Babu Khan', category:'Daily Allowance', amount:1000, paid_by:'JM transport' },
    { date:'2026-06-11', expense_type:'operational', person:'Babu Khan', category:'Daily Allowance', amount:500, paid_by:'JM transport' },
    { date:'2026-06-13', expense_type:'operational', person:'Babu Khan', category:'Daily Allowance', amount:1000, paid_by:'JM transport' },
    // Janu Khan (driver) — daily allowances
    { date:'2026-06-02', expense_type:'operational', person:'Janu Khan', category:'Daily Allowance', amount:1500, paid_by:'JM transport' },
    { date:'2026-06-04', expense_type:'operational', person:'Janu Khan', category:'Daily Allowance', amount:500, paid_by:'JM transport' },
    { date:'2026-06-05', expense_type:'operational', person:'Janu Khan', category:'Daily Allowance', amount:500, paid_by:'JM transport' },
    { date:'2026-06-07', expense_type:'operational', person:'Janu Khan', category:'Daily Allowance', amount:1000, paid_by:'JM transport' },
    { date:'2026-06-08', expense_type:'operational', person:'Janu Khan', category:'Daily Allowance', amount:1000, paid_by:'JM transport' },
    { date:'2026-06-10', expense_type:'operational', person:'Janu Khan', category:'Daily Allowance', amount:1000, paid_by:'JM transport' },
    { date:'2026-06-12', expense_type:'operational', person:'Janu Khan', category:'Daily Allowance', amount:500, paid_by:'JM transport' },
    { date:'2026-06-13', expense_type:'operational', person:'Janu Khan', category:'Daily Allowance', amount:1000, paid_by:'JM transport' },
    // Laxman (driver) — advance + daily allowances
    { date:'2026-06-03', expense_type:'operational', person:'Laxman', category:'Daily Allowance', amount:500, paid_by:'JM transport' },
    { date:'2026-06-04', expense_type:'operational', person:'Laxman', category:'Daily Allowance', amount:500, paid_by:'JM transport' },
    { date:'2026-06-05', expense_type:'operational', person:'Laxman', category:'Advance', amount:6000, description:'Advance payment', paid_by:'JM transport' },
    { date:'2026-06-06', expense_type:'operational', person:'Laxman', category:'Daily Allowance', amount:500, paid_by:'JM transport' },
    { date:'2026-06-07', expense_type:'operational', person:'Laxman', category:'Daily Allowance', amount:500, paid_by:'JM transport' },
    { date:'2026-06-08', expense_type:'operational', person:'Laxman', category:'Daily Allowance', amount:2000, paid_by:'JM transport' },
    { date:'2026-06-10', expense_type:'operational', person:'Laxman', category:'Daily Allowance', amount:1000, paid_by:'JM transport' },
    // Mahesh (individual partner)
    { date:'2026-06-03', expense_type:'operational', person:'Mahesh', category:'Daily Allowance', amount:200, paid_by:'JM transport' },
    // Bimal (JM partner) — personal expenses
    { date:'2026-06-05', expense_type:'personal', person:'Bimal', category:'Personal Care', amount:110, paid_by:'JM transport' },
    { date:'2026-06-08', expense_type:'personal', person:'Bimal', category:'Personal Care', amount:160, paid_by:'JM transport' },
    { date:'2026-06-09', expense_type:'personal', person:'Bimal', category:'Personal Care', amount:3290, paid_by:'JM transport' },
    { date:'2026-06-10', expense_type:'personal', person:'Bimal', category:'Personal Care', amount:600, paid_by:'JM transport' },
    // Mohit (JM partner) — personal expenses
    { date:'2026-06-04', expense_type:'personal', person:'Mohit', category:'Personal Care', amount:349, paid_by:'JM transport' },
    { date:'2026-06-08', expense_type:'personal', person:'Mohit', category:'Personal Care', amount:160, paid_by:'JM transport' },
    // Misc
    { date:'2026-06-06', expense_type:'operational', category:'Supplies', amount:1150, description:'Misc expense', paid_by:'JM transport' },
    // Office Expense
    { date:'2026-06-06', expense_type:'operational', category:'Supplies', amount:660, description:'Office expense', paid_by:'JM transport' },
  ];
  ({ error } = await s.from('expenses').insert(grid));
  if (error) console.error('  ERROR grid expenses:', error.message);
  else console.log(`  ✓ grid expenses: ${grid.length}`);

  console.log('\n=== STEP 7: Insert capital contributions (20) ===');
  const cc = [
    { date:'2026-05-24', contributor:'Subham', contribution_type:'Credit Card', value:16043, description:'In diesel', asset_details:'Indusind CC' },
    { date:'2026-05-24', contributor:'Bimal', contribution_type:'Credit Card', value:12200, description:'In Maintance' },
    { date:'2026-05-25', contributor:'Bimal', contribution_type:'Credit Card', value:1003, description:'for supply' },
    { date:'2026-05-26', contributor:'Subham', contribution_type:'Credit Card', value:9808, description:'diesel', asset_details:'HDFC CC' },
    { date:'2026-05-26', contributor:'Bimal', contribution_type:'Credit Card', value:11000, description:'to ashok leyland' },
    { date:'2026-05-27', contributor:'Subham', contribution_type:'Credit Card', value:14712, description:'In diesel', asset_details:'HDFC CC' },
    { date:'2026-05-30', contributor:'Subham', contribution_type:'Credit Card', value:8000, description:'In Diesel', asset_details:'HDFC CC' },
    { date:'2026-06-02', contributor:'Subham', contribution_type:'Credit Card', value:4904, description:'In Diesel', asset_details:'HDFC CC' },
    { date:'2026-06-03', contributor:'Subham', contribution_type:'Credit Card', value:3000, description:'In Diesel', asset_details:'HDFC CC' },
    { date:'2026-06-05', contributor:'Bimal', contribution_type:'Credit Card', value:10093, description:'Diesel' },
    { date:'2026-06-03', contributor:'Subham', contribution_type:'Credit Card', value:3000, description:'petrol', asset_details:'Indusind CC' },
    { date:'2026-06-06', contributor:'Subham', contribution_type:'Credit Card', value:2000, description:'diesel', asset_details:'Indusind CC' },
    { date:'2026-06-06', contributor:'Subham', contribution_type:'Credit Card', value:9808, description:'diesel', asset_details:'HDFC CC' },
    { date:'2026-06-07', contributor:'Bimal', contribution_type:'Credit Card', value:4900, description:'dmart' },
    { date:'2026-06-11', contributor:'Bimal', contribution_type:'Credit Card', value:2000, description:'diesel', asset_details:'Yes Bank' },
    { date:'2026-06-11', contributor:'Bimal', contribution_type:'Credit Card', value:2850, description:'diesel', asset_details:'Yes Bank' },
    { date:'2026-06-11', contributor:'Subham', contribution_type:'Credit Card', value:29424, description:'diesel', asset_details:'HDFC & Kotak(19616)' },
    { date:'2026-06-11', contributor:'Subham', contribution_type:'Credit Card', value:9808, description:'diesel', asset_details:'Kotak' },
    { date:'2026-06-11', contributor:'Bimal', contribution_type:'Credit Card', value:2000, description:'diesel', asset_details:'Yes Bank' },
    { date:'2026-06-12', contributor:'Bimal', contribution_type:'Credit Card', value:2000, description:'diesel', asset_details:'Yes Bank' },
  ];
  ({ error } = await s.from('capital_contributions').insert(cc));
  if (error) console.error('  ERROR capital:', error.message);
  else console.log(`  ✓ capital contributions: ${cc.length}`);

  console.log('\n=== STEP 8: Insert banking information (3) ===');
  const bi = [
    { vehicle_number:'RJ43GA0834', bank_name:'Reliative', purchase_date:'2026-03-27', ex_showroom_price:1220000, down_payment:500000, loan_amount:500000, interest_rate:16, loan_tenure_months:10 },
    { vehicle_number:'RJ07GD6596', bank_name:'HDFC', purchase_date:'2026-05-20', ex_showroom_price:1970000, down_payment:1970000, loan_amount:1970000, interest_rate:9.99, loan_tenure_months:60, monthly_emi:50000 },
    { vehicle_number:'RJ43GA0834', bank_name:'Friend(Mukesh)', purchase_date:'2026-03-27', ex_showroom_price:1220000, down_payment:500000, loan_amount:500000, interest_rate:0 },
  ];
  ({ error } = await s.from('banking_information').insert(bi));
  if (error) console.error('  ERROR banking:', error.message);
  else console.log(`  ✓ banking: ${bi.length}`);

  // === VERIFY ===
  console.log('\n=== VERIFICATION ===');
  const tables = ['partners','drivers','vehicles','routes','trips','expenses','capital_contributions','banking_information'];
  for (const t of tables) {
    const { count } = await s.from(t).select('*', { count:'exact', head:true });
    console.log(`  ${t}: ${count}`);
  }

  // Verify expense grid totals
  console.log('\n=== Expense Grid totals ===');
  const { data: exp } = await s.from('expenses').select('person, amount').neq('expense_type','vehicle');
  const totals = {};
  exp.forEach(r => { const p = r.person||'(no person)'; totals[p] = (totals[p]||0) + Number(r.amount); });
  const expected = { 'Babu Khan':17490, 'Janu Khan':7000, 'Laxman':11000, 'Mahesh':200, 'Bimal':4160, 'Mohit':509, 'Bimal/Mohit/Mahesh':39834, '(no person)':1810 };
  for (const [p,e] of Object.entries(expected)) {
    const a = totals[p]||0;
    console.log(`  ${a===e?'✓':'✗'} ${p}: ₹${a} (expected ₹${e})`);
  }

  console.log('\n✅ Clean migration complete!');
}

clean().catch(console.error);
