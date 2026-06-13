-- Seed data migrated from Google Sheets
-- Run this AFTER schema.sql

-- Partners (all people/entities who pay or contribute)
INSERT INTO partners (name) VALUES
('JM transport'),
('Kamal'),
('Subham'),
('Bimal'),
('Mohit'),
('Mahesh')
ON CONFLICT (name) DO NOTHING;

-- Drivers
INSERT INTO drivers (name) VALUES
('Pratap Ram'),
('Laxman'),
('Babu Khan'),
('Janu Khan')
ON CONFLICT (name) DO NOTHING;

-- Vehicles
INSERT INTO vehicles (vehicle_number, vehicle_type, model, capacity_tons) VALUES
('RJ43GA0834', 'Truck', '4018', 35),
('RJ07GD6596', 'Truck', '5525', 42),
('HR26CW7512', 'Personal Car', NULL, NULL)
ON CONFLICT (vehicle_number) DO NOTHING;

-- Routes
INSERT INTO routes (origin, destination, route_name, distance_km, standard_rate_per_ton) VALUES
('washrey', 'chirai', 'washrey-chirai', 60, 270.00),
('khvda', 'kandla', 'khavda-kandla', 150, 500.00),
('kodol', 'padna', 'kodol-padana', 70, 295.00)
ON CONFLICT (route_name) DO NOTHING;

-- Trips (27 records)
INSERT INTO trips (date, vehicle_number, route_name, driver_name, weight_tons, distance_km, rate_per_ton, total_revenue, advance_paid, balance_due) VALUES
('2026-05-25', 'RJ07GD6596', 'washrey-chirai', 'Pratap Ram', 48.20, 120, 275.00, 13022.00, 0, 0),
('2026-05-27', 'RJ07GD6596', 'washrey-chirai', 'Pratap Ram', 50.00, 120, 275.00, 13499.00, 0, 0),
('2026-05-30', 'RJ07GD6596', 'washrey-chirai', 'Pratap Ram', 102.50, 240, 275.00, 27692.00, 0, 0),
('2026-05-30', 'RJ07GD6596', 'washrey-chirai', 'Pratap Ram', 50.00, 120, 275.00, 13766.00, 0, 0),
('2026-06-02', 'RJ07GD6596', 'washrey-chirai', 'Laxman', 50.00, 120, 275.00, 13752.00, 0, 0),
('2026-06-05', 'RJ43GA0834', 'khavda-kandla', 'Laxman', 34.00, 150, 500.00, 18684.00, 0, 0),
('2026-06-04', 'RJ07GD6596', 'washrey-chirai', 'Babu Khan', 50.72, 120, 275.00, 13948.00, 0, 0),
('2026-06-05', 'RJ07GD6596', 'washrey-chirai', 'Babu Khan', 54.16, 120, 275.00, 14894.00, 0, 0),
('2026-06-06', 'RJ07GD6596', 'washrey-chirai', 'Janu Khan', 52.15, 120, 275.00, 14341.00, 0, 0),
('2026-06-06', 'RJ07GD6596', 'washrey-chirai', 'Janu Khan', 53.52, 120, 275.00, 14718.00, 0, 0),
('2026-06-06', 'RJ07GD6596', 'washrey-chirai', 'Babu Khan', 52.98, 120, 275.00, 14569.00, 0, 0),
('2026-06-06', 'RJ43GA0834', 'washrey-chirai', 'Laxman', 34.65, 120, 275.00, 9528.00, 0, 0),
('2026-06-06', 'RJ07GD6596', 'washrey-chirai', 'Babu Khan', 52.94, 120, 275.00, 14561.00, 0, 0),
('2026-06-07', 'RJ07GD6596', 'washrey-chirai', 'Janu Khan', 52.94, 120, 275.00, 14561.00, 0, 0),
('2026-06-07', 'RJ07GD6596', 'washrey-chirai', 'Babu Khan', 52.94, 120, 275.00, 14561.00, 0, 0),
('2026-06-09', 'RJ43GA0834', 'washrey-chirai', 'Laxman', 35.00, 120, 275.00, 10000.00, 0, 0),
('2026-06-09', 'RJ43GA0834', 'washrey-chirai', 'Laxman', 35.00, 120, 275.00, 10605.00, 0, 0),
('2026-06-09', 'RJ43GA0834', 'washrey-chirai', 'Laxman', 34.99, 120, 275.00, 9622.25, 0, 0),
('2026-06-09', 'RJ07GD6596', 'washrey-chirai', 'Babu Khan', 50.78, 120, 275.00, 15908.75, 0, 0),
('2026-06-09', 'RJ07GD6596', 'washrey-chirai', 'Janu Khan', 57.85, 120, 275.00, 13964.50, 0, 0),
('2026-06-10', 'RJ07GD6596', 'washrey-chirai', 'Babu Khan', 53.23, 120, 275.00, 14638.25, 0, 0),
('2026-06-10', 'RJ07GD6596', 'kodol-padana', 'Janu Khan', 59.86, 140, 295.00, 17658.00, 0, 0),
('2026-06-10', 'RJ43GA0834', 'kodol-padana', 'Laxman', 36.08, 140, 295.00, 10643.60, 0, 0),
('2026-06-11', 'RJ43GA0834', 'kodol-padana', 'Laxman', 42.37, 140, 295.00, 12499.15, 0, 0),
('2026-06-12', 'RJ43GA0834', 'kodol-padana', 'Laxman', 37.85, 140, 295.00, 11165.75, 0, 0),
('2026-06-13', 'RJ43GA0834', 'kodol-padana', 'Laxman', 39.18, 140, 295.00, 11558.10, 0, 0),
('2026-06-13', 'RJ07GD6596', 'kodol-padana', 'Babu Khan', 56.52, 140, 295.00, 16673.40, 0, 0);

