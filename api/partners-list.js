// Pithonix GCC Playbook — Public approved partners list
// Also seeds the INDUS framework table on first run (background, non-blocking)

import pg from 'pg';
const { Pool } = pg;
let pool;
function getPool() {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
  return pool;
}

// --- INDUS Framework seed data ---
const INDUS_V1 = {
  version: '1.0', status: 'draft',
  submitted_to: 'Government of Telangana', submitted_date: 'May 2026',
  ip_owner: 'PITHONIX AI INDIA PRIVATE LIMITED',
  governance_authority: 'INDUS Board (Government of Telangana endorsement authority)',
  cin: 'U62090TS2026PTC213220',
  domains: [
    { id:'D1', name:'Governance Alignment', weight_ready:12, weight_certified:12, weight_prime:10, auto_disqualify:false, criteria:['Board and governance structure documented','Delegation of authority matrix defined','Regulatory filings current (ROC, RBI, FEMA)','Internal audit function operational','Stakeholder reporting cadence established'] },
    { id:'D2', name:'Cross-Border Data Integrity', weight_ready:15, weight_certified:15, weight_prime:14, auto_disqualify:false, criteria:['DPDPA 2023 compliance framework in place','Data classification policy documented','Cross-border data transfer agreements signed','Encryption standards (AES-256 minimum) enforced','Data localisation requirements mapped and met','Data breach response plan tested'] },
    { id:'D3', name:'Talent Ecosystem Maturity', weight_ready:14, weight_certified:13, weight_prime:12, auto_disqualify:false, criteria:['Attrition rate below sector benchmark','Career architecture and levelling framework documented','Leadership pipeline programme operational','Local talent development initiatives active','Workforce plan tied to 3-year GCC roadmap','Diversity and inclusion metrics tracked'] },
    { id:'D4', name:'Operational Integration', weight_ready:13, weight_certified:14, weight_prime:13, auto_disqualify:false, criteria:['SLAs defined and tracked for all major functions','Process ownership documented end-to-end','Technology stack integrated with parent systems','Quality management system operational','Continuous improvement programme active','Knowledge management framework in place'] },
    { id:'D5', name:'Regulatory Multi-Jurisdiction', weight_ready:18, weight_certified:17, weight_prime:15, auto_disqualify:true, criteria:['MCA annual filings current','FEMA compliance documented (ODI/FDI flows)','SEZ/IT park obligations met (if applicable)','Labour law compliance confirmed (EPFO, ESIC, Shops Act)','Parent-country regulations mapped and addressed','Sector-specific compliance (IRDAI, SEBI, RBI as applicable)','Export control compliance (if technology transfer involved)'] },
    { id:'D6', name:'AI and Digital Readiness', weight_ready:10, weight_certified:11, weight_prime:13, auto_disqualify:false, criteria:['AI adoption roadmap documented','Responsible AI policy in place','Automation initiatives active with measurable outcomes','Digital skills programme for employees','AI governance committee or owner designated','Data quality standards for AI and ML use cases'] },
    { id:'D7', name:'Business Continuity (Captive)', weight_ready:9, weight_certified:10, weight_prime:10, auto_disqualify:false, criteria:['BCP documented and tested annually','DR site or cloud failover operational','Crisis management protocol defined','Key person dependency risk mitigated','Vendor concentration risk assessed','Insurance coverage adequate and current'] },
    { id:'D8', name:'Innovation and Value Contribution', weight_ready:9, weight_certified:8, weight_prime:23, auto_disqualify:false, criteria:['Innovation charter or mandate from parent','Patents filed or granted from India operations','Products or platforms owned or co-owned by India team','Global leadership roles held by GCC employees','R&D spend tracked and reported','Innovation outcomes presented to parent board annually','Collaboration with Indian academia or startups'] }
  ],
  certification_levels: [
    { id:'L1', badge:'INDUS READY', target:'New GCCs (0 to 2 years)', mode:'Self-assessment with platform verification', validity:'1 year', onsite:false, fee_inr_lakhs_min:1.5, fee_inr_lakhs_max:2.5 },
    { id:'L2', badge:'INDUS CERTIFIED', target:'Established GCCs (2 to 5 years)', mode:'On-site assessment by accredited assessor', validity:'2 years', onsite:true, fee_inr_lakhs_min:3.5, fee_inr_lakhs_max:5 },
    { id:'L3', badge:'INDUS PRIME', target:'Mega GCCs (5,000+ employees) and global R&D hubs', mode:'Full independent audit, board-level review', validity:'3 years', onsite:true, fee_inr_lakhs_min:7, fee_inr_lakhs_max:10 }
  ],
  certification_process: [
    { step:1, name:'Application Submission', duration_days:3 },
    { step:2, name:'Eligibility Review', duration_days:5 },
    { step:3, name:'Document Upload and Verification', duration_days:10 },
    { step:4, name:'Assessor Assignment', duration_days:3 },
    { step:5, name:'On-site Assessment', duration_days:10 },
    { step:6, name:'Assessment Report and Score', duration_days:7 },
    { step:7, name:'Certification Decision and Badge Issuance', duration_days:5 }
  ],
  assessment_fees: {
    fee_split: { assessor_percent:60, indus_board_percent:30, pithonix_ai_percent:10 },
    levels: [
      { level:'INDUS READY', fee_inr_lakhs_min:1.5, fee_inr_lakhs_max:2.5 },
      { level:'INDUS CERTIFIED', fee_inr_lakhs_min:3.5, fee_inr_lakhs_max:5 },
      { level:'INDUS PRIME', fee_inr_lakhs_min:7, fee_inr_lakhs_max:10 }
    ]
  },
  implementation_plan: [
    { month_range:'1 to 2', milestone:'Government Validation' },
    { month_range:'2 to 4', milestone:'Assessor Accreditation Programme' },
    { month_range:'4 to 6', milestone:'Pilot Cohort' },
    { month_range:'6 to 8', milestone:'Framework Refinement' },
    { month_range:'8 to 10', milestone:'INDUS Registry Launch' },
    { month_range:'10 to 12', milestone:'Formal Publication' },
    { month_range:'12+', milestone:'State Integration and Global Pathway' }
  ],
  full_text: 'INDUS: Integrated National Digital Unified Standard for Global Capability Centres. Version 1.0, May 2026. IP owned by PITHONIX AI INDIA PRIVATE LIMITED (CIN: U62090TS2026PTC213220). 8 domains, 3 certification levels (INDUS READY, INDUS CERTIFIED, INDUS PRIME). D5 auto-disqualification domain. D8 most heavily weighted in INDUS Prime (23%). Fee split: 60% assessor, 30% INDUS Board, 10% Pithonix AI. Submitted to Government of Telangana for MoU and endorsement.'
};

