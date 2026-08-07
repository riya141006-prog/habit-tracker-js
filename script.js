/* ==========================================================================
   RITUAL — HABIT TRACKER SCRIPT
   Plain, beginner-friendly JavaScript. No frameworks, no build step.

   Sections:
   1. Grab elements from the page
   2. App state + localStorage helpers
   3. Date helpers (for streak logic)
   4. Rendering (turning state into HTML)
   5. Progress ring / bar updates
   6. Toast notifications
   7. Add / Edit / Delete / Toggle habit logic
   8. Filter tabs
   9. Dark mode toggle
   10. Event listeners (wiring everything together)
   ========================================================================== */

/* ---------- 1. GRAB ELEMENTS FROM THE PAGE ---------- */
const habitForm      = document.getElementById("habitForm");
const habitInput      = document.getElementById("habitInput");
const habitIconSelect = document.getElementById("habitIcon");
const habitList        = document.getElementById("habitList");
const emptyState       = document.getElementById("emptyState");
const filterTabs        = document.getElementById("filterTabs");

const ringFill      = document.getElementById("ringFill");
const ringPercent    = document.getElementById("ringPercent");
const progressText   = document.getElementById("progressText");
const progressBarFill = document.getElementById("progressBarFill");
const statTotal   = document.getElementById("statTotal");
const statDone    = document.getElementById("statDone");
const statStreak  = document.getElementById("statStreak");

const editModal  = document.getElementById("editModal");
const editInput  = document.getElementById("editInput");
const editIcon   = document.getElementById("editIcon");
const saveEditBtn   = document.getElementById("saveEdit");
const cancelEditBtn = document.getElementById("cancelEdit");

const themeToggle = document.getElementById("themeToggle");
const themeIcon   = document.getElementById("themeIcon");

const toastContainer = document.getElementById("toastContainer");

/* Circle circumference for the progress ring animation (r = 52) */
const RING_CIRCUMFERENCE = 2 * Math.PI * 52;

/* Keeps track of which habit is currently being edited in the modal */
let habitIdBeingEdited = null;

/* Keeps track of the active filter: "all" | "active" | "completed" */
let currentFilter = "all";


/* ---------- 2. APP STATE + LOCALSTORAGE HELPERS ---------- */

/* Load habits from localStorage, or start with an empty array. */
function loadHabits() {
  const saved = localStorage.getItem("ritual_habits");
  return saved ? JSON.parse(saved) : [];
}

/* Save the current habits array to localStorage. */
function saveHabits() {
  localStorage.setItem("ritual_habits", JSON.stringify(habits));
}

/* Our in-memory list of habits. Each habit looks like:
   {
     id: "unique-id",
     name: "Drink 2L of water",
     icon: "💧",
     completedToday: false,
     streak: 0,          // current consecutive-day streak
     bestStreak: 0,       // longest streak ever reached
     lastCompletedDate: null // ISO date string "YYYY-MM-DD"
   }
*/
let habits = loadHabits();


/* ---------- 3. DATE HELPERS ---------- */

/* Returns today's date as "YYYY-MM-DD" (ignores time, so it's stable
   for comparing "which day" something happened on). */
function todayString() {
  return new Date().toISOString().split("T")[0];
}

/* Returns yesterday's date as "YYYY-MM-DD". Used to check if a streak
   should continue (completed yesterday) or reset (missed a day). */
function yesterdayString() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}


/* ---------- 4. RENDERING ---------- */

/* Builds the HTML for a single habit and returns it as a <li> element. */
function createHabitElement(habit) {
  const li = document.createElement("li");
  li.className = "habit-item glass" + (habit.completedToday ? " completed" : "");
  li.dataset.id = habit.id;

  li.innerHTML = `
    <button class="habit-check ${habit.completedToday ? "checked" : ""}" aria-label="Mark habit complete">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    </button>

    <span class="habit-icon">${habit.icon}</span>

    <div class="habit-info">
      <div class="habit-name">${escapeHtml(habit.name)}</div>
      <div class="habit-streak">🔥 ${habit.streak} day streak · best ${habit.bestStreak}</div>
    </div>

    <div class="habit-actions">
      <button class="icon-btn edit-btn" aria-label="Edit habit" title="Edit">✏️</button>
      <button class="icon-btn delete-btn" aria-label="Delete habit" title="Delete">🗑️</button>
    </div>
  `;

  return li;
}

