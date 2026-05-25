/**
 * Oncology AI Fleet — FHIR R4 Synthetic Data Client
 * Simulates Epic SMART on FHIR R4 API responses
 * Drop-in ready: swap BASE_URL + auth for live Epic sandbox
 */

const FHIR_CONFIG = {
  BASE_URL: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4', // Epic sandbox endpoint
  CLIENT_ID: 'oncology-ai-fleet-dev',
  SCOPE: 'patient/*.read observation/*.read encounter/*.read',
  SYNTHETIC: true // Set to false when connecting to real Epic sandbox
};

// ─── SYNTHETIC DATA POOLS ───────────────────────────────────────────────────

const PROVIDERS = [
  { id: 'prac-001', name: 'Dr. Patel',    npi: '1234567890', specialty: 'Oncology' },
  { id: 'prac-002', name: 'Dr. Chen',     npi: '1234567891', specialty: 'Hematology' },
  { id: 'prac-003', name: 'Dr. Okonkwo', npi: '1234567892', specialty: 'Radiation Oncology' },
  { id: 'prac-004', name: 'Dr. Nguyen',  npi: '1234567893', specialty: 'Surgical Oncology' },
  { id: 'prac-005', name: 'Dr. Martinez',npi: '1234567894', specialty: 'Oncology' },
  { id: 'prac-006', name: 'Dr. Williams',npi: '1234567895', specialty: 'Oncology' },
  { id: 'prac-007', name: 'Dr. Thompson',npi: '1234567896', specialty: 'Hematology' },
];

const DRG_CODES = [
  { code: '055', weight: 3.8821, label: 'CNS tumors w MCC',       impact: 18400 },
  { code: '180', weight: 2.9140, label: 'Resp neoplasm w MCC',    impact: 14200 },
  { code: '582', weight: 2.6830, label: 'Mastectomy w MCC',       impact: 12800 },
  { code: '374', weight: 1.9210, label: 'Digestive malig w CC',   impact: 9100  },
  { code: '470', weight: 1.8760, label: 'Joint replacement',      impact: 8700  },
  { code: '682', weight: 1.6540, label: 'Urinary malig w MCC',   impact: 7400  },
  { code: '840', weight: 1.5980, label: 'Lymphoma w MCC',         impact: 6900  },
  { code: '597', weight: 1.1230, label: 'Skin graft malig',       impact: 5100  },
  { code: '435', weight: 0.9870, label: 'Malignant fever',        impact: 4300  },
  { code: '791', weight: 0.8640, label: 'Prematurity w MCC',      impact: 3800  },
];

const DIAGNOSES_ICD10 = [
  { code: 'C34.10', display: 'Malignant neoplasm of upper lobe bronchus' },
  { code: 'C83.30', display: 'Diffuse large B-cell lymphoma' },
  { code: 'C50.911',display: 'Malignant neoplasm of breast' },
  { code: 'C61',    display: 'Malignant neoplasm of prostate' },
  { code: 'C18.9',  display: 'Malignant neoplasm of colon' },
  { code: 'C64.1',  display: 'Malignant neoplasm of right kidney' },
  { code: 'A41.9',  display: 'Sepsis, unspecified organism' },
  { code: 'N17.9',  display: 'Acute kidney failure, unspecified' },
  { code: 'J18.9',  display: 'Pneumonia, unspecified organism' },
  { code: 'I50.9',  display: 'Heart failure, unspecified' },
];

const QUERY_TYPES = ['CC/MCC', 'DRG', 'HAC', 'PSI', 'Mortality'];
const QUERY_TRIGGERS = {
  'CC/MCC':    ['Sepsis indicator', 'AKI staging', 'Malnutrition', 'Respiratory failure', 'Encephalopathy'],
  'DRG':       ['Lymphoma staging', 'NSCLC histology', 'Bilateral vs unilateral', 'Principal dx clarification'],
  'HAC':       ['CLABSI risk flag', 'CAUTI prevention', 'Fall w injury', 'DVT post-op', 'SSI screening'],
  'PSI':       ['PE post-op', 'Accidental puncture', 'Iatrogenic pneumothorax', 'Transfusion reaction'],
  'Mortality': ['NSCLC POA', 'Septic shock POA', 'CVA POA', 'Cancer POA status'],
};
const STATUSES = ['Pending', 'Responded', 'Overdue', 'Escalated'];

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomFloat(min, max) { return parseFloat((Math.random() * (max - min) + min).toFixed(1)); }
function hoursAgo(h) {
  return new Date(Date.now() - h * 3600000).toISOString();
}
function fmtCurrency(n) {
  return (n >= 0 ? '+' : '') + '$' + Math.abs(n).toLocaleString();
}

// ─── FHIR R4 RESOURCE GENERATORS ─────────────────────────────────────────────

