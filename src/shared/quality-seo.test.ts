import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PAGE_METADATA } from '../utils/usePageMetadata.ts';

test('SEO & Titles: Every registered page has unique and branded title in format "Page Name | DOCUAGENT AI"', () => {
  const titles = Object.values(PAGE_METADATA).map((m) => m.title);
  const uniqueTitles = new Set(titles);

  // Must be strictly unique across all views
  assert.equal(uniqueTitles.size, titles.length, 'Every page title must be unique');

  for (const [key, meta] of Object.entries(PAGE_METADATA)) {
    assert.ok(
      meta.title.includes('DOCUAGENT AI'),
      `Page "${key}" title must include brand "DOCUAGENT AI" (got: "${meta.title}")`
    );
    assert.match(
      meta.title,
      /^[A-Za-z0-9\s·&,–-]+ \| DOCUAGENT AI$/,
      `Page "${key}" title must match "Page Name | DOCUAGENT AI" pattern (got: "${meta.title}")`
    );
  }
});

test('SEO & Meta Descriptions: Every registered page has concise, meaningful, non-empty description', () => {
  const descriptions = Object.values(PAGE_METADATA).map((m) => m.description);
  const uniqueDesc = new Set(descriptions);

  // Must be unique per page (no repeated descriptions everywhere)
  assert.equal(uniqueDesc.size, descriptions.length, 'Page descriptions must be unique per view');

  for (const [key, meta] of Object.entries(PAGE_METADATA)) {
    assert.ok(
      meta.description.length >= 80 && meta.description.length <= 170,
      `Page "${key}" meta description length should be concise between 80 and 170 chars (got: ${meta.description.length})`
    );
    // Anti-slop / anti-exaggeration check: no claims of guaranteed 100% fraud immunity
    assert.doesNotMatch(
      meta.description.toLowerCase(),
      /guaranteed accuracy|100% fraud prevention|certified compliant/i,
      `Page "${key}" must not make exaggerated or false accuracy claims`
    );
  }
});

test('Image Assets: All declared logo, webp, and favicon assets exist and are optimized', () => {
  const requiredPublicAssets = [
    'public/docuagent-logo.png',
    'public/docuagent-logo.webp',
    'public/favicon.svg',
    'public/favicon.png',
    'public/favicon-32x32.png',
    'public/favicon.ico'
  ];

  for (const relPath of requiredPublicAssets) {
    const fullPath = path.resolve(process.cwd(), relPath);
    assert.ok(fs.existsSync(fullPath), `Asset "${relPath}" must exist on disk`);
    const stat = fs.statSync(fullPath);
    assert.ok(stat.size > 100, `Asset "${relPath}" must not be empty (size: ${stat.size} bytes)`);
  }

  // WebP must be significantly smaller than original uncompressed PNG
  const pngSize = fs.statSync(path.resolve(process.cwd(), 'public/docuagent-logo.png')).size;
  const webpSize = fs.statSync(path.resolve(process.cwd(), 'public/docuagent-logo.webp')).size;
  assert.ok(webpSize < pngSize, 'WebP asset must achieve compression savings over PNG');
});

test('Content Quality: No unfinished placeholder brackets remain in policy views', () => {
  const filesToCheck = [
    'src/components/CookiePolicyView.tsx',
    'src/components/DpdpReadinessView.tsx',
    'src/components/PrivacyPolicyView.tsx',
    'src/components/TermsView.tsx',
    'src/components/DataCollectionPrivacyView.tsx'
  ];

  for (const f of filesToCheck) {
    const content = fs.readFileSync(path.resolve(process.cwd(), f), 'utf-8');
    assert.doesNotMatch(
      content,
      /\[privacy@organization-domain\.example\]/,
      `File ${f} must not contain bracketed privacy email placeholder`
    );
    assert.doesNotMatch(
      content,
      /\[grievance-officer@organization-domain\.example\]/,
      `File ${f} must not contain bracketed grievance email placeholder`
    );
    assert.doesNotMatch(
      content,
      /Lorem ipsum/i,
      `File ${f} must not contain dummy lorem ipsum text`
    );
  }
});

