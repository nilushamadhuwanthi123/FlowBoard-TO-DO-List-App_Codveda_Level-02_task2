# FlowBoard — Advanced Productivity Dashboard

A production-quality, portfolio-worthy To-Do / Productivity web application built with **plain HTML5, CSS3 and vanilla JavaScript (ES6+)** — no frameworks, no build step, no dependencies.

![FlowBoard](https://img.shields.io/badge/HTML5-CSS3-JavaScript-blue)

## ✨ Features

- **Full task CRUD** — add, edit, delete, complete, pin, archive/restore, with subtasks, categories, priorities, due dates and reminders
- **Search, filter & sort** — live search plus 8 filters (All, Today, Active, Completed, High priority, Overdue, Pinned, Archived) and 5 sort modes
- **Productivity dashboard** — animated progress ring, daily completion streak, deadline countdown, live stat cards, time-based greeting
- **Focus Mode** — a distraction-free, one-task-at-a-time full-screen view
- **Drag-and-drop reordering**, **undo delete**, toast notifications, confirmation modals
- **Light & dark themes**, fully responsive (desktop → mobile), keyboard shortcuts (`N` add task, `/` search, `F` focus mode, `Esc` close)
- **LocalStorage persistence** with corrupted-data recovery and an in-memory fallback if storage is unavailable
- **Modular architecture** — logic is split across `utils.js`, `storage.js`, `tasks.js`, `ui.js` and `app.js`, each with a single responsibility

## 📁 Project Structure

```text
todo-productivity-app/
│
├── index.html          # Semantic markup, all modals, dashboard, sidebar
│
├── css/
│   └── style.css        # Design tokens, layout, components, themes, animations
│
├── js/
│   ├── utils.js          # Pure helper functions (dates, validation, formatting)
│   ├── storage.js        # LocalStorage wrapper with error handling
│   ├── tasks.js           # State management + business logic (CRUD, filter, sort, stats)
│   ├── ui.js              # DOM rendering, events, modals, drag & drop, theming
│   └── app.js             # Bootstraps the app on page load
│
└── README.md
```

## 🚀 Running it locally

No build tools or installs are required — it's static HTML/CSS/JS.

**Option A — just open it**
Double-click `index.html`, or right-click → *Open with* your browser.

**Option B — serve it (recommended, avoids any local file-loading quirks)**

```bash
# Python 3
python3 -m http.server 5500

# or Node (if you have npx)
npx serve .

# or VS Code
# Install the "Live Server" extension, right-click index.html → "Open with Live Server"
```

Then visit `http://localhost:5500`.

## 🧠 How the code is organized

| File | Responsibility |
|---|---|
| `utils.js` | Stateless helpers — id generation, date math, validation, formatting. No DOM, no storage. |
| `storage.js` | The only file that talks to `localStorage`. Exposes `saveData / loadData / updateData / removeData / clearData`, with try/catch and JSON-corruption recovery. |
| `tasks.js` | Owns the in-memory task/category state and all business rules: CRUD, search/filter/sort, stats, streak. No DOM access. |
| `ui.js` | Everything that touches the page: rendering, modals, toasts, drag-and-drop, theming, focus mode, keyboard shortcuts. Talks to `tasks.js` for data. |
| `app.js` | Boot sequence: initialize state, then initialize the UI. |

This separation means you can, for example, swap `localStorage` for a real backend by only editing `storage.js`.

---

## 📦 Uploading this project to GitHub (step-by-step)

Below is the full guide to get this project onto your GitHub account, from a completely fresh setup.

### 1. Install Git (skip if already installed)

Check first:

```bash
git --version
```

If it's not installed, download it from **https://git-scm.com/downloads** and install it (Windows/Mac/Linux all supported).

### 2. Create a new (empty) repository on GitHub

1. Go to **https://github.com** and log in.
2. Click the **+** icon (top right) → **New repository**.
3. Repository name: e.g. `flowboard-productivity-app`
4. Keep it **Public** (or Private, your choice).
5. **Do NOT** check "Add a README" or "Add .gitignore" — this project already has them, and it avoids merge conflicts.
6. Click **Create repository**. GitHub will show you a page with setup commands — keep that tab open.

### 3. Open a terminal inside the project folder

Unzip the file you downloaded, then:

```bash
cd path/to/todo-productivity-app
```

### 4. Turn the folder into a Git repository and commit the files

```bash
git init
git add .
git commit -m "Initial commit: FlowBoard productivity app"
```

### 5. Connect your local folder to the GitHub repository

Copy the URL GitHub gave you (it looks like `https://github.com/YOUR-USERNAME/flowboard-productivity-app.git`), then:

```bash
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/flowboard-productivity-app.git
git push -u origin main
```

If this is your first time pushing from this machine, Git/GitHub will ask you to authenticate — either via a browser popup or a **Personal Access Token** (GitHub no longer accepts your account password directly). To create a token: GitHub → Settings → Developer settings → Personal access tokens → Generate new token (classic), give it `repo` scope, and paste it in place of a password when prompted.

Refresh your GitHub repository page — your files should now be there. 🎉

### 6. (Optional but recommended) Host it live for free with GitHub Pages

1. In your repository, go to **Settings → Pages**.
2. Under "Build and deployment" → **Source**, choose **Deploy from a branch**.
3. Branch: `main`, folder: `/ (root)` → **Save**.
4. Wait ~1 minute, then GitHub will give you a live URL like:
   `https://YOUR-USERNAME.github.io/flowboard-productivity-app/`

That link is a live, shareable version of the app — perfect for a portfolio or resume link.

### 7. Making future changes

Any time you edit the code afterwards:

```bash
git add .
git commit -m "Describe what you changed"
git push
```

That's it — GitHub Pages will automatically redeploy the updated version within a minute or two.

---

## 🎨 Design system

| Token | Value |
|---|---|
| Primary | `#6366F1` |
| Secondary | `#8B5CF6` |
| Accent | `#06B6D4` |
| Success | `#10B981` |
| Warning | `#F59E0B` |
| Danger | `#EF4444` |
| Light background | `#F8FAFC` |
| Dark background | `#0F172A` |
| Dark surface | `#1E293B` |
| Display font | Space Grotesk |
| Body font | Inter |
| Mono / data font | JetBrains Mono |

## ♿ Accessibility notes

- Semantic landmarks (`<aside>`, `<main>`, `<header>`), skip-to-content link, visible focus rings
- All interactive controls are real `<button>` / `<input>` elements with labels
- Status is never conveyed by color alone (icons + text accompany every badge)
- Modals use `role="dialog"`/`role="alertdialog"` with `aria-modal` and close on `Esc`
- Respects `prefers-reduced-motion`

## 📝 License

Free to use for personal portfolios and learning.
