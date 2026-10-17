from pathlib import Path
p=Path('src/lib/patientOutputGuard.ts');s=p.read_text();marker='  const rules: Readonly<Record<string, RegExp>> = {';rules=r'''  const rules: Readonly<Record<string, RegExp>> = {
    "c5.constant": /\b(?:constant|all the time|won't go away|doesn't go away)\b/i,
    "c5.quality": /\bdeep\b.{0,25}\bthrobbing\b|\bthrobbing\b.{0,25}\bdeep\b/i,
    "c5.severity": /\b(?:nine|9)\s*(?:\/|out of)\s*(?:ten|10)\b|^\s*(?:nine|9)[.!]?\s*$|\bsevere\b/i,
    "c5.spontaneous": /\b(?:spontaneous|on its own|without (?:a )?(?:trigger|reason)|starts? (?:by )?itself)\b/i,
    "c5.nocturnal": /\b(?:wak\w*|sleep\w*|night)\b/i,
    "c5.cold": /\bcold\b.{0,45}\b(?:worse|hurt|pain)\b|\b(?:worse|hurt|pain)\b.{0,45}\bcold\b/i,
    "c5.lingering": /\b(?:linger\w*|doesn't (?:stop|go away)|does not (?:stop|go away)|keeps? hurting|persists?)\b/i,
    "c5.chewing": /\bchew\w*\b.{0,35}\b(?:uncomfortable|hurt|pain)\b|\b(?:uncomfortable|hurt|pain)\b.{0,35}\bchew\w*\b/i,
    "c5.biting": /\b(?:bit\w*|tap\w*)\b.{0,35}\b(?:hurt|pain|tender)\b|\b(?:hurt|pain|tender)\b.{0,35}\b(?:bit\w*|tap\w*)\b/i,''';assert marker in s;s=s.replace(marker,rules);p.write_text(s)
