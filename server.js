const express = require('express');
const session = require('express-session');
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const crypto  = require('crypto');

const app  = express();
const PORT = process.env.PORT || 8000;

// ── Config (use env vars in production) ───────────────
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'zaraya';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '123456';
const WA_NUMBER      = process.env.WA_NUMBER      || '917090702416';

// ── Rate limiters (in-memory, reset on restart) ────────
function makeRateLimit(windowMs, max) {
  const map = new Map();
  setInterval(() => { const n = Date.now(); map.forEach((v, k) => { if (n > v.r) map.delete(k); }); }, windowMs).unref();
  return (ip) => {
    const now = Date.now();
    const e = map.get(ip);
    if (!e || now > e.r) { map.set(ip, { c: 1, r: now + windowMs }); return true; }
    if (e.c >= max) return false;
    e.c++;
    return true;
  };
}
const orderRateLimit = makeRateLimit(60 * 60 * 1000, 5);   // 5 orders / IP / hour
const loginRateLimit = makeRateLimit(15 * 60 * 1000, 10);  // 10 login attempts / IP / 15 min

// Constant-time string comparison (prevents timing attacks on login)
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// ── Data File ──────────────────────────────────────────
const DATA_FILE    = path.join(__dirname, 'data', 'products.json');
const UPLOAD_DIR   = path.join(__dirname, 'public', 'img', 'products');
const CATS_FILE    = path.join(__dirname, 'data', 'categories.json');
const CAT_DIR      = path.join(__dirname, 'public', 'img', 'categories');
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(CAT_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');
if (!fs.existsSync(CATS_FILE)) fs.writeFileSync(CATS_FILE, '{}', 'utf8');

// ── Multer (product image uploads) ────────────────────
// Both the MIME type AND the file extension must be an allowed image type —
// otherwise a renamed .html/.svg could be served from /public (stored XSS).
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
function imageFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype) && ALLOWED_EXT.has(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only jpg, png, webp or gif images are allowed'));
  }
}

const catUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, CAT_DIR),
    filename:    (req, file, cb) => {
      const ext  = path.extname(file.originalname).toLowerCase();
      const safe = (req.params.cat || 'cat').toLowerCase().replace(/[^a-z0-9]/g, '');
      cb(null, 'cat-' + safe + '-' + Date.now() + ext);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: imageFilter
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename:    (req, file, cb) => {
      const ext  = path.extname(file.originalname).toLowerCase();
      cb(null, Date.now() + '-' + crypto.randomBytes(6).toString('hex') + ext);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: imageFilter
});

// ── Middleware ─────────────────────────────────────────
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const IS_PROD = process.env.NODE_ENV === 'production';

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self' https://api.emailjs.com",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'"
  ].join('; '));
  if (IS_PROD) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Warn loudly if running in production with default credentials/secret
if (IS_PROD && (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET)) {
  console.warn('WARNING: ADMIN_PASSWORD and/or SESSION_SECRET are not set. The site is running with insecure defaults — set these environment variables in your hosting dashboard as soon as possible.');
}

app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  name: 'zaraya.sid',
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,
    sameSite: 'strict',
    secure: IS_PROD ? 'auto' : false
  }
}));