test('Legal Compliance: TermsView contains all 20 required sections and disclaims consumer subscriptions', () => {
  const content = fs.readFileSync(path.resolve(process.cwd(), 'src/components/TermsView.tsx'), 'utf-8');

  // Verify key required sections
  const requiredSectionNumbers = Array.from({ length: 20 }, (_, i) => `${i + 1}.`);
  for (const secNum of requiredSectionNumbers) {
    assert.ok(
      content.includes(secNum),
      `Terms of Use must include numbered Section ${secNum}`
    );
  }

  // Verify explicit disclosure that no retail subscriptions or payment checkouts apply
  assert.match(
    content,
    /Subscription Terms Notice/i,
    'Terms of Use must contain Section 20 regarding Non-Applicability of Retail Subscriptions'
  );
  assert.match(
    content,
    /NO retail recurring subscriptions, paid consumer tiers, or credit card checkouts/i
  );

  // Verify human-in-the-loop and assistive AI decision support disclosures
  assert.match(content, /assistive decision-support/i);
  assert.match(content, /human reviewer/i);
});

test('Data Transparency: DataCollectionPrivacyView documents all 10 verified data categories', () => {
  const content = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/DataCollectionPrivacyView.tsx'),
    'utf-8'
  );

  const verifiedCategories = [
    'Account & Authentication Information',
    'Uploaded Identity Documents & Files',
    'Extracted Text & OCR Tokens',
    'Document Metadata & Validation Results',
    'User-Submitted Form Information & Corrections',
    'Reviewer Decisions & Routing History',
    'Security & Audit Logs',
    'Cookie & Consent Preferences',
    'Technical Telemetry & Connection Data',
    'Information Shared with Third-Party Providers'
  ];

  for (const cat of verifiedCategories) {
    assert.ok(
      content.includes(cat),
      `Data Collection Inventory must include verified category "${cat}"`
    );
  }

  // Verify encryption and retention lifecycle statements
  assert.match(content, /AES-256-GCM/i);
  assert.match(content, /90-day/i);
  assert.match(content, /Google Gemini/i);
});

test('Version Synchronization: package.json version matches shared APP_VERSION', () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf-8'));
  const versionFile = fs.readFileSync(path.resolve(process.cwd(), 'src/shared/version.ts'), 'utf-8');

  assert.equal(pkg.version, '1.0.0', 'package.json must be version 1.0.0');
  assert.match(versionFile, /export const APP_VERSION = 'v1\.0\.0';/, 'APP_VERSION must be v1.0.0');
});

test('Footer Redesign: App.tsx has 3 distinct sections (Brand, Product & Resources, Legal & Compliance) and bottom bar', () => {
  const appContent = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf-8');

  // Section A: Brand
  assert.match(appContent, /DOCUAGENT AI/);
  assert.match(appContent, /AI-powered document review and routing\./);
  assert.match(appContent, /Assistive AI decision support with authorized human review\./);

  // Section B: Product & Resources
  assert.match(appContent, /Product &amp; Resources/);
  assert.match(appContent, />\s*Dashboard\s*</);
  assert.match(appContent, />\s*Document Review &amp; Routing Agent\s*</);
  assert.match(appContent, />\s*Data Collection &amp; Privacy\s*</);
  assert.match(appContent, />\s*Architecture Risk Report\s*</);

  // Section C: Legal & Compliance
  assert.match(appContent, /Legal &amp; Compliance/);
  assert.match(appContent, />\s*Privacy Policy\s*</);
  assert.match(appContent, />\s*Cookie &amp; Storage Policy\s*</);
  assert.match(appContent, />\s*Cookie Preferences\s*</);
  assert.match(appContent, />\s*Terms of Use\s*</);
  assert.match(appContent, />\s*DPDP Readiness\s*</);
  assert.match(appContent, />\s*Legal Launch Checklist\s*</);

  // Bottom Bar
  assert.match(appContent, /APP_VERSION/);
  assert.match(appContent, /AI-assisted results require authorized human review\./);
});

