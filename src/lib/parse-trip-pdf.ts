export type TripFormData = {
  date: string;
  vehicle_number: string;
  route_name: string;
  driver_name: string;
  weight_tons: number;
  distance_km: number;
  rate_per_ton: number;
  total_revenue: number;
  advance_paid: number;
  balance_due: number;
};

export type ParsedTripRow = TripFormData & {
  rowId: string;
  complete: boolean;
  missingFields: string[];
};

export type ParseContext = {
  vehicles: string[];
  drivers: string[];
  routes: {
    route_name: string;
    origin: string;
    destination: string;
    distance_km: number;
    standard_rate_per_ton: number;
  }[];
};

const REQUIRED_FIELDS: (keyof TripFormData)[] = [
  'date',
  'vehicle_number',
  'route_name',
  'driver_name',
  'weight_tons',
  'distance_km',
  'rate_per_ton',
  'total_revenue',
];

const FIELD_LABELS: Record<keyof TripFormData, string> = {
  date: 'Date',
  vehicle_number: 'Vehicle',
  route_name: 'Route',
  driver_name: 'Driver',
  weight_tons: 'Weight',
  distance_km: 'Distance',
  rate_per_ton: 'Rate/Ton',
  total_revenue: 'Revenue',
  advance_paid: 'Advance',
  balance_due: 'Balance',
};

const EMPTY_FORM: TripFormData = {
  date: '',
  vehicle_number: '',
  route_name: '',
  driver_name: '',
  weight_tons: 0,
  distance_km: 0,
  rate_per_ton: 0,
  total_revenue: 0,
  advance_paid: 0,
  balance_due: 0,
};

type PdfTextItem = { str: string; x: number; y: number };

type ColumnDef = { key: string; xMin: number; xMax: number };

type InvoiceRow = Record<string, string>;

const HEADER_ALIASES: [RegExp, string][] = [
  [/^sr\.?$/i, 'sr'],
  [/^lr\s*no\.?$/i, 'lr_no'],
  [/^lr\s*date$/i, 'lr_date'],
  [/^vehicle$/i, 'vehicle'],
  [/^from\s*station$/i, 'from_station'],
  [/^to\s*station$/i, 'to_station'],
  [/^qty\.?$/i, 'qty'],
  [/^rate$/i, 'rate'],
  [/^amount$/i, 'amount'],
  [/^ltr\.?$/i, 'ltr'],
  [/^diesel$/i, 'diesel'],
  [/^srtg\s*qty$/i, 'srtg_qty'],
];

function parseAmount(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[₹,\s]/g, '').replace(/[^\d.-]/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function toIsoDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return trimmed;

  const dmy = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, '0');
    const month = dmy[2].padStart(2, '0');
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return `${year}-${month}-${day}`;
  }

  return null;
}

function normalizeVehicle(raw: string, vehicles: string[]): string {
  const compact = raw.replace(/\s/g, '').toUpperCase();
  const match = vehicles.find((v) => v.replace(/\s/g, '').toUpperCase() === compact);
  return match || compact;
}