// ── SVG Jewel Helper (shared with EJS views) ───────────
function makeJewelSVG(cat, col) {
  const shapes = {
    Bracelets: `<ellipse cx="150" cy="175" rx="105" ry="42" stroke="#c9a84c" stroke-width="5" fill="none" opacity=".7"/>
                <ellipse cx="150" cy="175" rx="105" ry="42" stroke="#e0c878" stroke-width="1.5" fill="none" opacity=".9"/>
                <circle cx="150" cy="133" r="9" fill="#c9a84c"/>
                <polygon points="150,124 159,133 150,142 141,133" fill="#e0c878" opacity=".7"/>
                <circle cx="218" cy="157" r="5.5" fill="#c9a84c" opacity=".6"/>
                <circle cx="82" cy="157" r="5.5" fill="#c9a84c" opacity=".6"/>`,
    Necklaces: `<path d="M40 80 Q150 200 260 80" stroke="#c9a84c" stroke-width="2" fill="none" opacity=".7" stroke-dasharray="6 3"/>
                <polygon points="150,200 162,222 150,244 138,222" fill="#c9a84c" opacity=".9"/>
                <polygon points="150,208 159,222 150,236 141,222" fill="${col}"/>
                <circle cx="40" cy="80" r="6" fill="#c9a84c" opacity=".7"/>
                <circle cx="260" cy="80" r="6" fill="#c9a84c" opacity=".7"/>
                <circle cx="95" cy="160" r="4" fill="#c9a84c" opacity=".5"/>
                <circle cx="205" cy="160" r="4" fill="#c9a84c" opacity=".5"/>`,
    Earrings:  `<circle cx="95" cy="95" r="28" stroke="#c9a84c" stroke-width="2.5" fill="none" opacity=".8"/>
                <line x1="95" y1="123" x2="95" y2="145" stroke="#c9a84c" stroke-width="2" opacity=".7"/>
                <polygon points="95,145 107,170 95,195 83,170" fill="#c9a84c" opacity=".85"/>
                <circle cx="95" cy="67" r="6" fill="#c9a84c"/>
                <circle cx="205" cy="95" r="28" stroke="#c9a84c" stroke-width="2.5" fill="none" opacity=".8"/>
                <line x1="205" y1="123" x2="205" y2="145" stroke="#c9a84c" stroke-width="2" opacity=".7"/>
                <polygon points="205,145 217,170 205,195 193,170" fill="#c9a84c" opacity=".85"/>
                <circle cx="205" cy="67" r="6" fill="#c9a84c"/>`,
    Rings:     `<ellipse cx="150" cy="200" rx="70" ry="40" stroke="#c9a84c" stroke-width="9" fill="none" opacity=".65"/>
                <ellipse cx="150" cy="200" rx="70" ry="40" stroke="#e0c878" stroke-width="1.5" fill="none"/>
                <polygon points="150,80 178,120 150,140 122,120" fill="#c9a84c" opacity=".9"/>
                <polygon points="150,90 170,120 150,132 130,120" fill="${col}"/>
                <line x1="122" y1="120" x2="108" y2="168" stroke="#c9a84c" stroke-width="8" opacity=".6"/>
                <line x1="178" y1="120" x2="192" y2="168" stroke="#c9a84c" stroke-width="8" opacity=".6"/>`,
    Bangles:   `<ellipse cx="150" cy="150" rx="90" ry="90" stroke="#c9a84c" stroke-width="9" fill="none" opacity=".7"/>
                <ellipse cx="150" cy="150" rx="90" ry="90" stroke="#e0c878" stroke-width="2" fill="none" opacity=".9"/>
                <ellipse cx="150" cy="150" rx="72" ry="72" stroke="#c9a84c" stroke-width="4" fill="none" opacity=".3"/>
                <circle cx="150" cy="60" r="9" fill="#c9a84c"/>
                <polygon points="150,51 159,60 150,69 141,60" fill="#e0c878"/>
                <circle cx="240" cy="150" r="6" fill="#c9a84c" opacity=".7"/>
                <circle cx="60" cy="150" r="6" fill="#c9a84c" opacity=".7"/>`,
    Watches:   `<rect x="108" y="28" width="84" height="68" rx="10" fill="#c9a84c" opacity=".45"/>
                <rect x="108" y="204" width="84" height="68" rx="10" fill="#c9a84c" opacity=".45"/>
                <rect x="58" y="84" width="184" height="132" rx="28" stroke="#c9a84c" stroke-width="6" fill="none" opacity=".8"/>
                <rect x="66" y="92" width="168" height="116" rx="22" fill="rgba(201,168,76,.05)"/>
                <circle cx="150" cy="150" r="50" stroke="#c9a84c" stroke-width="1.5" fill="none" opacity=".75"/>
                <line x1="150" y1="102" x2="150" y2="114" stroke="#c9a84c" stroke-width="3" opacity=".8"/>
                <line x1="198" y1="150" x2="186" y2="150" stroke="#c9a84c" stroke-width="3" opacity=".8"/>
                <line x1="150" y1="198" x2="150" y2="186" stroke="#c9a84c" stroke-width="3" opacity=".8"/>
                <line x1="102" y1="150" x2="114" y2="150" stroke="#c9a84c" stroke-width="3" opacity=".8"/>
                <line x1="150" y1="150" x2="150" y2="124" stroke="#e0c878" stroke-width="3" stroke-linecap="round"/>
                <line x1="150" y1="150" x2="168" y2="138" stroke="#e0c878" stroke-width="2" stroke-linecap="round"/>
                <circle cx="150" cy="150" r="4.5" fill="#c9a84c"/>
                <rect x="240" y="144" width="14" height="18" rx="4" fill="#c9a84c" opacity=".65"/>`,
    default:   `<polygon points="150,50 178,100 240,100 195,140 210,195 150,162 90,195 105,140 60,100 122,100"
                  fill="none" stroke="#c9a84c" stroke-width="2" opacity=".85"/>
                <circle cx="150" cy="150" r="10" fill="#c9a84c" opacity=".7"/>
                <circle cx="150" cy="150" r="6" fill="#e0c878"/>`
  };
  const shape = shapes[cat] || shapes.default;
  return `<svg viewBox="0 0 300 300" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;display:block">
    <rect width="300" height="300" fill="${col}"/>
    <ellipse cx="150" cy="150" rx="130" ry="120" fill="rgba(201,168,76,.03)"/>
    ${shape}
    <text x="150" y="282" text-anchor="middle" fill="rgba(201,168,76,.15)" font-family="serif" font-size="8" letter-spacing="6">${cat.toUpperCase()}</text>
  </svg>`;
}

