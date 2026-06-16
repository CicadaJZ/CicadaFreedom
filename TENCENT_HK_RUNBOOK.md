# Cicada Freedom Tencent Cloud Hong Kong runbook

This document records the actual deployment flow used for `cicadafreedom.com`.
It is meant to be copied step by step during future redeploys or server rebuilds.

## Current production facts

- Domain: `cicadafreedom.com`
- `www` domain: `www.cicadafreedom.com`
- Server public IP: `43.129.158.226`
- Server provider: Tencent Cloud, Hong Kong
- Domain provider: Alibaba Cloud
- Repository: `https://github.com/CicadaJZ/CicadaFreedom.git`
- Server app directory: `/var/www/cicada-freedom`
- API internal URL: `http://127.0.0.1:8787`
- Public API URL: `https://cicadafreedom.com/api`
- Frontend files: `/var/www/cicada-freedom/dist`
- Environment file: `/etc/cicada-freedom.env`
- systemd service: `cicada-freedom-api`
- Nginx site config: `/etc/nginx/sites-available/cicada-freedom`
- HTTPS certificate path: `/etc/letsencrypt/live/cicadafreedom.com/`

## 1. Local code commit and push

Run these on the local computer, inside the project directory:

```bash
cd /Users/cicada/Documents/Codex/2026-06-14/in-app-browser-the-user-has/work/cicada-freedom
git add package.json server/index.mjs src/App.tsx src/api.ts src/styles.css .env.example DEPLOYMENT.md TENCENT_HK_DEPLOYMENT.md TENCENT_HK_RUNBOOK.md deploy/nginx-cicada-freedom.conf deploy/cicada-freedom-api.service
git commit -m "Prepare Tencent Cloud deployment"
git push origin main
```

Expected result:

```text
To https://github.com/CicadaJZ/CicadaFreedom.git
main -> main
```

## 2. Alibaba Cloud DNS

In Alibaba Cloud DNS, add these records:

| Host record | Type | Record value | TTL |
| --- | --- | --- | --- |
| `@` | A | `43.129.158.226` | 10 minutes |
| `www` | A | `43.129.158.226` | 10 minutes |

Expected result:

```text
Successfully added 2 records
A @   43.129.158.226
A www 43.129.158.226
```

## 3. Tencent Cloud firewall

Keep only these required public ports open:

| Port | Purpose |
| --- | --- |
| `22` | SSH login |
| `80` | HTTP, also used by Certbot verification |
| `443` | HTTPS |

Remove `3389` if the server is Linux. It is only for Windows Remote Desktop.

Do not open `8787`; the API listens locally behind Nginx.

## 4. SSH login

Use Tencent Cloud WebShell or SSH.

Typical login settings:

- Protocol: SSH
- Port: `22`
- Username: `ubuntu`
- Authentication: password or key

If the password is unknown, reset it from the Tencent Cloud server console and reboot the server.

## 5. Install system packages

Run on the Tencent Cloud server:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y curl git nginx ufw ca-certificates
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs
sudo npm install -g pnpm
```

Notes:

- `Pending kernel upgrade` can appear after `apt upgrade`. This is not fatal. Reboot later after the site works.
- npm may print a newer npm version notice. It is safe to ignore.

## 6. Clone the project to the correct directory

Run on the server:

```bash
cd ~
sudo rm -rf /var/www/cicada-freedom
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/CicadaJZ/CicadaFreedom.git cicada-freedom
sudo chown -R ubuntu:ubuntu /var/www/cicada-freedom
cd /var/www/cicada-freedom
```

Important:

- Commands in this section run on the server, not on the local Mac.
- If `pnpm install` says `No package.json found in /home/ubuntu`, you are in the wrong directory.
- Always confirm the prompt path is `/var/www/cicada-freedom`.

## 7. Install dependencies and build

Run on the server:

```bash
cd /var/www/cicada-freedom
pnpm install
pnpm build
```

If `sudo pnpm` cannot find pnpm, do not use sudo for `pnpm install`; use the `ubuntu` user after `chown`.

If pnpm reports `ERR_PNPM_IGNORED_BUILDS` for `esbuild`, run:

```bash
pnpm approve-builds
```

Then:

1. Select `esbuild` with `Space`.
2. Press `Enter`.
3. Confirm with `y`.
4. Re-run:

```bash
pnpm install
pnpm build
```

Expected build result:

```text
vite v6.4.3 building for production...
dist/index.html
dist/assets/index-*.css
dist/assets/index-*.js
built in 2-7s
```

## 8. Create production environment file

Run on the server:

```bash
sudo nano /etc/cicada-freedom.env
```

Paste this, replacing secret values:

```bash
PORT=8787
HOST=127.0.0.1
ALLOWED_ORIGINS=https://cicadafreedom.com,https://www.cicadafreedom.com
VERIFICATION_CODE=<private-code>
ADMIN_EMAIL=<admin-email>
ADMIN_PASSWORD=<long-random-admin-password>
JWT_SECRET=<long-random-secret>
ADMIN_TOKEN_TTL_MS=86400000
```

Save in nano:

1. `Control + O`
2. `Enter`
3. `Control + X`

Set permissions:

```bash
sudo chown root:www-data /etc/cicada-freedom.env
sudo chmod 640 /etc/cicada-freedom.env
sudo chown -R www-data:www-data /var/www/cicada-freedom
```

The admin login at `/admin` uses `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

