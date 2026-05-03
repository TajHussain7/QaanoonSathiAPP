#!/usr/bin/env python3
"""
QaanoonSathi: Legal Document Ingestion Pipeline
═══════════════════════════════════════════════════════════════════════════════
Ingest PDFs from law_data folder → Generate Gemini embeddings → Store in Supabase

Configuration:
- Model: gemini-embedding-001 (3072 dimensions)
- API: Google Generative AI (v1beta)
- Database: Supabase (law_documents table)
- Fallback: Multi-API key support with exponential backoff
═══════════════════════════════════════════════════════════════════════════════
"""

import os
import sys
import time
import logging
from pathlib import Path
from typing import List, Optional, Dict, Tuple
import requests
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor, as_completed

# Auto-install dependencies
for pkg_name, import_name in [("PyPDF2", "PyPDF2"), ("supabase", "supabase")]:
    try:
        __import__(import_name)
    except ImportError:
        print(f"⏳ Installing {pkg_name}...")
        os.system(f"pip install {pkg_name}")

import PyPDF2
from supabase import create_client

# ═════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═════════════════════════════════════════════════════════════════════════════

load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# Gemini Configuration (Must match backend)
GEMINI_EMBEDDING_MODEL = "gemini-embedding-001"
GEMINI_API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"
EXPECTED_DIMS = 3072  # CRITICAL: Gemini API returns 3072-dimensional embeddings

# Ingestion Parameters
LAW_DATA_DIR = Path("./law_data")
CHUNK_SIZE = 500  # Characters per chunk
BATCH_SIZE = 10    # Documents per insert
MAX_RETRIES = 3
INITIAL_RETRY_DELAY = 1  # Seconds
MAX_WORKERS = 5    # Concurrent embedding requests (increase for faster ingestion, decrease if rate-limited)

# ═════════════════════════════════════════════════════════════════════════════
# API KEY MANAGEMENT
# ═════════════════════════════════════════════════════════════════════════════

