# DawaConnect n8n deployment

This directory contains the production Oracle deployment for DawaConnect monthly pharmacy-report automation.

## Security boundary

- Only Caddy publishes ports `80` and `443`.
- n8n port `5678` is private inside Docker.
- PostgreSQL port `5432` is private inside Docker.
- n8n receives no MongoDB URI, Groq key, pharmacy password, or customer-level data.
- The DawaConnect backend remains the source of report facts, recipients, artifacts, and delivery state.

## Oracle prerequisites

Create an Ubuntu 24.04 ARM64 Ampere A1 VM with a reserved public IPv4 address. Configure Oracle ingress rules as follows:

| Port | Source | Purpose |
| --- | --- | --- |
| 22 | Administrator public IP only | SSH |
| 80 | `0.0.0.0/0` | HTTPS certificate and redirect |
| 443 TCP/UDP | `0.0.0.0/0` | HTTPS and HTTP/3 |

Do not open ports `5678` or `5432`.

Create the DNS record:

```text
Type: A
Name: n8n
Value: <Oracle reserved public IP>
```

## Install Docker on Oracle

Use Docker's official Ubuntu installation instructions. Verify:

```bash
docker --version
docker compose version
```

## Copy and configure

Recommended server directory:

```bash
sudo mkdir -p /opt/dawaconnect-n8n
sudo chown "$USER":"$USER" /opt/dawaconnect-n8n
cd /opt/dawaconnect-n8n
```

Copy this directory's files to that location. Then:

```bash
cp .env.example .env
openssl rand -hex 32
openssl rand -base64 36
```

Put the first generated value in `N8N_ENCRYPTION_KEY` and the second in `POSTGRES_PASSWORD`. Confirm the domain and versions, then protect the file:

```bash
chmod 600 .env
chmod 600 Caddyfile docker-compose.yml
chmod 700 backup.sh
```

Never commit `.env`.

## Validate and start

```bash
docker compose config --quiet
docker compose pull
docker compose up -d
docker compose ps
docker compose logs --tail=100 n8n caddy postgres
```

Open `https://n8n.dawaconnect.store`, create the owner account, enable multi-factor authentication, and run n8n's security audit.

## Credentials to create in n8n

### DawaConnect Reports API

Use Header Auth:

```text
Name: Authorization
Value: Bearer <REPORT_AUTOMATION_SECRET>
```

The same secret must be configured only on the Render backend and in this encrypted n8n credential.

### Resend Monthly Reports

Use Header Auth:

```text
Name: Authorization
Value: Bearer <DEDICATED_RESEND_API_KEY>
```

Do not type these secrets directly into workflow Code or Set nodes.

## Backup

Run:

```bash
./backup.sh
```

This creates:

- a PostgreSQL custom-format dump;
- an archive of the n8n data volume;
- SHA-256 checksums.

The `.env` file is deliberately not copied into the ordinary backup directory. Store an encrypted off-server copy separately. Without the original `N8N_ENCRYPTION_KEY`, restored n8n credentials may be unreadable.

Copy backups away from the Oracle VM. A backup on the same disk is not disaster recovery.

## Controlled update procedure

1. Run and copy a backup off-server.
2. Read n8n, PostgreSQL, and Caddy release/migration notes.
3. Change one pinned version at a time in `.env`.
4. Run `docker compose pull`.
5. Run `docker compose up -d`.
6. Verify health and execute the test-mode workflow.
7. Roll back to the previous version if validation fails.

Do not upgrade this stack directly to n8n 3.x until its breaking-change migration has been reviewed and tested.