## 9. Start the API with systemd

Run on the server:

```bash
sudo cp /var/www/cicada-freedom/deploy/cicada-freedom-api.service /etc/systemd/system/cicada-freedom-api.service
sudo systemctl daemon-reload
sudo systemctl enable cicada-freedom-api
sudo systemctl start cicada-freedom-api
sudo systemctl status cicada-freedom-api
```

Expected result:

```text
Active: active (running)
```

Press `q` to exit the status view.

Check local API from the server:

```bash
curl http://127.0.0.1:8787/api/health
```

Expected result:

```json
{"ok":true,"service":"cicada-freedom-api"}
```

Important:

- `127.0.0.1:8787` works only inside the server.
- Opening `http://127.0.0.1:8787/api/health` in your local browser points to your own computer, not Tencent Cloud.
- Public access should go through Nginx and the domain.

## 10. Configure Nginx

Run on the server:

```bash
sudo cp /var/www/cicada-freedom/deploy/nginx-cicada-freedom.conf /etc/nginx/sites-available/cicada-freedom
sudo ln -sf /etc/nginx/sites-available/cicada-freedom /etc/nginx/sites-enabled/cicada-freedom
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Expected `nginx -t` result:

```text
syntax is ok
test is successful
```

Check public HTTP:

```bash
curl http://cicadafreedom.com/api/health
curl http://cicadafreedom.com
```

Expected:

- `/api/health` returns `{"ok":true,"service":"cicada-freedom-api"}`.
- `http://cicadafreedom.com` shows the website.

## 11. Enable HTTPS

Run on the server:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d cicadafreedom.com -d www.cicadafreedom.com
```

Certbot prompts:

- Email: use the site owner email.
- Agree to Terms of Service: `Y`.
- Share email with EFF: `Y` or `N`; either is fine.
- Redirect HTTP to HTTPS: choose redirect if prompted.

Expected result:

```text
Successfully received certificate.
Successfully deployed certificate for cicadafreedom.com
Successfully deployed certificate for www.cicadafreedom.com
Congratulations! You have successfully enabled HTTPS
```

The first certificate in this deployment was saved under:

```text
/etc/letsencrypt/live/cicadafreedom.com/fullchain.pem
/etc/letsencrypt/live/cicadafreedom.com/privkey.pem
```

The certificate expires on `2026-09-14`; Certbot installed automatic renewal.

## 12. Final checks

Run on the server:

```bash
curl https://cicadafreedom.com/api/health
sudo systemctl status cicada-freedom-api
sudo certbot renew --dry-run
```

Expected:

```json
{"ok":true,"service":"cicada-freedom-api"}
```

```text
Active: active (running)
```

Open in a browser:

- `https://cicadafreedom.com`
- `https://www.cicadafreedom.com`
- `https://cicadafreedom.com/admin`

Login to `/admin` using the values stored in `/etc/cicada-freedom.env`.

## 13. Updating the site later

Run on the server:

```bash
cd /var/www/cicada-freedom
sudo chown -R ubuntu:ubuntu /var/www/cicada-freedom
git pull
pnpm install
pnpm build
sudo chown -R www-data:www-data /var/www/cicada-freedom
sudo systemctl restart cicada-freedom-api
sudo systemctl reload nginx
```

Check:

```bash
curl https://cicadafreedom.com/api/health
```

## 14. Useful maintenance commands

API service:

```bash
sudo systemctl status cicada-freedom-api
sudo systemctl restart cicada-freedom-api
sudo journalctl -u cicada-freedom-api -n 100 --no-pager
```

Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
sudo journalctl -u nginx -n 100 --no-pager
```

HTTPS:

```bash
sudo certbot certificates
sudo certbot renew --dry-run
```

Disk and memory:

```bash
df -h
free -h
```

## 15. Known caveats

- The current app still stores data in `server/data/db.json`. This is acceptable for a first launch, but a real public site should move users and posts into PostgreSQL.
- Keep `/etc/cicada-freedom.env` private. Do not commit real `ADMIN_PASSWORD` or `JWT_SECRET` to GitHub.
- Reboot after kernel upgrades:

```bash
sudo reboot
```

After reboot, check:

```bash
curl https://cicadafreedom.com/api/health
sudo systemctl status cicada-freedom-api
```
