"""
Fix em dashes in generate_proposal_docx.py with contextually appropriate punctuation,
then regenerate the Word document.
"""

import re

with open('generate_proposal_docx.py', 'r', encoding='utf-8') as f:
    src = f.read()

# Count before
before = src.count('\u2014')
print(f"Em dashes found: {before}")

# --- Specific line-by-line replacements ---
# Each tuple: (exact old string, new string)
replacements = [
    # Cover page
    ('\u2014  For STPI Review Only', ':  For STPI Review Only'),

    # Section headings
    ('SECTION 1 \u2014 EXECUTIVE SUMMARY', 'SECTION 1: EXECUTIVE SUMMARY'),
    ('SECTION 2 \u2014 THE PROBLEM', 'SECTION 2: THE PROBLEM'),
    ('SECTION 3 \u2014 THE SOLUTION', 'SECTION 3: THE SOLUTION'),
    ("'02  The Problem \u2014 Why Foreign Investors Struggle'", "'02  The Problem: Why Foreign Investors Struggle'"),
    ("'03  The Solution \u2014 GCC Playbook Platform'", "'03  The Solution: GCC Playbook Platform'"),

    # Exec summary body
    ("India's GCC sector is the fastest-growing segment of the global technology economy \u2014 ",
     "India's GCC sector is the fastest-growing segment of the global technology economy. "),

    ("a board in New York \u2014 they want to set up in India.",
     "a board in New York. They want to set up in India."),

    ("state investment boards, STPI documentation, and commercial real estate surveys \u2014 none of ",
     "state investment boards, STPI documentation, and commercial real estate surveys. None of "),

    ("Mid-market companies \u2014 the next\n    \"generation of GCC investors \u2014 simply give up.",
     "Mid-market companies, the next\n    \"generation of GCC investors, simply give up."),

    ("Pithonix AI has built India's first AI-native GCC Intelligence Platform \u2014 the GCC Playbook ",
     "Pithonix AI has built India's first AI-native GCC Intelligence Platform, the GCC Playbook "),

    ("the GCC Playbook\n    \"\u2014 that automates",
     "the GCC Playbook,\n    \"which automates"),

    ("This proposal is for STPI \u2014 India's apex IT/ITES export body under MeitY \u2014 to co-host the ",
     "This proposal is for STPI, India's apex IT/ITES export body under MeitY, to co-host the "),

    ("Not a complex integration. Not a procurement project. One embed \u2014 ",
     "Not a complex integration. Not a procurement project. One embed: "),

    ("The case is straightforward \u2014 for STPI, this turns stpi.in from a registration portal into ",
     "The case is straightforward. For STPI, this turns stpi.in from a registration portal into "),

    ("For India \u2014 more GCCs, more jobs, more FDI, ",
     "For India: more GCCs, more jobs, more FDI, "),

    ("signing a Letter of Intent. The only input required from STPI is institutional endorsement \u2014 ",
     "signing a Letter of Intent. The only input required from STPI is institutional endorsement, "),

    # Section 2 - The Problem
    ("India is the obvious choice for a GCC \u2014 and yet,",
     "India is the obvious choice for a GCC. And yet,"),

    ("real estate portals \u2014 none connected, none personalized, none telling her what she actually ",
     "real estate portals. None connected, none personalized, none telling her what she actually "),

    ("needs to know \u2014 right now, for her company, for her budget.",
     "needs to know. Right now. For her company, for her budget."),

    ("Foreign investors landing on stpi.in are at peak intent \u2014 they are actively evaluating India.",
     "Foreign investors landing on stpi.in are at peak intent. They are actively evaluating India."),

    ("STPI's portal is built for companies that have already decided \u2014 not for companies still deciding.",
     "STPI's portal is built for companies that have already decided. Not for companies still deciding."),

    ("$50,000 to $200,000 \u2014 that is what a serious GCC feasibility study costs",
     "$50,000 to $200,000. That is what a serious GCC feasibility study costs"),

    ("growth-stage technology firms \u2014 they cannot.",
     "growth-stage technology firms. They cannot."),

    ("The advice market is expensive \u2014 and exclusive.",
     "The advice market is expensive. And exclusive."),

    ('"I want a 150-person data engineering GCC \u2014 where do I start?',
     '"I want a 150-person data engineering GCC. Where do I start?'),

    ('do first?" \u2014 goes unanswered',
     'do first?" This question goes unanswered'),

    # Section 3 - The Solution
    ("platform \u2014 free, instant, personalized \u2014 that answers the real question",
     "platform, free, instant, and personalized, that answers the real question"),

    ("at the exact moment they are asking it \u2014 and walks them straight into STPI's ecosystem.",
     "at the exact moment they are asking it, and walks them straight into STPI's ecosystem."),
]

# Apply replacements
for old, new in replacements:
    if old in src:
        src = src.replace(old, new)
        print(f"  Replaced: {old[:60].strip()!r}")
    else:
        print(f"  NOT FOUND: {old[:60].strip()!r}")

# After specific replacements, do a sweep for any remaining em dashes
# and replace contextually based on surrounding pattern
remaining = src.count('\u2014')
print(f"\nRemaining em dashes after specific replacements: {remaining}")

# Generic sweep: " — " between words -> ", "
# But we need to be careful. Let's do pattern-based replacements.
# Pattern 1: end of sentence fragment before period or comma + em dash + lowercase -> comma
# Pattern 2: em dash before "not", "no", "never" -> period + capitalise
# Catch-all: replace remaining " — " with ", "

def smart_replace(text):
    # "word — not/never/no" -> "word. Not/Never/No"
    text = re.sub(r' \u2014 (not|never|no) ', lambda m: '. ' + m.group(1).capitalize() + ' ', text)
    # "word — They/It/This/The/A/An" -> "word. They/..."
    text = re.sub(r' \u2014 ([A-Z])', lambda m: '. ' + m.group(1), text)
    # Remaining " — " -> ", "
    text = text.replace(' \u2014 ', ', ')
    # "\u2014" with no spaces -> ", "
    text = text.replace('\u2014', ', ')
    return text

src = smart_replace(src)

after = src.count('\u2014')
print(f"Em dashes after all replacements: {after}")

with open('generate_proposal_docx.py', 'w', encoding='utf-8') as f:
    f.write(src)

print("\nFile updated. Now regenerating Word document...")
