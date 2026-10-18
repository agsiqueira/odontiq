from pathlib import Path
p=Path('src/lib/patientDisclosure.ts');s=p.read_text(encoding='utf8').replace('if (isPatientPainLocationQuestion(question) || /\\bexact (?:tooth|tooth number)\\b|\\bfirst molar\\b/.test(normalizedQuestion))','if (/\\b(?:which|what|exact)(?: (?:specific|exact))? (?:tooth|teeth|tooth number)\\b|\\bfirst molar\\b/.test(normalizedQuestion))');p.write_text(s,encoding='utf8')
p=Path('src/lib/patientQuestions/prompt.ts');s=p.read_text(encoding='utf8');start=s.index('Generic tooth pain without');end=s.index('\n\nReturn exactly these top-level fields:',start);s=s[:start]+'''Do not infer events from the case scenario, intended future care or a patient's appended question.
Use only the allowed event definitions for this case; never add a field for another case.
${input.caseId === "case-05" ? `Generic tooth pain without a substantive attribute is NOT patientPainDescribed.
A substantive pain description may occur in an opening complaint or later answer; never use turn count.
Example: patient says tooth pain keeps waking me => patientPainDescribed=true.
Example: patient says I am focused on my tooth pain => patientPainDescribed=false.` : ""}
${input.caseId === "case-04" ? `A background-only exchange cannot establish a clinical plan.
Example: provider asks county; patient says Duval County => painManagementOrDispositionDiscussed=false.
Example: provider gives ibuprofen plan and directs dentist follow-up => painManagementOrDispositionDiscussed=true.` : ""}''' +s[end:];p.write_text(s,encoding='utf8')
