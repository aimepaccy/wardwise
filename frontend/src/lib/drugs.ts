// Generic drug names common on wards, to highlight in transcripts and to catch near-misses ("ipertropium").
// Single words only: multi-word drugs are matched word by word ("magnesium", "sulfate"). British and US
// spellings both appear where they differ. Facts, not a source to copy from: written for WardWise.
// Not a formulary and not complete; a name missing here is simply not highlighted.

export const DRUG_NAMES: readonly string[] = [
  // Airway and allergy
  'salbutamol', 'albuterol', 'ipratropium', 'tiotropium', 'aminophylline', 'theophylline', 'budesonide',
  'beclometasone', 'beclomethasone', 'fluticasone', 'formoterol', 'salmeterol', 'montelukast', 'adrenaline',
  'epinephrine', 'chlorphenamine', 'chlorpheniramine', 'cetirizine', 'loratadine', 'promethazine',
  // Steroids
  'prednisolone', 'prednisone', 'dexamethasone', 'hydrocortisone', 'methylprednisolone', 'fludrocortisone',
  // Analgesia and anaesthesia
  'paracetamol', 'acetaminophen', 'ibuprofen', 'diclofenac', 'aspirin', 'morphine', 'codeine', 'tramadol',
  'pethidine', 'fentanyl', 'ketamine', 'propofol', 'thiopental', 'lidocaine', 'lignocaine', 'bupivacaine',
  'suxamethonium', 'atracurium', 'rocuronium', 'vecuronium', 'neostigmine', 'naloxone', 'midazolam',
  'diazepam', 'lorazepam', 'ketorolac',
  // Antibiotics
  'amoxicillin', 'ampicillin', 'benzylpenicillin', 'penicillin', 'phenoxymethylpenicillin', 'cloxacillin',
  'flucloxacillin', 'piperacillin', 'tazobactam', 'clavulanate', 'clavulanic', 'co-amoxiclav', 'ceftriaxone',
  'cefotaxime', 'ceftazidime', 'cefuroxime', 'cefixime', 'cefalexin', 'cephalexin', 'cefazolin', 'cefepime',
  'meropenem', 'imipenem', 'gentamicin', 'amikacin', 'streptomycin', 'vancomycin', 'metronidazole',
  'clindamycin', 'azithromycin', 'erythromycin', 'clarithromycin', 'doxycycline', 'tetracycline',
  'ciprofloxacin', 'levofloxacin', 'moxifloxacin', 'nitrofurantoin', 'trimethoprim', 'sulfamethoxazole',
  'cotrimoxazole', 'co-trimoxazole', 'chloramphenicol', 'linezolid', 'colistin', 'tinidazole',
  // Tuberculosis
  'rifampicin', 'rifampin', 'isoniazid', 'pyrazinamide', 'ethambutol', 'bedaquiline', 'delamanid',
  'pretomanid', 'rifapentine', 'pyridoxine',
  // HIV
  'tenofovir', 'lamivudine', 'emtricitabine', 'dolutegravir', 'efavirenz', 'nevirapine', 'zidovudine',
  'abacavir', 'lopinavir', 'ritonavir', 'atazanavir', 'darunavir', 'raltegravir',
  // Malaria and other infections
  'artesunate', 'artemether', 'lumefantrine', 'quinine', 'chloroquine', 'primaquine', 'amodiaquine',
  'sulfadoxine', 'pyrimethamine', 'dihydroartemisinin', 'piperaquine', 'fluconazole', 'itraconazole',
  'amphotericin', 'nystatin', 'clotrimazole', 'miconazole', 'aciclovir', 'acyclovir', 'valaciclovir',
  'oseltamivir', 'albendazole', 'mebendazole', 'praziquantel', 'ivermectin', 'permethrin',
  // Heart, blood pressure and fluids
  'furosemide', 'frusemide', 'hydrochlorothiazide', 'bendroflumethiazide', 'spironolactone', 'amlodipine',
  'nifedipine', 'enalapril', 'lisinopril', 'captopril', 'ramipril', 'losartan', 'atenolol', 'propranolol',
  'bisoprolol', 'carvedilol', 'metoprolol', 'labetalol', 'hydralazine', 'methyldopa', 'digoxin',
  'amiodarone', 'adenosine', 'atropine', 'dopamine', 'dobutamine', 'noradrenaline', 'norepinephrine',
  'glyceryl', 'nitroglycerin', 'isosorbide', 'atorvastatin', 'simvastatin', 'rosuvastatin',
  // Blood
  'heparin', 'enoxaparin', 'warfarin', 'rivaroxaban', 'apixaban', 'clopidogrel', 'alteplase',
  'streptokinase', 'tranexamic', 'protamine', 'phytomenadione', 'ferrous', 'folic', 'hydroxyurea',
  'hydroxycarbamide', 'erythropoietin',
  // Diabetes and endocrine
  'insulin', 'metformin', 'glibenclamide', 'gliclazide', 'glimepiride', 'levothyroxine', 'carbimazole',
  'propylthiouracil', 'glucagon', 'dextrose', 'empagliflozin',
  // Gut
  'omeprazole', 'esomeprazole', 'pantoprazole', 'ranitidine', 'metoclopramide', 'ondansetron',
  'domperidone', 'hyoscine', 'loperamide', 'lactulose', 'bisacodyl', 'senna',
  // Brain and mind
  'phenobarbital', 'phenobarbitone', 'phenytoin', 'carbamazepine', 'valproate', 'levetiracetam',
  'haloperidol', 'chlorpromazine', 'olanzapine', 'risperidone', 'fluoxetine', 'amitriptyline',
  'sertraline', 'mannitol',
  // Obstetrics
  'oxytocin', 'misoprostol', 'ergometrine', 'carboprost',
  // Electrolytes and others
  'magnesium', 'sulfate', 'sulphate', 'potassium', 'calcium', 'gluconate', 'bicarbonate', 'zinc',
  'thiamine', 'allopurinol', 'colchicine', 'methotrexate', 'cyclophosphamide', 'vincristine',
  'doxorubicin', 'tamoxifen', 'oxygen',
  // Added after a pharmacist-style review (2026-11-10)
  'ringer', 'hartmann', 'saline', 'sodium', 'chloride', 'betamethasone', 'carbetocin', 'methylergometrine',
  'mifepristone', 'medroxyprogesterone', 'levonorgestrel', 'benzathine', 'procaine', 'pralidoxime',
  'acetylcysteine', 'charcoal', 'flumazenil', 'ephedrine', 'phenylephrine', 'vasopressin', 'glycopyrronium',
  'caffeine', 'vitamin', 'chlorhexidine', 'povidone', 'iron', 'halothane', 'isoflurane', 'sevoflurane',
  'etomidate', 'rifabutin', 'clofazimine', 'cycloserine', 'ethionamide', 'dapsone', 'flucytosine',
  'ganciclovir', 'lithium', 'fluphenazine', 'clonazepam', 'quetiapine', 'aripiprazole', 'trihexyphenidyl',
  'benzhexol', 'lamotrigine', 'valproic', 'epoetin', 'ciclosporin', 'cyclosporine', 'cisplatin',
  'carboplatin', 'paclitaxel', 'fluorouracil', 'capecitabine', 'etoposide', 'letrozole', 'thiopentone',
  'amoxycillin', 'sulphamethoxazole', 'amoxiclav', 'coamoxiclav', 'thiamin', 'adrenalin', 'terbutaline',
]

// Ordinary and clinical words one or two letters from a drug name, never flagged as a possible mishearing
// (found by testing word pairs: "protocol" is not "propofol").
export const NOT_MISHEARINGS: readonly string[] = [
  'protocol', 'protocols', 'proposal', 'thiazide', 'thiazides', 'oxytocic', 'oxytocics', 'vasopressor',
  'vasopressors', 'aspiring', 'insulting', 'chlorine', 'magnesia', 'glycerol', 'morphing', 'dextrous',
  'adenosis', 'quinidine', 'sulphide', 'sulphite', 'sulfide', 'sulfite', 'frolic', 'glucose',
]

// Parts of drug names too close to ordinary words to suggest ("folic" acid).
export const NO_SUGGESTION: readonly string[] = ['folic']
