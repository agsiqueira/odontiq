import csv, json, pathlib, zipfile
root = pathlib.Path('validation/shared-conversation-followup-2026-10-17')
checks = []
for cohort in ['primary', 'pain-context', 'former-holdout-regression', 'targeted-live', 'fresh-holdout']:
    rows = json.loads((root / f'{cohort}-results.json').read_text(encoding='utf-8'))
    with (root / f'{cohort}-results.csv').open(encoding='utf-8-sig', newline='') as f:
        csv_rows = list(csv.DictReader(f))
    assert len(rows) == len(csv_rows)
    for a, b in zip(rows, csv_rows):
        for key in ['testId', 'question', 'finalResponse', 'outcome', 'encounterId', 'requestId']:
            assert (a.get(key) or '') == b[key], (cohort, a['testId'], key)
        assert a['setupTurns'] == json.loads(b['setupTurns'])
        for key, value in a['dimensions'].items():
            assert value['status'] == b[key]
            assert value['reason'] == b[key+'Reason']
        if a['outcome'] != 'PASS':
            assert pathlib.Path(a['screenshot']).is_file()
            with zipfile.ZipFile(a['trace']) as z:
                assert z.testzip() is None
    checks.append({'cohort':cohort, 'rows':len(rows), 'csvRoundTrip':True, 'nonPassTraceIntegrity':True})
(root / 'csv-verification.json').write_text(json.dumps(checks, indent=2), encoding='utf-8')
print(json.dumps(checks, indent=2))
