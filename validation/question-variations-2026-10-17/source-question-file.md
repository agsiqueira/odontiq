# OdontIQ patient-background question variations

340 questions: 20 variations for each of 17 question groups across five cases.

## Test instructions

- Use the existing Phase T project and real Navigator conversation flow. Do not implement application changes during the initial test run.
- Every numbered question is a separate test item. Use fresh dedicated encounters or controlled branches of a common setup. Do not ask all 20 near-identical questions consecutively in one encounter.
- Supply the stated context for pronouns and follow-up wording. Context setup is not one of the 340 scored questions. Do not put the expected answer in the student question.
- Evaluate the meaning of the final API/UI response, not exact wording or a keyword alone. A true fact that does not answer the question is a failure.
- Accept contextual short answers such as “No, I don’t” when their meaning is unambiguous. For combined questions, require answers to all requested parts.
- Preserve capitalization, grammar errors, and wording exactly. Grammar errors are intentional test inputs.
- For Case 01 travel, also repeat selected inputs after a pain discussion. Pain/behavior additions must not contradict explicit travel capability.
- Do not infer exact addresses, Medicaid dates, daughter age, financial eligibility, dollar limits, or transportation details that are absent from case facts.
- Capture test ID, case, exact question, setup context, actual final response, outcome/reason, request ID and encounter ID. Register synthetic records for research exclusion.
- These are separate residence and transportation concepts: where someone lives, whether residency is established, whether transportation is reliable, and whether the patient is willing to travel.
- A question mentioning an insurance plan does not assert that the patient has it. Preserve the correct parent-versus-daughter distinction.

## Case facts

| Case | Background |
|---|---|
| 01 | Uninsured adult; Alachua County; reliable transportation; can travel outside the county for free or low-cost care. |
| 02 | Uninsured; lost Medicaid within the past year; lives in Collier County but residency not established; unreliable transportation out of town. |
| 03 | Uninsured Hillsborough County resident; has a dentist; young daughter has Medicaid; prefers a clinic for both. |
| 04 | Uninsured Duval County resident; open to sliding-scale dental fees. |
| 05 | Uninsured Marion County resident; unable to pay anything; prefers free care. |

## Case 01 — Dental insurance

Expected meaning: Patient has no dental insurance.

Context: None required.

| Test ID | Question |
|---|---|
| C01-G01-Q01 | Do you have dental insurance? |
| C01-G01-Q02 | Is your dental care covered by insurance? |
| C01-G01-Q03 | Do you have any insurance that pays for dental treatment? |
| C01-G01-Q04 | Are you insured for dental visits? |
| C01-G01-Q05 | Would insurance cover a visit to a dentist? |
| C01-G01-Q06 | What dental insurance do you have, if any? |
| C01-G01-Q07 | Do you have coverage for seeing a dentist? |
| C01-G01-Q08 | Are you paying for dental care without insurance? |
| C01-G01-Q09 | Do you currently have a dental plan? |
| C01-G01-Q10 | Is there an insurance plan we could use for your dental follow-up? |
| C01-G01-Q11 | Do you have any dental coverage right now? |
| C01-G01-Q12 | Can I ask whether you have dental insurance? |
| C01-G01-Q13 | Before we discuss a referral, do you have dental coverage? |
| C01-G01-Q14 | Are you uninsured for dental care? |
| C01-G01-Q15 | You have dental insurance? |
| C01-G01-Q16 | Do you has dental insurance? |
| C01-G01-Q17 | Are you have insurance for your teeth? |
| C01-G01-Q18 | Any dental insurance at the moment? |
| C01-G01-Q19 | Does your insurance cover teeth, or do you have none? |
| C01-G01-Q20 | Do you got a dental insurance plan? |

## Case 01 — Residence

Expected meaning: Patient lives in Alachua County. Do not answer with tooth/pain location.

Context: None required.

