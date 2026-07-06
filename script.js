const form = document.getElementById('task-form');
const taskNameInput = document.getElementById('task-name');
const taskEstimateInput = document.getElementById('task-estimate');
const taskList = document.getElementById('task-list');

let tasks = JSON.parse(localStorage.getItem('tasks')) || [];

function renderTasks() {
  taskList.innerHTML = '';
  tasks.forEach(function (task) {
    const taskDiv = document.createElement('div');
    taskDiv.className = 'task';
    taskDiv.innerHTML = `
      <p class="task-name">${task.name}</p>
      <p class="task-estimate">Estimated: ${task.estimate} min</p>
    `;
    taskList.appendChild(taskDiv);
  });
}

form.addEventListener('submit', function (e) {
  e.preventDefault();

  const newTask = {
    id: Date.now(),
    name: taskNameInput.value,
    estimate: taskEstimateInput.value
  };

  tasks.push(newTask);
  localStorage.setItem('tasks', JSON.stringify(tasks));

  renderTasks();
  form.reset();
});

renderTasks();