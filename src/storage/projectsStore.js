const { PROJECTS_PATH } = require('../config');
const { readJson, writeJson } = require('./jsonStore');

function saveProject(projectId, project) {
  const projects = readJson(PROJECTS_PATH, {});
  projects[projectId] = project;
  writeJson(PROJECTS_PATH, projects);
}

module.exports = {
  saveProject,
};
