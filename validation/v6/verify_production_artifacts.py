import json, pathlib, zipfile
root=pathlib.Path('validation/v6')
data=json.loads((root/'production-smoke.json').read_text(encoding='utf-8'))
for r in data['results']:
    assert pathlib.Path(r['screenshot']).is_file()
    with zipfile.ZipFile(r['trace']) as z: assert z.testzip() is None, r['testId']
for name in ['speech-attempt-1.png','speech-production.png']:
    assert (root/name).is_file()
result={'productionScreenshots':len(data['results']),'productionTraceZipIntegrityChecked':len(data['results']),'speechScreenshots':2}
(root/'production-artifact-verification.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
print(json.dumps(result))
