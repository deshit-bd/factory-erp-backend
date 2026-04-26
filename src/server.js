const app = require("./app");
const { testConnection } = require("./config/db");

const port = Number(process.env.PORT || 4000);

async function startServer() {
  try {
    await testConnection();
    app.listen(port, () => {
      console.log(`Factory ERP backend listening on port ${port}`);
    });
  } catch (error) {
    console.error("Failed to start backend server.");
    console.error(error);
    process.exit(1);
  }
}

startServer();
