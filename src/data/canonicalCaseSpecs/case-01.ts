import { fact } from "./helpers";
import { defineCanonicalCase } from "./schema";

export const canonicalCase01 = defineCanonicalCase({ schemaVersion: 1,
  identity: { caseId: "case-01", age: 52, setting: "emergency department", location: "left mandibular molar", displayName: "Amara Johnson", displayNameStatus: "implementation-metadata", gender: { status: "implementation-metadata", value: "Female" } },
  sources: { wordDocument: "docs/faculty-specifications/case-01-ludwigs.docx", auditDocument: "docs/case-spec-audit.md" },
  facts: [
    fact({id:"c1.chief",category:"chief-complaint",statement:"Dental pain with swelling and trouble breathing.",value:"dental pain with swelling and trouble breathing",disclosureRequirement:"opening-only",rubricRequired:true,implementationMatchers:["swollen","breathe"]}),
    fact({id:"c1.location",category:"location",statement:"The source is a left mandibular molar.",value:"left mandibular molar",precision:"exact",rubricRequired:true,implementationMatchers:["left","lower"]}),
    fact({id:"c1.duration",category:"duration",statement:"Pain has worsened for four days.",value:"4 days",precision:"exact",rubricRequired:true,implementationMatchers:["four days"]}),
    fact({id:"c1.severity",category:"severity",statement:"Pain is 8/10.",value:8,precision:"exact",rubricRequired:true,implementationMatchers:["8/10","eight out of ten"]}),
    fact({id:"c1.swelling",category:"swelling",statement:"Bilateral submandibular and sublingual swelling is rapidly progressing.",value:"bilateral submandibular and sublingual swelling",rubricRequired:true,implementationMatchers:["bilateral","submandibular","sublingual"]}),
    fact({id:"c1.dysphagia",category:"airway",statement:"The patient has dysphagia.",value:true,rubricRequired:true,implementationMatchers:["swallowing is painful"],questions:["Are you having trouble swallowing?","Can you swallow liquids?"]}),
    fact({id:"c1.dyspnea-supine",category:"airway",statement:"Dyspnea is worse when supine.",value:true,rubricRequired:true,implementationMatchers:["breathing feels uncomfortable when lying back"],questions:["Are you having trouble breathing?","Is breathing worse when you lie down?"]}),
    fact({id:"c1.drooling",category:"airway",statement:"The patient is drooling.",value:true,rubricRequired:true,implementationMatchers:["drooling"],questions:["Are you drooling?"]}),
    fact({id:"c1.voice",category:"airway",statement:"The voice is muffled.",value:"muffled",rubricRequired:true,implementationMatchers:["muffled voice"],questions:["Has your voice changed?"]}),
    fact({id:"c1.tongue",category:"examination",statement:"The tongue is elevated and displaced posteriorly.",value:"elevated/posterior",patientKnowledge:"not-applicable",disclosureRequirement:"examination-only",rubricRequired:true,implementationMatchers:["tongue"]}),
    fact({id:"c1.fever",category:"fever",statement:"The patient has fever.",value:true,rubricRequired:true,implementationMatchers:["fever","38.6"],questions:["Have you had a fever?","Have you checked your temperature?"]}),
    fact({id:"c1.chills",category:"systemic",statement:"The patient has chills.",value:true,rubricRequired:true,implementationMatchers:["chills"],questions:["Any chills?"]}),
    fact({id:"c1.diabetes",category:"medical-history",statement:"The patient has type 2 diabetes.",value:"type 2 diabetes",rubricRequired:true,implementationMatchers:["diabetes"]}),
    fact({id:"c1.hypertension",category:"medical-history",statement:"The patient has hypertension.",value:"hypertension",rubricRequired:true,implementationMatchers:["hypertension"]}),
    fact({id:"c1.metformin",category:"medication",statement:"The patient takes metformin.",value:"metformin",precision:"exact",rubricRequired:true,implementationMatchers:["metformin"],questions:["What medications did you take?"]}),
    fact({id:"c1.lisinopril",category:"medication",statement:"The patient takes lisinopril.",value:"lisinopril",precision:"exact",rubricRequired:true,implementationMatchers:["lisinopril"],questions:["What medications did you take?"]}),
    fact({id:"c1.opioid",category:"medical-history",statement:"The patient has no history of opioid or narcotic use, opioid misuse, or opioid dependence.",value:false,polarity:"negative",precision:"exact",implementationMatchers:["no history of opioid","never used opioids","no opioid misuse"],questions:["Have you ever used opioids?","Any history of prescription opioid misuse?"]}),
    fact({id:"c1.nkda",category:"allergy",statement:"No known drug allergies.",value:"NKDA",polarity:"negative",rubricRequired:true,implementationMatchers:["no known medication allergies"],questions:["Are you allergic to penicillin?"]}),
    fact({id:"c1.smoking",category:"social-history",statement:"The patient smokes one pack per day.",value:"1 pack/day",precision:"exact",rubricRequired:true,implementationMatchers:["one pack","smok"]}),
    fact({id:"c1.access",category:"access-barrier",statement:"The patient cannot afford extraction.",value:"cannot afford extraction",rubricRequired:true,implementationMatchers:["afford"]}),
    fact({id:"c1.temp",category:"vital-sign",statement:"Temperature is 38.6°C.",value:"38.6°C",precision:"exact",patientKnowledge:"not-applicable",disclosureRequirement:"examination-only",implementationMatchers:["38.6"]}),
    fact({id:"c1.diagnosis",category:"diagnosis",statement:"The diagnosis is Ludwig's angina.",value:"Ludwig's angina",precision:"exact",patientKnowledge:"unknown",disclosureRequirement:"clinician-inference-only",rubricRequired:true,implementationMatchers:["ludwig"]}),
    fact({id:"c1.management",category:"management",statement:"Airway maintenance, admission, IV therapy, CT and OMFS consultation are required.",value:"airway emergency management",patientKnowledge:"not-applicable",disclosureRequirement:"clinician-inference-only",rubricRequired:true,implementationMatchers:["airway","admission","iv","ct","omfs"]}),
  ], facultyReview: [] });

