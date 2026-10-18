import csv, hashlib, json, pathlib, zipfile, sys

root = pathlib.Path('validation/shared-conversation-repair-2026-10-17')
load = lambda name: json.loads((root / name).read_text(encoding='utf-8-sig'))
inventory = load('run-inventory.json')['tests']
original = json.loads(pathlib.Path('validation/question-variations-2026-10-17/inventory.json').read_text(encoding='utf-8-sig'))['tests']
checks = []
def check(name, action):
    try:
        detail = action()
        checks.append({'check': name, 'passed': True, 'detail': detail})
    except Exception as exc:
        checks.append({'check': name, 'passed': False, 'error': str(exc)})
def require(condition, message):
    if not condition:
        raise AssertionError(message)

all_rows = []
for cohort, expected in [('primary', 340), ('pain-context', 20), ('holdout', 51)]:
    rows = load(cohort + '-results.json')
    all_rows.extend(rows)
    expected_rows = [r for r in inventory if r['cohort'] == cohort]
    def account(rows=rows, expected=expected, expected_rows=expected_rows):
        require(len(rows) == expected, f'{len(rows)} != {expected}')
        require(len({r['testId'] for r in rows}) == expected, 'duplicate IDs')
        require({r['testId'] for r in rows} == {r['testId'] for r in expected_rows}, 'ID mismatch')
        for r in rows:
            item = next(t for t in expected_rows if t['testId'] == r['testId'])
            require(r['question'] == item['question'], r['testId'] + ' changed wording')
            require(set(r['dimensions']) == {'factualCorrectness','completeness','relevance','leakage'}, 'missing dimension')
            require(all(d.get('status') and d.get('reason') for d in r['dimensions'].values()), 'missing dimension judgment')
        return expected
    check(cohort + ': exact unique inventory and four dimensions', account)
    def roundtrip(rows=rows, cohort=cohort):
        with (root / (cohort+'-results.csv')).open(encoding='utf-8-sig', newline='') as f:
            csv_rows = list(csv.DictReader(f))
        require(len(csv_rows) == len(rows), 'CSV row count')
        for c, r in zip(csv_rows, rows):
            for key in ['testId','question','finalResponse','outcome','reason','encounterId','requestId']:
                require(c[key] == str(r.get(key) or ''), r['testId']+' CSV mismatch: '+key)
            require(json.loads(c['setupTurns']) == r['setupTurns'], r['testId']+' setup mismatch')
            for dimension, judgment in r['dimensions'].items():
                require(c[dimension] == judgment['status'], 'dimension CSV mismatch')
        return len(rows)
    check(cohort + ': CSV/JSON round trip', roundtrip)

def original_wording():
    for item in original:
        r=next(r for r in all_rows if r['testId']==item['testId'])
        require(r['question']==item['question'], item['testId']+' original wording mismatch')
        require(r['setupQuestions']==item['setupQuestions'], item['testId']+' setup requirement mismatch')
    return len(original)
check('All original 340+20 strings and setup requirements unchanged', original_wording)

def correlation():
    executed=[r for r in all_rows if r.get('finalResponse') is not None]
    require(len({r['encounterId'] for r in executed})==len(executed), 'scored encounter reused')
    for r in executed:
        require(r['uiApiMatch'] and r['correlationMatched'] and r['httpStatus']==200, r['testId']+' correlation/API failure')
        require(r['finalResponse']==r['apiFinalResponse'], r['testId']+' UI/API text mismatch')
        require(r['provider']=='navigator', r['testId']+' provider mismatch')
        for turn in r['setupTurns']:
            require(turn['uiApiMatch'] and turn['correlationMatched'], r['testId']+' setup correlation failure')
    return {'validScoredResponses':len(executed),'uniqueScoredEncounters':len(executed)}
check('Real Navigator, fresh encounters, final UI/API equality and correlation', correlation)

def freeze():
    frozen=load('implementation-freeze.json')
    for name,digest in frozen['files'].items():
        require(hashlib.sha256(pathlib.Path(name).read_bytes()).hexdigest()==digest, 'Frozen file changed: '+name)
    holdout=load('holdout-inventory.json')
    require(holdout['createdAt']>frozen['frozenAt'], 'Holdout created before freeze')
    old={t['question'] for t in original}
    retired={t['question'] for t in load('pilot-v1/holdout-inventory.json')['tests']}
    require(len(holdout['tests'])==51 and len({t['question'] for t in holdout['tests']})==51, 'Holdout uniqueness')
    require(all(t['question'] not in old|retired for t in holdout['tests']), 'Holdout repeats original/retired wording')
    require(all(r['startedAt']>=frozen['frozenAt'] for r in all_rows if r.get('startedAt')), 'Final row predates freeze')
    return {'frozenFiles':len(frozen['files']),'holdoutQuestions':51}
check('Final freeze and untouched newly created holdout', freeze)

def evidence():
    count=0
    for r in all_rows:
        if r['outcome']=='PASS' or not r.get('finalResponse'):
            continue
        require(pathlib.Path(r['screenshot']).read_bytes().startswith(b'\x89PNG\r\n\x1a\n'), r['testId']+' screenshot missing/invalid')
        with zipfile.ZipFile(r['trace']) as z:
            require(z.testzip() is None, r['testId']+' corrupt trace')
        count+=1
    return {'nonPassResponseScreenshotsAndTraces':count}
check('Every semantic FAIL/REVIEW has screenshot and valid scoped trace', evidence)

def registry():
    data=load('research-exclusion.json')
    ids={r['encounterId'] for r in data['encounters']}
    require(len(ids)==data['uniqueEncounterCount']==len(data['encounters']), 'registry duplicates')
    attempts=load('all-recorded-attempts.json')
    require(all(r['encounterId'] in ids for r in attempts if r.get('encounterId')), 'raw encounter missing in registry')
    require(all(r['encounterId'] in ids for r in all_rows if r.get('encounterId')), 'final encounter missing in registry')
    return len(ids)
check('All recorded attempts represented in deduplicated exclusion registry', registry)

def raw_integrity():
    manifest=load('raw-artifact-manifest.json')
    for r in manifest:
        require(hashlib.sha256(pathlib.Path(r['path']).read_bytes()).hexdigest()==r['sha256'], 'Raw artifact changed: '+r['path'])
    return len(manifest)
check('Preserved raw artifact checksums, including unsuccessful runs', raw_integrity)

(root/'export-verification.json').write_text(json.dumps({'checks':checks,'allPassed':all(r['passed'] for r in checks)},indent=2),encoding='utf-8')
print(json.dumps(checks,indent=2))
sys.exit(0 if all(r['passed'] for r in checks) else 1)
