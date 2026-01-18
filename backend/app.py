import base64
import hashlib
import io
import json
import os
import threading
from urllib.parse import quote_plus, urlparse

import requests
from bs4 import BeautifulSoup
from PIL import Image
from flask import Flask, jsonify, request


APP = Flask(__name__)
LOCK = threading.Lock()

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
ATTACHMENTS_DIR = os.path.join(ROOT_DIR, "frontend", "public", "attachments")
UPLOADS_DIR = os.path.join(ROOT_DIR, "frontend", "public", "uploads")
RENDERS_DIR = os.path.join(ROOT_DIR, "frontend", "public", "renders")
AVATARS_DIR = os.path.join(ROOT_DIR, "frontend", "public", "avatars")
CATALOG_PATH = os.path.join(ATTACHMENTS_DIR, "catalog.json")


def _load_env_file():
    env_path = os.path.join(ROOT_DIR, ".env")
    if not os.path.isfile(env_path):
        return
    with open(env_path, "r", encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


_load_env_file()

FAL_API_KEY = (
    os.environ.get("FAI.AI_API_KEY")
    or os.environ.get("FAI_API_KEY")
    or os.environ.get("FAL_API_KEY")
    or os.environ.get("FAL_KEY")
)
FAL_AUTH_SCHEME = os.environ.get("FAL_AUTH_SCHEME", "Key")
FAL_IMG_ENDPOINT = os.environ.get("FAL_SDXL_TURBO_IMG_ENDPOINT", "https://fal.run/fal-ai/fast-sdxl/image-to-image")
FAL_IMAGE_SIZE = os.environ.get("FAL_IMAGE_SIZE", "square")


def _safe_int(value, default):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_float(value, default):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


FAL_NUM_STEPS = _safe_int(os.environ.get("FAL_NUM_STEPS"), 6)
FAL_GUIDANCE = _safe_float(os.environ.get("FAL_GUIDANCE"), 5.0)
FAL_STRENGTH = _safe_float(os.environ.get("FAL_STRENGTH"), 0.65)
RENDER_REF_HEIGHT = _safe_int(os.environ.get("RENDER_REF_HEIGHT"), 1024)
RENDER_REF_GAP = _safe_int(os.environ.get("RENDER_REF_GAP"), 32)
FAL_USE_IMAGE_URLS = os.environ.get("FAL_USE_IMAGE_URLS", "").lower() in ("1", "true", "yes")
FAL_MINIMAL_IMG_PAYLOAD = os.environ.get("FAL_MINIMAL_IMG_PAYLOAD", "").lower() in ("1", "true", "yes")

REQUEST_PROXIES = {"http": None, "https": None}
REQUEST_SESSION = requests.Session()
REQUEST_SESSION.trust_env = False

SHOP_SEARCH_URL = os.environ.get("SHOP_SEARCH_URL", "https://shop.app/search?q=")
SHOP_SEARCH_QUERY = os.environ.get("SHOP_SEARCH_QUERY", "hoodie")
SHOP_SEARCH_TIMEOUT = _safe_int(os.environ.get("SHOP_SEARCH_TIMEOUT"), 20)
SHOP_SEARCH_LIMIT = _safe_int(os.environ.get("SHOP_SEARCH_LIMIT"), 6)
SHOP_USE_PLAYWRIGHT = os.environ.get("SHOP_USE_PLAYWRIGHT", "1") == "1"
SHOP_PLAYWRIGHT_TIMEOUT = _safe_int(os.environ.get("SHOP_PLAYWRIGHT_TIMEOUT"), 25)

BOTTOM_KEYWORDS = [
    "pants",
    "jean",
    "trouser",
    "short",
    "skirt",
]

ACCESSORY_KEYWORDS = [
    "hat",
    "cap",
    "beanie",
    "bag",
    "belt",
    "watch",
    "ring",
    "bracelet",
    "necklace",
    "sunglasses",
]

ALLOWED_AVATARS = {"girl", "boy"}
AVATAR_FILES = {
    "girl": "basic girl.png",
    "boy": "basic guy.png",
}

RENDER_INSTRUCTION = (
    "Put the item in the second image onto the person in the first image. "
    "Keep the person's pose and face, keep a clean studio background, and "
    "remove conflicting clothing if needed."
)



def _load_json(path, default):
    if not os.path.isfile(path):
        return default
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def _save_json(path, data):
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2)


