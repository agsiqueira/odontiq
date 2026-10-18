import csv, json, pathlib, zipfile
root = pathlib.Path('validation/v8')
rows = json.loads((root / 'results.json').read_text(encoding='utf-8'))
with (root / 'results.csv').open(encoding='utf-8-sig', newline='') as f:
    exported = list(csv.DictReader(f))
assert len(rows) == len(exported) == 546
traces = 0
for a, b in zip(rows, exported):
    for key in ['testId', 'question', 'finalResponse', 'outcome', 'encounterId', 'requestId']:
        assert (a.get(key) or '') == b[key], (a['testId'], key)
    assert a['setupTurns'] == json.loads(b['setupTurns'])
    for key, value in a['dimensions'].items():
        assert value['status'] == b[key]
    assert pathlib.Path(a['screenshot']).is_file()
    with zipfile.ZipFile(a['trace']) as z:
        assert z.testzip() is None, a['testId']
    traces += 1
all_attempts = json.loads((root / 'all-recorded-attempts.json').read_text(encoding='utf-8'))
for attempt in all_attempts:
    assert pathlib.Path(attempt['screenshot']).is_file()
    with zipfile.ZipFile(attempt['trace']) as z:
        assert z.testzip() is None, attempt['runId']
result = {'rows': len(rows), 'csvRoundTrip': True, 'screenshotsExist': len(rows), 'traceZipIntegrityChecked': traces, 'allAttemptScreenshotsAndTraceZipIntegrityChecked': len(all_attempts)}
(root / 'csv-verification.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result))
