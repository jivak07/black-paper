const form = document.getElementById('task-form');
const taskNameInput = document.getElementById('task-name');
const taskCategoryInput = document.getElementById('task-category');
const taskEstimateInput = document.getElementById('task-estimate');
const taskUnitInput = document.getElementById('task-unit');
const taskDreadInput = document.getElementById('task-dread');
const taskTargetDateInput = document.getElementById('task-target-date');
const taskList = document.getElementById('task-list');
const prediction = document.getElementById('prediction');
const stats = document.getElementById('stats');
const weeklyCheck = document.getElementById('weekly-check');
const dayTotal = document.getElementById('day-total');
const trendSection = document.getElementById('trend');
const exportBtn = document.getElementById('export-btn');
const importInput = document.getElementById('import-input');
const cardBtn = document.getElementById('card-btn');

const UNIT_TO_MINUTES = {
  'minutes': 1,
  'hours': 60,
  'days': 1440
};

const HISTORY_PAGE_SIZE = 10;
const QUICK_WORDS = ['quick', 'just', 'simple', 'fast', 'easy'];

const MOOD_MESSAGES = {
  improving: [
    'Your estimates are getting sharper.',
    'Real progress. Keep logging.',
    'The gap is closing.'
  ],
  worsening: [
    'A rougher stretch. That happens.',
    'Estimates drifted this week. Worth a look.',
    'Still useful data, even on an off week.'
  ],
  stable: [
    'Holding steady.',
    'Consistent pattern so far.'
  ],
  new: [
    'Just getting started.',
    'Every task adds to the picture.'
  ]
};

let tasks = JSON.parse(localStorage.getItem('tasks')) || [];
let showAllHistory = false;

function formatTime(minutes) {
  const rounded = Math.round(minutes);

  if (rounded < 60) {
    return rounded + ' min';
  }

  if (rounded < 1440) {
    const hours = Math.floor(rounded / 60);
    const mins = rounded % 60;
    return mins > 0 ? hours + 'h ' + mins + 'm' : hours + 'h';
  }

  const days = Math.floor(rounded / 1440);
  const hours = Math.round((rounded % 1440) / 60);
  return hours > 0 ? days + 'd ' + hours + 'h' : days + 'd';
}

function formatElapsed(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const paddedSecs = secs < 10 ? '0' + secs : String(secs);

  if (hours > 0) {
    const paddedMins = mins < 10 ? '0' + mins : String(mins);
    return hours + ':' + paddedMins + ':' + paddedSecs;
  }

  return mins + ':' + paddedSecs;
}

function getCategoryList() {
  return Array.from(taskCategoryInput.options)
    .map(opt => opt.value)
    .filter(v => v !== 'task category');
}

