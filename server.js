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

// ── Rate limiter (in-memory, resets on restart) ────────
const _orderMap = new Map();
function orderRateLimit(ip) {
  const now = Date.now(), window = 60 * 60 * 1000, max = 5;
  const e = _orderMap.get(ip);
  if (!e || now > e.r) { _orderMap.set(ip, { c: 1, r: now + window }); return true; }
  if (e.c >= max) return false;
  e.c++;
  return true;
}
setInterval(() => { const n = Date.now(); _orderMap.forEach((v, k) => { if (n > v.r) _orderMap.delete(k); }); }, 60 * 60 * 1000);

// ── Data File ──────────────────────────────────────────
const DATA_FILE    = path.join(__dirname, 'data', 'products.json');
const UPLOAD_DIR   = path.join(__dirname, 'public', 'img', 'products');
const CATS_FILE    = path.join(__dirname, 'data', 'categories.json');
const CAT_DIR      = path.join(__dirname, 'public', 'img', 'categories');
if (!fs.existsSync(CAT_DIR)) fs.mkdirSync(CAT_DIR, { recursive: true });

// ── Multer (product image uploads) ────────────────────
const catUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, CAT_DIR),
    filename:    (req, file, cb) => {
      const ext  = path.extname(file.originalname).toLowerCase();
      const safe = (req.params.cat || 'cat').toLowerCase().replace(/[^a-z0-9]/g, '');
      cb(null, 'cat-' + safe + '-' + Date.now() + ext);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Only jpg, png, webp or gif images are allowed'));
  }
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename:    (req, file, cb) => {
      const ext  = path.extname(file.originalname).toLowerCase();
      cb(null, Date.now() + '-' + crypto.randomBytes(6).toString('hex') + ext);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    /^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)
      ? cb(null, true)
      : cb(new Error('Only jpg, png, webp or gif images are allowed'));
  }
});

// ── Middleware ─────────────────────────────────────────
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use(session({
  secret: process.env.SESSION_SECRET || 'zaraya-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    httpOnly: true,
    sameSite: 'strict'
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
  const { username, password } = req.body;
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    req.session.admin = true;
    return res.redirect('/admin');
  }
  res.render('admin/login', { error: 'Wrong username or password. Please try again.' });
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
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
  if (!name || !price) {
    if (req.file) fs.unlink(req.file.path, () => {});
    return res.render('admin/add', { page: 'add', success: false, error: 'Name and price are required.' });
  }
  const products = readProducts();
  products.unshift({
    id:         Date.now(),
    name:       name.trim(),
    cat:        cat        || 'Bracelets',
    price:      parseFloat(price),
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
    if (p.image) { fs.unlink(path.join(__dirname, 'public', p.image), () => {}); }
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
      fs.unlink(path.join(__dirname, 'public', p.images[idx]), () => {});
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
    fs.unlink(path.join(__dirname, 'public', target.image), () => {});
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
    if (imgs[cat]) { fs.unlink(path.join(__dirname, 'public', imgs[cat]), () => {}); }
    imgs[cat] = `/img/categories/${req.file.filename}`;
    saveCatImages(imgs);
    res.redirect('/admin/categories?ok=1');
  });
});

app.post('/admin/categories/:cat/remove', requireAdmin, (req, res) => {
  const cat = req.params.cat;
  const imgs = readCatImages();
  if (imgs[cat]) { fs.unlink(path.join(__dirname, 'public', imgs[cat]), () => {}); }
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

// ── Start ──────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
