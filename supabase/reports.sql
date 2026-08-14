-- Accounting reports RPCs — run in Supabase SQL Editor (also in schema.sql)
-- p_date_from / p_date_to NULL = no bound (all time)

CREATE OR REPLACE FUNCTION public.monthly_pl_report(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_vehicle text DEFAULT NULL,
  p_entity text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  trip_count bigint;
  trip_revenue numeric;
  exp_total numeric;
  jm_total numeric;
  mahesh_total numeric;
BEGIN
  SELECT count(*)::bigint, coalesce(sum(total_revenue), 0)
  INTO trip_count, trip_revenue
  FROM trips t
  WHERE (p_date_from IS NULL OR t.date >= p_date_from)
    AND (p_date_to IS NULL OR t.date <= p_date_to)
    AND (p_vehicle IS NULL OR p_vehicle = '' OR t.vehicle_number = p_vehicle);

  SELECT coalesce(sum(amount), 0),
         coalesce(sum(amount) FILTER (WHERE paid_by = 'JM transport'), 0),
         coalesce(sum(amount) FILTER (WHERE paid_by = 'Mahesh'), 0)
  INTO exp_total, jm_total, mahesh_total
  FROM expenses e
  WHERE e.category IS DISTINCT FROM 'Expense Advance'
    AND (p_date_from IS NULL OR e.date >= p_date_from)
    AND (p_date_to IS NULL OR e.date <= p_date_to)
    AND (p_vehicle IS NULL OR p_vehicle = '' OR e.vehicle_number = p_vehicle)
    AND (p_entity IS NULL OR p_entity = '' OR e.paid_by = p_entity);

  RETURN jsonb_build_object(
    'tripCount', trip_count,
    'totalRevenue', trip_revenue,
    'totalExpenses', exp_total,
    'netProfit', trip_revenue - exp_total,
    'jmTotal', jm_total,
    'maheshTotal', mahesh_total,
    'expensesByType', coalesce((
      SELECT jsonb_agg(jsonb_build_object('type', x.expense_type, 'amount', x.total) ORDER BY x.total DESC)
      FROM (
        SELECT e.expense_type::text AS expense_type, sum(e.amount) AS total
        FROM expenses e
        WHERE e.category IS DISTINCT FROM 'Expense Advance'
          AND (p_date_from IS NULL OR e.date >= p_date_from)
          AND (p_date_to IS NULL OR e.date <= p_date_to)
          AND (p_vehicle IS NULL OR p_vehicle = '' OR e.vehicle_number = p_vehicle)
          AND (p_entity IS NULL OR p_entity = '' OR e.paid_by = p_entity)
        GROUP BY e.expense_type
        HAVING sum(e.amount) > 0
      ) x
    ), '[]'::jsonb),
    'expensesByCategory', coalesce((
      SELECT jsonb_agg(jsonb_build_object('category', x.category, 'amount', x.total) ORDER BY x.total DESC)
      FROM (
        SELECT e.category, sum(e.amount) AS total
        FROM expenses e
        WHERE e.category IS DISTINCT FROM 'Expense Advance'
          AND (p_date_from IS NULL OR e.date >= p_date_from)
          AND (p_date_to IS NULL OR e.date <= p_date_to)
          AND (p_vehicle IS NULL OR p_vehicle = '' OR e.vehicle_number = p_vehicle)
          AND (p_entity IS NULL OR p_entity = '' OR e.paid_by = p_entity)
        GROUP BY e.category
        HAVING sum(e.amount) > 0
      ) x
    ), '[]'::jsonb),
    'expensesByEntity', coalesce((
      SELECT jsonb_agg(jsonb_build_object('entity', x.paid_by, 'amount', x.total) ORDER BY x.total DESC)
      FROM (
        SELECT e.paid_by, sum(e.amount) AS total
        FROM expenses e
        WHERE e.category IS DISTINCT FROM 'Expense Advance'
          AND (p_date_from IS NULL OR e.date >= p_date_from)
          AND (p_date_to IS NULL OR e.date <= p_date_to)
          AND (p_vehicle IS NULL OR p_vehicle = '' OR e.vehicle_number = p_vehicle)
          AND (p_entity IS NULL OR p_entity = '' OR e.paid_by = p_entity)
        GROUP BY e.paid_by
        HAVING sum(e.amount) > 0
      ) x
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.vehicle_pl_report(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_entity text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'vehicles', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'vehicle', v.vehicle_number,
          'tripCount', coalesce(tr.trip_count, 0),
          'totalWeight', coalesce(tr.total_weight, 0),
          'revenue', coalesce(tr.revenue, 0),
          'vehicleExpenses', coalesce(ex.expenses, 0),
          'netProfit', coalesce(tr.revenue, 0) - coalesce(ex.expenses, 0)
        )
        ORDER BY coalesce(tr.revenue, 0) - coalesce(ex.expenses, 0) DESC
      )
      FROM vehicles v
      LEFT JOIN (
        SELECT vehicle_number,
               count(*)::bigint AS trip_count,
               coalesce(sum(weight_tons), 0) AS total_weight,
               coalesce(sum(total_revenue), 0) AS revenue
        FROM trips
        WHERE (p_date_from IS NULL OR date >= p_date_from)
          AND (p_date_to IS NULL OR date <= p_date_to)
        GROUP BY vehicle_number
      ) tr ON tr.vehicle_number = v.vehicle_number
      LEFT JOIN (
        SELECT vehicle_number, coalesce(sum(amount), 0) AS expenses
        FROM expenses
        WHERE category IS DISTINCT FROM 'Expense Advance'
          AND (p_date_from IS NULL OR date >= p_date_from)
          AND (p_date_to IS NULL OR date <= p_date_to)
          AND expense_type = 'vehicle'
          AND vehicle_number IS NOT NULL
          AND (p_entity IS NULL OR p_entity = '' OR paid_by = p_entity)
        GROUP BY vehicle_number
      ) ex ON ex.vehicle_number = v.vehicle_number
      WHERE coalesce(tr.trip_count, 0) > 0 OR coalesce(ex.expenses, 0) > 0
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.daily_trip_report(
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_vehicle text DEFAULT NULL,
  p_entity text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from date;
  v_to date;
BEGIN
  v_from := p_date_from;
  v_to := p_date_to;

  IF v_from IS NULL THEN
    SELECT min(d) INTO v_from FROM (
      SELECT min(t.date) AS d FROM trips t
        WHERE (p_vehicle IS NULL OR p_vehicle = '' OR t.vehicle_number = p_vehicle)
      UNION ALL
      SELECT min(e.date) FROM expenses e
        WHERE e.category IS DISTINCT FROM 'Expense Advance'
          AND e.expense_type = 'vehicle'
          AND (p_vehicle IS NULL OR p_vehicle = '' OR e.vehicle_number = p_vehicle)
          AND (p_entity IS NULL OR p_entity = '' OR e.paid_by = p_entity)
    ) bounds WHERE d IS NOT NULL;
  END IF;

  IF v_to IS NULL THEN
    SELECT max(d) INTO v_to FROM (
      SELECT max(t.date) AS d FROM trips t
        WHERE (p_vehicle IS NULL OR p_vehicle = '' OR t.vehicle_number = p_vehicle)
      UNION ALL
      SELECT max(e.date) FROM expenses e
        WHERE e.category IS DISTINCT FROM 'Expense Advance'
          AND e.expense_type = 'vehicle'
          AND (p_vehicle IS NULL OR p_vehicle = '' OR e.vehicle_number = p_vehicle)
          AND (p_entity IS NULL OR p_entity = '' OR e.paid_by = p_entity)
    ) bounds WHERE d IS NOT NULL;
  END IF;

  IF v_from IS NULL OR v_to IS NULL THEN
    RETURN jsonb_build_object('days', '[]'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'days', coalesce((
      SELECT jsonb_agg(day_row ORDER BY day_row->>'date')
      FROM (
        SELECT jsonb_build_object(
          'date', d.day,
          'tripCount', coalesce(tr.trip_count, 0),
          'totalWeight', coalesce(tr.total_weight, 0),
          'revenue', coalesce(tr.revenue, 0),
          'vehicleExpenses', coalesce(ex.expenses, 0),
          'netProfit', coalesce(tr.revenue, 0) - coalesce(ex.expenses, 0),
          'trips', coalesce(tr.trips, '[]'::jsonb),
          'expenses', coalesce(ex.expense_rows, '[]'::jsonb)
        ) AS day_row
        FROM (
          SELECT generate_series(v_from, v_to, '1 day'::interval)::date AS day
        ) d
        LEFT JOIN LATERAL (
          SELECT count(*)::bigint AS trip_count,
                 coalesce(sum(weight_tons), 0) AS total_weight,
                 coalesce(sum(total_revenue), 0) AS revenue,
                 coalesce(jsonb_agg(
                   jsonb_build_object(
                     'id', t.id,
                     'vehicle_number', t.vehicle_number,
                     'route_name', t.route_name,
                     'driver_name', t.driver_name,
                     'weight_tons', t.weight_tons,
                     'rate_per_ton', t.rate_per_ton,
                     'total_revenue', t.total_revenue,
                     'advance_paid', t.advance_paid,
                     'balance_due', t.balance_due
                   ) ORDER BY t.id
                 ), '[]'::jsonb) AS trips
          FROM trips t
          WHERE t.date = d.day
            AND (p_vehicle IS NULL OR p_vehicle = '' OR t.vehicle_number = p_vehicle)
        ) tr ON true
        LEFT JOIN LATERAL (
          SELECT coalesce(sum(e.amount), 0) AS expenses,
                 coalesce(jsonb_agg(
                   jsonb_build_object(
                     'vehicle_number', e.vehicle_number,
                     'category', e.category,
                     'amount', e.amount,
                     'description', e.description
                   ) ORDER BY e.id
                 ), '[]'::jsonb) AS expense_rows
          FROM expenses e
          WHERE e.category IS DISTINCT FROM 'Expense Advance'
            AND e.date = d.day
            AND e.expense_type = 'vehicle'
            AND (p_vehicle IS NULL OR p_vehicle = '' OR e.vehicle_number = p_vehicle)
            AND (p_entity IS NULL OR p_entity = '' OR e.paid_by = p_entity)
        ) ex ON true
        WHERE coalesce(tr.trip_count, 0) > 0 OR coalesce(ex.expenses, 0) > 0
      ) sub
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.monthly_trend_report(
  p_vehicle text DEFAULT NULL,
  p_entity text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'month', m.month,
      'revenue', coalesce(r.revenue, 0),
      'expenses', coalesce(x.expenses, 0)
    ) ORDER BY m.month)
    FROM (
      SELECT date_trunc('month', d)::date AS month
      FROM generate_series(
        date_trunc('month', CURRENT_DATE) - interval '11 months',
        date_trunc('month', CURRENT_DATE),
        interval '1 month'
      ) d
    ) m
    LEFT JOIN (
      SELECT date_trunc('month', t.date)::date AS month, coalesce(sum(t.total_revenue), 0) AS revenue
      FROM trips t
      WHERE t.date >= (date_trunc('month', CURRENT_DATE) - interval '11 months')::date
        AND (p_vehicle IS NULL OR p_vehicle = '' OR t.vehicle_number = p_vehicle)
      GROUP BY 1
    ) r ON r.month = m.month
    LEFT JOIN (
      SELECT date_trunc('month', e.date)::date AS month, coalesce(sum(e.amount), 0) AS expenses
      FROM expenses e
      WHERE e.category IS DISTINCT FROM 'Expense Advance'
        AND e.date >= (date_trunc('month', CURRENT_DATE) - interval '11 months')::date
        AND (p_vehicle IS NULL OR p_vehicle = '' OR e.vehicle_number = p_vehicle)
        AND (p_entity IS NULL OR p_entity = '' OR e.paid_by = p_entity)
      GROUP BY 1
    ) x ON x.month = m.month
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.monthly_trend_report TO anon;
GRANT EXECUTE ON FUNCTION public.monthly_trend_report TO authenticated;
GRANT EXECUTE ON FUNCTION public.monthly_pl_report TO anon;
GRANT EXECUTE ON FUNCTION public.monthly_pl_report TO authenticated;
GRANT EXECUTE ON FUNCTION public.vehicle_pl_report TO anon;
GRANT EXECUTE ON FUNCTION public.vehicle_pl_report TO authenticated;
GRANT EXECUTE ON FUNCTION public.daily_trip_report TO anon;
GRANT EXECUTE ON FUNCTION public.daily_trip_report TO authenticated;