function generatePatient(id) {
  const firstNames = ['James','Maria','Robert','Linda','Michael','Barbara','William','Susan'];
  const lastNames  = ['Johnson','Smith','Williams','Brown','Jones','Garcia','Miller','Davis'];
  const dob = `${randomInt(1940,1980)}-${String(randomInt(1,12)).padStart(2,'0')}-${String(randomInt(1,28)).padStart(2,'0')}`;
  return {
    resourceType: 'Patient',
    id: `patient-${id}`,
    identifier: [{ system: 'urn:oid:1.2.840.114350.1.13.0.1.7.5.737384.0', value: `MRN${100000+id}` }],
    name: [{ use: 'official', family: randomFrom(lastNames), given: [randomFrom(firstNames)] }],
    birthDate: dob,
    gender: randomFrom(['male','female']),
    extension: [{ url: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-race', valueString: 'UNK' }]
  };
}

function generateEncounter(id, patientId, providerId) {
  const drg = randomFrom(DRG_CODES);
  const admitDate = hoursAgo(randomInt(24, 240));
  return {
    resourceType: 'Encounter',
    id: `enc-${id}`,
    status: randomFrom(['in-progress','finished']),
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'IMP', display: 'inpatient encounter' },
    type: [{ coding: [{ system: 'http://snomed.info/sct', code: '11429006', display: 'Consultation' }] }],
    subject: { reference: `Patient/${patientId}` },
    participant: [{ individual: { reference: `Practitioner/${providerId}` } }],
    period: { start: admitDate },
    diagnosis: [
      {
        condition: { reference: `Condition/cond-${id}` },
        use: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/diagnosis-role', code: 'AD', display: 'Admission diagnosis' }] },
        rank: 1
      }
    ],
    extension: [
      { url: 'http://hl7.org/fhir/StructureDefinition/ms-drg', valueCode: drg.code },
      { url: 'http://oncologyaifleet.ai/fhir/drg-weight', valueDecimal: drg.weight },
      { url: 'http://oncologyaifleet.ai/fhir/drg-label',  valueString: drg.label },
      { url: 'http://oncologyaifleet.ai/fhir/drg-impact', valueDecimal: drg.impact }
    ]
  };
}

function generateCondition(id, patientId, encounterId) {
  const dx = randomFrom(DIAGNOSES_ICD10);
  return {
    resourceType: 'Condition',
    id: `cond-${id}`,
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
    verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }] },
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'encounter-diagnosis' }] }],
    code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10-cm', code: dx.code, display: dx.display }], text: dx.display },
    subject: { reference: `Patient/${patientId}` },
    encounter: { reference: `Encounter/${encounterId}` },
    onsetDateTime: hoursAgo(randomInt(12, 200)),
    extension: [
      { url: 'http://oncologyaifleet.ai/fhir/poa-indicator', valueCode: randomFrom(['Y','N','U','W']) },
      { url: 'http://oncologyaifleet.ai/fhir/cc-mcc-flag',  valueBoolean: Math.random() > 0.4 }
    ]
  };
}

function generateCDIQuery(id, encounterId, providerId) {
  const qtype   = randomFrom(QUERY_TYPES);
  const trigger = randomFrom(QUERY_TRIGGERS[qtype]);
  const status  = randomFrom(STATUSES);
  const provider = PROVIDERS.find(p => p.id === providerId) || PROVIDERS[0];
  const impact  = status === 'HAC' ? -randomInt(2000, 8000) : randomInt(3000, 18000);
  const sentHrs = randomInt(1, 72);
  return {
    resourceType: 'Task',                          // FHIR R4 Task = CDI Query
    id: `QRY-${4800 + id}`,
    status: status === 'Responded' ? 'completed' : status === 'Overdue' ? 'failed' : 'in-progress',
    intent: 'order',
    code: { coding: [{ system: 'http://oncologyaifleet.ai/fhir/cdi-query-type', code: qtype }], text: qtype },
    description: trigger,
    for: { reference: `Encounter/${encounterId}` },
    owner: { reference: `Practitioner/${providerId}`, display: provider.name },
    authoredOn: hoursAgo(sentHrs),
    lastModified: hoursAgo(Math.max(0, sentHrs - randomInt(0, sentHrs))),
    extension: [
      { url: 'http://oncologyaifleet.ai/fhir/query-status-label', valueString: status },
      { url: 'http://oncologyaifleet.ai/fhir/drg-revenue-impact',  valueDecimal: impact },
      { url: 'http://oncologyaifleet.ai/fhir/query-trigger',       valueString: trigger },
    ]
  };
}

// ─── SYNTHETIC FHIR BUNDLE GENERATOR ─────────────────────────────────────────

