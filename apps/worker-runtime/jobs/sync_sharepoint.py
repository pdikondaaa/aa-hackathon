# This file is superseded.
# The ingestion job has been refactored into:
#   jobs/sharepoint_ingestion/main.py
#
# Run it with:
#   cd jobs/sharepoint_ingestion
#   python main.py
raise RuntimeError(
    "apps/worker-runtime is deprecated. "
    "Use jobs/sharepoint_ingestion/main.py instead."
)