def get_all_api_keys() -> List[str]:
    """Get all available Gemini API keys in priority order."""
    keys = []
    for key_var in ["GEMINI_API_KEY", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3"]:
        key = os.getenv(key_var, "").strip()
        if key and not key.startswith("YOUR_"):
            keys.append(key)
    return keys


# ═════════════════════════════════════════════════════════════════════════════
# EMBEDDING GENERATION
# ═════════════════════════════════════════════════════════════════════════════

def generate_embedding(text: str) -> Optional[List[float]]:
    """
    Generate 3072-dim embedding using gemini-embedding-001 via REST API.
    Tries multiple API keys with automatic fallback.
    
    Args:
        text: Text to embed (will be truncated to 5000 chars)
    
    Returns:
        List of 3072 floats, or None if all attempts fail
    """
    all_keys = get_all_api_keys()
    if not all_keys:
        logger.error("❌ No Gemini API keys found in .env")
        return None
    
    truncated = text[:5000]
    last_error = None
    
    for key_idx, api_key in enumerate(all_keys):
        key_label = "Primary" if key_idx == 0 else f"Fallback {key_idx}"
        
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                url = f"{GEMINI_API_ENDPOINT}/{GEMINI_EMBEDDING_MODEL}:embedContent?key={api_key}"
                
                response = requests.post(
                    url,
                    json={"content": {"parts": [{"text": truncated}]}},
                    timeout=30
                )
                
                if not response.ok:
                    error_msg = response.json().get("error", {}).get("message", f"HTTP {response.status_code}")
                    
                    if response.status_code in [429, 503] and attempt < MAX_RETRIES:
                        delay = INITIAL_RETRY_DELAY * (2 ** (attempt - 1))
                        logger.debug(f"  ⏳ {key_label} transient error, retrying in {delay}s...")
                        time.sleep(delay)
                        continue
                    
                    raise Exception(error_msg)
                
                data = response.json()
                embedding = data.get("embedding", {}).get("values", [])
                
                if not embedding or len(embedding) != EXPECTED_DIMS:
                    raise Exception(f"Invalid embedding: dimension {len(embedding)} != {EXPECTED_DIMS}")
                
                logger.debug(f"  ✅ Embedding generated ({key_label})")
                return embedding
                
            except Exception as e:
                last_error = e
                if attempt == MAX_RETRIES and key_idx < len(all_keys) - 1:
                    logger.debug(f"  ⚠️  {key_label} failed, trying next key...")
                    break
                elif attempt == MAX_RETRIES:
                    logger.error(f"  ❌ {key_label} failed: {str(e)[:80]}")
    
    logger.error(f"❌ Embedding failed for all keys: {str(last_error)[:100]}")
    return None


# ═════════════════════════════════════════════════════════════════════════════
# PDF PROCESSING
# ═════════════════════════════════════════════════════════════════════════════

def extract_text_from_pdf(pdf_path: Path) -> Optional[str]:
    """Extract text from PDF file."""
    try:
        text = ""
        with open(pdf_path, 'rb') as f:
            reader = PyPDF2.PdfReader(f)
            for page_num, page in enumerate(reader.pages):
                page_text = page.extract_text()
                if page_text:
                    text += f"\n--- Page {page_num + 1} ---\n{page_text}"
        
        if not text.strip():
            logger.warning(f"  ⚠️  No text extracted from {pdf_path.name}")
            return None
        
        logger.debug(f"  ✅ Extracted {len(text)} characters")
        return text
        
    except Exception as e:
        logger.error(f"  ❌ PDF extraction failed: {str(e)}") 
        return None


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE) -> List[str]:
    """Split text into chunks at sentence boundaries."""
    if len(text) <= chunk_size:
        return [text]
    
    chunks = []
    current_chunk = ""
    
    # Split by common sentence endings
    import re
    sentences = re.split(r'(?<=[.!?])\s+', text)
    
    for sentence in sentences:
        if len(current_chunk) + len(sentence) <= chunk_size:
            current_chunk += " " + sentence
        else:
            if current_chunk.strip():
                chunks.append(current_chunk.strip())
            current_chunk = sentence
    
    if current_chunk.strip():
        chunks.append(current_chunk.strip())
    
    return chunks if chunks else [text]


def detect_category(filename: str) -> str:
    """Infer document category from filename."""
    filename_lower = filename.lower()
    
    if any(w in filename_lower for w in ['islamic', 'sharia', 'quran']):
        return 'islamic_law'
    elif any(w in filename_lower for w in ['inherit', 'succession', 'waris']):
        return 'inheritance'
    elif any(w in filename_lower for w in ['harass', 'abuse', 'violence']):
        return 'harassment'
    elif any(w in filename_lower for w in ['penal', 'criminal']):
        return 'criminal_law'
    else:
        return 'general'


# ═════════════════════════════════════════════════════════════════════════════
# SUPABASE OPERATIONS
# ═════════════════════════════════════════════════════════════════════════════

def init_supabase():
    """Initialize Supabase client."""
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_KEY", "").strip()
    
    if not url or not key:
        logger.error("❌ SUPABASE_URL or SUPABASE_SERVICE_KEY missing")
        return None
    
    try:
        return create_client(url, key)
    except Exception as e:
        logger.error(f"❌ Supabase connection failed: {e}")
        return None


def insert_documents(supabase, documents: List[Dict]) -> Tuple[int, int]:
    """
    Insert documents into law_documents table.
    Returns (successful_count, failed_count)
    """
    if not documents:
        return 0, 0
    
    successful = 0
    failed = 0
    
    try:
        response = supabase.table("law_documents").insert(documents).execute()
        successful = len(documents)
        logger.info(f"  ✅ Inserted {successful} documents")
        return successful, 0
        
    except Exception as e:
        logger.error(f"  ❌ Insert failed: {str(e)[:100]}")
        return 0, len(documents)