function generateFHIRBundle(resourceType, resources) {
  return {
    resourceType: 'Bundle',
    id: `bundle-${Date.now()}`,
    type: 'searchset',
    total: resources.length,
    timestamp: new Date().toISOString(),
    link: [{ relation: 'self', url: `${FHIR_CONFIG.BASE_URL}/${resourceType}?_format=json` }],
    entry: resources.map(r => ({
      fullUrl: `${FHIR_CONFIG.BASE_URL}/${r.resourceType}/${r.id}`,
      resource: r,
      search: { mode: 'match' }
    }))
  };
}

// ─── MAIN API CLIENT ──────────────────────────────────────────────────────────

class FHIRClient {
  constructor() {
    this.synthetic = FHIR_CONFIG.SYNTHETIC;
    this._cache = {};
    this._seed();
  }

  _seed() {
    // Generate a stable synthetic dataset on init
    this.patients   = Array.from({ length: 20 }, (_, i) => generatePatient(i + 1));
    this.providers  = PROVIDERS;
    this.encounters = this.patients.map((p, i) =>
      generateEncounter(i + 1, p.id, PROVIDERS[i % PROVIDERS.length].id)
    );
    this.conditions = this.encounters.map((e, i) =>
      generateCondition(i + 1, `patient-${i + 1}`, e.id)
    );
    this.queries = this.encounters.map((e, i) =>
      generateCDIQuery(i + 1, e.id, PROVIDERS[i % PROVIDERS.length].id)
    );
  }

  // Simulate async FHIR API call with realistic latency
  async _fetch(resourceType, resources) {
    await new Promise(r => setTimeout(r, randomInt(120, 400)));
    return generateFHIRBundle(resourceType, resources);
  }

  /** GET /Patient?_count=20 */
  async getPatients() {
    return this._fetch('Patient', this.patients);
  }

  /** GET /Encounter?status=in-progress&_include=Encounter:diagnosis */
  async getEncounters() {
    return this._fetch('Encounter', this.encounters);
  }

  /** GET /Condition?category=encounter-diagnosis */
  async getConditions() {
    return this._fetch('Condition', this.conditions);
  }

  /** GET /Task?code=CDI-Query (CDI Queries modeled as FHIR Tasks) */
  async getCDIQueries() {
    return this._fetch('Task', this.queries);
  }

  /** Derived: Provider response rate metrics */
  async getProviderMetrics() {
    await new Promise(r => setTimeout(r, 200));
    return PROVIDERS.map(p => {
      const pQueries = this.queries.filter(q =>
        q.owner.reference === `Practitioner/${p.id}`
      );
      const responded = pQueries.filter(q =>
        q.extension.find(e => e.url.includes('query-status-label'))?.valueString === 'Responded'
      ).length;
      const total = pQueries.length || 1;
      return {
        provider: p,
        total,
        responded,
        responseRate: Math.round((responded / total) * 100),
        avgResponseHrs: randomFloat(8, 36),
        overdue: pQueries.filter(q =>
          q.extension.find(e => e.url.includes('query-status-label'))?.valueString === 'Overdue'
        ).length
      };
    }).sort((a, b) => b.responseRate - a.responseRate);
  }

  /** Derived: Revenue impact summary */
  async getRevenueImpact() {
    await new Promise(r => setTimeout(r, 180));
    let ccmcc = 0, drg = 0, hac = 0;
    this.queries.forEach(q => {
      const impact = q.extension.find(e => e.url.includes('drg-revenue-impact'))?.valueDecimal || 0;
      const type   = q.extension.find(e => e.url.includes('query-status-label'))?.valueString;
      const qtype  = q.code.coding[0].code;
      if (type === 'Responded') {
        if (qtype === 'CC/MCC') ccmcc += impact;
        else if (qtype === 'DRG') drg += impact;
        else if (qtype === 'HAC') hac += Math.abs(impact);
      }
    });
    return { ccmcc, drg, hac, total: ccmcc + drg + hac };
  }

  /** Derived: KPI summary */
  async getKPIs() {
    await new Promise(r => setTimeout(r, 150));
    const total     = this.queries.length;
    const responded = this.queries.filter(q => q.status === 'completed').length;
    const overdue   = this.queries.filter(q => q.status === 'failed').length;
    const pending   = this.queries.filter(q => q.status === 'in-progress').length;
    const avgHrs    = randomFloat(16, 22);
    return {
      totalQueries:   total,
      responseRate:   Math.round((responded / total) * 100),
      avgResponseHrs: avgHrs,
      pending,
      overdue,
      fhirSyncedAt:   new Date().toISOString()
    };
  }

  /** Refresh: re-seed with new random data (simulates real-time updates) */
  refresh() {
    this._seed();
  }
}

// Export singleton
window.FHIRClient = new FHIRClient();
console.log('[Oncology AI Fleet] FHIR R4 synthetic client initialized.', FHIR_CONFIG);
