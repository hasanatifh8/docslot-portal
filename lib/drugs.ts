// Starter formulary for prescription auto-complete: common Indian OPD
// medicines with sensible adult defaults. Doctors' own frequently prescribed
// lines are merged in at runtime (see "favourites" in the consultation page),
// so this list only needs to cover the basics. Pure data — client-safe.

export type DrugDefault = {
  medicine: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  instructions?: string;
  /** search aliases: generic, brand, class */
  aka?: string;
};

export const FORMULARY: DrugDefault[] = [
  // Analgesic / antipyretic
  { medicine: "Paracetamol 650 mg tab", dosage: "1 tab", frequency: "1-1-1", duration: "3 days", instructions: "After food, if fever", aka: "dolo crocin calpol pcm acetaminophen" },
  { medicine: "Paracetamol 500 mg tab", dosage: "1 tab", frequency: "1-1-1", duration: "3 days", instructions: "After food", aka: "crocin pcm" },
  { medicine: "Paracetamol 250 mg/5 ml syrup", dosage: "5 ml", frequency: "1-1-1", duration: "3 days", instructions: "If fever (paediatric — dose by weight)", aka: "calpol syrup pcm" },
  { medicine: "Ibuprofen 400 mg tab", dosage: "1 tab", frequency: "1-0-1", duration: "3 days", instructions: "After food", aka: "brufen nsaid" },
  { medicine: "Aceclofenac 100 mg + Paracetamol 325 mg tab", dosage: "1 tab", frequency: "1-0-1", duration: "5 days", instructions: "After food", aka: "zerodol-p hifenac-p nsaid" },
  { medicine: "Diclofenac 50 mg tab", dosage: "1 tab", frequency: "1-0-1", duration: "3 days", instructions: "After food", aka: "voveran nsaid" },
  { medicine: "Etoricoxib 90 mg tab", dosage: "1 tab", frequency: "0-0-1", duration: "5 days", instructions: "After food", aka: "etoshine nucoxia nsaid" },
  { medicine: "Tramadol 50 mg tab", dosage: "1 tab", frequency: "SOS", duration: "3 days", instructions: "For severe pain", aka: "ultracet" },
  { medicine: "Diclofenac gel", dosage: "Local application", frequency: "1-1-1", duration: "7 days", instructions: "Apply on affected area", aka: "volini voveran gel" },
  // Antibiotics
  { medicine: "Amoxicillin 500 mg cap", dosage: "1 cap", frequency: "1-1-1", duration: "5 days", instructions: "After food", aka: "mox novamox penicillin" },
  { medicine: "Amoxicillin 500 mg + Clavulanic acid 125 mg tab", dosage: "1 tab", frequency: "1-0-1", duration: "5 days", instructions: "After food", aka: "augmentin amoxyclav clavam penicillin" },
  { medicine: "Azithromycin 500 mg tab", dosage: "1 tab", frequency: "1-0-0", duration: "3 days", instructions: "1 hour before food", aka: "azee azithral macrolide" },
  { medicine: "Cefixime 200 mg tab", dosage: "1 tab", frequency: "1-0-1", duration: "5 days", instructions: "After food", aka: "taxim-o cephalosporin" },
  { medicine: "Cefuroxime 500 mg tab", dosage: "1 tab", frequency: "1-0-1", duration: "5 days", instructions: "After food", aka: "ceftum cephalosporin" },
  { medicine: "Ciprofloxacin 500 mg tab", dosage: "1 tab", frequency: "1-0-1", duration: "5 days", instructions: "After food", aka: "ciplox quinolone" },
  { medicine: "Levofloxacin 500 mg tab", dosage: "1 tab", frequency: "1-0-0", duration: "5 days", instructions: "After food", aka: "levoflox quinolone" },
  { medicine: "Ofloxacin 200 mg + Ornidazole 500 mg tab", dosage: "1 tab", frequency: "1-0-1", duration: "5 days", instructions: "After food", aka: "o2 oflox-oz quinolone" },
  { medicine: "Metronidazole 400 mg tab", dosage: "1 tab", frequency: "1-1-1", duration: "5 days", instructions: "After food, avoid alcohol", aka: "flagyl metrogyl" },
  { medicine: "Doxycycline 100 mg cap", dosage: "1 cap", frequency: "1-0-1", duration: "7 days", instructions: "After food, with water", aka: "doxt" },
  { medicine: "Nitrofurantoin 100 mg cap", dosage: "1 cap", frequency: "1-0-1", duration: "5 days", instructions: "After food", aka: "niftran uti" },
  { medicine: "Cotrimoxazole DS tab", dosage: "1 tab", frequency: "1-0-1", duration: "5 days", instructions: "After food", aka: "septran sulfa" },
  // GI
  { medicine: "Pantoprazole 40 mg tab", dosage: "1 tab", frequency: "1-0-0", duration: "7 days", instructions: "Before breakfast", aka: "pan pantocid ppi" },
  { medicine: "Omeprazole 20 mg cap", dosage: "1 cap", frequency: "1-0-0", duration: "7 days", instructions: "Before breakfast", aka: "omez ppi" },
  { medicine: "Rabeprazole 20 mg + Domperidone 30 mg cap", dosage: "1 cap", frequency: "1-0-0", duration: "7 days", instructions: "Before breakfast", aka: "rabekind-dsr razo-d" },
  { medicine: "Ondansetron 4 mg tab", dosage: "1 tab", frequency: "SOS", duration: "3 days", instructions: "If vomiting", aka: "emeset vomiting" },
  { medicine: "Domperidone 10 mg tab", dosage: "1 tab", frequency: "1-1-1", duration: "3 days", instructions: "Before food", aka: "domstal" },
  { medicine: "ORS sachet", dosage: "1 sachet in 1 L water", frequency: "Sip frequently", duration: "3 days", instructions: "After each loose stool", aka: "electral oral rehydration" },
  { medicine: "Racecadotril 100 mg cap", dosage: "1 cap", frequency: "1-1-1", duration: "3 days", instructions: "Before food", aka: "redotil diarrhoea" },
  { medicine: "Loperamide 2 mg tab", dosage: "1 tab", frequency: "SOS", duration: "2 days", instructions: "After loose stool", aka: "imodium" },
  { medicine: "Lactulose syrup", dosage: "15 ml", frequency: "0-0-1", duration: "7 days", instructions: "At bedtime", aka: "duphalac constipation" },
  { medicine: "Dicyclomine 10 mg + Paracetamol 325 mg tab", dosage: "1 tab", frequency: "SOS", duration: "3 days", instructions: "For abdominal cramps", aka: "meftal spas cyclopam" },
  { medicine: "Antacid gel", dosage: "10 ml", frequency: "1-1-1", duration: "5 days", instructions: "After food", aka: "digene gelusil mucaine" },
  { medicine: "Probiotic cap", dosage: "1 cap", frequency: "1-0-1", duration: "5 days", aka: "vizylac econorm" },
  // Respiratory / allergy
  { medicine: "Cetirizine 10 mg tab", dosage: "1 tab", frequency: "0-0-1", duration: "5 days", instructions: "At bedtime, may cause drowsiness", aka: "cetzine okacet antihistamine" },
  { medicine: "Levocetirizine 5 mg tab", dosage: "1 tab", frequency: "0-0-1", duration: "5 days", instructions: "At bedtime", aka: "levocet xyzal antihistamine" },
  { medicine: "Fexofenadine 120 mg tab", dosage: "1 tab", frequency: "1-0-0", duration: "5 days", aka: "allegra antihistamine" },
  { medicine: "Montelukast 10 mg + Levocetirizine 5 mg tab", dosage: "1 tab", frequency: "0-0-1", duration: "7 days", instructions: "At bedtime", aka: "montair-lc montek-lc" },
  { medicine: "Ambroxol + Guaifenesin + Terbutaline syrup", dosage: "10 ml", frequency: "1-1-1", duration: "5 days", aka: "ascoril cough expectorant" },
  { medicine: "Dextromethorphan syrup", dosage: "10 ml", frequency: "1-0-1", duration: "5 days", instructions: "For dry cough", aka: "benadryl dry cough" },
  { medicine: "Salbutamol inhaler 100 mcg", dosage: "2 puffs", frequency: "SOS", duration: "1 month", instructions: "For breathlessness, use spacer", aka: "asthalin ventolin" },
  { medicine: "Budesonide + Formoterol inhaler 200/6", dosage: "2 puffs", frequency: "1-0-1", duration: "1 month", instructions: "Rinse mouth after use", aka: "foracort symbicort" },
  { medicine: "Fluticasone nasal spray", dosage: "2 sprays each nostril", frequency: "1-0-0", duration: "14 days", aka: "flomist" },
  { medicine: "Xylometazoline nasal drops 0.1%", dosage: "2 drops each nostril", frequency: "1-0-1", duration: "5 days", instructions: "Not more than 5 days", aka: "otrivin" },
  { medicine: "Steam inhalation", dosage: "—", frequency: "1-0-1", duration: "5 days", aka: "steam" },
  // Cardio-metabolic
  { medicine: "Amlodipine 5 mg tab", dosage: "1 tab", frequency: "1-0-0", duration: "1 month", aka: "amlong stamlo hypertension" },
  { medicine: "Telmisartan 40 mg tab", dosage: "1 tab", frequency: "1-0-0", duration: "1 month", aka: "telma hypertension" },
  { medicine: "Telmisartan 40 mg + Hydrochlorothiazide 12.5 mg tab", dosage: "1 tab", frequency: "1-0-0", duration: "1 month", aka: "telma-h" },
  { medicine: "Losartan 50 mg tab", dosage: "1 tab", frequency: "1-0-0", duration: "1 month", aka: "losar" },
  { medicine: "Metoprolol succinate 25 mg tab", dosage: "1 tab", frequency: "1-0-0", duration: "1 month", aka: "met-xl betaloc" },
  { medicine: "Atorvastatin 10 mg tab", dosage: "1 tab", frequency: "0-0-1", duration: "1 month", instructions: "At bedtime", aka: "atorva lipitor statin" },
  { medicine: "Rosuvastatin 10 mg tab", dosage: "1 tab", frequency: "0-0-1", duration: "1 month", aka: "rosuvas statin" },
  { medicine: "Aspirin 75 mg tab", dosage: "1 tab", frequency: "0-1-0", duration: "1 month", instructions: "After food", aka: "ecosprin" },
  { medicine: "Clopidogrel 75 mg tab", dosage: "1 tab", frequency: "0-1-0", duration: "1 month", aka: "clopilet" },
  { medicine: "Metformin 500 mg tab", dosage: "1 tab", frequency: "1-0-1", duration: "1 month", instructions: "After food", aka: "glycomet diabetes" },
  { medicine: "Metformin SR 1000 mg tab", dosage: "1 tab", frequency: "0-0-1", duration: "1 month", instructions: "After dinner", aka: "glycomet gp diabetes" },
  { medicine: "Glimepiride 1 mg tab", dosage: "1 tab", frequency: "1-0-0", duration: "1 month", instructions: "Before breakfast", aka: "amaryl diabetes" },
  { medicine: "Sitagliptin 100 mg tab", dosage: "1 tab", frequency: "1-0-0", duration: "1 month", aka: "januvia diabetes" },
  { medicine: "Vildagliptin 50 mg + Metformin 500 mg tab", dosage: "1 tab", frequency: "1-0-1", duration: "1 month", instructions: "After food", aka: "galvus met diabetes" },
  { medicine: "Levothyroxine 50 mcg tab", dosage: "1 tab", frequency: "1-0-0", duration: "1 month", instructions: "Empty stomach, 30 min before breakfast", aka: "thyronorm eltroxin thyroid" },
  // Supplements
  { medicine: "Vitamin D3 60,000 IU sachet/cap", dosage: "1", frequency: "Once a week", duration: "8 weeks", instructions: "With milk", aka: "uprise d3 calcirol cholecalciferol" },
  { medicine: "Calcium 500 mg + Vitamin D3 tab", dosage: "1 tab", frequency: "0-1-0", duration: "1 month", instructions: "After food", aka: "shelcal calcimax" },
  { medicine: "Ferrous ascorbate + Folic acid tab", dosage: "1 tab", frequency: "0-1-0", duration: "1 month", instructions: "After food", aka: "orofer iron anaemia" },
  { medicine: "Vitamin B-complex tab", dosage: "1 tab", frequency: "1-0-0", duration: "1 month", aka: "becosules neurobion" },
  { medicine: "Methylcobalamin 1500 mcg tab", dosage: "1 tab", frequency: "1-0-0", duration: "1 month", aka: "mecobalamin b12" },
  { medicine: "Zinc 20 mg tab", dosage: "1 tab", frequency: "1-0-0", duration: "14 days", aka: "zinc" },
  // Neuro / psych / misc
  { medicine: "Pregabalin 75 mg cap", dosage: "1 cap", frequency: "0-0-1", duration: "14 days", instructions: "At bedtime", aka: "pregeb neuropathy" },
  { medicine: "Amitriptyline 10 mg tab", dosage: "1 tab", frequency: "0-0-1", duration: "1 month", instructions: "At bedtime", aka: "tryptomer" },
  { medicine: "Thiocolchicoside 4 mg + Aceclofenac 100 mg tab", dosage: "1 tab", frequency: "1-0-1", duration: "5 days", instructions: "After food", aka: "myoril muscle relaxant" },
  { medicine: "Clonazepam 0.25 mg tab", dosage: "1 tab", frequency: "0-0-1", duration: "7 days", instructions: "At bedtime", aka: "rivotril" },
  { medicine: "Betahistine 16 mg tab", dosage: "1 tab", frequency: "1-0-1", duration: "7 days", aka: "vertin vertigo" },
  { medicine: "Prochlorperazine 5 mg tab", dosage: "1 tab", frequency: "SOS", duration: "3 days", instructions: "For vertigo/vomiting", aka: "stemetil" },
  // Skin / topical / eye / ENT
  { medicine: "Clotrimazole 1% cream", dosage: "Local application", frequency: "1-0-1", duration: "14 days", aka: "candid fungal" },
  { medicine: "Mupirocin 2% ointment", dosage: "Local application", frequency: "1-0-1", duration: "7 days", aka: "t-bact" },
  { medicine: "Fluconazole 150 mg tab", dosage: "1 tab", frequency: "Once a week", duration: "2 weeks", aka: "forcan fungal" },
  { medicine: "Calamine lotion", dosage: "Local application", frequency: "1-1-1", duration: "7 days", aka: "lacto calamine itching" },
  { medicine: "Moxifloxacin 0.5% eye drops", dosage: "1 drop", frequency: "4 times a day", duration: "5 days", aka: "vigamox moxicip eye" },
  { medicine: "Carboxymethylcellulose 0.5% eye drops", dosage: "1 drop", frequency: "4 times a day", duration: "1 month", aka: "refresh tears dry eye" },
  { medicine: "Ciprofloxacin + Dexamethasone ear drops", dosage: "3 drops", frequency: "1-1-1", duration: "5 days", aka: "ciplox-d ear" },
  { medicine: "Chlorhexidine mouthwash", dosage: "10 ml", frequency: "1-0-1", duration: "7 days", instructions: "Rinse, do not swallow", aka: "hexidine" },
];

