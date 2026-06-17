# Cicada Freedom Tencent Cloud Baota runbook

This document records the deployment flow for the Tencent Cloud Lighthouse server
using OpenCloudOS and the Baota Linux panel Nginx layout.

Use this runbook when the server prompt looks like `opencloudos`, `apt` is not
available, and Nginx lives under `/www/server/nginx`.

## Current production facts

- Domain: `cicadafreedom.com`
- `www` domain: `www.cicadafreedom.com`
- Server public IP: `43.135.1.98`
- Server provider: Tencent Cloud Lighthouse, Hong Kong
- Server image: Baota Linux panel on OpenCloudOS
- Domain provider: Alibaba Cloud
- Repository: `https://github.com/CicadaJZ/CicadaFreedom.git`
- Server app directory: `/var/www/cicada-freedom`
- Frontend files: `/var/www/cicada-freedom/dist`
- API internal URL: `http://127.0.0.1:8787`
- Public API URL: `https://cicadafreedom.com/api`
- Environment file: `/etc/cicada-freedom.env`
- systemd service: `cicada-freedom-api`
- Baota Nginx main config: `/www/server/nginx/conf/nginx.conf`
- Baota Nginx vhost config: `/www/server/panel/vhost/nginx/cicada-freedom.conf`
- HTTPS certificate path: `/etc/letsencrypt/live/cicadafreedom.com/`

## 1. Firewall

In Tencent Cloud Lighthouse Firewall, keep these public inbound rules:

| Port | Purpose |
| --- | --- |
| `22` | SSH login |
| `80` | HTTP and Let's Encrypt verification |
| `443` | HTTPS |
| `8888` | Baota panel, temporary or restricted access only |

Do not open `8787`. The API listens on `127.0.0.1:8787` and should only be
reached through Nginx.

After deployment is stable, restrict `8888` to your own IP address or remove it.

## 2. Alibaba Cloud DNS

In Alibaba Cloud DNS, set these records:

| Host record | Type | Record value | TTL |
| --- | --- | --- | --- |
| `@` | A | `43.135.1.98` | 10 minutes |
| `www` | A | `43.135.1.98` | 10 minutes |

If Tencent Cloud Domain Resolution shows "not effective", ignore it unless the
domain is actually using Tencent Cloud DNS nameservers. For this deployment,
Alibaba Cloud DNS is authoritative.

Verify from the server:

```bash
nslookup cicadafreedom.com 223.5.5.5
nslookup www.cicadafreedom.com 223.5.5.5
```

Expected address:

```text
43.135.1.98
```

## 3. Login

Use the Tencent Cloud console login button, WebShell, or SSH.

Confirm the user:

```bash
whoami
```

If it is not `root`, switch to root:

```bash
sudo -i
```

Confirm the OS when needed:

```bash
cat /etc/os-release
command -v dnf || command -v yum
```

## 4. Install packages

OpenCloudOS does not use `apt`. Use `dnf`, or `yum` if `dnf` is unavailable.

```bash
dnf makecache -y
dnf update -y
dnf install -y curl git firewalld ca-certificates
curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
dnf install -y nodejs
npm install -g pnpm
```

If `certbot` is not installed later, install EPEL first:

```bash
dnf install -y epel-release
dnf install -y certbot
```

Check versions:

```bash
node -v
npm -v
pnpm -v
```

## 5. Clone and build

Run on the server:

```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/CicadaJZ/CicadaFreedom.git cicada-freedom
cd /var/www/cicada-freedom
pnpm install
pnpm build
```

If `pnpm install` warns about ignored `esbuild` scripts but `pnpm build`
succeeds and creates `dist/`, the warning is not blocking.

Expected build output includes:

```text
dist/index.html
dist/assets/index-*.css
dist/assets/index-*.js
built in ...
```

## 6. Environment file

Create `/etc/cicada-freedom.env`.

Replace the admin password and verification code before using this in
production.

