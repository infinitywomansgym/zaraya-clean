const express = require('express');
const session = require('express-session');
const path    = require('path');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 8000;

// ── Admin Credentials ──────────────────────────────────
const ADMIN_USERNAME = 'zaraya';
const ADMIN_PASSWORD = '123456';

// ── Data File ──────────────────────────────────────────
const DATA_FILE = path.join(__dirname, 'data', 'products.json');

// ── Middleware ─────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
  secret: 'zaraya-secret-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
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
  res.render('index');
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
app.post('/admin/products/add', requireAdmin, (req, res) => {
  const { name, cat, price, badge, stock, visible, bestseller, color } = req.body;
  if (!name || !price) {
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
    color:      color      || '#0d3a2c'
  });
  writeProducts(products);
  res.render('admin/add', { page: 'add', success: true, error: null });
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
  let products = readProducts().filter(x => x.id != req.params.id);
  writeProducts(products);
  res.redirect('/admin/products');
});

// ── Start ──────────────────────────────────────────────
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});