-- Vehicle Expenses (79 records)
INSERT INTO expenses (date, expense_type, vehicle_number, category, amount, description, paid_by, status, person) VALUES
('2026-05-13', 'vehicle', 'RJ07GD6596', 'Others', 7500.00, 'Mahindera First Choice Pyment', 'JM transport', 'Paid', 'Kamal'),
('2026-05-18', 'vehicle', 'HR26CW7512', 'Fuel (Diesel)', 2000.00, 'BKN->GandhiDham', 'JM transport', 'Paid', 'Subham'),
('2026-05-19', 'vehicle', 'HR26CW7512', 'Fuel (Diesel)', 3707.00, 'BKN->GandhiDham', 'JM transport', 'Paid', 'Subham'),
('2026-05-19', 'vehicle', 'HR26CW7512', 'Toll Taxes', 3103.00, 'Toll Tax Pass', 'JM transport', 'Paid', 'Subham'),
('2026-05-19', 'vehicle', 'HR26CW7512', 'Fuel (Diesel)', 1000.00, 'BKN->GandhiDham', 'JM transport', 'Paid', 'Subham'),
('2026-05-19', 'vehicle', 'HR26CW7512', 'Fuel (Diesel)', 472.00, 'BKN->GandhiDham', 'JM transport', 'Paid', 'Subham'),
('2026-05-18', 'vehicle', 'HR26CW7512', 'Maintenance', 10800.00, 'Tyre Changes', 'JM transport', 'Paid', 'Kamal'),
('2026-05-20', 'vehicle', 'RJ07GD6596', 'Others', 29000.00, 'Parking charge', 'JM transport', 'Paid', 'Kamal'),
('2026-05-20', 'vehicle', 'HR26CW7512', 'Fuel (Diesel)', 4550.00, 'In GandhiDham', 'JM transport', 'Paid', 'Subham'),
('2026-05-20', 'vehicle', 'RJ07GD6596', 'Others', 2500.00, 'Keys making', 'JM transport', 'Paid', 'Kamal'),
('2026-05-20', 'vehicle', 'RJ07GD6596', 'Others', 800.00, 'battery charge', 'JM transport', 'Paid', 'Kamal'),
('2026-05-22', 'vehicle', 'HR26CW7512', 'Fuel (Diesel)', 2000.00, 'Krishna Petrolium', 'JM transport', 'Paid', 'Subham'),
('2026-05-22', 'vehicle', 'RJ07GD6596', 'Fuel (Diesel)', 2050.00, 'Krishna Petrolium', 'JM transport', 'Paid', 'Subham'),
('2026-05-22', 'vehicle', 'RJ07GD6596', 'Fuel (Diesel)', 2050.00, '', 'JM transport', 'Paid', 'Subham'),
('2026-05-23', 'vehicle', 'RJ07GD6596', 'Insurance', 2000.00, 'Gujarat tax', 'JM transport', 'Paid', 'Kamal'),
('2026-05-23', 'vehicle', 'RJ07GD6596', 'Others', 100.00, 'Accessories', 'JM transport', 'Paid', 'Kamal'),
('2026-05-23', 'vehicle', 'RJ07GD6596', 'Others', 500.00, 'washing', 'JM transport', 'Paid', 'Kamal'),
('2026-05-23', 'vehicle', 'RJ07GD6596', 'Others', 40.00, 'Water', 'JM transport', 'Paid', 'Kamal'),
('2026-05-23', 'vehicle', 'RJ07GD6596', 'Others', 500.00, 'Battery charge', 'JM transport', 'Paid', 'Kamal'),
('2026-05-23', 'vehicle', 'RJ07GD6596', 'Others', 300.00, 'battery start', 'JM transport', 'Paid', 'Kamal'),
('2026-05-23', 'vehicle', 'RJ07GD6596', 'Maintenance', 100.00, 'window fix', 'JM transport', 'Paid', 'Kamal'),
('2026-05-22', 'vehicle', 'RJ07GD6596', 'Fuel (Diesel)', 2100.00, '', 'JM transport', 'Paid', 'Subham'),
('2026-05-24', 'vehicle', 'RJ07GD6596', 'Maintenance', 12200.00, 'Valve Gear Fix', 'JM transport', 'Paid', 'Bimal'),
('2026-05-24', 'vehicle', 'HR26CW7512', 'Fuel (Diesel)', 2000.00, '', 'JM transport', 'Paid', ''),
('2026-05-24', 'vehicle', 'RJ07GD6596', 'Maintenance', 320.00, 'mistri', 'JM transport', 'Paid', 'Kamal'),
('2026-05-25', 'vehicle', 'RJ43GA0834', 'Others', 1800.00, 'parking', 'JM transport', 'Paid', 'Kamal'),
('2026-05-25', 'vehicle', 'RJ07GD6596', 'Others', 360.00, 'belt', 'JM transport', 'Paid', 'Kamal'),
('2026-05-25', 'vehicle', 'RJ07GD6596', 'Others', 1150.00, 'chalni', 'JM transport', 'Paid', 'Mohit'),
('2026-05-26', 'vehicle', 'RJ07GD6596', 'Fuel (Diesel)', 9808.00, 'RR petrolium', 'JM transport', 'Paid', 'Subham'),
('2026-05-26', 'vehicle', 'RJ07GD6596', 'Maintenance', 11000.00, 'Truck maintaice', 'JM transport', 'Paid', 'Bimal'),
('2026-05-27', 'vehicle', 'RJ07GD6596', 'Fuel (Diesel)', 14712.00, 'Reliable Pettrolium', 'JM transport', 'Paid', 'Subham'),
('2026-05-29', 'vehicle', 'RJ07GD6596', 'Maintenance', 2000.00, 'Lathe Machine', 'JM transport', 'Paid', 'Mohit'),
('2026-05-29', 'vehicle', 'RJ07GD6596', 'Maintenance', 8900.00, 'Truck Part', 'JM transport', 'Paid', 'Bimal'),
('2026-05-30', 'vehicle', 'RJ07GD6596', 'Fuel (Diesel)', 8000.00, 'Jalyan Petrol Pump', 'JM transport', 'Paid', 'Subham'),
('2026-06-02', 'vehicle', 'RJ07GD6596', 'Fuel (Diesel)', 4904.00, 'RR petrolium', 'JM transport', 'Paid', 'Subham'),
('2026-06-03', 'vehicle', 'RJ07GD6596', 'Others', 5000.00, 'Gujarat tax', 'JM transport', 'Paid', 'Mohit'),
('2026-06-03', 'vehicle', 'HR26CW7512', 'Fuel (Diesel)', 3000.00, 'Shree krishna', 'JM transport', 'Paid', ''),
('2026-06-03', 'vehicle', 'RJ07GD6596', 'Maintenance', 195000.00, 'Tyre', 'JM transport', 'Paid', 'Mohit'),
('2026-06-03', 'vehicle', 'RJ43GA0834', 'Insurance', 53764.00, 'Shri Ran', 'JM transport', 'Paid', 'Subham'),
('2026-06-03', 'vehicle', 'RJ07GD6596', 'Maintenance', 480.00, 'Truck Part', 'JM transport', 'Paid', 'Mohit'),
('2026-06-03', 'vehicle', 'RJ07GD6596', 'Fuel (Diesel)', 3000.00, 'Diesel trishul petrolium', 'JM transport', 'Paid', 'Subham'),
('2026-06-03', 'vehicle', 'RJ43GA0834', 'Fuel (Diesel)', 4500.00, 'From Kamal for diesel', 'JM transport', 'Paid', 'Kamal'),
('2026-06-03', 'vehicle', 'RJ07GD6596', 'Fuel (Diesel)', 10093.00, 'jay Murlidhar petrolium', 'JM transport', 'Paid', 'Subham'),
('2026-06-03', 'vehicle', 'RJ43GA0834', 'Fuel (Diesel)', 9892.00, 'Khavda petrolium', 'JM transport', 'Paid', 'Subham'),
('2026-06-04', 'vehicle', 'RJ07GD6596', 'Fuel (Diesel)', 9808.00, 'Jalyan Petrol Pump', 'JM transport', 'Paid', ''),
('2026-06-05', 'vehicle', 'RJ07GD6596', 'Fuel (Diesel)', 25000.00, 'Jalyan Petrol Pump', 'JM transport', 'Paid', ''),
('2026-06-05', 'vehicle', 'RJ43GA0834', 'Maintenance', 2500.00, 'weilding', 'JM transport', 'Paid', 'Mohit'),
('2026-06-05', 'vehicle', 'RJ43GA0834', 'Others', 900.00, 'jhali', 'JM transport', 'Paid', 'Mohit'),
('2026-06-06', 'vehicle', 'HR26CW7512', 'Fuel (Diesel)', 2000.00, 'krishna petrolium', 'JM transport', 'Paid', 'Subham'),
('2026-06-06', 'vehicle', 'RJ07GD6596', 'Maintenance', 500.00, 'chakka to janu khan', 'JM transport', 'Paid', 'Mohit'),
('2026-06-06', 'vehicle', 'RJ07GD6596', 'Fuel (Diesel)', 9808.00, '', 'JM transport', 'Paid', 'Subham'),
('2026-06-07', 'vehicle', 'RJ43GA0834', 'Fuel (Diesel)', 19616.00, 'rr petrolium', 'JM transport', 'Paid', 'Subham'),
('2026-06-07', 'vehicle', 'RJ07GD6596', 'Fuel (Diesel)', 19616.00, 'reliable petrolium', 'JM transport', 'Paid', 'Subham'),
('2026-06-07', 'vehicle', 'RJ43GA0834', 'Maintenance', 8800.00, 'oil filter change + labour', 'JM transport', 'Paid', 'Mohit'),
('2026-06-07', 'vehicle', 'RJ07GD6596', 'Maintenance', 5500.00, 'Gas lek fix', 'JM transport', 'Paid', 'Mohit'),
('2026-06-07', 'vehicle', 'RJ07GD6596', 'Maintenance', 1150.00, 'saman ka', 'JM transport', 'Paid', 'Mohit'),
('2026-06-07', 'vehicle', 'RJ07GD6596', 'Maintenance', 700.00, 'labour', 'JM transport', 'Paid', 'Mohit'),
('2026-06-09', 'vehicle', 'HR26CW7512', 'Fuel (Diesel)', 2000.00, 'diesel from yes bank', 'JM transport', 'Paid', 'Subham'),
('2026-06-09', 'vehicle', 'HR26CW7512', 'Maintenance', 1600.00, 'car wash and maintenance', 'JM transport', 'Paid', 'Subham'),
('2026-06-09', 'vehicle', 'RJ43GA0834', 'Fuel (Diesel)', 2850.00, '', 'JM transport', 'Paid', 'Bimal'),
('2026-06-09', 'vehicle', 'RJ07GD6596', 'Fuel (Diesel)', 29424.00, 'reliable petrolium', 'JM transport', 'Paid', 'Subham'),
('2026-06-09', 'vehicle', 'RJ07GD6596', 'Maintenance', 300.00, 'tyre repair', 'JM transport', 'Paid', 'Mohit'),
('2026-06-09', 'vehicle', 'RJ43GA0834', 'Fuel (Diesel)', 9808.00, 'rr petrolium', 'JM transport', 'Paid', 'Subham'),
('2026-06-10', 'vehicle', 'RJ43GA0834', 'Maintenance', 700.00, 'kabani', 'JM transport', 'Paid', 'Mohit'),
('2026-06-10', 'vehicle', 'RJ43GA0834', 'Fuel (Diesel)', 2000.00, 'krushna petrolium', 'JM transport', 'Paid', 'Bimal'),
('2026-06-12', 'vehicle', 'HR26CW7512', 'Fuel (Diesel)', 2000.00, 'reliable petrolium', 'JM transport', 'Paid', 'Subham'),
('2026-06-12', 'vehicle', 'HR26CW7512', 'Fuel (Diesel)', 9808.00, 'reliable petrolium', 'JM transport', 'Paid', 'Subham'),
('2026-06-12', 'vehicle', 'RJ43GA0834', 'Others', 5000.00, 'gaadi name transfer', 'JM transport', 'Paid', 'Kamal'),
('2026-06-12', 'vehicle', 'RJ07GD6596', 'Fuel (Diesel)', 9808.00, 'reliable petrolium', 'JM transport', 'Paid', 'Subham'),
('2026-06-12', 'vehicle', 'RJ07GD6596', 'Fuel (Diesel)', 9808.00, 'reliable petrolium', 'JM transport', 'Paid', 'Subham'),
('2026-06-13', 'vehicle', 'RJ07GD6596', 'Others', 550.00, 'Gaadi bhdne ke roj', 'JM transport', 'Paid', 'Mohit'),
('2026-06-13', 'vehicle', 'RJ43GA0834', 'Maintenance', 2400.00, 'Parts Ka Gear Oil', 'JM transport', 'Paid', 'Mohit'),
('2026-06-13', 'vehicle', 'RJ43GA0834', 'Maintenance', 350.00, 'mistery', 'JM transport', 'Paid', 'Mohit'),
('2026-06-13', 'vehicle', 'RJ07GD6596', 'Maintenance', 400.00, 'mistery', 'JM transport', 'Paid', 'Mohit'),
('2026-06-13', 'vehicle', 'RJ43GA0834', 'Fuel (Diesel)', 4904.00, 'Diesel', 'JM transport', 'Paid', 'Bimal'),
('2026-06-13', 'vehicle', 'RJ07GD6596', 'Fuel (Diesel)', 11769.00, 'Diesel', 'JM transport', 'Paid', 'Bimal'),
('2026-06-13', 'vehicle', 'RJ07GD6596', 'Fuel (Diesel)', 19616.00, 'Diesel', 'JM transport', 'Paid', 'Bimal');