```bash
cat > /etc/cicada-freedom.env <<'EOF'
PORT=8787
HOST=127.0.0.1
ALLOWED_ORIGINS=https://cicadafreedom.com,https://www.cicadafreedom.com
VERIFICATION_CODE=7777
ADMIN_EMAIL=admin@cicadafreedom.com
ADMIN_PASSWORD=<long-admin-password>
JWT_SECRET=<long-random-secret>
ADMIN_TOKEN_TTL_MS=86400000
EOF
```

Generate a random `JWT_SECRET`:

```bash
openssl rand -hex 32
```

Check the admin values later:

```bash
grep -E 'ADMIN_EMAIL|ADMIN_PASSWORD' /etc/cicada-freedom.env
```

Reset the API after editing the file:

```bash
systemctl restart cicada-freedom-api
```

## 7. systemd API service

The Baota OpenCloudOS image uses the `www` user, not Ubuntu's `www-data` and not
necessarily `nginx`.

Confirm available web users:

```bash
grep -E '^(nginx|www|www-data|apache):' /etc/passwd
```

For this server the expected output is:

```text
www:x:1000:1000::/home/www:/sbin/nologin
```

Install and patch the service:

```bash
cp /var/www/cicada-freedom/deploy/cicada-freedom-api.service /etc/systemd/system/cicada-freedom-api.service
sed -i 's/User=www-data/User=www/' /etc/systemd/system/cicada-freedom-api.service
sed -i 's/Group=www-data/Group=www/' /etc/systemd/system/cicada-freedom-api.service
```

Set permissions and start:

```bash
chown root:www /etc/cicada-freedom.env
chmod 640 /etc/cicada-freedom.env
chown -R www:www /var/www/cicada-freedom

systemctl daemon-reload
systemctl enable cicada-freedom-api
systemctl restart cicada-freedom-api
systemctl status cicada-freedom-api
```

Expected:

```text
Active: active (running)
```

Verify the local API from the server:

```bash
curl -v --max-time 5 http://127.0.0.1:8787/api/health
```

Expected:

```json
{"ok":true,"service":"cicada-freedom-api"}
```

If systemd shows `status=217/USER`, the `User=` or `Group=` in
`/etc/systemd/system/cicada-freedom-api.service` does not exist. Re-check
`/etc/passwd`, patch the service, then run `systemctl daemon-reload` and restart.

## 8. Baota Nginx HTTP config

Baota Nginx uses:

```text
/www/server/nginx/conf/nginx.conf
/www/server/panel/vhost/nginx/*.conf
```

Confirm that the vhost directory is included:

```bash
grep -n "vhost/nginx" /www/server/nginx/conf/nginx.conf
```

Create the vhost config:

```bash
mkdir -p /www/server/panel/vhost/nginx
cp /var/www/cicada-freedom/deploy/nginx-cicada-freedom.conf /www/server/panel/vhost/nginx/cicada-freedom.conf

/www/server/nginx/sbin/nginx -t -c /www/server/nginx/conf/nginx.conf
/etc/init.d/nginx restart
```

Verify from the server:

```bash
curl -H 'Host: cicadafreedom.com' http://127.0.0.1/api/health
curl -I -H 'Host: cicadafreedom.com' http://127.0.0.1
```

Expected:

```json
{"ok":true,"service":"cicada-freedom-api"}
```

```text
HTTP/1.1 200 OK
```

Verify public HTTP after DNS points to the new server:

```bash
curl http://cicadafreedom.com/api/health
curl -I http://cicadafreedom.com
```

## 9. HTTPS certificate

Use Certbot webroot mode. This avoids Certbot trying to edit Baota's Nginx files.

Install Certbot if needed:

```bash
dnf install -y certbot || yum install -y certbot
```

If the package is unavailable:

```bash
dnf install -y epel-release || yum install -y epel-release
dnf install -y certbot || yum install -y certbot
```

Request the certificate:

