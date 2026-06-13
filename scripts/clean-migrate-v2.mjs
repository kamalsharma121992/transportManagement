import { createClient } from '@supabase/supabase-js';

const s = createClient(
  'https://cnvqqqqzgkjvdnqmcdwy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNudnFxcXF6Z2tqdmRucW1jZHd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNzI4MzcsImV4cCI6MjA5Njk0ODgzN30.pYvqQc-xdcV0dQJ31LIcteZ2zuPzohVHtpEAeSo1q1A'
);

async function run() {
  console.log('=== WIPING ALL DATA ===');
  for (const t of ['banking_information','capital_contributions','expenses','trips','routes','vehicles','drivers','partners']) {
    const { error } = await s.from(t).delete().gte('id', 0);
    if (error) console.error(`  ERR ${t}:`, error.message);
    else console.log(`  ✓ ${t}`);
  }

  console.log('\n=== MASTER DATA ===');
  await s.from('partners').insert([
    'JM transport','Mahesh','Kamal','Subham','Bimal','Mohit',
    'Babu Khan','Janu Khan','Laxman','Pratap Ram','Bimal/Mohit/Mahesh'
  ].map(name=>({name})));
  console.log('  ✓ partners: 11');

  await s.from('drivers').insert(['Pratap Ram','Laxman','Babu Khan','Janu Khan'].map(name=>({name})));
  console.log('  ✓ drivers: 4');

  await s.from('vehicles').insert([
    { vehicle_number:'RJ43GA0834', vehicle_type:'Truck', model:'4018', capacity_tons:35 },
    { vehicle_number:'RJ07GD6596', vehicle_type:'Truck', model:'5525', capacity_tons:42 },
    { vehicle_number:'HR26CW7512', vehicle_type:'Personal Car' },
  ]);
  console.log('  ✓ vehicles: 3');

  await s.from('routes').insert([
    { origin:'washrey', destination:'chirai', route_name:'washrey-chirai', distance_km:60, standard_rate_per_ton:270 },
    { origin:'khvda', destination:'kandla', route_name:'khavda-kandla', distance_km:150, standard_rate_per_ton:500 },
    { origin:'kodol', destination:'padna', route_name:'kodol-padana', distance_km:70, standard_rate_per_ton:295 },
  ]);
  console.log('  ✓ routes: 3');

  console.log('\n=== TRIPS (27) ===');
  const trips = [
    ['2026-05-25','RJ07GD6596','washrey-chirai','Pratap Ram',48.20,120,275,13022],
    ['2026-05-27','RJ07GD6596','washrey-chirai','Pratap Ram',50,120,275,13499],
    ['2026-05-30','RJ07GD6596','washrey-chirai','Pratap Ram',102.50,240,275,27692],
    ['2026-05-30','RJ07GD6596','washrey-chirai','Pratap Ram',50,120,275,13766],
    ['2026-06-02','RJ07GD6596','washrey-chirai','Laxman',50,120,275,13752],
    ['2026-06-05','RJ43GA0834','khavda-kandla','Laxman',34,150,500,18684],
    ['2026-06-04','RJ07GD6596','washrey-chirai','Babu Khan',50.72,120,275,13948],
    ['2026-06-05','RJ07GD6596','washrey-chirai','Babu Khan',54.16,120,275,14894],
    ['2026-06-06','RJ07GD6596','washrey-chirai','Janu Khan',52.15,120,275,14341],
    ['2026-06-06','RJ07GD6596','washrey-chirai','Janu Khan',53.52,120,275,14718],
    ['2026-06-06','RJ07GD6596','washrey-chirai','Babu Khan',52.98,120,275,14569],
    ['2026-06-06','RJ43GA0834','washrey-chirai','Laxman',34.65,120,275,9528],
    ['2026-06-06','RJ07GD6596','washrey-chirai','Babu Khan',52.94,120,275,14561],
    ['2026-06-07','RJ07GD6596','washrey-chirai','Janu Khan',52.94,120,275,14561],
    ['2026-06-07','RJ07GD6596','washrey-chirai','Babu Khan',52.94,120,275,14561],
    ['2026-06-09','RJ43GA0834','washrey-chirai','Laxman',35,120,275,10000],
    ['2026-06-09','RJ43GA0834','washrey-chirai','Laxman',35,120,275,10605],
    ['2026-06-09','RJ43GA0834','washrey-chirai','Laxman',34.99,120,275,9622.25],
    ['2026-06-09','RJ07GD6596','washrey-chirai','Babu Khan',50.78,120,275,15908.75],
    ['2026-06-09','RJ07GD6596','washrey-chirai','Janu Khan',57.85,120,275,13964.50],
    ['2026-06-10','RJ07GD6596','washrey-chirai','Babu Khan',53.23,120,275,14638.25],
    ['2026-06-10','RJ07GD6596','kodol-padana','Janu Khan',59.86,140,295,17658],
    ['2026-06-10','RJ43GA0834','kodol-padana','Laxman',36.08,140,295,10643.60],
    ['2026-06-11','RJ43GA0834','kodol-padana','Laxman',42.37,140,295,12499.15],
    ['2026-06-12','RJ43GA0834','kodol-padana','Laxman',37.85,140,295,11165.75],
    ['2026-06-13','RJ43GA0834','kodol-padana','Laxman',39.18,140,295,11558.10],
    ['2026-06-13','RJ07GD6596','kodol-padana','Babu Khan',56.52,140,295,16673.40],
  ].map(([date,vn,rn,dn,wt,dk,rpt,tr])=>({date,vehicle_number:vn,route_name:rn,driver_name:dn,weight_tons:wt,distance_km:dk,rate_per_ton:rpt,total_revenue:tr,advance_paid:0,balance_due:0}));
  const { error: te } = await s.from('trips').insert(trips);
  if (te) console.error('  ERR:', te.message); else console.log(`  ✓ trips: ${trips.length}`);

  console.log('\n=== VEHICLE EXPENSES (79) ===');
  // [date, vehicle, category, amount, description, paid_by, paid_by_person]
  const veData = [
    ['2026-05-13','RJ07GD6596','Others',7500,'Mahindera First Choice Pyment','JM transport','Kamal'],
    ['2026-05-18','HR26CW7512','Fuel (Diesel)',2000,'BKN->GandhiDham','JM transport','Subham'],
    ['2026-05-19','HR26CW7512','Fuel (Diesel)',3707,'BKN->GandhiDham','JM transport','Subham'],
    ['2026-05-19','HR26CW7512','Toll Taxes',3103,'Toll Tax Pass','JM transport','Subham'],
    ['2026-05-19','HR26CW7512','Fuel (Diesel)',1000,'BKN->GandhiDham','JM transport','Subham'],
    ['2026-05-19','HR26CW7512','Fuel (Diesel)',472,'BKN->GandhiDham','JM transport','Subham'],
    ['2026-05-18','HR26CW7512','Maintenance',10800,'Tyre Changes','JM transport','Kamal'],
    ['2026-05-20','RJ07GD6596','Others',29000,'Parking charge','JM transport','Kamal'],
    ['2026-05-20','HR26CW7512','Fuel (Diesel)',4550,'In GandhiDham','JM transport','Subham'],
    ['2026-05-20','RJ07GD6596','Others',2500,'Keys making','JM transport','Kamal'],
    ['2026-05-20','RJ07GD6596','Others',800,'battery charge','JM transport','Kamal'],
    ['2026-05-22','HR26CW7512','Fuel (Diesel)',2000,'Krishna Petrolium','JM transport','Subham'],
    ['2026-05-22','RJ07GD6596','Fuel (Diesel)',2050,'Krishna Petrolium','JM transport','Subham'],
    ['2026-05-22','RJ07GD6596','Fuel (Diesel)',2050,'','JM transport','Subham'],
    ['2026-05-23','RJ07GD6596','Insurance',2000,'Gujarat tax','JM transport','Kamal'],
    ['2026-05-23','RJ07GD6596','Others',100,'Accessories','JM transport','Kamal'],
    ['2026-05-23','RJ07GD6596','Others',500,'washing','JM transport','Kamal'],
    ['2026-05-23','RJ07GD6596','Others',40,'Water','JM transport','Kamal'],
    ['2026-05-23','RJ07GD6596','Others',500,'Battery charge','JM transport','Kamal'],
    ['2026-05-23','RJ07GD6596','Others',300,'battery start','JM transport','Kamal'],
    ['2026-05-23','RJ07GD6596','Maintenance',100,'window fix','JM transport','Kamal'],
    ['2026-05-22','RJ07GD6596','Fuel (Diesel)',2100,'','JM transport','Subham'],
    ['2026-05-24','RJ07GD6596','Maintenance',12200,'Valve Gear Fix','JM transport','Bimal'],
    ['2026-05-24','HR26CW7512','Fuel (Diesel)',2000,'','JM transport',null],
    ['2026-05-24','RJ07GD6596','Maintenance',320,'mistri','JM transport','Kamal'],
    ['2026-05-25','RJ43GA0834','Others',1800,'parking','JM transport','Kamal'],
    ['2026-05-25','RJ07GD6596','Others',360,'belt','JM transport','Kamal'],
    ['2026-05-25','RJ07GD6596','Others',1150,'chalni','JM transport','Mohit'],
    ['2026-05-26','RJ07GD6596','Fuel (Diesel)',9808,'RR petrolium','JM transport','Subham'],
    ['2026-05-26','RJ07GD6596','Maintenance',11000,'Truck maintaice','JM transport','Bimal'],
    ['2026-05-27','RJ07GD6596','Fuel (Diesel)',14712,'Reliable Pettrolium','JM transport','Subham'],
    ['2026-05-28','HR26CW7512','Fuel (Diesel)',5000,'','Mahesh',null], // ← MAHESH PAID
    ['2026-05-29','RJ07GD6596','Maintenance',2000,'Lathe Machine','JM transport','Mohit'],
    ['2026-05-29','RJ07GD6596','Maintenance',8900,'Truck Part','JM transport','Bimal'],
    ['2026-05-30','RJ07GD6596','Fuel (Diesel)',8000,'Jalyan Petrol Pump','JM transport','Subham'],
    ['2026-06-02','RJ07GD6596','Fuel (Diesel)',4904,'RR petrolium','JM transport','Subham'],
    ['2026-06-03','RJ07GD6596','Others',5000,'Gujarat tax','JM transport','Mohit'],
    ['2026-06-03','HR26CW7512','Fuel (Diesel)',3000,'Shree krishna','JM transport',null],
    ['2026-06-03','RJ07GD6596','Maintenance',195000,'Tyre','JM transport','Mohit'],
    ['2026-06-03','RJ43GA0834','Insurance',53764,'Shri Ran','JM transport','Subham'],
    ['2026-06-03','RJ07GD6596','Maintenance',480,'Truck Part','JM transport','Mohit'],
    ['2026-06-03','RJ07GD6596','Fuel (Diesel)',3000,'Diesel trishul petrolium','JM transport','Subham'],
    ['2026-06-03','RJ43GA0834','Fuel (Diesel)',4500,'From Kamal for diesel','JM transport','Kamal'],
    ['2026-06-03','RJ07GD6596','Fuel (Diesel)',10093,'jay Murlidhar petrolium','JM transport','Subham'],
    ['2026-06-03','RJ43GA0834','Fuel (Diesel)',9892,'Khavda petrolium','JM transport','Subham'],
    ['2026-06-04','RJ07GD6596','Fuel (Diesel)',9808,'Jalyan Petrol Pump','JM transport',null],
    ['2026-06-05','RJ07GD6596','Fuel (Diesel)',25000,'Jalyan Petrol Pump','JM transport',null],
    ['2026-06-05','RJ43GA0834','Maintenance',2500,'weilding','JM transport','Mohit'],
    ['2026-06-05','RJ43GA0834','Others',900,'jhali','JM transport','Mohit'],
    ['2026-06-06','HR26CW7512','Fuel (Diesel)',2000,'krishna petrolium','JM transport','Subham'],
    ['2026-06-06','RJ07GD6596','Maintenance',500,'chakka to janu khan','JM transport','Mohit'],
    ['2026-06-06','RJ07GD6596','Fuel (Diesel)',9808,'','JM transport','Subham'],
    ['2026-06-07','RJ43GA0834','Fuel (Diesel)',19616,'rr petrolium','JM transport','Subham'],
    ['2026-06-07','RJ07GD6596','Fuel (Diesel)',19616,'reliable petrolium','JM transport','Subham'],
    ['2026-06-07','RJ43GA0834','Maintenance',8800,'oil filter change + labour','JM transport','Mohit'],
    ['2026-06-07','RJ07GD6596','Maintenance',5500,'Gas lek fix','JM transport','Mohit'],
    ['2026-06-07','RJ07GD6596','Maintenance',1150,'saman ka','JM transport','Mohit'],
    ['2026-06-07','RJ07GD6596','Maintenance',700,'labour','JM transport','Mohit'],
    ['2026-06-09','HR26CW7512','Fuel (Diesel)',2000,'diesel from yes bank','JM transport','Subham'],
    ['2026-06-09','HR26CW7512','Maintenance',1600,'car wash and maintenance','JM transport','Subham'],
    ['2026-06-09','RJ43GA0834','Fuel (Diesel)',2850,'','JM transport','Bimal'],
    ['2026-06-09','RJ07GD6596','Fuel (Diesel)',29424,'reliable petrolium','JM transport','Subham'],
    ['2026-06-09','RJ07GD6596','Maintenance',300,'tyre repair','JM transport','Mohit'],
    ['2026-06-09','RJ43GA0834','Fuel (Diesel)',9808,'rr petrolium','JM transport','Subham'],
    ['2026-06-10','RJ43GA0834','Maintenance',700,'kabani','JM transport','Mohit'],
    ['2026-06-10','RJ43GA0834','Fuel (Diesel)',2000,'krushna petrolium','JM transport','Bimal'],
    ['2026-06-10','HR26CW7512','Fuel (Diesel)',2000,'cj shah','Mahesh',null], // ← MAHESH PAID
    ['2026-06-12','HR26CW7512','Fuel (Diesel)',2000,'reliable petrolium','JM transport','Subham'],
    ['2026-06-12','HR26CW7512','Fuel (Diesel)',9808,'reliable petrolium','JM transport','Subham'],
    ['2026-06-12','RJ43GA0834','Others',5000,'gaadi name transfer','JM transport','Kamal'],
    ['2026-06-12','RJ07GD6596','Fuel (Diesel)',9808,'reliable petrolium','JM transport','Subham'],
    ['2026-06-12','RJ07GD6596','Fuel (Diesel)',9808,'reliable petrolium','JM transport','Subham'],
    ['2026-06-13','RJ07GD6596','Others',550,'Gaadi bhdne ke roj','JM transport','Mohit'],
    ['2026-06-13','RJ43GA0834','Maintenance',2400,'Parts Ka Gear Oil','JM transport','Mohit'],
    ['2026-06-13','RJ43GA0834','Maintenance',350,'mistery','JM transport','Mohit'],
    ['2026-06-13','RJ07GD6596','Maintenance',400,'mistery','JM transport','Mohit'],
    ['2026-06-13','RJ43GA0834','Fuel (Diesel)',4904,'Diesel','JM transport','Bimal'],
    ['2026-06-13','RJ07GD6596','Fuel (Diesel)',11769,'Diesel','JM transport','Bimal'],
    ['2026-06-13','RJ07GD6596','Fuel (Diesel)',19616,'Diesel','JM transport','Bimal'],
  ];
  const ve = veData.map(([date,vn,cat,amt,desc,pb,pbp])=>({
    date,expense_type:'vehicle',vehicle_number:vn,category:cat,amount:amt,
    description:desc,paid_by:pb,paid_by_person:pbp,status:'Paid'
  }));
  let { error: vee } = await s.from('expenses').insert(ve);
  if (vee) console.error('  ERR:', vee.message); else console.log(`  ✓ vehicle expenses: ${ve.length}`);

  console.log('\n=== DAILY EXPENSES (58) - from Daily Expenses sheet ===');
  // [date, person, category, amount, description, paid_by]
  const deData = [
    ['2026-05-19','Bimal/Mohit/Mahesh','Meals',300,'In Gandhi Dham','JM transport'],
    ['2026-05-19','Bimal/Mohit/Mahesh','Hotel Stay',1600,'Rent Gandhidham','JM transport'],
    ['2026-05-20','Bimal/Mohit/Mahesh','Meals',300,'In Gandhi Dham','JM transport'],
    ['2026-05-21','Bimal/Mohit/Mahesh','Meals',125,'Break Fast','Mahesh'],
    ['2026-05-21','Bimal/Mohit/Mahesh','Other',1600,'Hotel Stay Gandhidham','Mahesh'],
    ['2026-05-21','Bimal/Mohit/Mahesh','Other',440,'Hotel Expense','Mahesh'],
    ['2026-05-21','Bimal/Mohit/Mahesh','Other',80,'Soap','Mahesh'],
    ['2026-05-23','Bimal/Mohit/Mahesh','Rent',23500,'room rent advance','JM transport'],
    ['2026-05-23','Bimal/Mohit/Mahesh','Meals',500,'Lunch','Mahesh'],
    ['2026-05-22','Bimal/Mohit/Mahesh','Meals',500,'lunch','JM transport'],
    ['2026-05-22','Bimal/Mohit/Mahesh','Meals',40,'Package Water','Mahesh'],
    ['2026-05-22','Bimal/Mohit/Mahesh','Meals',550,'dinner','Mahesh'],
    ['2026-05-23','Bimal/Mohit/Mahesh','Rent',2500,'rent advance','Mahesh'],
    ['2026-05-23','Bimal/Mohit/Mahesh','Meals',690,'dinner','Mahesh'],
    ['2026-05-23','Bimal/Mohit/Mahesh','Other',1100,'pillow and matress','Mahesh'],
    ['2026-05-23','Bimal/Mohit/Mahesh','Meals',280,'lunch','JM transport'],
    ['2026-05-24','Bimal/Mohit/Mahesh','Meals',402,'Lunch','JM transport'],
    ['2026-05-24','Bimal/Mohit/Mahesh','Other',240,'','Mahesh'],
    ['2026-05-24','Bimal/Mohit/Mahesh','Other',20,'','Mahesh'],
    ['2026-05-24','Bimal/Mohit/Mahesh','Other',80,'Ghar ke sman','Mahesh'],
    ['2026-05-25','Bimal/Mohit/Mahesh','Other',50,'','Mahesh'],
    ['2026-05-25','Bimal/Mohit/Mahesh','Meals',470,'lunch','JM transport'],
    ['2026-05-25','Bimal/Mohit/Mahesh','Supplies',831,'Dmart bill','JM transport'],
    ['2026-05-25','Bimal/Mohit/Mahesh','Other',400,'salon','JM transport'],
    ['2026-05-25','Bimal/Mohit/Mahesh','Other',100,'room expense','Mahesh'],
    ['2026-05-25','Bimal/Mohit/Mahesh','Other',173,'Dmart bill','JM transport'],
    ['2026-05-26','Bimal/Mohit/Mahesh','Meals',80,'fruits','Mahesh'],
    ['2026-05-26','Bimal/Mohit/Mahesh','Meals',90,'','Mahesh'],
    ['2026-05-26','Bimal/Mohit/Mahesh','Meals',156,'juice','Mahesh'],
    ['2026-05-26','Bimal/Mohit/Mahesh','Meals',160,'Dinner','JM transport'],
    ['2026-05-27','Bimal/Mohit/Mahesh','Other',265,'House expense','JM transport'],
    ['2026-05-27','Bimal/Mohit/Mahesh','Meals',400,'lunch','JM transport'],
    ['2026-05-28','Bimal/Mohit/Mahesh','Meals',630,'hotel HighWay Inn','Mahesh'],
    ['2026-05-28','Bimal/Mohit/Mahesh','Meals',240,'','Mahesh'],
    ['2026-05-29','Bimal/Mohit/Mahesh','Meals',250,'','Mahesh'],
    ['2026-05-30','Bimal/Mohit/Mahesh','Other',240,'Room Expense','JM transport'],
    ['2026-05-31','Bimal/Mohit/Mahesh','Other',150,'Room Expense','JM transport'],
    ['2026-05-31','Bimal/Mohit/Mahesh','Meals',210,'Breakfast','JM transport'],
    ['2026-05-31','Bimal/Mohit/Mahesh','Meals',200,'dinner','JM transport'],
    ['2026-05-31','Bimal/Mohit/Mahesh','Other',185,'lock','JM transport'],
    ['2026-05-31','Bimal/Mohit/Mahesh','Meals',50,'chai','JM transport'],
    ['2026-05-31','Bimal/Mohit/Mahesh','Meals',120,'cold drink','JM transport'],
    ['2026-06-01','Bimal/Mohit/Mahesh','Meals',300,'dinner','Mahesh'],
    ['2026-06-03','Bimal/Mohit/Mahesh','Other',1000,'Room expense','JM transport'],
    ['2026-06-03','Bimal/Mohit/Mahesh','Other',165,'Room expense','Mahesh'],
    ['2026-06-02','Bimal/Mohit/Mahesh','Meals',456,'Swiggy se','JM transport'],
    ['2026-06-04','Bimal/Mohit/Mahesh','Meals',500,'lunch','JM transport'],
    ['2026-06-05','Bimal/Mohit/Mahesh','Meals',335,'dinner','JM transport'],
    ['2026-06-05','Bimal/Mohit/Mahesh','Other',60,'tea','JM transport'],
    ['2026-06-06','Bimal/Mohit/Mahesh','Other',400,'in jhaka travels for utensils','JM transport'],
    ['2026-06-06','Bimal/Mohit/Mahesh','Meals',300,'lunch','Mahesh'],
    ['2026-06-06','Bimal/Mohit/Mahesh','Meals',270,'dinner','JM transport'],
    ['2026-06-07','Bimal/Mohit/Mahesh','Meals',4900,'dmart bill','JM transport'],
    ['2026-06-07','Bimal/Mohit/Mahesh','Other',303,'blinkit for sabji','JM transport'],
    ['2026-06-09','Bimal/Mohit/Mahesh','Meals',150,'only bimal','JM transport'],
    ['2026-06-09','Bimal/Mohit/Mahesh','Meals',120,'fruits','JM transport'],
    ['2026-06-12','Bimal/Mohit/Mahesh','Meals',474,'blinkit order','JM transport'],
    ['2026-06-13','Bimal/Mohit/Mahesh','Other',130,'','JM transport'],
  ];
  const de = deData.map(([date,person,cat,amt,desc,pb])=>({
    date,expense_type:'operational',person,category:cat,amount:amt,
    description:desc,paid_by:pb,status:'Paid'
  }));
  ({ error: vee } = await s.from('expenses').insert(de));
  if (vee) console.error('  ERR:', vee.message); else console.log(`  ✓ daily expenses: ${de.length}`);

  console.log('\n=== EXPENSE GRID (34) ===');
  const grid = [
    ['2026-06-01','Babu Khan','Advance',10000,'Advance payment'],
    ['2026-06-02','Babu Khan','Daily Allowance',1500,''],
    ['2026-06-03','Babu Khan','Daily Allowance',490,''],
    ['2026-06-04','Babu Khan','Daily Allowance',500,''],
    ['2026-06-05','Babu Khan','Daily Allowance',500,''],
    ['2026-06-07','Babu Khan','Daily Allowance',1000,''],
    ['2026-06-08','Babu Khan','Daily Allowance',1000,''],
    ['2026-06-10','Babu Khan','Daily Allowance',1000,''],
    ['2026-06-11','Babu Khan','Daily Allowance',500,''],
    ['2026-06-13','Babu Khan','Daily Allowance',1000,''],
    ['2026-06-02','Janu Khan','Daily Allowance',1500,''],
    ['2026-06-04','Janu Khan','Daily Allowance',500,''],
    ['2026-06-05','Janu Khan','Daily Allowance',500,''],
    ['2026-06-07','Janu Khan','Daily Allowance',1000,''],
    ['2026-06-08','Janu Khan','Daily Allowance',1000,''],
    ['2026-06-10','Janu Khan','Daily Allowance',1000,''],
    ['2026-06-12','Janu Khan','Daily Allowance',500,''],
    ['2026-06-13','Janu Khan','Daily Allowance',1000,''],
    ['2026-06-03','Laxman','Daily Allowance',500,''],
    ['2026-06-04','Laxman','Daily Allowance',500,''],
    ['2026-06-05','Laxman','Advance',6000,'Advance payment'],
    ['2026-06-06','Laxman','Daily Allowance',500,''],
    ['2026-06-07','Laxman','Daily Allowance',500,''],
    ['2026-06-08','Laxman','Daily Allowance',2000,''],
    ['2026-06-10','Laxman','Daily Allowance',1000,''],
    ['2026-06-03','Mahesh','Daily Allowance',200,''],
    ['2026-06-05','Bimal','Personal Care',110,''],
    ['2026-06-08','Bimal','Personal Care',160,''],
    ['2026-06-09','Bimal','Personal Care',3290,''],
    ['2026-06-10','Bimal','Personal Care',600,''],
    ['2026-06-04','Mohit','Personal Care',349,''],
    ['2026-06-08','Mohit','Personal Care',160,''],
    ['2026-06-06',null,'Supplies',1150,'Misc expense'],
    ['2026-06-06',null,'Supplies',660,'Office expense'],
  ];
  const ge = grid.map(([date,person,cat,amt,desc])=>({
    date,expense_type: ['Personal Care'].includes(cat)?'personal':'operational',
    person,category:cat,amount:amt,description:desc,paid_by:'JM transport',status:'Paid'
  }));
  ({ error: vee } = await s.from('expenses').insert(ge));
  if (vee) console.error('  ERR:', vee.message); else console.log(`  ✓ grid expenses: ${ge.length}`);

  console.log('\n=== CAPITAL CONTRIBUTIONS (20) ===');
  const cc = [
    ['2026-05-24','Subham',16043,'In diesel','Indusind CC'],
    ['2026-05-24','Bimal',12200,'In Maintance',''],
    ['2026-05-25','Bimal',1003,'for supply',''],
    ['2026-05-26','Subham',9808,'diesel','HDFC CC'],
    ['2026-05-26','Bimal',11000,'to ashok leyland',''],
    ['2026-05-27','Subham',14712,'In diesel','HDFC CC'],
    ['2026-05-30','Subham',8000,'In Diesel','HDFC CC'],
    ['2026-06-02','Subham',4904,'In Diesel','HDFC CC'],
    ['2026-06-03','Subham',3000,'In Diesel','HDFC CC'],
    ['2026-06-05','Bimal',10093,'Diesel',''],
    ['2026-06-03','Subham',3000,'petrol','Indusind CC'],
    ['2026-06-06','Subham',2000,'diesel','Indusind CC'],
    ['2026-06-06','Subham',9808,'diesel','HDFC CC'],
    ['2026-06-07','Bimal',4900,'dmart',''],
    ['2026-06-11','Bimal',2000,'diesel','Yes Bank'],
    ['2026-06-11','Bimal',2850,'diesel','Yes Bank'],
    ['2026-06-11','Subham',29424,'diesel','HDFC & Kotak(19616)'],
    ['2026-06-11','Subham',9808,'diesel','Kotak'],
    ['2026-06-11','Bimal',2000,'diesel','Yes Bank'],
    ['2026-06-12','Bimal',2000,'diesel','Yes Bank'],
  ].map(([date,c,v,d,a])=>({date,contributor:c,contribution_type:'Credit Card',value:v,description:d,asset_details:a}));
  ({ error: vee } = await s.from('capital_contributions').insert(cc));
  if (vee) console.error('  ERR:', vee.message); else console.log(`  ✓ capital: ${cc.length}`);

  console.log('\n=== BANKING (3) ===');
  await s.from('banking_information').insert([
    { vehicle_number:'RJ43GA0834', bank_name:'Reliative', purchase_date:'2026-03-27', ex_showroom_price:1220000, down_payment:500000, loan_amount:500000, interest_rate:16, loan_tenure_months:10 },
    { vehicle_number:'RJ07GD6596', bank_name:'HDFC', purchase_date:'2026-05-20', ex_showroom_price:1970000, down_payment:1970000, loan_amount:1970000, interest_rate:9.99, loan_tenure_months:60, monthly_emi:50000 },
    { vehicle_number:'RJ43GA0834', bank_name:'Friend(Mukesh)', purchase_date:'2026-03-27', ex_showroom_price:1220000, down_payment:500000, loan_amount:500000, interest_rate:0 },
  ]);
  console.log('  ✓ banking: 3');

  // === VERIFY ===
  console.log('\n=== VERIFICATION ===');
  for (const t of ['partners','drivers','vehicles','routes','trips','expenses','capital_contributions','banking_information']) {
    const { count } = await s.from(t).select('*',{count:'exact',head:true});
    console.log(`  ${t}: ${count}`);
  }

  // Paid by distribution
  const { data: pbData } = await s.from('expenses').select('paid_by');
  const pbCounts = {};
  pbData.forEach(r => { pbCounts[r.paid_by] = (pbCounts[r.paid_by]||0)+1; });
  console.log('\n  paid_by distribution:', pbCounts);

  console.log('\n✅ DONE!');
}

run().catch(console.error);
