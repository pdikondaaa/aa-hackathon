
from typing import List







TRAVEL_KEYWORDS = {
    'booking': ['book flight', 'book hotel', 'book travel', 'travel booking', 'arrange travel',
                'flight ticket', 'hotel reservation', 'cab booking', 'book cab'],
    'policy': ['travel policy', 'travel limit', 'class of travel', 'travel allowance',
               'per diem', 'daily allowance', 'travel guidelines'],
    'expense': ['travel expense', 'claim travel', 'reimbursement', 'travel receipt',
                'expense report', 'submit expense', 'travel bill'],
    'approval': ['travel approval', 'approve travel', 'travel request', 'travel advance',
                 'pre-approval', 'international travel'],
    'visa': ['visa', 'passport', 'travel document', 'visa letter', 'invitation letter'],
    'cancel': ['cancel travel', 'cancel booking', 'postpone travel', 'reschedule trip',
               'travel cancellation'],
}

TRAVEL_GUIDES = {
    'booking': (
        "**Travel Booking Process:**\n"
        "1. Submit a Travel Request on the Admin Portal: admin.company.com/travel\n"
        "2. Get manager approval at least 5 business days before travel\n"
        "3. Once approved, the Travel Desk books tickets and hotels\n"
        "4. Preferred vendors: [As per the approved vendor list on the portal]\n"
        "5. Emergency bookings: Contact travel@company.com directly"
    ),
    'policy': (
        "**Travel Policy Highlights:**\n"
        "• Domestic flights: Economy class for trips under 4 hours\n"
        "• International flights: Business class for trips over 8 hours\n"
        "• Hotel: As per city-tier limits (check portal for current rates)\n"
        "• Per diem (meals): As per the Per Diem table on the Admin Portal\n"
        "• Personal travel combined with business travel requires separation of costs"
    ),
    'expense': (
        "**Expense Claim Process:**\n"
        "1. Collect all original receipts during travel\n"
        "2. Submit expense report on Admin Portal within 7 days of return\n"
        "3. Attach: receipts, boarding passes, hotel invoices\n"
        "4. Manager approval required before Finance processes reimbursement\n"
        "5. Reimbursement processed within 5-7 business days after approval"
    ),
    'approval': (
        "**Travel Approval:**\n"
        "• Domestic travel: Manager approval required\n"
        "• International travel: Manager + Department Head + HR approval\n"
        "• Submit request at least 10 business days before international trips\n"
        "• Travel advance (cash): Request at least 5 days prior on the portal\n"
        "• Unapproved travel will not be reimbursed"
    ),
    'visa': (
        "**Visa & Travel Documents:**\n"
        "• Visa letters: Request from Admin team at admin@company.com\n"
        "• Allow 10+ business days for visa processing\n"
        "• Company passport custody policy: Passports are not held by the company\n"
        "• Travel insurance: Provided for all international business travel\n"
        "• Emergency travel documents: Contact HR immediately"
    ),
    'cancel': (
        "**Travel Cancellation:**\n"
        "1. Notify the Travel Desk immediately: travel@company.com\n"
        "2. Update the Travel Request on Admin Portal to 'Cancelled'\n"
        "3. Cancellation charges: Borne by the business unit for late cancellations\n"
        "4. Personal cancellations after booking: Employee bears cancellation fees\n"
        "5. Refunds (if applicable) processed within 10 business days"
    ),
}


class TravelAgent:
    def _match_categories(self, query: str) -> List[str]:
        query_lower = query.lower()
        return [
            cat for cat, phrases in TRAVEL_KEYWORDS.items()
            if any(phrase in query_lower for phrase in phrases)
        ]

    def process_query(self, query: str) -> str:
        categories = self._match_categories(query)

        if not categories:
            return (
                f"I couldn't find specific travel information for: '{query}'.\n\n"
                "For travel-related queries:\n"
                "• Admin Portal: admin.company.com/travel\n"
                "• Travel Desk: travel@company.com\n"
                "• Admin Team: admin@company.com | +1-800-ADM-HELP"
            )

        response = "**Business Travel Information:**\n\n"
        for cat in categories:
            response += TRAVEL_GUIDES[cat] + "\n\n"

        response += "---\n"
        response += "✈️ **Travel Desk:** travel@company.com | **Admin Portal:** admin.company.com/travel"
        return response


travel_agent_instance = TravelAgent()


def travel_agent(query: str) -> str:
    return travel_agent_instance.process_query(query)
