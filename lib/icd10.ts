// Common outpatient ICD-10 codes for diagnosis auto-complete. A curated
// subset (not the full 70k-code list) covering the bulk of OPD diagnoses;
// doctors can still type any free-text diagnosis. Pure data — client-safe.

export type Icd = { code: string; title: string; aka?: string };

export const ICD10: Icd[] = [
  // Infections
  { code: "A09", title: "Infectious gastroenteritis and colitis", aka: "diarrhoea loose motions age" },
  { code: "A01.0", title: "Typhoid fever", aka: "enteric" },
  { code: "A90", title: "Dengue fever", aka: "dengue" },
  { code: "B50.9", title: "Plasmodium falciparum malaria, unspecified", aka: "malaria" },
  { code: "B54", title: "Unspecified malaria", aka: "malaria" },
  { code: "A15.0", title: "Tuberculosis of lung", aka: "tb pulmonary koch" },
  { code: "B34.9", title: "Viral infection, unspecified", aka: "viral fever" },
  { code: "B01.9", title: "Varicella without complication", aka: "chickenpox" },
  { code: "B35.4", title: "Tinea corporis", aka: "ringworm fungal" },
  { code: "B37.3", title: "Candidiasis of vulva and vagina", aka: "fungal vaginal" },
  { code: "U07.1", title: "COVID-19, virus identified", aka: "corona" },
  { code: "R50.9", title: "Fever, unspecified", aka: "pyrexia" },
  // Respiratory
  { code: "J00", title: "Acute nasopharyngitis (common cold)", aka: "urti cold coryza" },
  { code: "J01.9", title: "Acute sinusitis, unspecified", aka: "sinus" },
  { code: "J02.9", title: "Acute pharyngitis, unspecified", aka: "sore throat" },
  { code: "J03.9", title: "Acute tonsillitis, unspecified", aka: "tonsils" },
  { code: "J06.9", title: "Acute upper respiratory infection, unspecified", aka: "urti" },
  { code: "J11.1", title: "Influenza with other respiratory manifestations", aka: "flu" },
  { code: "J18.9", title: "Pneumonia, unspecified organism", aka: "lrti chest infection" },
  { code: "J20.9", title: "Acute bronchitis, unspecified", aka: "cough lrti" },
  { code: "J30.4", title: "Allergic rhinitis, unspecified", aka: "allergy sneezing" },
  { code: "J44.1", title: "COPD with acute exacerbation", aka: "copd" },
  { code: "J45.909", title: "Asthma, uncomplicated", aka: "bronchial asthma wheeze" },
  { code: "R05", title: "Cough", aka: "cough" },
  // Cardio-metabolic
  { code: "I10", title: "Essential (primary) hypertension", aka: "htn high bp" },
  { code: "I20.9", title: "Angina pectoris, unspecified", aka: "chest pain cardiac" },
  { code: "I25.10", title: "Atherosclerotic heart disease", aka: "cad ihd coronary" },
  { code: "I50.9", title: "Heart failure, unspecified", aka: "chf" },
  { code: "I48.91", title: "Atrial fibrillation, unspecified", aka: "af" },
  { code: "E11.9", title: "Type 2 diabetes mellitus without complications", aka: "dm t2dm sugar" },
  { code: "E11.65", title: "Type 2 diabetes mellitus with hyperglycaemia", aka: "uncontrolled diabetes" },
  { code: "E10.9", title: "Type 1 diabetes mellitus without complications", aka: "t1dm" },
  { code: "E78.5", title: "Hyperlipidaemia, unspecified", aka: "dyslipidemia cholesterol" },
  { code: "E03.9", title: "Hypothyroidism, unspecified", aka: "thyroid" },
  { code: "E05.90", title: "Hyperthyroidism, unspecified", aka: "thyrotoxicosis" },
  { code: "E66.9", title: "Obesity, unspecified", aka: "overweight" },
  { code: "E55.9", title: "Vitamin D deficiency, unspecified", aka: "vit d" },
  { code: "D50.9", title: "Iron deficiency anaemia, unspecified", aka: "anemia low hb" },
  { code: "E86.0", title: "Dehydration", aka: "dehydration" },
  // GI
  { code: "K21.9", title: "Gastro-oesophageal reflux disease without oesophagitis", aka: "gerd acidity heartburn" },
  { code: "K29.70", title: "Gastritis, unspecified", aka: "acidity gastritis" },
  { code: "K30", title: "Functional dyspepsia", aka: "indigestion" },
  { code: "K58.9", title: "Irritable bowel syndrome without diarrhoea", aka: "ibs" },
  { code: "K59.00", title: "Constipation, unspecified", aka: "constipation" },
  { code: "K35.80", title: "Acute appendicitis", aka: "appendix" },
  { code: "K80.20", title: "Gallstones without cholecystitis", aka: "cholelithiasis" },
  { code: "K76.0", title: "Fatty liver, not elsewhere classified", aka: "nafld" },
  { code: "K64.9", title: "Haemorrhoids, unspecified", aka: "piles" },
  { code: "R10.9", title: "Abdominal pain, unspecified", aka: "pain abdomen" },
  { code: "R11.2", title: "Nausea with vomiting", aka: "vomiting" },
  // Genito-urinary / obstetric
  { code: "N39.0", title: "Urinary tract infection, site not specified", aka: "uti burning micturition" },
  { code: "N20.0", title: "Calculus of kidney", aka: "kidney stone renal" },
  { code: "N40.0", title: "Benign prostatic hyperplasia", aka: "bph prostate" },
  { code: "N18.9", title: "Chronic kidney disease, unspecified", aka: "ckd" },
  { code: "N94.6", title: "Dysmenorrhoea, unspecified", aka: "period pain" },
  { code: "N92.6", title: "Irregular menstruation, unspecified", aka: "irregular periods" },
  { code: "E28.2", title: "Polycystic ovarian syndrome", aka: "pcos pcod" },
  { code: "Z34.90", title: "Supervision of normal pregnancy", aka: "anc antenatal" },
  { code: "O21.0", title: "Mild hyperemesis gravidarum", aka: "pregnancy vomiting" },
  // Musculoskeletal
  { code: "M54.5", title: "Low back pain", aka: "lbp backache lumbago" },
  { code: "M54.2", title: "Cervicalgia", aka: "neck pain" },
  { code: "M47.812", title: "Cervical spondylosis", aka: "spondylosis neck" },
  { code: "M51.26", title: "Lumbar disc displacement", aka: "pivd slip disc" },
  { code: "M17.9", title: "Osteoarthritis of knee, unspecified", aka: "oa knee" },
  { code: "M06.9", title: "Rheumatoid arthritis, unspecified", aka: "ra" },
  { code: "M10.9", title: "Gout, unspecified", aka: "uric acid" },
  { code: "M75.00", title: "Adhesive capsulitis of shoulder", aka: "frozen shoulder" },
  { code: "M77.10", title: "Lateral epicondylitis", aka: "tennis elbow" },
  { code: "M79.1", title: "Myalgia", aka: "body ache muscle pain" },
  { code: "M81.0", title: "Age-related osteoporosis", aka: "osteoporosis" },
  { code: "S93.401", title: "Sprain of ankle", aka: "ankle sprain" },
  { code: "S52.509", title: "Fracture of lower end of radius", aka: "wrist fracture colles" },
  { code: "S06.0", title: "Concussion", aka: "head injury" },
  { code: "T14.90", title: "Injury, unspecified", aka: "trauma" },
  // Neuro / psych
  { code: "G43.909", title: "Migraine, unspecified", aka: "migraine headache" },
  { code: "G44.209", title: "Tension-type headache", aka: "headache" },
  { code: "R51", title: "Headache", aka: "headache" },
  { code: "H81.10", title: "Benign paroxysmal positional vertigo", aka: "bppv giddiness" },
  { code: "R42", title: "Dizziness and giddiness", aka: "vertigo" },
  { code: "G40.909", title: "Epilepsy, unspecified", aka: "seizure fits" },
  { code: "G56.00", title: "Carpal tunnel syndrome", aka: "ctc wrist numbness" },
  { code: "G62.9", title: "Polyneuropathy, unspecified", aka: "neuropathy tingling" },
  { code: "G47.00", title: "Insomnia, unspecified", aka: "sleeplessness" },
  { code: "F41.9", title: "Anxiety disorder, unspecified", aka: "anxiety" },
  { code: "F32.9", title: "Depressive episode, unspecified", aka: "depression" },
  { code: "I63.9", title: "Cerebral infarction, unspecified", aka: "stroke cva" },
  // ENT / eye / dental / skin
  { code: "H66.90", title: "Otitis media, unspecified", aka: "ear infection" },
  { code: "H60.90", title: "Otitis externa, unspecified", aka: "ear infection" },
  { code: "H61.20", title: "Impacted cerumen", aka: "ear wax" },
  { code: "H10.9", title: "Conjunctivitis, unspecified", aka: "red eye pink eye" },
  { code: "H52.13", title: "Myopia", aka: "refractive error" },
  { code: "H25.9", title: "Age-related cataract, unspecified", aka: "cataract" },
  { code: "H04.123", title: "Dry eye syndrome", aka: "dry eye" },
  { code: "K02.9", title: "Dental caries, unspecified", aka: "tooth decay" },
  { code: "K05.10", title: "Chronic gingivitis", aka: "gum" },
  { code: "L20.9", title: "Atopic dermatitis, unspecified", aka: "eczema" },
  { code: "L30.9", title: "Dermatitis, unspecified", aka: "rash" },
  { code: "L50.9", title: "Urticaria, unspecified", aka: "hives allergy rash" },
  { code: "L70.0", title: "Acne vulgaris", aka: "pimples" },
  { code: "L02.91", title: "Cutaneous abscess, unspecified", aka: "boil" },
  { code: "B86", title: "Scabies", aka: "itching" },
  { code: "L40.9", title: "Psoriasis, unspecified", aka: "psoriasis" },
  // Paediatric / general
  { code: "P59.9", title: "Neonatal jaundice, unspecified", aka: "newborn jaundice" },
  { code: "R62.51", title: "Failure to thrive (child)", aka: "growth" },
  { code: "Z00.00", title: "General adult medical examination", aka: "checkup health check" },
  { code: "Z00.129", title: "Routine child health examination", aka: "well baby" },
  { code: "Z23", title: "Encounter for immunisation", aka: "vaccination vaccine" },
  { code: "Z09", title: "Follow-up examination after completed treatment", aka: "review follow up" },
  { code: "R53.83", title: "Other fatigue", aka: "weakness tiredness" },
  { code: "R07.9", title: "Chest pain, unspecified", aka: "chest pain" },
  { code: "R06.02", title: "Shortness of breath", aka: "breathlessness dyspnoea" },
  { code: "R60.0", title: "Localised oedema", aka: "swelling" },
];

export function searchIcd(q: string, limit = 8): Icd[] {
  const term = q.trim().toLowerCase();
  if (term.length < 2) return [];
  return ICD10.map((i) => {
    const hay = `${i.code.toLowerCase()} ${i.title.toLowerCase()} ${i.aka ?? ""}`;
    const pos = hay.indexOf(term);
    return { i, pos, prefix: i.code.toLowerCase().startsWith(term) || i.title.toLowerCase().startsWith(term) };
  })
    .filter((x) => x.pos >= 0)
    .sort((a, b) => Number(b.prefix) - Number(a.prefix) || a.pos - b.pos)
    .slice(0, limit)
    .map((x) => x.i);
}
