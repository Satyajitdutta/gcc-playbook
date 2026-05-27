// Pithonix GCC Playbook — INDUS Certification Framework storage and retrieval
// Stores the full INDUS framework in Neon DB for future enhancement post-MoU

import pg from 'pg';

const { Pool } = pg;
let pool;
function getPool() {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
  return pool;
}

async function ensureTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS indus_framework (
      id SERIAL PRIMARY KEY,
      version TEXT NOT NULL DEFAULT '1.0',
      status TEXT NOT NULL DEFAULT 'draft',
      submitted_to TEXT,
      submitted_date TEXT,
      ip_owner TEXT,
      governance_authority TEXT,
      cin TEXT,
      domains JSONB,
      certification_levels JSONB,
      certification_process JSONB,
      assessment_fees JSONB,
      implementation_plan JSONB,
      full_text TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

const INDUS_V1 = {
  version: '1.0',
  status: 'draft',
  submitted_to: 'Government of Telangana',
  submitted_date: 'May 2026',
  ip_owner: 'PITHONIX AI INDIA PRIVATE LIMITED',
  governance_authority: 'INDUS Board (Government of Telangana endorsement authority)',
  cin: 'U62090TS2026PTC213220',
  domains: [
    {
      id: 'D1',
      name: 'Governance Alignment',
      description: 'Assesses whether the GCC has a clearly defined governance structure that aligns with the parent company mandate, local regulatory obligations, and Indian statutory requirements. Covers board composition, delegation of authority, fiduciary accountability, and reporting integrity.',
      weight_ready: 12,
      weight_certified: 12,
      weight_prime: 10,
      criteria: [
        'Board and governance structure documented',
        'Delegation of authority matrix defined',
        'Regulatory filings current (ROC, RBI, FEMA)',
        'Internal audit function operational',
        'Stakeholder reporting cadence established'
      ]
    },
    {
      id: 'D2',
      name: 'Cross-Border Data Integrity',
      description: 'Evaluates the GCC\'s ability to manage, protect, and govern data that flows between India operations and the parent entity or third parties across jurisdictions. Covers DPDPA 2023 compliance, data localisation, encryption standards, and cross-border transfer agreements.',
      weight_ready: 15,
      weight_certified: 15,
      weight_prime: 14,
      criteria: [
        'DPDPA 2023 compliance framework in place',
        'Data classification policy documented',
        'Cross-border data transfer agreements signed',
        'Encryption standards (AES-256 minimum) enforced',
        'Data localisation requirements mapped and met',
        'Data breach response plan tested'
      ]
    },
    {
      id: 'D3',
      name: 'Talent Ecosystem Maturity',
      description: 'Measures the depth, stability, and strategic value of the GCC\'s talent engine. Covers attrition management, career architecture, local talent development, leadership pipeline, and workforce planning aligned to GCC growth.',
      weight_ready: 14,
      weight_certified: 13,
      weight_prime: 12,
      criteria: [
        'Attrition rate below sector benchmark',
        'Career architecture and levelling framework documented',
        'Leadership pipeline programme operational',
        'Local talent development initiatives active',
        'Workforce plan tied to 3-year GCC roadmap',
        'Diversity and inclusion metrics tracked'
      ]
    },
    {
      id: 'D4',
      name: 'Operational Integration',
      description: 'Assesses how deeply the GCC is embedded into the parent organisation\'s operational workflows. Covers SLA adherence, process ownership, technology integration, and the degree to which the GCC operates as a genuine capability centre rather than a cost-arbitrage unit.',
      weight_ready: 13,
      weight_certified: 14,
      weight_prime: 13,
      criteria: [
        'SLAs defined and tracked for all major functions',
        'Process ownership documented end-to-end',
        'Technology stack integrated with parent systems',
        'Quality management system operational',
        'Continuous improvement programme active',
        'Knowledge management framework in place'
      ]
    },
    {
      id: 'D5',
      name: 'Regulatory Multi-Jurisdiction',
      description: 'Evaluates the GCC\'s compliance posture across all applicable jurisdictions including India (MCA, RBI, SEBI, SEZ/IT Act, labour law), parent country regulations (GDPR, SOX, CCPA where applicable), and sector-specific obligations. This domain carries automatic disqualification: a Non-Compliant finding on ANY single criterion in D5 results in immediate assessment failure regardless of scores in other domains.',
      weight_ready: 18,
      weight_certified: 17,
      weight_prime: 15,
      auto_disqualify: true,
      criteria: [
        'MCA annual filings current',
        'FEMA compliance documented (ODI/FDI flows)',
        'SEZ/IT park obligations met (if applicable)',
        'Labour law compliance confirmed (EPFO, ESIC, Shops Act)',
        'Parent-country regulations mapped and addressed',
        'Sector-specific compliance (IRDAI, SEBI, RBI as applicable)',
        'Export control compliance (if technology transfer involved)'
      ]
    },
    {
      id: 'D6',
      name: 'AI and Digital Readiness',
      description: 'Measures the GCC\'s adoption of AI, automation, and digital tools to deliver value beyond cost reduction. Covers AI governance, responsible AI practices, digital capability building, and the GCC\'s role in the parent\'s digital transformation.',
      weight_ready: 10,
      weight_certified: 11,
      weight_prime: 13,
      criteria: [
        'AI adoption roadmap documented',
        'Responsible AI policy in place',
        'Automation initiatives active with measurable outcomes',
        'Digital skills programme for employees',
        'AI governance committee or owner designated',
        'Data quality standards for AI/ML use cases'
      ]
    },
    {
      id: 'D7',
      name: 'Business Continuity (Captive)',
      description: 'Assesses the GCC\'s resilience against operational disruption, covering BCP/DR planning, crisis management, redundancy architecture, and tested recovery capabilities tailored to a captive entity that serves as the parent\'s operational backbone.',
      weight_ready: 9,
      weight_certified: 10,
      weight_prime: 10,
      criteria: [
        'BCP documented and tested annually',
        'DR site or cloud failover operational',
        'Crisis management protocol defined',
        'Key person dependency risk mitigated',
        'Vendor concentration risk assessed',
        'Insurance coverage adequate and current'
      ]
    },
    {
      id: 'D8',
      name: 'Innovation and Value Contribution',
      description: 'Evaluates the GCC\'s strategic contribution beyond its original mandate. Covers IP creation, patents, product/platform ownership, global leadership roles held by India team members, and measurable innovation outcomes. This is the most heavily weighted domain in INDUS Prime, distinguishing true Centres of Excellence from high-function delivery centres.',
      weight_ready: 9,
      weight_certified: 8,
      weight_prime: 23,
      criteria: [
        'Innovation charter or mandate from parent',
        'Patents filed or granted from India operations',
        'Products or platforms owned or co-owned by India team',
        'Global leadership roles held by GCC employees',
        'R&D spend tracked and reported',
        'Innovation outcomes presented to parent board annually',
        'Collaboration with Indian academia or startups'
      ]
    }
  ],
  certification_levels: [
    {
      id: 'L1',
      badge: 'INDUS READY',
      target: 'New GCCs (0 to 2 years old) or GCCs beginning their formalisation journey',
      mode: 'Self-assessment with Pithonix AI platform verification',
      validity: '1 year',
      onsite: false,
      description: 'Entry-level certification confirming the GCC has its foundational governance, compliance, and operational structures in place. Primarily self-assessed through the INDUS digital platform with automated verification where possible.',
      fee_range_inr_lakhs: { min: 1.5, max: 2.5 }
    },
    {
      id: 'L2',
      badge: 'INDUS CERTIFIED',
      target: 'Established GCCs (2 to 5 years) with operational maturity',
      mode: 'On-site assessment by INDUS-accredited assessors',
      validity: '2 years',
      onsite: true,
      description: 'Mid-tier certification confirming the GCC operates with full regulatory compliance, embedded process maturity, and a demonstrable talent development engine. Requires on-site assessment by an INDUS-accredited firm.',
      fee_range_inr_lakhs: { min: 3.5, max: 5 }
    },
    {
      id: 'L3',
      badge: 'INDUS PRIME',
      target: 'Mega GCCs (5,000+ employees) and global R&D hubs demonstrating Centre of Excellence status',
      mode: 'Full independent audit, board-level review',
      validity: '3 years',
      onsite: true,
      description: 'The highest tier. Confirms the GCC has transcended cost arbitrage and operates as a genuine Centre of Excellence with IP creation, global leadership roles, and measurable strategic innovation contribution. Full independent audit with board-level review. Industry benchmark designation.',
      fee_range_inr_lakhs: { min: 7, max: 10 }
    }
  ],
  certification_process: [
    { step: 1, name: 'Application Submission', duration_days: 3, description: 'GCC submits application via INDUS digital platform with company details, current certifications, headcount, and self-declared domain scores.' },
    { step: 2, name: 'Eligibility Review', duration_days: 5, description: 'INDUS Board secretariat reviews application for completeness and assigns appropriate certification level based on GCC age, size, and declared maturity.' },
    { step: 3, name: 'Document Upload and Verification', duration_days: 10, description: 'GCC uploads supporting documentation for all 8 domains. Platform performs automated checks on regulatory filing dates, SLA templates, and policy documents.' },
    { step: 4, name: 'Assessor Assignment', duration_days: 3, description: 'For INDUS Certified and INDUS Prime, an accredited assessor firm is assigned. GCC confirms assessor within 5 business days.' },
    { step: 5, name: 'On-site Assessment', duration_days: 10, description: 'Assessor conducts on-site review across all 8 domains. Structured interviews with GCC leadership, functional heads, and HR. Document verification and process walkthroughs.' },
    { step: 6, name: 'Assessment Report and Score', duration_days: 7, description: 'Assessor submits domain-by-domain scores and narrative report. GCC receives preliminary scores and has 5 days to submit factual corrections only.' },
    { step: 7, name: 'Certification Decision and Badge Issuance', duration_days: 5, description: 'INDUS Board reviews report, issues final certification decision. Digital badge issued within 2 business days. Physical plaque dispatched within 15 days.' }
  ],
  assessment_fees: {
    fee_split: {
      assessor_percent: 60,
      indus_board_percent: 30,
      pithonix_ai_percent: 10
    },
    levels: [
      { level: 'INDUS READY', fee_inr_lakhs_min: 1.5, fee_inr_lakhs_max: 2.5, notes: 'Self-assessment; lower end for GCCs under 500 employees' },
      { level: 'INDUS CERTIFIED', fee_inr_lakhs_min: 3.5, fee_inr_lakhs_max: 5, notes: 'On-site assessment included; higher end for multi-city GCCs' },
      { level: 'INDUS PRIME', fee_inr_lakhs_min: 7, fee_inr_lakhs_max: 10, notes: 'Full audit; price includes board-level review session' }
    ],
    notes: 'Fees are annual certification maintenance fees. Initial assessment may carry a one-time assessor mobilisation charge of Rs 50,000 to Rs 1,50,000 depending on location and GCC size.'
  },
  implementation_plan: [
    { month_range: '1 to 2', milestone: 'Government Validation', description: 'MoU signing with Government of Telangana. INDUS Board constituted with government, NASSCOM, and CII representation.' },
    { month_range: '2 to 4', milestone: 'Assessor Accreditation Programme', description: 'First cohort of INDUS-accredited assessor firms trained and certified. Assessment methodology documented and published.' },
    { month_range: '4 to 6', milestone: 'Pilot Cohort', description: '10 to 15 GCCs participate in pilot assessments across all three levels. Framework calibrated based on real-world findings.' },
    { month_range: '6 to 8', milestone: 'Framework Refinement', description: 'Pilot feedback incorporated. Domain weightings validated. D5 auto-disqualification criteria stress-tested.' },
    { month_range: '8 to 10', milestone: 'INDUS Registry Launch', description: 'Public INDUS Registry live at gcc-playbook.pithonix.ai/indus-registry. First certified GCCs listed.' },
    { month_range: '10 to 12', milestone: 'Formal Publication', description: 'Publication via BIS or NASSCOM. Auditor accreditation programme fully launched. First official INDUS certifications issued at scale.' },
    { month_range: '12+', milestone: 'State Integration and Global Pathway', description: 'Other state GCC policy integration. Engagement with ISO/TC for potential global GCC standard based on INDUS.' }
  ]
};

const FULL_TEXT = `INDUS: Integrated National Digital Unified Standard for Global Capability Centres
Full Certification and Assessment Framework — Government Validation Draft
Submitted to: Government of Telangana | Date: May 2026 | Version: 1.0
Confidential — Not for Distribution Without Pithonix AI Written Consent

INTELLECTUAL PROPERTY
IP owned by: PITHONIX AI INDIA PRIVATE LIMITED (CIN: U62090TS2026PTC213220)
Government of Telangana holds governance and endorsement authority through the INDUS Board.
Commercial licensing required for adoption by other states or bodies.

EXECUTIVE SUMMARY
INDUS is India's first GCC-specific certification framework. It replaces the patchwork of ISO 9001, ISO 27001, SOC 2, and regional standards with a single unified standard designed specifically for Global Capability Centres operating in India. Eight assessment domains cover governance alignment, cross-border data integrity, talent ecosystem maturity, operational integration, multi-jurisdiction compliance, AI readiness, business continuity, and innovation contribution.

Three certification levels serve GCCs at every stage of maturity: INDUS READY (new GCCs, self-assessment), INDUS CERTIFIED (established GCCs, on-site), and INDUS PRIME (mega GCCs, full audit). Assessment fees range from Rs 1.5 to 10 Lakhs depending on level.

DOMAIN D5 CRITICAL NOTE
D5 (Regulatory Multi-Jurisdiction) carries automatic disqualification. A Non-Compliant finding on ANY single criterion in D5 results in immediate assessment failure regardless of scores in other domains.

D8 PRIME WEIGHTING
D8 (Innovation and Value Contribution) is the most heavily weighted domain in INDUS Prime (23% vs 9% in INDUS Ready), distinguishing genuine Centres of Excellence from high-function delivery centres.

PITHONIX ROLE
Pithonix AI serves as the technical architect and digital infrastructure provider for INDUS. The GOT (Graph of Thought) engine reasons across 8 domains for GCC decision-making, mapping directly to the INDUS assessment framework. JEET ERP serves as the continuous compliance monitoring layer for INDUS-certified GCCs.

Pithonix does not seek to own the standard. Standards must be industry-governed and publicly accessible to gain trust and adoption. Pithonix provides the technology that makes INDUS practical, scalable, and digitally native from day one.

INDUS PUBLIC REGISTRY
Public registry of certified GCCs to be hosted at: gcc-playbook.pithonix.ai/indus-registry`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const client = await getPool().connect();
  try {
    await ensureTable(client);

    if (req.method === 'GET') {
      const result = await client.query(
        'SELECT * FROM indus_framework ORDER BY created_at DESC LIMIT 1'
      );

      if (result.rows.length === 0) {
        // Seed v1.0 on first GET
        await client.query(
          `INSERT INTO indus_framework
            (version, status, submitted_to, submitted_date, ip_owner, governance_authority, cin,
             domains, certification_levels, certification_process, assessment_fees, implementation_plan, full_text)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            INDUS_V1.version,
            INDUS_V1.status,
            INDUS_V1.submitted_to,
            INDUS_V1.submitted_date,
            INDUS_V1.ip_owner,
            INDUS_V1.governance_authority,
            INDUS_V1.cin,
            JSON.stringify(INDUS_V1.domains),
            JSON.stringify(INDUS_V1.certification_levels),
            JSON.stringify(INDUS_V1.certification_process),
            JSON.stringify(INDUS_V1.assessment_fees),
            JSON.stringify(INDUS_V1.implementation_plan),
            FULL_TEXT
          ]
        );
        const seeded = await client.query('SELECT * FROM indus_framework ORDER BY created_at DESC LIMIT 1');
        return res.status(200).json({ success: true, seeded: true, data: seeded.rows[0] });
      }

      return res.status(200).json({ success: true, data: result.rows[0] });
    }

    // POST — update specific sections (token-protected for future MoU enhancements)
    if (req.method === 'POST') {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace('Bearer ', '');
      if (token !== process.env.INDUS_ADMIN_TOKEN) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { section, value, version } = req.body;
      const allowed = ['domains', 'certification_levels', 'certification_process', 'assessment_fees', 'implementation_plan', 'status', 'full_text'];
      if (!allowed.includes(section)) {
        return res.status(400).json({ error: 'Invalid section' });
      }

      await client.query(
        `UPDATE indus_framework SET ${section} = $1, version = COALESCE($2, version), updated_at = NOW()
         WHERE id = (SELECT id FROM indus_framework ORDER BY created_at DESC LIMIT 1)`,
        [typeof value === 'string' ? value : JSON.stringify(value), version || null]
      );

      return res.status(200).json({ success: true, message: `Section '${section}' updated.` });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('INDUS framework error:', err);
    return res.status(500).json({ error: 'Server error', detail: err.message });
  } finally {
    client.release();
  }
}
