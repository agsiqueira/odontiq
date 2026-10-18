import csv
import hashlib
import json
from pathlib import Path
from collections import Counter
from zipfile import ZipFile

root = Path(__file__).resolve().parent
load = lambda name: json.loads((root / name).read_text(encoding='utf-8-sig'))
inventory = load('inventory.json')
expected = {item['testId']: item for item in inventory['tests']}
assert len(expected) == 360
assert hashlib.sha256(Path(inventory['source']).read_bytes()).hexdigest() == inventory['sourceSha256']
all_rows = []
for cohort, count in [('primary', 340), ('pain-context', 20)]:
    rows = load(f'{cohort}-results.json')
    with (root / f'{cohort}-results.csv').open(encoding='utf-8-sig', newline='') as source:
        exported = list(csv.DictReader(source))
    assert len(rows) == len(exported) == count
    assert len({row['testId'] for row in rows}) == count
    assert {row['testId'] for row in rows} == {key for key, item in expected.items() if item['cohort'] == cohort}
    for row, cell in zip(rows, exported):
        assert row['testId'] == cell['testId']
        for key in ['question', 'finalResponse', 'apiFinalResponse', 'outcome', 'reason', 'encounterId', 'requestId']:
            assert cell[key] == row[key], (row['testId'], key)
        assert row['question'] == expected[row['testId']]['question']
        assert json.loads(cell['setupTurns']) == row['setupTurns']
        assert row['outcome'] in ['PASS', 'FAIL', 'REVIEW', 'ERROR', 'BLOCKED']
        assert row['reason'] and row['reason'] != 'Awaiting semantic adjudication of the actual final response.'
        assert row['finalResponse'] is not None and row['requestId'] and row['encounterId']
        assert row['finalResponse'] == row['apiFinalResponse']
        assert row['uiApiMatch'] and row['correlationMatched'] and row['httpStatus'] == 200
        assert row['provider'] == 'navigator'
        assert row['freshState']['boundEncounterId'] == row['encounterId']
        assert row['freshState']['studentCount'] == 0
        assert [turn['question'] for turn in row['setupTurns']] == expected[row['testId']]['setupQuestions']
        for turn in row['setupTurns']:
            assert turn['finalResponse'] == turn['apiFinalResponse'] and turn['uiApiMatch'] and turn['correlationMatched']
        assert Path(row['screenshot']).is_file() and Path(row['trace']).is_file()
    all_rows.extend(rows)

raw = load('all-raw-attempts.json')
scored = [row for row in raw if row['finalResponse'] is not None and row.get('requestId')]
assert len(scored) == 360
assert all(value == 1 for value in Counter(row['testId'] for row in scored).values())
assert len({row['requestId'] for row in all_rows}) == 360
assert len({row['encounterId'] for row in all_rows}) == 360
registry = load('research-exclusion.json')['encounters']
registered = {entry['encounterId'] for entry in registry}
assert len(registered) == len(registry)
assert {row['encounterId'] for row in raw if row['encounterId']} <= registered
assert len(registered) == 363
errors = [row for row in raw if row['outcome'] == 'ERROR']
assert len(errors) == 3
assert all(row['requestId'] is None and row['finalResponse'] is None for row in errors)
assert sum(row['outcome'] == 'BLOCKED' for row in raw) == 217
evidence_rows = [row for row in all_rows if row['outcome'] in ['FAIL', 'REVIEW']] + errors
for row in evidence_rows:
    assert Path(row['screenshot']).is_file()
    with ZipFile(row['trace']) as archive:
        assert archive.testzip() is None, row['testId']
        assert any(name.endswith('.trace') for name in archive.namelist()), row['testId']

before = load('application-before.json')
for item in before['files']:
    assert hashlib.sha256(Path(item['path']).read_bytes()).hexdigest() == item['sha256'], item['path']
for item in load('existing-phase-regressions.json'):
    assert hashlib.sha256(Path(item['path']).read_bytes()).hexdigest().upper() == item['sha256'], item['path']
result = {
    'primaryRows': 340, 'painContextRows': 20, 'exactWordingPreserved': True,
    'csvJsonRoundTripEqual': True, 'oneScoredResponsePerId': True,
    'allUiApiResponsesEqual': True, 'allProvidersNavigator': True,
    'syntheticEncounters': len(registry), 'retainedInitialErrors': 3,
    'retainedInitialStopRecords': 217, 'checkedFailureReviewErrorTraces': len(evidence_rows),
    'applicationFilesUnchanged': len(before['files']), 'existingRegressionMatchersUnchanged': True,
}
(root / 'export-verification.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps(result, indent=2))
