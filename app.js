
/* FixCIT multi-page offline-first frontend.
   Local data is stored in IndexedDB on this device/browser.
   Connect the TODO API routes to Laravel before production use. */

const DB_NAME = "fixcit-db";
const DB_VERSION = 1;
const API_BASE = "/api"; // TODO: Replace with deployed Laravel API base URL

let db;

const page = document.body.dataset.page || "dashboard";
const app = document.getElementById("app");

const $ = (id) => document.getElementById(id);

// Escape HTML to prevent unsafe content from being inserted into the page.
const esc = (s = "") =>
    String(s).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[c]);

// DATABASE: INDEXEDDB
function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = () => {
            const d = req.result;

            if (!d.objectStoreNames.contains("reports")) {
                const s = d.createObjectStore("reports", {
                    keyPath: "localId"
                });

                s.createIndex("createdAt", "createdAt");
                s.createIndex("syncStatus", "syncStatus");
            }

            if (!d.objectStoreNames.contains("profile")) {
                d.createObjectStore("profile", {
                    keyPath: "key"
                });
            }

            if (!d.objectStoreNames.contains("session")) {
                d.createObjectStore("session", {
                    keyPath: "key"
                });
            }
        };

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

function request(store, mode, fn) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// Database operations
const getAllReports = () =>
    request("reports", "readonly", s => s.getAll());

const putReport = (r) =>
    request("reports", "readwrite", s => s.put(r));

const getProfile = () =>
    request("profile", "readonly", s => s.get("me"));

const putProfile = (value) =>
    request("profile", "readwrite", s =>
        s.put({ key: "me", value })
    );

const getSession = () =>
    request("session", "readonly", s => s.get("current"));

const putSession = (value) =>
    request("session", "readwrite", s =>
        s.put({ key: "current", value })
    );

const clearSession = () =>
    request("session", "readwrite", s => s.delete("current"));

// GENERAL FUNCTIONS
function id() {
    return crypto.randomUUID
        ? crypto.randomUUID()
        : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === "x" ? r : (r & 3 | 8)).toString(16);
        });
}

function dateText(iso) {
    return new Date(iso).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}

function statusLabel(r) {
    return r.syncStatus === "pending"
        ? "Saved Offline"
        : r.status || "Pending";
}

function statusClass(s) {
    return s === "Resolved"
        ? "resolved"
        : s === "In Progress"
            ? "progress"
            : s === "Saved Offline"
                ? "offline"
                : "pending";
}

function categoryIcon(c) {
    return ({
        Furniture: "🪑",
        Electrical: "💡",
        Plumbing: "🚰",
        Equipment: "🛠",
        Cleanliness: "🧹",
        Structural: "🏢",
        Other: "📋"
    })[c] || "📋";
}

function toast(msg) {
    let t = $("toast");

    if (!t) {
        t = document.createElement("div");
        t.id = "toast";
        t.className = "toast";
        document.body.append(t);
    }

    t.textContent = msg;
    t.classList.add("show");

    setTimeout(() => t.classList.remove("show"), 2800);
}

function connectionMarkup() {
    return `
        <span class="connection" id="connection">
            <i></i>
            ${navigator.onLine ? "Online" : "Offline mode"}
        </span>
    `;
}

// SIDEBAR AND MAIN PAGE LAYOUT
function shell(content) {
    const profileName =
        window.currentProfile?.fullName || "Juan Dela Cruz";

    return `
        <aside class="sidebar" id="sidebar">

            <div class="brand">
                <div class="brand-mark">🔧</div>
                <h1>Fix<span>CIT</span></h1>
                <p>
                    Facility Issue Reporting<br>
                    and Monitoring System
                </p>
            </div>

            <nav class="side-nav">
                <a href="index.html" class="nav-link" data-nav="dashboard">
                    <b>⌂</b>Dashboard
                </a>

                <a href="submit.html" class="nav-link" data-nav="submit">
                    <b>＋</b>Submit Report
                </a>

                <a href="reports.html" class="nav-link" data-nav="reports">
                    <b>▤</b>My Reports
                </a>

                <a href="track.html" class="nav-link" data-nav="track">
                    <b>⌕</b>Track Report
                </a>

                <a href="profile.html" class="nav-link" data-nav="profile">
                    <b>♙</b>Profile
                </a>
            </nav>

            <div class="side-bottom">
                <a href="login.html" class="nav-link" id="logoutLink">
                    <b>⇥</b>Logout
                </a>
            </div>

            <div class="sidebar-decoration"></div>
        </aside>

        <div class="main-shell">

            <header class="topbar">
                <button
                    class="icon-btn"
                    id="menuBtn"
                    aria-label="Toggle navigation"
                >☰</button>

                <div class="top-actions">
                    ${connectionMarkup()}

                    <span class="bell">♧</span>

                    <a class="user-chip" href="profile.html">
                        <span class="avatar">
                            ${esc(
                                profileName
                                    .split(" ")
                                    .map(x => x[0])
                                    .slice(0, 2)
                                    .join("")
                            )}
                        </span>

                        <span>${esc(profileName)}</span>
                        <b>⌄</b>
                    </a>
                </div>
            </header>

            <main class="content">
                ${content}

                <footer class="footer">
                    <span></span>
                    FixCIT • University of Northern Philippines
                    <span></span>
                </footer>
            </main>

        </div>
    `;
}

