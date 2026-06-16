# Tencent Cloud Hong Kong deployment

This guide assumes:

- Server: Tencent Cloud Lighthouse, Hong Kong
- Domain: bought on Alibaba Cloud
- App domain: `cicadafreedom.com`
- App root on server: `/var/www/cicada-freedom`
- API process: Node.js behind Nginx on `127.0.0.1:8787`

This file is already filled for `cicadafreedom.com`.

## 1. Tencent Cloud security group

Open only these inbound ports:

- `22` for SSH
- `80` for HTTP
- `443` for HTTPS

Do not expose `8787`, `5432`, `3306`, or any database/admin ports to the public internet.

## 2. Alibaba Cloud DNS records

In Alibaba Cloud Domain Console / Cloud DNS, add:

| Host record | Type | Value |
| --- | --- | --- |
| `@` | A | `43.129.158.226` |
| `www` | A | `43.129.158.226` |

Optional, only if you want a separate API hostname later:

| Host record | Type | Value |
| --- | --- | --- |
| `api` | A | `43.129.158.226` |

For the current single-server Nginx setup, `cicadafreedom.com/api` is enough.

## 3. Install server packages

SSH into the server as `root`, then run:

```bash
apt update
apt upgrade -y
apt install -y curl git nginx ufw ca-certificates
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
npm install -g pnpm
```

## 4. Upload or clone the project

Recommended:

```bash
mkdir -p /var/www
cd /var/www
git clone <your-github-repo-url> cicada-freedom
cd cicada-freedom
pnpm install
pnpm build
```

If you are not using GitHub yet, upload the project directory to `/var/www/cicada-freedom`.

## 5. Create production environment file

Create `/etc/cicada-freedom.env`:

```bash
PORT=8787
HOST=127.0.0.1
ALLOWED_ORIGINS=https://cicadafreedom.com,https://www.cicadafreedom.com
VERIFICATION_CODE=<private-code>
ADMIN_EMAIL=<your-admin-email>
ADMIN_PASSWORD=<long-random-password>
JWT_SECRET=<long-random-secret>
ADMIN_TOKEN_TTL_MS=86400000
```

Then restrict permissions:

```bash
chown root:www-data /etc/cicada-freedom.env
chmod 640 /etc/cicada-freedom.env
chown -R www-data:www-data /var/www/cicada-freedom
```

## 6. Install the systemd service

```bash
cp /var/www/cicada-freedom/deploy/cicada-freedom-api.service /etc/systemd/system/cicada-freedom-api.service
systemctl daemon-reload
systemctl enable cicada-freedom-api
systemctl start cicada-freedom-api
systemctl status cicada-freedom-api
```

## 7. Configure Nginx

Copy the template:

```bash
cp /var/www/cicada-freedom/deploy/nginx-cicada-freedom.conf /etc/nginx/sites-available/cicada-freedom
```

The Nginx template is already filled with `cicadafreedom.com` and `www.cicadafreedom.com`.

Enable the site:

```bash
ln -s /etc/nginx/sites-available/cicada-freedom /etc/nginx/sites-enabled/cicada-freedom
nginx -t
systemctl reload nginx
```

## 8. Enable HTTPS

After DNS points to the server and `http://cicadafreedom.com` works:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d cicadafreedom.com -d www.cicadafreedom.com
```

Choose the redirect-to-HTTPS option when Certbot asks.

## 9. Verify

```bash
curl http://127.0.0.1:8787/api/health
curl https://cicadafreedom.com/api/health
systemctl status cicada-freedom-api
```

Open:

- `https://cicadafreedom.com`
- `https://cicadafreedom.com/admin`

## 10. Updating the app later

```bash
cd /var/www/cicada-freedom
git pull
pnpm install
pnpm build
chown -R www-data:www-data /var/www/cicada-freedom
systemctl restart cicada-freedom-api
systemctl reload nginx
```