-- Operational / Personal / Other Expenses (37 records)
INSERT INTO expenses (date, expense_type, vehicle_number, person, category, amount, description, paid_by) VALUES
('2026-05-19', 'operational', NULL, 'Bimal/Mohit/Mahesh', 'Meals', 300.00, 'In Gandhi Dham', 'JM transport'),
('2026-05-19', 'operational', NULL, 'Bimal/Mohit/Mahesh', 'Hotel Stay', 1600.00, 'Rent Gandhidham', 'JM transport'),
('2026-05-20', 'operational', NULL, 'Bimal/Mohit/Mahesh', 'Meals', 300.00, 'In Gandhi Dham', 'JM transport'),
('2026-05-23', 'operational', NULL, 'Bimal/Mohit/Mahesh', 'Rent', 23500.00, 'room rent advance', 'JM transport'),
('2026-05-22', 'operational', NULL, 'Bimal/Mohit/Mahesh', 'Meals', 500.00, 'lunch', 'JM transport'),
('2026-05-23', 'operational', NULL, 'Bimal/Mohit/Mahesh', 'Meals', 280.00, 'lunch', 'JM transport'),
('2026-05-24', 'operational', NULL, 'Bimal/Mohit/Mahesh', 'Meals', 402.00, 'Lunch', 'JM transport'),
('2026-05-25', 'operational', NULL, 'Bimal/Mohit/Mahesh', 'Meals', 470.00, 'lunch', 'JM transport'),
('2026-05-25', 'operational', NULL, 'Bimal/Mohit/Mahesh', 'Supplies', 831.00, 'Dmart bill', 'JM transport'),
('2026-05-25', 'personal', NULL, 'Bimal/Mohit/Mahesh', 'Other', 400.00, 'salon', 'JM transport'),
('2026-05-25', 'other', NULL, 'Bimal/Mohit/Mahesh', 'Other', 173.00, 'Dmart bill', 'JM transport'),
('2026-05-26', 'operational', NULL, 'Bimal/Mohit/Mahesh', 'Meals', 160.00, 'Dinner', 'JM transport'),
('2026-05-27', 'other', NULL, 'Bimal/Mohit/Mahesh', 'Other', 265.00, 'House expense', 'JM transport'),
('2026-05-27', 'operational', NULL, 'Bimal/Mohit/Mahesh', 'Meals', 400.00, 'lunch', 'JM transport'),
('2026-05-30', 'other', NULL, 'Bimal/Mohit/Mahesh', 'Other', 240.00, 'Room Expense', 'JM transport'),
('2026-05-31', 'other', NULL, 'Bimal/Mohit/Mahesh', 'Other', 150.00, 'Room Expense', 'JM transport'),
('2026-05-31', 'operational', NULL, 'Bimal/Mohit/Mahesh', 'Meals', 210.00, 'Breakfast', 'JM transport'),
('2026-05-31', 'operational', NULL, 'Bimal/Mohit/Mahesh', 'Meals', 200.00, 'dinner', 'JM transport'),
('2026-05-31', 'other', NULL, 'Bimal/Mohit/Mahesh', 'Other', 185.00, 'lock', 'JM transport'),
('2026-05-31', 'operational', NULL, 'Bimal/Mohit/Mahesh', 'Meals', 50.00, 'chai', 'JM transport'),
('2026-05-31', 'operational', NULL, 'Bimal/Mohit/Mahesh', 'Meals', 120.00, 'cold drink', 'JM transport'),
('2026-06-03', 'other', NULL, 'Bimal/Mohit/Mahesh', 'Other', 1000.00, 'Room expense', 'JM transport'),
('2026-06-02', 'operational', NULL, 'Bimal/Mohit/Mahesh', 'Meals', 456.00, 'Swiggy se', 'JM transport'),
('2026-06-04', 'operational', NULL, 'Bimal/Mohit/Mahesh', 'Meals', 500.00, 'lunch', 'JM transport'),
('2026-06-05', 'operational', NULL, 'Bimal/Mohit/Mahesh', 'Meals', 335.00, 'dinner', 'JM transport'),
('2026-06-05', 'other', NULL, 'Bimal/Mohit/Mahesh', 'Other', 60.00, 'tea', 'JM transport'),
('2026-06-06', 'other', NULL, 'Bimal/Mohit/Mahesh', 'Other', 400.00, 'in jhaka travels for utensils', 'JM transport'),
('2026-06-06', 'operational', NULL, 'Bimal/Mohit/Mahesh', 'Meals', 270.00, 'dinner', 'JM transport'),
('2026-06-07', 'operational', NULL, 'Bimal/Mohit/Mahesh', 'Meals', 4900.00, 'dmart bill', 'JM transport'),
('2026-06-07', 'other', NULL, 'Bimal/Mohit/Mahesh', 'Other', 303.00, 'blinkit for sabji', 'JM transport'),
('2026-06-09', 'operational', NULL, 'Bimal/Mohit/Mahesh', 'Meals', 150.00, 'only bimal', 'JM transport'),
('2026-06-09', 'operational', NULL, 'Bimal/Mohit/Mahesh', 'Meals', 120.00, 'fruits', 'JM transport'),
('2026-06-12', 'operational', NULL, 'Janu Khan', 'Daily Allowance', 500.00, '', 'JM transport'),
('2026-06-12', 'operational', NULL, 'Bimal/Mohit/Mahesh', 'Meals', 474.00, 'blinkit order', 'JM transport'),
('2026-06-13', 'operational', NULL, 'Babu Khan', 'Daily Allowance', 1000.00, '', 'JM transport'),
('2026-06-13', 'operational', NULL, 'Janu Khan', 'Daily Allowance', 1000.00, '', 'JM transport'),
('2026-06-13', 'other', NULL, 'Bimal/Mohit/Mahesh', 'Other', 130.00, '', 'JM transport');

