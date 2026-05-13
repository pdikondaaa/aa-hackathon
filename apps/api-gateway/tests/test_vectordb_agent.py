"""
Test script: pgvector connection, embedding dimension verification,
RAG retrieval, and agent routing end-to-end.

Run from the api-gateway root:
    cd apps/api-gateway
    python -m pytest tests/test_vectordb_agent.py -v
  or directly:
    python tests/test_vectordb_agent.py
"""
import os
import sys
import time

# Make sure app/ is importable when run directly
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.chdir(os.path.join(os.path.dirname(__file__), ".."))

from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[3] / ".env")

# ── expected values ───────────────────────────────────────────────────────────
# all-MiniLM-L6-v2 produces 384-dim vectors; nomic-embed-text produces 768-dim.
# The DB was ingested via the SharePoint job using EMBEDDING_MODEL from .env.
EXPECTED_EMBEDDING_DIM = 384
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"
WARN = "\033[93m!\033[0m"


def _banner(title: str) -> None:
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)


# ─────────────────────────────────────────────────────────────────────────────
# 1. DB connection
# ─────────────────────────────────────────────────────────────────────────────

def test_db_connection() -> bool:
    _banner("1. PostgreSQL / pgvector connection")
    try:
        from psycopg2 import pool as _pg_pool
        from pgvector.psycopg2 import register_vector

        host = os.getenv("SQL_HOST", "localhost")
        port = os.getenv("SQL_PORT", "5432")
        user = os.getenv("SQL_USERNAME", "")
        pwd  = os.getenv("SQL_PWD", "")
        db   = os.getenv("SQL_DB", "aura")

        from urllib.parse import quote_plus
        url = f"postgresql://{quote_plus(user)}:{quote_plus(pwd)}@{host}:{port}/{db}"

        p = _pg_pool.ThreadedConnectionPool(1, 2, url)
        conn = p.getconn()
        register_vector(conn)
        with conn.cursor() as cur:
            cur.execute("SELECT version();")
            version = cur.fetchone()[0]
        p.putconn(conn)
        p.closeall()

        print(f"{PASS} Connected  — {version[:60]}")
        return True
    except Exception as exc:
        print(f"{FAIL} Connection failed: {exc}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# 2. Schema check — documents / document_chunks tables exist
# ─────────────────────────────────────────────────────────────────────────────

def test_schema() -> bool:
    _banner("2. Schema: documents & document_chunks tables")
    try:
        from app.rag.retriever import _get_db_conn, _release_conn
        from psycopg2.extras import RealDictCursor

        conn = _get_db_conn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_name IN ('documents', 'document_chunks')
                    ORDER BY table_name;
                """)
                rows = [r["table_name"] for r in cur.fetchall()]
        finally:
            _release_conn(conn)

        missing = {"documents", "document_chunks"} - set(rows)
        if missing:
            print(f"{FAIL} Missing tables: {missing}")
            return False

        print(f"{PASS} Tables present: {rows}")
        return True
    except Exception as exc:
        print(f"{FAIL} Schema check failed: {exc}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# 3. Embedding dimension — stored vs model output
# ─────────────────────────────────────────────────────────────────────────────

def test_embedding_dimensions() -> bool:
    _banner("3. Embedding dimension consistency")
    ok = True

    # 3a. What dim does the embedder produce?
    try:
        from langchain_huggingface import HuggingFaceEmbeddings
        embedder = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
        vec = embedder.embed_query("test")
        actual_dim = len(vec)
        match = actual_dim == EXPECTED_EMBEDDING_DIM
        icon = PASS if match else FAIL
        print(f"{icon} Model '{EMBEDDING_MODEL}' → {actual_dim}-dim "
              f"(expected {EXPECTED_EMBEDDING_DIM})")
        if not match:
            print(f"   Update EXPECTED_EMBEDDING_DIM in this script to {actual_dim}")
            ok = False
    except Exception as exc:
        print(f"{FAIL} Could not load embedder: {exc}")
        ok = False

    # 3b. What dim is stored in the DB?
    try:
        from app.rag.retriever import _get_db_conn, _release_conn
        from psycopg2.extras import RealDictCursor

        conn = _get_db_conn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("""
                    SELECT vector_dims(embedding) AS dim
                    FROM document_chunks
                    WHERE embedding IS NOT NULL
                    LIMIT 1;
                """)
                row = cur.fetchone()
        finally:
            _release_conn(conn)

        if row is None:
            print(f"{WARN} document_chunks is empty — no stored embeddings to check")
        else:
            db_dim = row["dim"]
            match = db_dim == EXPECTED_EMBEDDING_DIM
            icon = PASS if match else FAIL
            print(f"{icon} DB stored dim={db_dim}  (expected {EXPECTED_EMBEDDING_DIM})")
            if not match:
                print(
                    f"   {WARN} MISMATCH! Retrieval similarity scores will be wrong.\n"
                    f"   Re-ingest with EMBEDDING_MODEL={EMBEDDING_MODEL} "
                    f"or update the retriever to match the stored {db_dim}-dim model."
                )
                ok = False
    except Exception as exc:
        print(f"{FAIL} DB dim check failed: {exc}")
        ok = False

    return ok


# ─────────────────────────────────────────────────────────────────────────────
# 4. Row count + sample data
# ─────────────────────────────────────────────────────────────────────────────

def test_data_health() -> bool:
    _banner("4. Data health — row counts & sample chunk")
    try:
        from app.rag.retriever import _get_db_conn, _release_conn
        from psycopg2.extras import RealDictCursor

        conn = _get_db_conn()
        try:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT COUNT(*) AS n FROM documents;")
                doc_count = cur.fetchone()["n"]

                cur.execute("SELECT COUNT(*) AS n FROM document_chunks;")
                chunk_count = cur.fetchone()["n"]

                cur.execute("""
                    SELECT d.document_name, dc.chunk_text
                    FROM document_chunks dc
                    JOIN documents d ON d.id = dc.document_id
                    LIMIT 1;
                """)
                sample = cur.fetchone()
        finally:
            _release_conn(conn)

        print(f"{PASS} documents={doc_count}  document_chunks={chunk_count}")
        if sample:
            snippet = sample["chunk_text"][:120].replace("\n", " ")
            print(f"     Sample: [{sample['document_name']}] {snippet}…")
        else:
            print(f"{WARN} No chunks found — run the SharePoint ingestion job first")

        return doc_count > 0 and chunk_count > 0
    except Exception as exc:
        print(f"{FAIL} Data health check failed: {exc}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# 5. RAG retrieval — similarity scores
# ─────────────────────────────────────────────────────────────────────────────

def test_retrieval(query: str = "What is the leave policy?") -> bool:
    _banner(f"5. RAG retrieval — '{query}'")
    try:
        from app.rag.retriever import retrieve_chunks

        t0 = time.time()
        chunks = retrieve_chunks(query, top_k=5)
        elapsed = time.time() - t0

        if not chunks:
            print(f"{WARN} No chunks returned — DB may be empty")
            return False

        print(f"{PASS} {len(chunks)} chunks in {elapsed:.2f}s")
        for i, c in enumerate(chunks, 1):
            sim = c.get("similarity", 0)
            name = c.get("document_name", "?")
            snippet = (c.get("chunk_text") or "")[:80].replace("\n", " ")
            icon = PASS if sim >= 0.3 else WARN
            print(f"  {icon} [{i}] sim={sim:.3f}  doc={name}  text={snippet}…")

        low_sim = [c for c in chunks if (c.get("similarity") or 0) < 0.2]
        if low_sim:
            print(f"\n  {WARN} {len(low_sim)}/{len(chunks)} chunks have similarity < 0.2 — "
                  f"possible embedding model mismatch between ingestion and retrieval.")

        return True
    except Exception as exc:
        print(f"{FAIL} Retrieval failed: {exc}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# 6. Agent routing smoke test
# ─────────────────────────────────────────────────────────────────────────────

def test_agent_routing() -> bool:
    _banner("6. Agent routing + slave mode check")
    cases = [
        ("What is the leave policy?",      ["hr"]),
        ("How do I reset my VPN?",          ["it"]),
        ("How do I submit a ZOHO expense?", ["finance"]),
        ("Tell me about the company",       ["org"]),
    ]
    all_ok = True
    try:
        from app.agents.supervisor_agent import _master

        for query, expected_domains in cases:
            t0 = time.time()
            routed = _master._route(query)
            elapsed = time.time() - t0
            hit = any(d in routed for d in expected_domains)
            icon = PASS if hit else FAIL
            print(f"  {icon} '{query[:45]}' → {routed}  ({elapsed:.2f}s)")
            if not hit:
                all_ok = False

        # Check that loaded slaves are in llm or keyword mode (never rag)
        print()
        for domain, slave in _master._slaves.items():
            mode = getattr(slave, '_mode', 'unknown')
            expected_modes = {"llm", "keyword"}
            icon = PASS if mode in expected_modes else WARN
            print(f"  {icon} slave[{domain}].mode = {mode}")
            if mode not in expected_modes:
                print(f"     {WARN} Unexpected mode — check agent setup")

    except Exception as exc:
        print(f"{FAIL} Routing test failed: {exc}")
        return False
    return all_ok


# ─────────────────────────────────────────────────────────────────────────────
# 7. Full end-to-end (optional — requires Ollama running)
# ─────────────────────────────────────────────────────────────────────────────

def test_end_to_end(query: str = "What is the maternity leave policy?") -> bool:
    _banner(f"7. End-to-end answer — '{query}'")
    try:
        from app.agents.supervisor_agent import run_assistant

        t0 = time.time()
        answer = run_assistant(query)
        elapsed = time.time() - t0

        if answer and len(answer) > 20:
            print(f"{PASS} Got answer in {elapsed:.2f}s ({len(answer)} chars)")
            print(f"\n--- Answer preview ---\n{answer[:400]}\n--- end ---")
            return True
        else:
            print(f"{WARN} Short/empty answer ({elapsed:.2f}s): {answer!r}")
            return False
    except Exception as exc:
        print(f"{FAIL} End-to-end failed: {exc}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Runner
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    results = {}
    results["db_connection"]        = test_db_connection()
    results["schema"]               = test_schema()
    results["embedding_dimensions"] = test_embedding_dimensions()
    results["data_health"]          = test_data_health()
    results["retrieval"]            = test_retrieval()
    results["agent_routing"]        = test_agent_routing()

    skip_e2e = "--skip-e2e" in sys.argv
    if not skip_e2e:
        results["end_to_end"] = test_end_to_end()

    _banner("Summary")
    all_pass = True
    for name, passed in results.items():
        icon = PASS if passed else FAIL
        print(f"  {icon}  {name}")
        if not passed:
            all_pass = False

    print()
    if all_pass:
        print("All checks passed.")
    else:
        print("Some checks failed — see output above.")
        sys.exit(1)
