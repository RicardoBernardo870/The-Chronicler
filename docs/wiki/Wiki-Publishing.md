# Wiki Publishing

Last updated: 2026-05-17

GitHub Wikis are separate Git repositories attached to the main repository. You can edit pages in the GitHub web UI or clone the wiki repository and add Markdown files directly.

## Option 1: GitHub Web UI

1. Open the repository on GitHub.
2. Select the **Wiki** tab.
3. Create a page for each Markdown file in this wiki set.
4. Use page titles that match the internal links, such as `Getting Started` and `API Documentation`.
5. Save each page.

## Option 2: Wiki Git Repository

Clone the wiki repository:

```bash
git clone https://github.com/<owner>/<repo>.wiki.git
```

Add Markdown pages using GitHub Wiki filenames:

```text
Home.md
Getting-Started.md
Project-Structure.md
Configuration.md
Architecture.md
Features.md
API-Documentation.md
Database-Data-Model.md
Authentication-Authorization.md
Development-Workflow.md
Testing.md
Deployment.md
Troubleshooting.md
FAQ.md
Contributing.md
Changelog-Release-Notes.md
```

Commit and push:

```bash
git add .
git commit -m "Add BookHero wiki documentation"
git push
```

## Link Naming

GitHub Wiki links use page titles:

```markdown
[[Getting Started]]
[[API Documentation]]
[[Database Data Model]]
```

The filename usually replaces spaces with hyphens, for example `Getting-Started.md`.