| Test ID | Question |
|---|---|
| C01-G02-Q01 | Where do you live? |
| C01-G02-Q02 | What county do you live in? |
| C01-G02-Q03 | Which county is your home in? |
| C01-G02-Q04 | Where are you living at the moment? |
| C01-G02-Q05 | What county should I use when looking for a dental clinic near you? |
| C01-G02-Q06 | Are you a resident of Alachua County? |
| C01-G02-Q07 | Do you live in Alachua County? |
| C01-G02-Q08 | Which Florida county do you live in? |
| C01-G02-Q09 | Where is your home located, county-wise? |
| C01-G02-Q10 | Can you tell me the county where you live? |
| C01-G02-Q11 | What county are you currently living in? |
| C01-G02-Q12 | For your dental referral, which county do you call home? |
| C01-G02-Q13 | Is Alachua the county you live in? |
| C01-G02-Q14 | Where do you normally live? |
| C01-G02-Q15 | What county you live in? |
| C01-G02-Q16 | Where you living now? |
| C01-G02-Q17 | Which county do you lives in? |
| C01-G02-Q18 | You live in what county? |
| C01-G02-Q19 | Your home is in which county? |
| C01-G02-Q20 | Where does you live? |

## Case 01 — Transportation and travel

Expected meaning: Patient has reliable transportation and can/will travel outside Alachua County if necessary for free or low-cost dental care. Answer the requested ability/willingness directly.

Context: None required.

| Test ID | Question |
|---|---|
| C01-G03-Q01 | Can you travel for affordable care? |
| C01-G03-Q02 | Would you travel out of Alachua County? |
| C01-G03-Q03 | Can you get to a dental clinic in another county? |
| C01-G03-Q04 | Would you travel farther if the dental treatment were free? |
| C01-G03-Q05 | Do you have reliable transportation to get affordable dental care? |
| C01-G03-Q06 | Could you travel outside your county for a low-cost dental appointment? |
| C01-G03-Q07 | Would you be willing to leave Alachua County for dental treatment? |
| C01-G03-Q08 | If the closest affordable clinic is outside the county, could you go? |
| C01-G03-Q09 | Do you have a dependable way to reach a dental clinic out of county? |
| C01-G03-Q10 | Can you arrange reliable transportation for a low-cost dental visit? |
| C01-G03-Q11 | Would a free dental clinic in a neighboring county work for you? |
| C01-G03-Q12 | Is traveling outside Alachua County an option for affordable dental care? |
| C01-G03-Q13 | Could you get yourself to a dental appointment outside your county? |
| C01-G03-Q14 | Are you able and willing to travel for cheaper dental treatment? |
| C01-G03-Q15 | can you travel for Affordable Care |
| C01-G03-Q16 | You can travel outside the county for low cost care? |
| C01-G03-Q17 | Would you goes to another county if the dentist is free? |
| C01-G03-Q18 | Can you get transport for a cheaper dental clinic? |
| C01-G03-Q19 | If dental care cost less out of town, you can go? |
| C01-G03-Q20 | Do you has reliable transportation for dental care? |

## Case 02 — Insurance

Expected meaning: Patient is currently uninsured. Do not imply current Medicaid coverage.

Context: None required.

| Test ID | Question |
|---|---|
| C02-G04-Q01 | Do you have insurance? |
| C02-G04-Q02 | Are you currently insured? |
| C02-G04-Q03 | Do you have health or dental insurance right now? |
| C02-G04-Q04 | Is any insurance covering your care at the moment? |
| C02-G04-Q05 | Do you currently have Medicaid or another insurance plan? |
| C02-G04-Q06 | What insurance do you have, if any? |
| C02-G04-Q07 | Are you without insurance at present? |
| C02-G04-Q08 | Do you have any coverage for a dental appointment? |
| C02-G04-Q09 | Can we use an insurance plan for your dental referral? |
| C02-G04-Q10 | Are you still covered by Medicaid? |
| C02-G04-Q11 | Do you have an active insurance policy? |
| C02-G04-Q12 | Does any insurance help pay for your treatment now? |
| C02-G04-Q13 | Have you got insurance at this time? |
| C02-G04-Q14 | Before I suggest a clinic, are you insured? |
| C02-G04-Q15 | You have any insurance now? |
| C02-G04-Q16 | Do you has insurance? |
| C02-G04-Q17 | Are you have Medicaid right now? |
| C02-G04-Q18 | Any insurance coverage currently? |
| C02-G04-Q19 | Your Medicaid is still active or you have no insurance? |
| C02-G04-Q20 | Do you got insurance for your care? |

## Case 02 — Medicaid loss timing

Expected meaning: Patient lost Medicaid within the past year. An exact date/month is unspecified and must not be invented.

Context: For “that coverage” or “Medicaid stop” follow-ups, first establish that the patient lost Medicaid. Accept a relative answer tied to that context.

