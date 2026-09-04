import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function run() {
  console.log("=== test-openai.js START ===");

  try {
    const res = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "user",
          content: "返事は一言で「OK」としてください。",
        },
      ],
    });

    console.log("SUCCESS:", res.choices[0].message.content);
  } catch (e) {
    console.error("ERROR:", e);
  }

  console.log("=== END ===");
}

run();