def _request_get(url, **kwargs):
    kwargs.setdefault("proxies", REQUEST_PROXIES)
    return REQUEST_SESSION.get(url, **kwargs)


def _request_post(url, **kwargs):
    kwargs.setdefault("proxies", REQUEST_PROXIES)
    return REQUEST_SESSION.post(url, **kwargs)


def _normalize_url(value, base_url=None):
    if not value:
        return None
    if value.startswith("//"):
        return f"https:{value}"
    if value.startswith("/") and base_url:
        return f"{base_url.rstrip('/')}{value}"
    return value


def _coerce_url(value):
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        for key in ("url", "src", "imageUrl", "image_url", "link"):
            url = value.get(key)
            if isinstance(url, str):
                return url
    if isinstance(value, list):
        for entry in value:
            url = _coerce_url(entry)
            if url:
                return url
    return None


def _extract_candidate_image_url(candidate):
    for key in ("imageUrl", "image_url", "image", "thumbnailUrl", "thumbnail_url", "featuredImage"):
        url = _coerce_url(candidate.get(key))
        if url:
            return _normalize_url(url)
    images = candidate.get("images")
    url = _coerce_url(images)
    return _normalize_url(url) if url else None


def _extract_candidate_product_url(candidate):
    for key in ("productUrl", "product_url", "url", "link", "handle"):
        url = candidate.get(key)
        if isinstance(url, str):
            if key == "handle" and not url.startswith("http"):
                return _normalize_url(f"/products/{url}", "https://shop.app")
            return _normalize_url(url, "https://shop.app")
    return None


def _looks_like_product_candidate(candidate):
    if not isinstance(candidate, dict):
        return False
    title = candidate.get("title") or candidate.get("name")
    if not isinstance(title, str) or not title.strip():
        return False
    if not _extract_candidate_image_url(candidate):
        return False
    return True


def _walk_candidates(node, output):
    if isinstance(node, dict):
        if _looks_like_product_candidate(node):
            output.append(node)
        for value in node.values():
            _walk_candidates(value, output)
    elif isinstance(node, list):
        for entry in node:
            _walk_candidates(entry, output)


def _extract_ld_products(node, output):
    if isinstance(node, list):
        for entry in node:
            _extract_ld_products(entry, output)
        return
    if not isinstance(node, dict):
        return
    node_type = node.get("@type")
    if node_type == "ItemList" and isinstance(node.get("itemListElement"), list):
        for entry in node.get("itemListElement", []):
            candidate = entry.get("item") if isinstance(entry, dict) else None
            if candidate:
                output.append(candidate)
    if node_type == "Product":
        output.append(node)
    for value in node.values():
        _extract_ld_products(value, output)


def _parse_shop_search_html(html):
    soup = BeautifulSoup(html, "html.parser")
    candidates = []

    for script in soup.find_all("script", attrs={"type": "application/ld+json"}):
        try:
            data = json.loads(script.string or "")
            _extract_ld_products(data, candidates)
        except (TypeError, json.JSONDecodeError):
            continue

    next_data = soup.find("script", attrs={"id": "__NEXT_DATA__"})
    if next_data and next_data.string:
        try:
            data = json.loads(next_data.string)
            _walk_candidates(data, candidates)
        except json.JSONDecodeError:
            pass

    return candidates