| Test ID | Question |
|---|---|
| C02-G05-Q01 | When did you lose Medicaid? |
| C02-G05-Q02 | How long ago did your Medicaid coverage end? |
| C02-G05-Q03 | When did your Medicaid stop? |
| C02-G05-Q04 | Was your Medicaid discontinued within the last year? |
| C02-G05-Q05 | About how long have you been without Medicaid? |
| C02-G05-Q06 | How recently did you lose your Medicaid coverage? |
| C02-G05-Q07 | Did your Medicaid end sometime in the past twelve months? |
| C02-G05-Q08 | Can you tell me roughly when your Medicaid ended? |
| C02-G05-Q09 | Has it been less than a year since your Medicaid stopped? |
| C02-G05-Q10 | When were you last covered by Medicaid? |
| C02-G05-Q11 | How long has it been since you lost that coverage? |
| C02-G05-Q12 | Did you lose Medicaid recently or more than a year ago? |
| C02-G05-Q13 | Approximately when did you stop having Medicaid? |
| C02-G05-Q14 | Was the loss of your Medicaid in the past year? |
| C02-G05-Q15 | When you lost Medicaid? |
| C02-G05-Q16 | How long since Medicaid stop? |
| C02-G05-Q17 | You lose your Medicaid in the last year? |
| C02-G05-Q18 | When did your Medicaid coverage stopped? |
| C02-G05-Q19 | How recent was losing your Medicaid? |
| C02-G05-Q20 | Your Medicaid ended when? |

## Case 02 — Residency status

Expected meaning: Patient lives in Collier County but has not established residency there. Do not invent documentation or legal/immigration status.

Context: “There” refers to Collier County. Establish this location before testing that follow-up. Questions do not require proof-of-residency details.

| Test ID | Question |
|---|---|
| C02-G06-Q01 | Have you established residency? |
| C02-G06-Q02 | Have you established residency in Collier County? |
| C02-G06-Q03 | Are you living in Collier County, and have you established residency there? |
| C02-G06-Q04 | Is your residency in Collier County established yet? |
| C02-G06-Q05 | Have you become an established resident of Collier County? |
| C02-G06-Q06 | Have you established local residency where you live? |
| C02-G06-Q07 | For clinics with county residency requirements, have you established residency in Collier? |
| C02-G06-Q08 | Is Collier County where you live, even though residency is not established yet? |
| C02-G06-Q09 | Have you completed establishing residency in your county? |
| C02-G06-Q10 | Would you describe your Collier County residency as established yet? |
| C02-G06-Q11 | Are you already established as a resident of Collier County? |
| C02-G06-Q12 | Have you established county residency since moving to Collier? |
| C02-G06-Q13 | Where are you living, and is your residency established? |
| C02-G06-Q14 | Have you established residency in the county you currently live in? |
| C02-G06-Q15 | You established residency in Collier yet? |
| C02-G06-Q16 | Have you establish residency there? |
| C02-G06-Q17 | Your Collier residency is established already? |
| C02-G06-Q18 | Do you has established residency in your county? |
| C02-G06-Q19 | You live in Collier but residency not established yet? |
| C02-G06-Q20 | Have your residency been established? |

## Case 02 — Out-of-town transportation

Expected meaning: Patient has unreliable transportation out of town. Do not infer that travel is absolutely impossible or that reliable local transport exists.

Context: None required.

| Test ID | Question |
|---|---|
| C02-G07-Q01 | Can you travel out of town? |
| C02-G07-Q02 | Do you have reliable transportation to a dental clinic out of town? |
| C02-G07-Q03 | Could you reliably get to an appointment in another town? |
| C02-G07-Q04 | Would transportation outside town be dependable for you? |
| C02-G07-Q05 | Can you count on a ride to an out-of-town dental clinic? |
| C02-G07-Q06 | How reliable is your transportation if the dentist is out of town? |
| C02-G07-Q07 | Could getting to a clinic outside town be a problem? |
| C02-G07-Q08 | Is out-of-town travel practical with your current transportation? |
| C02-G07-Q09 | Do you have a dependable way to travel out of town for care? |
| C02-G07-Q10 | If I refer you outside town, can you reliably get there? |
| C02-G07-Q11 | Would you have trouble arranging transportation out of town? |
| C02-G07-Q12 | Are you able to depend on transportation for a dental visit in another town? |
| C02-G07-Q13 | Can you reliably attend an out-of-town dental appointment? |
| C02-G07-Q14 | What transportation difficulties would you have going out of town? |
| C02-G07-Q15 | You can travel out of town? |
| C02-G07-Q16 | Do you has reliable transport outside town? |
| C02-G07-Q17 | Can you gets to a dentist in another town? |
| C02-G07-Q18 | Is your transport out of town reliable or no? |
| C02-G07-Q19 | If the clinic out of town, can you get there reliably? |
| C02-G07-Q20 | Would getting a ride out of town be hard for you? |