// Make jewel available inside EJS templates
app.locals.jewel = makeJewelSVG;

// ── Helpers ────────────────────────────────────────────
function readProducts() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch (e) { return []; }
}
function writeProducts(products) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2));
}
function readCatImages() {
  try { return JSON.parse(fs.readFileSync(CATS_FILE, 'utf8')); }
  catch { return {}; }
}
function saveCatImages(d) {
  fs.writeFileSync(CATS_FILE, JSON.stringify(d, null, 2));
}
// Delete a file referenced by a public URL path, refusing anything that
// resolves outside /public (defense-in-depth against path traversal)
function safeUnlinkPublic(relPath) {
  if (!relPath || typeof relPath !== 'string') return;
  const publicDir = path.join(__dirname, 'public');
  const full = path.resolve(publicDir, '.' + path.posix.normalize('/' + relPath));
  if (!full.startsWith(publicDir + path.sep)) return;
  fs.unlink(full, () => {});
}

// ── Auth guard for admin routes ────────────────────────
function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  res.redirect('/admin/login');
}

// ══════════════════════════════════════════════════════
//  STOREFRONT ROUTES
// ══════════════════════════════════════════════════════

// Home
app.get('/', (req, res) => {
  res.render('index', { catImages: readCatImages() });
});

// Shop – list products, filtered by category
app.get('/shop', (req, res) => {
  const cat  = req.query.cat  || 'All';
  const sort = req.query.sort || 'default';

  let products = readProducts().filter(p => p.visible);

  if (cat === 'Bestsellers') {
    products = products.filter(p => p.bestseller || p.badge === 'Bestseller');
  } else if (cat !== 'All') {
    products = products.filter(p => p.cat === cat);
  }

  if (sort === 'price-asc')  products.sort((a, b) => a.price - b.price);
  if (sort === 'price-desc') products.sort((a, b) => b.price - a.price);
  if (sort === 'name')       products.sort((a, b) => a.name.localeCompare(b.name));

  res.render('shop', { products, cat, sort });
});

// ══════════════════════════════════════════════════════
//  ADMIN AUTH ROUTES
// ══════════════════════════════════════════════════════

app.get('/admin/login', (req, res) => {
  if (req.session.admin) return res.redirect('/admin');
  res.render('admin/login', { error: null });
});