function getUrgencyClass(targetDate) {
  if (!targetDate) {
    return '';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(targetDate + 'T00:00:00');
  const daysLeft = Math.round((target - today) / 86400000);

  if (daysLeft < 0) {
    return 'task-overdue';
  }

  if (daysLeft <= 1) {
    return 'task-urgent';
  }

  return '';
}

function calculateMultiplier(categoryFilter) {
  let completed = tasks.filter(function (t) {
    return t.actualMinutes !== undefined && t.estimateMinutes > 0;
  });

  if (categoryFilter) {
    completed = completed.filter(function (t) {
      return t.category === categoryFilter;
    });
  }

  completed = completed.slice(-8);

  if (completed.length === 0) {
    return null;
  }

  const totalRatio = completed.reduce(function (sum, t) {
    return sum + (t.actualMinutes / t.estimateMinutes);
  }, 0);

  return totalRatio / completed.length;
}

function calculateDreadInsight() {
  const rated = tasks.filter(function (t) {
    return t.actualMinutes !== undefined && t.dread;
  });

  const highDread = rated.filter(function (t) { return t.dread >= 4; });
  const lowDread = rated.filter(function (t) { return t.dread <= 2; });

  if (highDread.length < 2 || lowDread.length < 2) {
    return { ready: false };
  }

  const avgRatio = function (list) {
    const sum = list.reduce(function (total, t) {
      return total + (t.actualMinutes / t.estimateMinutes);
    }, 0);
    return sum / list.length;
  };

  const highAvg = avgRatio(highDread);
  const lowAvg = avgRatio(lowDread);

  if (highAvg <= lowAvg) {
    return { ready: false };
  }

  return { ready: true, percent: Math.round((highAvg / lowAvg - 1) * 100) };
}

function calculateDistractionInsight() {
  const rated = tasks.filter(function (t) {
    return t.actualMinutes !== undefined && t.tabSwitches !== undefined;
  });

  const distracted = rated.filter(function (t) { return t.tabSwitches >= 3; });
  const focused = rated.filter(function (t) { return t.tabSwitches === 0; });

  if (distracted.length < 2 || focused.length < 2) {
    return { ready: false };
  }

  const avgRatio = function (list) {
    const sum = list.reduce(function (total, t) {
      return total + (t.actualMinutes / t.estimateMinutes);
    }, 0);
    return sum / list.length;
  };

  const distractedAvg = avgRatio(distracted);
  const focusedAvg = avgRatio(focused);

  if (distractedAvg <= focusedAvg) {
    return { ready: false };
  }

  return { ready: true, percent: Math.round((distractedAvg / focusedAvg - 1) * 100) };
}

function calculateQuickTaskInsight() {
  const quickTasks = tasks.filter(function (t) {
    if (t.actualMinutes === undefined) {
      return false;
    }
    const nameLower = t.name.toLowerCase();
    return QUICK_WORDS.some(function (word) {
      return nameLower.indexOf(word) !== -1;
    });
  });

  if (quickTasks.length < 3) {
    return null;
  }

  const avgRatio = quickTasks.reduce(function (sum, t) {
    return sum + (t.actualMinutes / t.estimateMinutes);
  }, 0) / quickTasks.length;

  if (avgRatio <= 1.2) {
    return null;
  }

  const overCount = quickTasks.filter(function (t) {
    return t.actualMinutes > t.estimateMinutes;
  }).length;

  return { count: quickTasks.length, overCount: overCount };
}

function getSampleTask() {
  const completed = tasks.filter(function (t) {
    return t.actualMinutes !== undefined && t.estimateMinutes > 0;
  });

  if (completed.length === 0) {
    return null;
  }

  return completed[completed.length - 1];
}

function getStartOfWeek(timestamp) {
  const now = timestamp ? new Date(timestamp) : new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const start = new Date(now);
  start.setDate(now.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

function calculateWeeklyTrend() {
  const completed = tasks.filter(function (t) {
    return t.actualMinutes !== undefined && t.estimateMinutes > 0;
  });

  const weekGroups = {};

  completed.forEach(function (t) {
    const weekStart = getStartOfWeek(t.completedAt);
    if (!weekGroups[weekStart]) {
      weekGroups[weekStart] = { ratioSum: 0, count: 0 };
    }
    weekGroups[weekStart].ratioSum += t.actualMinutes / t.estimateMinutes;
    weekGroups[weekStart].count += 1;
  });

  const weekStarts = Object.keys(weekGroups).sort();

  return weekStarts.map(ws => {
    const group = weekGroups[ws];
    return {
      weekStart: Number(ws),
      avgMultiplier: group.ratioSum / group.count
    };
  });
}

function getMood() {
  const trend = calculateWeeklyTrend();

  if (trend.length < 2) {
    return 'new';
  }

  const latest = trend[trend.length - 1].avgMultiplier;
  const previous = trend[trend.length - 2].avgMultiplier;

  if (latest < previous - 0.1) {
    return 'improving';
  }

  if (latest > previous + 0.1) {
    return 'worsening';
  }

  return 'stable';
}

function getMoodMessage() {
  const mood = getMood();
  const options = MOOD_MESSAGES[mood];
  return options[Math.floor(Math.random() * options.length)];
}

function renderStats() {
  const multiplier = calculateMultiplier(null);

  if (multiplier === null) {
    stats.innerHTML = '<p class="stats-empty">Complete a few tasks to see your estimation pattern.</p>';
    return;
  }

  const percent = Math.round(Math.abs(multiplier - 1) * 100);
  const headline = multiplier >= 1
    ? 'On average, your tasks take ' + percent + '% longer than you plan.'
    : 'On average, your tasks take ' + percent + '% less time than you plan.';

  const sample = getSampleTask();
  const sampleEstimate = sample ? sample.estimateMinutes : 30;
  const sampleActual = Math.round(sampleEstimate * multiplier);

  let html = '<p class="mood-line">' + getMoodMessage() + '</p>';
  html += '<p class="stats-headline">' + headline + '</p>';
  html += '<p class="stats-example">Example: you estimate ' + formatTime(sampleEstimate) + ', it usually becomes ' + formatTime(sampleActual) + '.</p>';

  let categoryHtml = '';

  getCategoryList().forEach(function (cat) {
    const catMultiplier = calculateMultiplier(cat);
    if (catMultiplier !== null) {
      const catPercent = Math.round((catMultiplier - 1) * 100);
      const sign = catPercent >= 0 ? '+' : '';
      categoryHtml += '<p class="category-stat">' + cat + ': ' + sign + catPercent + '%</p>';
    }
  });

  if (categoryHtml) {
    html += '<div class="category-breakdown">' + categoryHtml + '</div>';
  }

  const lateTasks = tasks.filter(function (t) {
    return t.daysLate !== undefined;
  });

  if (lateTasks.length > 0) {
    const avgDaysLate = lateTasks.reduce(function (sum, t) {
      return sum + t.daysLate;
    }, 0) / lateTasks.length;

    const rounded = Math.round(avgDaysLate);
    let lateLine;

    if (rounded > 0) {
      lateLine = 'On tasks with a deadline, you finish ' + rounded + ' day' + (rounded === 1 ? '' : 's') + ' late on average.';
    } else if (rounded < 0) {
      lateLine = 'On tasks with a deadline, you finish ' + Math.abs(rounded) + ' day' + (Math.abs(rounded) === 1 ? '' : 's') + ' early on average.';
    } else {
      lateLine = 'On tasks with a deadline, you finish right on time on average.';
    }

    html += '<p class="stats-example">' + lateLine + '</p>';
  }

  const dreadInsight = calculateDreadInsight();

  if (dreadInsight.ready) {
    html += '<p class="stats-dread">Tasks you dread score ' + dreadInsight.percent + '% worse than tasks you do not mind.</p>';
  } else {
    html += '<p class="stats-locked">Rate a few more tasks (dreaded and easy) to unlock the dread insight.</p>';
  }

  const distractionInsight = calculateDistractionInsight();

  if (distractionInsight.ready) {
    html += '<p class="stats-dread">Tasks where you left the tab 3+ times score ' + distractionInsight.percent + '% worse than tasks with zero tab switches.</p>';
  }

  const quickInsight = calculateQuickTaskInsight();

  if (quickInsight !== null) {
    html += '<p class="stats-irony">You\'ve called ' + quickInsight.count + ' tasks "quick" or "simple." ' + quickInsight.overCount + ' of them ran over.</p>';
  }

  stats.innerHTML = html;
}

function renderWeeklyCheck() {
  const weekStart = getStartOfWeek();

  const thisWeek = tasks.filter(function (t) {
    return t.completedAt !== undefined && t.completedAt >= weekStart;
  });

  if (thisWeek.length === 0) {
    weeklyCheck.innerHTML = '';
    return;
  }

  const overCount = thisWeek.filter(function (t) {
    return t.actualMinutes > t.estimateMinutes;
  }).length;

  const categoryTotals = {};

  thisWeek.forEach(function (t) {
    if (!categoryTotals[t.category]) {
      categoryTotals[t.category] = { ratioSum: 0, count: 0 };
    }
    categoryTotals[t.category].ratioSum += t.actualMinutes / t.estimateMinutes;
    categoryTotals[t.category].count += 1;
  });

  let worstCategory = null;
  let worstAvg = 0;
  let bestCategory = null;
  let bestAvg = Infinity;

  for (const cat in categoryTotals) {
    const avg = categoryTotals[cat].ratioSum / categoryTotals[cat].count;
    if (avg > worstAvg) {
      worstAvg = avg;
      worstCategory = cat;
    }
    if (avg < bestAvg) {
      bestAvg = avg;
      bestCategory = cat;
    }
  }

  let html = '<p class="weekly-title">This Week\'s Reality Check</p>';
  html += '<p class="weekly-line">' + overCount + ' out of ' + thisWeek.length + ' tasks took longer than planned.</p>';

  if (worstCategory) {
    const worstPercent = Math.round((worstAvg - 1) * 100);
    const sign = worstPercent >= 0 ? '+' : '';
    html += '<p class="weekly-line">Biggest blind spot: ' + worstCategory + ' (' + sign + worstPercent + '%)</p>';
  }

  if (bestCategory && bestCategory !== worstCategory) {
    const bestPercent = Math.round((bestAvg - 1) * 100);
    const bestSign = bestPercent >= 0 ? '+' : '';
    html += '<p class="weekly-line-good">Most accurate: ' + bestCategory + ' (' + bestSign + bestPercent + '%)</p>';
  }

  const trend = calculateWeeklyTrend();

  if (trend.length >= 2) {
    const thisWeekTrend = trend[trend.length - 1];
    const lastWeekTrend = trend[trend.length - 2];
    const diff = Math.round((thisWeekTrend.avgMultiplier - lastWeekTrend.avgMultiplier) * 100);

    if (Math.abs(diff) >= 5) {
      const compareLine = diff < 0
        ? 'That is better than last week, by ' + Math.abs(diff) + ' points.'
        : 'That is worse than last week, by ' + diff + ' points.';
      html += '<p class="weekly-line">' + compareLine + '</p>';
    }
  }

  weeklyCheck.innerHTML = html;
}

function renderTrend() {
  const trend = calculateWeeklyTrend();

  if (trend.length < 2) {
    trendSection.innerHTML = '';
    return;
  }

  const recentWeeks = trend.slice(-6);

  let html = '<p class="trend-title">Your Trend</p>';

  recentWeeks.forEach(function (week) {
    const d = new Date(week.weekStart);
    const label = (d.getMonth() + 1) + '/' + d.getDate();
    const percent = Math.round((week.avgMultiplier - 1) * 100);
    const sign = percent >= 0 ? '+' : '';
    html += '<p class="trend-line">Week of ' + label + ': ' + sign + percent + '%</p>';
  });

  trendSection.innerHTML = html;
}

function renderDayTotal() {
  const pending = tasks.filter(function (t) {
    return t.actualMinutes === undefined;
  });

  if (pending.length === 0) {
    dayTotal.innerHTML = '';
    return;
  }

  let plannedTotal = 0;
  let realisticTotal = 0;

  pending.forEach(function (t) {
    plannedTotal += t.estimateMinutes;

    let multiplier = calculateMultiplier(t.category);
    if (multiplier === null) {
      multiplier = calculateMultiplier(null);
    }
    if (multiplier === null) {
      multiplier = 1;
    }

    realisticTotal += t.estimateMinutes * multiplier;
  });

  let html = '<p class="day-total-line">Planned: ' + formatTime(plannedTotal) + '</p>';
  html += '<p class="day-total-line day-total-realistic">Realistically: ~' + formatTime(realisticTotal) + '</p>';

  dayTotal.innerHTML = html;
}

function buildTaskCard(task) {
  const taskDiv = document.createElement('div');

  if (task.actualMinutes === undefined) {
    taskDiv.className = 'task ' + getUrgencyClass(task.targetDate);
    taskDiv.innerHTML = `
      <p class="task-name">${task.name}</p>
      <p class="task-estimate">${task.category} · Estimated: ${formatTime(task.estimateMinutes)}</p>
      <p class="task-timer" data-start="${task.startTime}">0:00</p>
      <button onclick="markDone(${task.id})">Done</button>
      <button class="delete-btn" onclick="deleteTask(${task.id})">Delete</button>
    `;
  } else {
    taskDiv.className = 'task';

    const gap = task.actualMinutes - task.estimateMinutes;
    const gapText = gap >= 0
      ? formatTime(gap) + ' over'
      : formatTime(Math.abs(gap)) + ' under';

    let procrastinationHtml = '';
    if (task.daysLate !== undefined) {
      if (task.daysLate > 0) {
        procrastinationHtml = '<p class="task-procrastination">' + task.daysLate + ' day' + (task.daysLate === 1 ? '' : 's') + ' late</p>';
      } else if (task.daysLate < 0) {
        procrastinationHtml = '<p class="task-procrastination">' + Math.abs(task.daysLate) + ' day' + (Math.abs(task.daysLate) === 1 ? '' : 's') + ' early</p>';
      } else {
        procrastinationHtml = '<p class="task-procrastination">right on time</p>';
      }
    }

    let distractionHtml = '';
    if (task.tabSwitches) {
      distractionHtml = '<p class="task-distraction">left the tab ' + task.tabSwitches + ' time' + (task.tabSwitches === 1 ? '' : 's') + '</p>';
    }

    taskDiv.innerHTML = `
      <p class="task-name">${task.name}</p>
      <p class="task-estimate">${task.category} · Estimated: ${formatTime(task.estimateMinutes)} &nbsp;|&nbsp; Actual: ${formatTime(task.actualMinutes)}</p>
      <p class="task-gap">${gapText}</p>
      ${procrastinationHtml}
      ${distractionHtml}
      <button class="delete-btn" onclick="deleteTask(${task.id})">Delete</button>
    `;
  }

  return taskDiv;
}

function renderTasks() {
  taskList.innerHTML = '';

  const pending = tasks.filter(function (t) { return t.actualMinutes === undefined; });
  let completed = tasks.filter(function (t) { return t.actualMinutes !== undefined; });
  completed = completed.slice().reverse();

  if (pending.length === 0 && completed.length === 0) {
    taskList.innerHTML = '<p class="task-empty">No tasks yet. Add one above to get started.</p>';
    return;
  }

  pending.forEach(function (task) {
    taskList.appendChild(buildTaskCard(task));
  });

  const visibleCompleted = showAllHistory ? completed : completed.slice(0, HISTORY_PAGE_SIZE);

  visibleCompleted.forEach(function (task) {
    taskList.appendChild(buildTaskCard(task));
  });

  if (completed.length > HISTORY_PAGE_SIZE) {
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'history-toggle';
    toggleBtn.type = 'button';

    if (showAllHistory) {
      toggleBtn.textContent = 'Show only recent';
      toggleBtn.onclick = function () {
        showAllHistory = false;
        renderTasks();
      };
    } else {
      toggleBtn.textContent = 'Show all ' + completed.length + ' completed tasks';
      toggleBtn.onclick = function () {
        showAllHistory = true;
        renderTasks();
      };
    }

    taskList.appendChild(toggleBtn);
  }

  updateLiveTimers();
}

function updateLiveTimers() {
  const timerElements = document.querySelectorAll('.task-timer');

  timerElements.forEach(function (el) {
    const start = Number(el.getAttribute('data-start'));
    const elapsedMs = Date.now() - start;
    el.textContent = formatElapsed(elapsedMs);
  });
}

function updatePrediction() {
  const rawEstimate = Number(taskEstimateInput.value);
  const unit = taskUnitInput.value;
  const estimateMinutes = rawEstimate * UNIT_TO_MINUTES[unit];
  const category = taskCategoryInput.value;

  if (isNaN(rawEstimate) || rawEstimate <= 0) {
    prediction.textContent = '';
    return;
  }

  let multiplier = calculateMultiplier(category);
  let usingCategory = true;

  if (multiplier === null) {
    multiplier = calculateMultiplier(null);
    usingCategory = false;
  }

  if (multiplier === null) {
    const defaultMultiplier = 1.5;
    const defaultPredictedMinutes = Math.round(estimateMinutes * defaultMultiplier);
    prediction.textContent = 'No history yet, so as a starting guess, expect around ' + formatTime(defaultPredictedMinutes);
    return;
  }

  const predictedMinutes = Math.round(estimateMinutes * multiplier);
  const source = usingCategory ? 'your ' + category + ' history' : 'your overall history';
  prediction.textContent = 'Based on ' + source + ', expect around ' + formatTime(predictedMinutes);
}

function checkMilestone() {
  const completedCount = tasks.filter(function (t) {
    return t.actualMinutes !== undefined;
  }).length;

  const milestones = [10, 25, 50, 100];

  if (milestones.indexOf(completedCount) !== -1) {
    alert('Milestone: ' + completedCount + ' tasks logged. That is real data now.');
  }
}

function exportData() {
  const dataStr = JSON.stringify(tasks, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = 'black-paper-backup.json';
  link.click();

  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files[0];

  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const importedTasks = JSON.parse(e.target.result);

      if (!Array.isArray(importedTasks)) {
        alert('This file does not look like a Black Paper backup.');
        return;
      }

      tasks = importedTasks;
      localStorage.setItem('tasks', JSON.stringify(tasks));

      renderTasks();
      renderStats();
      renderWeeklyCheck();
      renderDayTotal();
      renderTrend();

      alert('Data restored from backup.');
    } catch (err) {
      alert('Could not read this file. Make sure it is a Black Paper backup file.');
    }
  };

  reader.readAsText(file);
  event.target.value = '';
}

function generateRealityCard() {
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'hsl(21, 73%, 53%)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#000000';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText('BLACK PAPER', 40, 70);

  ctx.fillStyle = '#52200a';
  ctx.font = '18px sans-serif';
  ctx.fillText('My Reality Check', 40, 100);

  const multiplier = calculateMultiplier(null);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 60px sans-serif';

  if (multiplier === null) {
    ctx.fillText('No data yet', 40, 200);
  } else {
    const percent = Math.round(Math.abs(multiplier - 1) * 100);
    const label = multiplier >= 1 ? '+' + percent + '%' : '-' + percent + '%';
    ctx.fillText(label, 40, 210);

    ctx.fillStyle = '#52091a';
    ctx.font = '20px sans-serif';
    const voiceLine = multiplier >= 1 ? 'yeah! that is really how wrong I am' : 'cool, I am early sometimes';
    ctx.fillText(voiceLine, 40, 245);
  }

  const completedCount = tasks.filter(function (t) {
    return t.actualMinutes !== undefined;
  }).length;

  ctx.fillStyle = '#52200a';
  ctx.font = '22px sans-serif';
  ctx.fillText(completedCount + ' tasks logged', 40, 320);

  const link = document.createElement('a');
  link.download = 'black-paper-reality-card.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
}

form.addEventListener('submit', function (e) {
  e.preventDefault();

  const unit = taskUnitInput.value;
  const rawEstimate = Number(taskEstimateInput.value);
  const estimateMinutes = rawEstimate * UNIT_TO_MINUTES[unit];
  const dreadValue = taskDreadInput.value ? Number(taskDreadInput.value) : null;

  const newTask = {
    id: Date.now(),
    name: taskNameInput.value,
    category: taskCategoryInput.value,
    estimateMinutes: estimateMinutes,
    startTime: Date.now(),
    targetDate: taskTargetDateInput.value || null,
    dread: dreadValue,
    tabSwitches: 0
  };

  tasks.push(newTask);
  localStorage.setItem('tasks', JSON.stringify(tasks));

  renderTasks();
  renderDayTotal();
  form.reset();
  prediction.textContent = '';
});

function markDone(id) {
  const task = tasks.find(function (t) {
    return t.id === id;
  });

  const elapsedMs = Date.now() - task.startTime;
  task.actualMinutes = Math.round(elapsedMs / 60000);
  task.completedAt = Date.now();

  if (task.targetDate) {
    const targetTimestamp = new Date(task.targetDate + 'T23:59:59').getTime();
    const diffMs = task.completedAt - targetTimestamp;
    task.daysLate = Math.round(diffMs / 86400000);
  }

  localStorage.setItem('tasks', JSON.stringify(tasks));
  renderTasks();
  renderStats();
  renderWeeklyCheck();
  renderDayTotal();
  renderTrend();
  checkMilestone();
}

function deleteTask(id) {
  tasks = tasks.filter(function (t) {
    return t.id !== id;
  });

  localStorage.setItem('tasks', JSON.stringify(tasks));
  renderTasks();
  renderStats();
  renderWeeklyCheck();
  renderDayTotal();
  renderTrend();
}

document.addEventListener('visibilitychange', function () {
  if (document.hidden) {
    let changed = false;
    tasks.forEach(function (t) {
      if (t.actualMinutes === undefined) {
        t.tabSwitches = (t.tabSwitches || 0) + 1;
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem('tasks', JSON.stringify(tasks));
    }
  }
});

taskEstimateInput.addEventListener('input', updatePrediction);
taskCategoryInput.addEventListener('change', updatePrediction);
taskUnitInput.addEventListener('change', updatePrediction);
exportBtn.addEventListener('click', exportData);
importInput.addEventListener('change', importData);
cardBtn.addEventListener('click', generateRealityCard);

renderTasks();
renderStats();
renderWeeklyCheck();
renderDayTotal();
renderTrend();

setInterval(updateLiveTimers, 1000);
