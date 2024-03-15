# caller-assistant-prompt

## Setting Up Your Project

**Before you begin:**

- Make sure you have Node.js installed. Check by running `node -v` in your terminal. Download it from [https://nodejs.org/en](https://nodejs.org/en) if needed.

**1. Environment Variables:**

- Create a file named `.env` in your project's root directory.
- Fill it with the following lines, replacing placeholders with your actual credentials:

```sh
TWILIO_ACCOUNT_SID={{TWILIO_ACCOUNT_SID}}
TWILIO_AUTH_TOKEN={{TWILIO_AUTH_TOKEN}}
TWILIO_FROM_NUMBER={{TWILIO_FROM_NUMBER}}
TWILIO_TO_NUMBER={{TWILIO_TO_NUMBER}}
PORT={{PORT}}
DEEPGRAM_API_KEY={{DEEPGRAM_API_KEY}}
TWILIO_API_KEY={{TWILIO_API_KEY}}
TWILIO_API_SECRET={{TWILIO_API_SECRET}}
OPEN_AI_KEY={{OPEN_AI_KEY}}
REDIS_CLIENT_URL={{REDIS_CLIENT_URL}}
```

**2. Install Dependencies:**

- Open your terminal and navigate to your project's root directory.
- Run `npm install` to install all dependencies.

**3. Running a Redis Server Locally with Docker (for development only):**
This step is optional but recommended for local development. It allows you to run a Redis server within a Docker container.

- Open your terminal and navigate to your project's root directory.
- Run the following command to start a Redis container in the background:

```sh
docker run --name myredis -d redis
```

- Verify if the Redis container is running:

```sh
docker ps
```

This should list your running containers, including the myredis container you just started.

- Connect to the Redis Container

```sh
docker exec -it <container_id> sh
```

- Testing Redis container

```sh
127.0.0.1:6379>ping
```

This will print PONG.

- Using REDIS_CLIENT_URL
  After running the Redis container, go back to your .env file and set the REDIS_CLIENT_URL environment variable.

```sh
REDIS_CLIENT_URL=redis://localhost:6379
```

**4. Run the Project:**

- Simply run `npm run dev` in your terminal.
- This will start the project and automatically reload any changes you make.

**That's it!** Your project should now be running, typically on port 3000 (check your terminal output for confirmation).