function normalizePlace(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/^momai\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchRouteFromStations(
  fromStation: string,
  toStation: string,
  routes: ParseContext['routes'],
): string {
  const from = normalizePlace(fromStation);
  const to = normalizePlace(toStation);

  for (const route of routes) {
    const origin = route.origin.toLowerCase();
    const dest = route.destination.toLowerCase();
    const fromHit = from.includes(origin) || origin.includes(from.split(' ')[0]);
    const toHit = to.includes(dest) || dest.includes(to.split(' ')[0]);
    if (fromHit && toHit) return route.route_name;
  }

  if (from.includes('kodol') && to.includes('padana')) return 'kodol-padana';
  if (from.includes('washrey') && to.includes('chirai')) return 'washrey-chirai';
  if (from.includes('khavda') && to.includes('kandla')) return 'khavda-kandla';

  return '';
}

function applyRouteDefaults(form: TripFormData, context: ParseContext) {
  if (!form.route_name) return;
  const route = context.routes.find((r) => r.route_name === form.route_name);
  if (!route) return;
  if (!form.distance_km) form.distance_km = Number(route.distance_km);
  if (!form.rate_per_ton) form.rate_per_ton = Number(route.standard_rate_per_ton);
}

function finalizeTrip(form: TripFormData): TripFormData {
  const result = { ...form };
  if (!result.total_revenue && result.weight_tons > 0 && result.rate_per_ton > 0) {
    result.total_revenue = Math.round(result.weight_tons * result.rate_per_ton * 100) / 100;
  }
  if (result.balance_due === 0 && result.total_revenue > 0) {
    result.balance_due = Math.max(result.total_revenue - (result.advance_paid || 0), 0);
  }
  return result;
}

function getMissingFields(form: TripFormData): string[] {
  return REQUIRED_FIELDS.filter((key) => {
    const val = form[key];
    if (typeof val === 'number') return val <= 0;
    return !val;
  }).map((key) => FIELD_LABELS[key]);
}

function headerKey(label: string, usedKeys: Set<string>): string | null {
  const normalized = label.trim().toLowerCase();
  for (const [pattern, key] of HEADER_ALIASES) {
    if (!pattern.test(normalized)) continue;
    if (key === 'rate' || key === 'amount') {
      const suffix = usedKeys.has(key) ? `_${[...usedKeys].filter((k) => k.startsWith(key)).length + 1}` : '';
      const finalKey = `${key}${suffix}`;
      usedKeys.add(finalKey);
      return finalKey;
    }
    if (!usedKeys.has(key)) {
      usedKeys.add(key);
      return key;
    }
  }
  return null;
}

function buildColumns(headerItems: PdfTextItem[]): ColumnDef[] {
  const usedKeys = new Set<string>();
  const headers = headerItems
    .map((item) => ({ x: item.x, key: headerKey(item.str, usedKeys) }))
    .filter((h): h is { x: number; key: string } => Boolean(h.key))
    .sort((a, b) => a.x - b.x);

  if (headers.length === 0) return [];

  return headers.map((header, index) => ({
    key: header.key,
    xMin: index === 0 ? 0 : (headers[index - 1].x + header.x) / 2,
    xMax: index === headers.length - 1 ? 9999 : (header.x + headers[index + 1].x) / 2,
  }));
}

function assignItemToColumn(item: PdfTextItem, columns: ColumnDef[]): string | null {
  for (const col of columns) {
    if (item.x >= col.xMin && item.x < col.xMax) return col.key;
  }
  return null;
}

function isHeaderRow(row: PdfTextItem[]): boolean {
  const text = row.map((i) => i.str.toLowerCase()).join(' ');
  return text.includes('lr date') && text.includes('vehicle') && text.includes('qty');
}

function isDataRow(row: InvoiceRow): boolean {
  if (!row.lr_date && !row.vehicle) return false;
  const lower = Object.values(row).join(' ').toLowerCase();
  if (lower.includes('total') || lower.includes('rupees') || lower.includes('bank details')) return false;
  if (row.sr && !/^\d+$/.test(row.sr.trim())) return false;
  return Boolean(row.lr_date || row.vehicle || row.qty);
}

function rowToInvoiceRecord(items: PdfTextItem[], columns: ColumnDef[]): InvoiceRow {
  const record: InvoiceRow = {};
  for (const item of items) {
    const key = assignItemToColumn(item, columns);
    if (!key) continue;
    record[key] = record[key] ? `${record[key]} ${item.str}`.trim() : item.str.trim();
  }
  return record;
}

function mapInvoiceToTrip(row: InvoiceRow, context: ParseContext): TripFormData {
  const form: TripFormData = { ...EMPTY_FORM };

  if (row.lr_date) form.date = toIsoDate(row.lr_date) || '';
  if (row.vehicle) form.vehicle_number = normalizeVehicle(row.vehicle, context.vehicles);

  const fromStation = row.from_station || '';
  const toStation = row.to_station || '';
  if (fromStation || toStation) {
    form.route_name = matchRouteFromStations(fromStation, toStation, context.routes);
  }

  const qty = parseAmount(row.qty);
  const rate = parseAmount(row.rate) ?? parseAmount(row.rate_2);
  const amount = parseAmount(row.amount) ?? parseAmount(row.amount_2);

  if (qty !== null) form.weight_tons = qty;
  if (rate !== null) form.rate_per_ton = rate;
  if (amount !== null) form.total_revenue = amount;

  applyRouteDefaults(form, context);
  return finalizeTrip(form);
}

function groupItemsByY(items: PdfTextItem[], tolerance = 4): PdfTextItem[][] {
  const buckets = new Map<number, PdfTextItem[]>();
  for (const item of items) {
    const yKey = Math.round(item.y / tolerance) * tolerance;
    if (!buckets.has(yKey)) buckets.set(yKey, []);
    buckets.get(yKey)!.push(item);
  }
  return Array.from(buckets.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([, rowItems]) => rowItems.sort((a, b) => a.x - b.x));
}

function mergeContinuationRows(rows: PdfTextItem[][], columns: ColumnDef[]): PdfTextItem[][] {
  const merged: PdfTextItem[][] = [];
  for (const row of rows) {
    const hasPrimaryData = row.some((item) => {
      const key = assignItemToColumn(item, columns);
      return key === 'lr_date' || key === 'vehicle' || key === 'qty';
    });

    if (!hasPrimaryData && merged.length > 0) {
      const prev = merged[merged.length - 1];
      const prevY = prev[0]?.y ?? 0;
      const rowY = row[0]?.y ?? 0;
      if (Math.abs(prevY - rowY) <= 18) {
        merged[merged.length - 1] = [...prev, ...row];
        continue;
      }
    }
    merged.push(row);
  }
  return merged;
}

export function parseInvoiceItems(items: PdfTextItem[], context: ParseContext): TripFormData[] {
  const rowGroups = groupItemsByY(items);
  const headerIndex = rowGroups.findIndex(isHeaderRow);
  if (headerIndex === -1) return [];

  const columns = buildColumns(rowGroups[headerIndex]);
  if (columns.length === 0) return [];

  const dataRowGroups = mergeContinuationRows(rowGroups.slice(headerIndex + 1), columns);
  const trips: TripFormData[] = [];

  for (const rowItems of dataRowGroups) {
    const invoiceRow = rowToInvoiceRecord(rowItems, columns);
    if (!isDataRow(invoiceRow)) continue;
    const trip = mapInvoiceToTrip(invoiceRow, context);
    if (trip.date || trip.vehicle_number || trip.weight_tons > 0) {
      trips.push(trip);
    }
  }

  return trips;
}

async function extractTextItemsFromPdf(file: File): Promise<PdfTextItem[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const items: PdfTextItem[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!('str' in item) || !(item as { str?: string }).str?.trim()) continue;
      const textItem = item as { str: string; transform: number[] };
      items.push({
        str: textItem.str,
        x: textItem.transform[4],
        y: textItem.transform[5],
      });
    }
  }

  return items;
}

export async function parseTripPdf(
  file: File,
  context: ParseContext,
): Promise<{ trips: ParsedTripRow[]; fileName: string; rowCount: number }> {
  const items = await extractTextItemsFromPdf(file);
  const parsed = parseInvoiceItems(items, context);

  const trips: ParsedTripRow[] = parsed.map((form, index) => {
    const missingFields = getMissingFields(form);
    return {
      ...form,
      rowId: `row-${index + 1}`,
      complete: missingFields.length === 0,
      missingFields,
    };
  });

  return { trips, fileName: file.name, rowCount: trips.length };
}

export function isTripRowComplete(form: TripFormData): boolean {
  return getMissingFields(form).length === 0;
}

export function getTripMissingFields(form: TripFormData): string[] {
  return getMissingFields(form);
}

export function recalcTripRow(form: TripFormData, context: ParseContext): TripFormData {
  const next = finalizeTrip({ ...form });
  applyRouteDefaults(next, context);
  return finalizeTrip(next);
}
