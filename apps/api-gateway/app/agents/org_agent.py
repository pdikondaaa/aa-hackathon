from typing import List


def _retrieve(query: str, top_k: int = 5) -> List[dict]:
    try:
        from app.rag.retriever import retrieve_chunks
        return retrieve_chunks(query, top_k=top_k)
    except Exception:
        return []


def org_agent(query: str) -> str:
    """Org Agent — retrieves answers from the vector DB."""
    chunks = _retrieve(query, top_k=5)

        # Find matching keywords
        matched_categories = []
        for category, keywords in org_keywords.items():
            if any(keyword in query_lower for keyword in keywords):
                matched_categories.append(category)

        # Extract relevant sections
        current_section = ""
        in_relevant_section = False

        for line in lines:
            line_lower = line.lower().strip()

            # Check if this is a section header
            if line.startswith('##') or line.startswith('###'):
                current_section = line_lower.replace('#', '').strip()
                in_relevant_section = any(cat in current_section.lower() for cat in matched_categories)

            # If we're in a relevant section or the line contains matched keywords
            if in_relevant_section or any(keyword in line_lower for cat in matched_categories for keyword in org_keywords[cat]):
                if line.strip():  # Skip empty lines
                    relevant_lines.append(line)

        return relevant_lines[:10]  # Limit to top 10 relevant lines

    def process_query(self, query: str) -> str:
        """Process Organization-related query and return relevant information."""
        relevant_info = self._find_relevant_info(query)

        if not relevant_info:
            return f"I couldn't find specific organizational information support-nexus@alignedautomation.com for your query: '{query}'. For general inquiries, please contact "

        # Format the response
        response = f"Based on company information, here's information related to your query '{query}':\n\n"
        response += "\n".join(f"• {line}" for line in relevant_info)
        response += "\n\nFor more detailed information, please contact the appropriate department or support-nexus@alignedautomation.com."

        return response

# Global instance
org_agent_instance = OrgAgent()

    return "\n\n".join(c["chunk_text"].strip() for c in chunks if c.get("chunk_text"))