function setActiveNav() {
    document.querySelectorAll("[data-nav]").forEach(a => {
        a.classList.toggle("active", a.dataset.nav === page);
    });
}

function bindShell() {
    $("menuBtn")?.addEventListener("click", () => {
        $("sidebar").classList.toggle("open");
    });

    $("logoutLink")?.addEventListener("click", async e => {
        e.preventDefault();

        if (confirm("Log out of FixCIT on this device?")) {
            await clearSession();
            location.href = "login.html";
        }
    });

    window.addEventListener("online", () => {
        updateConnection();
        syncQueue();
    });

    window.addEventListener("offline", updateConnection);

    updateConnection();
    setActiveNav();
}

function updateConnection() {
    const el = $("connection");

    if (el) {
        el.classList.toggle("offline", !navigator.onLine);

        el.innerHTML = `
            <i></i>
            ${navigator.onLine ? "Online" : "Offline mode"}
        `;
    }
}

// DASHBOARD
function dashboardHTML() {
    return `
        <section class="hero">

            <div class="hero-copy">
                <p class="eyebrow">
                    FACILITY CARE STARTS WITH YOU
                </p>

                <h2>
                    Good morning,
                    <span id="helloName">Juan!</span>
                </h2>

                <p>
                    Keep track of your facility concerns and<br
                    class="desktop-only">
                    help make CCIT a better place.
                </p>

                <div class="hero-line"></div>
            </div>
        </section>

        <section class="stats-grid">

            <article class="stat-card">
                <div class="stat-icon">▤</div>
                <div>
                    <strong id="totalCount">0</strong>
                    <span>My Reports</span>
                </div>
            </article>

            <article class="stat-card">
                <div class="stat-icon">◷</div>
                <div>
                    <strong id="pendingCount">0</strong>
                    <span>Pending</span>
                </div>
            </article>

            <article class="stat-card">
                <div class="stat-icon">⟳</div>
                <div>
                    <strong id="progressCount">0</strong>
                    <span>In Progress</span>
                </div>
            </article>

            <article class="stat-card">
                <div class="stat-icon">✓</div>
                <div>
                    <strong id="resolvedCount">0</strong>
                    <span>Resolved</span>
                </div>
            </article>

        </section>

        <section class="dashboard-grid">

            <article class="panel">
                <div class="panel-heading">
                    <h3>ϟ Quick Actions</h3>
                    <span class="portal-tag">Student Portal</span>
                </div>

                <div class="quick-card">

                    <div class="student-art">
                        <div class="student-face">☺</div>
                        <div class="student-shirt"></div>
                        <div class="student-laptop">●</div>
                        <div class="tool-bubble">🔧</div>
                    </div>

                    <div class="quick-copy">
                        <h3>Report a Facility Issue</h3>

                        <p>
                            Found a damaged chair, faulty light,
                            or broken equipment? Let us know.
                        </p>

                        <a class="primary-btn" href="submit.html">
                            ＋ Submit a Report
                        </a>
                    </div>

                </div>

                <p class="hint">
                    You can submit reports offline.
                    They will sync when you're connected.
                </p>
            </article>

            <article class="panel">

                <div class="panel-heading">
                    <h3>☷ My Recent Reports</h3>

                    <a class="text-btn" href="reports.html">
                        View All Reports →
                    </a>
                </div>

                <div id="recentReports" class="report-list">
                    <p class="empty">
                        No reports yet. Submit your first facility report.
                    </p>
                </div>

            </article>

        </section>
    `;
}

