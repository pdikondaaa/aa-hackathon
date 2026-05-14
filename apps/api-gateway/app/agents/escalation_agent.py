ESCALATION_MESSAGE = (
    "Your request requires further review by the concerned team. Please provide a few"
    "additional details in the form below so the team can better understand your concern"
    "and take the appropriate action.\n\n"
    "Once submitted, the information will be reviewed and you may be contacted"
    "for any further clarification if required.\n\n"
    "[📋 Open Escalation Form](#escalation)"
)


def escalation_agent() -> str:
    return ESCALATION_MESSAGE
