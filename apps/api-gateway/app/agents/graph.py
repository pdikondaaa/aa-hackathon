from app.agents.router import route
from app.agents.hr_agent import hr_agent
from app.agents.admin_agent import admin_agent
from app.agents.it_agent import it_agent
from app.agents.org_agent import org_agent
def run_assistant(q):
 r=route(q)
 return {'hr':hr_agent,'admin':admin_agent,'it':it_agent,'org':org_agent}[r](q)