def _candidate_to_item(candidate):
    title = candidate.get("title") or candidate.get("name")
    image_url = _extract_candidate_image_url(candidate)
    if not title or not image_url:
        return None

    product_url = _extract_candidate_product_url(candidate)
    store = (
        candidate.get("store")
        or candidate.get("merchant")
        or candidate.get("brand")
        or candidate.get("vendor")
    )
    if not store and product_url:
        store = urlparse(product_url).netloc
    if not store:
        store = "shop.app"

    product_type = candidate.get("productType") or candidate.get("product_type") or ""
    category = _infer_category(title, product_type)
    key = f"{store}:{title}:{image_url}"
    item_id = f"shop_{hashlib.sha256(key.encode('utf-8')).hexdigest()[:12]}"
    return {
        "id": item_id,
        "name": title.strip(),
        "store": store,
        "productUrl": product_url,
        "imageUrl": image_url,
        "category": category,
        "status": "queued",
    }


def _fetch_shop_search_html_browser(query):
    try:
        from playwright.sync_api import sync_playwright
    except Exception as exc:
        return None, {"error": f"playwright not installed: {exc}"}, []
    if not query:
        return None, {"error": "missing query"}, []
    url = f"{SHOP_SEARCH_URL}{quote_plus(query)}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }
    timeout_ms = SHOP_PLAYWRIGHT_TIMEOUT * 1000
    html = ""
    meta = {"source": "playwright"}
    browser_candidates = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            context = browser.new_context(user_agent=headers["User-Agent"], locale="en-US")
            page = context.new_page()
            response = page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
            try:
                page.wait_for_load_state("networkidle", timeout=timeout_ms)
            except Exception:
                pass
            try:
                page.wait_for_timeout(2000)
            except Exception:
                pass
            html = page.content()
            if "Verifying your connection" in html:
                page.wait_for_timeout(4000)
                html = page.content()
            try:
                browser_candidates = page.evaluate(
                    """() => {
                        const results = [];
                        const seen = new Set();
                        const anchors = Array.from(document.querySelectorAll('a[href]'));
                        for (const a of anchors) {
                            const href = a.getAttribute('href');
                            if (!href) continue;
                            const absolute = new URL(href, window.location.href).href;
                            if (!absolute.includes('/products') && !absolute.includes('/product')) continue;
                            const img = a.querySelector('img');
                            const imageUrl = img?.currentSrc || img?.src || img?.getAttribute('src') || img?.getAttribute('data-src');
                            const titleEl = a.querySelector('h3, h2, [data-testid*="title"], [data-testid*="product"], [class*="title"]');
                            const rawTitle = titleEl?.textContent || img?.alt || a.getAttribute('aria-label') || a.textContent || '';
                            const title = rawTitle.trim();
                            if (!title || !imageUrl) continue;
                            if (seen.has(imageUrl)) continue;
                            seen.add(imageUrl);
                            results.push({ title, imageUrl, productUrl: absolute });
                        }
                        return results;
                    }"""
                )
            except Exception:
                browser_candidates = []
            meta.update(
                {
                    "status": response.status if response else None,
                    "url": page.url,
                    "contentType": "text/html",
                    "length": len(html),
                }
            )
            browser.close()
    except Exception as exc:
        meta["error"] = str(exc)
    return html, meta, browser_candidates


def _fetch_shop_search_html(query):
    if not query:
        return None, None
    url = f"{SHOP_SEARCH_URL}{quote_plus(query)}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    resp = _request_get(
        url,
        headers=headers,
        timeout=SHOP_SEARCH_TIMEOUT,
        allow_redirects=True,
    )
    meta = {
        "status": resp.status_code,
        "url": resp.url,
        "contentType": resp.headers.get("content-type"),
        "length": len(resp.text),
        "source": "http",
    }
    return resp.text, meta