# ═════════════════════════════════════════════════════════════════════════════
# MAIN PIPELINE
# ═════════════════════════════════════════════════════════════════════════════

def main():
    """Main ingestion pipeline."""
    logger.info("\n" + "═" * 80)
    logger.info("🚀 QaanoonSathi Legal Document Ingestion")
    logger.info("═" * 80)
    
    # Validate directory
    if not LAW_DATA_DIR.exists():
        logger.error(f"❌ Directory not found: {LAW_DATA_DIR}")
        return
    
    # Find PDFs
    pdf_files = list(LAW_DATA_DIR.glob("*.pdf")) + list(LAW_DATA_DIR.glob("**/*.pdf"))
    pdf_files = list(set(pdf_files))
    
    if not pdf_files:
        logger.warning(f"⚠️  No PDFs found in {LAW_DATA_DIR}")
        return
    
    logger.info(f"📄 Found {len(pdf_files)} PDF files")
    logger.info(f"🔧 Model: {GEMINI_EMBEDDING_MODEL} ({EXPECTED_DIMS} dims)")
    logger.info(f"📊 Chunk size: {CHUNK_SIZE} characters")
    logger.info("-" * 80)
    
    # Initialize Supabase
    supabase = init_supabase()
    if not supabase:
        return
    
    # Statistics
    total_successful = 0
    total_failed = 0
    failed_files = []
    
    # Process each PDF
    for pdf_idx, pdf_path in enumerate(pdf_files, 1):
        logger.info(f"\n[{pdf_idx}/{len(pdf_files)}] {pdf_path.name}")
        
        # Extract text
        text = extract_text_from_pdf(pdf_path)
        if not text:
            failed_files.append(pdf_path.name)
            continue
        
        # Chunk text
        chunks = chunk_text(text)
        logger.info(f"  📦 {len(chunks)} chunks")
        
        # Prepare documents with parallel embedding generation
        documents = []
        category = detect_category(pdf_path.name)
        
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            # Submit all embedding tasks
            future_to_chunk = {
                executor.submit(generate_embedding, chunk): (chunk_idx, chunk)
                for chunk_idx, chunk in enumerate(chunks)
            }
            
            # Collect results as they complete
            for future in as_completed(future_to_chunk):
                chunk_idx, chunk = future_to_chunk[future]
                try:
                    embedding = future.result()
                    if embedding:
                        documents.append({
                            "content": chunk,
                            "embedding": embedding,
                            "category": category,
                            "source": pdf_path.stem,
                            "section": f"Chunk {chunk_idx + 1}",
                            "lang": "mixed",
                        })
                    else:
                        logger.debug(f"    ⚠️  Skipping chunk {chunk_idx + 1}")
                except Exception as e:
                    logger.warning(f"    ⚠️  Chunk {chunk_idx + 1} failed: {str(e)[:50]}")
        
        # Insert batch
        if documents:
            successful, failed = insert_documents(supabase, documents)
            total_successful += successful
            total_failed += failed
        
        logger.info(f"  ✅ Completed")
    
    # Summary
    logger.info("\n" + "═" * 80)
    logger.info("📊 INGESTION SUMMARY")
    logger.info("═" * 80)
    logger.info(f"PDFs processed:       {len(pdf_files) - len(failed_files)}/{len(pdf_files)}")
    logger.info(f"Documents stored:     {total_successful}")
    logger.info(f"Documents failed:     {total_failed}")
    
    if failed_files:
        logger.warning(f"Failed files: {', '.join(failed_files)}")
    
    logger.info("═" * 80)
    logger.info("✅ Ingestion complete!\n")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\n⏸️  Ingestion cancelled by user")
    except Exception as e:
        logger.error(f"\n❌ Fatal error: {e}")
        sys.exit(1)
