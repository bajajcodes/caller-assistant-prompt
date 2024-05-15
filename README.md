# caller-assistant-prompt

## Setting Up Your Project

**Before you begin:**

- Make sure you have Node.js installed. Check by running `node -v` in your terminal. Download it from [https://nodejs.org/en](https://nodejs.org/en) if needed.

- Switch to `feat/dashboard` Branch.

**1. Environment Variables:**

- Create a file named `.env` in your project's root directory.
- Fill it with the following lines, replacing placeholders with your actual credentials:

```sh
HOST={{HOST}}
TWILIO_ACCOUNT_SID={{TWILIO_ACCOUNT_SID}}
TWILIO_AUTH_TOKEN={{TWILIO_AUTH_TOKEN}}
TWILIO_FROM_NUMBER={{TWILIO_FROM_NUMBER}}
PORT={{PORT}}
DEEPGRAM_API_KEY={{DEEPGRAM_API_KEY}}
TWILIO_API_KEY={{TWILIO_API_KEY}}
TWILIO_API_SECRET={{TWILIO_API_SECRET}}
OPEN_AI_KEY={{OPEN_AI_KEY}}
REDIS_CLIENT_URL={{REDIS_CLIENT_URL}}
```

**2. Install Dependencies:**

- Open your terminal and navigate to your project's `backend` directory.
- Run `npm install` to install all dependencies.

**3. Running a Redis Server Locally with Docker (for development only):**
This step is optional but recommended for local development. It allows you to run a Redis server within a Docker container.

- Open your terminal.
- Install Docker.
- Pull latest Redis image.

```sh
docker pull redis
```

- Run the following command to start a Redis container in the background:

```sh
 docker run --name {{redis-name}} -p 6379:6379 -d redis
```

Replace {{redis-name}} with name of your choice.

- Verify if the Redis container is running:

```sh
docker ps
```

This should list your running containers, including the myredis container you just started.

- Connect to the Redis Container

```sh
docker exec -it {{redis-name}} sh
```

- Type `redis-cli` into terminal for testing Redis container, then type `ping` to test redis container.

```sh
redis-cli
```

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

- (Optional) Type into terminal `npm run ui` to copy frontend build if doesn't exisits as `dist` inside `backend` directory.
- Simply run `npm run start` in your terminal.
- This will start the project and automatically reload any changes you make.

**That's it!** Your project should now be running, typically on port 3000 (check your terminal output for confirmation).

## How to Hit the `/makeoutboundcall` Endpoint

**Before you begin:**

- Make sure you have Postman or Other Similar appication installed for making outbound calls.

**1. API Endpoint**

```sh
HOST/makeoutboundcall
```

> Replace ‘HOST’ with the actual domain name hosting the API.

**2. Method**

This endpoint accept a POST request since you're initiating an outbound call.

**3. Payload Data**

_Payload Structure_

- **ivrMenu:** An array of objects configuring the IVR (Interactive Voice Response) menu.
  - _intent:_ Represents the expected caller's purpose for the call.
  - _response:_ (Likely) what the IVR system should reply with.
  - _triggers:_ Words or phrases that would match this intent.
- **providerData:** An object containing detailed information about the healthcare provider associated with the call. The Payer number key is expected to be named as `phoneNumber`.

_Example Payload Data:_

```json
{
  "ivrMenu": [
    {
      "intent": "Provider Type",
      "triggers": ["health care provider"],
      "response": "health care provider"
    },
    {
      "intent": "Enter NPI",
      "response": "{providerNpi}",
      "triggers": ["providers npi"]
    },
    {
      "intent": "Verify NPI",
      "response": "1",
      "triggers": ["{providerNpi} correct"]
    },
    {
      "intent": "Calling From",
      "triggers": ["behavioral health"],
      "response": "3"
    },
    {
      "intent": "Calling About",
      "response": "2",
      "triggers": ["eligibility"]
    },
    {
      "intent": "Sepciality",
      "response": "{providerSpecialty}",
      "triggers": ["sepciality type"]
    }
  ],
  "providerData": {
    "ticketId": 170958,
    "ticketName": "Application Follow-up",
    "taskType": "Application followup by Phone",
    "payerName": "United Healthcare Insurance Company (Washington)",
    "providerNpi": "1033400346",
    "providerName": "JILL BISHOP",
    "taxId": "933437607",
    "serviceState": "WA",
    "speciality": "Mental Health Counselor",
    "locationAddress": "1610 Scott Place  Bremerton WA 98310",
    "specialityType": "Behavioral Health Providers",
    "phoneNumber": "8776140484",
    "callbackNumber": "8264551832",
    "applicationSubmitionDate": "04/19/2024 12:00:00 AM EST",
    "applicationTrackingNumber": ""
  }
}
```