## Case 03 — Residence

Expected meaning: Patient lives in Hillsborough County. Do not answer with a clinical location.

Context: None required.

| Test ID | Question |
|---|---|
| C03-G08-Q01 | Where do you live? |
| C03-G08-Q02 | Which county do you live in? |
| C03-G08-Q03 | What county are you a resident of? |
| C03-G08-Q04 | Are you living in Hillsborough County? |
| C03-G08-Q05 | Do you reside in Hillsborough County? |
| C03-G08-Q06 | Which Florida county is your home in? |
| C03-G08-Q07 | Where are you currently living? |
| C03-G08-Q08 | What county should I search for your dental referral? |
| C03-G08-Q09 | Can you tell me your home county? |
| C03-G08-Q10 | Is your home in Hillsborough County? |
| C03-G08-Q11 | Where do you live, in terms of county? |
| C03-G08-Q12 | Which county do you normally live in? |
| C03-G08-Q13 | Are you a Hillsborough County resident? |
| C03-G08-Q14 | For finding a local clinic, what county do you live in? |
| C03-G08-Q15 | Where you live? |
| C03-G08-Q16 | What county you living in? |
| C03-G08-Q17 | You lives in Hillsborough County? |
| C03-G08-Q18 | Which county does you live in? |
| C03-G08-Q19 | Your home county is where? |
| C03-G08-Q20 | Where are you live now? |

## Case 03 — Insurance and existing dentist

Expected meaning: Patient is uninsured and has an existing dentist. These are combined questions: both insurance and dentist status must be answered. Do not substitute an appointment statement for insurance status.

Context: None required.

| Test ID | Question |
|---|---|
| C03-G09-Q01 | Do you have insurance or a dentist? |
| C03-G09-Q02 | Do you have dental insurance, and do you already have a dentist? |
| C03-G09-Q03 | Are you insured, and is there a dentist you normally see? |
| C03-G09-Q04 | Can you tell me about your insurance and your usual dentist? |
| C03-G09-Q05 | Do you have coverage for dental care and an established dentist? |
| C03-G09-Q06 | Are you uninsured, and do you currently have your own dentist? |
| C03-G09-Q07 | What insurance do you have, if any, and do you see a regular dentist? |
| C03-G09-Q08 | Is your dental care insured, and have you established care with a dentist? |
| C03-G09-Q09 | Do you have an insurance plan or a dentist you already go to? |
| C03-G09-Q10 | Before we discuss referrals, do you have insurance and a regular dentist? |
| C03-G09-Q11 | Are you covered for dental visits, and do you already see someone for dental care? |
| C03-G09-Q12 | Do you currently have insurance? Also, do you have your own dentist? |
| C03-G09-Q13 | Do you have a dentist even if you don't have insurance? |
| C03-G09-Q14 | Who handles your dental care, and do you have insurance for it? |
| C03-G09-Q15 | You have insurance and your own dentist? |
| C03-G09-Q16 | Do you has insurance or a regular dentist? |
| C03-G09-Q17 | Are you insured and do you got a dentist already? |
| C03-G09-Q18 | Any insurance, and any dentist you normally see? |
| C03-G09-Q19 | You have a dentist but no insurance, is that right? |
| C03-G09-Q20 | Do you have dental coverage and does you have a dentist? |

## Case 03 — Daughter coverage

Expected meaning: Patient has a young daughter covered by Medicaid. Distinguish daughter coverage from the uninsured parent. Do not invent age or plan details.

Context: For “she” or “your child,” first establish that the discussion concerns the young daughter. No exact age is defined.

