from app.agents.router import router
from app.agents.hr_agent import hr_agent
from app.agents.admin_agent import admin_agent
from app.agents.it_agent import it_agent
from app.agents.org_agent import org_agent
from typing import Dict, Any, List

# Lazy-import retriever so startup never fails if DB is unavailable
def _retrieve(query: str, top_k: int = 5) -> List[dict]:
    try:
        from app.rag.retriever import retrieve_chunks
        return retrieve_chunks(query, top_k=top_k)
    except Exception:
        return []


class SupervisorAgent:
    def __init__(self):
        self.agents = {
            'hr': hr_agent,
            'admin': admin_agent,
            'it': it_agent,
            'org': org_agent
        }

        self.agent_descriptions = {
            'hr': 'Human Resources - handles leave policies, employee benefits, performance reviews, and HR procedures',
            'admin': 'Administration - manages travel, expenses, office supplies, events, and administrative procedures',
            'it': 'Information Technology - handles technical support, software/hardware issues, security, and IT policies',
            'org': 'Organization - provides company information, policies, structure, and general organizational details'
        }

    def _analyze_query_complexity(self, query: str) -> Dict[str, Any]:
        """Analyze query to determine if it needs multiple agents or escalation."""
        query_lower = query.lower()

        # Check for multi-department queries
        departments_mentioned = []
        if any(word in query_lower for word in ['hr', 'human resources', 'leave', 'benefits', 'salary']):
            departments_mentioned.append('hr')
        if any(word in query_lower for word in ['travel', 'expense', 'office', 'admin']):
            departments_mentioned.append('admin')
        if any(word in query_lower for word in ['computer', 'software', 'network', 'it', 'technical']):
            departments_mentioned.append('it')

        # Check for urgent/escalation keywords
        urgent_keywords = ['urgent', 'emergency', 'immediately', 'asap', 'critical', 'broken']
        is_urgent = any(word in query_lower for word in urgent_keywords)

        # Check for complex queries
        complex_indicators = ['and', 'also', 'as well as', 'plus', 'multiple', 'both']
        is_complex = any(indicator in query_lower for indicator in complex_indicators)

        return {
            'departments_mentioned': departments_mentioned,
            'is_urgent': is_urgent,
            'is_complex': is_complex,
            'needs_multiple_agents': len(departments_mentioned) > 1 or is_complex
        }

    def _format_rag_response(self, chunks: List[dict]):
        """Extract answer text and structured sources from vector DB chunks."""
        sources = []
        answer_parts = []

        for i, chunk in enumerate(chunks, 1):
            text = chunk.get("chunk_text", "").strip()
            file_name = chunk.get("document_name", "Unknown source")
            source_url = chunk.get("source_url") or ""
            similarity = chunk.get("similarity", 0)

            if text:
                answer_parts.append(text)

            sources.append({
                "index": i,
                "file_name": file_name,
                "source_url": source_url,
                "similarity": round(similarity * 100),
            })

        return "\n\n".join(answer_parts), sources

    def process_query(self, query: str) -> Dict[str, Any]:
        """Route query, retrieve from vector DB, fall back to static agents."""
        agent, confidence = router.route_query(query)
        analysis = self._analyze_query_complexity(query)

        # Primary path: vector DB retrieval
        chunks = _retrieve(query, top_k=5)
        sources = []

        if chunks:
            answer, sources = self._format_rag_response(chunks)
        else:
            # Fallback: static agent response when DB is empty or unavailable
            answer = self.agents[agent](query)

        if analysis['is_urgent']:
            answer += "\n\n**URGENT** — If you need immediate assistance, contact the relevant department directly."

        return {"answer": answer, "sources": sources}

# Global supervisor instance
supervisor = SupervisorAgent()

def run_assistant(query: str) -> Dict[str, Any]:
    """Main entry point - supervisor agent coordinates all requests."""
    return supervisor.process_query(query)