/* Prevents user-typed text from accidentally being read as HTML. */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* Redraws the whole habit list based on current state + active filter. */
function renderHabits() {
  habitList.innerHTML = "";

  // Apply the current filter (all / active / completed)
  const visibleHabits = habits.filter((h) => {
    if (currentFilter === "active") return !h.completedToday;
    if (currentFilter === "completed") return h.completedToday;
    return true;
  });

  if (visibleHabits.length === 0) {
    emptyState.classList.add("visible");
    // Slightly different message if the list isn't truly empty, just filtered
    emptyState.querySelector("p").textContent =
      habits.length === 0
        ? "Add a habit above to start building your streak."
        : "No habits match this filter.";
  } else {
    emptyState.classList.remove("visible");
    visibleHabits.forEach((habit) => {
      habitList.appendChild(createHabitElement(habit));
    });
  }

  updateProgress();
}


/* ---------- 5. PROGRESS RING / BAR UPDATES ---------- */

function updateProgress() {
  const total = habits.length;
  const done = habits.filter((h) => h.completedToday).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const bestStreak = habits.reduce((max, h) => Math.max(max, h.bestStreak), 0);

  // Update the circular ring by offsetting its dash pattern
  const offset = RING_CIRCUMFERENCE - (percent / 100) * RING_CIRCUMFERENCE;
  ringFill.style.strokeDashoffset = offset;
  ringPercent.textContent = `${percent}%`;

  // Update the linear progress bar
  progressBarFill.style.width = `${percent}%`;

  // Update the little stat pills
  statTotal.textContent = total;
  statDone.textContent = done;
  statStreak.textContent = bestStreak;

  // Update the friendly summary text
  if (total === 0) {
    progressText.textContent = "No habits yet — add your first one!";
  } else if (done === total) {
    progressText.textContent = "All habits complete today. Amazing work! 🎉";
  } else {
    progressText.textContent = `${done} of ${total} habits completed today.`;
  }
}


/* ---------- 6. TOAST NOTIFICATIONS ---------- */

/* Shows a small popup message at the bottom of the screen.
   type can be "success" (default), "error", or "info" — it just
   changes the accent color of the toast. */
function showToast(message, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  const icons = { success: "✅", error: "⚠️", info: "ℹ️" };
  toast.innerHTML = `<span>${icons[type] || "✅"}</span><span>${escapeHtml(message)}</span>`;

  toastContainer.appendChild(toast);

  // Remove the toast automatically after its animation finishes (3s)
  setTimeout(() => {
    toast.remove();
  }, 3000);
}


/* ---------- 7. ADD / EDIT / DELETE / TOGGLE HABIT LOGIC ---------- */

/* Adds a brand new habit to the list. */
function addHabit(name, icon) {
  const newHabit = {
    id: Date.now().toString(), // simple unique id based on timestamp
    name: name,
    icon: icon,
    completedToday: false,
    streak: 0,
    bestStreak: 0,
    lastCompletedDate: null,
  };

  habits.unshift(newHabit); // add to the top of the list
  saveHabits();
  renderHabits();
  showToast("Habit added!");
}

/* Toggles a habit's "completed today" state and updates its streak. */
function toggleHabitComplete(id) {
  const habit = habits.find((h) => h.id === id);
  if (!habit) return;

  const today = todayString();
  const yesterday = yesterdayString();

  if (!habit.completedToday) {
    // Marking as complete
    habit.completedToday = true;

    if (habit.lastCompletedDate === yesterday) {
      // Continues an existing streak
      habit.streak += 1;
    } else {
      // Streak was broken (or this is the first ever completion)
      habit.streak = 1;
    }

    habit.lastCompletedDate = today;
    habit.bestStreak = Math.max(habit.bestStreak, habit.streak);

    showToast(`"${habit.name}" marked complete! 🔥 ${habit.streak} day streak`);
  } else {
    // Un-marking (user clicked again by mistake)
    habit.completedToday = false;
    habit.streak = Math.max(0, habit.streak - 1);
    habit.lastCompletedDate = habit.streak > 0 ? yesterday : null;
    showToast("Marked as not done", "info");
  }

  saveHabits();
  renderHabits();
}

