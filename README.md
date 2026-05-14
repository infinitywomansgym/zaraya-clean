# Zaraya Jewellery — Node.js Web App

## Project Structure
```
zaraya-project/
├── server.js              ← Main server (start here)
├── package.json           ← Dependencies
├── data/
│   └── products.json      ← Product data (editable)
├── public/
│   ├── css/
│   │   ├── style.css      ← Main styles
│   │   ├── shop.css       ← Shop page styles
│   │   └── admin.css      ← Admin dashboard styles
│   └── js/
│       ├── main.js        ← Home page JS
│       └── shop.js        ← Shop page JS
└── views/
    ├── index.ejs          ← Home page
    ├── shop.ejs           ← Shop page
    ├── partials/
    │   ├── head.ejs       ← HTML head
    │   ├── footer.ejs     ← Footer
    │   ├── admin-layout.ejs
    │   └── admin-layout-end.ejs
    └── admin/
        ├── login.ejs      ← Admin login
        ├── dashboard.ejs  ← Admin overview
        ├── products.ejs   ← Manage products
        └── add.ejs        ← Add new product
```

## Setup Instructions

### 1. Install Node.js
Download from https://nodejs.org (choose LTS version)

### 2. Open in VS Code
- Open VS Code
- File → Open Folder → select the `zaraya-project` folder

### 3. Install dependencies
Open the VS Code terminal (Ctrl + ` ) and run:
```
npm install
```

### 4. Start the server
```
npm start
```
Or for auto-reload during development:
```
npm run dev
```

### 5. Open in browser
- Website: http://localhost:3000
- Admin:   http://localhost:3000/admin/login

## Admin Login
- **Username:** zaraya
- **Password:** 123456

## To edit content
- **Products:** Edit `data/products.json` or use the Admin panel
- **Styles:**   Edit files in `public/css/`
- **Pages:**    Edit files in `views/`
- **Server:**   Edit `server.js`
