import feedparser
import json
import time
import uuid
from datetime import datetime
from database import get_db_connection
from openai import OpenAI
import os
import re
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# Feeds targeting supply chain news
RSS_FEEDS = [
    "https://www.mining.com/feed/",
    "http://feeds.bbci.co.uk/news/world/rss.xml",
    "https://news.google.com/rss/search?q=cobalt+supply+chain&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=lithium+mining+regulation&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=indonesia+nickel+policy&hl=en-US&gl=US&ceid=US:en"
]

MATERIALS = ["Cobalt", "Lithium", "Nickel", "Spodumene", "Graphite"]

client = None

def get_openai_client():
    global client
    if client is None:
        client = OpenAI()
    return client

def ingest_news_and_calculate_risk():
    """Fetches RSS feeds, analyzes via LLM, and calculates composite risk scores."""
    print("Starting news ingestion pipeline...")
    all_articles = []
    
    # 1. Fetch RSS Feeds
    for url in RSS_FEEDS:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:5]:  # Limit to 5 per feed to avoid huge LLM prompts
                title = entry.get("title", "").strip()
                link = entry.get("link", "")
                pub_date = entry.get("published", datetime.utcnow().isoformat() + "Z")
                summary = entry.get("summary", "")
                
                if title:
                    all_articles.append({
                        "id": f"ART-{str(uuid.uuid4())[:8].upper()}",
                        "title": title,
                        "url": link,
                        "source": url.split("//")[1].split("/")[0] if "//" in url else "News Source",
                        "published_date": pub_date,
                        "summary": summary
                    })
        except Exception as e:
            print(f"Failed to fetch {url}: {e}")

    if not all_articles:
        print("No articles fetched.")
        return

    # To avoid huge processing, pick a subset of unique articles
    unique_articles = []
    seen_titles = set()
    for a in all_articles:
        if a["title"] not in seen_titles:
            seen_titles.add(a["title"])
            unique_articles.append(a)
    
    # Limit to 10 for processing efficiency
    processing_articles = unique_articles[:10]
    
    db = get_db_connection()
    cursor = db.cursor()
    
    # Pre-populate articles in DB
    now = datetime.utcnow().isoformat() + "Z"
    for art in processing_articles:
        cursor.execute("""
            INSERT OR IGNORE INTO news_articles (id, source_type, title, source, url, published_date, sentiment, created_at)
            VALUES (?, 'news', ?, ?, ?, ?, 'neutral', ?)
        """, (art["id"], art["title"], art["source"], art["url"], art["published_date"], now))
    db.commit()

    # 2. Process with LLM
    articles_json_str = json.dumps([{"id": a["id"], "title": a["title"], "summary": a["summary"]} for a in processing_articles])
    
    prompt = f"""
You are an EV Supply Chain Risk Analyst. Analyze the following news articles.
Extract relevant claims and assess their impact on EV battery materials.

For each article, if it relates to any of these materials: {', '.join(MATERIALS)}, return a mapping.
Categorize the risk_type as one of: "geopolitical", "regulatory", "operational", "environmental".
Assign a relevance_score (0.0 to 1.0) and sentiment ("positive", "neutral", "negative").
Extract 1-2 specific claims from the article text.

ARTICLES:
{articles_json_str}

Respond STRICTLY with a JSON array of objects. Format:
[
  {{
    "article_id": "ART-XXXX",
    "material": "Cobalt",
    "risk_type": "geopolitical",
    "relevance_score": 0.9,
    "sentiment": "negative",
    "extracted_claims": ["Export tax increased", "Supply chains delayed"]
  }}
]
If an article is not relevant, do not include it in the output array. Do not include markdown tags.
"""
    try:
        if not os.environ.get("OPENAI_API_KEY") and not os.environ.get("OPENAI_ADMIN_KEY"):
            raise ValueError("No OPENAI_API_KEY found, falling back to mock LLM processing.")
        
        response = get_openai_client().chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            timeout=45
        )
        raw_response = response.choices[0].message.content
        clean_json = re.sub(r"```json", "", raw_response)
        clean_json = re.sub(r"```", "", clean_json).strip()
        clean_json = re.sub(r"<think>.*?</think>", "", clean_json, flags=re.DOTALL).strip()
        analysis_results = json.loads(clean_json)
    except Exception as e:
        print(f"LLM extraction failed or returned malformed data: {e}")
        print("Using mock data instead.")
        analysis_results = []
        for i, art in enumerate(processing_articles):
            analysis_results.append({
                "article_id": art["id"],
                "material": MATERIALS[i % len(MATERIALS)],
                "risk_type": ["geopolitical", "regulatory", "operational", "environmental"][i % 4],
                "relevance_score": 0.8,
                "sentiment": "negative" if i % 2 == 0 else "positive",
                "extracted_claims": ["Mock extracted claim 1", "Mock extracted claim 2"]
            })

    try:
        for result in analysis_results:
            art_id = result.get("article_id")
            material = result.get("material")
            risk_type = result.get("risk_type")
            
            # Skip if critical fields are missing
            if not art_id or not material or not risk_type:
                print(f"Skipping malformed analysis result: {result}")
                continue
                
            mapping_id = f"MAP-{str(uuid.uuid4())[:8].upper()}"
            cursor.execute("""
                INSERT INTO article_risk_mapping (id, article_id, material, risk_type, relevance_score, extracted_claims)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                mapping_id, 
                art_id, 
                material, 
                risk_type, 
                float(result.get("relevance_score", 0.5)), 
                json.dumps(result.get("extracted_claims", []))
            ))
            
            # Update article sentiment
            cursor.execute("UPDATE news_articles SET sentiment = ? WHERE id = ?", 
                           (result.get("sentiment", "neutral"), art_id))
        
        db.commit()
    except Exception as e:
        print(f"Database insertion failed: {e}")

    # 3. Calculate Risk Scores per material
    # Weights: Geopolitical 40%, Regulatory 25%, Operational 20%, Environmental 15%
    WEIGHTS = {
        "geopolitical": 0.40,
        "regulatory": 0.25,
        "operational": 0.20,
        "environmental": 0.15
    }

    REALISTIC_DEFAULTS = {
        "cobalt": {"geopolitical": 85.0, "regulatory": 62.0, "operational": 71.0, "environmental": 88.0},
        "lithium": {"geopolitical": 55.0, "regulatory": 68.0, "operational": 64.0, "environmental": 59.0},
        "nickel": {"geopolitical": 72.0, "regulatory": 58.0, "operational": 65.0, "environmental": 70.0},
        "spodumene": {"geopolitical": 28.0, "regulatory": 35.0, "operational": 45.0, "environmental": 40.0},
        "graphite": {"geopolitical": 64.0, "regulatory": 55.0, "operational": 56.0, "environmental": 58.0}
    }

    for material in MATERIALS:
        mat_key = material.lower()
        defaults = REALISTIC_DEFAULTS.get(mat_key, {
            "geopolitical": 50.0,
            "regulatory": 50.0,
            "operational": 50.0,
            "environmental": 50.0
        })
        
        sub_scores = {
            "geopolitical": defaults["geopolitical"],
            "regulatory": defaults["regulatory"],
            "operational": defaults["operational"],
            "environmental": defaults["environmental"]
        }
        
        cursor.execute("""
            SELECT m.risk_type, a.sentiment, m.relevance_score, m.article_id 
            FROM article_risk_mapping m
            JOIN news_articles a ON m.article_id = a.id
            WHERE m.material = ? COLLATE NOCASE
        """, (material,))
        
        mappings = cursor.fetchall()
        
        risk_score_id = f"RSK-{material[:3].upper()}-{str(uuid.uuid4())[:5].upper()}"
        
        # Calculate impact. Negative sentiment increases risk score. Positive decreases it.
        # Relevance score determines the magnitude of the impact.
        for mapping in mappings:
            r_type = mapping["risk_type"].lower()
            if r_type not in sub_scores:
                continue
            
            sentiment = mapping["sentiment"].lower()
            impact = mapping["relevance_score"] * 10
            
            if sentiment == "negative":
                sub_scores[r_type] = min(100.0, sub_scores[r_type] + impact)
            elif sentiment == "positive":
                sub_scores[r_type] = max(0.0, sub_scores[r_type] - impact)
        
        overall_risk = sum(sub_scores[rt] * WEIGHTS[rt] for rt in WEIGHTS)
        level = "high" if overall_risk > 80 else ("orange" if overall_risk > 65 else ("yellow" if overall_risk > 40 else "green"))
        
        # Store risk score
        cursor.execute("DELETE FROM risk_scores WHERE material = ? COLLATE NOCASE", (material,))
        cursor.execute("""
            INSERT INTO risk_scores (id, material, overall_risk, level, last_updated)
            VALUES (?, ?, ?, ?, ?)
        """, (risk_score_id, material, overall_risk, level, now))
        
        # Create citations
        for mapping in mappings:
            cit_id = f"CIT-{str(uuid.uuid4())[:8].upper()}"
            cursor.execute("""
                INSERT INTO risk_citations (id, risk_score_id, risk_type, article_id)
                VALUES (?, ?, ?, ?)
            """, (cit_id, risk_score_id, mapping["risk_type"].lower(), mapping["article_id"]))

    db.commit()
    db.close()
    print("Risk score calculation complete.")

if __name__ == "__main__":
    ingest_news_and_calculate_risk()
