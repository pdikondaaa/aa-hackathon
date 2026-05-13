"""
HR Attendance Agent — handles attendance, check-in/out, absences,
overtime, and work-from-home tracking queries.
"""
import os
from typing import List


ATTENDANCE_KEYWORDS = {
    'checkin': ['check in', 'check-in', 'clock in', 'punch in', 'mark attendance', 'log in time'],
    'checkout': ['check out', 'check-out', 'clock out', 'punch out', 'log out time'],
    'absence': ['absent', 'absence', 'missed', 'did not attend', 'not present', 'no show'],
    'overtime': ['overtime', 'extra hours', 'late hours', 'after hours', 'weekend work'],
    'wfh': ['work from home', 'wfh', 'remote work', 'remote day', 'home office'],
    'late': ['late', 'tardiness', 'delay', 'arrived late', 'coming late'],
    'regularise': ['regularise', 'regularize', 'correct attendance', 'fix attendance', 'attendance correction'],
}

ATTENDANCE_POLICIES = {
    'checkin': (
        "**Check-In Policy:**\n"
        "• Standard check-in time: 9:00 AM\n"
        "• Grace period: 15 minutes (up to 9:15 AM without late mark)\n"
        "• Check-in via: HRMS portal, mobile app, or biometric device\n"
        "• Remote employees must check in on the HRMS portal by 9:30 AM"
    ),
    'checkout': (
        "**Check-Out Policy:**\n"
        "• Standard check-out time: 6:00 PM\n"
        "• Early departures before 5:30 PM require manager approval\n"
        "• Check-out via: HRMS portal, mobile app, or biometric device\n"
        "• Failure to check out will be flagged for attendance correction"
    ),
    'absence': (
        "**Absence Reporting:**\n"
        "• Inform your manager and HR before 9:30 AM on the day of absence\n"
        "• Mark absence on HRMS portal under 'Leave Management'\n"
        "• Unplanned absences without notice may be treated as LOP (Loss of Pay)\n"
        "• 3+ consecutive unplanned absences require a medical certificate"
    ),
    'overtime': (
        "**Overtime Policy:**\n"
        "• Overtime must be pre-approved by your manager\n"
        "• Compensation: Time-off in lieu (TOIL) or overtime pay per company grade\n"
        "• Log overtime hours on HRMS within 24 hours\n"
        "• Weekend/holiday overtime requires written manager approval"
    ),
    'wfh': (
        "**Work From Home Policy:**\n"
        "• WFH days must be approved by your manager at least 1 day in advance\n"
        "• Maximum WFH: as per your employment contract or team policy\n"
        "• Check in and check out via HRMS portal on WFH days\n"
        "• You must be reachable on official channels during working hours"
    ),
    'late': (
        "**Late Arrival Policy:**\n"
        "• Arrivals after 9:15 AM are marked late\n"
        "• 3 late marks in a month = 1 day LOP (Loss of Pay)\n"
        "• Habitual late arrivals will be escalated to HR for counselling\n"
        "• Regularise late marks on HRMS with manager approval within 3 days"
    ),
    'regularise': (
        "**Attendance Regularisation:**\n"
        "• Log in to HRMS → Attendance → Regularisation Request\n"
        "• Select the date and provide a reason for the correction\n"
        "• Submit for manager approval (approval required within 3 working days)\n"
        "• Regularisation requests must be raised within 7 days of the date"
    ),
}


class AttendanceAgent:
    def _match_categories(self, query: str) -> List[str]:
        query_lower = query.lower()
        return [
            cat for cat, phrases in ATTENDANCE_KEYWORDS.items()
            if any(phrase in query_lower for phrase in phrases)
        ]

    def process_query(self, query: str) -> str:
        categories = self._match_categories(query)

        if not categories:
            return (
                f"I couldn't find specific attendance information for: '{query}'.\n\n"
                "For attendance issues, please:\n"
                "• Log in to the **HRMS portal** under 'Attendance Management'\n"
                "• Contact your HR Business Partner at hr@company.com\n"
                "• Call the HR Attendance helpline: +1-800-HR-ATTN"
            )

        response = f"**Attendance Information** for your query:\n\n"
        for cat in categories:
            response += ATTENDANCE_POLICIES[cat] + "\n\n"

        response += "---\n"
        response += "📍 **HRMS Portal:** hrms.company.com | **HR Contact:** hr@company.com | +1-800-HR-HELP"
        return response


attendance_agent_instance = AttendanceAgent()


def attendance_agent(query: str) -> str:
    return attendance_agent_instance.process_query(query)
