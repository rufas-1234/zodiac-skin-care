# Deploying Zodiac Beauty on cPanel

The application uses a MySQL database and runs as a Node.js application. Product data, CMS content, admin accounts, and expiring admin sessions are persisted in MySQL.

## 1. Create the database

In cPanel, open **MySQL Database Wizard** and create a database and database user. Grant the user all privileges on that database. cPanel commonly prefixes the database and username with your account name; use the complete prefixed values in the environment variables.

The app creates its tables and inserts the initial catalog, website content, existing product collections, and starter journal posts on its first database request. Do not expose the database user to the browser.

## 2. Configure the Node.js application

Create a cPanel Node.js application using Node.js 22.9 or later and point its application root to the uploaded project. Install dependencies from `package-lock.json`, set the start command to `npm start`, and configure these environment variables in the cPanel application settings:

```text
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DATABASE=your_cpanel_prefix_zodiac
MYSQL_USER=your_cpanel_prefix_admin
MYSQL_PASSWORD=your-database-password
NODE_ENV=production
NEXT_PUBLIC_STORE_PHONE=+254185167903
```

Copy the application files without the local `data/zodiac.db` file. Keep `.env` and all credentials private; do not commit them or place them in `public/`. Preserve `data/uploads` when updating the deployed application so existing product images remain available.
Set `NEXT_PUBLIC_STORE_PHONE` to the store's real number in international format before building. It powers the product call and WhatsApp order links. The current number is configured as the default.

The homepage hero slider has four image slots managed in **Admin → Storefront content**. Images can be uploaded from a device or set by URL; uploaded images are stored in `data/uploads`, so preserve that directory when deploying or backing up the site.
The same admin section manages About Us copy and images, team profiles, and shared contact details (phone, WhatsApp, email, location, address, and opening hours). These settings update the About Us and Contact pages, as well as contact details in the navigation and footer.

Administrator sessions expire after 15 minutes without activity. To offer optional email two-factor authentication when creating an administrator account, configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`. Set `AUTH_SECRET` to a random secret of at least 32 characters (for example, generate one with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"`). Keep all of these values private. Accounts that do not opt in can continue to sign in with their password only.

Customers can create an account and sign in either with a one-time SMS code or with a username and password. Username/password accounts do not require a phone number or email; customers can optionally link and verify a phone later, and can add an email for order receipts. Customers who first sign in by SMS can also enable username/password sign-in from their account profile. Passwords must be at least 12 characters. Configure `AT_USERNAME`, `AT_API_KEY`, and `AT_ENVIRONMENT` (`sandbox` while testing, `production` when ready) for Africa's Talking. Set `DEFAULT_PHONE_COUNTRY_CODE=254` for Kenyan numbers; customers can enter another country code explicitly. Configure `AT_SENDER_ID` only if you have an approved sender ID. Customer codes expire after 10 minutes, can be requested once per minute (up to five requests per hour per number), and allow five attempts. Password sign-in is limited to 10 attempts per username in a 15-minute window. `AUTH_SECRET` is required to protect SMS sign-in codes. Customer sessions last 30 days.

Signed-in customers place orders through checkout and can review their order items, delivery details, totals, and fulfillment/payment status from **My account**. Orders reserve inventory and start in pending status; the admin **Orders** panel updates fulfillment and payment status. Checkout currently records Cash on Delivery or M-Pesa as pending/manual payment choices; it does not charge a card or automatically initiate an M-Pesa payment. An optional customer email receives order confirmations and status notices when the SMTP settings above are configured.

## 3. Preserve existing local data (optional)

Before deploying, you can migrate the existing SQLite catalog, CMS content, and admin account from `data/zodiac.db` to a new, empty MySQL database. Run this from the project root on a machine with Node.js 22.9 or later. Set the MySQL variables in `.env.local`, then run `npm run db:migrate-sqlite`. The migration refuses to overwrite a non-empty MySQL database and leaves the SQLite file untouched. Copy any existing uploaded image files into the deployed `data/uploads` directory as well.

## 4. Create the admin account

Set `ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD` in `.env.local` or the command environment, then run `npm run admin:create` from the application root. The password must be at least 14 characters. Remove `ADMIN_PASSWORD` after creating the account; the application does not use a built-in or default admin password. If you migrated the previous SQLite database, this command resets the password for the specified account.

Open `/admin/login` on the deployed site and sign in. The admin panel can manage products, inventory, product categories, collections, brands, blog posts, homepage copy, and other storefront placements. Assign products to a managed collection and optional brand while editing them. Categories, collections, brands, and journal posts support local image uploads. A category, collection, or brand referenced by products cannot be deleted until those products are reassigned; renaming a category or collection updates product assignments.

Administrators can add additional administrator accounts from **Admin accounts**. Accounts have full backend access; use unique email addresses and passwords of at least 12 characters. Email two-factor authentication is optional per account and requires the SMTP settings above. The current administrator cannot delete their own account, and the final administrator cannot be deleted.

Images can be uploaded locally to `data/uploads` (JPEG, PNG, WebP, or GIF up to 5 MB) and are served through an app route so uploads made after the server starts are immediately available. Back up this directory along with the database; it must be writable and persistent in the hosting environment. Admin write APIs require a valid admin session and a same-origin request. Product pages and cards also provide direct WhatsApp ordering and phone-call links. Published blog posts, collections, and brands appear on the public storefront; drafts remain private to signed-in administrators.

## 5. Build and run

Run:

```text
npm install
npm run build
npm start
```

Use cPanel's application restart control after changing code or environment values. Back up the MySQL database regularly using cPanel backups or `mysqldump`. If the hosting provider uses ephemeral application storage, store uploads in durable cPanel-managed storage or a media service instead.

## Local development

Copy `.env.example` to `.env.local`, fill in a reachable MySQL database, then run `npm run dev -- --port 3003`. Create an admin once with `npm run admin:create` using the same database settings.
