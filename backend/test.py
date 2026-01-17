import requests
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

# 1. AGGRESSIVE JUNK FILTER (Prevents HackerOne and Test sites from even being pinged)
JUNK_KEYWORDS = [
    '0x', 'dev-', 'test-', 'hackerone', 'webinar', 'demo', 'sandbox', 'trial', 
    'myshopify-admin', 'storefront', 'api-', 'cdn-', 'proxy', 'bugbounty'
]

NICHE_KEYWORDS = {
    'clothing': ['shirt', 'hoodie', 'apparel', 'jeans', 'tee', 'short', 'jacket', 'dress'],
    'accessories': ['jewelry', 'necklace', 'ring', 'bag', 'bracelet', 'watch', 'hat', 'sunglasses']
}

def find_shopify_domains(limit=200):
    # Wildcard search for subdomains. 
    # Using 'shop%' as a prefix can often yield higher quality retail results
    url = f"https://crt.sh/?q=%25.myshopify.com&output=json"
    print("[*] Fetching candidate stores from CT Logs...")
    try:
        response = requests.get(url, timeout=40)
        data = response.json()
        raw_domains = {entry['common_name'].lower() for entry in data if "*" not in entry['common_name']}
        
        # Filter out the junk early
        filtered = [d for d in raw_domains if not any(j in d for j in JUNK_KEYWORDS)]
        print(f"[+] Found {len(filtered)} high-probability domains.")
        return filtered[:limit]
    except Exception as e:
        print(f"[!] Discovery Error: {e}")
        return []

def verify_niche(domain, niche):
    url = f"https://{domain}/products.json?limit=12"
    keywords = NICHE_KEYWORDS.get(niche, [])
    
    try:
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'}
        response = requests.get(url, headers=headers, timeout=8)
        
        # Hackerone and dead sites often redirect or return 401/404
        if response.status_code != 200:
            return None

        products = response.json().get('products', [])
        valid_items = []

        for p in products:
            # CHECK 1: Title or Product Type match
            content_text = f"{p.get('title', '')} {p.get('product_type', '')}".lower()
            
            # CHECK 2: Is it a real product? (Must have image and price > 0)
            price = float(p['variants'][0]['price']) if p.get('variants') else 0
            has_image = len(p.get('images', [])) > 0
            
            if any(k in content_text for k in keywords) and price > 0 and has_image:
                valid_items.append(p)

        # Only return if we found at least 2 real products in this niche
        if len(valid_items) >= 2:
            return (domain, valid_items[:3])
    except:
        pass
    return None

def run_stage(domains, niche):
    print(f"\n>>> SEARCHING FOR {niche.upper()} STORES...")
    found_count = 0
    with ThreadPoolExecutor(max_workers=35) as executor:
        futures = {executor.submit(verify_niche, d, niche): d for d in domains}
        for future in as_completed(futures):
            res = future.result()
            if res:
                domain, items = res
                print(f"\n[✓] {niche.upper()} FOUND: {domain}")
                for i in items:
                    print(f"  • {i['title']} (${i['variants'][0]['price']})")
                found_count += 1
    if found_count == 0:
        print(f"[-] No {niche} stores found in this batch.")

if __name__ == "__main__":
    stores = find_shopify_domains(limit=400) # Increased limit to find more "real" stores
    if stores:
        run_stage(stores, 'clothing')
        run_stage(stores, 'accessories')