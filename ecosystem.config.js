module.exports = {
  apps: [{
    name: "sakhgo",
    script: "npm",
    args: "run start",
    cwd: "/home/alex/sakhgo",
    env: {
      NODE_ENV: "production",
      DB_HOST: "localhost",
      DB_PORT: "5432",
      DB_NAME: "sakhgo",
      DB_USER: "sakhgo",
      DB_PASSWORD: "REDACTED",
      DATABASE_URL: "postgresql://sakhgo:REDACTED@localhost:5432/sakhgo",
      PORT: "3000"
    }
  }]
}