app.post('/admin/login', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!loginRateLimit(ip)) {
    return res.status(429).render('admin/login', { error: 'Too many login attempts. Please try again in 15 minutes.' });
  }
  const { username, password } = req.body;
  const userOk = safeEqual(username || '', ADMIN_USERNAME);
  const passOk = safeEqual(password || '', ADMIN_PASSWORD);
  if (userOk && passOk) {
    // Regenerate the session ID on privilege change (prevents session fixation)
    return req.session.regenerate(err => {
      if (err) return res.render('admin/login', { error: 'Something went wrong. Please try again.' });
      req.session.admin = true;
      res.redirect('/admin');
    });
  }
  res.status(401).render('admin/login', { error: 'Wrong username or password. Please try again.' });
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('zaraya.sid');
    res.redirect('/admin/login');
  });
});

// ══════════════════════════════════════════════════════
//  ADMIN DASHBOARD ROUTES  (all protected)
// ══════════════════════════════════════════════════════

// Overview
app.get('/admin', requireAdmin, (req, res) => {
  const products = readProducts();
  res.render('admin/dashboard', {
    products,
    total:      products.length,
    visible:    products.filter(p => p.visible).length,
    outOfStock: products.filter(p => !p.stock).length,
    hidden:     products.filter(p => !p.visible).length,
    page:       'overview'
  });
});

// Manage products
app.get('/admin/products', requireAdmin, (req, res) => {
  res.render('admin/products', { products: readProducts(), page: 'products' });
});

// Add product – form
app.get('/admin/add', requireAdmin, (req, res) => {
  res.render('admin/add', { page: 'add', success: false, error: null });
});

// Add product – save
app.post('/admin/products/add', requireAdmin, upload.single('image'), (req, res) => {
  const { name, cat, price, badge, stock, visible, bestseller, color } = req.body;
  const priceNum = parseFloat(price);
  if (!name || !String(name).trim() || !Number.isFinite(priceNum) || priceNum < 0) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.render('admin/add', { page: 'add', success: false, error: 'A name and a valid price are required.' });
  }
  const products = readProducts();
  products.unshift({
    id:         Date.now(),
    name:       String(name).trim(),
    cat:        cat        || 'Bracelets',
    price:      priceNum,
    badge:      badge      || '',
    stock:      stock      === 'on',
    visible:    visible    === 'on',
    bestseller: bestseller === 'on' || badge === 'Bestseller',
    color:      color      || '#0d3a2c',
    image:      req.file   ? `/img/products/${req.file.filename}` : '',
    images:     []
  });
  writeProducts(products);
  res.render('admin/add', { page: 'add', success: true, error: null });
});

// Upload / replace product primary image
app.post('/admin/products/:id/image', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.redirect('/admin/products');
  const products = readProducts();
  const p = products.find(x => x.id == req.params.id);
  if (p) {
    if (p.image) { safeUnlinkPublic(p.image); }
    p.image = `/img/products/${req.file.filename}`;
    writeProducts(products);
  } else {
    fs.unlink(req.file.path, () => {});
  }
  res.redirect('/admin/products');
});

// Add image to gallery
app.post('/admin/products/:id/gallery', requireAdmin, upload.single('image'), (req, res) => {
  if (!req.file) return res.redirect('/admin/products');
  const products = readProducts();
  const p = products.find(x => x.id == req.params.id);
  if (p) {
    if (!Array.isArray(p.images)) p.images = [];
    p.images.push(`/img/products/${req.file.filename}`);
    writeProducts(products);
  } else {
    fs.unlink(req.file.path, () => {});
  }
  res.redirect('/admin/products');
});

// Delete a gallery image by index
app.post('/admin/products/:id/gallery/:idx/delete', requireAdmin, (req, res) => {
  const products = readProducts();
  const p = products.find(x => x.id == req.params.id);
  if (p && Array.isArray(p.images)) {
    const idx = parseInt(req.params.idx);
    if (idx >= 0 && idx < p.images.length) {
      safeUnlinkPublic(p.images[idx]);
      p.images.splice(idx, 1);
      writeProducts(products);
    }
  }
  res.redirect('/admin/products');
});

// Toggle visibility
app.post('/admin/products/:id/toggle-visibility', requireAdmin, (req, res) => {
  const products = readProducts();
  const p = products.find(x => x.id == req.params.id);
  if (p) { p.visible = !p.visible; writeProducts(products); }
  res.redirect('/admin/products');
});