function reportRows(reports) {
    if (!reports.length) {
        return `<div class="empty">No reports found.</div>`;
    }

    return reports.map(r => `
        <article class="report-row">

            <div class="report-thumb">
                ${categoryIcon(r.category)}
            </div>

            <div class="report-info">
                <strong>${esc(r.title)}</strong>

                <small>
                    ⌖ ${esc([r.room, r.building].filter(Boolean).join(" · "))}
                    · ${esc(r.category)}
                </small>

                <small class="report-code">
                    Report ID:
                    ${esc(r.publicCode || r.localId.slice(0, 8).toUpperCase())}
                </small>
            </div>

            <div class="report-meta">
                <time>${dateText(r.createdAt)}</time>

                <span class="status ${statusClass(statusLabel(r))}">
                    ${esc(statusLabel(r))}
                </span>
            </div>

            <a
                class="row-arrow"
                href="track.html?id=${encodeURIComponent(r.publicCode || r.localId)}"
                aria-label="Track report"
            >›</a>

        </article>
    `).join("");
}

async function renderDashboard() {
    const reports = (await getAllReports())
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const counts = {
        total: reports.length,
        pending: reports.filter(r => r.status === "Pending").length,
        progress: reports.filter(r => r.status === "In Progress").length,
        resolved: reports.filter(r => r.status === "Resolved").length
    };

    $("totalCount").textContent = counts.total;
    $("pendingCount").textContent = counts.pending;
    $("progressCount").textContent = counts.progress;
    $("resolvedCount").textContent = counts.resolved;

    $("recentReports").innerHTML = reportRows(reports.slice(0, 3));

    const p = await getProfile();

    if (p?.value?.fullName) {
        $("helloName").textContent =
            p.value.fullName.split(" ")[0] + "!";

        document.querySelector(
            ".user-chip span:nth-child(2)"
        ).textContent = p.value.fullName;
    }
}

// SUBMIT REPORT
function submitHTML() {
    return `
        <section class="page-heading">
            <p class="eyebrow">STUDENT PORTAL</p>
            <h2>Submit a Facility Report</h2>
            <p>
                Tell the CCIT team about a facility issue
                that needs attention.
            </p>
        </section>

        <section class="panel form-panel">

            <form id="submitForm">

                <div class="form-grid">

                    <div class="field full">
                        <label for="title">
                            Issue title <em>*</em>
                        </label>

                        <input
                            id="title"
                            name="title"
                            required
                            maxlength="120"
                            placeholder="e.g. Broken classroom chair"
                        >
                    </div>

                    <div class="field">
                        <label for="category">
                            Category <em>*</em>
                        </label>

                        <select id="category" name="category" required>
                            <option value="">Choose category</option>
                            <option>Furniture</option>
                            <option>Electrical</option>
                            <option>Plumbing</option>
                            <option>Equipment</option>
                            <option>Cleanliness</option>
                            <option>Structural</option>
                            <option>Other</option>
                        </select>
                    </div>

                    <div class="field">
                        <label for="priority">Priority</label>

                        <select id="priority" name="priority">
                            <option value="Normal">Normal</option>
                            <option value="Low">Low</option>
                            <option value="High">High</option>
                            <option value="Urgent">Urgent</option>
                        </select>
                    </div>

                    <div class="field">
                        <label for="building">Building</label>

                        <input
                            id="building"
                            name="building"
                            placeholder="e.g. CCIT Building"
                        >
                    </div>

                    <div class="field">
                        <label for="room">
                            Room / specific location <em>*</em>
                        </label>

                        <input
                            id="room"
                            name="room"
                            required
                            placeholder="e.g. Room 201"
                        >
                    </div>

                    <div class="field full">
                        <label for="description">
                            Description <em>*</em>
                        </label>

                        <textarea
                            id="description"
                            name="description"
                            rows="5"
                            required
                            placeholder="Describe the issue, its condition, and exact location..."
                        ></textarea>
                    </div>

                    <div class="field full">
                        <label for="photo">
                            Attach a photo (optional)
                        </label>

                        <input
                            type="file"
                            id="photo"
                            name="photo"
                            accept="image/*"
                        >

                        <small>
                            Images are stored on this device
                            until the report syncs.
                        </small>
                    </div>

                </div>

                <div class="offline-callout">
                    <b>Offline-first:</b>
                    Your report will be saved on this device immediately.
                    It will be sent to the central system when internet is available.
                </div>

                <div class="form-actions">
                    <a class="secondary-btn" href="index.html">
                        Cancel
                    </a>

                    <button class="primary-btn" type="submit">
                        Submit Report
                    </button>
                </div>

            </form>

        </section>
    `;
}

