#!/usr/bin/env python3
"""Pulisce la casa di un account di prova su Supabase: segna cancellate le spese copiate da Splitwise (id che iniziano con "sw-")
e toglie il membro segnaposto "m2" dalla sezione. Uso:  python3 tools/pulizia-casa-test.py Y59Y8X"""
import sys, json, urllib.request, datetime, pathlib
house = sys.argv[1] if len(sys.argv) > 1 else 'Y59Y8X'
K = (pathlib.Path(__file__).resolve().parent.parent / '.secrets' / 'anon-key.txt').read_text().strip()
B = 'https://odvbwrrpbkuqccoprrrc.supabase.co/rest/v1/pari_rows'
H = {'apikey': K, 'Authorization': 'Bearer ' + K, 'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal'}
def get(q): return json.load(urllib.request.urlopen(urllib.request.Request(B + q, headers=H)))
def post(rows): return urllib.request.urlopen(urllib.request.Request(B + '?on_conflict=house,id', data=json.dumps(rows).encode(), headers=H, method='POST')).status
now = datetime.datetime.now(datetime.timezone.utc).isoformat()
rows = []
for r in get(f'?house=eq.{house}&kind=eq.entry&select=id,data'):
    if not str(r['id']).startswith('sw-'): print('lascio', r['id']); continue
    d = r['data']; d['deleted'] = True; d['updatedAt'] = now; rows.append({'house': house, 'id': r['id'], 'kind': 'entry', 'data': d, 'updated_at': now, 'deleted': True})
for rid in ('section', 'members'):
    got = get(f'?house=eq.{house}&id=eq.{rid}&select=data')
    if not got: continue
    d = got[0]['data']
    if rid == 'section': d['members'] = {k: v for k, v in d.get('members', {}).items() if k != 'm2'}; d['people'] = [p for p in d.get('people', []) if p.get('id') != 'm2']; d['updatedAt'] = now
    else: d['members'] = [p for p in d.get('members', []) if p.get('id') != 'm2']
    rows.append({'house': house, 'id': rid, 'kind': rid, 'data': d, 'updated_at': now, 'deleted': False})
print(f'{len(rows)} righe da scrivere nella casa {house} ({sum(1 for r in rows if r["kind"] == "entry")} spese Splitwise da cancellare)')
print('fatto, stato', post(rows))