```bash
certbot certonly --webroot \
  -w /var/www/cicada-freedom/dist \
  -d cicadafreedom.com \
  -d www.cicadafreedom.com
```

Expected files:

```text
/etc/letsencrypt/live/cicadafreedom.com/fullchain.pem
/etc/letsencrypt/live/cicadafreedom.com/privkey.pem
```

## 10. Baota Nginx HTTPS config

Replace `/www/server/panel/vhost/nginx/cicada-freedom.conf`:

```bash
cat > /www/server/panel/vhost/nginx/cicada-freedom.conf <<'EOF'
server {
  listen 80;
  listen [::]:80;
  server_name cicadafreedom.com www.cicadafreedom.com;

  location /.well-known/acme-challenge/ {
    root /var/www/cicada-freedom/dist;
  }

  location / {
    return 301 https://$host$request_uri;
  }
}

server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name cicadafreedom.com www.cicadafreedom.com;

  root /var/www/cicada-freedom/dist;
  index index.html;

  ssl_certificate /etc/letsencrypt/live/cicadafreedom.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/cicadafreedom.com/privkey.pem;

  client_max_body_size 2m;

  location /api/ {
    proxy_pass http://127.0.0.1:8787/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
EOF

/www/server/nginx/sbin/nginx -t -c /www/server/nginx/conf/nginx.conf
/etc/init.d/nginx restart
```

Nginx may warn that `listen ... http2` is deprecated. If syntax is OK and Nginx
restarts, this warning is not blocking.

Verify HTTPS:

```bash
curl https://cicadafreedom.com/api/health
curl -I https://cicadafreedom.com
certbot renew --dry-run
```

Expected:

```json
{"ok":true,"service":"cicada-freedom-api"}
```

```text
HTTP/2 200
Congratulations, all simulated renewals succeeded
```

## 11. Admin login

Open:

```text
https://cicadafreedom.com/admin
```

Credentials come from:

```bash
grep -E 'ADMIN_EMAIL|ADMIN_PASSWORD' /etc/cicada-freedom.env
```

After changing credentials:

```bash
systemctl restart cicada-freedom-api
```

## 12. Updating the app later

After pushing to `main`, run on the server:

```bash
cd /var/www/cicada-freedom
chown -R root:root /var/www/cicada-freedom
git pull
pnpm install
pnpm build
chown -R www:www /var/www/cicada-freedom
systemctl restart cicada-freedom-api
/www/server/nginx/sbin/nginx -t -c /www/server/nginx/conf/nginx.conf
/etc/init.d/nginx restart
curl https://cicadafreedom.com/api/health
```

Expected:

```json
{"ok":true,"service":"cicada-freedom-api"}
```

Hard refresh the browser after frontend changes.

## 13. Useful commands

API service:

```bash
systemctl status cicada-freedom-api
systemctl restart cicada-freedom-api
journalctl -u cicada-freedom-api -n 100 --no-pager
```

Baota Nginx:

```bash
/www/server/nginx/sbin/nginx -t -c /www/server/nginx/conf/nginx.conf
/etc/init.d/nginx status
/etc/init.d/nginx restart
tail -80 /www/server/nginx/logs/error.log
```

HTTPS:

```bash
certbot certificates
certbot renew --dry-run
```

DNS:

```bash
nslookup cicadafreedom.com 223.5.5.5
nslookup www.cicadafreedom.com 223.5.5.5
```

Disk and memory:

```bash
df -h
free -h
```

## 14. Known caveats

- The current app stores data in `server/data/db.json`. Before releasing an old
  server, migrate this file if it contains real users or posts.
- Keep `/etc/cicada-freedom.env` private. Do not commit real admin passwords or
  JWT secrets.
- Local browser URLs like `http://127.0.0.1:8787/api/health` point to the local
  computer, not the Tencent Cloud server. Test that URL only inside the server
  shell.
- Do not delete the old server until the new domain, HTTPS, login, registration,
  and admin flows are verified.