/* Removes a habit from the list, with a small exit animation first. */
function deleteHabit(id) {
  const habitEl = habitList.querySelector(`[data-id="${id}"]`);
  const habit = habits.find((h) => h.id === id);

  if (habitEl) {
    habitEl.classList.add("removing");
    // Wait for the CSS animation to finish before removing from state
    setTimeout(() => {
      habits = habits.filter((h) => h.id !== id);
      saveHabits();
      renderHabits();
      showToast(`"${habit ? habit.name : "Habit"}" deleted`, "error");
    }, 280);
  }
}

/* Opens the edit modal, pre-filled with the chosen habit's info. */
function openEditModal(id) {
  const habit = habits.find((h) => h.id === id);
  if (!habit) return;

  habitIdBeingEdited = id;
  editInput.value = habit.name;
  editIcon.value = habit.icon;
  editModal.classList.add("open");
  editInput.focus();
}

function closeEditModal() {
  editModal.classList.remove("open");
  habitIdBeingEdited = null;
}

/* Saves changes made in the edit modal back into the habit list. */
function saveEditedHabit() {
  const habit = habits.find((h) => h.id === habitIdBeingEdited);
  if (!habit) return;

  const newName = editInput.value.trim();
  if (newName === "") {
    showToast("Habit name can't be empty", "error");
    return;
  }

  habit.name = newName;
  habit.icon = editIcon.value;

  saveHabits();
  renderHabits();
  closeEditModal();
  showToast("Habit updated!");
}


/* ---------- 8. FILTER TABS ---------- */

function setFilter(filter) {
  currentFilter = filter;

  // Update which tab looks "active"
  document.querySelectorAll(".filter-tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.filter === filter);
  });

  renderHabits();
}


/* ---------- 9. DARK MODE TOGGLE ---------- */

function applyTheme(isDark) {
  document.body.classList.toggle("dark-mode", isDark);
  themeIcon.textContent = isDark ? "☀️" : "🌙";
  localStorage.setItem("ritual_theme", isDark ? "dark" : "light");
}

function initTheme() {
  const saved = localStorage.getItem("ritual_theme");
  // Fall back to the user's OS preference if they haven't chosen yet
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = saved ? saved === "dark" : prefersDark;
  applyTheme(isDark);
}


/* ---------- 10. EVENT LISTENERS ---------- */

/* Adding a new habit via the form */
habitForm.addEventListener("submit", (e) => {
  e.preventDefault();

  const name = habitInput.value.trim();
  if (name === "") {
    showToast("Please enter a habit name", "error");
    return;
  }

  addHabit(name, habitIconSelect.value);
  habitInput.value = "";
  habitInput.focus();
});

/* Event delegation: one listener on the list handles clicks for every
   habit (check, edit, delete) instead of adding listeners one by one. */
habitList.addEventListener("click", (e) => {
  const habitEl = e.target.closest(".habit-item");
  if (!habitEl) return;
  const id = habitEl.dataset.id;

  if (e.target.closest(".habit-check")) {
    toggleHabitComplete(id);
  } else if (e.target.closest(".edit-btn")) {
    openEditModal(id);
  } else if (e.target.closest(".delete-btn")) {
    deleteHabit(id);
  }
});

/* Filter tab clicks */
filterTabs.addEventListener("click", (e) => {
  const tab = e.target.closest(".filter-tab");
  if (tab) setFilter(tab.dataset.filter);
});

/* Edit modal controls */
saveEditBtn.addEventListener("click", saveEditedHabit);
cancelEditBtn.addEventListener("click", closeEditModal);
editModal.addEventListener("click", (e) => {
  // Close the modal if the user clicks the dark overlay (not the box itself)
  if (e.target === editModal) closeEditModal();
});
editInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveEditedHabit();
  if (e.key === "Escape") closeEditModal();
});

/* Dark mode toggle button */
themeToggle.addEventListener("click", () => {
  const isDark = !document.body.classList.contains("dark-mode");
  applyTheme(isDark);
});


/* ---------- INITIALIZE THE APP ---------- */
initTheme();
renderHabits();