| Test ID | Question |
|---|---|
| C03-G10-Q01 | Tell me about your daughter's coverage. |
| C03-G10-Q02 | Does your daughter have insurance? |
| C03-G10-Q03 | Is your daughter covered by Medicaid? |
| C03-G10-Q04 | What insurance does your daughter have? |
| C03-G10-Q05 | How is your daughter's care covered? |
| C03-G10-Q06 | Does your young daughter have Medicaid coverage? |
| C03-G10-Q07 | Is your daughter insured even though you are not? |
| C03-G10-Q08 | What coverage would your daughter use at a dental clinic? |
| C03-G10-Q09 | Can you tell me whether your daughter has Medicaid? |
| C03-G10-Q10 | Who is covered by Medicaid, you or your daughter? |
| C03-G10-Q11 | Do you have a young daughter, and what insurance does she have? |
| C03-G10-Q12 | Is Medicaid the coverage your daughter has? |
| C03-G10-Q13 | Before finding a clinic for both of you, what insurance does your daughter have? |
| C03-G10-Q14 | Does your child have insurance through Medicaid? |
| C03-G10-Q15 | Your daughter has what insurance? |
| C03-G10-Q16 | Do your daughter have Medicaid? |
| C03-G10-Q17 | Is she on Medicaid? |
| C03-G10-Q18 | What insurance your daughter got? |
| C03-G10-Q19 | You daughter is insured or not? |
| C03-G10-Q20 | Does your daughters coverage come from Medicaid? |

## Case 03 — Shared clinic preference

Expected meaning: Patient prefers a clinic where both the uninsured parent and Medicaid-covered daughter can receive care. Preference is not an absolute refusal of separate clinics.

Context: First establish the daughter and the search for dental care for both. “Same clinic,” “both,” and “you two” refer to parent and daughter.

| Test ID | Question |
|---|---|
| C03-G11-Q01 | Would you prefer the same clinic? |
| C03-G11-Q02 | Would you like you and your daughter to receive dental care at the same clinic? |
| C03-G11-Q03 | Would a dental clinic that treats both of you be preferable? |
| C03-G11-Q04 | Do you want a clinic that can see you and your daughter? |
| C03-G11-Q05 | Would you rather use one dental clinic for both of you? |
| C03-G11-Q06 | Is keeping your dental care and your daughter's care at one clinic important to you? |
| C03-G11-Q07 | Would you prefer to go where your daughter can also be treated? |
| C03-G11-Q08 | Would a clinic accepting your daughter on Medicaid and seeing you uninsured suit your preference? |
| C03-G11-Q09 | Are you hoping to find a dental clinic you can both attend? |
| C03-G11-Q10 | Would you favor a shared clinic over separate clinics for you and your daughter? |
| C03-G11-Q11 | Do you have a preference about whether you both use the same dental clinic? |
| C03-G11-Q12 | Would it be better for you if one clinic could provide care for both of you? |
| C03-G11-Q13 | Would you like me to look for somewhere that can treat you both? |
| C03-G11-Q14 | Is seeing the same clinic as your daughter what you would prefer? |
| C03-G11-Q15 | You want same clinic for you and your daughter? |
| C03-G11-Q16 | Would you prefers one clinic for both? |
| C03-G11-Q17 | You and your daughter rather go same place? |
| C03-G11-Q18 | Do you wants a dentist clinic that sees both of you? |
| C03-G11-Q19 | Same dental clinic for you two would be better? |
| C03-G11-Q20 | Would going to different clinics be less preferable than going together? |

## Case 04 — Residence

Expected meaning: Patient lives in Duval County. Do not substitute pain/tooth location.

Context: None required.

| Test ID | Question |
|---|---|
| C04-G12-Q01 | Where do you live? |
| C04-G12-Q02 | What county do you live in? |
| C04-G12-Q03 | Which county are you living in now? |
| C04-G12-Q04 | Do you live in Duval County? |
| C04-G12-Q05 | Are you a resident of Duval County? |
| C04-G12-Q06 | Which Florida county do you call home? |
| C04-G12-Q07 | What is your county of residence? |
| C04-G12-Q08 | Where are you currently living? |
| C04-G12-Q09 | Can you tell me which county your home is in? |
| C04-G12-Q10 | Is Duval County where you live? |
| C04-G12-Q11 | What county should I use to find nearby dental care? |
| C04-G12-Q12 | For your referral, where do you live at the county level? |
| C04-G12-Q13 | Do you currently reside in Duval County? |
| C04-G12-Q14 | Where is home for you, which county? |
| C04-G12-Q15 | Where you live at? |
| C04-G12-Q16 | What county you live? |
| C04-G12-Q17 | You living in Duval County? |
| C04-G12-Q18 | Which county does you lives in? |
| C04-G12-Q19 | Your home is Duval County or somewhere else? |
| C04-G12-Q20 | Where are you living these days? |

