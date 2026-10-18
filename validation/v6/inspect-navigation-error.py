import json, pathlib, zipfile, urllib.parse
root=pathlib.Path('C:/240 - odontIQ/odontiq-phase-t/artifacts/reports/odontiq-v6-2026-10-17/raw')
record=next(json.loads(p.read_text(encoding='utf-8')) for p in root.glob('C03-G08-Q14_*.json'))
events=[]
with zipfile.ZipFile(record['trace']) as z:
 for name in z.namelist():
  if not name.endswith('.network'): continue
  for line in z.read(name).decode().splitlines():
   row=json.loads(line);snap=row.get('snapshot',{});req=snap.get('request',{});res=snap.get('response',{});url=urllib.parse.urlsplit(req.get('url',''))
   if url.hostname=='localhost':events.append({'method':req.get('method'),'path':url.path,'status':res.get('status'),'failure':snap.get('_failureText')})
result={'testId':record['testId'],'runId':record['runId'],'scoredSubmitted':bool(record['apiAttempts']),'trace':record['trace'],'localNetworkEvents':events,'visibleUi':record.get('failureUiText'),'diagnosis':'Pre-submission encounter-readiness/navigation failure. Network status evidence below distinguishes application/transport failure from semantic response failure; no precise remote cause inferred without supporting event.'}
pathlib.Path('validation/v6/navigation-error-diagnosis.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result,indent=2))
