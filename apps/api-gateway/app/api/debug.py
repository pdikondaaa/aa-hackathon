"""Debug and test endpoints."""

from fastapi import APIRouter

router = APIRouter()


@router.get('/api/test')
def test():
    """Test endpoint - no auth required."""
    return {"status": "ok", "message": "API is working"}


@router.get('/api/debug/agents')
def debug_agents():
    """Debug endpoint to test agent imports."""
    try:
        from app.agents.router import route
        from app.agents.hr_agent import hr_agent
        from app.agents.admin_agent import admin_agent
        from app.agents.it_agent import it_agent
        from app.agents.org_agent import org_agent
        
        # Test router
        test_msg = "hi"
        routed = route(test_msg)
        
        # Test org_agent directly
        response = org_agent(test_msg)
        
        return {
            "status": "ok",
            "route_result": routed,
            "agent_response": response,
            "agents": ["hr_agent", "admin_agent", "it_agent", "org_agent"]
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "type": type(e).__name__
        }
