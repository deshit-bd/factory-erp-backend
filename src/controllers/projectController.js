const projectModel = require("../models/projectModel");

function handleProjectError(response, error) {
  console.error(error);
  return response.status(500).json({ message: "Something went wrong while processing projects." });
}

async function getProjects(request, response) {
  try {
    const projects = await projectModel.getAllProjects(request.query.search || "");
    return response.json(projects);
  } catch (error) {
    return handleProjectError(response, error);
  }
}

module.exports = {
  getProjects,
};