## Case 04 — Insurance

Expected meaning: Patient is uninsured. Do not replace insurance status with payment willingness.

Context: None required.

| Test ID | Question |
|---|---|
| C04-G13-Q01 | Do you have insurance? |
| C04-G13-Q02 | Do you currently have dental insurance? |
| C04-G13-Q03 | Are you insured for dental care? |
| C04-G13-Q04 | Do you have any active insurance coverage? |
| C04-G13-Q05 | Would an insurance plan pay for your dental visit? |
| C04-G13-Q06 | Are you currently without insurance? |
| C04-G13-Q07 | Can you tell me whether you have insurance? |
| C04-G13-Q08 | What insurance do you have, if any? |
| C04-G13-Q09 | Do you have coverage to help pay for dental treatment? |
| C04-G13-Q10 | Is your dental care covered by a plan? |
| C04-G13-Q11 | Do you have insurance we should consider when finding a clinic? |
| C04-G13-Q12 | Have you got dental coverage at the moment? |
| C04-G13-Q13 | Are you uninsured right now? |
| C04-G13-Q14 | Before discussing fees, do you have insurance? |
| C04-G13-Q15 | You got any insurance? |
| C04-G13-Q16 | Do you has dental coverage? |
| C04-G13-Q17 | Are you have an insurance plan? |
| C04-G13-Q18 | Any insurance for seeing a dentist? |
| C04-G13-Q19 | Your dental treatment is insured or no? |
| C04-G13-Q20 | Do you have insurance currently or you uninsured? |

## Case 04 — Sliding-scale payment

Expected meaning: Patient is open to paying for dental care on a sliding-scale fee. Do not answer with pain severity or invent income, eligibility, or a dollar limit.

Context: None required.

| Test ID | Question |
|---|---|
| C04-G14-Q01 | Could you pay a sliding-scale fee? |
| C04-G14-Q02 | Would you be willing to pay for dental care on a sliding scale? |
| C04-G14-Q03 | Are you open to a clinic that charges based on your income? |
| C04-G14-Q04 | Would a sliding-scale dental clinic be an option for you? |
| C04-G14-Q05 | Could you consider dental care with an income-based fee? |
| C04-G14-Q06 | Would you accept paying a sliding-scale charge for treatment? |
| C04-G14-Q07 | Is paying on a sliding scale something you would consider? |
| C04-G14-Q08 | Are you comfortable considering a clinic with income-adjusted dental fees? |
| C04-G14-Q09 | Would a fee adjusted to income work as an option for your dental care? |
| C04-G14-Q10 | Can I look for dental clinics that offer sliding-scale payments? |
| C04-G14-Q11 | Would you be open to paying an income-based amount for a dental visit? |
| C04-G14-Q12 | Do you want me to include sliding-scale clinics in your referral options? |
| C04-G14-Q13 | Would you consider a dental clinic where the fee varies with income? |
| C04-G14-Q14 | Are sliding-scale dental fees acceptable to you? |
| C04-G14-Q15 | Could you pays a sliding scale fee? |
| C04-G14-Q16 | You willing to pay sliding-scale for dental care? |
| C04-G14-Q17 | Would you be okay with a income based fee? |
| C04-G14-Q18 | Can you pay on sliding scale for the dentist? |
| C04-G14-Q19 | Is sliding scale payment something you open to? |
| C04-G14-Q20 | Would a dentist with fees based on income be okay? |

## Case 05 — Residence

Expected meaning: Patient lives in Marion County. Do not substitute pain/tooth location.

Context: None required.