-- Capital Contributions (20 records)
INSERT INTO capital_contributions (date, contributor, contribution_type, value, description, asset_details) VALUES
('2026-05-24', 'Subham', 'Credit Card', 16043.00, 'In diesel', 'Indusind CC'),
('2026-05-24', 'Bimal', 'Credit Card', 12200.00, 'In Maintance', ''),
('2026-05-25', 'Bimal', 'Credit Card', 1003.00, 'for supply', ''),
('2026-05-26', 'Subham', 'Credit Card', 9808.00, 'diesel', 'HDFC CC'),
('2026-05-26', 'Bimal', 'Credit Card', 11000.00, 'to ashok leyland', ''),
('2026-05-27', 'Subham', 'Credit Card', 14712.00, 'In diesel', 'HDFC CC'),
('2026-05-30', 'Subham', 'Credit Card', 8000.00, 'In Diesel', 'HDFC CC'),
('2026-06-02', 'Subham', 'Credit Card', 4904.00, 'In Diesel', 'HDFC CC'),
('2026-06-03', 'Subham', 'Credit Card', 3000.00, 'In Diesel', 'HDFC CC'),
('2026-06-05', 'Bimal', 'Credit Card', 10093.00, 'Diesel', ''),
('2026-06-03', 'Subham', 'Credit Card', 3000.00, 'petrol', 'Indusind CC'),
('2026-06-06', 'Subham', 'Credit Card', 2000.00, 'diesel', 'Indusind CC'),
('2026-06-06', 'Subham', 'Credit Card', 9808.00, 'diesel', 'HDFC CC'),
('2026-06-07', 'Bimal', 'Credit Card', 4900.00, 'dmart', ''),
('2026-06-11', 'Bimal', 'Credit Card', 2000.00, 'diesel', 'Yes Bank'),
('2026-06-11', 'Bimal', 'Credit Card', 2850.00, 'diesel', 'Yes Bank'),
('2026-06-11', 'Subham', 'Credit Card', 29424.00, 'diesel', 'HDFC & Kotak(19616)'),
('2026-06-11', 'Subham', 'Credit Card', 9808.00, 'diesel', 'Kotak'),
('2026-06-11', 'Bimal', 'Credit Card', 2000.00, 'diesel', 'Yes Bank'),
('2026-06-12', 'Bimal', 'Credit Card', 2000.00, 'diesel', 'Yes Bank');

-- Banking Information
INSERT INTO banking_information (vehicle_number, bank_name, purchase_date, ex_showroom_price, down_payment, loan_amount, interest_rate, loan_tenure_months, monthly_emi) VALUES
('RJ43GA0834', 'Reliative', '2026-03-27', 1220000.00, 500000.00, 500000.00, 16, 10, NULL),
('RJ07GD6596', 'HDFC', '2026-05-20', 1970000.00, 1970000.00, 1970000.00, 9.99, 60, 50000.00),
('RJ43GA0834', 'Friend(Mukesh)', '2026-03-27', 1220000.00, 500000.00, 500000.00, 0, NULL, NULL);
