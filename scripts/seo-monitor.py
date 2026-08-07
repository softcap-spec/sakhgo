#!/usr/bin/env python3
"""SEO monitor for sakhgo.ru — runs every 5 hours via cron.
Checks: titles, meta descriptions, OG tags, JSON-LD, canonical, robots meta."""
import requests, json, time, os, re
from urllib.parse import urljoin

BASE = os.environ.get("SEO_BASE", "https://sakhgo.ru")
REPORT = os.environ.get("SEO_REPORT", "/tmp/seo_report.json")

NON_HTML = {"/robots.txt", "/sitemap.xml"}

def check(url: str, label: str) -> dict:
    r = {"url": url, "label": label, "status": None, "title": None, "desc": None,
         "og": {}, "h1_count": 0, "canonical": "", "jsonld": False, "time_ms": 0,
         "size_kb": 0, "error": None}
    try:
        t0 = time.time()
        resp = requests.get(url, headers={"User-Agent": "SakhGO-SEO-Bot/1.0"}, timeout=15)
        r["time_ms"] = round((time.time() - t0) * 1000)
        r["status"] = resp.status_code
        r["size_kb"] = round(len(resp.content) / 1024, 1)
        html = resp.text

        m = re.search(r"<title>(.*?)</title>", html, re.S)
        if m: r["title"] = m.group(1).strip()

        m = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', html)
        if m: r["desc"] = m.group(1).strip()

        for tag in ["og:title", "og:description", "og:image", "og:url", "og:type"]:
            m = re.search(rf'<meta\s+property="{tag}"\s+content="([^"]*)"', html)
            if m: r["og"][tag] = m.group(1).strip()

        if re.search(r'<meta\s+name="twitter:card"', html):
            r["og"]["twitter:card"] = True

        m = re.search(r'<link\s+rel="canonical"\s+href="([^"]*)"', html)
        if m: r["canonical"] = m.group(1).strip()

        r["jsonld"] = "application/ld+json" in html
        r["h1_count"] = len(re.findall(r"<h1[>\s]", html))
        r["robots_meta"] = bool(re.search(r'<meta\s+name="robots"', html))
    except Exception as e:
        r["error"] = str(e)
    return r


def main():
    pages = [
        ("/", "Main page"),
        ("/catalog", "Catalog"),
        ("/help", "Help"),
        ("/privacy", "Privacy"),
        ("/terms", "Terms"),
        ("/robots.txt", "Robots.txt"),
        ("/sitemap.xml", "Sitemap"),
    ]

    results = []
    issues = []

    for path, label in pages:
        url = urljoin(BASE, path)
        r = check(url, label)
        results.append(r)

        if r["error"]:
            issues.append(f"ERR {label}: {r['error']}")
            continue
        if r["status"] != 200:
            issues.append(f"HTTP {r['status']} {label}")
            continue

        if path in NON_HTML:
            continue

        if not r["title"]:
            issues.append(f"MISSING title on {label}")
        elif path == "/" and len(r["title"]) < 30:
            issues.append(f"SHORT title ({len(r['title'])} chars) on {label}")

        if not r["desc"]:
            issues.append(f"MISSING meta description on {label}")
        elif len(r["desc"]) < 60:
            issues.append(f"SHORT description ({len(r['desc'])} chars) on {label}")

        if not r["og"].get("og:title"):
            issues.append(f"MISSING og:title on {label}")
        if not r["og"].get("og:description"):
            issues.append(f"MISSING og:description on {label}")

        if not r["jsonld"]:
            issues.append(f"MISSING JSON-LD on {label}")
        if not r["canonical"]:
            issues.append(f"MISSING canonical on {label}")
        if not r["robots_meta"]:
            issues.append(f"MISSING robots meta on {label}")

    score = max(0, 100 - len(issues) * 5)  # -5 per issue

    report = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S +11"),
        "base": BASE, "score": score,
        "pages_checked": len(pages), "issues_count": len(issues),
        "issues": issues,
    }

    if issues:
        print(f"SEO {time.strftime('%Y-%m-%d %H:%M')} | Score: {score}% | {len(issues)} issues")
        for issue in issues:
            print(f"  - {issue}")
    else:
        print(f"SEO {time.strftime('%Y-%m-%d %H:%M')} | Score: 100% | All clear")

    with open(REPORT, "w") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