async function saveSubmission(form) {
    const data = new FormData(form);
    const photo = data.get("photo");

    const report = {
        localId: id(),
        publicCode: null,
        title: data.get("title").trim(),
        category: data.get("category"),
        priority: data.get("priority").toLowerCase(),
        building: data.get("building").trim(),
        room: data.get("room").trim(),
        description: data.get("description").trim(),
        photo: photo?.size ? photo : null,
        status: "Pending",
        syncStatus: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    await putReport(report);

    return report;
}

// MY REPORTS
async function renderReports() {
    const all = (await getAllReports())
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    $("reportTable").innerHTML = reportRows(all);

    $("reportSearch").addEventListener("input", () => {
        filterReports(all);
    });

    $("statusFilter").addEventListener("change", () => {
        filterReports(all);
    });
}

function filterReports(all) {
    const q = $("reportSearch").value.toLowerCase();
    const s = $("statusFilter").value;

    const filtered = all.filter(r =>
        (!s || statusLabel(r) === s || r.status === s) &&
        [
            r.title,
            r.category,
            r.room,
            r.building,
            r.publicCode,
            r.localId
        ].join(" ").toLowerCase().includes(q)
    );

    $("reportTable").innerHTML = reportRows(filtered);
}

// TRACK REPORT
function trackHTML() {
    return `
        <section class="page-heading">
            <p class="eyebrow">REPORT MONITORING</p>
            <h2>Track a Report</h2>
            <p>
                Enter your report code to check its latest
                status on this device.
            </p>
        </section>

        <section class="panel track-panel">

            <form id="trackForm" class="track-search">

                <div class="field">
                    <label for="reportCode">
                        Report ID / tracking code
                    </label>

                    <input
                        id="reportCode"
                        placeholder="Enter report ID"
                        required
                    >
                </div>

                <button class="primary-btn">
                    Track Report
                </button>

            </form>

            <div id="trackResult">
                <div class="empty">
                    Your report status will appear here.
                </div>
            </div>

            <p class="hint">
                Offline mode can show locally saved reports.
                The latest faculty updates require synchronization.
            </p>

        </section>
    `;
}

async function doTrack(code) {
    const reports = await getAllReports();

    const r = reports.find(x =>
        x.localId.toLowerCase() === code.toLowerCase() ||
        (x.publicCode || "").toLowerCase() === code.toLowerCase() ||
        x.localId.slice(0, 8).toLowerCase() === code.toLowerCase()
    );

    if (!r) {
        $("trackResult").innerHTML = `
            <div class="empty">
                No matching report was found on this device.
                If this report was submitted from another device,
                connect to the central server and implement
                server-side tracking.
            </div>
        `;

        return;
    }

    $("trackResult").innerHTML = `
        <article class="track-card">

            <div class="track-top">

                <div>
                    <small>REPORT TRACKING</small>
                    <h3>${esc(r.title)}</h3>

                    <p>
                        ${esc(r.publicCode || r.localId.slice(0, 8).toUpperCase())}
                    </p>
                </div>

                <span class="status ${statusClass(statusLabel(r))}">
                    ${esc(statusLabel(r))}
                </span>

            </div>

            <div class="track-details">

                <p>
                    <b>Category</b>
                    ${esc(r.category)}
                </p>

                <p>
                    <b>Location</b>
                    ${esc([r.building, r.room].filter(Boolean).join(" · "))}
                </p>

                <p>
                    <b>Date submitted</b>
                    ${dateText(r.createdAt)}
                </p>

                <p>
                    <b>Priority</b>
                    ${esc(r.priority)}
                </p>

            </div>

            <div class="timeline">

                <div class="step done">
                    <i></i>
                    <b>Report submitted</b>
                    <small>${dateText(r.createdAt)}</small>
                </div>

                <div class="step ${r.status !== "Pending" ? "done" : ""}">
                    <i></i>
                    <b>Under review</b>

                    <small>
                        ${r.status === "Pending"
                            ? "Waiting for staff review"
                            : "Status updated by staff"}
                    </small>
                </div>

                <div class="step ${r.status === "Resolved" ? "done" : ""}">
                    <i></i>
                    <b>Resolution</b>

                    <small>
                        ${r.status === "Resolved"
                            ? "Marked as resolved"
                            : "Not yet resolved"}
                    </small>
                </div>

            </div>

        </article>
    `;
}

// PROFILE
function profileHTML(p) {
    p = p || {
        fullName: "Juan Dela Cruz",
        studentNumber: "",
        email: "",
        course: "",
        yearLevel: ""
    };

    return `
        <section class="page-heading">
            <p class="eyebrow">ACCOUNT SETTINGS</p>
            <h2>My Profile</h2>
            <p>View and update your student information.</p>
        </section>

        <section class="panel profile-panel">

            <div class="profile-banner">

                <div class="profile-avatar">
                    ${esc(
                        p.fullName
                            .split(" ")
                            .map(x => x[0])
                            .slice(0, 2)
                            .join("")
                    )}
                </div>

                <div>
                    <h3>${esc(p.fullName)}</h3>
                    <p>Student Account</p>
                </div>

            </div>

            <form id="profileForm" class="form-grid">

                <div class="field">
                    <label for="fullName">Full name</label>

                    <input
                        id="fullName"
                        name="fullName"
                        required
                        value="${esc(p.fullName)}"
                    >
                </div>

                <div class="field">
                    <label for="studentNumber">Student number</label>

                    <input
                        id="studentNumber"
                        name="studentNumber"
                        value="${esc(p.studentNumber || "")}"
                    >
                </div>

                <div class="field">
                    <label for="email">Email address</label>

                    <input
                        id="email"
                        name="email"
                        type="email"
                        required
                        value="${esc(p.email || "")}"
                    >
                </div>

                <div class="field">
                    <label for="course">Program / course</label>

                    <input
                        id="course"
                        name="course"
                        value="${esc(p.course || "")}"
                    >
                </div>

                <div class="field">
                    <label for="yearLevel">Year level</label>

                    <select id="yearLevel" name="yearLevel">
                        <option value="">Select year</option>

                        ${["1st Year", "2nd Year", "3rd Year", "4th Year", "5th Year"]
                            .map(v => `
                                <option ${p.yearLevel === v ? "selected" : ""}>
                                    ${v}
                                </option>
                            `).join("")}
                    </select>
                </div>

                <div class="field full">
                    <div class="offline-callout">
                        Profile edits on this page are stored locally
                        in this browser. Connect a secure Laravel
                        account API to update your official account.
                    </div>
                </div>

                <div class="field full form-actions">
                    <button class="primary-btn">
                        Save Changes
                    </button>
                </div>

            </form>

        </section>
    `;
}

// LOGIN
function loginHTML() {
    return `
        <section class="login-wrap">

            <section class="login-card">

                <div class="brand-mark">🔧</div>

                <h1>Fix<span>CIT</span></h1>

                <p>
                    Facility Issue Reporting and Monitoring System
                </p>

                <h2>Welcome back</h2>

                <form id="loginForm">

                    <div class="field">
                        <label for="loginEmail">Email address</label>

                        <input
                            id="loginEmail"
                            type="email"
                            required
                            placeholder="student@example.com"
                        >
                    </div>

                    <div class="field">
                        <label for="loginPassword">Password</label>

                        <input
                            id="loginPassword"
                            type="password"
                            required
                            placeholder="Enter password"
                        >
                    </div>

                    <button class="primary-btn full-btn">
                        Continue
                    </button>

                </form>

                <small class="hint">
                    Demo screen only. Real authentication must be
                    handled securely by Laravel. Do not store
                    passwords in IndexedDB.
                </small>

                <a href="index.html" class="text-btn">
                    Return to dashboard (demo)
                </a>

            </section>

        </section>
    `;
}

// INITIALIZE PAGES
async function initPage() {
    db = await openDB();

    // Login page
    if (page === "login") {
        app.innerHTML = loginHTML();

        $("loginForm").addEventListener("submit", async e => {
            e.preventDefault();

            await putSession({
                demo: true,
                signedInAt: new Date().toISOString()
            });

            location.href = "index.html";
        });

        return;
    }

    let content = "";

    if (page === "dashboard") {
        content = dashboardHTML();
    }

    if (page === "submit") {
        content = submitHTML();
    }

    if (page === "reports") {
        content = `
            <section class="page-heading">
                <p class="eyebrow">REPORT HISTORY</p>
                <h2>My Reports</h2>
                <p>
                    Review the facility concerns you have submitted.
                </p>
            </section>

            <section class="panel">

                <div class="filters">

                    <input
                        id="reportSearch"
                        placeholder="Search title, category, location or ID"
                    >

                    <select id="statusFilter">
                        <option value="">All statuses</option>
                        <option>Pending</option>
                        <option>In Progress</option>
                        <option>Resolved</option>
                        <option>Saved Offline</option>
                    </select>

                </div>

                <div id="reportTable" class="report-list">
                    <div class="empty">Loading reports...</div>
                </div>

            </section>
        `;
    }

    if (page === "track") {
        content = trackHTML();
    }

    if (page === "profile") {
        const p = await getProfile();
        content = profileHTML(p?.value);
    }

    app.innerHTML = shell(content);

    bindShell();

    // Dashboard
    if (page === "dashboard") {
        await renderDashboard();
    }

    // Submit report
    if (page === "submit") {
        $("submitForm").addEventListener("submit", async e => {
            e.preventDefault();

            try {
                const r = await saveSubmission(e.currentTarget);

                toast("Report saved on this device.");

                if (navigator.onLine) {
                    await syncQueue();
                }

                location.href =
                    "track.html?id=" +
                    encodeURIComponent(r.localId.slice(0, 8));

            } catch (err) {
                console.error(err);
                toast("Could not save report. Check browser storage.");
            }
        });
    }

    // My reports
    if (page === "reports") {
        await renderReports();
    }

    // Track report
    if (page === "track") {
        $("trackForm").addEventListener("submit", e => {
            e.preventDefault();
            doTrack($("reportCode").value.trim());
        });

        const q = new URLSearchParams(location.search).get("id");

        if (q) {
            $("reportCode").value = q;
            doTrack(q);
        }
    }

    // Profile
    if (page === "profile") {
        $("profileForm").addEventListener("submit", async e => {
            e.preventDefault();

            const v = Object.fromEntries(
                new FormData(e.currentTarget)
            );

            await putProfile(v);

            toast("Profile saved on this device.");

            setTimeout(() => location.reload(), 500);
        });
    }

    // Attempt synchronization when online.
    if (navigator.onLine) {
        syncQueue();
    }
}

// OFFLINE REPORT SYNCHRONIZATION
async function syncQueue() {
    if (!db || !navigator.onLine) {
        return;
    }

    const pending = (await getAllReports())
        .filter(r => r.syncStatus === "pending");

    for (const r of pending) {
        try {
            const body = new FormData();

            [
                "localId",
                "title",
                "category",
                "priority",
                "building",
                "room",
                "description",
                "createdAt"
            ].forEach(k => {
                body.append(k, r[k] ?? "");
            });

            if (r.photo) {
                body.append("photo", r.photo, "report-photo");
            }

            const res = await fetch(`${API_BASE}/reports`, {
                method: "POST",
                body,
                headers: {
                    "Idempotency-Key": r.localId
                }
            });

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const result = await res.json();

            r.syncStatus = "synced";
            r.serverId = result.id || null;
            r.publicCode = result.public_code || r.publicCode;
            r.status = result.status || r.status;
            r.syncedAt = new Date().toISOString();

            await putReport(r);

        } catch (err) {
            console.info(
                "Sync deferred; report remains safely stored locally.",
                err
            );

            break;
        }
    }

    if (page === "dashboard") {
        renderDashboard();
    }

    if (page === "reports") {
        renderReports();
    }
}

// START APPLICATION
initPage().catch(err => {
    console.error(err);

    app.innerHTML = `
        <main class="fatal">
            Unable to initialize FixCIT.
            Please use a modern browser with IndexedDB enabled.
        </main>
    `;
});

// Register service worker for offline app-shell caching.
if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker
        .register("./service-worker.js")
        .catch(console.warn);
}