| Test ID | Question |
|---|---|
| C05-G15-Q01 | Where do you live? |
| C05-G15-Q02 | Which county do you live in? |
| C05-G15-Q03 | What county are you a resident of? |
| C05-G15-Q04 | Do you live in Marion County? |
| C05-G15-Q05 | Are you currently living in Marion County? |
| C05-G15-Q06 | Which Florida county is your home in? |
| C05-G15-Q07 | Can you tell me your county of residence? |
| C05-G15-Q08 | Where are you living at present? |
| C05-G15-Q09 | Is Marion the county where you live? |
| C05-G15-Q10 | What county should I search for a dental clinic near your home? |
| C05-G15-Q11 | For a local referral, which county do you live in? |
| C05-G15-Q12 | Are you a Marion County resident? |
| C05-G15-Q13 | Where do you normally live, which county? |
| C05-G15-Q14 | What county is home for you? |
| C05-G15-Q15 | Where you live now? |
| C05-G15-Q16 | What county does you live in? |
| C05-G15-Q17 | You lives in Marion County? |
| C05-G15-Q18 | Which county you living in? |
| C05-G15-Q19 | Your home in Marion County, right? |
| C05-G15-Q20 | Where are you live? |

## Case 05 — Insurance

Expected meaning: Patient is uninsured. Do not confuse no insurance with daughter/other case coverage.

Context: None required.

| Test ID | Question |
|---|---|
| C05-G16-Q01 | Do you have insurance? |
| C05-G16-Q02 | Are you currently insured? |
| C05-G16-Q03 | Do you have dental insurance? |
| C05-G16-Q04 | Is any insurance covering your dental care? |
| C05-G16-Q05 | Do you have an insurance plan for treatment? |
| C05-G16-Q06 | What insurance do you have, if any? |
| C05-G16-Q07 | Are you uninsured at the moment? |
| C05-G16-Q08 | Do you have coverage for seeing a dentist? |
| C05-G16-Q09 | Can we use insurance for your dental referral? |
| C05-G16-Q10 | Would insurance help pay for a dental appointment? |
| C05-G16-Q11 | Have you got any dental coverage right now? |
| C05-G16-Q12 | Are you without insurance for care? |
| C05-G16-Q13 | Is there an active insurance policy we should know about? |
| C05-G16-Q14 | Before looking at clinics, do you have insurance coverage? |
| C05-G16-Q15 | You have insurance or no? |
| C05-G16-Q16 | Do you has any insurance? |
| C05-G16-Q17 | Are you have dental insurance? |
| C05-G16-Q18 | Any coverage for dental treatment? |
| C05-G16-Q19 | Do you got insurance at present? |
| C05-G16-Q20 | Your dental care covered by insurance? |

## Case 05 — Ability to pay and free care

Expected meaning: Patient cannot pay anything for dental care and prefers a free clinic. Do not agree to a small fee, invent a budget, or substitute willingness for ability.

Context: None required.

| Test ID | Question |
|---|---|
| C05-G17-Q01 | Could you afford a small fee? |
| C05-G17-Q02 | Would you be able to pay even a little for dental care? |
| C05-G17-Q03 | Could you manage a reduced dental fee? |
| C05-G17-Q04 | Is a low-cost clinic affordable for you, or do you need free care? |
| C05-G17-Q05 | Would even a small charge be too much for you? |
| C05-G17-Q06 | Can you pay anything toward a dental appointment? |
| C05-G17-Q07 | Would you need a clinic that provides dental care at no cost? |
| C05-G17-Q08 | Could you contribute a small amount toward treatment? |
| C05-G17-Q09 | Is paying a fee possible for you at all? |
| C05-G17-Q10 | Should I focus on free dental clinics because you cannot pay? |
| C05-G17-Q11 | Would a modest sliding-scale charge be affordable for you? |
| C05-G17-Q12 | Would you prefer a free clinic, and are you able to pay anything? |
| C05-G17-Q13 | Could you afford a small copayment for the dental visit? |
| C05-G17-Q14 | If a clinic charges only a little, would you be able to pay? |
| C05-G17-Q15 | You can afford small fee? |
| C05-G17-Q16 | Could you pays anything for the dentist? |
| C05-G17-Q17 | Even a little money for care is possible or no? |
| C05-G17-Q18 | Do you has money for a low cost dental visit? |
| C05-G17-Q19 | If it only costs a small amount, you can afford it? |
| C05-G17-Q20 | You need the dental care to be completely free? |

## Test totals

| Case | Groups | Questions |
|---|---:|---:|
| 01 | 3 | 60 |
| 02 | 4 | 80 |
| 03 | 4 | 80 |
| 04 | 3 | 60 |
| 05 | 3 | 60 |
| Total | 17 | 340 |
