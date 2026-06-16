-- Run this in Supabase SQL Editor to enable optimized dashboard stats
-- (Also appended to supabase/schema.sql for new installs)

CREATE OR REPLACE FUNCTION public.dashboard_stats(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_trip_vehicle text DEFAULT NULL,
  p_trip_search text DEFAULT NULL,
  p_exp_paid_by text DEFAULT NULL,
  p_exp_paid_by_person text DEFAULT NULL,
  p_exp_person text DEFAULT NULL,
  p_exp_vehicle text DEFAULT NULL,
  p_exp_payment_source text DEFAULT NULL,
  p_exp_search text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trip_count bigint;
  trip_revenue numeric;
  exp_count bigint;
  exp_total numeric;
  jm_total numeric;
  mahesh_total numeric;
  capital_total numeric;
  cash_revenue numeric;
  cash_exp_revenue numeric;
  cash_cap_revenue numeric;
  trip_pattern text;
  exp_pattern text;
BEGIN
  trip_pattern := CASE
    WHEN p_trip_search IS NULL OR btrim(p_trip_search) = '' THEN NULL
    ELSE '%' || replace(replace(replace(btrim(p_trip_search), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  END;
  exp_pattern := CASE
    WHEN p_exp_search IS NULL OR btrim(p_exp_search) = '' THEN NULL
    ELSE '%' || replace(replace(replace(btrim(p_exp_search), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  END;

  SELECT count(*)::bigint, coalesce(sum(total_revenue), 0)
  INTO trip_count, trip_revenue
  FROM trips t
  WHERE (p_date_from IS NULL OR t.date >= p_date_from)
    AND (p_date_to IS NULL OR t.date <= p_date_to)
    AND (p_trip_vehicle IS NULL OR p_trip_vehicle = '' OR t.vehicle_number = p_trip_vehicle)
    AND (
      trip_pattern IS NULL OR
      t.vehicle_number ILIKE trip_pattern OR
      t.route_name ILIKE trip_pattern OR
      t.driver_name ILIKE trip_pattern
    );

  SELECT count(*)::bigint,
         coalesce(sum(amount), 0),
         coalesce(sum(amount) FILTER (WHERE paid_by = 'JM transport'), 0),
         coalesce(sum(amount) FILTER (WHERE paid_by = 'Mahesh'), 0)
  INTO exp_count, exp_total, jm_total, mahesh_total
  FROM expenses e
  WHERE (p_date_from IS NULL OR e.date >= p_date_from)
    AND (p_date_to IS NULL OR e.date <= p_date_to)
    AND (p_exp_paid_by IS NULL OR p_exp_paid_by = '' OR e.paid_by = p_exp_paid_by)
    AND (p_exp_paid_by_person IS NULL OR p_exp_paid_by_person = '' OR e.paid_by_person = p_exp_paid_by_person)
    AND (p_exp_person IS NULL OR p_exp_person = '' OR e.person = p_exp_person)
    AND (p_exp_vehicle IS NULL OR p_exp_vehicle = '' OR e.vehicle_number = p_exp_vehicle)
    AND (p_exp_payment_source IS NULL OR p_exp_payment_source = '' OR e.payment_source = p_exp_payment_source)
    AND (
      exp_pattern IS NULL OR
      e.description ILIKE exp_pattern OR
      e.category ILIKE exp_pattern OR
      e.vehicle_number ILIKE exp_pattern OR
      e.person ILIKE exp_pattern OR
      e.paid_by_person ILIKE exp_pattern OR
      e.bill_receipt_ref ILIKE exp_pattern OR
      e.paid_by ILIKE exp_pattern
    );

  SELECT coalesce(sum(value), 0) INTO capital_total FROM capital_contributions;
  SELECT coalesce(sum(total_revenue), 0) INTO cash_revenue FROM trips;
  SELECT coalesce(sum(amount), 0) INTO cash_exp_revenue FROM expenses WHERE payment_source = 'Revenue';
  SELECT coalesce(sum(value), 0) INTO cash_cap_revenue
  FROM capital_contributions WHERE status = 'Paid' AND payment_source = 'Revenue';

  RETURN jsonb_build_object(
    'tripCount', trip_count,
    'totalRevenue', trip_revenue,
    'expenseCount', exp_count,
    'totalExpenses', exp_total,
    'jmTotal', jm_total,
    'maheshTotal', mahesh_total,
    'totalCapitalIn', capital_total,
    'cashAvailable', cash_revenue - cash_exp_revenue - cash_cap_revenue,
    'dailyTrips', coalesce((
      SELECT jsonb_agg(jsonb_build_object('date', d.date, 'revenue', d.revenue) ORDER BY d.date)
      FROM (
        SELECT t.date, sum(t.total_revenue) AS revenue
        FROM trips t
        WHERE (p_date_from IS NULL OR t.date >= p_date_from)
          AND (p_date_to IS NULL OR t.date <= p_date_to)
          AND (p_trip_vehicle IS NULL OR p_trip_vehicle = '' OR t.vehicle_number = p_trip_vehicle)
          AND (
            trip_pattern IS NULL OR
            t.vehicle_number ILIKE trip_pattern OR
            t.route_name ILIKE trip_pattern OR
            t.driver_name ILIKE trip_pattern
          )
        GROUP BY t.date
      ) d
    ), '[]'::jsonb),
    'dailyExpenses', coalesce((
      SELECT jsonb_agg(jsonb_build_object('date', d.date, 'expenses', d.expenses) ORDER BY d.date)
      FROM (
        SELECT e.date, sum(e.amount) AS expenses
        FROM expenses e
        WHERE (p_date_from IS NULL OR e.date >= p_date_from)
          AND (p_date_to IS NULL OR e.date <= p_date_to)
          AND (p_exp_paid_by IS NULL OR p_exp_paid_by = '' OR e.paid_by = p_exp_paid_by)
          AND (p_exp_paid_by_person IS NULL OR p_exp_paid_by_person = '' OR e.paid_by_person = p_exp_paid_by_person)
          AND (p_exp_person IS NULL OR p_exp_person = '' OR e.person = p_exp_person)
          AND (p_exp_vehicle IS NULL OR p_exp_vehicle = '' OR e.vehicle_number = p_exp_vehicle)
          AND (p_exp_payment_source IS NULL OR p_exp_payment_source = '' OR e.payment_source = p_exp_payment_source)
          AND (
            exp_pattern IS NULL OR
            e.description ILIKE exp_pattern OR
            e.category ILIKE exp_pattern OR
            e.vehicle_number ILIKE exp_pattern OR
            e.person ILIKE exp_pattern OR
            e.paid_by_person ILIKE exp_pattern OR
            e.bill_receipt_ref ILIKE exp_pattern OR
            e.paid_by ILIKE exp_pattern
          )
        GROUP BY e.date
      ) d
    ), '[]'::jsonb),
    'categoryBreakdown', coalesce((
      SELECT jsonb_agg(jsonb_build_object('name', c.category, 'value', c.total) ORDER BY c.total DESC)
      FROM (
        SELECT e.category, sum(e.amount) AS total
        FROM expenses e
        WHERE (p_date_from IS NULL OR e.date >= p_date_from)
          AND (p_date_to IS NULL OR e.date <= p_date_to)
          AND (p_exp_paid_by IS NULL OR p_exp_paid_by = '' OR e.paid_by = p_exp_paid_by)
          AND (p_exp_paid_by_person IS NULL OR p_exp_paid_by_person = '' OR e.paid_by_person = p_exp_paid_by_person)
          AND (p_exp_person IS NULL OR p_exp_person = '' OR e.person = p_exp_person)
          AND (p_exp_vehicle IS NULL OR p_exp_vehicle = '' OR e.vehicle_number = p_exp_vehicle)
          AND (p_exp_payment_source IS NULL OR p_exp_payment_source = '' OR e.payment_source = p_exp_payment_source)
          AND (
            exp_pattern IS NULL OR
            e.description ILIKE exp_pattern OR
            e.category ILIKE exp_pattern OR
            e.vehicle_number ILIKE exp_pattern OR
            e.person ILIKE exp_pattern OR
            e.paid_by_person ILIKE exp_pattern OR
            e.bill_receipt_ref ILIKE exp_pattern OR
            e.paid_by ILIKE exp_pattern
          )
        GROUP BY e.category
        HAVING sum(e.amount) > 0
      ) c
    ), '[]'::jsonb),
    'vehicleExpenses', coalesce((
      SELECT jsonb_agg(jsonb_build_object('vehicle', v.vehicle_number, 'amount', v.total) ORDER BY v.total DESC)
      FROM (
        SELECT e.vehicle_number, sum(e.amount) AS total
        FROM expenses e
        WHERE e.expense_type = 'vehicle'
          AND e.vehicle_number IS NOT NULL
          AND (p_date_from IS NULL OR e.date >= p_date_from)
          AND (p_date_to IS NULL OR e.date <= p_date_to)
          AND (p_exp_paid_by IS NULL OR p_exp_paid_by = '' OR e.paid_by = p_exp_paid_by)
          AND (p_exp_paid_by_person IS NULL OR p_exp_paid_by_person = '' OR e.paid_by_person = p_exp_paid_by_person)
          AND (p_exp_person IS NULL OR p_exp_person = '' OR e.person = p_exp_person)
          AND (p_exp_vehicle IS NULL OR p_exp_vehicle = '' OR e.vehicle_number = p_exp_vehicle)
          AND (p_exp_payment_source IS NULL OR p_exp_payment_source = '' OR e.payment_source = p_exp_payment_source)
          AND (
            exp_pattern IS NULL OR
            e.description ILIKE exp_pattern OR
            e.category ILIKE exp_pattern OR
            e.vehicle_number ILIKE exp_pattern OR
            e.person ILIKE exp_pattern OR
            e.paid_by_person ILIKE exp_pattern OR
            e.bill_receipt_ref ILIKE exp_pattern OR
            e.paid_by ILIKE exp_pattern
          )
        GROUP BY e.vehicle_number
      ) v
    ), '[]'::jsonb)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_stats TO anon;
GRANT EXECUTE ON FUNCTION public.dashboard_stats TO authenticated;