def _search_shop_products(query, limit, debug=False):
    try:
        html, meta = _fetch_shop_search_html(query)
    except Exception as exc:
        if debug:
            return [], {"error": str(exc)}
        return []
    if not html:
        if debug:
            return [], {"error": "empty response"}
        return []
    browser_candidates = []
    blocked = "Verifying your connection" in html
    if meta and meta.get("status", 200) >= 400:
        if debug:
            if blocked:
                meta["block"] = "cloudflare"
            meta["error"] = f"HTTP {meta['status']}"
        if SHOP_USE_PLAYWRIGHT:
            html, meta, browser_candidates = _fetch_shop_search_html_browser(query)
            blocked = "Verifying your connection" in html if html else False
        else:
            return [], meta if debug else []
    if blocked and SHOP_USE_PLAYWRIGHT:
        html, meta, browser_candidates = _fetch_shop_search_html_browser(query)
        blocked = "Verifying your connection" in html if html else False
    if not html:
        if debug:
            return [], meta or {"error": "empty response"}
        return []
    if debug and meta and blocked:
        meta["block"] = "cloudflare"
    if browser_candidates:
        candidates = browser_candidates
    else:
        candidates = _parse_shop_search_html(html)
    items = []
    seen = set()
    for candidate in candidates:
        item = _candidate_to_item(candidate)
        if not item:
            continue
        key = item["imageUrl"]
        if key in seen:
            continue
        seen.add(key)
        items.append(item)
        if len(items) >= limit:
            break
    if debug:
        if meta is None:
            meta = {}
        meta["candidates"] = len(candidates)
        meta["items"] = len(items)
        if browser_candidates:
            meta["browserCandidates"] = len(browser_candidates)
        return items, meta
    return items


def _fal_headers():
    if not FAL_API_KEY:
        raise RuntimeError("FAI.AI_API_KEY is not set.")
    return {"Authorization": f"{FAL_AUTH_SCHEME} {FAL_API_KEY}"}


def _fal_post(endpoint, payload):
    response = _request_post(
        endpoint,
        headers=_fal_headers(),
        json=payload,
        timeout=120,
    )
    if not response.ok:
        raise RuntimeError(f"fal error {response.status_code}: {response.text}")
    return response.json()


def _extract_image_url(data):
    if isinstance(data, dict):
        images = data.get("images")
        if isinstance(images, list):
            for entry in images:
                if isinstance(entry, dict) and entry.get("url"):
                    return entry["url"]
                if isinstance(entry, str):
                    return entry
        for key in ("image", "image_url", "output", "url"):
            if isinstance(data.get(key), str):
                return data[key]
    if isinstance(data, list):
        for entry in data:
            if isinstance(entry, dict) and entry.get("url"):
                return entry["url"]
            if isinstance(entry, str):
                return entry
    return None


def _public_to_local_path(public_url):
    if not public_url:
        return None
    if public_url.startswith("http://") or public_url.startswith("https://"):
        return None
    if public_url.startswith("/"):
        return os.path.join(ROOT_DIR, "frontend", "public", public_url.lstrip("/"))
    return None


def _download_remote_image(url, path):
    resp = _request_get(url, stream=True, timeout=40)
    resp.raise_for_status()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as handle:
        for chunk in resp.iter_content(chunk_size=1024 * 1024):
            if chunk:
                handle.write(chunk)


def _load_image_from_source(source):
    if not source:
        raise ValueError("Missing image source.")
    local_path = _public_to_local_path(source)
    if local_path and os.path.isfile(local_path):
        return Image.open(local_path).convert("RGBA")
    if os.path.isfile(source):
        return Image.open(source).convert("RGBA")
    resp = _request_get(source, stream=True, timeout=30)
    resp.raise_for_status()
    return Image.open(io.BytesIO(resp.content)).convert("RGBA")


def _image_to_data_uri(image):
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _resize_to_height(image, height):
    if image.height == height:
        return image
    scale = height / max(image.height, 1)
    width = max(int(image.width * scale), 1)
    return image.resize((width, height), Image.LANCZOS)


