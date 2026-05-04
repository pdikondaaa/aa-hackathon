def route(q):
 q=q.lower()
 if 'leave' in q: return 'hr'
 if 'travel' in q: return 'admin'
 if 'access' in q or 'vpn' in q: return 'it'
 return 'org'
