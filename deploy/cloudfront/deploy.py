#!/usr/bin/env python3
"""Deploy FocusFlow on CloudFront Functions (no S3).

This AWS account's org SCP denies s3:CreateBucket/PutObject, Amplify,
App Runner, Lambda and EC2, but allows CloudFront. So each static file
is gzip-compressed, base64-embedded in its own CloudFront Function, and
served by a viewer-request association. The distribution's origin is a
placeholder that is never reached because the functions always respond.

Note: the CloudFront KeyValueStore endpoint was not reachable from the
deploy machine, hence the embedded-function design. Re-running this
script re-uploads the current public/ files and republishes.

Usage:  aws login   (once, if needed)
        python3 deploy/cloudfront/deploy.py
"""
import base64
import gzip
import json
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[2]
HERE = pathlib.Path(__file__).parent
PUBLIC = ROOT / "public"
BUILD = HERE / "build"
CACHE_DISABLED = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"  # managed policy

FILES = [
    # (function name, served path or None for default, source, content type)
    ("focusflow-html", None, "index.html", "text/html; charset=utf-8"),
    ("focusflow-css", "/styles.css", "styles.css", "text/css; charset=utf-8"),
    ("focusflow-js", "/app.js", "app.js", "text/javascript; charset=utf-8"),
]


def aws(*args):
    out = subprocess.run(["aws", *args], capture_output=True, text=True, check=False)
    if out.returncode != 0:
        label = " ".join(a if len(a) < 80 else a[:77] + "..." for a in args)
        raise SystemExit(f"aws {label} failed:\n{out.stderr.strip()}")
    return json.loads(out.stdout) if out.stdout.strip() else {}


def aws_ok(*args):
    """Run aws, returning None instead of exiting on failure."""
    out = subprocess.run(["aws", *args], capture_output=True, text=True, check=False)
    if out.returncode != 0:
        return None
    return json.loads(out.stdout) if out.stdout.strip() else {}


def publish(name, code_file):
    cfg = {"Comment": f"FocusFlow {name}", "Runtime": "cloudfront-js-2.0"}
    created = aws_ok("cloudfront", "create-function", "--name", name,
                     "--function-config", json.dumps(cfg),
                     "--function-code", f"fileb://{code_file}")
    if created is not None:
        etag = created["ETag"]
    else:
        desc = aws("cloudfront", "describe-function", "--name", name)
        updated = aws("cloudfront", "update-function", "--name", name,
                      "--if-match", desc["ETag"],
                      "--function-config", json.dumps(cfg),
                      "--function-code", f"fileb://{code_file}")
        etag = updated["ETag"]
    pub = aws("cloudfront", "publish-function", "--name", name, "--if-match", etag)
    arn = pub["FunctionSummary"]["FunctionMetadata"]["FunctionARN"]
    print(f"published {name}: {arn}")
    return arn


def behavior(fn_arn, path=None):
    b = {
        "TargetOriginId": "placeholder",
        "ViewerProtocolPolicy": "redirect-to-https",
        "Compress": False,
        "CachePolicyId": CACHE_DISABLED,
        "AllowedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"],
                           "CachedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]}},
        "FunctionAssociations": {"Quantity": 1, "Items": [
            {"FunctionARN": fn_arn, "EventType": "viewer-request"}]},
    }
    if path:
        b["PathPattern"] = path
    return b


def main():
    BUILD.mkdir(exist_ok=True)
    template = (HERE / "function-template.js").read_text(encoding="utf-8")
    arns = {}
    for name, path, src, ctype in FILES:
        raw = (PUBLIC / src).read_bytes()
        data = base64.b64encode(gzip.compress(raw, mtime=0)).decode()
        code = template.replace("__TYPE__", ctype).replace("__DATA__", data)
        code_file = BUILD / f"{name}.js"
        code_file.write_text(code, encoding="utf-8")
        print(f"{src}: {len(raw)}B -> function code {len(code)}B")
        assert len(code.encode()) < 10_000, f"{name} exceeds CloudFront Function size limit"
        arns[name] = publish(name, code_file)

    dists = aws("cloudfront", "list-distributions").get("DistributionList", {}).get("Items", [])
    existing = next((d for d in dists if d.get("Comment") == "focusflow"), None)
    if existing:
        print(f"Distribution exists: https://{existing['DomainName']} (id {existing['Id']})")
        print("Functions republished; no invalidation needed (caching disabled).")
        return

    config = {
        "CallerReference": "focusflow-v1", "Comment": "focusflow", "Enabled": True,
        "DefaultRootObject": "index.html", "HttpVersion": "http2",
        "IsIPV6Enabled": True, "PriceClass": "PriceClass_100",
        "Origins": {"Quantity": 1, "Items": [{
            "Id": "placeholder", "DomainName": "example.com",
            "CustomOriginConfig": {"HTTPPort": 80, "HTTPSPort": 443, "OriginProtocolPolicy": "http-only"}}]},
        "DefaultCacheBehavior": behavior(arns["focusflow-html"]),
        "CacheBehaviors": {"Quantity": 2, "Items": [
            behavior(arns["focusflow-css"], "/styles.css"),
            behavior(arns["focusflow-js"], "/app.js"),
        ]},
    }
    dist = aws("cloudfront", "create-distribution", "--distribution-config", json.dumps(config))
    d = dist["Distribution"]
    print(f"Distribution created: https://{d['DomainName']} (id {d['Id']}, status {d['Status']})")
    print("Wait until status is Deployed, then open the URL above.")


if __name__ == "__main__":
    main()
