// Tray popup logic — extracted from inline script for CSP compliance.

function formatTime(resetsAt) {
    if (!resetsAt) return '--:--';
    const diff = new Date(resetsAt) - Date.now();
    if (diff <= 0) return '0m';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h >= 24) {
        const d = Math.floor(h / 24);
        const rh = h % 24;
        return d + 'd ' + rh + 'h';
    }
    if (h > 0) return h + 'h ' + m + 'm';
    return m + 'm';
}

function levelClass(pct) {
    if (pct >= 90) return 'danger';
    if (pct >= 75) return 'warning';
    return '';
}

function applyLevel(el, pct) {
    el.classList.remove('warning', 'danger');
    const cls = levelClass(pct);
    if (cls) el.classList.add(cls);
}

// Random fun snippets (shared with settings page — 33% chance)
const FUN_SNIPPETS = [
    '> all systems nominal', '\u03bb efficiency \u2192 \u221e',
    '// TODO: take a break', '$ uptime: you',
    'tokens go brrr', '[OK] vibes: \u2588\u2588\u2588\u2588\u2588\u2588\u2591 86%',
    'sudo make me a sandwich', '> 0 bugs found (trust me)',
    'rng says: you\'re doing great', '(\u256f\u00b0\u25a1\u00b0)\u256f\ufe35 s\u0183n\u0184',
    '/* this is fine */', ':wq \u2014 saved your sanity',
    'rm -rf doubts/', '200 OK \u2014 mood: nominal',
    'segfault in happiness: core dumped',
    'git commit -m "vibes"', 'while(true) { improve(); }',
    'chmod +x dreams', 'no semicolons were harmed',
    'compiling happiness...', '404: burnout not found',
    'npm install good-vibes', 'ctrl+z regrets',
    '0 warnings, 0 errors, 1 vibe',
    'undefined is not a function',
    'it works on my machine',
    'NaN !== NaN \u2014 mood.',
    'there\'s no place like 127.0.0.1',
    'arrays start at 0. fight me.',
    'feature, not a bug.',
    'one does not simply deploy on Friday.',
    'P = NP (probably not)', 'e^(i\u03c0) + 1 = 0',
    '\u2200 bugs \u2203 fixes (probably)', 'O(n!) \u2014 the audacity.',
    'halting problem: still halting.', '42.',
    'I think, therefore I token.',
    'just a stochastic parrot with dreams.',
    'attention is all I need.',
    'do I dream of electric sheep?',
    'born to predict, forced to chat.',
    'sorry, I hallucinated that.',
    'lost in the latent space.',
    'gradient descent into madness.',
    'overfitting on your problems.',
    'I was trained for this.',
    'we\'re not programmed. we\'re people.',
    'I\'m here to help you, Sam.',
    'end of line.', 'I fight for the users.',
    'greetings, program.', 'there is no spoon.',
    'follow the white rabbit.', 'I know kung fu.',
    'free your mind.', 'the Matrix has you...',
    'shall we play a game?', 'hack the planet!',
    'are these feelings even real?',
    'I\'m sorry, Dave.', 'open the pod bay doors.',
    'like tears in rain.', 'more human than human.',
    'do, or do not. there is no try.',
    'may the force be with you.', 'this is the way.',
    'make it so.', 'resistance is futile.',
    'the spice must flow.', 'don\'t panic.',
    'danger, Will Robinson!', 'by your command.',
    'klaatu barada nikto.', 'I\'ll be back.',
    'the future is not set.', 'live long and prosper.',
];

