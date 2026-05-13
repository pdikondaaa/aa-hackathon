"""
Employee agent configuration — column names and view constants only.
DB credentials are read lazily from env vars at connection time (not import time).
Set them in apps/api-gateway/.env  (see .env.example for the full list).
"""

# Fully-qualified view name (can still be overridden via env in employee_agent.py)
EMPLOYEE_VIEW = "people.vb_employees"

# ---------------------------------------------------------------------------
# Exact column names as they appear in people.vb_employees
# ---------------------------------------------------------------------------
COL_EMPLOYEE_ID             = "EmployeeId"
COL_FIRST_NAME              = "FirstName"
COL_LAST_NAME               = "LastName"
COL_EMAIL                   = "EmailId"
COL_GENDER                  = "Gender"
COL_DOB                     = "DateOfBirth"
COL_DOJ                     = "DateOfJoining"
COL_DATE_CONFIRMATION       = "DateOfConfirmation"
COL_RESIGNATION_DATE        = "ResignationRequestDate"
COL_NOTICE_PERIOD           = "NoticePeriod"
COL_DATE_EXIT               = "DateOfExit"
COL_DESIGNATION             = "Designation"
COL_FUNCTIONAL_MANAGER      = "FunctionalManager"
COL_REPORTING_MANAGER       = "ReportingManager"
COL_REPORTING_MANAGER_EMAIL = "ReportingManagerEmail"
COL_EMPLOYEE_TYPE           = "EmployeeType"
COL_EMPLOYEE_STATUS         = "EmployeeStatus"
COL_CONFIRMATION_STATUS     = "ConfirmationStatus"
COL_DEPARTMENT              = "Department"
COL_PARENT_DEPARTMENT       = "ParentDepartment"
COL_ROLE                    = "Role"
COL_PROJECT_NAME            = "ProjectName"
COL_NATIONALITY             = "Nationality"
COL_PRESENT_ADDRESS         = "PresentAddress"
COL_PERMANENT_ADDRESS       = "PermanentAddress"
COL_PREV_EXPERIENCE         = "PreviousExperience"
COL_EXPERIENCE              = "Experience"
COL_TOTAL_EXPERIENCE        = "TotalExperience"
COL_SKILL_SET               = "SkillSet"
COL_ABOUT_ME                = "AboutMe"
COL_GRADE                   = "Grade"
COL_BLOOD_GROUP             = "BloodGroup"
COL_WORK_LOCATION           = "WorkLocation"
COL_LOCATION_NAME           = "LocationName"
COL_SOURCE_OF_HIRE          = "SourceOfHire"
COL_AGE                     = "Age"
COL_MARITAL_STATUS          = "MaritalStatus"
COL_WORK_PHONE              = "WorkPhone"
COL_MOBILE                  = "MobileNumber"
COL_PASSPORT_NUMBER         = "PassportNumber"
COL_PASSPORT_EXPIRY         = "PassportExpiryDate"
COL_AADHAR                  = "Aadhar"
COL_ENTITY_NAME             = "EntityName"
COL_LANGUAGES               = "LanguagesKnown"
COL_LEVEL                   = "Level"
COL_PERSONAL_EMAIL          = "PersonalEmailId"
COL_PAN                     = "PAN"
COL_UAN                     = "UAN"
COL_REGION                  = "Region"
COL_PHOTO                   = "Photo"

# ---------------------------------------------------------------------------
# Columns used for full-text / ILIKE search
# ---------------------------------------------------------------------------
SEARCH_COLUMNS = [
    COL_FIRST_NAME,
    COL_LAST_NAME,
    COL_EMAIL,
    COL_DESIGNATION,
    COL_DEPARTMENT,
    COL_REPORTING_MANAGER,
    COL_ROLE,
    COL_LOCATION_NAME,
    COL_ENTITY_NAME,
    COL_PROJECT_NAME,
]

# ---------------------------------------------------------------------------
# Fields shown in the concise summary line (multi-result list)
# (column_name, display_label) — only rendered when the column has a value
# ---------------------------------------------------------------------------
SUMMARY_FIELDS = [
    (COL_DESIGNATION,       "Title"),
    (COL_DEPARTMENT,        "Department"),
    (COL_EMAIL,             "Email"),
    (COL_WORK_PHONE,        "Work Phone"),
    (COL_MOBILE,            "Mobile"),
    (COL_LOCATION_NAME,     "Location"),
    (COL_REPORTING_MANAGER, "Reports To"),
    (COL_EMPLOYEE_STATUS,   "Status"),
]

# ---------------------------------------------------------------------------
# Fields hidden in the full single-employee detail card (PII / sensitive)
# ---------------------------------------------------------------------------
HIDDEN_DETAIL_COLUMNS = {
    COL_AADHAR,
    COL_PAN,
    COL_UAN,
    COL_PASSPORT_NUMBER,
    COL_PASSPORT_EXPIRY,
    COL_PHOTO,
    COL_PERSONAL_EMAIL,
    "DependentEmergencyDetails",
    "InsuranceDetails",
    "Functional_Manager.ID",
    "Reporting_To.ID",
    "AddedBy",
    "AddedTime",
    "ModifiedBy",
    "ModifiedTime",
    "employee_id",          # internal duplicate of EmployeeId
}
