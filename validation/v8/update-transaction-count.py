from pathlib import Path
for name in ['freeze.mjs','verify.mjs']:
 p=Path('validation/v8')/name;s=p.read_text();s=s.replace('transactions.attempts.length!==8','transactions.attempts.length!==9').replace('tx.attempts.length===8','tx.attempts.length===9');p.write_text(s)
