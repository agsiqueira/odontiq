import json,pathlib,zipfile,hashlib
root=pathlib.Path('validation/v8'); p=json.loads((root/'production-smoke.json').read_text(encoding='utf8')); rows=p['results']; traces=0
for r in rows:
 assert pathlib.Path(r['screenshot']).is_file(),r['testId']
 with zipfile.ZipFile(r['trace']) as z: assert z.testzip() is None,r['testId']
 assert r['finalResponse']==r['apiFinalResponse'] and r['uiApiMatch'] and r['correlationMatched'],r['testId']
 for t in r['setupTurns']: assert t['uiApiMatch'] and t['correlationMatched'] and t['finalResponse']==t['apiFinalResponse']
 traces+=1
out={'productionItems':len(rows),'screenshotExistenceChecked':len(rows),'traceZipIntegrityChecked':traces,'exactUiApiAndCorrelation':True}
(root/'production-artifact-verification.json').write_text(json.dumps(out,indent=2),encoding='utf8'); print(json.dumps(out))