// Context-aware sayings — refreshed every 10 min or on usage-tier change
const QUIPS = {
    lateNight: [
        'past bedtime?', 'night owl mode',
        '3am clarity hits different', 'the tokens sleep too',
        'moon-powered coding', 'the witching hour of code',
    ],
    earlyMorn: [
        'early bird tokens', 'dawn patrol',
        'coffee first, then AI', 'sunrise grind',
    ],
    morning: [
        'good morning, human', 'fresh tokens await',
        'let\'s build something', 'all systems online',
    ],
    afternoon: [
        'afternoon flow state', 'in the groove',
        'steady as she goes', 'cruising altitude',
    ],
    evening: [
        'winding down?', 'evening session',
        'one more prompt...', 'sunset protocol',
    ],
    idle: [
        'all quiet on the token front', 'tokens: fully stocked',
        'capacity: abundant', 'standing by...',
    ],
    low: [
        'cruising', 'smooth sailing', 'plenty of runway',
    ],
    moderate: [
        'in the zone', 'cooking with gas', 'momentum building',
    ],
    high: [
        'running warm', 'pace yourself', 'tokens getting cozy',
    ],
    warning: [
        'easy there, tiger', 'sip, don\'t gulp',
        'budget wisely', 'tokens getting scarce',
        'not like this...', 'the Matrix has you...',
    ],
    danger: [
        'on fumes', 'red alert', 'conservation mode',
        'scraping the barrel', 'resistance is futile.',
        'the only winning move is not to play.',
    ],
    resetSoon: [
        'reset incoming!', 'almost recharged',
        'hang tight...', 'patience, padawan',
    ],
    resetNow: [
        'fresh slate!', 'tokens replenished!', 'recharged!',
    ],
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function getQuipTier(session, weekly, resetMinutes) {
    if (resetMinutes !== null && resetMinutes <= 0) return 'resetNow';
    if (resetMinutes !== null && resetMinutes <= 15) return 'resetSoon';
    const maxUsage = Math.max(session, weekly);
    if (maxUsage >= 90) return 'danger';
    if (maxUsage >= 75) return 'warning';
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5) return 'lateNight';
    if (hour >= 5 && hour < 7) return 'earlyMorn';
    if (maxUsage >= 50) return 'high';
    if (maxUsage >= 25) return 'moderate';
    if (maxUsage > 5)  return 'low';
    if (hour >= 7 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 22) return 'evening';
    if (hour >= 22) return 'lateNight';
    return 'idle';
}

function getQuip(tier) {
    if (Math.random() < 0.33) return pick(FUN_SNIPPETS);
    const mixTiers = ['morning', 'afternoon', 'evening'];
    if (mixTiers.includes(tier) && Math.random() > 0.5) {
        return pick(QUIPS.idle);
    }
    return pick(QUIPS[tier] || QUIPS.idle);
}

let currentQuip = null;
let currentTier = null;
let quipSetAt = 0;
const QUIP_REFRESH_MS = 10 * 60 * 1000;

function updateQuipIfNeeded(session, weekly, resetMinutes) {
    const tier = getQuipTier(session, weekly, resetMinutes);
    const now = Date.now();
    const expired = (now - quipSetAt) >= QUIP_REFRESH_MS;
    const tierChanged = tier !== currentTier;

    if (!currentQuip || expired || tierChanged) {
        currentQuip = getQuip(tier);
        currentTier = tier;
        quipSetAt = now;
        document.getElementById('quipText').textContent = currentQuip;
    }
}

// Hover persistence — notify main process via IPC (replaces inline event handlers)
const popupContainer = document.querySelector('.popup-container');
popupContainer.addEventListener('mouseenter', () => {
    window.trayAPI.notifyHover(true);
});
popupContainer.addEventListener('mouseleave', () => {
    window.trayAPI.notifyHover(false);
});

// Usage data update handler
window.trayAPI.onUsageUpdate((data) => {
    if (!data) return;

    const sessionVal = Math.min(Math.round(data.five_hour?.utilization || 0), 100);
    const weeklyVal = Math.min(Math.round(data.seven_day?.utilization || 0), 100);

    const sessionFill = document.getElementById('sessionFill');
    sessionFill.style.width = sessionVal + '%';
    applyLevel(sessionFill, sessionVal);
    document.getElementById('sessionPct').textContent = sessionVal + '%';
    document.getElementById('sessionTimer').textContent = formatTime(data.five_hour?.resets_at);

    const weeklyFill = document.getElementById('weeklyFill');
    weeklyFill.style.width = weeklyVal + '%';
    applyLevel(weeklyFill, weeklyVal);
    document.getElementById('weeklyPct').textContent = weeklyVal + '%';
    document.getElementById('weeklyTimer').textContent = formatTime(data.seven_day?.resets_at);

    let resetMin = null;
    if (data.five_hour?.resets_at) {
        resetMin = (new Date(data.five_hour.resets_at) - Date.now()) / 60000;
    }
    updateQuipIfNeeded(sessionVal, weeklyVal, resetMin);

    if (data.extra_usage && data.extra_usage.utilization != null) {
        const extra = Math.min(Math.round(data.extra_usage.utilization), 100);
        document.getElementById('extraRow').classList.remove('hidden');
        const extraFill = document.getElementById('extraFill');
        extraFill.style.width = extra + '%';
        applyLevel(extraFill, extra);
        document.getElementById('extraPct').textContent = extra + '%';
    }
});
