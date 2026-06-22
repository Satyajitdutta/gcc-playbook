// Pithonix GCC Playbook — Public Blog API
// GET /api/blog          — list published posts (most recent first)
// GET /api/blog?slug=x   — single published post by slug

import pg from 'pg';
const { Pool } = pg;
let pool;
function getPool() {
  if (!pool) pool = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
  return pool;
}

async function ensureTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS gcc_blog_posts (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      excerpt TEXT,
      content TEXT,
      linkedin_copy TEXT,
      tags TEXT[],
      status TEXT DEFAULT 'draft',
      scheduled_at TIMESTAMPTZ,
      published_at TIMESTAMPTZ,
      created_by TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const client = await getPool().connect();
  try {
    await ensureTable(client);
    const slug = req.query && req.query.slug;
    if (slug) {
      const r = await client.query(
        `SELECT id, title, slug, excerpt, content, tags, published_at FROM gcc_blog_posts WHERE slug=$1 AND status='published'`,
        [slug]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json({ post: r.rows[0] });
    }
    const r = await client.query(
      `SELECT id, title, slug, excerpt, tags, published_at FROM gcc_blog_posts WHERE status='published' ORDER BY published_at DESC LIMIT 20`
    );
    return res.status(200).json({ posts: r.rows });
  } catch (e) {
    console.error('blog error:', e.message);
    return res.status(500).json({ error: 'Request failed' });
  } finally {
    client.release();
  }
}
