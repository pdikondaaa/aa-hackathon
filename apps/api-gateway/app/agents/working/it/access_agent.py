"""
IT Access Agent — handles system access, permissions, VPN, account provisioning,
and access revocation requests.
"""
from typing import List


ACCESS_KEYWORDS = {
    'new_access': ['need access', 'request access', 'grant access', 'provision', 'new account',
                   'create account', 'onboarding access', 'add me to'],
    'vpn': ['vpn', 'remote access', 'work from outside', 'connect remotely', 'tunnel'],
    'password': ['password reset', 'forgot password', 'locked out', 'can\'t login', 'cannot login',
                 'account locked', 'reset password'],
    'permissions': ['permission', 'role', 'privilege', 'admin rights', 'elevated access',
                    'read access', 'write access', 'folder access', 'share access'],
    'revoke': ['remove access', 'revoke', 'offboarding', 'deactivate account', 'disable account',
               'ex-employee', 'resigned'],
    'mfa': ['mfa', '2fa', 'two-factor', 'authenticator', 'otp', 'verification code'],
}

ACCESS_GUIDES = {
    'new_access': (
        "**New Access / Account Provisioning:**\n"
        "1. Submit an Access Request on the IT Portal: it.company.com/access\n"
        "2. Select the system/application and the required access level\n"
        "3. Attach your manager's approval email\n"
        "4. IT will provision access within 1 business day\n"
        "5. You'll receive credentials via your registered email"
    ),
    'vpn': (
        "**VPN Access:**\n"
        "• VPN client: Download from it.company.com/vpn\n"
        "• First-time setup: Requires MFA enrollment (see MFA guide)\n"
        "• Use server: vpn.company.com with your company credentials\n"
        "• VPN access for contractors requires manager + IT approval\n"
        "• Issues: Contact helpdesk@company.com with your employee ID"
    ),
    'password': (
        "**Password Reset:**\n"
        "• Self-service reset: accounts.company.com/reset\n"
        "• Requires: registered mobile number or backup email\n"
        "• If locked out: Call IT Helpdesk at +1-800-IT-HELP with your employee ID\n"
        "• After 5 failed attempts, account is locked for 30 minutes\n"
        "• Password policy: min 12 chars, uppercase, number, special character"
    ),
    'permissions': (
        "**Permission / Role Changes:**\n"
        "1. Submit a Permission Change Request on IT Portal\n"
        "2. Manager approval is mandatory for elevated/admin access\n"
        "3. Data owner approval required for sensitive data access\n"
        "4. Access reviews are conducted quarterly — unused access is revoked\n"
        "5. Processing time: 1–3 business days"
    ),
    'revoke': (
        "**Access Revocation (Offboarding):**\n"
        "• HR initiates offboarding and notifies IT automatically\n"
        "• All access is revoked on the last working day\n"
        "• Managers can request immediate revocation at security@company.com\n"
        "• Device return and data handover must be completed before revocation"
    ),
    'mfa': (
        "**Multi-Factor Authentication (MFA):**\n"
        "• Enroll at: accounts.company.com/mfa\n"
        "• Supported apps: Microsoft Authenticator, Google Authenticator\n"
        "• Lost authenticator: Contact IT Helpdesk for backup code\n"
        "• MFA is mandatory for VPN, email, and all cloud applications"
    ),
}


class AccessAgent:
    def _match_categories(self, query: str) -> List[str]:
        query_lower = query.lower()
        return [
            cat for cat, phrases in ACCESS_KEYWORDS.items()
            if any(phrase in query_lower for phrase in phrases)
        ]

    def process_query(self, query: str) -> str:
        categories = self._match_categories(query)

        if not categories:
            return (
                f"I couldn't find specific access information for: '{query}'.\n\n"
                "For access requests and account issues:\n"
                "• IT Portal: it.company.com/access\n"
                "• Helpdesk: helpdesk@company.com | +1-800-IT-HELP\n"
                "• Urgent security issues: security@company.com"
            )

        response = "**IT Access Information:**\n\n"
        for cat in categories:
            response += ACCESS_GUIDES[cat] + "\n\n"

        response += "---\n"
        response += "🖥️ **IT Portal:** it.company.com | **Helpdesk:** helpdesk@company.com | +1-800-IT-HELP"
        return response


access_agent_instance = AccessAgent()


def access_agent(query: str) -> str:
    return access_agent_instance.process_query(query)
