# Striver A2Z DSA Tracker • Multi-Platform & Local VS Code Practice 🚀

An interactive, responsive, and modern web application to track your Data Structures & Algorithms (DSA) preparation using **Striver's A2Z DSA Sheet**, featuring:
1. **All 456 questions** across multiple platforms (LeetCode, GeeksforGeeks, Code360 / Coding Ninjas, TakeUForward, YouTube).
2. **Instant "LeetCode Only" toggle switch** to filter only LeetCode questions.
3. **Dedicated `[VS Code 💻]` button on every question** opening a full problem view in a new tab with **complete problem descriptions, input/output formats, examples, constraints, and starter code templates** for questions that are not on external platforms!

---

## 🌟 Key Features

1. **Complete 456 Questions Across All Platforms**:
   - Contains all **456 questions** from Striver's official A2Z Sheet.
   - Platform coverage:
     - **LeetCode**: 284+ questions (with canonical numbers & links)
     - **GeeksforGeeks**: 355 direct problem links
     - **Code360 / Coding Ninjas**: 226 direct practice links
     - **YouTube Solutions**: 220 official video walkthroughs
     - **Local / VS Code Practice**: Full offline specifications for questions without external platforms.

2. **Dedicated `[VS Code 💻]` Practice Tab**:
   - Every question row now includes a **`[VS Code]`** button right beside `[LC]`, `[GFG]`, and `[Code360]`.
   - Clicking it opens **[`problem.html?id=...`](file:///c:/Users/ulhas/OneDrive/Desktop/New%20folder/problem.html)** in a new tab:
     - **Complete Problem Statement**: Clear explanation of the task.
     - **Input & Output Format**: Explains standard I/O format for competitive programming.
     - **Examples**: Test cases with Input, Output, and Explanation.
     - **Constraints**: Numeric bounds, array sizes, and limits.
     - **VS Code Starter Templates**: Ready-to-run boilerplate code in **C++**, **Java**, and **Python** with `main()` functions.
     - **One-Click Copy**: "Copy Code" & "Copy Markdown" buttons for quick pasting into VS Code.
     - **Offline Exclusivity**: Detailed full problem statements and constraints are stored **only for questions not available on any other platform**, keeping the rest lightweight and bloat-free!

3. **One-Click "LeetCode Only" Mode & Platform Filters**:
   - **⚡ LC Only Toggle Switch**: In the top header—turning this ON instantly hides all non-LeetCode problems.
   - **Platform Filter Pills**:
     - `🌐 All Platforms (456)`
     - `🟠 LeetCode (284)`
     - `🟢 GeeksforGeeks (355)`
     - `🔵 Code360 (226)`
     - `🔴 Video Solutions (220)`
   - Dynamically recalculates overall completion and Easy/Medium/Hard counters based on the active platform filter.

4. **Multi-Platform Direct Buttons on Each Question**:
   - `[LC #15]` — Opens LeetCode
   - `[GFG]` — Opens GeeksforGeeks
   - `[Code360]` — Opens Coding Ninjas
   - `[VS Code 💻]` — Opens the local practice tab with examples, constraints & starter code
   - `[Video 🎬]` — Opens YouTube solution video
   - `[Copy Link]` — Copies link to clipboard

5. **Sorting & Filtering Options**:
   - Sort by **Default Sheet Order**, **LeetCode Number (#)**, **Title (A-Z)**, **Difficulty (Easy → Hard)**, or **Difficulty (Hard → Easy)**.

6. **Organized by Striver's 18 Steps & Sub-Steps**:
   - Hierarchical accordions with "Expand All / Collapse All".

7. **Instant Password-Only Cloud Sync (Multi-Device Progress Tracking) ☁️**:
   - Zero tokens (`ghp_...`), zero usernames, and zero configuration needed!
   - Simply choose any **secret password** (e.g. `MyDSA2026`).
   - Every time you check off a problem, star a question, or edit a note, it automatically syncs in the background!
   - Open this website on your phone, tablet, or another computer, type the same password, and click **Connect & Sync** — all your progress links instantly!
   - Your device remembers your password in `localStorage`, so future visits sync automatically in real-time.

8. **100% Local Storage & Portability**:
   - Saves completion status, bookmarks, and notes in `localStorage`.
   - **Export Progress**: Download a `.json` backup anytime.
   - **Import Progress**: Restore your progress on any browser or device.

---

## 📁 Folder Structure

```text
├── index.html                                # Main Tracker Launcher (Direct Double-Click)
├── problem.html                              # Dedicated VS Code Local Problem Viewer Tab
├── styles.css                                # Glassmorphism & responsive stylesheet
├── app.js                                    # Application & filtering logic
├── questions-data.js                         # Complete 456 questions dataset
├── striver_a2z_all_questions.json            # Full JSON dataset
│
└── striver-a2z-tracker/                      # Organized Subfolder Structure
    ├── index.html                            # Modular main tracker
    ├── problem.html                          # Modular problem viewer tab
    ├── css/
    │   └── styles.css                        # Stylesheet
    ├── js/
    │   ├── app.js                            # Application logic
    │   └── questions-data.js                 # Questions dataset
    └── data/
        ├── striver_a2z_all_questions.json    # Full dataset JSON
        └── striver_a2z_leetcode_only.json    # LeetCode-only dataset JSON
```

---

## 🚀 How to Run

- **Option 1**: Double-click [`index.html`](file:///c:/Users/ulhas/OneDrive/Desktop/New%20folder/index.html) in your workspace folder.
- **Option 2**: Open [`striver-a2z-tracker/index.html`](file:///c:/Users/ulhas/OneDrive/Desktop/New%20folder/striver-a2z-tracker/index.html) inside the organized folder.
- **Option 3 (Local Server)**: Run `python -m http.server 8000` and visit `http://localhost:8000`.