def _prepare_reference_images(avatar_path, item_source):
    avatar = _load_image_from_source(avatar_path)
    item = _load_image_from_source(item_source)

    target_height = max(512, min(RENDER_REF_HEIGHT, max(avatar.height, item.height)))
    avatar = _resize_to_height(avatar, target_height)
    item = _resize_to_height(item, target_height)
    return avatar, item


def _compose_reference_pair(avatar_path, item_source):
    avatar, item = _prepare_reference_images(avatar_path, item_source)

    total_width = avatar.width + RENDER_REF_GAP + item.width
    composite = Image.new("RGBA", (total_width, target_height), (255, 255, 255, 255))
    composite.alpha_composite(avatar, dest=(0, 0))
    composite.alpha_composite(item, dest=(avatar.width + RENDER_REF_GAP, 0))
    return composite


def _get_avatar_path(avatar):
    if avatar not in ALLOWED_AVATARS:
        raise ValueError("Unknown avatar type.")
    filename = AVATAR_FILES.get(avatar, f"{avatar}.png")
    avatar_path = os.path.join(AVATARS_DIR, filename)
    if not os.path.isfile(avatar_path):
        raise RuntimeError(f"Missing avatar image at {avatar_path}.")
    return avatar_path


def _render_item_on_avatar(item, avatar):
    base_path = _get_avatar_path(avatar)
    overlay_source = item.get("previewImage") or item.get("imageUrl")
    if not overlay_source:
        raise RuntimeError("Item is missing image data.")
    prompt = RENDER_INSTRUCTION
    use_image_urls = FAL_USE_IMAGE_URLS or "nano-banana" in FAL_IMG_ENDPOINT
    use_minimal_payload = FAL_MINIMAL_IMG_PAYLOAD or "nano-banana" in FAL_IMG_ENDPOINT

    payload = {"prompt": prompt}
    if use_image_urls:
        avatar_img, item_img = _prepare_reference_images(base_path, overlay_source)
        payload["image_urls"] = [
            _image_to_data_uri(avatar_img),
            _image_to_data_uri(item_img),
        ]
    else:
        guide = _compose_reference_pair(base_path, overlay_source)
        payload["image_url"] = _image_to_data_uri(guide)

    if not use_minimal_payload:
        payload.update(
            {
                "image_size": FAL_IMAGE_SIZE,
                "num_inference_steps": FAL_NUM_STEPS,
                "guidance_scale": FAL_GUIDANCE,
                "strength": FAL_STRENGTH,
            }
        )
    result = _fal_post(FAL_IMG_ENDPOINT, payload)
    image_url = _extract_image_url(result)
    if not image_url:
        raise RuntimeError("Failed to generate outfit preview.")

    filename = f"{item['id']}_{avatar}.png"
    output_path = os.path.join(RENDERS_DIR, filename)
    _download_remote_image(image_url, output_path)
    return f"/renders/{filename}"


def _slug_from_url(url):
    parsed = urlparse(url)
    name = os.path.basename(parsed.path)
    if "." in name:
        return name
    return f"{name}.png"


def _infer_category(title, product_type):
    text = f"{title} {product_type}".lower()
    if any(word in text for word in BOTTOM_KEYWORDS):
        return "bottom"
    if any(word in text for word in ACCESSORY_KEYWORDS):
        return "accessory"
    return "top"


def _download_image(url, item_id):
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    filename = _slug_from_url(url)
    ext = os.path.splitext(filename)[1] or ".png"
    local_name = f"{item_id}{ext}"
    local_path = os.path.join(UPLOADS_DIR, local_name)
    public_path = f"/uploads/{local_name}"

    resp = _request_get(url, stream=True, timeout=20)
    resp.raise_for_status()
    with open(local_path, "wb") as handle:
        for chunk in resp.iter_content(chunk_size=1024 * 1024):
            if chunk:
                handle.write(chunk)

    return local_path, public_path


