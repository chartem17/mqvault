import csv, glob, sys, statistics, collections
from datetime import datetime, timedelta, timezone

src_dir, out_path = sys.argv[1], sys.argv[2]
rows, seen = [], set()
for f in sorted(glob.glob(f'{src_dir}/mqvault_cal_*.csv')):
    with open(f, encoding='utf-8') as fh:
        for x in csv.DictReader(fh):
            if x['value_id'] in seen:
                continue
            seen.add(x['value_id'])
            rows.append(x)

IMPACT = {'HIGH': 'high', 'MODERATE': 'medium', 'LOW': 'low', 'NONE': 'none'}
num = lambda s: float(s) if s not in ('', None) else None

out = []
for x in rows:
    off = int(x['server_utc_offset_now_min'])
    st = datetime.strptime(x['server_time'], '%Y-%m-%d %H:%M:%S')
    utc = (st - timedelta(minutes=off)).replace(tzinfo=timezone.utc)
    etype = x['event_type'].replace('CALENDAR_TYPE_', '').lower()
    impact = 'holiday' if etype == 'holiday' else IMPACT[x['importance'].split('_')[-1]]
    out.append({
        'source': 'mt5',
        'source_event_id': x['value_id'],
        'mt5_event_id': x['event_id'],
        'event_code': x['event_code'],
        'title': x['event_name'],
        'country': x['country_code'],
        'currency': x['currency'],
        'impact': impact,
        'event_type': etype,
        'sector': x['sector'].replace('CALENDAR_SECTOR_', '').lower(),
        'frequency': x['frequency'].replace('CALENDAR_FREQUENCY_', '').lower(),
        'all_day': str(x['time_mode'] == 'CALENDAR_TIMEMODE_DATE').lower(),
        'tentative': str(x['time_mode'] == 'CALENDAR_TIMEMODE_TENTATIVE').lower(),
        'scheduled_at': utc.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'period': '' if x['period'].startswith('1970') else x['period'],
        'revision': x['revision'],
        'actual': x['actual'], 'forecast': x['forecast'],
        'previous': x['previous'], 'revised_previous': x['revised_previous'],
        'unit': x['unit'].replace('CALENDAR_UNIT_', '').lower(),
        'multiplier': x['multiplier'].replace('CALENDAR_MULTIPLIER_', '').lower(),
        'digits': x['digits'],
        'forecast_suspect': 'false',
    })

# flag forecasts that are far from both previous and actual, relative to the event's typical release-to-release change
by_event = collections.defaultdict(list)
for r in out:
    by_event[r['mt5_event_id']].append(r)
flagged = 0
for evs in by_event.values():
    evs.sort(key=lambda r: r['scheduled_at'])
    acts = [num(r['actual']) for r in evs if num(r['actual']) is not None]
    diffs = [abs(b - a) for a, b in zip(acts, acts[1:])]
    if len(diffs) < 6:
        continue
    scale = statistics.median(diffs)
    if scale == 0:
        continue
    for r in evs:
        f, p, a = num(r['forecast']), num(r['previous']), num(r['actual'])
        refs = [v for v in (p, a) if v is not None]
        if f is None or not refs:
            continue
        if min(abs(f - v) for v in refs) > 8 * scale:
            r['forecast_suspect'] = 'true'
            flagged += 1

out.sort(key=lambda r: (r['scheduled_at'], r['currency'], r['title']))
with open(out_path, 'w', encoding='utf-8', newline='') as fh:
    w = csv.DictWriter(fh, fieldnames=list(out[0].keys()))
    w.writeheader()
    w.writerows(out)
print(f'rows={len(out)} flagged={flagged}')