test('Document Scanner Experience: No hardcoded 42% or noisy HUD clutter', () => {
  const scannerContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/DocumentScanningAnimation.tsx'),
    'utf-8'
  );

  // Ensure no hardcoded 42% formula or static stuck percentages
  assert.doesNotMatch(scannerContent, /Math\.min\(Math\.round\(\(\(currentStageIndex \+ 0\.5\)/);
  // Ensure noisy arcade HUD markers were removed
  assert.doesNotMatch(scannerContent, /DOC_INSPECTION_MODE/);
  assert.doesNotMatch(scannerContent, /STREAM::PDF/);
  assert.doesNotMatch(scannerContent, /scanline-pattern/);
});

test('Homepage SEO: index.html and PAGE_METADATA have exact required title, description, canonical, and robots', () => {
  const indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');

  // Exact HTML title
  assert.match(
    indexHtml,
    /<title>AI Document Review &amp; Screening \| DOCUAGENT AI<\/title>|<title>AI Document Review & Screening \| DOCUAGENT AI<\/title>/
  );
  assert.equal(PAGE_METADATA.home.title, 'AI Document Review & Screening | DOCUAGENT AI');

  // Exact meta description
  const exactDesc =
    'Review and route documents with DOCUAGENT AI. Organize identity and document screening, human review queues, and auditable decisions in one workflow.';
  assert.ok(indexHtml.includes(exactDesc), 'index.html must include exact meta description');
  assert.equal(PAGE_METADATA.home.description, exactDesc);

  // Canonical tag
  assert.match(indexHtml, /<link rel="canonical" href="https:\/\/docuagent-ai\.ai\.studio\/" \/>/);

  // Robots indexing tag
  assert.match(indexHtml, /<meta name="robots" content="index, follow" \/>/);

  // Exactly one H1 in index.html
  const h1Matches = indexHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi);
  assert.equal(h1Matches?.length, 1, 'index.html must have exactly one H1 tag');
  assert.match(h1Matches![0], /AI Document Review, Screening &amp; Routing in One Workflow|AI Document Review, Screening & Routing in One Workflow/);
});

test('Public Landing Page: LandingPageView.tsx contains all 7 required marketing sections', () => {
  const landingContent = fs.readFileSync(
    path.resolve(process.cwd(), 'src/components/LandingPageView.tsx'),
    'utf-8'
  );

  // Exactly one H1 tag
  const h1Matches = landingContent.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi);
  assert.equal(h1Matches?.length, 1, 'LandingPageView must have exactly one H1 tag');
  assert.match(h1Matches![0], /AI Document Review, Screening &amp; Routing in One Workflow/);

  // Hero section and CTAs
  assert.match(landingContent, /Open Workspace/);
  assert.match(landingContent, /Explore Features/);

  // Capabilities section
  assert.match(landingContent, /Document Intake &amp; Classification|Document Intake & Classification/);
  assert.match(landingContent, /Identity &amp; Document Screening|Identity & Document Screening/);
  assert.match(landingContent, /Human Reviewer Queues &amp; Routing|Human Reviewer Queues & Routing/);
  assert.match(landingContent, /Audit Trails &amp; Decision History|Audit Trails & Decision History/);

  // 3-step workflow
  assert.match(landingContent, /Submit Intake Document/);
  assert.match(landingContent, /Screen &amp; Inspect Findings|Screen & Inspect Findings/);
  assert.match(landingContent, /Human Review &amp; Auditable Sign-Off|Human Review & Auditable Sign-Off/);

  // Supported document schemas (Key use cases)
  assert.match(landingContent, /Passports/);
  assert.match(landingContent, /Driver Licenses/);
  assert.match(landingContent, /Bank Statements/);
  assert.match(landingContent, /Utility Bills/);
  assert.match(landingContent, /General Documents/);

  // Trust, privacy and human oversight
  assert.match(landingContent, /Trust, Privacy, and Human Oversight/);
  assert.match(landingContent, /90-day/i);
  assert.match(landingContent, /human review|human oversight/i);

  // FAQ section (5 required questions)
  assert.match(landingContent, /What is AI document review\?/);
  assert.match(landingContent, /How does DOCUAGENT AI support document screening\?/);
  assert.match(landingContent, /Can a reviewer inspect a case before making a decision\?/);
  assert.match(landingContent, /What information appears in the audit trail\?/);
  assert.match(landingContent, /Which document types are supported\?/);
});

test('Technical SEO: sitemap.xml and robots.txt exist and serve valid crawl rules', () => {
  const robotsTxt = fs.readFileSync(path.resolve(process.cwd(), 'public/robots.txt'), 'utf-8');
  assert.match(robotsTxt, /User-agent:\s*\*/);
  assert.match(robotsTxt, /Allow:\s*\/\s*$/m);
  assert.match(robotsTxt, /Sitemap:\s*https:\/\/docuagent-ai\.ai\.studio\/sitemap\.xml/);

  const sitemapXml = fs.readFileSync(path.resolve(process.cwd(), 'public/sitemap.xml'), 'utf-8');
  assert.match(sitemapXml, /<loc>https:\/\/docuagent-ai\.ai\.studio\/<\/loc>/);
  assert.match(sitemapXml, /<loc>https:\/\/docuagent-ai\.ai\.studio\/app<\/loc>/);

  // Verify private URLs are excluded from sitemap
  assert.doesNotMatch(sitemapXml, /CASE-/);
  assert.doesNotMatch(sitemapXml, /\/api\//);
  assert.doesNotMatch(sitemapXml, /diagnostics/);
});