async function seedIndusIfNeeded(client) {
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS indus_framework (
        id SERIAL PRIMARY KEY,
        version TEXT NOT NULL DEFAULT '1.0',
        status TEXT NOT NULL DEFAULT 'draft',
        submitted_to TEXT, submitted_date TEXT,
        ip_owner TEXT, governance_authority TEXT, cin TEXT,
        domains JSONB, certification_levels JSONB,
        certification_process JSONB, assessment_fees JSONB,
        implementation_plan JSONB, full_text TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    const check = await client.query('SELECT COUNT(*) FROM indus_framework');
    if (parseInt(check.rows[0].count) === 0) {
      await client.query(
        `INSERT INTO indus_framework
          (version,status,submitted_to,submitted_date,ip_owner,governance_authority,cin,
           domains,certification_levels,certification_process,assessment_fees,implementation_plan,full_text)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          INDUS_V1.version, INDUS_V1.status, INDUS_V1.submitted_to, INDUS_V1.submitted_date,
          INDUS_V1.ip_owner, INDUS_V1.governance_authority, INDUS_V1.cin,
          JSON.stringify(INDUS_V1.domains), JSON.stringify(INDUS_V1.certification_levels),
          JSON.stringify(INDUS_V1.certification_process), JSON.stringify(INDUS_V1.assessment_fees),
          JSON.stringify(INDUS_V1.implementation_plan), INDUS_V1.full_text
        ]
      );
    }
  } catch(e) {
    // Non-blocking — INDUS seeding failure never affects partner list response
    console.error('INDUS seed error:', e.message);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'GET only' }); return; }

  if (!process.env.DATABASE_URL) {
    res.status(200).json({ partners: [] }); return;
  }

  try {
    const client = await getPool().connect();
    try {
      const result = await client.query(`
        SELECT id, company_name, partner_category, partner_tier, cities, description, website, approved_at
        FROM gcc_partner_applications
        WHERE status = 'Approved'
        ORDER BY approved_at ASC
      `);
      res.status(200).json({ partners: result.rows });
      // Seed INDUS table in background after response is sent
      seedIndusIfNeeded(client);
    } catch(qe) {
      client.release();
      throw qe;
    }
  } catch(e) {
    console.error('DB error:', e.message);
    res.status(200).json({ partners: [] });
  }
}
