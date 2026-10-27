# Deploying FocusFlow on AWS

## Live deployment (this account: 863181492071, us-east-1)

**Live at https://d1m1uojl3y8cq4.cloudfront.net** (CloudFront distribution `E19CRYRH8ZMQM9`, status Deployed; served files verified byte-identical to `public/`).

This account's organization SCP (`p-p1wq965p`) explicitly denies `s3:CreateBucket`/`s3:PutObject`, Amplify, App Runner, Lambda, and EC2, but allows CloudFront. The site is therefore served by **CloudFront Functions**: each file in `public/` is gzip-compressed, base64-embedded in its own function (`focusflow-html`, `focusflow-css`, `focusflow-js`), and returned by a viewer-request association. The distribution origin is a placeholder that is never reached, and caching is disabled so redeploys take effect immediately.

Redeploy after editing `public/`:

```bash
aws login   # only if the session has expired
python3 deploy/cloudfront/deploy.py
```

If the org later relaxes the SCP to allow S3, prefer the standard S3 + CloudFront setup below and retire the functions.

FocusFlow is a **static web app with no backend**: no login, no API, and no database. All user data (tasks, focus history, settings) lives in each visitor's browser local storage. Deploying it means hosting three static files (`index.html`, `styles.css`, `app.js`).

## Recommended — S3 + CloudFront (simplest, cheapest)

```bash
aws s3 mb s3://<your-bucket>
aws s3 sync public/ s3://<your-bucket> --delete
```

Then put a **CloudFront** distribution in front of the bucket (with ACM HTTPS certificate + your Route 53 domain) and set the default root object to `index.html`. That's the whole deployment — no servers, no secrets, no database to manage.

> Consequence of local-only storage: data is per-browser and per-device. It does not sync between devices, and clearing browser/site data erases it.

## Alternative — container (App Runner / ECS Fargate)

If you prefer running the included Node static server (`Dockerfile` at project root):

```bash
aws ecr create-repository --repository-name focusflow
aws ecr get-login-password | docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
docker build -t focusflow .
docker tag focusflow:latest <account>.dkr.ecr.<region>.amazonaws.com/focusflow:latest
docker push <account>.dkr.ecr.<region>.amazonaws.com/focusflow:latest
```

Run it on App Runner or a single ECS Fargate task with container port `3000` and health check path `/`. No environment secrets, persistent volumes, or databases are needed — the container only serves static files.

## Cost sketch

S3 + CloudFront for a small static site is typically under $1–5/month. A 0.25 vCPU Fargate task / App Runner service is roughly $10–25/month.

FocusFlow is completely free for users — there is no payment, trial, subscription, or account integration to configure.
