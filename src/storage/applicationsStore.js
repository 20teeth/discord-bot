const { APPLICATIONS_PATH } = require('../config');
const { readJson, writeJson } = require('./jsonStore');

function saveApplication(appId, application) {
  const applications = readJson(APPLICATIONS_PATH, {});
  applications[appId] = application;
  writeJson(APPLICATIONS_PATH, applications);
}

function updateApplication(appId, patch) {
  const applications = readJson(APPLICATIONS_PATH, {});
  if (!applications[appId]) {
    return null;
  }

  applications[appId] = { ...applications[appId], ...patch };
  writeJson(APPLICATIONS_PATH, applications);
  return applications[appId];
}

function getApplication(appId) {
  const applications = readJson(APPLICATIONS_PATH, {});
  return applications[appId] || null;
}

module.exports = {
  saveApplication,
  updateApplication,
  getApplication,
};