def _update_catalog(items):
    with LOCK:
        _save_json(CATALOG_PATH, items)


def _update_render_state(item_id, avatar, status, rendered_url=None, error=None):
    with LOCK:
        items = _load_json(CATALOG_PATH, [])
        for entry in items:
            if entry.get("id") != item_id:
                continue
            render_status = entry.get("renderStatus") or {}
            render_status[avatar] = status
            entry["renderStatus"] = render_status
            if rendered_url:
                rendered = entry.get("renderedImages") or {}
                rendered[avatar] = rendered_url
                entry["renderedImages"] = rendered
            if error:
                render_errors = entry.get("renderErrors") or {}
                render_errors[avatar] = error
                entry["renderErrors"] = render_errors
            break
        _save_json(CATALOG_PATH, items)


def _generate_items(items):
    for item in items:
        try:
            _, public_path = _download_image(item["imageUrl"], item["id"])
            item["previewImage"] = public_path
            _update_catalog(items)
            item["status"] = "ready"
        except Exception as exc:
            item["status"] = "error"
            item["error"] = str(exc)
        _update_catalog(items)


@APP.route("/api/preload", methods=["GET", "POST"])
def preload_items():
    limit = int(request.args.get("limit", str(SHOP_SEARCH_LIMIT)))
    query = request.args.get("q") or request.args.get("query") or SHOP_SEARCH_QUERY
    debug = request.args.get("debug") == "1"
    if debug:
        items, meta = _search_shop_products(query, limit, debug=True)
    else:
        items = _search_shop_products(query, limit)
        meta = None

    _update_catalog(items)
    thread = threading.Thread(target=_generate_items, args=(items,), daemon=True)
    thread.start()
    response = {"items": items, "count": len(items), "query": query}
    if debug:
        response["debug"] = meta
    return jsonify(response)


@APP.get("/api/catalog")
def get_catalog():
    return jsonify(_load_json(CATALOG_PATH, []))


@APP.post("/api/render")
def render_item():
    if not FAL_API_KEY:
        return jsonify({"error": "FAI.AI_API_KEY is not set."}), 400

    payload = request.get_json(silent=True) or {}
    item_id = payload.get("itemId")
    avatar = payload.get("avatar", "girl")

    if not item_id:
        return jsonify({"error": "Missing itemId."}), 400
    if avatar not in ALLOWED_AVATARS:
        return jsonify({"error": "Invalid avatar."}), 400

    items = _load_json(CATALOG_PATH, [])
    item = next((entry for entry in items if entry.get("id") == item_id), None)
    if not item:
        return jsonify({"error": "Item not found."}), 404
    if item.get("status") != "ready":
        return jsonify({"error": "Item not ready."}), 409

    existing = (item.get("renderedImages") or {}).get(avatar)
    if existing:
        local_path = _public_to_local_path(existing)
        if local_path and os.path.isfile(local_path):
            return jsonify({"itemId": item_id, "renderedImage": existing})

    try:
        _update_render_state(item_id, avatar, "generating")
        rendered_url = _render_item_on_avatar(item, avatar)
        _update_render_state(item_id, avatar, "ready", rendered_url=rendered_url)
        return jsonify({"itemId": item_id, "renderedImage": rendered_url})
    except Exception as exc:
        _update_render_state(item_id, avatar, "error", error=str(exc))
        return jsonify({"error": str(exc)}), 500


if __name__ == "__main__":
    os.makedirs(ATTACHMENTS_DIR, exist_ok=True)
    os.makedirs(UPLOADS_DIR, exist_ok=True)
    os.makedirs(RENDERS_DIR, exist_ok=True)
    os.makedirs(AVATARS_DIR, exist_ok=True)
    if not os.path.isfile(CATALOG_PATH):
        _save_json(CATALOG_PATH, [])
    APP.run(host="0.0.0.0", port=5000, debug=True)