export const FREQUENCIES = ["1-0-0", "0-1-0", "0-0-1", "1-0-1", "1-1-1", "1-1-1-1", "SOS", "Once a week"];
export const DURATIONS = ["3 days", "5 days", "7 days", "10 days", "14 days", "1 month", "3 months"];
export const INSTRUCTIONS = ["After food", "Before food", "Empty stomach", "At bedtime", "If fever", "If pain"];

/** Ranked search over the formulary plus extra lines (e.g. favourites). */
export function searchDrugs(q: string, extra: DrugDefault[] = [], limit = 8): DrugDefault[] {
  const term = q.trim().toLowerCase();
  if (term.length < 2) return [];
  const seen = new Set<string>();
  const scored: { d: DrugDefault; score: number }[] = [];
  for (const [i, d] of [...extra, ...FORMULARY].entries()) {
    const key = d.medicine.toLowerCase();
    if (seen.has(key)) continue;
    const hay = `${key} ${d.aka ?? ""}`;
    const pos = hay.indexOf(term);
    if (pos < 0) continue;
    seen.add(key);
    // favourites first, then prefix matches, then earlier matches
    scored.push({ d, score: (i < extra.length ? 0 : 1000) + (key.startsWith(term) ? 0 : 100) + pos });
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, limit).map((s) => s.d);
}
