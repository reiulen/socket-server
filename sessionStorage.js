const session = new Map();

const findSession = (id) => {
  return session.get(id);
}

const saveSession = (id, sessionObj) => {
  session.set(id, sessionObj);
}

const findAllSessions = () => {
  return [...session.values()];
}

module.exports = {
  findSession,
  saveSession,
  findAllSessions,
}