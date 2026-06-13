import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://cnvqqqqzgkjvdnqmcdwy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNudnFxcXF6Z2tqdmRucW1jZHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNzI4MzcsImV4cCI6MjA5Njk0ODgzN30.pYvqQc-xdcV0dQJ31LIcteZ2zuPzohVHtpEAeSo1q1A'
);

async function insert(table, rows) {
  const { error } = await supabase.from(table).upsert(rows, { onConflict: table === 'partners' || table === 'drivers' ? 'name' : table === 'vehicles' ? 'vehicle_number' : table === 'routes' ? 'route_name' : 'id' });
  if (error) {
    console.error(`  ERROR ${table}:`, error.message);
    return false;
  }
  console.log(`  ✓ ${table}: ${rows.length} rows`);
  return true;
}

async function seed() {
  console.log('Seeding database...\n');

  // 1. Partners
  await insert('partners', [
    { name: 'JM transport' },
    { name: 'Kamal' },
    { name: 'Subham' },
    { name: 'Bimal' },
    { name: 'Mohit' },
    { name: 'Mahesh' },
  ]);

  // 2. Drivers
  await insert('drivers', [
    { name: 'Pratap Ram' },
    { name: 'Laxman' },
    { name: 'Babu Khan' },
    { name: 'Janu Khan' },
  ]);

  // 3. Vehicles
  await insert('vehicles', [
    { vehicle_number: 'RJ43GA0834', vehicle_type: 'Truck', model: '4018', capacity_tons: 35 },
    { vehicle_number: 'RJ07GD6596', vehicle_type: 'Truck', model: '5525', capacity_tons: 42 },
    { vehicle_number: 'HR26CW7512', vehicle_type: 'Personal Car' },
  ]);

  // 4. Routes
  await insert('routes', [
    { origin: 'washrey', destination: 'chirai', route_name: 'washrey-chirai', distance_km: 60, standard_rate_per_ton: 270.00 },
    { origin: 'khvda', destination: 'kandla', route_name: 'khavda-kandla', distance_km: 150, standard_rate_per_ton: 500.00 },
    { origin: 'kodol', destination: 'padna', route_name: 'kodol-padana', distance_km: 70, standard_rate_per_ton: 295.00 },
  ]);

  // 5. Trips
  const trips = [
    { date: '2026-05-25', vehicle_number: 'RJ07GD6596', route_name: 'washrey-chirai', driver_name: 'Pratap Ram', weight_tons: 48.20, distance_km: 120, rate_per_ton: 275, total_revenue: 13022, advance_paid: 0, balance_due: 0 },
    { date: '2026-05-27', vehicle_number: 'RJ07GD6596', route_name: 'washrey-chirai', driver_name: 'Pratap Ram', weight_tons: 50, distance_km: 120, rate_per_ton: 275, total_revenue: 13499, advance_paid: 0, balance_due: 0 },
    { date: '2026-05-30', vehicle_number: 'RJ07GD6596', route_name: 'washrey-chirai', driver_name: 'Pratap Ram', weight_tons: 102.50, distance_km: 240, rate_per_ton: 275, total_revenue: 27692, advance_paid: 0, balance_due: 0 },
    { date: '2026-05-30', vehicle_number: 'RJ07GD6596', route_name: 'washrey-chirai', driver_name: 'Pratap Ram', weight_tons: 50, distance_km: 120, rate_per_ton: 275, total_revenue: 13766, advance_paid: 0, balance_due: 0 },
    { date: '2026-06-02', vehicle_number: 'RJ07GD6596', route_name: 'washrey-chirai', driver_name: 'Laxman', weight_tons: 50, distance_km: 120, rate_per_ton: 275, total_revenue: 13752, advance_paid: 0, balance_due: 0 },
    { date: '2026-06-05', vehicle_number: 'RJ43GA0834', route_name: 'khavda-kandla', driver_name: 'Laxman', weight_tons: 34, distance_km: 150, rate_per_ton: 500, total_revenue: 18684, advance_paid: 0, balance_due: 0 },
    { date: '2026-06-04', vehicle_number: 'RJ07GD6596', route_name: 'washrey-chirai', driver_name: 'Babu Khan', weight_tons: 50.72, distance_km: 120, rate_per_ton: 275, total_revenue: 13948, advance_paid: 0, balance_due: 0 },
    { date: '2026-06-05', vehicle_number: 'RJ07GD6596', route_name: 'washrey-chirai', driver_name: 'Babu Khan', weight_tons: 54.16, distance_km: 120, rate_per_ton: 275, total_revenue: 14894, advance_paid: 0, balance_due: 0 },
    { date: '2026-06-06', vehicle_number: 'RJ07GD6596', route_name: 'washrey-chirai', driver_name: 'Janu Khan', weight_tons: 52.15, distance_km: 120, rate_per_ton: 275, total_revenue: 14341, advance_paid: 0, balance_due: 0 },
    { date: '2026-06-06', vehicle_number: 'RJ07GD6596', route_name: 'washrey-chirai', driver_name: 'Janu Khan', weight_tons: 53.52, distance_km: 120, rate_per_ton: 275, total_revenue: 14718, advance_paid: 0, balance_due: 0 },
    { date: '2026-06-06', vehicle_number: 'RJ07GD6596', route_name: 'washrey-chirai', driver_name: 'Babu Khan', weight_tons: 52.98, distance_km: 120, rate_per_ton: 275, total_revenue: 14569, advance_paid: 0, balance_due: 0 },
    { date: '2026-06-06', vehicle_number: 'RJ43GA0834', route_name: 'washrey-chirai', driver_name: 'Laxman', weight_tons: 34.65, distance_km: 120, rate_per_ton: 275, total_revenue: 9528, advance_paid: 0, balance_due: 0 },
    { date: '2026-06-06', vehicle_number: 'RJ07GD6596', route_name: 'washrey-chirai', driver_name: 'Babu Khan', weight_tons: 52.94, distance_km: 120, rate_per_ton: 275, total_revenue: 14561, advance_paid: 0, balance_due: 0 },
    { date: '2026-06-07', vehicle_number: 'RJ07GD6596', route_name: 'washrey-chirai', driver_name: 'Janu Khan', weight_tons: 52.94, distance_km: 120, rate_per_ton: 275, total_revenue: 14561, advance_paid: 0, balance_due: 0 },
    { date: '2026-06-07', vehicle_number: 'RJ07GD6596', route_name: 'washrey-chirai', driver_name: 'Babu Khan', weight_tons: 52.94, distance_km: 120, rate_per_ton: 275, total_revenue: 14561, advance_paid: 0, balance_due: 0 },
    { date: '2026-06-09', vehicle_number: 'RJ43GA0834', route_name: 'washrey-chirai', driver_name: 'Laxman', weight_tons: 35, distance_km: 120, rate_per_ton: 275, total_revenue: 10000, advance_paid: 0, balance_due: 0 },
    { date: '2026-06-09', vehicle_number: 'RJ43GA0834', route_name: 'washrey-chirai', driver_name: 'Laxman', weight_tons: 35, distance_km: 120, rate_per_ton: 275, total_revenue: 10605, advance_paid: 0, balance_due: 0 },
    { date: '2026-06-09', vehicle_number: 'RJ43GA0834', route_name: 'washrey-chirai', driver_name: 'Laxman', weight_tons: 34.99, distance_km: 120, rate_per_ton: 275, total_revenue: 9622.25, advance_paid: 0, balance_due: 0 },
    { date: '2026-06-09', vehicle_number: 'RJ07GD6596', route_name: 'washrey-chirai', driver_name: 'Babu Khan', weight_tons: 50.78, distance_km: 120, rate_per_ton: 275, total_revenue: 15908.75, advance_paid: 0, balance_due: 0 },
    { date: '2026-06-09', vehicle_number: 'RJ07GD6596', route_name: 'washrey-chirai', driver_name: 'Janu Khan', weight_tons: 57.85, distance_km: 120, rate_per_ton: 275, total_revenue: 13964.50, advance_paid: 0, balance_due: 0 },
    { date: '2026-06-10', vehicle_number: 'RJ07GD6596', route_name: 'washrey-chirai', driver_name: 'Babu Khan', weight_tons: 53.23, distance_km: 120, rate_per_ton: 275, total_revenue: 14638.25, advance_paid: 0, balance_due: 0 },
    { date: '2026-06-10', vehicle_number: 'RJ07GD6596', route_name: 'kodol-padana', driver_name: 'Janu Khan', weight_tons: 59.86, distance_km: 140, rate_per_ton: 295, total_revenue: 17658, advance_paid: 0, balance_due: 0 },
    { date: '2026-06-10', vehicle_number: 'RJ43GA0834', route_name: 'kodol-padana', driver_name: 'Laxman', weight_tons: 36.08, distance_km: 140, rate_per_ton: 295, total_revenue: 10643.60, advance_paid: 0, balance_due: 0 },
    { date: '2026-06-11', vehicle_number: 'RJ43GA0834', route_name: 'kodol-padana', driver_name: 'Laxman', weight_tons: 42.37, distance_km: 140, rate_per_ton: 295, total_revenue: 12499.15, advance_paid: 0, balance_due: 0 },
    { date: '2026-06-12', vehicle_number: 'RJ43GA0834', route_name: 'kodol-padana', driver_name: 'Laxman', weight_tons: 37.85, distance_km: 140, rate_per_ton: 295, total_revenue: 11165.75, advance_paid: 0, balance_due: 0 },
    { date: '2026-06-13', vehicle_number: 'RJ43GA0834', route_name: 'kodol-padana', driver_name: 'Laxman', weight_tons: 39.18, distance_km: 140, rate_per_ton: 295, total_revenue: 11558.10, advance_paid: 0, balance_due: 0 },
    { date: '2026-06-13', vehicle_number: 'RJ07GD6596', route_name: 'kodol-padana', driver_name: 'Babu Khan', weight_tons: 56.52, distance_km: 140, rate_per_ton: 295, total_revenue: 16673.40, advance_paid: 0, balance_due: 0 },
  ];
  await insert('trips', trips);

  // 6. Vehicle Expenses
  const vehicleExpenses = [
    { date: '2026-05-13', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Others', amount: 7500, description: 'Mahindera First Choice Pyment', paid_by: 'JM transport', status: 'Paid', person: 'Kamal' },
    { date: '2026-05-18', expense_type: 'vehicle', vehicle_number: 'HR26CW7512', category: 'Fuel (Diesel)', amount: 2000, description: 'BKN->GandhiDham', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-05-19', expense_type: 'vehicle', vehicle_number: 'HR26CW7512', category: 'Fuel (Diesel)', amount: 3707, description: 'BKN->GandhiDham', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-05-19', expense_type: 'vehicle', vehicle_number: 'HR26CW7512', category: 'Toll Taxes', amount: 3103, description: 'Toll Tax Pass', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-05-19', expense_type: 'vehicle', vehicle_number: 'HR26CW7512', category: 'Fuel (Diesel)', amount: 1000, description: 'BKN->GandhiDham', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-05-19', expense_type: 'vehicle', vehicle_number: 'HR26CW7512', category: 'Fuel (Diesel)', amount: 472, description: 'BKN->GandhiDham', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-05-18', expense_type: 'vehicle', vehicle_number: 'HR26CW7512', category: 'Maintenance', amount: 10800, description: 'Tyre Changes', paid_by: 'JM transport', status: 'Paid', person: 'Kamal' },
    { date: '2026-05-20', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Others', amount: 29000, description: 'Parking charge', paid_by: 'JM transport', status: 'Paid', person: 'Kamal' },
    { date: '2026-05-20', expense_type: 'vehicle', vehicle_number: 'HR26CW7512', category: 'Fuel (Diesel)', amount: 4550, description: 'In GandhiDham', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-05-20', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Others', amount: 2500, description: 'Keys making', paid_by: 'JM transport', status: 'Paid', person: 'Kamal' },
    { date: '2026-05-20', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Others', amount: 800, description: 'battery charge', paid_by: 'JM transport', status: 'Paid', person: 'Kamal' },
    { date: '2026-05-22', expense_type: 'vehicle', vehicle_number: 'HR26CW7512', category: 'Fuel (Diesel)', amount: 2000, description: 'Krishna Petrolium', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-05-22', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Fuel (Diesel)', amount: 2050, description: 'Krishna Petrolium', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-05-22', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Fuel (Diesel)', amount: 2050, description: '', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-05-23', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Insurance', amount: 2000, description: 'Gujarat tax', paid_by: 'JM transport', status: 'Paid', person: 'Kamal' },
    { date: '2026-05-23', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Others', amount: 100, description: 'Accessories', paid_by: 'JM transport', status: 'Paid', person: 'Kamal' },
    { date: '2026-05-23', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Others', amount: 500, description: 'washing', paid_by: 'JM transport', status: 'Paid', person: 'Kamal' },
    { date: '2026-05-23', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Others', amount: 40, description: 'Water', paid_by: 'JM transport', status: 'Paid', person: 'Kamal' },
    { date: '2026-05-23', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Others', amount: 500, description: 'Battery charge', paid_by: 'JM transport', status: 'Paid', person: 'Kamal' },
    { date: '2026-05-23', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Others', amount: 300, description: 'battery start', paid_by: 'JM transport', status: 'Paid', person: 'Kamal' },
    { date: '2026-05-23', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Maintenance', amount: 100, description: 'window fix', paid_by: 'JM transport', status: 'Paid', person: 'Kamal' },
    { date: '2026-05-22', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Fuel (Diesel)', amount: 2100, description: '', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-05-24', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Maintenance', amount: 12200, description: 'Valve Gear Fix', paid_by: 'JM transport', status: 'Paid', person: 'Bimal' },
    { date: '2026-05-24', expense_type: 'vehicle', vehicle_number: 'HR26CW7512', category: 'Fuel (Diesel)', amount: 2000, description: '', paid_by: 'JM transport', status: 'Paid' },
    { date: '2026-05-24', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Maintenance', amount: 320, description: 'mistri', paid_by: 'JM transport', status: 'Paid', person: 'Kamal' },
    { date: '2026-05-25', expense_type: 'vehicle', vehicle_number: 'RJ43GA0834', category: 'Others', amount: 1800, description: 'parking', paid_by: 'JM transport', status: 'Paid', person: 'Kamal' },
    { date: '2026-05-25', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Others', amount: 360, description: 'belt', paid_by: 'JM transport', status: 'Paid', person: 'Kamal' },
    { date: '2026-05-25', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Others', amount: 1150, description: 'chalni', paid_by: 'JM transport', status: 'Paid', person: 'Mohit' },
    { date: '2026-05-26', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Fuel (Diesel)', amount: 9808, description: 'RR petrolium', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-05-26', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Maintenance', amount: 11000, description: 'Truck maintaice', paid_by: 'JM transport', status: 'Paid', person: 'Bimal' },
    { date: '2026-05-27', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Fuel (Diesel)', amount: 14712, description: 'Reliable Pettrolium', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-05-29', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Maintenance', amount: 2000, description: 'Lathe Machine', paid_by: 'JM transport', status: 'Paid', person: 'Mohit' },
    { date: '2026-05-29', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Maintenance', amount: 8900, description: 'Truck Part', paid_by: 'JM transport', status: 'Paid', person: 'Bimal' },
    { date: '2026-05-30', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Fuel (Diesel)', amount: 8000, description: 'Jalyan Petrol Pump', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-06-02', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Fuel (Diesel)', amount: 4904, description: 'RR petrolium', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-06-03', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Others', amount: 5000, description: 'Gujarat tax', paid_by: 'JM transport', status: 'Paid', person: 'Mohit' },
    { date: '2026-06-03', expense_type: 'vehicle', vehicle_number: 'HR26CW7512', category: 'Fuel (Diesel)', amount: 3000, description: 'Shree krishna', paid_by: 'JM transport', status: 'Paid' },
    { date: '2026-06-03', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Maintenance', amount: 195000, description: 'Tyre', paid_by: 'JM transport', status: 'Paid', person: 'Mohit' },
    { date: '2026-06-03', expense_type: 'vehicle', vehicle_number: 'RJ43GA0834', category: 'Insurance', amount: 53764, description: 'Shri Ran', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-06-03', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Maintenance', amount: 480, description: 'Truck Part', paid_by: 'JM transport', status: 'Paid', person: 'Mohit' },
    { date: '2026-06-03', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Fuel (Diesel)', amount: 3000, description: 'Diesel trishul petrolium', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-06-03', expense_type: 'vehicle', vehicle_number: 'RJ43GA0834', category: 'Fuel (Diesel)', amount: 4500, description: 'From Kamal for diesel', paid_by: 'JM transport', status: 'Paid', person: 'Kamal' },
    { date: '2026-06-03', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Fuel (Diesel)', amount: 10093, description: 'jay Murlidhar petrolium', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-06-03', expense_type: 'vehicle', vehicle_number: 'RJ43GA0834', category: 'Fuel (Diesel)', amount: 9892, description: 'Khavda petrolium', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-06-04', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Fuel (Diesel)', amount: 9808, description: 'Jalyan Petrol Pump', paid_by: 'JM transport', status: 'Paid' },
    { date: '2026-06-05', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Fuel (Diesel)', amount: 25000, description: 'Jalyan Petrol Pump', paid_by: 'JM transport', status: 'Paid' },
    { date: '2026-06-05', expense_type: 'vehicle', vehicle_number: 'RJ43GA0834', category: 'Maintenance', amount: 2500, description: 'weilding', paid_by: 'JM transport', status: 'Paid', person: 'Mohit' },
    { date: '2026-06-05', expense_type: 'vehicle', vehicle_number: 'RJ43GA0834', category: 'Others', amount: 900, description: 'jhali', paid_by: 'JM transport', status: 'Paid', person: 'Mohit' },
    { date: '2026-06-06', expense_type: 'vehicle', vehicle_number: 'HR26CW7512', category: 'Fuel (Diesel)', amount: 2000, description: 'krishna petrolium', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-06-06', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Maintenance', amount: 500, description: 'chakka to janu khan', paid_by: 'JM transport', status: 'Paid', person: 'Mohit' },
    { date: '2026-06-06', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Fuel (Diesel)', amount: 9808, description: '', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-06-07', expense_type: 'vehicle', vehicle_number: 'RJ43GA0834', category: 'Fuel (Diesel)', amount: 19616, description: 'rr petrolium', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-06-07', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Fuel (Diesel)', amount: 19616, description: 'reliable petrolium', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-06-07', expense_type: 'vehicle', vehicle_number: 'RJ43GA0834', category: 'Maintenance', amount: 8800, description: 'oil filter change + labour', paid_by: 'JM transport', status: 'Paid', person: 'Mohit' },
    { date: '2026-06-07', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Maintenance', amount: 5500, description: 'Gas lek fix', paid_by: 'JM transport', status: 'Paid', person: 'Mohit' },
    { date: '2026-06-07', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Maintenance', amount: 1150, description: 'saman ka', paid_by: 'JM transport', status: 'Paid', person: 'Mohit' },
    { date: '2026-06-07', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Maintenance', amount: 700, description: 'labour', paid_by: 'JM transport', status: 'Paid', person: 'Mohit' },
    { date: '2026-06-09', expense_type: 'vehicle', vehicle_number: 'HR26CW7512', category: 'Fuel (Diesel)', amount: 2000, description: 'diesel from yes bank', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-06-09', expense_type: 'vehicle', vehicle_number: 'HR26CW7512', category: 'Maintenance', amount: 1600, description: 'car wash and maintenance', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-06-09', expense_type: 'vehicle', vehicle_number: 'RJ43GA0834', category: 'Fuel (Diesel)', amount: 2850, description: '', paid_by: 'JM transport', status: 'Paid', person: 'Bimal' },
    { date: '2026-06-09', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Fuel (Diesel)', amount: 29424, description: 'reliable petrolium', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-06-09', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Maintenance', amount: 300, description: 'tyre repair', paid_by: 'JM transport', status: 'Paid', person: 'Mohit' },
    { date: '2026-06-09', expense_type: 'vehicle', vehicle_number: 'RJ43GA0834', category: 'Fuel (Diesel)', amount: 9808, description: 'rr petrolium', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-06-10', expense_type: 'vehicle', vehicle_number: 'RJ43GA0834', category: 'Maintenance', amount: 700, description: 'kabani', paid_by: 'JM transport', status: 'Paid', person: 'Mohit' },
    { date: '2026-06-10', expense_type: 'vehicle', vehicle_number: 'RJ43GA0834', category: 'Fuel (Diesel)', amount: 2000, description: 'krushna petrolium', paid_by: 'JM transport', status: 'Paid', person: 'Bimal' },
    { date: '2026-06-12', expense_type: 'vehicle', vehicle_number: 'HR26CW7512', category: 'Fuel (Diesel)', amount: 2000, description: 'reliable petrolium', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-06-12', expense_type: 'vehicle', vehicle_number: 'HR26CW7512', category: 'Fuel (Diesel)', amount: 9808, description: 'reliable petrolium', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-06-12', expense_type: 'vehicle', vehicle_number: 'RJ43GA0834', category: 'Others', amount: 5000, description: 'gaadi name transfer', paid_by: 'JM transport', status: 'Paid', person: 'Kamal' },
    { date: '2026-06-12', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Fuel (Diesel)', amount: 9808, description: 'reliable petrolium', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-06-12', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Fuel (Diesel)', amount: 9808, description: 'reliable petrolium', paid_by: 'JM transport', status: 'Paid', person: 'Subham' },
    { date: '2026-06-13', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Others', amount: 550, description: 'Gaadi bhdne ke roj', paid_by: 'JM transport', status: 'Paid', person: 'Mohit' },
    { date: '2026-06-13', expense_type: 'vehicle', vehicle_number: 'RJ43GA0834', category: 'Maintenance', amount: 2400, description: 'Parts Ka Gear Oil', paid_by: 'JM transport', status: 'Paid', person: 'Mohit' },
    { date: '2026-06-13', expense_type: 'vehicle', vehicle_number: 'RJ43GA0834', category: 'Maintenance', amount: 350, description: 'mistery', paid_by: 'JM transport', status: 'Paid', person: 'Mohit' },
    { date: '2026-06-13', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Maintenance', amount: 400, description: 'mistery', paid_by: 'JM transport', status: 'Paid', person: 'Mohit' },
    { date: '2026-06-13', expense_type: 'vehicle', vehicle_number: 'RJ43GA0834', category: 'Fuel (Diesel)', amount: 4904, description: 'Diesel', paid_by: 'JM transport', status: 'Paid', person: 'Bimal' },
    { date: '2026-06-13', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Fuel (Diesel)', amount: 11769, description: 'Diesel', paid_by: 'JM transport', status: 'Paid', person: 'Bimal' },
    { date: '2026-06-13', expense_type: 'vehicle', vehicle_number: 'RJ07GD6596', category: 'Fuel (Diesel)', amount: 19616, description: 'Diesel', paid_by: 'JM transport', status: 'Paid', person: 'Bimal' },
  ];
  await insert('expenses', vehicleExpenses);

  // 7. Operational / Personal / Other Expenses
  const dailyExpenses = [
    { date: '2026-05-19', expense_type: 'operational', category: 'Meals', amount: 300, description: 'In Gandhi Dham', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-05-19', expense_type: 'operational', category: 'Hotel Stay', amount: 1600, description: 'Rent Gandhidham', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-05-20', expense_type: 'operational', category: 'Meals', amount: 300, description: 'In Gandhi Dham', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-05-23', expense_type: 'operational', category: 'Rent', amount: 23500, description: 'room rent advance', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-05-22', expense_type: 'operational', category: 'Meals', amount: 500, description: 'lunch', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-05-23', expense_type: 'operational', category: 'Meals', amount: 280, description: 'lunch', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-05-24', expense_type: 'operational', category: 'Meals', amount: 402, description: 'Lunch', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-05-25', expense_type: 'operational', category: 'Meals', amount: 470, description: 'lunch', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-05-25', expense_type: 'operational', category: 'Supplies', amount: 831, description: 'Dmart bill', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-05-25', expense_type: 'personal', category: 'Other', amount: 400, description: 'salon', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-05-25', expense_type: 'other', category: 'Other', amount: 173, description: 'Dmart bill', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-05-26', expense_type: 'operational', category: 'Meals', amount: 160, description: 'Dinner', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-05-27', expense_type: 'other', category: 'Other', amount: 265, description: 'House expense', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-05-27', expense_type: 'operational', category: 'Meals', amount: 400, description: 'lunch', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-05-30', expense_type: 'other', category: 'Other', amount: 240, description: 'Room Expense', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-05-31', expense_type: 'other', category: 'Other', amount: 150, description: 'Room Expense', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-05-31', expense_type: 'operational', category: 'Meals', amount: 210, description: 'Breakfast', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-05-31', expense_type: 'operational', category: 'Meals', amount: 200, description: 'dinner', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-05-31', expense_type: 'other', category: 'Other', amount: 185, description: 'lock', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-05-31', expense_type: 'operational', category: 'Meals', amount: 50, description: 'chai', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-05-31', expense_type: 'operational', category: 'Meals', amount: 120, description: 'cold drink', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-06-03', expense_type: 'other', category: 'Other', amount: 1000, description: 'Room expense', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-06-02', expense_type: 'operational', category: 'Meals', amount: 456, description: 'Swiggy se', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-06-04', expense_type: 'operational', category: 'Meals', amount: 500, description: 'lunch', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-06-05', expense_type: 'operational', category: 'Meals', amount: 335, description: 'dinner', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-06-05', expense_type: 'other', category: 'Other', amount: 60, description: 'tea', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-06-06', expense_type: 'other', category: 'Other', amount: 400, description: 'in jhaka travels for utensils', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-06-06', expense_type: 'operational', category: 'Meals', amount: 270, description: 'dinner', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-06-07', expense_type: 'operational', category: 'Meals', amount: 4900, description: 'dmart bill', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-06-07', expense_type: 'other', category: 'Other', amount: 303, description: 'blinkit for sabji', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-06-09', expense_type: 'operational', category: 'Meals', amount: 150, description: 'only bimal', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-06-09', expense_type: 'operational', category: 'Meals', amount: 120, description: 'fruits', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-06-12', expense_type: 'operational', category: 'Daily Allowance', amount: 500, description: '', person: 'Kamal', paid_by: 'JM transport' },
    { date: '2026-06-12', expense_type: 'operational', category: 'Meals', amount: 474, description: 'blinkit order', person: 'Bimal', paid_by: 'JM transport' },
    { date: '2026-06-13', expense_type: 'operational', category: 'Daily Allowance', amount: 1000, description: '', person: 'Kamal', paid_by: 'JM transport' },
    { date: '2026-06-13', expense_type: 'operational', category: 'Daily Allowance', amount: 1000, description: '', person: 'Kamal', paid_by: 'JM transport' },
    { date: '2026-06-13', expense_type: 'other', category: 'Other', amount: 130, description: '', person: 'Bimal', paid_by: 'JM transport' },
  ];
  await insert('expenses', dailyExpenses);

  // 8. Capital Contributions
  const contributions = [
    { date: '2026-05-24', contributor: 'Subham', contribution_type: 'Credit Card', value: 16043, description: 'In diesel', asset_details: 'Indusind CC' },
    { date: '2026-05-24', contributor: 'Bimal', contribution_type: 'Credit Card', value: 12200, description: 'In Maintance', asset_details: '' },
    { date: '2026-05-25', contributor: 'Bimal', contribution_type: 'Credit Card', value: 1003, description: 'for supply', asset_details: '' },
    { date: '2026-05-26', contributor: 'Subham', contribution_type: 'Credit Card', value: 9808, description: 'diesel', asset_details: 'HDFC CC' },
    { date: '2026-05-26', contributor: 'Bimal', contribution_type: 'Credit Card', value: 11000, description: 'to ashok leyland', asset_details: '' },
    { date: '2026-05-27', contributor: 'Subham', contribution_type: 'Credit Card', value: 14712, description: 'In diesel', asset_details: 'HDFC CC' },
    { date: '2026-05-30', contributor: 'Subham', contribution_type: 'Credit Card', value: 8000, description: 'In Diesel', asset_details: 'HDFC CC' },
    { date: '2026-06-02', contributor: 'Subham', contribution_type: 'Credit Card', value: 4904, description: 'In Diesel', asset_details: 'HDFC CC' },
    { date: '2026-06-03', contributor: 'Subham', contribution_type: 'Credit Card', value: 3000, description: 'In Diesel', asset_details: 'HDFC CC' },
    { date: '2026-06-05', contributor: 'Bimal', contribution_type: 'Credit Card', value: 10093, description: 'Diesel', asset_details: '' },
    { date: '2026-06-03', contributor: 'Subham', contribution_type: 'Credit Card', value: 3000, description: 'petrol', asset_details: 'Indusind CC' },
    { date: '2026-06-06', contributor: 'Subham', contribution_type: 'Credit Card', value: 2000, description: 'diesel', asset_details: 'Indusind CC' },
    { date: '2026-06-06', contributor: 'Subham', contribution_type: 'Credit Card', value: 9808, description: 'diesel', asset_details: 'HDFC CC' },
    { date: '2026-06-07', contributor: 'Bimal', contribution_type: 'Credit Card', value: 4900, description: 'dmart', asset_details: '' },
    { date: '2026-06-11', contributor: 'Bimal', contribution_type: 'Credit Card', value: 2000, description: 'diesel', asset_details: 'Yes Bank' },
    { date: '2026-06-11', contributor: 'Bimal', contribution_type: 'Credit Card', value: 2850, description: 'diesel', asset_details: 'Yes Bank' },
    { date: '2026-06-11', contributor: 'Subham', contribution_type: 'Credit Card', value: 29424, description: 'diesel', asset_details: 'HDFC & Kotak(19616)' },
    { date: '2026-06-11', contributor: 'Subham', contribution_type: 'Credit Card', value: 9808, description: 'diesel', asset_details: 'Kotak' },
    { date: '2026-06-11', contributor: 'Bimal', contribution_type: 'Credit Card', value: 2000, description: 'diesel', asset_details: 'Yes Bank' },
    { date: '2026-06-12', contributor: 'Bimal', contribution_type: 'Credit Card', value: 2000, description: 'diesel', asset_details: 'Yes Bank' },
  ];
  await insert('capital_contributions', contributions);

  // 9. Banking Information
  const banking = [
    { vehicle_number: 'RJ43GA0834', bank_name: 'Reliative', purchase_date: '2026-03-27', ex_showroom_price: 1220000, down_payment: 500000, loan_amount: 500000, interest_rate: 16, loan_tenure_months: 10 },
    { vehicle_number: 'RJ07GD6596', bank_name: 'HDFC', purchase_date: '2026-05-20', ex_showroom_price: 1970000, down_payment: 1970000, loan_amount: 1970000, interest_rate: 9.99, loan_tenure_months: 60, monthly_emi: 50000 },
    { vehicle_number: 'RJ43GA0834', bank_name: 'Friend(Mukesh)', purchase_date: '2026-03-27', ex_showroom_price: 1220000, down_payment: 500000, loan_amount: 500000, interest_rate: 0 },
  ];
  await insert('banking_information', banking);

  console.log('\n✅ Seeding complete!');
}

seed().catch(console.error);