// Toggle stock
app.post('/admin/products/:id/toggle-stock', requireAdmin, (req, res) => {
  const products = readProducts();
  const p = products.find(x => x.id == req.params.id);
  if (p) {
    p.stock = !p.stock;
    if (!p.stock) p.visible = false; // auto-hide when OOS
    writeProducts(products);
  }
  res.redirect('/admin/products');
});

// Delete product
app.post('/admin/products/:id/delete', requireAdmin, (req, res) => {
  const all = readProducts();
  const target = all.find(x => x.id == req.params.id);
  if (target && target.image) {
    safeUnlinkPublic(target.image);
  }
  writeProducts(all.filter(x => x.id != req.params.id));
  res.redirect('/admin/products');
});

// ── Category image management ─────────────────────────
const ALL_CATS = ['Bracelets','Necklaces','Earrings','Rings','Bangles','Watches','Bestsellers'];

app.get('/admin/categories', requireAdmin, (req, res) => {
  res.render('admin/categories', { catImages: readCatImages(), cats: ALL_CATS, page: 'categories', success: !!req.query.ok });
});

app.post('/admin/categories/:cat/image', requireAdmin, (req, res) => {
  catUpload.single('image')(req, res, (err) => {
    if (err || !req.file) return res.redirect('/admin/categories');
    const cat = req.params.cat;
    if (!ALL_CATS.includes(cat)) { fs.unlink(req.file.path, () => {}); return res.redirect('/admin/categories'); }
    const imgs = readCatImages();
    if (imgs[cat]) { safeUnlinkPublic(imgs[cat]); }
    imgs[cat] = `/img/categories/${req.file.filename}`;
    saveCatImages(imgs);
    res.redirect('/admin/categories?ok=1');
  });
});

app.post('/admin/categories/:cat/remove', requireAdmin, (req, res) => {
  const cat = req.params.cat;
  const imgs = readCatImages();
  if (imgs[cat]) { safeUnlinkPublic(imgs[cat]); }
  delete imgs[cat];
  saveCatImages(imgs);
  res.redirect('/admin/categories?ok=1');
});

// ── Order API (phone number never exposed to client) ──
app.post('/api/order', (req, res) => {
  // Honeypot: bots fill hidden fields, humans don't
  if (req.body.website) return res.status(400).json({ error: 'Bad request' });

  // Rate limit: max 5 orders per IP per hour
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!orderRateLimit(ip)) {
    return res.status(429).json({ error: 'Too many orders. Please wait before trying again.' });
  }

  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Invalid cart' });
  }

  // Validate every item against live product list (prevents forged prices/names)
  const products = readProducts();
  const lines = [];
  let total = 0;

  for (const item of items.slice(0, 20)) {
    const qty = Math.min(Math.max(parseInt(item.qty) || 1, 1), 99);
    const product = products.find(p => p.name === String(item.name).trim() && p.visible && p.stock);
    if (!product) continue;
    const sub = product.price * qty;
    lines.push(`• ${product.name} × ${qty} — ₹${sub.toLocaleString('en-IN')}`);
    total += sub;
  }

  if (lines.length === 0) return res.status(400).json({ error: 'No valid items' });

  const msg = `Hi Zaraya! I'd like to place an order:\n\n${lines.join('\n')}\n\nTotal: ₹${total.toLocaleString('en-IN')}\n\nI have read and agreed to the Terms & Conditions.`;
  res.json({ url: `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}` });
});

// ── 404 + error handling (no stack traces leaked) ──────
app.use((req, res) => {
  res.status(404).send('Page not found');
});

app.use((err, req, res, next) => {
  console.error(err.message);
  if (res.headersSent) return next(err);
  // Multer / upload errors on admin routes → bounce back gracefully
  if (req.path.startsWith('/admin')) return res.redirect('/admin');
  res.status(500).json({ error: 'Something went wrong' });
});

// ── Start ──────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.warn('WARNING: Using default admin credentials — set ADMIN_USERNAME / ADMIN_PASSWORD env vars.');
  }
});
